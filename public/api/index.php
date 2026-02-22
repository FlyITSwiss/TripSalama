<?php

declare(strict_types=1);

/**
 * TripSalama - API Router
 * Route les requetes API vers les bons fichiers
 */

// Obtenir le chemin de la requete
$requestUri = $_SERVER['REQUEST_URI'] ?? '/api';
$requestPath = parse_url($requestUri, PHP_URL_PATH);

// Support both local (/api/...) and production (/internal/tripsalama/api/...)
// Extract endpoint from URL (handles BASE_PATH prefix)
$endpoint = preg_replace('#^.*/api/?#', '', $requestPath);
$endpoint = trim($endpoint, '/');

// Si pas d'endpoint, retourner la liste des endpoints disponibles
if (empty($endpoint)) {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => 'TripSalama API v1.0',
        'endpoints' => [
            '/api/auth',
            '/api/rides',
            '/api/drivers',
            '/api/user',
            '/api/chat',
            '/api/health',
            '/api/verification'
        ]
    ]);
    exit;
}

// Extraire le nom du fichier (premier segment)
$segments = explode('/', $endpoint);
$file = $segments[0];

// Chemin vers le fichier API
$apiFile = __DIR__ . '/' . $file . '.php';

if (file_exists($apiFile)) {
    // Passer les segments supplementaires comme parametres
    if (count($segments) > 1) {
        $_GET['id'] = $segments[1];
    }

    require $apiFile;
} else {
    // Endpoint non trouve
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Endpoint not found: ' . $file,
        'available_endpoints' => ['auth', 'rides', 'drivers', 'user', 'chat', 'health', 'verification']
    ]);
}
