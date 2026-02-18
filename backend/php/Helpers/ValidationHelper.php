<?php

declare(strict_types=1);

namespace TripSalama\Helpers;

/**
 * Helper pour la validation des donnees
 */
class ValidationHelper
{
    /**
     * Valider un email
     */
    public static function isValidEmail(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Valider un mot de passe (min 8 chars, 1 maj, 1 chiffre)
     */
    public static function validatePassword(string $password): array
    {
        $errors = [];

        if (strlen($password) < 8) {
            $errors[] = 'password_min_length';
        }

        if (!preg_match('/[A-Z]/', $password)) {
            $errors[] = 'password_uppercase';
        }

        if (!preg_match('/[0-9]/', $password)) {
            $errors[] = 'password_number';
        }

        return $errors;
    }

    /**
     * Valider un numero de telephone
     * Note: Validation desactivee temporairement
     */
    public static function isValidPhone(string $phone): bool
    {
        // Validation desactivee - accepte tout format
        return true;
    }

    /**
     * Nettoyer une chaine pour eviter XSS
     */
    public static function sanitize(string $value): string
    {
        return htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Valider une plaque d'immatriculation suisse
     */
    public static function isValidLicensePlate(string $plate): bool
    {
        // Format: XX 123456 ou XX-123456
        return preg_match('/^[A-Z]{2}[\s\-]?\d{1,6}$/i', $plate) === 1;
    }

    /**
     * Valider les coordonnees GPS
     */
    public static function isValidLatitude(float $lat): bool
    {
        return $lat >= -90 && $lat <= 90;
    }

    public static function isValidLongitude(float $lng): bool
    {
        return $lng >= -180 && $lng <= 180;
    }

    /**
     * Valider un fichier upload (avatar)
     */
    public static function validateAvatarUpload(array $file): array
    {
        $errors = [];
        $allowedTypes = config('allowed_avatar_types', ['image/jpeg', 'image/png', 'image/webp']);
        $maxSize = config('max_upload_size', 5 * 1024 * 1024);

        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errors[] = 'upload_error';
            return $errors;
        }

        if (!in_array($file['type'], $allowedTypes, true)) {
            $errors[] = 'invalid_file_type';
        }

        if ($file['size'] > $maxSize) {
            $errors[] = 'file_too_large';
        }

        return $errors;
    }
}
