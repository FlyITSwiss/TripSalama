<?php

declare(strict_types=1);

namespace TripSalama\Models;

use PDO;

/**
 * Model Transaction - Gestion des transactions financières
 */
class Transaction
{
    private PDO $db;

    // Types de transactions
    public const TYPE_TOPUP = 'topup';
    public const TYPE_PAYMENT = 'payment';
    public const TYPE_REFUND = 'refund';
    public const TYPE_COMMISSION = 'commission';
    public const TYPE_TIP = 'tip';
    public const TYPE_PROMO = 'promo';
    public const TYPE_REFERRAL = 'referral';
    public const TYPE_WITHDRAWAL = 'withdrawal';

    // Statuts
    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_REFUNDED = 'refunded';

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Créer une nouvelle transaction
     */
    public function create(array $data): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO transactions (
                user_id, wallet_id, ride_id, type, amount, currency,
                status, payment_method_id, provider, provider_transaction_id,
                provider_charge_id, description, metadata
            ) VALUES (
                :user_id, :wallet_id, :ride_id, :type, :amount, :currency,
                :status, :payment_method_id, :provider, :provider_transaction_id,
                :provider_charge_id, :description, :metadata
            )
        ');

        $stmt->execute([
            'user_id' => $data['user_id'],
            'wallet_id' => $data['wallet_id'] ?? null,
            'ride_id' => $data['ride_id'] ?? null,
            'type' => $data['type'],
            'amount' => $data['amount'],
            'currency' => $data['currency'] ?? 'MAD',
            'status' => $data['status'] ?? self::STATUS_PENDING,
            'payment_method_id' => $data['payment_method_id'] ?? null,
            'provider' => $data['provider'] ?? null,
            'provider_transaction_id' => $data['provider_transaction_id'] ?? null,
            'provider_charge_id' => $data['provider_charge_id'] ?? null,
            'description' => $data['description'] ?? null,
            'metadata' => isset($data['metadata']) ? json_encode($data['metadata']) : null,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Trouver une transaction par ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('
            SELECT t.*, u.first_name, u.last_name, u.email,
                   r.pickup_address, r.dropoff_address
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN rides r ON t.ride_id = r.id
            WHERE t.id = :id
        ');
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    /**
     * Trouver une transaction par ID provider
     */
    public function findByProviderId(string $providerTransactionId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT * FROM transactions
            WHERE provider_transaction_id = :provider_id
        ');
        $stmt->execute(['provider_id' => $providerTransactionId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    /**
     * Mettre à jour le statut d'une transaction
     */
    public function updateStatus(int $id, string $status, ?string $errorMessage = null): bool
    {
        $stmt = $this->db->prepare('
            UPDATE transactions
            SET status = :status,
                error_message = :error_message,
                processed_at = CASE WHEN :status2 IN ("completed", "failed") THEN NOW() ELSE processed_at END,
                updated_at = NOW()
            WHERE id = :id
        ');

        return $stmt->execute([
            'id' => $id,
            'status' => $status,
            'status2' => $status,
            'error_message' => $errorMessage,
        ]);
    }

    /**
     * Obtenir les transactions d'un utilisateur
     */
    public function getByUser(int $userId, int $limit = 20, int $offset = 0): array
    {
        $stmt = $this->db->prepare('
            SELECT t.*, r.pickup_address, r.dropoff_address
            FROM transactions t
            LEFT JOIN rides r ON t.ride_id = r.id
            WHERE t.user_id = :user_id
            ORDER BY t.created_at DESC
            LIMIT :limit OFFSET :offset
        ');
        $stmt->bindValue('user_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtenir les transactions d'une course
     */
    public function getByRide(int $rideId): array
    {
        $stmt = $this->db->prepare('
            SELECT t.*, u.first_name, u.last_name
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            WHERE t.ride_id = :ride_id
            ORDER BY t.created_at ASC
        ');
        $stmt->execute(['ride_id' => $rideId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Créer une transaction de paiement pour une course
     */
    public function createRidePayment(
        int $userId,
        int $rideId,
        float $amount,
        string $provider,
        ?int $paymentMethodId = null
    ): int {
        return $this->create([
            'user_id' => $userId,
            'ride_id' => $rideId,
            'type' => self::TYPE_PAYMENT,
            'amount' => $amount,
            'provider' => $provider,
            'payment_method_id' => $paymentMethodId,
            'description' => 'Paiement course #' . $rideId,
        ]);
    }

    /**
     * Créer une transaction de recharge wallet
     */
    public function createTopup(
        int $userId,
        int $walletId,
        float $amount,
        string $provider,
        ?string $providerTransactionId = null
    ): int {
        return $this->create([
            'user_id' => $userId,
            'wallet_id' => $walletId,
            'type' => self::TYPE_TOPUP,
            'amount' => $amount,
            'provider' => $provider,
            'provider_transaction_id' => $providerTransactionId,
            'description' => 'Recharge portefeuille',
        ]);
    }

    /**
     * Créer une transaction de pourboire
     */
    public function createTip(int $userId, int $rideId, float $amount): int
    {
        return $this->create([
            'user_id' => $userId,
            'ride_id' => $rideId,
            'type' => self::TYPE_TIP,
            'amount' => $amount,
            'provider' => 'wallet',
            'description' => 'Pourboire course #' . $rideId,
        ]);
    }

    /**
     * Créer une transaction de commission
     */
    public function createCommission(int $driverId, int $rideId, float $amount): int
    {
        return $this->create([
            'user_id' => $driverId,
            'ride_id' => $rideId,
            'type' => self::TYPE_COMMISSION,
            'amount' => -$amount, // Négatif car c'est une déduction
            'provider' => 'platform',
            'description' => 'Commission TripSalama course #' . $rideId,
        ]);
    }

    /**
     * Créer une transaction de remboursement
     */
    public function createRefund(int $userId, int $rideId, float $amount, string $reason = ''): int
    {
        return $this->create([
            'user_id' => $userId,
            'ride_id' => $rideId,
            'type' => self::TYPE_REFUND,
            'amount' => $amount,
            'provider' => 'platform',
            'description' => 'Remboursement: ' . $reason,
        ]);
    }

    /**
     * Créer une transaction promo/réduction
     */
    public function createPromoDiscount(int $userId, int $rideId, float $amount, string $promoCode): int
    {
        return $this->create([
            'user_id' => $userId,
            'ride_id' => $rideId,
            'type' => self::TYPE_PROMO,
            'amount' => $amount,
            'provider' => 'promo',
            'description' => 'Réduction code promo: ' . $promoCode,
            'metadata' => ['promo_code' => $promoCode],
        ]);
    }

    /**
     * Créer une transaction de parrainage
     */
    public function createReferralBonus(int $userId, float $amount, int $referredUserId): int
    {
        return $this->create([
            'user_id' => $userId,
            'type' => self::TYPE_REFERRAL,
            'amount' => $amount,
            'provider' => 'referral',
            'description' => 'Bonus parrainage',
            'metadata' => ['referred_user_id' => $referredUserId],
        ]);
    }

    /**
     * Obtenir les statistiques de transactions
     */
    public function getStats(?int $userId = null, string $period = 'month'): array
    {
        $dateCondition = match ($period) {
            'day' => 'DATE(created_at) = CURDATE()',
            'week' => 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
            'month' => 'created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
            'year' => 'created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)',
            default => '1=1',
        };

        $userCondition = $userId ? 'AND user_id = :user_id' : '';

        $sql = "
            SELECT
                type,
                status,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM transactions
            WHERE {$dateCondition} {$userCondition}
            GROUP BY type, status
        ";

        $stmt = $this->db->prepare($sql);
        if ($userId) {
            $stmt->bindValue('user_id', $userId, PDO::PARAM_INT);
        }
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtenir le total des revenus conductrice
     */
    public function getDriverEarnings(int $driverId, string $period = 'month'): array
    {
        $dateCondition = match ($period) {
            'day' => 'DATE(t.created_at) = CURDATE()',
            'week' => 't.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
            'month' => 't.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
            default => '1=1',
        };

        $stmt = $this->db->prepare("
            SELECT
                COUNT(DISTINCT r.id) as ride_count,
                COALESCE(SUM(r.driver_earnings), 0) as total_earnings,
                COALESCE(SUM(r.tip_amount), 0) as total_tips,
                COALESCE(SUM(r.commission_amount), 0) as total_commission
            FROM rides r
            LEFT JOIN transactions t ON t.ride_id = r.id AND t.type = 'payment'
            WHERE r.driver_id = :driver_id
            AND r.status = 'completed'
            AND {$dateCondition}
        ");
        $stmt->execute(['driver_id' => $driverId]);

        return $stmt->fetch(PDO::FETCH_ASSOC) ?: [
            'ride_count' => 0,
            'total_earnings' => 0,
            'total_tips' => 0,
            'total_commission' => 0,
        ];
    }
}
