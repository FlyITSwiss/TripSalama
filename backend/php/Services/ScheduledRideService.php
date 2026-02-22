<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

/**
 * Service Courses Programmées
 * Gestion des réservations à l'avance
 */
class ScheduledRideService
{
    private PDO $db;

    // Limites
    private int $minAdvanceMinutes = 30;      // Minimum 30 min à l'avance
    private int $maxAdvanceDays = 7;          // Maximum 7 jours à l'avance
    private int $reminderMinutes = 15;        // Rappel 15 min avant

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Créer une course programmée
     */
    public function schedule(int $passengerId, array $data): int
    {
        // Validation de la date
        $scheduledAt = new \DateTime($data['scheduled_at']);
        $now = new \DateTime();
        $minTime = (clone $now)->modify("+{$this->minAdvanceMinutes} minutes");
        $maxTime = (clone $now)->modify("+{$this->maxAdvanceDays} days");

        if ($scheduledAt < $minTime) {
            throw new \Exception(sprintf(__('scheduled.too_soon'), $this->minAdvanceMinutes));
        }

        if ($scheduledAt > $maxTime) {
            throw new \Exception(sprintf(__('scheduled.too_far'), $this->maxAdvanceDays));
        }

        // Vérifier le nombre de courses programmées actives (max 3)
        $stmt = $this->db->prepare('
            SELECT COUNT(*) FROM scheduled_rides
            WHERE passenger_id = :passenger_id
            AND status IN ("scheduled", "searching", "assigned")
        ');
        $stmt->execute(['passenger_id' => $passengerId]);

        if ($stmt->fetchColumn() >= 3) {
            throw new \Exception(__('scheduled.max_active_reached'));
        }

        // Créer la course programmée
        $stmt = $this->db->prepare('
            INSERT INTO scheduled_rides (
                passenger_id, pickup_address, pickup_lat, pickup_lng,
                dropoff_address, dropoff_lat, dropoff_lng,
                scheduled_at, vehicle_type, estimated_price, payment_method, notes
            ) VALUES (
                :passenger_id, :pickup_address, :pickup_lat, :pickup_lng,
                :dropoff_address, :dropoff_lat, :dropoff_lng,
                :scheduled_at, :vehicle_type, :estimated_price, :payment_method, :notes
            )
        ');

        $stmt->execute([
            'passenger_id' => $passengerId,
            'pickup_address' => $data['pickup_address'],
            'pickup_lat' => $data['pickup_lat'],
            'pickup_lng' => $data['pickup_lng'],
            'dropoff_address' => $data['dropoff_address'],
            'dropoff_lat' => $data['dropoff_lat'],
            'dropoff_lng' => $data['dropoff_lng'],
            'scheduled_at' => $scheduledAt->format('Y-m-d H:i:s'),
            'vehicle_type' => $data['vehicle_type'] ?? 'standard',
            'estimated_price' => $data['estimated_price'] ?? null,
            'payment_method' => $data['payment_method'] ?? 'cash',
            'notes' => $data['notes'] ?? null,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Annuler une course programmée
     */
    public function cancel(int $scheduleId, int $userId): bool
    {
        $stmt = $this->db->prepare('
            UPDATE scheduled_rides
            SET status = "cancelled", updated_at = NOW()
            WHERE id = :id AND passenger_id = :user_id AND status IN ("scheduled", "searching")
        ');

        $result = $stmt->execute([
            'id' => $scheduleId,
            'user_id' => $userId,
        ]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Obtenir les courses programmées d'un utilisateur
     */
    public function getByUser(int $userId, bool $includeCompleted = false): array
    {
        $sql = '
            SELECT sr.*, u.first_name as driver_first_name, u.last_name as driver_last_name,
                   v.brand, v.model, v.color, v.license_plate
            FROM scheduled_rides sr
            LEFT JOIN users u ON sr.driver_id = u.id
            LEFT JOIN vehicles v ON sr.driver_id = v.driver_id AND v.is_active = 1
            WHERE sr.passenger_id = :user_id
        ';

        if (!$includeCompleted) {
            $sql .= ' AND sr.status NOT IN ("completed", "cancelled")';
        }

        $sql .= ' ORDER BY sr.scheduled_at ASC';

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtenir une course programmée par ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('
            SELECT sr.*, u.first_name as passenger_first_name, u.last_name as passenger_last_name,
                   u.phone as passenger_phone
            FROM scheduled_rides sr
            JOIN users u ON sr.passenger_id = u.id
            WHERE sr.id = :id
        ');
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    /**
     * Obtenir les courses à démarrer bientôt
     * (Pour le worker qui les convertit en courses réelles)
     */
    public function getUpcoming(int $minutesAhead = 20): array
    {
        $stmt = $this->db->prepare('
            SELECT * FROM scheduled_rides
            WHERE status = "scheduled"
            AND scheduled_at <= DATE_ADD(NOW(), INTERVAL :minutes MINUTE)
            AND scheduled_at > NOW()
            ORDER BY scheduled_at ASC
        ');
        $stmt->execute(['minutes' => $minutesAhead]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Convertir une course programmée en course réelle
     */
    public function convertToRide(int $scheduleId): ?int
    {
        $scheduled = $this->findById($scheduleId);

        if (!$scheduled || $scheduled['status'] !== 'scheduled') {
            return null;
        }

        $this->db->beginTransaction();

        try {
            // Créer la course
            require_once BACKEND_PATH . '/Models/Ride.php';
            $rideModel = new \TripSalama\Models\Ride($this->db);

            $rideId = $rideModel->create([
                'passenger_id' => (int) $scheduled['passenger_id'],
                'pickup_address' => $scheduled['pickup_address'],
                'pickup_lat' => (float) $scheduled['pickup_lat'],
                'pickup_lng' => (float) $scheduled['pickup_lng'],
                'dropoff_address' => $scheduled['dropoff_address'],
                'dropoff_lat' => (float) $scheduled['dropoff_lat'],
                'dropoff_lng' => (float) $scheduled['dropoff_lng'],
                'estimated_price' => $scheduled['estimated_price'],
            ]);

            // Mettre à jour la course programmée
            $stmt = $this->db->prepare('
                UPDATE scheduled_rides
                SET status = "searching", ride_id = :ride_id, updated_at = NOW()
                WHERE id = :id
            ');
            $stmt->execute(['id' => $scheduleId, 'ride_id' => $rideId]);

            $this->db->commit();

            return $rideId;
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Assigner une conductrice à une course programmée
     */
    public function assignDriver(int $scheduleId, int $driverId): bool
    {
        $stmt = $this->db->prepare('
            UPDATE scheduled_rides
            SET status = "assigned", driver_id = :driver_id, updated_at = NOW()
            WHERE id = :id AND status IN ("scheduled", "searching")
        ');

        return $stmt->execute([
            'id' => $scheduleId,
            'driver_id' => $driverId,
        ]);
    }

    /**
     * Obtenir les courses programmées pour une conductrice
     */
    public function getForDriver(int $driverId): array
    {
        $stmt = $this->db->prepare('
            SELECT sr.*, u.first_name as passenger_first_name, u.phone as passenger_phone
            FROM scheduled_rides sr
            JOIN users u ON sr.passenger_id = u.id
            WHERE sr.driver_id = :driver_id
            AND sr.status = "assigned"
            AND sr.scheduled_at > NOW()
            ORDER BY sr.scheduled_at ASC
        ');
        $stmt->execute(['driver_id' => $driverId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Envoyer les rappels pour les courses à venir
     */
    public function sendReminders(): array
    {
        $stmt = $this->db->prepare('
            SELECT sr.*, u.first_name, u.email
            FROM scheduled_rides sr
            JOIN users u ON sr.passenger_id = u.id
            WHERE sr.status IN ("scheduled", "assigned")
            AND sr.reminder_sent = 0
            AND sr.scheduled_at <= DATE_ADD(NOW(), INTERVAL :minutes MINUTE)
            AND sr.scheduled_at > NOW()
        ');
        $stmt->execute(['minutes' => $this->reminderMinutes]);
        $rides = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $sent = [];

        foreach ($rides as $ride) {
            // Marquer comme envoyé
            $this->db->prepare('UPDATE scheduled_rides SET reminder_sent = 1 WHERE id = :id')
                ->execute(['id' => $ride['id']]);

            // TODO: Envoyer notification push
            $sent[] = $ride['id'];
        }

        return $sent;
    }

    /**
     * Mettre à jour une course programmée
     */
    public function update(int $scheduleId, int $userId, array $data): bool
    {
        $scheduled = $this->findById($scheduleId);

        if (!$scheduled || (int) $scheduled['passenger_id'] !== $userId) {
            return false;
        }

        if (!in_array($scheduled['status'], ['scheduled'], true)) {
            throw new \Exception(__('scheduled.cannot_modify'));
        }

        $fields = [];
        $params = ['id' => $scheduleId];

        $allowedFields = ['pickup_address', 'pickup_lat', 'pickup_lng',
            'dropoff_address', 'dropoff_lat', 'dropoff_lng',
            'scheduled_at', 'vehicle_type', 'payment_method', 'notes'];

        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $data[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        // Revalider la date si modifiée
        if (isset($data['scheduled_at'])) {
            $scheduledAt = new \DateTime($data['scheduled_at']);
            $now = new \DateTime();
            $minTime = (clone $now)->modify("+{$this->minAdvanceMinutes} minutes");

            if ($scheduledAt < $minTime) {
                throw new \Exception(sprintf(__('scheduled.too_soon'), $this->minAdvanceMinutes));
            }
        }

        $sql = 'UPDATE scheduled_rides SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = :id';

        return $this->db->prepare($sql)->execute($params);
    }
}
