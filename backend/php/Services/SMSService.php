<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

/**
 * Service SMS via Twilio
 * Gestion des envois SMS avec rate limiting et logs
 */
class SMSService
{
    private PDO $db;
    private ?string $accountSid;
    private ?string $authToken;
    private ?string $fromNumber;
    private bool $isConfigured;
    private ?LoggingService $logger = null;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->accountSid = $_ENV['TWILIO_ACCOUNT_SID'] ?? null;
        $this->authToken = $_ENV['TWILIO_AUTH_TOKEN'] ?? null;
        $this->fromNumber = $_ENV['TWILIO_PHONE_NUMBER'] ?? null;
        $this->isConfigured = !empty($this->accountSid) && !empty($this->authToken) && !empty($this->fromNumber);

        if (class_exists(LoggingService::class)) {
            $this->logger = LoggingService::getInstance();
        }
    }

    /**
     * Vérifier si le service est configuré
     */
    public function isConfigured(): bool
    {
        return $this->isConfigured;
    }

    /**
     * Envoyer un SMS
     */
    public function send(string $to, string $message): array
    {
        // Normaliser le numéro
        $to = $this->normalizePhoneNumber($to);

        if (!$this->isConfigured) {
            $this->log('warning', 'SMS not configured, mock send', ['to' => $to, 'message' => $message]);
            return [
                'success' => true,
                'mock' => true,
                'message_sid' => 'MOCK_' . bin2hex(random_bytes(16)),
                'to' => $to,
            ];
        }

        // Rate limiting: max 5 SMS par numéro par heure
        if ($this->isRateLimited($to)) {
            $this->log('warning', 'SMS rate limited', ['to' => $to]);
            return [
                'success' => false,
                'error' => 'rate_limited',
                'message' => 'Trop de SMS envoyés à ce numéro',
            ];
        }

        try {
            $url = "https://api.twilio.com/2010-04-01/Accounts/{$this->accountSid}/Messages.json";

            $data = [
                'To' => $to,
                'From' => $this->fromNumber,
                'Body' => $message,
            ];

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query($data),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_USERPWD => "{$this->accountSid}:{$this->authToken}",
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
                CURLOPT_TIMEOUT => 30,
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                throw new \Exception("cURL error: {$error}");
            }

            $result = json_decode($response, true);

            if ($httpCode >= 200 && $httpCode < 300) {
                $this->recordSMS($to, $message, $result['sid'] ?? 'unknown');
                $this->log('info', 'SMS sent successfully', [
                    'to' => $to,
                    'sid' => $result['sid'] ?? 'unknown',
                ]);

                return [
                    'success' => true,
                    'message_sid' => $result['sid'] ?? null,
                    'to' => $to,
                    'status' => $result['status'] ?? 'sent',
                ];
            }

            $errorMessage = $result['message'] ?? 'Unknown error';
            $this->log('error', 'SMS send failed', [
                'to' => $to,
                'error' => $errorMessage,
                'http_code' => $httpCode,
            ]);

            return [
                'success' => false,
                'error' => 'twilio_error',
                'message' => $errorMessage,
                'http_code' => $httpCode,
            ];
        } catch (\Exception $e) {
            $this->log('error', 'SMS exception', [
                'to' => $to,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'exception',
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Envoyer un code PIN pour vérification de course
     */
    public function sendRidePin(string $to, string $pin, string $driverName): array
    {
        $message = "TripSalama: Votre code de vérification est {$pin}. "
            . "Communiquez-le à votre conductrice {$driverName} pour démarrer la course. "
            . "Ne partagez jamais ce code par téléphone.";

        return $this->send($to, $message);
    }

    /**
     * Envoyer une alerte SOS
     */
    public function sendSOSAlert(string $to, string $userName, string $location, string $trackingUrl): array
    {
        $message = "⚠️ ALERTE SOS TripSalama: {$userName} a déclenché une alerte d'urgence. "
            . "Position: {$location}. "
            . "Suivez en direct: {$trackingUrl}";

        return $this->send($to, $message);
    }

    /**
     * Envoyer un OTP (2FA)
     */
    public function sendOTP(string $to, string $code): array
    {
        $message = "TripSalama: Votre code de vérification est {$code}. "
            . "Il expire dans 10 minutes. Ne le partagez jamais.";

        return $this->send($to, $message);
    }

    /**
     * Normaliser un numéro de téléphone
     */
    private function normalizePhoneNumber(string $phone): string
    {
        // Retirer tous les caractères non numériques sauf +
        $phone = preg_replace('/[^\d+]/', '', $phone);

        // Si commence par 0, ajouter +33 (France) ou +212 (Maroc)
        if (str_starts_with($phone, '06') || str_starts_with($phone, '07')) {
            $phone = '+33' . substr($phone, 1);
        } elseif (str_starts_with($phone, '00')) {
            $phone = '+' . substr($phone, 2);
        } elseif (!str_starts_with($phone, '+')) {
            $phone = '+' . $phone;
        }

        return $phone;
    }

    /**
     * Vérifier le rate limiting
     */
    private function isRateLimited(string $phone): bool
    {
        $stmt = $this->db->prepare('
            SELECT COUNT(*) FROM sms_logs
            WHERE phone_hash = :hash
            AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ');
        $stmt->execute(['hash' => hash('sha256', $phone)]);
        $count = (int) $stmt->fetchColumn();

        return $count >= 5;
    }

    /**
     * Enregistrer un SMS envoyé
     */
    private function recordSMS(string $phone, string $message, string $sid): void
    {
        $this->ensureTableExists();

        $stmt = $this->db->prepare('
            INSERT INTO sms_logs (phone_hash, message_type, twilio_sid, created_at)
            VALUES (:hash, :type, :sid, NOW())
        ');
        $stmt->execute([
            'hash' => hash('sha256', $phone),
            'type' => $this->detectMessageType($message),
            'sid' => $sid,
        ]);
    }

    /**
     * Détecter le type de message
     */
    private function detectMessageType(string $message): string
    {
        if (str_contains($message, 'code de vérification')) {
            return str_contains($message, 'conductrice') ? 'ride_pin' : 'otp';
        }
        if (str_contains($message, 'ALERTE SOS')) {
            return 'sos';
        }
        return 'general';
    }

    /**
     * Créer la table si nécessaire
     */
    private function ensureTableExists(): void
    {
        $this->db->exec('
            CREATE TABLE IF NOT EXISTS sms_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                phone_hash VARCHAR(64) NOT NULL,
                message_type VARCHAR(20) NOT NULL DEFAULT "general",
                twilio_sid VARCHAR(50) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_phone_time (phone_hash, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ');
    }

    /**
     * Logger un message
     */
    private function log(string $level, string $message, array $context = []): void
    {
        if ($this->logger) {
            match ($level) {
                'info' => $this->logger->info($message, $context),
                'warning' => $this->logger->warning($message, $context),
                'error' => $this->logger->error($message, $context),
                default => $this->logger->debug($message, $context),
            };
        } else {
            app_log($level, "[SMS] {$message}", $context);
        }
    }

    /**
     * Obtenir les statistiques SMS
     */
    public function getStats(?string $date = null): array
    {
        $this->ensureTableExists();
        $date = $date ?? date('Y-m-d');

        $stmt = $this->db->prepare('
            SELECT
                message_type,
                COUNT(*) as count
            FROM sms_logs
            WHERE DATE(created_at) = :date
            GROUP BY message_type
        ');
        $stmt->execute(['date' => $date]);

        $stats = [
            'date' => $date,
            'total' => 0,
            'by_type' => [],
        ];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $stats['by_type'][$row['message_type']] = (int) $row['count'];
            $stats['total'] += (int) $row['count'];
        }

        return $stats;
    }
}
