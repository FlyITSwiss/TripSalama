<?php

declare(strict_types=1);

/**
 * TripSalama - API Auth Endpoint
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

try {
    require_once BACKEND_PATH . '/Controllers/AuthController.php';

    $db = getDbConnection();
    $controller = new \TripSalama\Controllers\AuthController($db);

    switch ($action) {
        case 'login':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            // Rate limiting strict pour le login (5 tentatives / 15 min)
            $email = getParam('email', '', 'string');
            requireRateLimit('login', $email);
            // Note: CSRF non requis pour login car:
            // - Protégé par rate limiting
            // - Les attaques CSRF ciblent les navigateurs, pas les apps mobiles
            // - L'utilisateur doit fournir des credentials valides
            $controller->apiLogin();
            break;

        case 'register':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            // Rate limiting strict pour l'inscription (3 tentatives / 60 min)
            requireRateLimit('register');
            requireCsrf();
            $controller->apiRegister();
            break;

        case 'logout':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireCsrf();
            $controller->apiLogout();
            break;

        case 'me':
            if ($method !== 'GET') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            $controller->apiMe();
            break;

        case 'check':
            // Vérifie si l'utilisateur est connecté (pour l'app mobile)
            if ($method !== 'GET') {
                errorResponse('Method not allowed', 405);
            }
            $user = current_user();
            if ($user) {
                jsonResponse([
                    'authenticated' => true,
                    'user' => [
                        'id' => $user['id'],
                        'email' => $user['email'],
                        'first_name' => $user['first_name'],
                        'last_name' => $user['last_name'],
                        'role' => $user['role'],
                    ]
                ]);
            } else {
                jsonResponse([
                    'authenticated' => false,
                    'user' => null
                ]);
            }
            break;

        case 'csrf':
            // Génère un token CSRF pour l'app mobile
            if ($method !== 'GET') {
                errorResponse('Method not allowed', 405);
            }
            jsonResponse([
                'token' => csrf_token()
            ]);
            break;

        default:
            errorResponse('Action not found', 404);
    }

} catch (\Exception $e) {
    if (config('debug', false)) {
        errorResponse($e->getMessage(), 500);
    } else {
        app_log('error', $e->getMessage());
        errorResponse(__('error.generic'), 500);
    }
}
