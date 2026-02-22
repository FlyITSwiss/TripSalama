<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

/**
 * Service Types de Véhicules
 * Gestion des catégories de véhicules et tarification
 */
class VehicleTypeService
{
    private PDO $db;

    // Multiplicateurs par défaut
    private array $defaultTypes = [
        'standard' => [
            'name' => 'Standard',
            'icon' => 'car',
            'description' => 'Voiture économique pour trajets quotidiens',
            'base_fare' => 8.0,
            'per_km_rate' => 3.5,
            'per_minute_rate' => 0.5,
            'min_fare' => 15.0,
            'capacity' => 4,
            'multiplier' => 1.0,
        ],
        'comfort' => [
            'name' => 'Confort',
            'icon' => 'car-side',
            'description' => 'Berline spacieuse avec climatisation',
            'base_fare' => 12.0,
            'per_km_rate' => 4.5,
            'per_minute_rate' => 0.7,
            'min_fare' => 20.0,
            'capacity' => 4,
            'multiplier' => 1.3,
        ],
        'van' => [
            'name' => 'Van',
            'icon' => 'shuttle-van',
            'description' => 'Minivan pour groupes ou bagages',
            'base_fare' => 15.0,
            'per_km_rate' => 5.0,
            'per_minute_rate' => 0.8,
            'min_fare' => 25.0,
            'capacity' => 7,
            'multiplier' => 1.5,
        ],
        'premium' => [
            'name' => 'Premium',
            'icon' => 'gem',
            'description' => 'Véhicule haut de gamme, expérience luxe',
            'base_fare' => 20.0,
            'per_km_rate' => 7.0,
            'per_minute_rate' => 1.0,
            'min_fare' => 35.0,
            'capacity' => 4,
            'multiplier' => 2.0,
        ],
    ];

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Initialiser les types de véhicules par défaut
     */
    public function initializeDefaults(): void
    {
        foreach ($this->defaultTypes as $code => $type) {
            $stmt = $this->db->prepare('SELECT id FROM vehicle_types WHERE code = :code');
            $stmt->execute(['code' => $code]);

            if (!$stmt->fetch()) {
                $this->create(array_merge($type, ['code' => $code]));
            }
        }
    }

