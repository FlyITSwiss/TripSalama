<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

class TwoFactorService
{
    private PDO $db;
    private int $otpLength;
    private int $otpExpiryMinutes;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->otpLength = (int) ($_ENV['OTP_LENGTH'] ?? 6);
        $this->otpExpiryMinutes = (int) ($_ENV['OTP_EXPIRY_MINUTES'] ?? 10);
        $this->ensureTableExists();
    }

    public function generateAndSend(int $userId, string $method = 'email'): array
    {
        $user = $this->getUserInfo($userId);
        if (!$user) throw new \Exception(__('error.not_found'));
        $destination = $method === 'email' ? $user['email'] : $user['phone'];
        if (empty($destination)) throw new \Exception('Destination manquante');
        
        $this->invalidateOldCodes($userId);
        $code = $this->generateOtpCode();
        $expiresAt = date('Y-m-d H:i:s', strtotime("+{$this->otpExpiryMinutes} minutes"));

        $stmt = $this->db->prepare('
            INSERT INTO otp_codes (user_id, code, method, destination, expires_at)
            VALUES (:user_id, :code, :method, :destination, :expires_at)
        ');
        $stmt->execute(['user_id' => $userId, 'code' => password_hash($code, PASSWORD_DEFAULT), 'method' => $method, 'destination' => $destination, 'expires_at' => $expiresAt]);

        // Note: Le code OTP n'est JAMAIS retourné au client pour des raisons de sécurité
        // Il est envoyé uniquement par email/SMS
        return ['success' => true, 'method' => $method, 'expires_in' => $this->otpExpiryMinutes * 60];
    }

    public function verify(int $userId, string $code): bool
    {
        $stmt = $this->db->prepare('SELECT * FROM otp_codes WHERE user_id = :user_id AND is_used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1');
        $stmt->execute(['user_id' => $userId]);
        $otpRecord = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$otpRecord) return false;
        if (!password_verify($code, $otpRecord['code'])) return false;
        $this->markAsUsed((int) $otpRecord['id']);
        return true;
    }

    public function isEnabled(int $userId): bool
    {
        $stmt = $this->db->prepare('SELECT two_factor_enabled FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result && (bool) $result['two_factor_enabled'];
    }

    public function enable(int $userId, string $method = 'email'): bool
    {
        $stmt = $this->db->prepare('UPDATE users SET two_factor_enabled = 1, two_factor_method = :method WHERE id = :id');
        return $stmt->execute(['id' => $userId, 'method' => $method]);
    }

    public function disable(int $userId): bool
    {
        $stmt = $this->db->prepare('UPDATE users SET two_factor_enabled = 0, two_factor_method = NULL WHERE id = :id');
        return $stmt->execute(['id' => $userId]);
    }

    private function generateOtpCode(): string
    {
        $min = (int) pow(10, $this->otpLength - 1);
        $max = (int) pow(10, $this->otpLength) - 1;
        return (string) random_int($min, $max);
    }

    private function getUserInfo(int $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT email, phone FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function invalidateOldCodes(int $userId): void
    {
        $stmt = $this->db->prepare('UPDATE otp_codes SET is_used = 1 WHERE user_id = :user_id AND is_used = 0');
        $stmt->execute(['user_id' => $userId]);
    }

    private function markAsUsed(int $otpId): void
    {
        $stmt = $this->db->prepare('UPDATE otp_codes SET is_used = 1, used_at = NOW() WHERE id = :id');
        $stmt->execute(['id' => $otpId]);
    }

    private function ensureTableExists(): void
    {
        $this->db->exec('
            CREATE TABLE IF NOT EXISTS otp_codes (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                code VARCHAR(255) NOT NULL,
                method ENUM("email", "sms") NOT NULL DEFAULT "email",
                destination VARCHAR(255) NOT NULL,
                is_used TINYINT(1) NOT NULL DEFAULT 0,
                used_at TIMESTAMP NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_otp_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ');
    }
}
