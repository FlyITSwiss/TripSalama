<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

/**
 * Service de Géofencing
 * Gestion des zones géographiques (tarification, restrictions, alertes)
 */
class GeofencingService
{
    private PDO $db;

    // Rayon de la Terre en kilomètres
    private const EARTH_RADIUS_KM = 6371;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->ensureTableExists();
    }

    /**
     * Vérifier si un point est dans une zone
     *
     * @param float $lat Latitude du point
     * @param float $lng Longitude du point
     * @param string|null $zoneType Type de zone à chercher (null = toutes)
     * @return array|null Zone trouvée ou null
     */
    public function isInZone(float $lat, float $lng, ?string $zoneType = null): ?array
    {
        $sql = '
            SELECT gz.*,
                   (
                       :radius * ACOS(
                           COS(RADIANS(:lat)) * COS(RADIANS(center_lat)) *
                           COS(RADIANS(center_lng) - RADIANS(:lng)) +
                           SIN(RADIANS(:lat2)) * SIN(RADIANS(center_lat))
                       )
                   ) AS distance_km
            FROM geofence_zones gz
            WHERE gz.is_active = 1
        ';

        $params = [
            'radius' => self::EARTH_RADIUS_KM,
            'lat' => $lat,
            'lng' => $lng,
            'lat2' => $lat,
        ];

        if ($zoneType !== null) {
            $sql .= ' AND gz.zone_type = :zone_type';
            $params['zone_type'] = $zoneType;
        }

        $sql .= ' HAVING distance_km <= gz.radius_km ORDER BY distance_km ASC LIMIT 1';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $zone = $stmt->fetch(PDO::FETCH_ASSOC);

        return $zone ?: null;
    }

    /**
     * Obtenir toutes les zones contenant un point
     *
     * @param float $lat Latitude
     * @param float $lng Longitude
     * @return array Liste des zones
     */
    public function getZonesContaining(float $lat, float $lng): array
    {
        $stmt = $this->db->prepare('
            SELECT gz.*,
                   (
                       :radius * ACOS(
                           COS(RADIANS(:lat)) * COS(RADIANS(center_lat)) *
                           COS(RADIANS(center_lng) - RADIANS(:lng)) +
                           SIN(RADIANS(:lat2)) * SIN(RADIANS(center_lat))
                       )
                   ) AS distance_km
            FROM geofence_zones gz
            WHERE gz.is_active = 1
            HAVING distance_km <= gz.radius_km
            ORDER BY gz.priority DESC, distance_km ASC
        ');

        $stmt->execute([
            'radius' => self::EARTH_RADIUS_KM,
            'lat' => $lat,
            'lng' => $lng,
            'lat2' => $lat,
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Calculer le tarif pour un trajet basé sur les zones
     *
     * @param float $pickupLat Latitude départ
     * @param float $pickupLng Longitude départ
     * @param float $dropoffLat Latitude arrivée
     * @param float $dropoffLng Longitude arrivée
     * @param float $distanceKm Distance du trajet
     * @return array Détail de la tarification
     */
    public function calculateFare(
        float $pickupLat,
        float $pickupLng,
        float $dropoffLat,
        float $dropoffLng,
        float $distanceKm
    ): array {
        // Zones de départ et d'arrivée
        $pickupZone = $this->isInZone($pickupLat, $pickupLng, 'pricing');
        $dropoffZone = $this->isInZone($dropoffLat, $dropoffLng, 'pricing');

        // Tarif de base (config pays)
        $baseFare = 10.0;  // CHF
        $perKmRate = 1.5;  // CHF/km
        $perMinRate = 0.3; // CHF/min

        // Multiplicateurs
        $pickupMultiplier = $pickupZone['price_multiplier'] ?? 1.0;
        $dropoffMultiplier = $dropoffZone['price_multiplier'] ?? 1.0;

        // Utiliser le plus élevé des deux
        $zoneMultiplier = max((float)$pickupMultiplier, (float)$dropoffMultiplier);

        // Supplément aéroport/gare
        $supplements = [];
        if ($pickupZone && $pickupZone['zone_type'] === 'pricing') {
            $supplement = (float)($pickupZone['fixed_supplement'] ?? 0);
            if ($supplement > 0) {
                $supplements[] = [
                    'name' => $pickupZone['name'],
                    'amount' => $supplement,
                ];
            }
        }

        // Calcul final
        $distanceFare = $distanceKm * $perKmRate * $zoneMultiplier;
        $totalFare = $baseFare + $distanceFare;

        foreach ($supplements as $supp) {
            $totalFare += $supp['amount'];
        }

        return [
            'base_fare' => round($baseFare, 2),
            'distance_fare' => round($distanceFare, 2),
            'zone_multiplier' => $zoneMultiplier,
            'supplements' => $supplements,
            'total_fare' => round($totalFare, 2),
            'pickup_zone' => $pickupZone ? $pickupZone['name'] : null,
            'dropoff_zone' => $dropoffZone ? $dropoffZone['name'] : null,
        ];
    }

    /**
     * Vérifier si un trajet traverse une zone restreinte
     *
     * @param float $pickupLat Latitude départ
     * @param float $pickupLng Longitude départ
     * @param float $dropoffLat Latitude arrivée
     * @param float $dropoffLng Longitude arrivée
     * @return array|null Zone restreinte trouvée ou null
     */
    public function checkRestrictions(
        float $pickupLat,
        float $pickupLng,
        float $dropoffLat,
        float $dropoffLng
    ): ?array {
        // Vérifier le point de départ
        $restrictedPickup = $this->isInZone($pickupLat, $pickupLng, 'restricted');
        if ($restrictedPickup) {
            return [
                'restricted' => true,
                'zone' => $restrictedPickup,
                'location' => 'pickup',
                'message' => $restrictedPickup['restriction_message'] ?? __('error.zone_restricted'),
            ];
        }

        // Vérifier le point d'arrivée
        $restrictedDropoff = $this->isInZone($dropoffLat, $dropoffLng, 'restricted');
        if ($restrictedDropoff) {
            return [
                'restricted' => true,
                'zone' => $restrictedDropoff,
                'location' => 'dropoff',
                'message' => $restrictedDropoff['restriction_message'] ?? __('error.zone_restricted'),
            ];
        }

        return null;
    }

    /**
     * Créer une zone
     *
     * @param array $data Données de la zone
     * @return int ID de la zone créée
     */
    public function createZone(array $data): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO geofence_zones (
                name, zone_type, center_lat, center_lng, radius_km,
                price_multiplier, fixed_supplement, restriction_message,
                priority, is_active
            ) VALUES (
                :name, :zone_type, :center_lat, :center_lng, :radius_km,
                :price_multiplier, :fixed_supplement, :restriction_message,
                :priority, :is_active
            )
        ');

        $stmt->execute([
            'name' => $data['name'],
            'zone_type' => $data['zone_type'] ?? 'pricing',
            'center_lat' => $data['center_lat'],
            'center_lng' => $data['center_lng'],
            'radius_km' => $data['radius_km'],
            'price_multiplier' => $data['price_multiplier'] ?? 1.0,
            'fixed_supplement' => $data['fixed_supplement'] ?? 0,
            'restriction_message' => $data['restriction_message'] ?? null,
            'priority' => $data['priority'] ?? 0,
            'is_active' => $data['is_active'] ?? 1,
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Obtenir toutes les zones actives
     *
     * @param string|null $zoneType Type de zone
     * @return array Liste des zones
     */
    public function getActiveZones(?string $zoneType = null): array
    {
        $sql = 'SELECT * FROM geofence_zones WHERE is_active = 1';
        $params = [];

        if ($zoneType !== null) {
            $sql .= ' AND zone_type = :zone_type';
            $params['zone_type'] = $zoneType;
        }

        $sql .= ' ORDER BY priority DESC, name ASC';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Calculer la distance entre deux points (Haversine)
     *
     * @param float $lat1 Latitude point 1
     * @param float $lng1 Longitude point 1
     * @param float $lat2 Latitude point 2
     * @param float $lng2 Longitude point 2
     * @return float Distance en kilomètres
     */
    public function calculateDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $lat1Rad = deg2rad($lat1);
        $lat2Rad = deg2rad($lat2);
        $deltaLat = deg2rad($lat2 - $lat1);
        $deltaLng = deg2rad($lng2 - $lng1);

        $a = sin($deltaLat / 2) * sin($deltaLat / 2) +
             cos($lat1Rad) * cos($lat2Rad) *
             sin($deltaLng / 2) * sin($deltaLng / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return self::EARTH_RADIUS_KM * $c;
    }

    /**
     * Créer la table si elle n'existe pas
     */
    private function ensureTableExists(): void
    {
        $this->db->exec('
            CREATE TABLE IF NOT EXISTS geofence_zones (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                zone_type ENUM("pricing", "restricted", "surge", "promo") NOT NULL DEFAULT "pricing",
                center_lat DECIMAL(10, 8) NOT NULL,
                center_lng DECIMAL(11, 8) NOT NULL,
                radius_km DECIMAL(10, 3) NOT NULL,
                price_multiplier DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
                fixed_supplement DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                restriction_message VARCHAR(255) NULL,
                priority INT NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                INDEX idx_geofence_type (zone_type),
                INDEX idx_geofence_active (is_active),
                INDEX idx_geofence_coords (center_lat, center_lng)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ');
    }
}
