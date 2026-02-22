<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

/**
 * Service ETA (Estimated Time of Arrival)
 * Calcul des temps d'arrivée estimés pour les conductrices
 */
class ETAService
{
    private PDO $db;

    // Vitesses moyennes par contexte (km/h)
    private float $citySpeed = 25.0;
    private float $suburbSpeed = 40.0;
    private float $highwaySpeed = 80.0;

    // Facteurs de trafic
    private array $trafficFactors = [
        'rush_hour' => 0.5,    // 50% plus lent
        'normal' => 1.0,
        'light' => 1.2,        // 20% plus rapide
        'night' => 1.3,        // 30% plus rapide
    ];

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Calculer l'ETA pour une conductrice vers un point de pickup
     */
    public function calculateDriverETA(
        int $driverId,
        float $pickupLat,
        float $pickupLng
    ): array {
        // Obtenir la position actuelle de la conductrice
        $stmt = $this->db->prepare('
            SELECT latitude, longitude, heading, speed, updated_at
            FROM driver_locations
            WHERE driver_id = :driver_id
            AND updated_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            ORDER BY updated_at DESC
            LIMIT 1
        ');
        $stmt->execute(['driver_id' => $driverId]);
        $location = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$location) {
            return [
                'available' => false,
                'eta_minutes' => null,
                'eta_text' => __('eta.location_unavailable'),
            ];
        }

        $distance = $this->calculateDistance(
            (float) $location['latitude'],
            (float) $location['longitude'],
            $pickupLat,
            $pickupLng
        );

        // Déterminer le contexte de trafic
        $trafficFactor = $this->getTrafficFactor();

        // Estimer le temps basé sur la distance et le trafic
        $avgSpeed = $this->estimateAverageSpeed($distance);
        $baseMinutes = ($distance / $avgSpeed) * 60;
        $adjustedMinutes = $baseMinutes / $trafficFactor;

        // Ajouter un buffer de sécurité (10%)
        $etaMinutes = (int) ceil($adjustedMinutes * 1.1);

        // Minimum 2 minutes
        $etaMinutes = max(2, $etaMinutes);

        return [
            'available' => true,
            'driver_id' => $driverId,
            'distance_km' => round($distance, 2),
            'eta_minutes' => $etaMinutes,
            'eta_text' => $this->formatETA($etaMinutes),
            'eta_range' => $this->getETARange($etaMinutes),
            'traffic_factor' => $trafficFactor,
            'driver_speed' => (float) ($location['speed'] ?? 0),
            'driver_heading' => (float) ($location['heading'] ?? 0),
            'last_update' => $location['updated_at'],
        ];
    }

