<?php

declare(strict_types=1);

namespace TripSalama\Services;

/**
 * Service de chiffrement des coordonnées GPS sensibles
 * Utilise AES-256-GCM pour le chiffrement symétrique
 */
class CoordinateEncryptionService
{
    private const CIPHER = 'aes-256-gcm';
    private const TAG_LENGTH = 16;

    private string $encryptionKey;

    public function __construct()
    {
        // Clé de chiffrement depuis l'environnement
        $key = $_ENV['COORDINATES_ENCRYPTION_KEY'] ?? '';

        if (empty($key)) {
            // Générer une clé par défaut si non configurée (dev uniquement)
            $key = hash('sha256', 'tripsalama-coordinates-key-change-in-production');
        }

        $this->encryptionKey = $key;
    }

    /**
     * Chiffrer des coordonnées GPS
     *
     * @param float $lat Latitude
     * @param float $lng Longitude
     * @return string Coordonnées chiffrées (base64)
     */
    public function encrypt(float $lat, float $lng): string
    {
        $data = json_encode(['lat' => $lat, 'lng' => $lng], JSON_THROW_ON_ERROR);

        $iv = random_bytes(openssl_cipher_iv_length(self::CIPHER));
        $tag = '';

        $encrypted = openssl_encrypt(
            $data,
            self::CIPHER,
            $this->encryptionKey,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_LENGTH
        );

        if ($encrypted === false) {
            throw new \RuntimeException(__('error.encryption_failed'));
        }

        // Format: IV + TAG + ENCRYPTED
        return base64_encode($iv . $tag . $encrypted);
    }

    /**
     * Déchiffrer des coordonnées GPS
     *
     * @param string $encryptedData Données chiffrées (base64)
     * @return array{lat: float, lng: float} Coordonnées déchiffrées
     */
    public function decrypt(string $encryptedData): array
    {
        $decoded = base64_decode($encryptedData, true);

        if ($decoded === false) {
            throw new \RuntimeException(__('error.invalid_encrypted_data'));
        }

        $ivLength = openssl_cipher_iv_length(self::CIPHER);
        $iv = substr($decoded, 0, $ivLength);
        $tag = substr($decoded, $ivLength, self::TAG_LENGTH);
        $encrypted = substr($decoded, $ivLength + self::TAG_LENGTH);

        $decrypted = openssl_decrypt(
            $encrypted,
            self::CIPHER,
            $this->encryptionKey,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($decrypted === false) {
            throw new \RuntimeException(__('error.decryption_failed'));
        }

        $data = json_decode($decrypted, true, 512, JSON_THROW_ON_ERROR);

        return [
            'lat' => (float)$data['lat'],
            'lng' => (float)$data['lng'],
        ];
    }

    /**
     * Anonymiser des coordonnées (réduire la précision pour RGPD)
     * Réduit la précision à ~1km pour les données anonymisées
     *
     * @param float $lat Latitude
     * @param float $lng Longitude
     * @return array{lat: float, lng: float} Coordonnées anonymisées
     */
    public function anonymize(float $lat, float $lng): array
    {
        // Réduire à 2 décimales = ~1.1km de précision
        return [
            'lat' => round($lat, 2),
            'lng' => round($lng, 2),
        ];
    }

    /**
     * Hacher des coordonnées pour indexation sans révéler la position exacte
     *
     * @param float $lat Latitude
     * @param float $lng Longitude
     * @return string Hash des coordonnées
     */
    public function hash(float $lat, float $lng): string
    {
        // Arrondir pour créer des zones de ~100m
        $roundedLat = round($lat, 3);
        $roundedLng = round($lng, 3);

        return hash_hmac('sha256', "$roundedLat:$roundedLng", $this->encryptionKey);
    }
}
