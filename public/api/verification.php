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
                'analysis' => $result['analysis'] ?? null,
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

        case 'verify-gender':
            // Étape 1: Vérifier le genre via photo du visage (AVANT inscription)
            // Endpoint PUBLIC - pas besoin d'auth car utilisé avant inscription
            if ($method !== 'POST') {
                errorResponse(__('error.generic'), 405);
            }

            requireCsrf();

            require_once BACKEND_PATH . '/Services/GenderVerificationService.php';

            $data = getRequestData();
            $image = $data['image'] ?? '';

            if (empty($image)) {
                errorResponse(__('validation.required_field'), 400);
            }

            $genderService = new \TripSalama\Services\GenderVerificationService();
            $result = $genderService->analyzeGender($image);

            if (!$result['success']) {
                errorResponse($result['message'], 400);
            }

            // Stocker le résultat en session pour la suite du flux
            if ($result['can_proceed']) {
                $_SESSION['registration_gender_verified'] = true;
                $_SESSION['registration_gender_result'] = [
                    'is_female' => $result['is_female'],
                    'confidence' => $result['confidence'],
                    'verified_at' => time()
                ];
            }

            successResponse([
                'can_proceed' => $result['can_proceed'],
                'is_female' => $result['is_female'],
                'confidence' => $result['confidence'],
                'reason' => $result['reason'] ?? ''
            ], $result['message']);
            break;

        case 'scan-id':
            // Étape 2: Scanner la carte d'identité (APRÈS vérification genre)
            // Endpoint PUBLIC - pas besoin d'auth car utilisé avant inscription
            if ($method !== 'POST') {
                errorResponse(__('error.generic'), 405);
            }

            requireCsrf();

            // Vérifier que l'étape 1 (vérification genre) a été passée
            if (!isset($_SESSION['registration_gender_verified']) || $_SESSION['registration_gender_verified'] !== true) {
                errorResponse(__('verification.gender_step_required'), 400);
            }

            require_once BACKEND_PATH . '/Services/IDCardOCRService.php';

            $data = getRequestData();
            $image = $data['image'] ?? '';

            if (empty($image)) {
                errorResponse(__('validation.required_field'), 400);
            }

            $ocrService = new \TripSalama\Services\IDCardOCRService();
            $result = $ocrService->verifyFemaleID($image);

            if (!$result['success']) {
                errorResponse($result['message'], 400);
            }

            // Vérifier que la carte est bien celle d'une femme
            if (!$result['is_female']) {
                // Nettoyer la session et rejeter
                unset($_SESSION['registration_gender_verified']);
                unset($_SESSION['registration_gender_result']);
                errorResponse(__('verification.id_not_female'), 403);
            }

            // Stocker les données extraites pour pré-remplir le formulaire
            if ($result['can_proceed']) {
                $_SESSION['registration_id_verified'] = true;
                $_SESSION['registration_id_data'] = $result['data'];
                $_SESSION['registration_id_result'] = [
                    'document_type' => $result['document_type'],
                    'country' => $result['country'],
                    'confidence' => $result['confidence'],
                    'verified_at' => time()
                ];
            }

            successResponse([
                'can_proceed' => $result['can_proceed'],
                'is_female' => $result['is_female'],
                'document_type' => $result['document_type'],
                'country' => $result['country'],
                'prefill_data' => $result['can_proceed'] ? $result['data'] : [],
                'confidence' => $result['confidence']
            ], $result['message']);
            break;

        case 'registration-status':
            // Obtenir le statut actuel du processus d'inscription
            if ($method !== 'GET') {
                errorResponse(__('error.generic'), 405);
            }

            $genderVerified = $_SESSION['registration_gender_verified'] ?? false;
            $idVerified = $_SESSION['registration_id_verified'] ?? false;
            $prefillData = $_SESSION['registration_id_data'] ?? [];

            successResponse([
                'gender_verified' => $genderVerified,
                'id_verified' => $idVerified,
                'can_show_form' => $genderVerified && $idVerified,
                'prefill_data' => $idVerified ? $prefillData : []
            ]);
            break;

        case 'skip-gender-step':
            // Permettre de passer l'étape genre manuellement (vérification manuelle plus tard)
            // Appelé quand l'utilisateur clique "Continuer quand même"
            if ($method !== 'POST') {
                errorResponse(__('error.generic'), 405);
            }

            requireCsrf();

            // Marquer l'étape comme passée (pour vérification manuelle ultérieure)
            $_SESSION['registration_gender_verified'] = true;
            $_SESSION['registration_gender_result'] = [
                'is_female' => null, // Non déterminé automatiquement
                'confidence' => 0,
                'verified_at' => time(),
                'manual_skip' => true // Indique que c'est un skip manuel
            ];

            successResponse([
                'can_proceed' => true,
                'manual_review_required' => true
            ], __('verification.continue_for_manual_review'));
            break;

        case 'clear-registration':
            // Nettoyer les données de vérification d'inscription
            if ($method !== 'POST') {
                errorResponse(__('error.generic'), 405);
            }

            unset($_SESSION['registration_gender_verified']);
            unset($_SESSION['registration_gender_result']);
            unset($_SESSION['registration_id_verified']);
            unset($_SESSION['registration_id_data']);
            unset($_SESSION['registration_id_result']);

            successResponse(null, __('msg.success'));
            break;

        default:
            errorResponse(__('error.not_found'), 404);
    }

} catch (\Exception $e) {
    errorResponse(__('error.generic'), 500);
}
