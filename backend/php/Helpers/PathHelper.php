<?php

declare(strict_types=1);

namespace TripSalama\Helpers;

/**
 * Helper pour la gestion des chemins
 * JAMAIS de chemins hardcodes - utiliser ce helper
 */
class PathHelper
{
    /**
     * Chemin racine du projet
     */
    public static function getRootPath(): string
    {
        return ROOT_PATH;
    }

    /**
     * Chemin du backend PHP
     */
    public static function getBackendPath(): string
    {
        return BACKEND_PATH;
    }

    /**
     * Chemin public
     */
    public static function getPublicPath(): string
    {
        return PUBLIC_PATH;
    }

    /**
     * Chemin de stockage
     */
    public static function getStoragePath(): string
    {
        return STORAGE_PATH;
    }

    /**
     * Chemin des uploads
     */
    public static function getUploadsPath(): string
    {
        return PUBLIC_PATH . '/uploads';
    }

    /**
     * Chemin des avatars
     */
    public static function getAvatarsPath(): string
    {
        return self::getUploadsPath() . '/avatars';
    }

    /**
     * Chemin des documents
     */
    public static function getDocumentsPath(): string
    {
        return self::getUploadsPath() . '/documents';
    }

    /**
     * Chemin des logs
     */
    public static function getLogsPath(): string
    {
        return STORAGE_PATH . '/logs';
    }

    /**
     * Chemin des vues
     */
    public static function getViewsPath(): string
    {
        return BACKEND_PATH . '/Views';
    }

    /**
     * Chemin des fichiers de langue
     */
    public static function getLangPath(): string
    {
        return BACKEND_PATH . '/lang';
    }

    /**
     * Chemin des assets
     */
    public static function getAssetsPath(): string
    {
        return PUBLIC_PATH . '/assets';
    }
}
