<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;
use TripSalama\Models\Wallet;

/**
 * Service de Parrainage
 * Gestion du système de parrainage et bonus
 */
class ReferralService
{
    private PDO $db;
    private Wallet $walletModel;

    // Bonus par défaut
    private float $referrerBonus = 20.0;  // Bonus pour le parrain (MAD)
    private float $referredBonus = 15.0;  // Bonus pour le filleul (MAD)

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->walletModel = new Wallet($db);
    }

    /**
     * Générer un code de parrainage unique pour un utilisateur
     */
    public function generateReferralCode(int $userId): string
    {
        // Vérifier si l'utilisateur a déjà un code
        $stmt = $this->db->prepare('SELECT referral_code FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && !empty($user['referral_code'])) {
            return $user['referral_code'];
        }

        // Générer un nouveau code
        $code = $this->createUniqueCode($userId);

        // Sauvegarder
        $stmt = $this->db->prepare('UPDATE users SET referral_code = :code WHERE id = :id');
        $stmt->execute(['code' => $code, 'id' => $userId]);

        return $code;
    }

    /**
     * Appliquer un code de parrainage lors de l'inscription
     */
    public function applyReferralCode(int $newUserId, string $code): array
    {
        // Trouver le parrain
        $stmt = $this->db->prepare('SELECT id, first_name FROM users WHERE referral_code = :code AND id != :new_user_id');
        $stmt->execute(['code' => strtoupper(trim($code)), 'new_user_id' => $newUserId]);
        $referrer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$referrer) {
            return ['success' => false, 'error' => __('referral.invalid_code')];
        }

        // Vérifier que le nouvel utilisateur n'a pas déjà été parrainé
        $stmt = $this->db->prepare('SELECT referred_by FROM users WHERE id = :id');
        $stmt->execute(['id' => $newUserId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && $user['referred_by']) {
            return ['success' => false, 'error' => __('referral.already_referred')];
        }

        $this->db->beginTransaction();

        try {
            // Mettre à jour le nouvel utilisateur
            $stmt = $this->db->prepare('UPDATE users SET referred_by = :referrer_id WHERE id = :id');
            $stmt->execute(['referrer_id' => $referrer['id'], 'id' => $newUserId]);

            // Créer l'enregistrement de parrainage (en attente de la première course)
            $stmt = $this->db->prepare('
                INSERT INTO referrals (referrer_id, referred_id, referral_code, status, referrer_bonus, referred_bonus, currency)
                VALUES (:referrer_id, :referred_id, :code, "pending", :referrer_bonus, :referred_bonus, "MAD")
            ');
            $stmt->execute([
                'referrer_id' => $referrer['id'],
                'referred_id' => $newUserId,
                'code' => $code,
                'referrer_bonus' => $this->referrerBonus,
                'referred_bonus' => $this->referredBonus,
            ]);

            $this->db->commit();

            return [
                'success' => true,
                'referrer_name' => $referrer['first_name'],
                'bonus_pending' => $this->referredBonus,
            ];
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Compléter un parrainage (après première course du filleul)
     */
    public function completeReferral(int $referredUserId): array
    {
        // Trouver le parrainage en attente
        $stmt = $this->db->prepare('
            SELECT * FROM referrals
            WHERE referred_id = :referred_id AND status = "pending"
        ');
        $stmt->execute(['referred_id' => $referredUserId]);
        $referral = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$referral) {
            return ['completed' => false, 'reason' => 'no_pending_referral'];
        }

        $this->db->beginTransaction();

        try {
            // Créditer le parrain
            $this->walletModel->credit((int) $referral['referrer_id'], (float) $referral['referrer_bonus']);

            // Créditer le filleul
            $this->walletModel->credit($referredUserId, (float) $referral['referred_bonus']);

            // Marquer comme complété
            $stmt = $this->db->prepare('
                UPDATE referrals
                SET status = "completed", completed_at = NOW()
                WHERE id = :id
            ');
            $stmt->execute(['id' => $referral['id']]);

            // Créer les transactions
            require_once BACKEND_PATH . '/Models/Transaction.php';
            $transactionModel = new \TripSalama\Models\Transaction($this->db);

            $transactionModel->createReferralBonus(
                (int) $referral['referrer_id'],
                (float) $referral['referrer_bonus'],
                $referredUserId
            );

            $transactionModel->createReferralBonus(
                $referredUserId,
                (float) $referral['referred_bonus'],
                (int) $referral['referrer_id']
            );

            $this->db->commit();

            return [
                'completed' => true,
                'referrer_bonus' => (float) $referral['referrer_bonus'],
                'referred_bonus' => (float) $referral['referred_bonus'],
            ];
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Obtenir les statistiques de parrainage d'un utilisateur
     */
    public function getStats(int $userId): array
    {
        $stmt = $this->db->prepare('
            SELECT
                COUNT(CASE WHEN status = "completed" THEN 1 END) as completed_referrals,
                COUNT(CASE WHEN status = "pending" THEN 1 END) as pending_referrals,
                COALESCE(SUM(CASE WHEN status = "completed" THEN referrer_bonus ELSE 0 END), 0) as total_earned
            FROM referrals
            WHERE referrer_id = :user_id
        ');
        $stmt->execute(['user_id' => $userId]);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);

        // Obtenir le code de parrainage
        $code = $this->generateReferralCode($userId);

        return [
            'referral_code' => $code,
            'completed_referrals' => (int) ($stats['completed_referrals'] ?? 0),
            'pending_referrals' => (int) ($stats['pending_referrals'] ?? 0),
            'total_earned' => (float) ($stats['total_earned'] ?? 0),
            'referrer_bonus' => $this->referrerBonus,
            'referred_bonus' => $this->referredBonus,
        ];
    }

    /**
     * Obtenir la liste des filleuls
     */
    public function getReferrals(int $userId): array
    {
        $stmt = $this->db->prepare('
            SELECT r.*, u.first_name, u.last_name, u.created_at as user_created_at
            FROM referrals r
            JOIN users u ON r.referred_id = u.id
            WHERE r.referrer_id = :user_id
            ORDER BY r.created_at DESC
        ');
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtenir le lien de partage
     */
    public function getShareLink(int $userId): string
    {
        $code = $this->generateReferralCode($userId);
        return config('url') . '/register?ref=' . $code;
    }

    /**
     * Créer un code unique
     */
    private function createUniqueCode(int $userId): string
    {
        // Format: TRIP + 2 lettres aléatoires + 4 chiffres basés sur l'ID
        $letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $code = 'TRIP';
        $code .= $letters[random_int(0, 25)];
        $code .= $letters[random_int(0, 25)];
        $code .= str_pad((string) ($userId % 10000), 4, '0', STR_PAD_LEFT);

        // Vérifier l'unicité
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM users WHERE referral_code = :code');
        $stmt->execute(['code' => $code]);

        if ($stmt->fetchColumn() > 0) {
            // Code existe, générer un aléatoire
            $code = 'TRIP' . strtoupper(bin2hex(random_bytes(3)));
        }

        return $code;
    }
}