    /**
     * Trouver la conductrice la plus proche avec ETA
     */
    public function findNearestDriverWithETA(
        float $pickupLat,
        float $pickupLng,
        ?string $vehicleType = null,
        int $limit = 5
    ): array {
        // Vérifier si la table driver_locations existe
        try {
            $check = $this->db->query("SHOW TABLES LIKE 'driver_locations'");
            if ($check->rowCount() === 0) {
                return []; // Table n'existe pas encore
            }
        } catch (\Exception $e) {
            return [];
        }

        $typeCondition = '';
        $params = [
            'lat' => $pickupLat,
            'lng' => $pickupLng,
            'lat2' => $pickupLat,
        ];

        if ($vehicleType) {
            $typeCondition = 'AND v.vehicle_type = :vehicle_type';
            $params['vehicle_type'] = $vehicleType;
        }

        try {
            $stmt = $this->db->prepare("
                SELECT
                    u.id as driver_id,
                    u.first_name,
                    u.profile_photo,
                    u.rating,
                    dl.latitude,
                    dl.longitude,
                    dl.heading,
                    dl.speed,
                    v.brand as vehicle_brand,
                    v.model as vehicle_model,
                    v.color as vehicle_color,
                    v.license_plate,
                    v.vehicle_type,
                    (
                        6371 * acos(
                            cos(radians(:lat)) * cos(radians(dl.latitude))
                            * cos(radians(dl.longitude) - radians(:lng))
                            + sin(radians(:lat2)) * sin(radians(dl.latitude))
                        )
                    ) as distance_km
                FROM users u
                JOIN driver_locations dl ON u.id = dl.driver_id
                LEFT JOIN vehicles v ON u.id = v.driver_id AND v.is_active = 1
                WHERE u.role = 'driver'
                AND u.is_online = 1
                AND u.is_verified = 1
                AND dl.updated_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                {$typeCondition}
                ORDER BY distance_km ASC
                LIMIT :limit
            ");

            $params['limit'] = $limit;
            $stmt->execute($params);
            $drivers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\Exception $e) {
            // Si erreur (ex: colonnes manquantes), retourner tableau vide
            return [];
        }

        $results = [];
        $trafficFactor = $this->getTrafficFactor();

        foreach ($drivers as $driver) {
            $distance = (float) $driver['distance_km'];
            $avgSpeed = $this->estimateAverageSpeed($distance);
            $baseMinutes = ($distance / $avgSpeed) * 60;
            $etaMinutes = (int) ceil(($baseMinutes / $trafficFactor) * 1.1);
            $etaMinutes = max(2, $etaMinutes);

            $results[] = [
                'driver_id' => (int) $driver['driver_id'],
                'first_name' => $driver['first_name'],
                'profile_photo' => $driver['profile_photo'],
                'rating' => (float) ($driver['rating'] ?? 5.0),
                'distance_km' => round($distance, 2),
                'eta_minutes' => $etaMinutes,
                'eta_text' => $this->formatETA($etaMinutes),
                'vehicle' => [
                    'brand' => $driver['vehicle_brand'],
                    'model' => $driver['vehicle_model'],
                    'color' => $driver['vehicle_color'],
                    'license_plate' => $driver['license_plate'],
                    'type' => $driver['vehicle_type'],
                ],
                'position' => [
                    'lat' => (float) $driver['latitude'],
                    'lng' => (float) $driver['longitude'],
                    'heading' => (float) $driver['heading'],
                ],
            ];
        }

        return $results;
    }

    /**
     * Calculer l'ETA de la course (pickup vers destination)
     */
    public function calculateRideETA(
        float $pickupLat,
        float $pickupLng,
        float $dropoffLat,
        float $dropoffLng
    ): array {
        $distance = $this->calculateDistance($pickupLat, $pickupLng, $dropoffLat, $dropoffLng);
        $trafficFactor = $this->getTrafficFactor();

        $avgSpeed = $this->estimateAverageSpeed($distance);
        $baseMinutes = ($distance / $avgSpeed) * 60;
        $etaMinutes = (int) ceil($baseMinutes / $trafficFactor);

        return [
            'distance_km' => round($distance, 2),
            'duration_minutes' => $etaMinutes,
            'duration_text' => $this->formatDuration($etaMinutes),
            'traffic_factor' => $trafficFactor,
            'arrival_time' => (new \DateTime())->modify("+{$etaMinutes} minutes")->format('H:i'),
        ];
    }

    /**
     * Mettre à jour la position de la conductrice et recalculer l'ETA
     */
    public function updateDriverLocation(
        int $driverId,
        float $lat,
        float $lng,
        ?float $heading = null,
        ?float $speed = null
    ): bool {
        $stmt = $this->db->prepare('
            INSERT INTO driver_locations (driver_id, latitude, longitude, heading, speed, updated_at)
            VALUES (:driver_id, :lat, :lng, :heading, :speed, NOW())
            ON DUPLICATE KEY UPDATE
                latitude = :lat2,
                longitude = :lng2,
                heading = :heading2,
                speed = :speed2,
                updated_at = NOW()
        ');

        return $stmt->execute([
            'driver_id' => $driverId,
            'lat' => $lat,
            'lng' => $lng,
            'heading' => $heading,
            'speed' => $speed,
            'lat2' => $lat,
            'lng2' => $lng,
            'heading2' => $heading,
            'speed2' => $speed,
        ]);
    }

    /**
     * Obtenir l'ETA en temps réel pour une course active
     */
    public function getRealTimeETA(int $rideId): array
    {
        $stmt = $this->db->prepare('
            SELECT r.*, dl.latitude as driver_lat, dl.longitude as driver_lng,
                   dl.heading, dl.speed, dl.updated_at as driver_updated
            FROM rides r
            LEFT JOIN driver_locations dl ON r.driver_id = dl.driver_id
            WHERE r.id = :ride_id
        ');
        $stmt->execute(['ride_id' => $rideId]);
        $ride = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$ride) {
            return ['error' => 'Ride not found'];
        }

        $result = [
            'ride_id' => $rideId,
            'status' => $ride['status'],
        ];

        if ($ride['status'] === 'accepted' && $ride['driver_lat']) {
            // ETA vers le pickup
            $toPickup = $this->calculateDriverETA(
                (int) $ride['driver_id'],
                (float) $ride['pickup_lat'],
                (float) $ride['pickup_lng']
            );

            $result['to_pickup'] = $toPickup;
            $result['driver_position'] = [
                'lat' => (float) $ride['driver_lat'],
                'lng' => (float) $ride['driver_lng'],
                'heading' => (float) $ride['heading'],
                'speed' => (float) $ride['speed'],
            ];
        } elseif ($ride['status'] === 'in_progress' && $ride['driver_lat']) {
            // ETA vers la destination
            $distance = $this->calculateDistance(
                (float) $ride['driver_lat'],
                (float) $ride['driver_lng'],
                (float) $ride['dropoff_lat'],
                (float) $ride['dropoff_lng']
            );

            $trafficFactor = $this->getTrafficFactor();
            $avgSpeed = $this->estimateAverageSpeed($distance);
            $etaMinutes = (int) ceil(($distance / $avgSpeed) * 60 / $trafficFactor);

            $result['to_destination'] = [
                'distance_km' => round($distance, 2),
                'eta_minutes' => max(1, $etaMinutes),
                'eta_text' => $this->formatETA(max(1, $etaMinutes)),
                'arrival_time' => (new \DateTime())->modify("+{$etaMinutes} minutes")->format('H:i'),
            ];
            $result['driver_position'] = [
                'lat' => (float) $ride['driver_lat'],
                'lng' => (float) $ride['driver_lng'],
                'heading' => (float) $ride['heading'],
                'speed' => (float) $ride['speed'],
            ];
        }

        return $result;
    }

    /**
     * Calculer la distance entre deux points (formule Haversine)
     */
    private function calculateDistance(
        float $lat1,
        float $lng1,
        float $lat2,
        float $lng2
    ): float {
        $earthRadius = 6371; // km

        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) * sin($dLat / 2)
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2))
            * sin($dLng / 2) * sin($dLng / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    /**
     * Estimer la vitesse moyenne selon la distance
     */
    private function estimateAverageSpeed(float $distanceKm): float
    {
        if ($distanceKm < 3) {
            return $this->citySpeed; // Court trajet en ville
        } elseif ($distanceKm < 10) {
            return ($this->citySpeed + $this->suburbSpeed) / 2;
        } elseif ($distanceKm < 30) {
            return $this->suburbSpeed;
        } else {
            return ($this->suburbSpeed + $this->highwaySpeed) / 2;
        }
    }

    /**
     * Obtenir le facteur de trafic selon l'heure
     */
    private function getTrafficFactor(): float
    {
        $hour = (int) date('H');
        $dayOfWeek = (int) date('w'); // 0=Dimanche

        // Week-end
        if ($dayOfWeek === 0 || $dayOfWeek === 6) {
            if ($hour >= 23 || $hour < 6) {
                return $this->trafficFactors['night'];
            }
            return $this->trafficFactors['light'];
        }

        // Jours ouvrés
        if ($hour >= 23 || $hour < 6) {
            return $this->trafficFactors['night'];
        } elseif (($hour >= 7 && $hour <= 9) || ($hour >= 17 && $hour <= 19)) {
            return $this->trafficFactors['rush_hour'];
        } elseif ($hour >= 10 && $hour <= 16) {
            return $this->trafficFactors['normal'];
        } else {
            return $this->trafficFactors['light'];
        }
    }

    /**
     * Formater l'ETA en texte lisible
     */
    private function formatETA(int $minutes): string
    {
        if ($minutes <= 1) {
            return __('eta.arriving');
        } elseif ($minutes <= 2) {
            return __('eta.very_close');
        } elseif ($minutes < 60) {
            return sprintf(__('eta.minutes'), $minutes);
        } else {
            $hours = floor($minutes / 60);
            $mins = $minutes % 60;
            if ($mins === 0) {
                return sprintf(__('eta.hours'), $hours);
            }
            return sprintf(__('eta.hours_minutes'), $hours, $mins);
        }
    }

    /**
     * Formater une durée en texte
     */
    private function formatDuration(int $minutes): string
    {
        if ($minutes < 60) {
            return sprintf(__('duration.minutes'), $minutes);
        } else {
            $hours = floor($minutes / 60);
            $mins = $minutes % 60;
            if ($mins === 0) {
                return sprintf(__('duration.hours'), $hours);
            }
            return sprintf(__('duration.hours_minutes'), $hours, $mins);
        }
    }

    /**
     * Obtenir une plage d'ETA (ex: "3-5 min")
     */
    private function getETARange(int $minutes): string
    {
        $min = max(1, $minutes - 1);
        $max = $minutes + 2;

        return "{$min}-{$max} min";
    }
}