    /**
     * Obtenir tous les types de véhicules actifs
     */
    public function getActive(): array
    {
        $stmt = $this->db->query('
            SELECT * FROM vehicle_types
            WHERE is_active = 1
            ORDER BY sort_order ASC
        ');

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtenir tous les types de véhicules
     */
    public function getAll(): array
    {
        $stmt = $this->db->query('
            SELECT * FROM vehicle_types
            ORDER BY sort_order ASC
        ');

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtenir un type par code
     */
    public function getByCode(string $code): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM vehicle_types WHERE code = :code');
        $stmt->execute(['code' => $code]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    /**
     * Obtenir un type par ID
     */
    public function getById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM vehicle_types WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    /**
     * Calculer le prix estimé pour un type de véhicule
     */
    public function calculatePrice(
        string $vehicleType,
        float $distanceKm,
        int $durationMinutes,
        ?float $surgeMultiplier = null
    ): array {
        $type = $this->getByCode($vehicleType);

        if (!$type) {
            // Type par défaut si non trouvé
            $type = $this->defaultTypes['standard'];
        }

        // Support des deux schémas de colonnes (migration vs service)
        $baseFare = (float) ($type['base_fare'] ?? ($type['base_price_multiplier'] ?? 1.0) * 8.0);
        $perKm = (float) ($type['per_km_rate'] ?? ($type['per_km_multiplier'] ?? 1.0) * 3.5);
        $perMinute = (float) ($type['per_minute_rate'] ?? ($type['per_min_multiplier'] ?? 1.0) * 0.5);
        $minFare = (float) ($type['min_fare'] ?? ($type['min_price_multiplier'] ?? 1.0) * 15.0);
        $multiplier = (float) ($type['multiplier'] ?? $type['base_price_multiplier'] ?? 1.0);

        // Calcul de base
        $distancePrice = $distanceKm * $perKm;
        $timePrice = $durationMinutes * $perMinute;
        $subtotal = ($baseFare + $distancePrice + $timePrice) * $multiplier;

        // Appliquer le surge pricing si applicable
        $surge = $surgeMultiplier ?? 1.0;
        $total = $subtotal * $surge;

        // Appliquer le tarif minimum
        $total = max($total, $minFare);

        return [
            'vehicle_type' => $vehicleType,
            'vehicle_name' => $type['name'],
            'base_fare' => $baseFare,
            'distance_price' => round($distancePrice, 2),
            'time_price' => round($timePrice, 2),
            'subtotal' => round($subtotal, 2),
            'surge_multiplier' => $surge,
            'total' => round($total, 2),
            'currency' => 'MAD',
            'capacity' => (int) $type['capacity'],
        ];
    }

    /**
     * Calculer les prix pour tous les types actifs
     */
    public function calculateAllPrices(
        float $distanceKm,
        int $durationMinutes,
        ?float $surgeMultiplier = null
    ): array {
        $types = $this->getActive();
        $prices = [];

        foreach ($types as $type) {
            $prices[] = $this->calculatePrice(
                $type['code'],
                $distanceKm,
                $durationMinutes,
                $surgeMultiplier
            );
        }

        return $prices;
    }

    /**
     * Créer un nouveau type de véhicule
     */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO vehicle_types (
                code, name, description, icon, base_fare, per_km_rate,
                per_minute_rate, min_fare, capacity, multiplier, sort_order, is_active
            ) VALUES (
                :code, :name, :description, :icon, :base_fare, :per_km_rate,
                :per_minute_rate, :min_fare, :capacity, :multiplier, :sort_order, :is_active
            )
        ');

        $stmt->execute([
            'code' => $data['code'],
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'icon' => $data['icon'] ?? 'car',
            'base_fare' => $data['base_fare'] ?? 8.0,
            'per_km_rate' => $data['per_km_rate'] ?? 3.5,
            'per_minute_rate' => $data['per_minute_rate'] ?? 0.5,
            'min_fare' => $data['min_fare'] ?? 15.0,
            'capacity' => $data['capacity'] ?? 4,
            'multiplier' => $data['multiplier'] ?? 1.0,
            'sort_order' => $data['sort_order'] ?? 0,
            'is_active' => ($data['is_active'] ?? true) ? 1 : 0,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Mettre à jour un type de véhicule
     */
    public function update(int $id, array $data): bool
    {
        $fields = [];
        $params = ['id' => $id];

        $allowedFields = [
            'name', 'description', 'icon', 'base_fare', 'per_km_rate',
            'per_minute_rate', 'min_fare', 'capacity', 'multiplier',
            'sort_order', 'is_active',
        ];

        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $data[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = 'UPDATE vehicle_types SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = :id';

        return $this->db->prepare($sql)->execute($params);
    }

    /**
     * Activer/Désactiver un type
     */
    public function toggleActive(int $id): bool
    {
        $stmt = $this->db->prepare('
            UPDATE vehicle_types
            SET is_active = NOT is_active, updated_at = NOW()
            WHERE id = :id
        ');

        return $stmt->execute(['id' => $id]);
    }

    /**
     * Calculer le surge pricing selon la demande
     */
    public function calculateSurgeMultiplier(float $lat, float $lng): float
    {
        // Vérifier si la table driver_locations existe
        try {
            $check = $this->db->query("SHOW TABLES LIKE 'driver_locations'");
            if ($check->rowCount() === 0) {
                return 1.0; // Pas de surge si table n'existe pas
            }
        } catch (\Exception $e) {
            return 1.0;
        }

        try {
            // Compter les demandes actives dans la zone (5km radius)
            $stmt = $this->db->prepare('
                SELECT COUNT(*) FROM rides
                WHERE status IN ("searching", "pending")
                AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
                AND (
                    6371 * acos(
                        cos(radians(:lat)) * cos(radians(pickup_lat))
                        * cos(radians(pickup_lng) - radians(:lng))
                        + sin(radians(:lat2)) * sin(radians(pickup_lat))
                    )
                ) <= 5
            ');

            $stmt->execute(['lat' => $lat, 'lng' => $lng, 'lat2' => $lat]);
            $activeRequests = (int) $stmt->fetchColumn();

            // Compter les conductrices disponibles dans la zone
            $stmt = $this->db->prepare('
                SELECT COUNT(*) FROM users u
                JOIN driver_locations dl ON u.id = dl.driver_id
                WHERE u.role = "driver"
                AND u.is_online = 1
                AND dl.updated_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                AND (
                    6371 * acos(
                        cos(radians(:lat)) * cos(radians(dl.latitude))
                        * cos(radians(dl.longitude) - radians(:lng))
                        + sin(radians(:lat2)) * sin(radians(dl.latitude))
                    )
                ) <= 5
            ');

            $stmt->execute(['lat' => $lat, 'lng' => $lng, 'lat2' => $lat]);
            $availableDrivers = (int) $stmt->fetchColumn();
        } catch (\Exception $e) {
            return 1.0; // Pas de surge en cas d'erreur
        }

        // Calculer le ratio demande/offre
        if ($availableDrivers === 0) {
            return 2.0; // Max surge si pas de conductrice
        }

        $ratio = $activeRequests / $availableDrivers;

        if ($ratio < 1) {
            return 1.0; // Pas de surge
        } elseif ($ratio < 2) {
            return 1.2; // Léger surge
        } elseif ($ratio < 3) {
            return 1.5; // Surge moyen
        } elseif ($ratio < 5) {
            return 1.8; // Surge élevé
        } else {
            return 2.0; // Max surge
        }
    }

    /**
     * Obtenir les types de véhicules disponibles dans une zone
     */
    public function getAvailableInArea(float $lat, float $lng, int $radiusKm = 5): array
    {
        // Vérifier si les tables nécessaires existent
        try {
            $check = $this->db->query("SHOW TABLES LIKE 'driver_locations'");
            if ($check->rowCount() === 0) {
                return []; // Tables pas encore créées
            }
        } catch (\Exception $e) {
            return [];
        }

        $types = $this->getActive();
        $available = [];

        foreach ($types as $type) {
            try {
                // Compter les conductrices avec ce type de véhicule dans la zone
                $stmt = $this->db->prepare('
                    SELECT COUNT(DISTINCT u.id) FROM users u
                    JOIN vehicles v ON u.id = v.driver_id
                    JOIN driver_locations dl ON u.id = dl.driver_id
                    WHERE u.role = "driver"
                    AND u.is_online = 1
                    AND v.is_active = 1
                    AND v.vehicle_type = :type
                    AND dl.updated_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                    AND (
                        6371 * acos(
                            cos(radians(:lat)) * cos(radians(dl.latitude))
                            * cos(radians(dl.longitude) - radians(:lng))
                            + sin(radians(:lat2)) * sin(radians(dl.latitude))
                        )
                    ) <= :radius
                ');

                $stmt->execute([
                    'type' => $type['code'],
                    'lat' => $lat,
                    'lng' => $lng,
                    'lat2' => $lat,
                    'radius' => $radiusKm,
                ]);

                $count = (int) $stmt->fetchColumn();

                if ($count > 0) {
                    $type['available_drivers'] = $count;
                    $available[] = $type;
                }
            } catch (\Exception $e) {
                continue;
            }
        }

        return $available;
    }

    /**
     * Obtenir l'ETA estimé par type de véhicule
     */
    public function getETAByType(float $lat, float $lng): array
    {
        $types = $this->getActive();
        $etas = [];

        // Vérifier si les tables nécessaires existent
        $hasDriverLocations = false;
        try {
            $check = $this->db->query("SHOW TABLES LIKE 'driver_locations'");
            $hasDriverLocations = $check->rowCount() > 0;
        } catch (\Exception $e) {
            // Ignorer
        }

        foreach ($types as $type) {
            if ($hasDriverLocations) {
                try {
                    // Trouver la conductrice la plus proche avec ce type
                    $stmt = $this->db->prepare('
                        SELECT
                            u.id,
                            (
                                6371 * acos(
                                    cos(radians(:lat)) * cos(radians(dl.latitude))
                                    * cos(radians(dl.longitude) - radians(:lng))
                                    + sin(radians(:lat2)) * sin(radians(dl.latitude))
                                )
                            ) as distance_km
                        FROM users u
                        JOIN vehicles v ON u.id = v.driver_id
                        JOIN driver_locations dl ON u.id = dl.driver_id
                        WHERE u.role = "driver"
                        AND u.is_online = 1
                        AND v.is_active = 1
                        AND v.vehicle_type = :type
                        AND dl.updated_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                        ORDER BY distance_km ASC
                        LIMIT 1
                    ');

                    $stmt->execute([
                        'type' => $type['code'],
                        'lat' => $lat,
                        'lng' => $lng,
                        'lat2' => $lat,
                    ]);

                    $nearest = $stmt->fetch(PDO::FETCH_ASSOC);

                    if ($nearest) {
                        // Estimer l'ETA (environ 2 min par km en ville)
                        $etaMinutes = max(2, (int) ceil($nearest['distance_km'] * 2));

                        $etas[] = [
                            'vehicle_type' => $type['code'],
                            'vehicle_name' => $type['name'],
                            'icon' => $type['icon'],
                            'eta_minutes' => $etaMinutes,
                            'eta_text' => $etaMinutes . ' min',
                            'available' => true,
                        ];
                        continue;
                    }
                } catch (\Exception $e) {
                    // Continuer avec "non disponible"
                }
            }

            // Pas de conductrice disponible ou erreur
            $etas[] = [
                'vehicle_type' => $type['code'],
                'vehicle_name' => $type['name'],
                'icon' => $type['icon'],
                'eta_minutes' => null,
                'eta_text' => __('vehicle.not_available'),
                'available' => false,
            ];
        }

        return $etas;
    }
}
