<?php

declare(strict_types=1);

/**
 * TripSalama - Bootstrap Application
 */

// Definir le chemin racine
define('ROOT_PATH', dirname(__DIR__, 2));
define('BACKEND_PATH', ROOT_PATH . '/backend/php');
define('PUBLIC_PATH', ROOT_PATH . '/public');
define('STORAGE_PATH', ROOT_PATH . '/storage');

// Charger les variables d'environnement
$envFile = ROOT_PATH . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value);
            putenv(trim($key) . '=' . trim($value));
        }
    }
}

// Charger la configuration
$config = require BACKEND_PATH . '/config/app.php';
$dbConfig = require BACKEND_PATH . '/config/database.php';

// Configuration erreurs
if ($config['debug']) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(0);
    ini_set('display_errors', '0');
}

// Timezone
date_default_timezone_set('Europe/Zurich');

// Session
if (session_status() === PHP_SESSION_NONE) {
    session_start([
        'cookie_lifetime' => $config['session_lifetime'] * 60,
        'cookie_httponly' => true,
        'cookie_secure' => $config['session_secure'],
        'cookie_samesite' => 'Lax',
    ]);
}

// Autoloader simple
spl_autoload_register(function (string $class): void {
    // Namespace TripSalama
    $prefix = 'TripSalama\\';
    $baseDir = BACKEND_PATH . '/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

// Charger les helpers
require_once BACKEND_PATH . '/Helpers/PathHelper.php';
require_once BACKEND_PATH . '/Helpers/UrlHelper.php';
require_once BACKEND_PATH . '/Helpers/ValidationHelper.php';
require_once BACKEND_PATH . '/Helpers/functions.php';

// Connexion BDD
function getDbConnection(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dbConfig = require BACKEND_PATH . '/config/database.php';
        $dsn = sprintf(
            '%s:host=%s;port=%d;dbname=%s;charset=%s',
            $dbConfig['driver'],
            $dbConfig['host'],
            $dbConfig['port'],
            $dbConfig['database'],
            $dbConfig['charset']
        );

        $pdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], $dbConfig['options']);
    }

    return $pdo;
}

// Configuration globale accessible
function config(string $key = null, mixed $default = null): mixed
{
    static $config = null;

    if ($config === null) {
        $config = require BACKEND_PATH . '/config/app.php';
    }

    if ($key === null) {
        return $config;
    }

    $keys = explode('.', $key);
    $value = $config;

    foreach ($keys as $k) {
        if (!isset($value[$k])) {
            return $default;
        }
        $value = $value[$k];
    }

    return $value;
}
