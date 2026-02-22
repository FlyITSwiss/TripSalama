<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

/**
 * Service Codes Promo
 * Gestion des codes promotionnels et réductions
 */
class PromoCodeService
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Valider et appliquer un code promo
     */
    public function validateAndApply(
        string $code,
        int $userId,
        float $rideAmount,
        ?int $rideId = null
    ): array {
        $promo = $this->findByCode($code);

        if (!$promo) {
            return ['valid' => false, 'error' => __('promo.invalid_code')];
        }

        // Vérifier si actif
        if (!$promo['is_active']) {
            return ['valid' => false, 'error' => __('promo.expired')];
        }

        // Vérifier les dates
        $now = new \DateTime();
        if ($promo['valid_from'] && new \DateTime($promo['valid_from']) > $now) {
            return ['valid' => false, 'error' => __('promo.not_yet_valid')];
        }
        if ($promo['valid_until'] && new \DateTime($promo['valid_until']) < $now) {
            return ['valid' => false, 'error' => __('promo.expired')];
        }

        // Vérifier le nombre max d'utilisations global
        if ($promo['max_uses'] && $promo['current_uses'] >= $promo['max_uses']) {
            return ['valid' => false, 'error' => __('promo.max_uses_reached')];
        }

        // Vérifier le nombre d'utilisations par l'utilisateur
        $userUses = $this->getUserUsageCount($promo['id'], $userId);
        if ($userUses >= $promo['max_uses_per_user']) {
            return ['valid' => false, 'error' => __('promo.already_used')];
        }

        // Vérifier le montant minimum
        if ($promo['min_ride_amount'] && $rideAmount < (float) $promo['min_ride_amount']) {
            return [
                'valid' => false,
                'error' => sprintf(__('promo.min_amount_required'), number_format((float) $promo['min_ride_amount'], 2)),
            ];
        }

        // Vérifier si première course uniquement
        if ($promo['is_first_ride_only']) {
            $stmt = $this->db->prepare('
                SELECT COUNT(*) FROM rides
                WHERE passenger_id = :user_id AND status = "completed"
            ');
            $stmt->execute(['user_id' => $userId]);
            if ($stmt->fetchColumn() > 0) {
                return ['valid' => false, 'error' => __('promo.first_ride_only')];
            }
        }

        // Calculer la réduction
        $discount = $this->calculateDiscount($promo, $rideAmount);

        // Enregistrer l'utilisation si rideId fourni
        if ($rideId) {
            $this->recordUsage($promo['id'], $userId, $rideId, $discount);
        }

        return [
            'valid' => true,
            'discount' => $discount,
            'discount_type' => $promo['discount_type'],
            'discount_value' => (float) $promo['discount_value'],
            'promo_id' => (int) $promo['id'],
            'description' => $promo['description'],
        ];
    }

    /**
     * Calculer le montant de la réduction
     */
    public function calculateDiscount(array $promo, float $amount): float
    {
        if ($promo['discount_type'] === 'percentage') {
            $discount = $amount * ((float) $promo['discount_value'] / 100);

            // Appliquer le plafond si défini
            if ($promo['max_discount'] && $discount > (float) $promo['max_discount']) {
                $discount = (float) $promo['max_discount'];
            }
        } else {
            // Réduction fixe
            $discount = (float) $promo['discount_value'];
        }

        // Ne pas dépasser le montant de la course
        return min($discount, $amount);
    }

    /**
     * Trouver un code promo par code
     */
    public function findByCode(string $code): ?array
    {
        $stmt = $this->db->prepare('
            SELECT * FROM promo_codes
            WHERE code = :code
        ');
        $stmt->execute(['code' => strtoupper(trim($code))]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    /**
     * Trouver un code promo par ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM promo_codes WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    /**
     * Créer un code promo
     */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO promo_codes (
                code, description, discount_type, discount_value,
                max_discount, min_ride_amount, currency, max_uses,
                max_uses_per_user, valid_from, valid_until,
                is_active, is_first_ride_only, created_by
            ) VALUES (
                :code, :description, :discount_type, :discount_value,
                :max_discount, :min_ride_amount, :currency, :max_uses,
                :max_uses_per_user, :valid_from, :valid_until,
                :is_active, :is_first_ride_only, :created_by
            )
        ');

        $stmt->execute([
            'code' => strtoupper(trim($data['code'])),
            'description' => $data['description'] ?? null,
            'discount_type' => $data['discount_type'] ?? 'percentage',
            'discount_value' => $data['discount_value'],
            'max_discount' => $data['max_discount'] ?? null,
            'min_ride_amount' => $data['min_ride_amount'] ?? null,
            'currency' => $data['currency'] ?? 'MAD',
            'max_uses' => $data['max_uses'] ?? null,
            'max_uses_per_user' => $data['max_uses_per_user'] ?? 1,
            'valid_from' => $data['valid_from'] ?? null,
            'valid_until' => $data['valid_until'] ?? null,
            'is_active' => ($data['is_active'] ?? true) ? 1 : 0,
            'is_first_ride_only' => ($data['is_first_ride_only'] ?? false) ? 1 : 0,
            'created_by' => $data['created_by'] ?? null,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Mettre à jour un code promo
     */
    public function update(int $id, array $data): bool
    {
        $fields = [];
        $params = ['id' => $id];

        $allowedFields = [
            'description', 'discount_type', 'discount_value', 'max_discount',
            'min_ride_amount', 'max_uses', 'max_uses_per_user',
            'valid_from', 'valid_until', 'is_active', 'is_first_ride_only',
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

        $sql = 'UPDATE promo_codes SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = :id';

        return $this->db->prepare($sql)->execute($params);
    }

    /**
     * Désactiver un code promo
     */
    public function deactivate(int $id): bool
    {
        $stmt = $this->db->prepare('UPDATE promo_codes SET is_active = 0 WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }

    /**
     * Lister les codes promo
     */
    public function getAll(bool $activeOnly = false): array
    {
        $sql = 'SELECT * FROM promo_codes';
        if ($activeOnly) {
            $sql .= ' WHERE is_active = 1 AND (valid_until IS NULL OR valid_until > NOW())';
        }
        $sql .= ' ORDER BY created_at DESC';

        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtenir les statistiques d'un code promo
     */
    public function getStats(int $promoId): array
    {
        $stmt = $this->db->prepare('
            SELECT
                COUNT(*) as total_uses,
                COUNT(DISTINCT user_id) as unique_users,
                SUM(discount_applied) as total_discount,
                AVG(discount_applied) as avg_discount
            FROM promo_code_uses
            WHERE promo_code_id = :promo_id
        ');
        $stmt->execute(['promo_id' => $promoId]);

        return $stmt->fetch(PDO::FETCH_ASSOC) ?: [
            'total_uses' => 0,
            'unique_users' => 0,
            'total_discount' => 0,
            'avg_discount' => 0,
        ];
    }

    /**
     * Enregistrer l'utilisation d'un code promo
     */
    private function recordUsage(int $promoId, int $userId, int $rideId, float $discount): void
    {
        // Enregistrer l'utilisation
        $stmt = $this->db->prepare('
            INSERT INTO promo_code_uses (promo_code_id, user_id, ride_id, discount_applied)
            VALUES (:promo_id, :user_id, :ride_id, :discount)
        ');
        $stmt->execute([
            'promo_id' => $promoId,
            'user_id' => $userId,
            'ride_id' => $rideId,
            'discount' => $discount,
        ]);

        // Incrémenter le compteur
        $stmt = $this->db->prepare('
            UPDATE promo_codes
            SET current_uses = current_uses + 1
            WHERE id = :id
        ');
        $stmt->execute(['id' => $promoId]);

        // Mettre à jour la course
        $stmt = $this->db->prepare('
            UPDATE rides
            SET promo_code_id = :promo_id, discount_amount = :discount
            WHERE id = :ride_id
        ');
        $stmt->execute([
            'promo_id' => $promoId,
            'discount' => $discount,
            'ride_id' => $rideId,
        ]);
    }

    /**
     * Obtenir le nombre d'utilisations par un utilisateur
     */
    private function getUserUsageCount(int $promoId, int $userId): int
    {
        $stmt = $this->db->prepare('
            SELECT COUNT(*) FROM promo_code_uses
            WHERE promo_code_id = :promo_id AND user_id = :user_id
        ');
        $stmt->execute(['promo_id' => $promoId, 'user_id' => $userId]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Générer un code promo unique
     */
    public function generateUniqueCode(int $length = 8): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $code = '';

        do {
            $code = '';
            for ($i = 0; $i < $length; $i++) {
                $code .= $chars[random_int(0, strlen($chars) - 1)];
            }
        } while ($this->findByCode($code));

        return $code;
    }
}
