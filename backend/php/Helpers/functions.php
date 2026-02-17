<?php

declare(strict_types=1);

/**
 * TripSalama - Fonctions Globales
 */

use TripSalama\Helpers\PathHelper;

/**
 * Fonction de traduction i18n
 */
function __(string $key, array $params = []): string
{
    static $translations = null;
    static $lang = null;

    $currentLang = $_SESSION['lang'] ?? config('default_lang', 'fr');

    if ($translations === null || $lang !== $currentLang) {
        $lang = $currentLang;
        $langFile = PathHelper::getLangPath() . '/' . $lang . '.php';

        if (file_exists($langFile)) {
            $translations = require $langFile;
        } else {
            $translations = [];
        }
    }

    // Cle imbriquee (ex: auth.login)
    $keys = explode('.', $key);
    $value = $translations;

    foreach ($keys as $k) {
        if (!isset($value[$k])) {
            return $key; // Retourner la cle si non trouvee
        }
        $value = $value[$k];
    }

    if (!is_string($value)) {
        return $key;
    }

    // Remplacement des parametres
    foreach ($params as $param => $val) {
        $value = str_replace(':' . $param, (string)$val, $value);
    }

    return $value;
}

/**
 * Generer un token CSRF
 */
function csrf_token(): string
{
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Generer le champ input CSRF
 */
function csrf_field(): string
{
    return '<input type="hidden" name="_csrf_token" value="' . csrf_token() . '">';
}

/**
 * Generer la meta tag CSRF pour JS
 */
function csrf_meta(): string
{
    return '<meta name="csrf-token" content="' . csrf_token() . '">';
}

/**
 * Verifier le token CSRF
 */
function verify_csrf(string $token): bool
{
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Obtenir l'utilisateur connecte
 */
function current_user(): ?array
{
    return $_SESSION['user'] ?? null;
}

/**
 * Verifier si l'utilisateur est connecte
 */
function is_authenticated(): bool
{
    return isset($_SESSION['user']) && !empty($_SESSION['user']['id']);
}

/**
 * Verifier le role de l'utilisateur
 */
function has_role(string $role): bool
{
    $user = current_user();
    return $user !== null && ($user['role'] ?? '') === $role;
}

/**
 * Flash messages
 */
function flash(string $type, string $message): void
{
    $_SESSION['flash'][$type][] = $message;
}

function get_flash(string $type = null): array
{
    if ($type === null) {
        $messages = $_SESSION['flash'] ?? [];
        unset($_SESSION['flash']);
        return $messages;
    }

    $messages = $_SESSION['flash'][$type] ?? [];
    unset($_SESSION['flash'][$type]);
    return $messages;
}

function has_flash(string $type = null): bool
{
    if ($type === null) {
        return !empty($_SESSION['flash']);
    }
    return !empty($_SESSION['flash'][$type]);
}

/**
 * Debug helper (dev only)
 */
function dd(mixed ...$vars): never
{
    if (!config('debug', false)) {
        exit;
    }

    echo '<pre style="background:#1a1a1a;color:#fff;padding:20px;font-family:monospace;">';
    foreach ($vars as $var) {
        var_dump($var);
        echo "\n---\n";
    }
    echo '</pre>';
    exit;
}

/**
 * Log helper
 */
function app_log(string $level, string $message, array $context = []): void
{
    $logPath = PathHelper::getLogsPath();
    $logFile = $logPath . '/app-' . date('Y-m-d') . '.log';

    $entry = sprintf(
        "[%s] %s: %s %s\n",
        date('Y-m-d H:i:s'),
        strtoupper($level),
        $message,
        !empty($context) ? json_encode($context) : ''
    );

    file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);
}

/**
 * Formater une distance en km
 */
function format_distance(float $km): string
{
    if ($km < 1) {
        return round($km * 1000) . ' m';
    }
    return number_format($km, 1, ',', ' ') . ' km';
}

/**
 * Formater une duree en minutes
 */
function format_duration(int $minutes): string
{
    if ($minutes < 60) {
        return $minutes . ' min';
    }
    $hours = floor($minutes / 60);
    $mins = $minutes % 60;
    return $hours . 'h' . ($mins > 0 ? sprintf('%02d', $mins) : '');
}

/**
 * Formater un prix
 */
function format_price(float $amount): string
{
    $currency = config('pricing.currency', 'CHF');
    return number_format($amount, 2, '.', "'") . ' ' . $currency;
}
