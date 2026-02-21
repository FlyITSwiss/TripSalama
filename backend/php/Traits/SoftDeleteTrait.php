<?php

declare(strict_types=1);

namespace TripSalama\Traits;

/**
 * Trait SoftDelete
 * Provides soft delete functionality for models
 *
 * Usage:
 * 1. Add 'deleted_at' TIMESTAMP NULL column to your table
 * 2. Use this trait in your model: use SoftDeleteTrait;
 * 3. Define protected string $table = 'your_table_name';
 */
trait SoftDeleteTrait
{
    /**
     * Soft delete a record
     */
    public function softDelete(int $id): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table}
            SET deleted_at = NOW()
            WHERE id = :id AND deleted_at IS NULL
        ");

        return $stmt->execute(['id' => $id]);
    }

    /**
     * Restore a soft deleted record
     */
    public function restore(int $id): bool
    {
        $stmt = $this->db->prepare("
            UPDATE {$this->table}
            SET deleted_at = NULL
            WHERE id = :id
        ");

        return $stmt->execute(['id' => $id]);
    }

    /**
     * Permanently delete a record
     */
    public function forceDelete(int $id): bool
    {
        $stmt = $this->db->prepare("
            DELETE FROM {$this->table}
            WHERE id = :id
        ");

        return $stmt->execute(['id' => $id]);
    }

    /**
     * Get only non-deleted records
     */
    public function findAllActive(): array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE deleted_at IS NULL
            ORDER BY id DESC
        ");
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Get only soft deleted records
     */
    public function findAllTrashed(): array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE deleted_at IS NOT NULL
            ORDER BY deleted_at DESC
        ");
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Get a record including soft deleted
     */
    public function findByIdWithTrashed(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM {$this->table}
            WHERE id = :id
        ");
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch();

        return $result ?: null;
    }

    /**
     * Check if a record is soft deleted
     */
    public function isTrashed(int $id): bool
    {
        $stmt = $this->db->prepare("
            SELECT deleted_at FROM {$this->table}
            WHERE id = :id
        ");
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch();

        return $result && $result['deleted_at'] !== null;
    }

    /**
     * Count active records
     */
    public function countActive(): int
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM {$this->table}
            WHERE deleted_at IS NULL
        ");
        $stmt->execute();

        return (int)$stmt->fetchColumn();
    }

    /**
     * Count soft deleted records
     */
    public function countTrashed(): int
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM {$this->table}
            WHERE deleted_at IS NOT NULL
        ");
        $stmt->execute();

        return (int)$stmt->fetchColumn();
    }

    /**
     * Permanently delete all soft deleted records older than X days
     */
    public function purgeOlderThan(int $days = 30): int
    {
        $stmt = $this->db->prepare("
            DELETE FROM {$this->table}
            WHERE deleted_at IS NOT NULL
              AND deleted_at < DATE_SUB(NOW(), INTERVAL :days DAY)
        ");
        $stmt->execute(['days' => $days]);

        return $stmt->rowCount();
    }
}
