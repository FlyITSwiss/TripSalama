<?php

declare(strict_types=1);

/**
 * TripSalama - Front Controller
 */

// Bootstrap
require_once __DIR__ . '/../backend/php/bootstrap.php';

use TripSalama\Helpers\PathHelper;
use TripSalama\Helpers\UrlHelper;

// Obtenir le chemin de la requete
$basePath = config('base_path', '');
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestPath = parse_url($requestUri, PHP_URL_PATH);

// Retirer le base path
if (!empty($basePath) && strpos($requestPath, $basePath) === 0) {
    $requestPath = substr($requestPath, strlen($basePath));
}
$requestPath = $requestPath ?: '/';

// Route API requests to api/index.php
if (preg_match('#^/api(/.*)?$#', $requestPath)) {
    require __DIR__ . '/api/index.php';
    exit;
}

// Methode HTTP
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Charger les routes
$routes = require BACKEND_PATH . '/config/routes.php';

// Router simple
$matchedRoute = null;
$params = [];

foreach ($routes as $routeKey => $routeConfig) {
    [$routeMethod, $routePattern] = explode(' ', $routeKey, 2);

    if ($routeMethod !== $requestMethod) {
        continue;
    }

    // Convertir les parametres {id} en regex
    $pattern = preg_replace('/\{([a-zA-Z_]+)\}/', '(?P<$1>[^/]+)', $routePattern);
    $pattern = '#^' . $pattern . '$#';

    if (preg_match($pattern, $requestPath, $matches)) {
        $matchedRoute = $routeConfig;
        // Extraire les parametres nommes
        foreach ($matches as $key => $value) {
            if (is_string($key)) {
                $params[$key] = $value;
            }
        }
        break;
    }
}

// Route non trouvee
if ($matchedRoute === null) {
    http_response_code(404);
    require BACKEND_PATH . '/Views/errors/404.phtml';
    exit;
}

// Extraire les infos de route
$controllerName = $matchedRoute[0];
$actionName = $matchedRoute[1];
$requiresAuth = $matchedRoute['auth'] ?? false;
$requiredRole = $matchedRoute['role'] ?? null;

// Verifier l'authentification
if ($requiresAuth && !is_authenticated()) {
    flash('error', __('error.unauthorized'));
    redirect_to('login');
}

// Verifier le role
if ($requiredRole !== null && !has_role($requiredRole)) {
    http_response_code(403);
    require BACKEND_PATH . '/Views/errors/403.phtml';
    exit;
}

// Charger et executer le controller
try {
    $controllerFile = BACKEND_PATH . '/Controllers/' . $controllerName . '.php';

    if (!file_exists($controllerFile)) {
        throw new Exception("Controller not found: $controllerName");
    }

    require_once $controllerFile;

    $controllerClass = 'TripSalama\\Controllers\\' . $controllerName;
    $db = getDbConnection();
    $controller = new $controllerClass($db);

    if (!method_exists($controller, $actionName)) {
        throw new Exception("Action not found: $actionName");
    }

    // Executer l'action avec les parametres
    $controller->$actionName(...array_values($params));

} catch (Exception $e) {
    if (config('debug', false)) {
        echo '<pre>';
        echo 'Error: ' . $e->getMessage() . "\n";
        echo $e->getTraceAsString();
        echo '</pre>';
    } else {
        app_log('error', $e->getMessage(), ['trace' => $e->getTraceAsString()]);
        http_response_code(500);
        require BACKEND_PATH . '/Views/errors/500.phtml';
    }
}
