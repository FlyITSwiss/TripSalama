<?php

declare(strict_types=1);

namespace TripSalama\Models;

use PDO;

/**
 * Model Ride
 * Gestion des courses
 */
class Ride
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Trouver une course par ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('
            SELECT r.*,
                   p.first_name as passenger_first_name,
                   p.last_name as passenger_last_name,
                   p.phone as passenger_phone,
                   p.avatar_path as passenger_avatar,
                   d.first_name as driver_first_name,
                   d.last_name as driver_last_name,
                   d.phone as driver_phone,
                   d.avatar_path as driver_avatar,
                   v.brand as vehicle_brand,
                   v.model as vehicle_model,
                   v.color as vehicle_color,
                   v.license_plate as vehicle_plate
            FROM rides r
            LEFT JOIN users p ON r.passenger_id = p.id
            LEFT JOIN users d ON r.driver_id = d.id
            LEFT JOIN vehicles v ON r.vehicle_id = v.id
            WHERE r.id = :id
        ');
        $stmt->execute(['id' => $id]);
        $ride = $stmt->fetch();

        return $ride ?: null;
    }

    /**
     * Creer une course
     */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO rides (
                passenger_id, status,
                pickup_address, pickup_lat, pickup_lng,
                dropoff_address, dropoff_lat, dropoff_lng,
                estimated_distance_km, estimated_duration_min, estimated_price,
                route_polyline
            ) VALUES (
                :passenger_id, "pending",
                :pickup_address, :pickup_lat, :pickup_lng,
                :dropoff_address, :dropoff_lat, :dropoff_lng,
                :estimated_distance_km, :estimated_duration_min, :estimated_price,
                :route_polyline
            )
        ');

        $stmt->execute([
            'passenger_id' => $data['passenger_id'],
            'pickup_address' => $data['pickup_address'],
            'pickup_lat' => $data['pickup_lat'],
            'pickup_lng' => $data['pickup_lng'],
            'dropoff_address' => $data['dropoff_address'],
            'dropoff_lat' => $data['dropoff_lat'],
            'dropoff_lng' => $data['dropoff_lng'],
            'estimated_distance_km' => $data['estimated_distance_km'] ?? null,
            'estimated_duration_min' => $data['estimated_duration_min'] ?? null,
            'estimated_price' => $data['estimated_price'] ?? null,
            'route_polyline' => $data['route_polyline'] ?? null,
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Mettre a jour le statut
     */
    public function updateStatus(int $id, string $status): bool
    {
        $timestampField = match ($status) {
            'accepted' => 'accepted_at',
            'in_progress' => 'started_at',
            'completed' => 'completed_at',
            'cancelled' => 'cancelled_at',
            default => null
        };

        $sql = "UPDATE rides SET status = :status";
        if ($timestampField) {
            $sql .= ", $timestampField = NOW()";
        }
        $sql .= " WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        return $stmt->execute(['id' => $id, 'status' => $status]);
    }

    /**
     * Assigner une conductrice
     */
    public function assignDriver(int $rideId, int $driverId, int $vehicleId): bool
    {
        $stmt = $this->db->prepare('
            UPDATE rides
            SET driver_id = :driver_id, vehicle_id = :vehicle_id, status = "accepted", accepted_at = NOW()
            WHERE id = :id
        ');
        return $stmt->execute([
            'id' => $rideId,
            'driver_id' => $driverId,
            'vehicle_id' => $vehicleId,
        ]);
    }

    /**
     * Obtenir les courses d'une passagere
     */
    public function getByPassenger(int $passengerId, ?string $status = null, int $limit = 50): array
    {
        $sql = 'SELECT r.*, d.first_name as driver_first_name, d.last_name as driver_last_name
                FROM rides r
                LEFT JOIN users d ON r.driver_id = d.id
                WHERE r.passenger_id = :passenger_id';

        if ($status) {
            $sql .= ' AND r.status = :status';
        }

        $sql .= ' ORDER BY r.created_at DESC LIMIT ' . $limit;

        $stmt = $this->db->prepare($sql);
        $params = ['passenger_id' => $passengerId];
        if ($status) {
            $params['status'] = $status;
        }
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    /**
     * Obtenir la course active d'une passagere
     */
    public function getActiveByPassenger(int $passengerId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT r.*, d.first_name as driver_first_name, d.last_name as driver_last_name,
                   v.brand as vehicle_brand, v.model as vehicle_model, v.color as vehicle_color, v.license_plate as vehicle_plate
            FROM rides r
            LEFT JOIN users d ON r.driver_id = d.id
            LEFT JOIN vehicles v ON r.vehicle_id = v.id
            WHERE r.passenger_id = :passenger_id
              AND r.status IN ("pending", "accepted", "driver_arriving", "in_progress")
            ORDER BY r.created_at DESC
            LIMIT 1
        ');
        $stmt->execute(['passenger_id' => $passengerId]);
        $ride = $stmt->fetch();

        return $ride ?: null;
    }

    /**
     * Compter les courses d'une passagere
     */
    public function countByPassenger(int $passengerId, ?string $period = null): int
    {
        $sql = 'SELECT COUNT(*) FROM rides WHERE passenger_id = :passenger_id';

        if ($period === 'month') {
            $sql .= ' AND created_at >= DATE_FORMAT(NOW(), "%Y-%m-01")';
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['passenger_id' => $passengerId]);

        return (int)$stmt->fetchColumn();
    }

    /**
     * Obtenir les courses récentes (terminées) d'une passagère
     * Pour afficher dans "Destinations récentes"
     */
    public function getRecentByPassenger(int $passengerId, int $limit = 3): array
    {
        $stmt = $this->db->prepare('
            SELECT r.dropoff_address, r.dropoff_lat, r.dropoff_lng, r.created_at
            FROM rides r
            WHERE r.passenger_id = :passenger_id
              AND r.status = "completed"
            ORDER BY r.created_at DESC
            LIMIT ' . $limit
        );
        $stmt->execute(['passenger_id' => $passengerId]);

        return $stmt->fetchAll();
    }

    /**
     * Obtenir les courses en attente (pour conductrices)
     */
    public function getPending(float $lat, float $lng, float $radiusKm = 10): array
    {
        // Simplification: retourne toutes les courses en attente
        // En production, filtrer par distance
        $stmt = $this->db->prepare('
            SELECT r.*, p.first_name as passenger_first_name, p.last_name as passenger_last_name
            FROM rides r
            JOIN users p ON r.passenger_id = p.id
            WHERE r.status = "pending"
            ORDER BY r.created_at ASC
            LIMIT 20
        ');
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Obtenir les courses d'une conductrice
     */
    public function getByDriver(int $driverId, ?string $status = null, int $limit = 50): array
    {
        $sql = 'SELECT r.*, p.first_name as passenger_first_name, p.last_name as passenger_last_name
                FROM rides r
                JOIN users p ON r.passenger_id = p.id
                WHERE r.driver_id = :driver_id';

        if ($status) {
            $sql .= ' AND r.status = :status';
        }

        $sql .= ' ORDER BY r.created_at DESC LIMIT ' . $limit;

        $stmt = $this->db->prepare($sql);
        $params = ['driver_id' => $driverId];
        if ($status) {
            $params['status'] = $status;
        }
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    /**
     * Obtenir la course active d'une conductrice
     */
    public function getActiveByDriver(int $driverId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT r.*, p.first_name as passenger_first_name, p.last_name as passenger_last_name,
                   p.phone as passenger_phone
            FROM rides r
            JOIN users p ON r.passenger_id = p.id
            WHERE r.driver_id = :driver_id
              AND r.status IN ("accepted", "driver_arriving", "in_progress")
            ORDER BY r.created_at DESC
            LIMIT 1
        ');
        $stmt->execute(['driver_id' => $driverId]);
        $ride = $stmt->fetch();

        return $ride ?: null;
    }

    /**
     * Compter les courses d'une conductrice
     */
    public function countByDriver(int $driverId, ?string $period = null): int
    {
        $sql = 'SELECT COUNT(*) FROM rides WHERE driver_id = :driver_id AND status = "completed"';

        if ($period === 'today') {
            $sql .= ' AND DATE(completed_at) = CURDATE()';
        } elseif ($period === 'week') {
            $sql .= ' AND completed_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)';
        } elseif ($period === 'month') {
            $sql .= ' AND completed_at >= DATE_FORMAT(NOW(), "%Y-%m-01")';
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['driver_id' => $driverId]);

        return (int)$stmt->fetchColumn();
    }

    /**
     * Calculer les gains d'une conductrice
     * Commission TripSalama : 12% (comme InDrive)
     */
    public function getEarningsByDriver(int $driverId, ?string $period = null): float
    {
        $sql = 'SELECT COALESCE(SUM(estimated_price * 0.88), 0) FROM rides WHERE driver_id = :driver_id AND status = "completed"';

        if ($period === 'today') {
            $sql .= ' AND DATE(completed_at) = CURDATE()';
        } elseif ($period === 'week') {
            $sql .= ' AND completed_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)';
        } elseif ($period === 'month') {
            $sql .= ' AND completed_at >= DATE_FORMAT(NOW(), "%Y-%m-01")';
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['driver_id' => $driverId]);

        return (float)$stmt->fetchColumn();
    }

    /**
     * Calculer la distance totale parcourue par une conductrice
     */
    public function getTotalDistanceByDriver(int $driverId, ?string $period = null): float
    {
        $sql = 'SELECT COALESCE(SUM(estimated_distance_km), 0) FROM rides WHERE driver_id = :driver_id AND status = "completed"';

        if ($period === 'today') {
            $sql .= ' AND DATE(completed_at) = CURDATE()';
        } elseif ($period === 'week') {
            $sql .= ' AND completed_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)';
        } elseif ($period === 'month') {
            $sql .= ' AND completed_at >= DATE_FORMAT(NOW(), "%Y-%m-01")';
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['driver_id' => $driverId]);

        return (float)$stmt->fetchColumn();
    }

    /**
     * Obtenir les statistiques complètes d'une conductrice
     */
    public function getDriverStats(int $driverId): array
    {
        return [
            'rides_today' => $this->countByDriver($driverId, 'today'),
            'rides_week' => $this->countByDriver($driverId, 'week'),
            'rides_month' => $this->countByDriver($driverId, 'month'),
            'rides_total' => $this->countByDriver($driverId),
            'earnings_today' => $this->getEarningsByDriver($driverId, 'today'),
            'earnings_week' => $this->getEarningsByDriver($driverId, 'week'),
            'earnings_month' => $this->getEarningsByDriver($driverId, 'month'),
            'distance_today' => $this->getTotalDistanceByDriver($driverId, 'today'),
            'distance_week' => $this->getTotalDistanceByDriver($driverId, 'week'),
            'distance_total' => $this->getTotalDistanceByDriver($driverId),
        ];
    }

    /**
     * Sauvegarder une position de course
     */
    public function savePosition(int $rideId, float $lat, float $lng, ?int $heading = null, ?float $speed = null): bool
    {
        $stmt = $this->db->prepare('
            INSERT INTO ride_positions (ride_id, lat, lng, heading, speed)
            VALUES (:ride_id, :lat, :lng, :heading, :speed)
        ');

        return $stmt->execute([
            'ride_id' => $rideId,
            'lat' => $lat,
            'lng' => $lng,
            'heading' => $heading,
            'speed' => $speed,
        ]);
    }

    /**
     * Obtenir la derniere position d'une course
     */
    public function getLastPosition(int $rideId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT * FROM ride_positions
            WHERE ride_id = :ride_id
            ORDER BY recorded_at DESC
            LIMIT 1
        ');
        $stmt->execute(['ride_id' => $rideId]);
        $position = $stmt->fetch();

        return $position ?: null;
    }

    // ========================================
    // PIN VERIFICATION METHODS
    // ========================================

    /**
     * Generer un code PIN pour verification de course
     */
    public function generatePin(int $rideId): array
    {
        $this->ensurePinTableExists();
        $pin = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        $pinHash = password_hash($pin, PASSWORD_BCRYPT);
        $expiresAt = date('Y-m-d H:i:s', strtotime('+10 minutes'));
        
        $stmt = $this->db->prepare('DELETE FROM ride_pins WHERE ride_id = :ride_id');
        $stmt->execute(['ride_id' => $rideId]);
        
        $stmt = $this->db->prepare('INSERT INTO ride_pins (ride_id, pin_hash, expires_at, created_at) VALUES (:ride_id, :pin_hash, :expires_at, NOW())');
        $stmt->execute(['ride_id' => $rideId, 'pin_hash' => $pinHash, 'expires_at' => $expiresAt]);
        
        return ['pin' => $pin, 'expires_at' => $expiresAt, 'expires_in' => 600];
    }

    /**
     * Valider un code PIN
     */
    public function validatePin(int $rideId, string $pin): array
    {
        $this->ensurePinTableExists();
        $stmt = $this->db->prepare('SELECT * FROM ride_pins WHERE ride_id = :ride_id LIMIT 1');
        $stmt->execute(['ride_id' => $rideId]);
        $pinRecord = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$pinRecord) { return ['valid' => false, 'error' => 'pin_not_found']; }
        if (strtotime($pinRecord['expires_at']) < time()) { return ['valid' => false, 'error' => 'pin_expired']; }
        if ($pinRecord['verified_at'] !== null) { return ['valid' => false, 'error' => 'pin_already_used']; }
        if ($pinRecord['attempts'] >= 3) { return ['valid' => false, 'error' => 'max_attempts', 'attempts_left' => 0]; }
        
        if (!password_verify($pin, $pinRecord['pin_hash'])) {
            $stmt = $this->db->prepare('UPDATE ride_pins SET attempts = attempts + 1 WHERE id = :id');
            $stmt->execute(['id' => $pinRecord['id']]);
            return ['valid' => false, 'error' => 'invalid_pin', 'attempts_left' => max(0, 2 - $pinRecord['attempts'])];
        }
        
        $stmt = $this->db->prepare('UPDATE ride_pins SET verified_at = NOW() WHERE id = :id');
        $stmt->execute(['id' => $pinRecord['id']]);
        return ['valid' => true];
    }

    /**
     * Obtenir le statut du PIN
     */
    public function getPinStatus(int $rideId): ?array
    {
        $this->ensurePinTableExists();
        $stmt = $this->db->prepare('SELECT * FROM ride_pins WHERE ride_id = :ride_id LIMIT 1');
        $stmt->execute(['ride_id' => $rideId]);
        $pin = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$pin) { return null; }
        return [
            'exists' => true,
            'verified' => $pin['verified_at'] !== null,
            'expired' => strtotime($pin['expires_at']) < time(),
            'attempts' => (int) $pin['attempts'],
            'attempts_left' => max(0, 3 - (int) $pin['attempts']),
            'sms_sent' => ($pin['sms_status'] ?? 'pending') === 'sent',
            'expires_at' => $pin['expires_at'],
        ];
    }

    /**
     * Marquer le SMS du PIN comme envoye
     */
    public function markPinSmsSent(int $rideId, string $status = 'sent'): bool
    {
        $stmt = $this->db->prepare('UPDATE ride_pins SET sms_sent_at = NOW(), sms_status = :status WHERE ride_id = :ride_id');
        return $stmt->execute(['ride_id' => $rideId, 'status' => $status]);
    }

    private function ensurePinTableExists(): void
    {
        $this->db->exec('CREATE TABLE IF NOT EXISTS ride_pins (
            id INT PRIMARY KEY AUTO_INCREMENT,
            ride_id INT NOT NULL,
            pin_hash VARCHAR(255) NOT NULL,
            attempts INT DEFAULT 0,
            expires_at DATETIME NOT NULL,
            verified_at DATETIME NULL,
            sms_sent_at DATETIME NULL,
            sms_status VARCHAR(20) DEFAULT "pending",
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_ride_pin (ride_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    }
}
