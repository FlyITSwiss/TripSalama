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
 */
function getRequestData(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (strpos($contentType, 'application/json') !== false) {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        return is_array($data) ? $data : [];
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
