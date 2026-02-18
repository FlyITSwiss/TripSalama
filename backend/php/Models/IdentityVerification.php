<?php

declare(strict_types=1);

namespace TripSalama\Models;

use PDO;

/**
 * Model IdentityVerification
 * Gestion des vérifications d'identité par caméra
 */
class IdentityVerification
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Créer une nouvelle vérification
     */
    public function create(int $userId, string $photoPath, ?float $confidence, ?string $aiResult): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO identity_verifications
            (user_id, photo_path, ai_confidence, ai_result, status)
            VALUES (:user_id, :photo_path, :ai_confidence, :ai_result, :status)
        ');

        // Déterminer le status basé sur la confiance IA
        $status = 'pending';
        if ($confidence !== null && $aiResult === 'female' && $confidence >= 0.85) {
            $status = 'approved';
        }

        $stmt->execute([
            'user_id' => $userId,
            'photo_path' => $photoPath,
            'ai_confidence' => $confidence,
            'ai_result' => $aiResult,
            'status' => $status,
        ]);

        return (int)$this->db->lastInsertId();
    }

    /**
     * Trouver les vérifications d'un utilisateur
     */
    public function findByUserId(int $userId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT iv.*,
                   u.first_name, u.last_name, u.email,
                   admin.first_name as reviewer_first_name,
                   admin.last_name as reviewer_last_name
            FROM identity_verifications iv
            INNER JOIN users u ON iv.user_id = u.id
            LEFT JOIN users admin ON iv.manual_review_by = admin.id
            WHERE iv.user_id = :user_id
            ORDER BY iv.created_at DESC
            LIMIT 1
        ');
        $stmt->execute(['user_id' => $userId]);
        $result = $stmt->fetch();

        return $result ?: null;
    }

    /**
     * Trouver une vérification par ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('
            SELECT iv.*,
                   u.first_name, u.last_name, u.email,
                   admin.first_name as reviewer_first_name,
                   admin.last_name as reviewer_last_name
            FROM identity_verifications iv
            INNER JOIN users u ON iv.user_id = u.id
            LEFT JOIN users admin ON iv.manual_review_by = admin.id
            WHERE iv.id = :id
        ');
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch();

        return $result ?: null;
    }

    /**
     * Mettre à jour le statut d'une vérification
     */
    public function updateStatus(int $id, string $status, ?string $reason = null): bool
    {
        $stmt = $this->db->prepare('
            UPDATE identity_verifications
            SET status = :status, rejection_reason = :reason
            WHERE id = :id
        ');

        return $stmt->execute([
            'id' => $id,
            'status' => $status,
            'reason' => $reason,
        ]);
    }

    /**
     * Obtenir les vérifications en attente de revue manuelle
     */
    public function getPendingManualReviews(): array
    {
        $stmt = $this->db->query('
            SELECT iv.*,
                   u.first_name, u.last_name, u.email, u.role
            FROM identity_verifications iv
            INNER JOIN users u ON iv.user_id = u.id
            WHERE iv.status = "pending"
            ORDER BY iv.created_at ASC
        ');

        return $stmt->fetchAll();
    }

    /**
     * Approuver une vérification (par admin)
     */
    public function approveByAdmin(int $id, int $adminId): bool
    {
        $stmt = $this->db->prepare('
            UPDATE identity_verifications
            SET status = "approved",
                manual_review_by = :admin_id,
                manual_review_at = NOW()
            WHERE id = :id
        ');

        return $stmt->execute([
            'id' => $id,
            'admin_id' => $adminId,
        ]);
    }

    /**
     * Rejeter une vérification (par admin)
     */
    public function rejectByAdmin(int $id, int $adminId, string $reason): bool
    {
        $stmt = $this->db->prepare('
            UPDATE identity_verifications
            SET status = "rejected",
                manual_review_by = :admin_id,
                manual_review_at = NOW(),
                rejection_reason = :reason
            WHERE id = :id
        ');

        return $stmt->execute([
            'id' => $id,
            'admin_id' => $adminId,
            'reason' => $reason,
        ]);
    }

    /**
     * Obtenir les statistiques des vérifications
     */
    public function getStats(): array
    {
        $stmt = $this->db->query('
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN status = "pending" THEN 1 END) as pending,
                COUNT(CASE WHEN status = "approved" THEN 1 END) as approved,
                COUNT(CASE WHEN status = "rejected" THEN 1 END) as rejected,
                AVG(CASE WHEN ai_confidence IS NOT NULL THEN ai_confidence END) as avg_confidence
            FROM identity_verifications
        ');

        return $stmt->fetch() ?: [
            'total' => 0,
            'pending' => 0,
            'approved' => 0,
            'rejected' => 0,
            'avg_confidence' => null,
        ];
    }
}
