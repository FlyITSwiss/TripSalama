<?php

declare(strict_types=1);

/**
 * TripSalama - Health Check Endpoint
 * Used for diagnosing deployment issues
 */

header('Content-Type: application/json');

$checks = [
    'timestamp' => date('Y-m-d H:i:s'),
    'php_version' => PHP_VERSION,
    'bootstrap' => false,
    'env_loaded' => false,
    'db_connection' => false,
    'errors' => [],
];

try {
    // Test 1: Bootstrap
    $bootstrapFile = dirname(__DIR__, 2) . '/backend/php/bootstrap.php';

    if (file_exists($bootstrapFile)) {
        require_once $bootstrapFile;
        $checks['bootstrap'] = true;
    } else {
        $checks['errors'][] = 'Bootstrap file not found: ' . $bootstrapFile;
    }

    // Test 2: Environment variables
    $checks['env_loaded'] = !empty($_ENV['DB_DATABASE'] ?? getenv('DB_DATABASE'));
    $checks['env_vars'] = [
        'APP_ENV' => $_ENV['APP_ENV'] ?? getenv('APP_ENV') ?: 'not set',
        'DB_HOST' => $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?: 'not set',
        'DB_DATABASE' => $_ENV['DB_DATABASE'] ?? getenv('DB_DATABASE') ?: 'not set',
        'DB_USERNAME' => $_ENV['DB_USERNAME'] ?? getenv('DB_USERNAME') ?: 'not set',
        'DB_PASSWORD' => !empty($_ENV['DB_PASSWORD'] ?? getenv('DB_PASSWORD')) ? '***SET***' : 'not set',
    ];

    // Test 3: Database connection
    if ($checks['bootstrap'] && function_exists('getDbConnection')) {
        try {
            $db = getDbConnection();
            $checks['db_connection'] = true;

            // Test query
            $stmt = $db->query('SELECT 1');
            $checks['db_query'] = $stmt !== false;
        } catch (PDOException $e) {
            $checks['errors'][] = 'DB Error: ' . $e->getMessage();
        }
    }

} catch (Throwable $e) {
    $checks['errors'][] = $e->getMessage();
}

// Overall status
$checks['status'] = empty($checks['errors']) && $checks['db_connection'] ? 'healthy' : 'unhealthy';

echo json_encode($checks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
