<?php

declare(strict_types=1);

namespace TripSalama\Models;

use PDO;

/**
 * Model Vehicle
 * Gestion des vehicules des conductrices
 */
class Vehicle
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Trouver un vehicule par ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM vehicles WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $vehicle = $stmt->fetch();

        return $vehicle ?: null;
    }

    /**
     * Trouver le vehicule d'une conductrice
     */
    public function findByDriver(int $driverId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT * FROM vehicles
            WHERE driver_id = :driver_id AND is_active = 1
            ORDER BY created_at DESC
            LIMIT 1
        ');
        $stmt->execute(['driver_id' => $driverId]);
        $vehicle = $stmt->fetch();

        return $vehicle ?: null;
    }

    /**
     * Creer un vehicule
     */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO vehicles (driver_id, brand, model, color, license_plate, year, is_active)
            VALUES (:driver_id, :brand, :model, :color, :license_plate, :year, 1)
        ');

        $stmt->execute([
            'driver_id' => $data['driver_id'],
            'brand' => $data['brand'],
            'model' => $data['model'],
            'color' => $data['color'],
            'license_plate' => $data['license_plate'],
            'year' => $data['year'] ?? null,
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Mettre a jour un vehicule
     */
    public function update(int $id, array $data): bool
    {
        $fields = [];
        $params = ['id' => $id];

        $allowedFields = ['brand', 'model', 'color', 'license_plate', 'year', 'is_active'];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "$field = :$field";
                $params[$field] = $data[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = 'UPDATE vehicles SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $stmt = $this->db->prepare($sql);

        return $stmt->execute($params);
    }
}
