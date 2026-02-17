<?php

declare(strict_types=1);

namespace TripSalama\Helpers {

    /**
     * Helper pour la gestion des URLs
     * JAMAIS d'URLs hardcodees - utiliser ce helper
     */
    class UrlHelper
    {
        /**
         * Obtenir le base path configure
         */
        public static function getBasePath(): string
        {
            return \config('base_path', '');
        }

        /**
         * Generer une URL complete
         */
        public static function baseUrl(string $path = ''): string
        {
            $basePath = self::getBasePath();
            $path = ltrim($path, '/');

            if (empty($path)) {
                return $basePath ?: '/';
            }

            return $basePath . '/' . $path;
        }

        /**
         * Generer une URL pour un asset (CSS, JS, images)
         */
        public static function assetUrl(string $path): string
        {
            $path = ltrim($path, '/');
            return self::baseUrl('assets/' . $path);
        }

        /**
         * Generer une URL pour l'API
         */
        public static function apiUrl(string $endpoint): string
        {
            $endpoint = ltrim($endpoint, '/');
            return self::baseUrl('api/' . $endpoint);
        }

        /**
         * Rediriger vers une URL
         */
        public static function redirectTo(string $path, int $statusCode = 302): never
        {
            $url = self::baseUrl($path);
            header("Location: $url", true, $statusCode);
            exit;
        }

        /**
         * URL courante
         */
        public static function currentUrl(): string
        {
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $uri = $_SERVER['REQUEST_URI'] ?? '/';

            return $protocol . '://' . $host . $uri;
        }

        /**
         * Verifier si l'URL courante correspond a un pattern
         */
        public static function isCurrentPath(string $path): bool
        {
            $currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
            $basePath = self::getBasePath();
            $fullPath = $basePath . '/' . ltrim($path, '/');

            return $currentPath === $fullPath || $currentPath === rtrim($fullPath, '/');
        }

        /**
         * URL avec versioning pour cache-busting
         */
        public static function versionedAsset(string $path): string
        {
            $fullPath = PUBLIC_PATH . '/assets/' . ltrim($path, '/');
            $version = file_exists($fullPath) ? filemtime($fullPath) : time();

            return self::assetUrl($path) . '?v=' . $version;
        }
    }
}

// Fonctions globales pour simplifier l'usage dans les vues (hors namespace)
namespace {
    function base_url(string $path = ''): string
    {
        return \TripSalama\Helpers\UrlHelper::baseUrl($path);
    }

    function asset_url(string $path): string
    {
        return \TripSalama\Helpers\UrlHelper::assetUrl($path);
    }

    function api_url(string $endpoint): string
    {
        return \TripSalama\Helpers\UrlHelper::apiUrl($endpoint);
    }

    function redirect_to(string $path, int $statusCode = 302): never
    {
        \TripSalama\Helpers\UrlHelper::redirectTo($path, $statusCode);
    }

    function versioned_asset(string $path): string
    {
        return \TripSalama\Helpers\UrlHelper::versionedAsset($path);
    }
}
