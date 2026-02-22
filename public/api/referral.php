<?php

declare(strict_types=1);

/**
 * TripSalama - API Parrainage Endpoint
 * Gestion du système de parrainage et bonus
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

requireRateLimit('api_request');

try {
    require_once BACKEND_PATH . '/Services/ReferralService.php';

    $db = getDbConnection();
    $referralService = new \TripSalama\Services\ReferralService($db);

    switch ($action) {
        /**
         * Obtenir mon code de parrainage
         * GET /api/referral.php?action=my-code
         */
        case 'my-code':
            requireAuth();
            $userId = (int) current_user()['id'];

            $code = $referralService->generateReferralCode($userId);

            successResponse([
                'referral_code' => $code,
                'share_link' => $referralService->getShareLink($userId),
            ]);
            break;

        /**
         * Obtenir les statistiques de parrainage
         * GET /api/referral.php?action=stats
         */
        case 'stats':
            requireAuth();
            $userId = (int) current_user()['id'];

            $stats = $referralService->getStats($userId);

            successResponse($stats);
            break;

        /**
         * Obtenir la liste de mes filleuls
         * GET /api/referral.php?action=list
         */
        case 'list':
            requireAuth();
            $userId = (int) current_user()['id'];

            $referrals = $referralService->getReferrals($userId);

            successResponse(['referrals' => $referrals]);
            break;

        /**
         * Appliquer un code de parrainage (lors de l'inscription)
         * POST /api/referral.php?action=apply
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

            if (empty($code)) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $referralService->applyReferralCode($userId, $code);

            if ($result['success']) {
                successResponse($result, __('referral.code_applied'));
            } else {
                errorResponse($result['error'], 400);
            }
            break;

        /**
         * Valider un code de parrainage (sans l'appliquer)
         * GET /api/referral.php?action=validate&code=XXX
         */
        case 'validate':
            $code = getParam('code', '', 'string');

            if (empty($code)) {
                errorResponse(__('validation.required_field'), 400);
            }

            // Vérifier si le code existe
            $stmt = $db->prepare('SELECT id, first_name FROM users WHERE referral_code = :code');
            $stmt->execute(['code' => strtoupper(trim($code))]);
            $referrer = $stmt->fetch(\PDO::FETCH_ASSOC);

            if ($referrer) {
                successResponse([
                    'valid' => true,
                    'referrer_name' => $referrer['first_name'],
                ]);
            } else {
                successResponse([
                    'valid' => false,
                    'error' => __('referral.invalid_code'),
                ]);
            }
            break;

        /**
         * Obtenir le lien de partage
         * GET /api/referral.php?action=share-link
         */
        case 'share-link':
            requireAuth();
            $userId = (int) current_user()['id'];

            $link = $referralService->getShareLink($userId);

            // Générer les liens pour différentes plateformes
            $code = $referralService->generateReferralCode($userId);
            $message = urlencode(__('referral.share_message', ['code' => $code]));

            successResponse([
                'link' => $link,
                'code' => $code,
                'whatsapp' => "https://wa.me/?text={$message}%20{$link}",
                'sms' => "sms:?body={$message}%20{$link}",
                'email' => "mailto:?subject=" . urlencode(__('referral.email_subject'))
                    . "&body={$message}%20{$link}",
            ]);
            break;

        /**
         * Statistiques admin globales
         * GET /api/referral.php?action=admin-stats
         */
        case 'admin-stats':
            requireAuth();
            requireRole('admin');

            $stmt = $db->query('
                SELECT
                    COUNT(*) as total_referrals,
                    COUNT(CASE WHEN status = "completed" THEN 1 END) as completed,
                    COUNT(CASE WHEN status = "pending" THEN 1 END) as pending,
                    COALESCE(SUM(CASE WHEN status = "completed" THEN referrer_bonus + referred_bonus ELSE 0 END), 0) as total_bonuses_paid
                FROM referrals
            ');
            $globalStats = $stmt->fetch(\PDO::FETCH_ASSOC);

            // Top parrains
            $stmt = $db->query('
                SELECT u.id, u.first_name, u.last_name, COUNT(r.id) as referral_count,
                       SUM(r.referrer_bonus) as total_earned
                FROM users u
                JOIN referrals r ON u.id = r.referrer_id AND r.status = "completed"
                GROUP BY u.id
                ORDER BY referral_count DESC
                LIMIT 10
            ');
            $topReferrers = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            successResponse([
                'global' => $globalStats,
                'top_referrers' => $topReferrers,
            ]);
            break;

        default:
            errorResponse('Action not found', 404);
    }
} catch (\Exception $e) {
    if (config('debug', false)) {
        errorResponse($e->getMessage(), 500);
    } else {
        app_log('error', 'Referral API Error: ' . $e->getMessage());
        errorResponse(__('error.generic'), 500);
    }
}
