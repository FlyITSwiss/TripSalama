<?php

declare(strict_types=1);

/**
 * TripSalama - API Bootstrap
 */

require_once __DIR__ . '/../../backend/php/bootstrap.php';

// Headers API
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/**
 * Repondre en JSON
 */
function jsonResponse(mixed $data, int $statusCode = 200): never
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

/**
 * Repondre avec une erreur
 */
function errorResponse(string $message, int $statusCode = 400, array $errors = []): never
{
    jsonResponse([
        'success' => false,
        'message' => $message,
        'errors' => $errors,
    ], $statusCode);
}

/**
 * Repondre avec succes
 */
function successResponse(mixed $data = null, string $message = ''): never
{
    jsonResponse([
        'success' => true,
        'message' => $message,
        'data' => $data,
    ], 200);
}

/**
 * Verifier l'authentification
 */
function requireAuth(): void
{
    if (!is_authenticated()) {
        errorResponse(__('error.unauthorized'), 401);
    }
}

/**
 * Verifier le role
 */
function requireRole(string $role): void
{
    requireAuth();
    if (!has_role($role)) {
        errorResponse(__('error.forbidden'), 403);
    }
}

/**
 * Verifier le token CSRF (pour POST, PUT, DELETE)
 */
function requireCsrf(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if (!in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
        return;
    }

    // Token dans header ou body
    $token = $_SERVER['HTTP_X_CSRF_TOKEN']
        ?? $_POST['_csrf_token']
        ?? null;

    if ($token === null) {
        // Lire le body JSON
        $input = file_get_contents('php://input');
        if (!empty($input)) {
            $data = json_decode($input, true);
            $token = $data['_csrf_token'] ?? null;
        }
    }

    if ($token === null || !verify_csrf($token)) {
        errorResponse(__('error.csrf'), 419);
    }
}

/**
 * Obtenir les donnees de la requete (JSON ou form)
 * Fusionne toujours $_GET pour avoir les query params (ex: ?action=xxx)
 */
function getRequestData(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (strpos($contentType, 'application/json') !== false) {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        // Fusionner $_GET pour avoir les query params comme action
        return array_merge($_GET, is_array($data) ? $data : []);
    }

    return array_merge($_GET, $_POST);
}

/**
 * Obtenir un parametre de la requete avec cast
 */
function getParam(string $key, mixed $default = null, string $type = 'string'): mixed
{
    $data = getRequestData();
    $value = $data[$key] ?? $default;

    if ($value === null) {
        return $default;
    }

    return match ($type) {
        'int' => (int) $value,
        'float' => (float) $value,
        'bool' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
        'array' => is_array($value) ? $value : [$value],
        default => (string) $value,
    };
}

/**
 * Obtenir l'action demandee
 */
function getAction(): string
{
    return getParam('action', '', 'string');
}

/**
 * Rate Limiting - Protection contre les abus
 * @param string $action Type d'action (api_request, login, etc.)
 * @param string|null $identifier Identifiant unique (email, user_id, etc.)
 */
function requireRateLimit(string $action = 'api_request', ?string $identifier = null): void
{
    try {
        require_once BACKEND_PATH . '/Services/RateLimitService.php';
        $db = getDbConnection();
        $rateLimiter = new \TripSalama\Services\RateLimitService($db);

        // Générer la clé : IP + identifiant optionnel
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        $key = $identifier ? hash('sha256', $ip . ':' . $identifier) : hash('sha256', $ip);

        if (!$rateLimiter->isAllowed($key, $action)) {
            $retryAfter = $rateLimiter->getRetryAfter($key, $action);
            $minutes = (int)ceil($retryAfter / 60);

            header('Retry-After: ' . $retryAfter);
            errorResponse(
                str_replace(':minutes', (string)$minutes, __('error.too_many_attempts')),
                429
            );
        }

        // Enregistrer la tentative
        $rateLimiter->hit($key, $action);
    } catch (\Exception $e) {
        // En cas d'erreur, on continue (fail-open pour ne pas bloquer le service)
        app_log('error', 'Rate limit error: ' . $e->getMessage());
    }
}

/**
 * Validation des coordonnées GPS
 * @param float $lat Latitude
 * @param float $lng Longitude
 * @return bool True si valides
 */
function validateCoordinates(float $lat, float $lng): bool
{
    // Latitude : -90 à +90
    if ($lat < -90 || $lat > 90) {
        return false;
    }

    // Longitude : -180 à +180
    if ($lng < -180 || $lng > 180) {
        return false;
    }

    // Vérifier que ce ne sont pas des zéros (position invalide)
    if ($lat === 0.0 && $lng === 0.0) {
        return false;
    }

    return true;
}

/**
 * Exiger des coordonnées valides
 * @param float $lat Latitude
 * @param float $lng Longitude
 */
function requireValidCoordinates(float $lat, float $lng): void
{
    if (!validateCoordinates($lat, $lng)) {
        errorResponse(__('error.invalid_coordinates'), 400);
    }
}

/**
 * Nettoyer le rate limit après succès (ex: login réussi)
 */
function clearRateLimit(string $action, ?string $identifier = null): void
{
    try {
        require_once BACKEND_PATH . '/Services/RateLimitService.php';
        $db = getDbConnection();
        $rateLimiter = new \TripSalama\Services\RateLimitService($db);

        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        $key = $identifier ? hash('sha256', $ip . ':' . $identifier) : hash('sha256', $ip);

        $rateLimiter->clear($key, $action);
    } catch (\Exception $e) {
        app_log('error', 'Clear rate limit error: ' . $e->getMessage());
    }
}
