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
            requireCsrf();
            $controller->apiLogin();
            break;

        case 'register':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
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
