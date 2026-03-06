<?php

declare(strict_types=1);

/**
 * TripSalama - API Vérification d'identité
 */

require_once '_bootstrap.php';

use TripSalama\Services\IdentityVerificationService;

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

try {
    require_once BACKEND_PATH . '/Services/IdentityVerificationService.php';
    require_once BACKEND_PATH . '/Models/IdentityVerification.php';
    require_once BACKEND_PATH . '/Models/User.php';

    $db = getDbConnection();
    $service = new IdentityVerificationService($db);

    switch ($action) {
        case 'submit':
            // Soumettre une vérification d'identité
            if ($method !== 'POST') {
                errorResponse(__('error.generic'), 405);
            }

            requireCsrf();

            $data = getRequestData();

            // Déterminer l'ID utilisateur (session complète ou pending)
            $userId = null;
            $isPendingVerification = false;

            if (isset($_SESSION['pending_verification_user_id'])) {
                // Utilisateur en attente de vérification (après inscription)
                $userId = (int)$_SESSION['pending_verification_user_id'];
                $isPendingVerification = true;
            } elseif (is_authenticated()) {
                // Utilisateur déjà connecté
                $userId = (int)current_user()['id'];
            } else {
                errorResponse(__('error.unauthorized'), 401);
            }

            $image = $data['image'] ?? '';
            $confidence = isset($data['ai_confidence']) ? (float)$data['ai_confidence'] : null;
            $aiResult = $data['ai_result'] ?? null;

            if (empty($image)) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $service->submitVerification($userId, $image, $confidence, $aiResult);

            if (!$result['success']) {
                errorResponse($result['message'], 400);
            }

            // Si vérification réussie ET utilisateur en pending, créer la session complète
            if ($isPendingVerification && $result['status'] === 'verified') {
                require_once BACKEND_PATH . '/Models/User.php';
                $userModel = new \TripSalama\Models\User($db);
                $user = $userModel->findById($userId);

                if ($user) {
                    // Créer la session complète maintenant
                    $_SESSION['user'] = $user;
                    // Nettoyer les données de pending
                    unset($_SESSION['pending_verification_user_id']);
                    unset($_SESSION['pending_verification_email']);
                }
            }

            successResponse([
                'status' => $result['status'],
                'verification_id' => $result['verification_id'],
                'session_created' => $isPendingVerification && $result['status'] === 'verified',
            ], $result['message']);
            break;

        case 'status':
            // Obtenir le statut de vérification
            if ($method !== 'GET') {
                errorResponse(__('error.generic'), 405);
            }

            requireAuth();

            $userId = (int)current_user()['id'];
            $status = $service->getVerificationStatus($userId);

            successResponse($status);
            break;

        case 'approve':
            // Approuver une vérification (admin uniquement)
            if ($method !== 'POST') {
                errorResponse(__('error.generic'), 405);
            }

            requireAuth();
            requireRole('admin');
            requireCsrf();

            $data = getRequestData();
            $verificationId = (int)($data['verification_id'] ?? 0);
            $adminId = (int)current_user()['id'];

            if ($verificationId === 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $service->approveVerification($verificationId, $adminId);

            if (!$result) {
                errorResponse(__('error.generic'), 400);
            }

            successResponse(null, __('msg.updated'));
            break;

        case 'reject':
            // Rejeter une vérification (admin uniquement)
            if ($method !== 'POST') {
                errorResponse(__('error.generic'), 405);
            }

            requireAuth();
            requireRole('admin');
            requireCsrf();

            $data = getRequestData();
            $verificationId = (int)($data['verification_id'] ?? 0);
            $reason = trim($data['reason'] ?? '');
            $adminId = (int)current_user()['id'];

            if ($verificationId === 0 || empty($reason)) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $service->rejectVerification($verificationId, $adminId, $reason);

            if (!$result) {
                errorResponse(__('error.generic'), 400);
            }

            successResponse(null, __('msg.updated'));
            break;

        case 'pending':
            // Obtenir les vérifications en attente (admin uniquement)
            if ($method !== 'GET') {
                errorResponse(__('error.generic'), 405);
            }

            requireAuth();
            requireRole('admin');

            $pending = $service->getPendingVerifications();

            successResponse(['verifications' => $pending]);
            break;

        case 'stats':
            // Obtenir les statistiques (admin uniquement)
            if ($method !== 'GET') {
                errorResponse(__('error.generic'), 405);
            }

            requireAuth();
            requireRole('admin');

            $stats = $service->getStats();

            successResponse($stats);
            break;

        default:
            errorResponse(__('error.not_found'), 404);
    }

} catch (\Exception $e) {
    errorResponse(__('error.generic'), 500);
}
