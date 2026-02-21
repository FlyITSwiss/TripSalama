<?php

declare(strict_types=1);

namespace TripSalama\Models;

use PDO;

/**
 * Model DriverStatus
 * Gestion du statut de disponibilité des conductrices
 */
class DriverStatus
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Trouver le statut par ID conductrice
     */
    public function findByDriverId(int $driverId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM driver_status WHERE driver_id = :driver_id');
        $stmt->execute(['driver_id' => $driverId]);
        $status = $stmt->fetch();

        return $status ?: null;
    }

    /**
     * Obtenir le statut ou créer un statut par défaut
     */
    public function getOrCreate(int $driverId): array
    {
        $status = $this->findByDriverId($driverId);

        if ($status) {
            return $status;
        }

        // Créer un statut par défaut
        $this->create($driverId);

        return [
            'driver_id' => $driverId,
            'is_available' => false,
            'current_lat' => null,
            'current_lng' => null,
            'heading' => null,
            'speed' => null,
            'last_update' => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * Créer un statut par défaut
     */
    public function create(int $driverId, bool $isAvailable = false): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO driver_status (driver_id, is_available, current_lat, current_lng)
            VALUES (:driver_id, :is_available, NULL, NULL)
        ');

        $stmt->execute([
            'driver_id' => $driverId,
            'is_available' => $isAvailable ? 1 : 0,
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Mettre à jour le statut de disponibilité
     */
    public function updateAvailability(int $driverId, bool $isAvailable): bool
    {
        $stmt = $this->db->prepare('
            UPDATE driver_status
            SET is_available = :is_available, last_update = NOW()
            WHERE driver_id = :driver_id
        ');

        return $stmt->execute([
            'driver_id' => $driverId,
            'is_available' => $isAvailable ? 1 : 0,
        ]);
    }

    /**
     * Mettre à jour la position GPS
     */
    public function updatePosition(int $driverId, float $lat, float $lng, ?float $heading = null, ?float $speed = null): bool
    {
        $stmt = $this->db->prepare('
            UPDATE driver_status
            SET current_lat = :lat, current_lng = :lng, heading = :heading, speed = :speed, last_update = NOW()
            WHERE driver_id = :driver_id
        ');

        return $stmt->execute([
            'driver_id' => $driverId,
            'lat' => $lat,
            'lng' => $lng,
            'heading' => $heading,
            'speed' => $speed,
        ]);
    }

    /**
     * Obtenir les conductrices disponibles dans un rayon
     */
    public function getAvailableInRadius(float $lat, float $lng, float $radiusKm = 10): array
    {
        // Formule Haversine pour calculer la distance
        $stmt = $this->db->prepare('
            SELECT ds.*, u.first_name, u.last_name, u.phone, u.rating,
                   v.brand AS vehicle_brand, v.model AS vehicle_model, v.color AS vehicle_color, v.license_plate,
                   (6371 * ACOS(
                       COS(RADIANS(:lat)) * COS(RADIANS(ds.current_lat)) *
                       COS(RADIANS(ds.current_lng) - RADIANS(:lng)) +
                       SIN(RADIANS(:lat)) * SIN(RADIANS(ds.current_lat))
                   )) AS distance
            FROM driver_status ds
            INNER JOIN users u ON u.id = ds.driver_id
            LEFT JOIN vehicles v ON v.driver_id = ds.driver_id AND v.is_active = 1
            WHERE ds.is_available = 1
              AND ds.current_lat IS NOT NULL
              AND ds.current_lng IS NOT NULL
              AND ds.last_update > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            HAVING distance <= :radius
            ORDER BY distance ASC
            LIMIT 20
        ');

        $stmt->execute([
            'lat' => $lat,
            'lng' => $lng,
            'radius' => $radiusKm,
        ]);

        return $stmt->fetchAll();
    }

    /**
     * Obtenir le nombre de conductrices disponibles
     */
    public function countAvailable(): int
    {
        $stmt = $this->db->prepare('
            SELECT COUNT(*) FROM driver_status
            WHERE is_available = 1
              AND last_update > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        ');
        $stmt->execute();

        return (int)$stmt->fetchColumn();
    }

    /**
     * Désactiver les conductrices inactives (plus de 30 min sans mise à jour)
     */
    public function deactivateInactive(): int
    {
        $stmt = $this->db->prepare('
            UPDATE driver_status
            SET is_available = 0
            WHERE is_available = 1
              AND last_update < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
        ');
        $stmt->execute();

        return $stmt->rowCount();
    }
}
