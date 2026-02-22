<?php

declare(strict_types=1);

/**
 * TripSalama - API Payments Endpoint
 * Gestion des paiements, wallet, transactions
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

requireRateLimit('api_request');

try {
    require_once BACKEND_PATH . '/Services/PaymentService.php';
    require_once BACKEND_PATH . '/Models/Wallet.php';
    require_once BACKEND_PATH . '/Models/Transaction.php';

    $db = getDbConnection();
    $paymentService = new \TripSalama\Services\PaymentService($db);
    $walletModel = new \TripSalama\Models\Wallet($db);
    $transactionModel = new \TripSalama\Models\Transaction($db);

    switch ($action) {
        /**
         * Obtenir le wallet de l'utilisateur
         * GET /api/payments.php?action=wallet
         */
        case 'wallet':
            requireAuth();
            $userId = (int) current_user()['id'];
            $wallet = $walletModel->getOrCreate($userId);
            $stats = $walletModel->getStats($userId);

            successResponse([
                'wallet' => $wallet,
                'stats' => $stats,
            ]);
            break;

        /**
         * Obtenir l'historique des transactions
         * GET /api/payments.php?action=transactions
         */
        case 'transactions':
            requireAuth();
            $userId = (int) current_user()['id'];
            $limit = (int) getParam('limit', 20, 'int');
            $offset = (int) getParam('offset', 0, 'int');

            $transactions = $transactionModel->getByUser($userId, $limit, $offset);

            successResponse(['transactions' => $transactions]);
            break;

        /**
         * Créer une intention de paiement pour une course
         * POST /api/payments.php?action=create-payment-intent
         */
        case 'create-payment-intent':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $amount = (float) ($data['amount'] ?? 0);
            $rideId = isset($data['ride_id']) ? (int) $data['ride_id'] : null;
            $currency = $data['currency'] ?? 'MAD';

            if ($amount <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $paymentService->createPaymentIntent($userId, $amount, $currency, $rideId);

            successResponse($result);
            break;

        /**
         * Payer une course avec le wallet
         * POST /api/payments.php?action=pay-with-wallet
         */
        case 'pay-with-wallet':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $rideId = (int) ($data['ride_id'] ?? 0);
            $amount = (float) ($data['amount'] ?? 0);

            if ($rideId <= 0 || $amount <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $paymentService->payRideWithWallet($userId, $rideId, $amount);

            successResponse($result, __('payment.success'));
            break;

        /**
         * Confirmer un paiement cash
         * POST /api/payments.php?action=confirm-cash
         */
        case 'confirm-cash':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $rideId = (int) ($data['ride_id'] ?? 0);
            $amount = (float) ($data['amount'] ?? 0);

            if ($rideId <= 0 || $amount <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $paymentService->payRideWithCash($rideId, $amount, $userId);

            successResponse($result, __('payment.cash_confirmed'));
            break;

        /**
         * Recharger le wallet
         * POST /api/payments.php?action=topup
         */
        case 'topup':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $amount = (float) ($data['amount'] ?? 0);
            $currency = $data['currency'] ?? 'MAD';

            if ($amount <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            // Montants de recharge prédéfinis
            $allowedAmounts = [50, 100, 200, 500, 1000];
            if (!in_array((int) $amount, $allowedAmounts, true)) {
                errorResponse(__('payment.invalid_amount'), 400);
            }

            $result = $paymentService->topupWallet($userId, $amount, $currency);

            successResponse($result);
            break;

        /**
         * Ajouter un pourboire
         * POST /api/payments.php?action=add-tip
         */
        case 'add-tip':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $rideId = (int) ($data['ride_id'] ?? 0);
            $amount = (float) ($data['amount'] ?? 0);

            if ($rideId <= 0 || $amount <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            // Limite de pourboire (max 50% du prix de la course)
            $stmt = $db->prepare('SELECT final_price FROM rides WHERE id = :id');
            $stmt->execute(['id' => $rideId]);
            $ride = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$ride) {
                errorResponse(__('error.not_found'), 404);
            }

            $maxTip = (float) $ride['final_price'] * 0.5;
            if ($amount > $maxTip) {
                errorResponse(__('payment.tip_too_high'), 400);
            }

            $result = $paymentService->addTip($userId, $rideId, $amount);

            successResponse($result, __('payment.tip_added'));
            break;

        /**
         * Obtenir les méthodes de paiement
         * GET /api/payments.php?action=payment-methods
         */
        case 'payment-methods':
            requireAuth();
            $userId = (int) current_user()['id'];

            $methods = $paymentService->getPaymentMethods($userId);

            successResponse(['payment_methods' => $methods]);
            break;

        /**
         * Ajouter une méthode de paiement
         * POST /api/payments.php?action=add-payment-method
         */
        case 'add-payment-method':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $paymentMethodId = $data['payment_method_id'] ?? '';

            if (empty($paymentMethodId)) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $paymentService->addPaymentMethod($userId, $paymentMethodId);

            successResponse($result, __('payment.method_added'));
            break;

        /**
         * Supprimer une méthode de paiement
         * DELETE /api/payments.php?action=remove-payment-method
         */
        case 'remove-payment-method':
            if ($method !== 'DELETE') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $methodId = (int) ($data['method_id'] ?? 0);

            if ($methodId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $paymentService->removePaymentMethod($userId, $methodId);

            successResponse(null, __('payment.method_removed'));
            break;

        /**
         * Définir méthode par défaut
         * PUT /api/payments.php?action=set-default-method
         */
        case 'set-default-method':
            if ($method !== 'PUT') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $methodId = (int) ($data['method_id'] ?? 0);

            if ($methodId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $paymentService->setDefaultPaymentMethod($userId, $methodId);

            successResponse(null, __('msg.updated'));
            break;

        /**
         * Webhook Stripe
         * POST /api/payments.php?action=webhook
         */
        case 'webhook':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }

            $payload = file_get_contents('php://input');
            $event = json_decode($payload, true);

            if (!$event || !isset($event['type'])) {
                errorResponse('Invalid payload', 400);
            }

            switch ($event['type']) {
                case 'payment_intent.succeeded':
                    $paymentIntent = $event['data']['object'];
                    $paymentService->confirmPayment($paymentIntent['id']);
                    break;

                case 'payment_intent.payment_failed':
                    $paymentIntent = $event['data']['object'];
                    $transaction = $transactionModel->findByProviderId($paymentIntent['id']);
                    if ($transaction) {
                        $transactionModel->updateStatus(
                            (int) $transaction['id'],
                            \TripSalama\Models\Transaction::STATUS_FAILED,
                            $paymentIntent['last_payment_error']['message'] ?? 'Payment failed'
                        );
                    }
                    break;
            }

            successResponse(['received' => true]);
            break;

        default:
            errorResponse('Action not found', 404);
    }
} catch (\Exception $e) {
    if (config('debug', false)) {
        errorResponse($e->getMessage(), 500);
    } else {
        app_log('error', 'Payment API Error: ' . $e->getMessage());
        errorResponse(__('error.generic'), 500);
    }
}
