<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

/**
 * Service de Rate Limiting
 * Protection contre les attaques par force brute
 */
class RateLimitService
{
    private PDO $db;

    // Configuration par défaut
    private const DEFAULT_MAX_ATTEMPTS = 5;
    private const DEFAULT_DECAY_MINUTES = 15;

    // Limites spécifiques par action
    private const LIMITS = [
        'login' => ['max' => 5, 'decay' => 15],
        'register' => ['max' => 3, 'decay' => 60],
        'password_reset' => ['max' => 3, 'decay' => 60],
        'api_request' => ['max' => 60, 'decay' => 1],
    ];

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->ensureTableExists();
    }

    /**
     * Vérifier si une action est autorisée (pas bloquée par rate limit)
     */
    public function isAllowed(string $key, string $action = 'login'): bool
    {
        $this->cleanExpired();

        $limits = self::LIMITS[$action] ?? [
            'max' => self::DEFAULT_MAX_ATTEMPTS,
            'decay' => self::DEFAULT_DECAY_MINUTES
        ];

        $attempts = $this->getAttempts($key, $action, $limits['decay']);

        return $attempts < $limits['max'];
    }

    /**
     * Enregistrer une tentative
     */
    public function hit(string $key, string $action = 'login'): int
    {
        $ip = $this->getClientIp();

        $stmt = $this->db->prepare('
            INSERT INTO rate_limits (key_identifier, action, ip_address, attempts, first_attempt_at, last_attempt_at)
            VALUES (:key, :action, :ip, 1, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                attempts = attempts + 1,
                last_attempt_at = NOW()
        ');

        $stmt->execute([
            'key' => $key,
            'action' => $action,
            'ip' => $ip
        ]);

        return $this->getAttempts($key, $action);
    }

    /**
     * Obtenir le nombre de tentatives
     */
    public function getAttempts(string $key, string $action = 'login', int $decayMinutes = null): int
    {
        $decayMinutes = $decayMinutes ?? self::DEFAULT_DECAY_MINUTES;

        $stmt = $this->db->prepare('
            SELECT COALESCE(SUM(attempts), 0) as total
            FROM rate_limits
            WHERE key_identifier = :key
            AND action = :action
            AND last_attempt_at > DATE_SUB(NOW(), INTERVAL :decay MINUTE)
        ');

        $stmt->execute([
            'key' => $key,
            'action' => $action,
            'decay' => $decayMinutes
        ]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Obtenir le temps restant avant déblocage (en secondes)
     */
    public function getRetryAfter(string $key, string $action = 'login'): int
    {
        $limits = self::LIMITS[$action] ?? ['decay' => self::DEFAULT_DECAY_MINUTES];

        $stmt = $this->db->prepare('
            SELECT TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(last_attempt_at, INTERVAL :decay MINUTE)) as retry_after
            FROM rate_limits
            WHERE key_identifier = :key
            AND action = :action
            ORDER BY last_attempt_at DESC
            LIMIT 1
        ');

        $stmt->execute([
            'key' => $key,
            'action' => $action,
            'decay' => $limits['decay']
        ]);

        $result = $stmt->fetchColumn();

        return max(0, (int) $result);
    }

    /**
     * Réinitialiser les tentatives (après connexion réussie)
     */
    public function clear(string $key, string $action = 'login'): void
    {
        $stmt = $this->db->prepare('
            DELETE FROM rate_limits
            WHERE key_identifier = :key
            AND action = :action
        ');

        $stmt->execute([
            'key' => $key,
            'action' => $action
        ]);
    }

    /**
     * Obtenir les tentatives restantes
     */
    public function getRemainingAttempts(string $key, string $action = 'login'): int
    {
        $limits = self::LIMITS[$action] ?? ['max' => self::DEFAULT_MAX_ATTEMPTS];
        $attempts = $this->getAttempts($key, $action);

        return max(0, $limits['max'] - $attempts);
    }

    /**
     * Nettoyer les entrées expirées
     */
    private function cleanExpired(): void
    {
        // Nettoyer les entrées de plus de 24h
        $stmt = $this->db->prepare('
            DELETE FROM rate_limits
            WHERE last_attempt_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ');
        $stmt->execute();
    }

    /**
     * Obtenir l'IP du client
     */
    private function getClientIp(): string
    {
        $headers = [
            'HTTP_CF_CONNECTING_IP',     // Cloudflare
            'HTTP_X_FORWARDED_FOR',      // Proxy standard
            'HTTP_X_REAL_IP',            // Nginx proxy
            'REMOTE_ADDR'                // Direct
        ];

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = $_SERVER[$header];
                // Si c'est une liste d'IPs, prendre la première
                if (strpos($ip, ',') !== false) {
                    $ip = trim(explode(',', $ip)[0]);
                }
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }

        return '0.0.0.0';
    }

    /**
     * Créer la table si elle n'existe pas
     */
    private function ensureTableExists(): void
    {
        $this->db->exec('
            CREATE TABLE IF NOT EXISTS rate_limits (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                key_identifier VARCHAR(255) NOT NULL,
                action VARCHAR(50) NOT NULL DEFAULT "login",
                ip_address VARCHAR(45) NOT NULL,
                attempts INT UNSIGNED NOT NULL DEFAULT 1,
                first_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_rate_limits_key_action (key_identifier, action),
                INDEX idx_rate_limits_last_attempt (last_attempt_at),
                INDEX idx_rate_limits_ip (ip_address)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ');
    }

    /**
     * Générer une clé unique basée sur l'IP et l'identifiant
     */
    public static function generateKey(string $identifier): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        return hash('sha256', $ip . ':' . $identifier);
    }
}
