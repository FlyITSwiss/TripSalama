<?php

declare(strict_types=1);

namespace TripSalama\Models;

use PDO;

/**
 * Model Wallet - Gestion du portefeuille utilisateur
 */
class Wallet
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Obtenir ou créer le wallet d'un utilisateur
     */
    public function getOrCreate(int $userId, string $currency = 'MAD'): array
    {
        $wallet = $this->findByUserId($userId);

        if (!$wallet) {
            $this->create($userId, $currency);
            $wallet = $this->findByUserId($userId);
        }

        return $wallet;
    }

    /**
     * Trouver un wallet par ID utilisateur
     */
    public function findByUserId(int $userId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT w.*, u.first_name, u.last_name, u.email
            FROM wallets w
            JOIN users u ON w.user_id = u.id
            WHERE w.user_id = :user_id AND w.is_active = 1
        ');
        $stmt->execute(['user_id' => $userId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    /**
     * Trouver un wallet par ID
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('
            SELECT w.*, u.first_name, u.last_name, u.email
            FROM wallets w
            JOIN users u ON w.user_id = u.id
            WHERE w.id = :id AND w.is_active = 1
        ');
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    /**
     * Créer un nouveau wallet
     */
    public function create(int $userId, string $currency = 'MAD'): int
    {
        $stmt = $this->db->prepare('
            INSERT INTO wallets (user_id, balance, currency, is_active)
            VALUES (:user_id, 0.00, :currency, 1)
            ON DUPLICATE KEY UPDATE currency = :currency2
        ');
        $stmt->execute([
            'user_id' => $userId,
            'currency' => $currency,
            'currency2' => $currency,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Créditer le wallet (ajouter des fonds)
     */
    public function credit(int $userId, float $amount, string $description = ''): bool
    {
        if ($amount <= 0) {
            return false;
        }

        $wallet = $this->getOrCreate($userId);

        $stmt = $this->db->prepare('
            UPDATE wallets
            SET balance = balance + :amount, updated_at = NOW()
            WHERE user_id = :user_id AND is_active = 1
        ');

        return $stmt->execute([
            'amount' => $amount,
            'user_id' => $userId,
        ]);
    }

    /**
     * Débiter le wallet (retirer des fonds)
     */
    public function debit(int $userId, float $amount, string $description = ''): bool
    {
        if ($amount <= 0) {
            return false;
        }

        $wallet = $this->findByUserId($userId);

        if (!$wallet || (float) $wallet['balance'] < $amount) {
            return false;
        }

        $stmt = $this->db->prepare('
            UPDATE wallets
            SET balance = balance - :amount, updated_at = NOW()
            WHERE user_id = :user_id AND is_active = 1 AND balance >= :amount2
        ');

        return $stmt->execute([
            'amount' => $amount,
            'user_id' => $userId,
            'amount2' => $amount,
        ]);
    }

    /**
     * Vérifier si le solde est suffisant
     */
    public function hasSufficientBalance(int $userId, float $amount): bool
    {
        $wallet = $this->findByUserId($userId);

        if (!$wallet) {
            return false;
        }

        return (float) $wallet['balance'] >= $amount;
    }

    /**
     * Obtenir le solde
     */
    public function getBalance(int $userId): float
    {
        $wallet = $this->findByUserId($userId);

        return $wallet ? (float) $wallet['balance'] : 0.0;
    }

    /**
     * Transférer entre wallets (pour paiement course)
     */
    public function transfer(int $fromUserId, int $toUserId, float $amount): bool
    {
        $this->db->beginTransaction();

        try {
            // Débiter l'expéditeur
            if (!$this->debit($fromUserId, $amount)) {
                $this->db->rollBack();
                return false;
            }

            // Créditer le destinataire
            $this->credit($toUserId, $amount);

            $this->db->commit();
            return true;
        } catch (\Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }

    /**
     * Obtenir l'historique des mouvements
     */
    public function getTransactionHistory(int $userId, int $limit = 20, int $offset = 0): array
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
     * Obtenir les statistiques du wallet
     */
    public function getStats(int $userId): array
    {
        $wallet = $this->findByUserId($userId);

        // Total dépensé
        $stmt = $this->db->prepare('
            SELECT
                COALESCE(SUM(CASE WHEN type = "payment" AND status = "completed" THEN amount ELSE 0 END), 0) as total_spent,
                COALESCE(SUM(CASE WHEN type = "topup" AND status = "completed" THEN amount ELSE 0 END), 0) as total_topup,
                COALESCE(SUM(CASE WHEN type = "tip" AND status = "completed" THEN amount ELSE 0 END), 0) as total_tips,
                COALESCE(SUM(CASE WHEN type = "promo" AND status = "completed" THEN amount ELSE 0 END), 0) as total_promo,
                COUNT(CASE WHEN type = "payment" AND status = "completed" THEN 1 END) as payment_count
            FROM transactions
            WHERE user_id = :user_id
        ');
        $stmt->execute(['user_id' => $userId]);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);

        return [
            'balance' => $wallet ? (float) $wallet['balance'] : 0.0,
            'currency' => $wallet ? $wallet['currency'] : 'MAD',
            'total_spent' => (float) ($stats['total_spent'] ?? 0),
            'total_topup' => (float) ($stats['total_topup'] ?? 0),
            'total_tips' => (float) ($stats['total_tips'] ?? 0),
            'total_promo' => (float) ($stats['total_promo'] ?? 0),
            'payment_count' => (int) ($stats['payment_count'] ?? 0),
        ];
    }
}
