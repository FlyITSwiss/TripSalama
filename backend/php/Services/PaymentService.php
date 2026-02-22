<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;
use TripSalama\Models\Wallet;
use TripSalama\Models\Transaction;

/**
 * Service de Paiement
 * Gère les paiements Stripe, wallet, cash et les transactions
 */
class PaymentService
{
    private PDO $db;
    private Wallet $walletModel;
    private Transaction $transactionModel;
    private ?string $stripeSecretKey;
    private float $commissionRate = 0.12; // 12% commission

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->walletModel = new Wallet($db);
        $this->transactionModel = new Transaction($db);
        $this->stripeSecretKey = $_ENV['STRIPE_SECRET_KEY'] ?? null;
    }

    /**
     * Créer une intention de paiement Stripe
     */
    public function createPaymentIntent(
        int $userId,
        float $amount,
        string $currency = 'mad',
        ?int $rideId = null,
        array $metadata = []
    ): array {
        if (!$this->stripeSecretKey) {
            throw new \Exception(__('error.payment_not_configured'));
        }

        // Stripe amount doit être en centimes
        $stripeAmount = (int) round($amount * 100);

        $payload = [
            'amount' => $stripeAmount,
            'currency' => strtolower($currency),
            'automatic_payment_methods' => ['enabled' => true],
            'metadata' => array_merge([
                'user_id' => (string) $userId,
                'ride_id' => $rideId ? (string) $rideId : '',
            ], $metadata),
        ];

        $response = $this->stripeRequest('POST', '/v1/payment_intents', $payload);

        // Créer la transaction en attente
        $transactionId = $this->transactionModel->create([
            'user_id' => $userId,
            'ride_id' => $rideId,
            'type' => Transaction::TYPE_PAYMENT,
            'amount' => $amount,
            'currency' => strtoupper($currency),
            'status' => Transaction::STATUS_PENDING,
            'provider' => 'stripe',
            'provider_transaction_id' => $response['id'],
        ]);

        return [
            'client_secret' => $response['client_secret'],
            'payment_intent_id' => $response['id'],
            'transaction_id' => $transactionId,
        ];
    }

    /**
     * Confirmer un paiement Stripe (webhook)
     */
    public function confirmPayment(string $paymentIntentId): array
    {
        $transaction = $this->transactionModel->findByProviderId($paymentIntentId);

        if (!$transaction) {
            throw new \Exception('Transaction not found');
        }

        // Vérifier le statut chez Stripe
        $response = $this->stripeRequest('GET', '/v1/payment_intents/' . $paymentIntentId);

        if ($response['status'] === 'succeeded') {
            $this->transactionModel->updateStatus(
                (int) $transaction['id'],
                Transaction::STATUS_COMPLETED
            );

            // Si c'est un topup, créditer le wallet
            if ($transaction['type'] === Transaction::TYPE_TOPUP) {
                $this->walletModel->credit(
                    (int) $transaction['user_id'],
                    (float) $transaction['amount']
                );
            }

            return ['success' => true, 'status' => 'completed'];
        }

        return ['success' => false, 'status' => $response['status']];
    }

    /**
     * Payer une course avec le wallet
     */
    public function payRideWithWallet(int $userId, int $rideId, float $amount): array
    {
        $this->db->beginTransaction();

        try {
            // Vérifier le solde
            if (!$this->walletModel->hasSufficientBalance($userId, $amount)) {
                throw new \Exception(__('error.insufficient_balance'));
            }

            // Récupérer les infos de la course
            $stmt = $this->db->prepare('SELECT * FROM rides WHERE id = :id');
            $stmt->execute(['id' => $rideId]);
            $ride = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$ride) {
                throw new \Exception(__('error.not_found'));
            }

            // Débiter le passager
            $this->walletModel->debit($userId, $amount);

            // Calculer la commission et les gains conductrice
            $commission = round($amount * $this->commissionRate, 2);
            $driverEarnings = $amount - $commission;

            // Créditer la conductrice
            if ($ride['driver_id']) {
                $this->walletModel->credit((int) $ride['driver_id'], $driverEarnings);
            }

            // Créer les transactions
            $transactionId = $this->transactionModel->create([
                'user_id' => $userId,
                'ride_id' => $rideId,
                'type' => Transaction::TYPE_PAYMENT,
                'amount' => $amount,
                'status' => Transaction::STATUS_COMPLETED,
                'provider' => 'wallet',
                'description' => 'Paiement course #' . $rideId,
            ]);

            // Transaction commission
            if ($ride['driver_id']) {
                $this->transactionModel->createCommission(
                    (int) $ride['driver_id'],
                    $rideId,
                    $commission
                );
            }

            // Mettre à jour la course
            $stmt = $this->db->prepare('
                UPDATE rides
                SET payment_status = "paid",
                    commission_amount = :commission,
                    driver_earnings = :earnings,
                    updated_at = NOW()
                WHERE id = :ride_id
            ');
            $stmt->execute([
                'ride_id' => $rideId,
                'commission' => $commission,
                'earnings' => $driverEarnings,
            ]);

            $this->db->commit();

            return [
                'success' => true,
                'transaction_id' => $transactionId,
                'amount' => $amount,
                'commission' => $commission,
                'driver_earnings' => $driverEarnings,
            ];
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Payer une course en cash
     */
    public function payRideWithCash(int $rideId, float $amount, int $confirmedBy): array
    {
        $stmt = $this->db->prepare('SELECT * FROM rides WHERE id = :id');
        $stmt->execute(['id' => $rideId]);
        $ride = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$ride) {
            throw new \Exception(__('error.not_found'));
        }

        // Calculer commission et gains
        $commission = round($amount * $this->commissionRate, 2);
        $driverEarnings = $amount - $commission;

        // Créer la transaction
        $transactionId = $this->transactionModel->create([
            'user_id' => (int) $ride['passenger_id'],
            'ride_id' => $rideId,
            'type' => Transaction::TYPE_PAYMENT,
            'amount' => $amount,
            'status' => Transaction::STATUS_COMPLETED,
            'provider' => 'cash',
            'description' => 'Paiement cash course #' . $rideId,
            'metadata' => ['confirmed_by' => $confirmedBy],
        ]);

        // Mettre à jour la course
        $stmt = $this->db->prepare('
            UPDATE rides
            SET payment_status = "paid",
                payment_method = "cash",
                commission_amount = :commission,
                driver_earnings = :earnings,
                updated_at = NOW()
            WHERE id = :ride_id
        ');
        $stmt->execute([
            'ride_id' => $rideId,
            'commission' => $commission,
            'earnings' => $driverEarnings,
        ]);

        return [
            'success' => true,
            'transaction_id' => $transactionId,
            'amount' => $amount,
            'commission' => $commission,
            'driver_earnings' => $driverEarnings,
        ];
    }

    /**
     * Recharger le wallet via Stripe
     */
    public function topupWallet(int $userId, float $amount, string $currency = 'MAD'): array
    {
        $wallet = $this->walletModel->getOrCreate($userId, $currency);

        $intent = $this->createPaymentIntent(
            $userId,
            $amount,
            $currency,
            null,
            ['type' => 'topup', 'wallet_id' => (string) $wallet['id']]
        );

        // Mettre à jour la transaction avec le wallet_id
        $stmt = $this->db->prepare('
            UPDATE transactions
            SET wallet_id = :wallet_id, type = :type
            WHERE provider_transaction_id = :pi_id
        ');
        $stmt->execute([
            'wallet_id' => $wallet['id'],
            'type' => Transaction::TYPE_TOPUP,
            'pi_id' => $intent['payment_intent_id'],
        ]);

        return $intent;
    }

    /**
     * Ajouter un pourboire
     */
    public function addTip(int $userId, int $rideId, float $amount): array
    {
        $this->db->beginTransaction();

        try {
            // Vérifier le solde si paiement wallet
            if (!$this->walletModel->hasSufficientBalance($userId, $amount)) {
                throw new \Exception(__('error.insufficient_balance'));
            }

            $stmt = $this->db->prepare('SELECT driver_id FROM rides WHERE id = :id');
            $stmt->execute(['id' => $rideId]);
            $ride = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$ride || !$ride['driver_id']) {
                throw new \Exception(__('error.not_found'));
            }

            // Débiter le passager
            $this->walletModel->debit($userId, $amount);

            // Créditer la conductrice (100% du pourboire)
            $this->walletModel->credit((int) $ride['driver_id'], $amount);

            // Créer la transaction
            $transactionId = $this->transactionModel->createTip($userId, $rideId, $amount);
            $this->transactionModel->updateStatus($transactionId, Transaction::STATUS_COMPLETED);

            // Mettre à jour la course
            $stmt = $this->db->prepare('
                UPDATE rides
                SET tip_amount = COALESCE(tip_amount, 0) + :tip
                WHERE id = :ride_id
            ');
            $stmt->execute(['ride_id' => $rideId, 'tip' => $amount]);

            $this->db->commit();

            return [
                'success' => true,
                'transaction_id' => $transactionId,
                'amount' => $amount,
            ];
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Rembourser une course
     */
    public function refundRide(int $rideId, float $amount, string $reason = ''): array
    {
        $stmt = $this->db->prepare('SELECT * FROM rides WHERE id = :id');
        $stmt->execute(['id' => $rideId]);
        $ride = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$ride) {
            throw new \Exception(__('error.not_found'));
        }

        // Créditer le passager
        $this->walletModel->credit((int) $ride['passenger_id'], $amount);

        // Créer la transaction de remboursement
        $transactionId = $this->transactionModel->createRefund(
            (int) $ride['passenger_id'],
            $rideId,
            $amount,
            $reason
        );
        $this->transactionModel->updateStatus($transactionId, Transaction::STATUS_COMPLETED);

        // Mettre à jour le statut de paiement
        $stmt = $this->db->prepare('
            UPDATE rides SET payment_status = "refunded" WHERE id = :id
        ');
        $stmt->execute(['id' => $rideId]);

        return [
            'success' => true,
            'transaction_id' => $transactionId,
            'amount' => $amount,
        ];
    }

    /**
     * Obtenir les méthodes de paiement d'un utilisateur
     */
    public function getPaymentMethods(int $userId): array
    {
        $stmt = $this->db->prepare('
            SELECT * FROM payment_methods
            WHERE user_id = :user_id AND is_active = 1
            ORDER BY is_default DESC, created_at DESC
        ');
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Ajouter une méthode de paiement
     */
    public function addPaymentMethod(int $userId, string $stripePaymentMethodId): array
    {
        // Récupérer les détails chez Stripe
        $pm = $this->stripeRequest('GET', '/v1/payment_methods/' . $stripePaymentMethodId);

        // Vérifier si c'est le premier
        $methods = $this->getPaymentMethods($userId);
        $isDefault = empty($methods) ? 1 : 0;

        $stmt = $this->db->prepare('
            INSERT INTO payment_methods (
                user_id, type, provider, provider_payment_method_id,
                last_four, brand, exp_month, exp_year, is_default
            ) VALUES (
                :user_id, :type, :provider, :pm_id,
                :last_four, :brand, :exp_month, :exp_year, :is_default
            )
        ');

        $stmt->execute([
            'user_id' => $userId,
            'type' => 'card',
            'provider' => 'stripe',
            'pm_id' => $stripePaymentMethodId,
            'last_four' => $pm['card']['last4'] ?? null,
            'brand' => $pm['card']['brand'] ?? null,
            'exp_month' => $pm['card']['exp_month'] ?? null,
            'exp_year' => $pm['card']['exp_year'] ?? null,
            'is_default' => $isDefault,
        ]);

        return [
            'id' => (int) $this->db->lastInsertId(),
            'last_four' => $pm['card']['last4'] ?? null,
            'brand' => $pm['card']['brand'] ?? null,
        ];
    }

    /**
     * Supprimer une méthode de paiement
     */
    public function removePaymentMethod(int $userId, int $methodId): bool
    {
        $stmt = $this->db->prepare('
            UPDATE payment_methods
            SET is_active = 0
            WHERE id = :id AND user_id = :user_id
        ');

        return $stmt->execute([
            'id' => $methodId,
            'user_id' => $userId,
        ]);
    }

    /**
     * Définir la méthode de paiement par défaut
     */
    public function setDefaultPaymentMethod(int $userId, int $methodId): bool
    {
        $this->db->beginTransaction();

        try {
            // Retirer le défaut de toutes les méthodes
            $stmt = $this->db->prepare('
                UPDATE payment_methods SET is_default = 0 WHERE user_id = :user_id
            ');
            $stmt->execute(['user_id' => $userId]);

            // Définir la nouvelle par défaut
            $stmt = $this->db->prepare('
                UPDATE payment_methods SET is_default = 1 WHERE id = :id AND user_id = :user_id
            ');
            $stmt->execute(['id' => $methodId, 'user_id' => $userId]);

            $this->db->commit();
            return true;
        } catch (\Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }

    /**
     * Requête vers l'API Stripe
     */
    private function stripeRequest(string $method, string $endpoint, array $data = []): array
    {
        if (!$this->stripeSecretKey) {
            throw new \Exception('Stripe not configured');
        }

        $url = 'https://api.stripe.com' . $endpoint;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERPWD, $this->stripeSecretKey . ':');

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $result = json_decode($response, true);

        if ($httpCode >= 400) {
            throw new \Exception($result['error']['message'] ?? 'Stripe error');
        }

        return $result;
    }

    /**
     * Obtenir le taux de commission
     */
    public function getCommissionRate(): float
    {
        return $this->commissionRate;
    }
}
