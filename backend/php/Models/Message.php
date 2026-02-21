<?php

declare(strict_types=1);

namespace TripSalama\Models;

use PDO;

/**
 * Model Message
 * Gestion des messages de chat entre conductrice et passagère
 */
class Message
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Créer un nouveau message
     */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO ride_messages (ride_id, sender_id, content, message_type)
            VALUES (:ride_id, :sender_id, :content, :message_type)
        ');

        $stmt->execute([
            'ride_id' => $data['ride_id'],
            'sender_id' => $data['sender_id'],
            'content' => $data['content'],
            'message_type' => $data['message_type'] ?? 'text',
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Obtenir tous les messages d'une course
     */
    public function getByRide(int $rideId): array
    {
        $stmt = $this->db->prepare('
            SELECT
                m.*,
                u.first_name as sender_first_name,
                u.last_name as sender_last_name,
                u.role as sender_role
            FROM ride_messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.ride_id = :ride_id
            ORDER BY m.created_at ASC
        ');
        $stmt->execute(['ride_id' => $rideId]);

        return $stmt->fetchAll();
    }

    /**
     * Compter les messages non lus pour un utilisateur
     */
    public function getUnreadCount(int $rideId, int $userId): int
    {
        $stmt = $this->db->prepare('
            SELECT COUNT(*)
            FROM ride_messages
            WHERE ride_id = :ride_id
              AND sender_id != :user_id
              AND is_read = FALSE
        ');
        $stmt->execute([
            'ride_id' => $rideId,
            'user_id' => $userId,
        ]);

        return (int)$stmt->fetchColumn();
    }

    /**
     * Marquer tous les messages comme lus pour un utilisateur
     */
    public function markAsRead(int $rideId, int $userId): bool
    {
        $stmt = $this->db->prepare('
            UPDATE ride_messages
            SET is_read = TRUE
            WHERE ride_id = :ride_id
              AND sender_id != :user_id
              AND is_read = FALSE
        ');

        return $stmt->execute([
            'ride_id' => $rideId,
            'user_id' => $userId,
        ]);
    }

    /**
     * Obtenir le dernier message d'une course
     */
    public function getLastMessage(int $rideId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT
                m.*,
                u.first_name as sender_first_name
            FROM ride_messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.ride_id = :ride_id
            ORDER BY m.created_at DESC
            LIMIT 1
        ');
        $stmt->execute(['ride_id' => $rideId]);
        $message = $stmt->fetch();

        return $message ?: null;
    }

    /**
     * Vérifier si un utilisateur a accès à une course
     */
    public function userHasAccessToRide(int $rideId, int $userId): bool
    {
        $stmt = $this->db->prepare('
            SELECT COUNT(*)
            FROM rides
            WHERE id = :ride_id
              AND (passenger_id = :user_id_1 OR driver_id = :user_id_2)
        ');
        $stmt->execute([
            'ride_id' => $rideId,
            'user_id_1' => $userId,
            'user_id_2' => $userId,
        ]);

        return (int)$stmt->fetchColumn() > 0;
    }
}
