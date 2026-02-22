<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

/**
 * Service de conformité RGPD
 * Gestion de la rétention des données, export et suppression
 */
class GdprService
{
    private PDO $db;

    // Durées de rétention en jours
    private const RETENTION_RIDE_POSITIONS = 30;        // Positions GPS : 30 jours
    private const RETENTION_COMPLETED_RIDES = 365 * 3;  // Courses terminées : 3 ans (fiscal)
    private const RETENTION_RATE_LIMITS = 1;            // Rate limits : 1 jour
    private const RETENTION_INACTIVE_USERS = 365 * 2;   // Utilisateurs inactifs : 2 ans

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Exporter toutes les données d'un utilisateur (droit d'accès RGPD)
     *
     * @param int $userId ID de l'utilisateur
     * @return array Toutes les données de l'utilisateur
     */
    public function exportUserData(int $userId): array
    {
        $data = [
            'export_date' => date('Y-m-d H:i:s'),
            'user_id' => $userId,
        ];

        // Données utilisateur
        $stmt = $this->db->prepare('
            SELECT id, email, first_name, last_name, phone, role,
                   is_verified, created_at, updated_at, last_login_at
            FROM users WHERE id = :id
        ');
        $stmt->execute(['id' => $userId]);
        $data['user'] = $stmt->fetch(PDO::FETCH_ASSOC);

        // Courses (passagère)
        $stmt = $this->db->prepare('
            SELECT id, status, pickup_address, dropoff_address,
                   estimated_distance_km, estimated_duration_min, estimated_price,
                   created_at, completed_at
            FROM rides WHERE passenger_id = :id ORDER BY created_at DESC
        ');
        $stmt->execute(['id' => $userId]);
        $data['rides_as_passenger'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Courses (conductrice)
        $stmt = $this->db->prepare('
            SELECT id, status, pickup_address, dropoff_address,
                   estimated_distance_km, estimated_duration_min, estimated_price,
                   created_at, completed_at
            FROM rides WHERE driver_id = :id ORDER BY created_at DESC
        ');
        $stmt->execute(['id' => $userId]);
        $data['rides_as_driver'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Véhicules (conductrice)
        $stmt = $this->db->prepare('
            SELECT id, brand, model, color, license_plate, year, created_at
            FROM vehicles WHERE driver_id = :id
        ');
        $stmt->execute(['id' => $userId]);
        $data['vehicles'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Notes données
        $stmt = $this->db->prepare('
            SELECT r.id as ride_id, rt.passenger_rating, rt.passenger_comment, rt.passenger_rated_at
            FROM rides r
            LEFT JOIN ratings rt ON r.id = rt.ride_id
            WHERE r.passenger_id = :id AND rt.passenger_rating IS NOT NULL
        ');
        $stmt->execute(['id' => $userId]);
        $data['ratings_given'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Notes reçues
        $stmt = $this->db->prepare('
            SELECT r.id as ride_id, rt.driver_rating, rt.driver_comment, rt.driver_rated_at
            FROM rides r
            LEFT JOIN ratings rt ON r.id = rt.ride_id
            WHERE r.driver_id = :id AND rt.driver_rating IS NOT NULL
        ');
        $stmt->execute(['id' => $userId]);
        $data['ratings_received'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Messages
        $stmt = $this->db->prepare('
            SELECT id, ride_id, content, created_at
            FROM messages WHERE sender_id = :id ORDER BY created_at DESC
        ');
        $stmt->execute(['id' => $userId]);
        $data['messages'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return $data;
    }

    /**
     * Supprimer toutes les données d'un utilisateur (droit à l'oubli RGPD)
     *
     * @param int $userId ID de l'utilisateur
     * @return array Résumé de la suppression
     */
    public function deleteUserData(int $userId): array
    {
        $summary = [
            'user_id' => $userId,
            'deleted_at' => date('Y-m-d H:i:s'),
            'items_deleted' => [],
        ];

        $this->db->beginTransaction();

        try {
            // Anonymiser les courses (garder pour statistiques)
            $stmt = $this->db->prepare('
                UPDATE rides SET
                    pickup_address = "[SUPPRIMÉ]",
                    dropoff_address = "[SUPPRIMÉ]",
                    pickup_lat = 0,
                    pickup_lng = 0,
                    dropoff_lat = 0,
                    dropoff_lng = 0,
                    route_polyline = NULL
                WHERE passenger_id = :id OR driver_id = :id2
            ');
            $stmt->execute(['id' => $userId, 'id2' => $userId]);
            $summary['items_deleted']['rides_anonymized'] = $stmt->rowCount();

            // Supprimer les positions GPS
            $stmt = $this->db->prepare('
                DELETE rp FROM ride_positions rp
                INNER JOIN rides r ON rp.ride_id = r.id
                WHERE r.passenger_id = :id OR r.driver_id = :id2
            ');
            $stmt->execute(['id' => $userId, 'id2' => $userId]);
            $summary['items_deleted']['positions'] = $stmt->rowCount();

            // Supprimer les messages
            $stmt = $this->db->prepare('DELETE FROM messages WHERE sender_id = :id');
            $stmt->execute(['id' => $userId]);
            $summary['items_deleted']['messages'] = $stmt->rowCount();

            // Supprimer les véhicules
            $stmt = $this->db->prepare('DELETE FROM vehicles WHERE driver_id = :id');
            $stmt->execute(['id' => $userId]);
            $summary['items_deleted']['vehicles'] = $stmt->rowCount();

            // Supprimer le statut conductrice
            $stmt = $this->db->prepare('DELETE FROM driver_status WHERE driver_id = :id');
            $stmt->execute(['id' => $userId]);

            // Supprimer les vérifications d'identité
            $stmt = $this->db->prepare('DELETE FROM identity_verifications WHERE user_id = :id');
            $stmt->execute(['id' => $userId]);
            $summary['items_deleted']['verifications'] = $stmt->rowCount();

            // Anonymiser l'utilisateur (garder l'ID pour intégrité référentielle)
            $stmt = $this->db->prepare('
                UPDATE users SET
                    email = CONCAT("deleted_", id, "@deleted.local"),
                    first_name = "[SUPPRIMÉ]",
                    last_name = "[SUPPRIMÉ]",
                    phone = NULL,
                    password_hash = "",
                    avatar_path = NULL,
                    is_active = 0,
                    deleted_at = NOW()
                WHERE id = :id
            ');
            $stmt->execute(['id' => $userId]);
            $summary['items_deleted']['user_anonymized'] = 1;

            $this->db->commit();

        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }

        return $summary;
    }

    /**
     * Appliquer la politique de rétention des données
     * À exécuter quotidiennement via CRON
     *
     * @return array Résumé du nettoyage
     */
    public function applyRetentionPolicy(): array
    {
        $summary = [
            'executed_at' => date('Y-m-d H:i:s'),
            'deleted' => [],
        ];

        // 1. Supprimer les positions GPS > 30 jours
        $stmt = $this->db->prepare('
            DELETE FROM ride_positions
            WHERE recorded_at < DATE_SUB(NOW(), INTERVAL :days DAY)
        ');
        $stmt->execute(['days' => self::RETENTION_RIDE_POSITIONS]);
        $summary['deleted']['ride_positions'] = $stmt->rowCount();

        // 2. Supprimer les rate limits > 1 jour
        $stmt = $this->db->prepare('
            DELETE FROM rate_limits
            WHERE last_attempt_at < DATE_SUB(NOW(), INTERVAL :days DAY)
        ');
        $stmt->execute(['days' => self::RETENTION_RATE_LIMITS]);
        $summary['deleted']['rate_limits'] = $stmt->rowCount();

        // 3. Anonymiser les courses très anciennes (> 3 ans)
        $stmt = $this->db->prepare('
            UPDATE rides SET
                pickup_address = "[ARCHIVÉ]",
                dropoff_address = "[ARCHIVÉ]",
                route_polyline = NULL
            WHERE completed_at < DATE_SUB(NOW(), INTERVAL :days DAY)
            AND pickup_address != "[ARCHIVÉ]"
        ');
        $stmt->execute(['days' => self::RETENTION_COMPLETED_RIDES]);
        $summary['deleted']['rides_archived'] = $stmt->rowCount();

        return $summary;
    }

    /**
     * Obtenir les statistiques de rétention
     *
     * @return array Statistiques
     */
    public function getRetentionStats(): array
    {
        $stats = [];

        // Positions à supprimer
        $stmt = $this->db->prepare('
            SELECT COUNT(*) FROM ride_positions
            WHERE recorded_at < DATE_SUB(NOW(), INTERVAL :days DAY)
        ');
        $stmt->execute(['days' => self::RETENTION_RIDE_POSITIONS]);
        $stats['positions_to_delete'] = (int)$stmt->fetchColumn();

        // Courses à archiver
        $stmt = $this->db->prepare('
            SELECT COUNT(*) FROM rides
            WHERE completed_at < DATE_SUB(NOW(), INTERVAL :days DAY)
            AND pickup_address != "[ARCHIVÉ]"
        ');
        $stmt->execute(['days' => self::RETENTION_COMPLETED_RIDES]);
        $stats['rides_to_archive'] = (int)$stmt->fetchColumn();

        return $stats;
    }
}
