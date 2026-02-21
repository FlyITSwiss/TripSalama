<?php

declare(strict_types=1);

namespace TripSalama\Middleware;

/**
 * Middleware pour les headers de sécurité
 * OWASP Security Headers compliance
 */
class SecurityHeadersMiddleware
{
    /**
     * Appliquer les headers de sécurité
     */
    public static function apply(): void
    {
        // Empêcher le clickjacking
        header('X-Frame-Options: SAMEORIGIN');

        // Empêcher le MIME type sniffing
        header('X-Content-Type-Options: nosniff');

        // Protection XSS (navigateurs anciens)
        header('X-XSS-Protection: 1; mode=block');

        // Referrer Policy
        header('Referrer-Policy: strict-origin-when-cross-origin');

        // Permissions Policy
        header('Permissions-Policy: accelerometer=(), camera=(self), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');

        // Content Security Policy
        $csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
            "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.tile.openstreetmap.de https://unpkg.com https://*.basemaps.cartocdn.com",
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
            "connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org https://unpkg.com wss:",
            "frame-ancestors 'self'",
            "form-action 'self'",
            "base-uri 'self'",
            "object-src 'none'"
        ];
        header('Content-Security-Policy: ' . implode('; ', $csp));

        // Cross-Origin policies
        header('Cross-Origin-Embedder-Policy: unsafe-none');
        header('Cross-Origin-Opener-Policy: same-origin-allow-popups');
        header('Cross-Origin-Resource-Policy: same-site');

        // Cache control pour les pages dynamiques
        if (!headers_sent()) {
            header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
            header('Pragma: no-cache');
        }
    }

    /**
     * Appliquer HSTS (uniquement en HTTPS production)
     */
    public static function applyHSTS(): void
    {
        if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
        }
    }

    /**
     * Headers CORS pour les API
     */
    public static function applyCORS(array $allowedOrigins = ['*']): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if (in_array('*', $allowedOrigins, true)) {
            header('Access-Control-Allow-Origin: *');
        } elseif (in_array($origin, $allowedOrigins, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');

        // Préflight request
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}
