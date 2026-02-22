<?php

declare(strict_types=1);

/**
 * TripSalama - API Promo Codes Endpoint
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

requireRateLimit('api_request');

try {
    require_once BACKEND_PATH . '/Services/PromoCodeService.php';

    $db = getDbConnection();
    $promoService = new \TripSalama\Services\PromoCodeService($db);

    switch ($action) {
        /**
         * Valider un code promo
         * POST /api/promo.php?action=validate
         */
        case 'validate':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $code = $data['code'] ?? '';
            $amount = (float) ($data['amount'] ?? 0);

            if (empty($code)) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $promoService->validateAndApply($code, $userId, $amount);

            if ($result['valid']) {
                successResponse($result);
            } else {
                errorResponse($result['error'], 400);
            }
            break;

        /**
         * Appliquer un code promo à une course
         * POST /api/promo.php?action=apply
         */
        case 'apply':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $code = $data['code'] ?? '';
            $rideId = (int) ($data['ride_id'] ?? 0);
            $amount = (float) ($data['amount'] ?? 0);

            if (empty($code) || $rideId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $promoService->validateAndApply($code, $userId, $amount, $rideId);

            if ($result['valid']) {
                successResponse($result, __('promo.applied'));
            } else {
                errorResponse($result['error'], 400);
            }
            break;

        /**
         * Lister les codes promo actifs (admin)
         * GET /api/promo.php?action=list
         */
        case 'list':
            requireAuth();
            requireRole('admin');

            $activeOnly = filter_var(getParam('active_only', 'false'), FILTER_VALIDATE_BOOLEAN);
            $promos = $promoService->getAll($activeOnly);

            successResponse(['promo_codes' => $promos]);
            break;

        /**
         * Créer un code promo (admin)
         * POST /api/promo.php?action=create
         */
        case 'create':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireRole('admin');
            requireCsrf();

            $data = getRequestData();
            $data['created_by'] = (int) current_user()['id'];

            if (empty($data['code']) || !isset($data['discount_value'])) {
                errorResponse(__('validation.required_field'), 400);
            }

            // Vérifier que le code n'existe pas
            if ($promoService->findByCode($data['code'])) {
                errorResponse(__('promo.code_exists'), 400);
            }

            $promoId = $promoService->create($data);

            successResponse(['promo_id' => $promoId], __('promo.created'));
            break;

        /**
         * Mettre à jour un code promo (admin)
         * PUT /api/promo.php?action=update
         */
        case 'update':
            if ($method !== 'PUT') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireRole('admin');
            requireCsrf();

            $data = getRequestData();
            $promoId = (int) ($data['promo_id'] ?? 0);

            if ($promoId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $promoService->update($promoId, $data);

            successResponse(null, __('msg.updated'));
            break;

        /**
         * Désactiver un code promo (admin)
         * PUT /api/promo.php?action=deactivate
         */
        case 'deactivate':
            if ($method !== 'PUT') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireRole('admin');
            requireCsrf();

            $data = getRequestData();
            $promoId = (int) ($data['promo_id'] ?? 0);

            if ($promoId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $promoService->deactivate($promoId);

            successResponse(null, __('promo.deactivated'));
            break;

        /**
         * Obtenir les stats d'un code promo (admin)
         * GET /api/promo.php?action=stats&promo_id=X
         */
        case 'stats':
            requireAuth();
            requireRole('admin');

            $promoId = (int) getParam('promo_id', 0, 'int');

            if ($promoId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $stats = $promoService->getStats($promoId);
            $promo = $promoService->findById($promoId);

            successResponse([
                'promo' => $promo,
                'stats' => $stats,
            ]);
            break;

        /**
         * Générer un code unique (admin)
         * GET /api/promo.php?action=generate-code
         */
        case 'generate-code':
            requireAuth();
            requireRole('admin');

            $length = (int) getParam('length', 8, 'int');
            $code = $promoService->generateUniqueCode($length);

            successResponse(['code' => $code]);
            break;

        default:
            errorResponse('Action not found', 404);
    }
} catch (\Exception $e) {
    if (config('debug', false)) {
        errorResponse($e->getMessage(), 500);
    } else {
        app_log('error', 'Promo API Error: ' . $e->getMessage());
        errorResponse(__('error.generic'), 500);
    }
}
