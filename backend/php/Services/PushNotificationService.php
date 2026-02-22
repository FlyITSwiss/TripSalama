<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

/**
 * Service de notifications push (FCM - Firebase Cloud Messaging)
 */
class PushNotificationService
{
    private PDO $db;
    private ?string $fcmServerKey;

    private const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->fcmServerKey = $_ENV['FCM_SERVER_KEY'] ?? null;
        $this->ensureTableExists();
    }

    /**
     * Enregistrer un token de device pour un utilisateur
     *
     * @param int $userId ID utilisateur
     * @param string $token Token FCM
     * @param string $platform Plateforme (ios, android, web)
     * @return bool Succès
     */
    public function registerToken(int $userId, string $token, string $platform = 'web'): bool
    {
        $stmt = $this->db->prepare('
            INSERT INTO push_tokens (user_id, token, platform)
            VALUES (:user_id, :token, :platform)
            ON DUPLICATE KEY UPDATE
                token = :token2,
                platform = :platform2,
                is_active = 1,
                updated_at = NOW()
        ');

        return $stmt->execute([
            'user_id' => $userId,
            'token' => $token,
            'platform' => $platform,
            'token2' => $token,
            'platform2' => $platform,
        ]);
    }

    /**
     * Supprimer un token (déconnexion)
     *
     * @param int $userId ID utilisateur
     * @param string|null $token Token spécifique ou tous
     * @return bool Succès
     */
    public function unregisterToken(int $userId, ?string $token = null): bool
    {
        if ($token !== null) {
            $stmt = $this->db->prepare('
                UPDATE push_tokens SET is_active = 0 WHERE user_id = :user_id AND token = :token
            ');
            return $stmt->execute(['user_id' => $userId, 'token' => $token]);
        }

        $stmt = $this->db->prepare('
            UPDATE push_tokens SET is_active = 0 WHERE user_id = :user_id
        ');
        return $stmt->execute(['user_id' => $userId]);
    }

    /**
     * Envoyer une notification à un utilisateur
     *
     * @param int $userId ID utilisateur
     * @param string $title Titre
     * @param string $body Corps du message
     * @param array $data Données supplémentaires
     * @return array Résultat de l'envoi
     */
    public function sendToUser(int $userId, string $title, string $body, array $data = []): array
    {
        $tokens = $this->getUserTokens($userId);

        if (empty($tokens)) {
            return ['success' => false, 'error' => 'No tokens found'];
        }

        $results = [];
        foreach ($tokens as $token) {
            $results[] = $this->send($token, $title, $body, $data);
        }

        return [
            'success' => true,
            'sent' => count($results),
            'results' => $results,
        ];
    }

    /**
     * Envoyer une notification à plusieurs utilisateurs
     *
     * @param array $userIds Liste des IDs utilisateurs
     * @param string $title Titre
     * @param string $body Corps du message
     * @param array $data Données supplémentaires
     * @return array Résultat
     */
    public function sendToUsers(array $userIds, string $title, string $body, array $data = []): array
    {
        $stmt = $this->db->prepare('
            SELECT DISTINCT token FROM push_tokens
            WHERE user_id IN (' . implode(',', array_map('intval', $userIds)) . ')
            AND is_active = 1
        ');
        $stmt->execute();
        $tokens = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($tokens)) {
            return ['success' => false, 'error' => 'No tokens found'];
        }

        return $this->sendToMultiple($tokens, $title, $body, $data);
    }

    /**
     * Envoyer une notification pour une course
     *
     * @param int $rideId ID de la course
     * @param string $event Type d'événement
     * @param array $data Données
     * @return array Résultat
     */
    public function sendRideNotification(int $rideId, string $event, array $data = []): array
    {
        // Récupérer les participants de la course
        $stmt = $this->db->prepare('
            SELECT passenger_id, driver_id FROM rides WHERE id = :ride_id
        ');
        $stmt->execute(['ride_id' => $rideId]);
        $ride = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$ride) {
            return ['success' => false, 'error' => 'Ride not found'];
        }

        // Définir le titre et le corps selon l'événement
        $notification = $this->getRideNotificationContent($event, $data);

        // Envoyer aux deux parties
        $userIds = array_filter([
            $ride['passenger_id'],
            $ride['driver_id'],
        ]);

        return $this->sendToUsers($userIds, $notification['title'], $notification['body'], [
            'ride_id' => $rideId,
            'event' => $event,
            ...$data,
        ]);
    }

    /**
     * Obtenir le contenu de notification pour un événement de course
     */
    private function getRideNotificationContent(string $event, array $data): array
    {
        $content = [
            'ride_accepted' => [
                'title' => __('msg.ride_accepted'),
                'body' => __('ride.driver_arriving'),
            ],
            'driver_arriving' => [
                'title' => __('ride.driver_arriving'),
                'body' => sprintf(__('tracking.eta'), $data['eta'] ?? '5 min'),
            ],
            'driver_arrived' => [
                'title' => __('demo.driver_arrived'),
                'body' => __('demo.driver_waiting'),
            ],
            'ride_started' => [
                'title' => __('ride.in_progress'),
                'body' => __('demo.trip_in_progress'),
            ],
            'ride_completed' => [
                'title' => __('ride.completed'),
                'body' => __('ride.rate'),
            ],
            'ride_cancelled' => [
                'title' => __('ride.cancelled'),
                'body' => __('msg.ride_cancelled'),
            ],
        ];

        return $content[$event] ?? [
            'title' => 'TripSalama',
            'body' => $event,
        ];
    }

    /**
     * Envoyer une notification push via FCM
     *
     * @param string $token Token FCM
     * @param string $title Titre
     * @param string $body Corps
     * @param array $data Données
     * @return array Résultat
     */
    private function send(string $token, string $title, string $body, array $data = []): array
    {
        if ($this->fcmServerKey === null) {
            // Mode dev : simuler l'envoi
            app_log('info', "Push notification (simulated): $title - $body to $token");
            return ['success' => true, 'simulated' => true];
        }

        $payload = [
            'to' => $token,
            'notification' => [
                'title' => $title,
                'body' => $body,
                'icon' => '/assets/images/icon-192.png',
                'badge' => '/assets/images/badge.png',
                'click_action' => 'OPEN_APP',
            ],
            'data' => $data,
            'priority' => 'high',
            'time_to_live' => 3600,
        ];

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => self::FCM_URL,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: key=' . $this->fcmServerKey,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            app_log('error', "FCM error ($httpCode): $response");
            return ['success' => false, 'error' => $response];
        }

        $result = json_decode($response, true);

        // Supprimer les tokens invalides
        if (isset($result['results'])) {
            foreach ($result['results'] as $r) {
                if (isset($r['error']) && in_array($r['error'], ['NotRegistered', 'InvalidRegistration'])) {
                    $this->invalidateToken($token);
                }
            }
        }

        return ['success' => true, 'result' => $result];
    }

    /**
     * Envoyer à plusieurs tokens
     */
    private function sendToMultiple(array $tokens, string $title, string $body, array $data = []): array
    {
        // FCM limite à 1000 tokens par requête
        $chunks = array_chunk($tokens, 1000);
        $results = [];

        foreach ($chunks as $chunk) {
            $payload = [
                'registration_ids' => $chunk,
                'notification' => [
                    'title' => $title,
                    'body' => $body,
                    'icon' => '/assets/images/icon-192.png',
                ],
                'data' => $data,
                'priority' => 'high',
            ];

            if ($this->fcmServerKey === null) {
                $results[] = ['success' => true, 'simulated' => true, 'count' => count($chunk)];
                continue;
            }

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => self::FCM_URL,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => [
                    'Authorization: key=' . $this->fcmServerKey,
                    'Content-Type: application/json',
                ],
                CURLOPT_POSTFIELDS => json_encode($payload),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 30,
            ]);

            $response = curl_exec($ch);
            curl_close($ch);

            $results[] = json_decode($response, true) ?? ['error' => 'Parse error'];
        }

        return [
            'success' => true,
            'batches' => count($chunks),
            'results' => $results,
        ];
    }

    /**
     * Obtenir les tokens d'un utilisateur
     */
    private function getUserTokens(int $userId): array
    {
        $stmt = $this->db->prepare('
            SELECT token FROM push_tokens WHERE user_id = :user_id AND is_active = 1
        ');
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    /**
     * Invalider un token
     */
    private function invalidateToken(string $token): void
    {
        $stmt = $this->db->prepare('UPDATE push_tokens SET is_active = 0 WHERE token = :token');
        $stmt->execute(['token' => $token]);
    }

    /**
     * Créer la table si elle n'existe pas
     */
    private function ensureTableExists(): void
    {
        $this->db->exec('
            CREATE TABLE IF NOT EXISTS push_tokens (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                token VARCHAR(500) NOT NULL,
                platform ENUM("ios", "android", "web") NOT NULL DEFAULT "web",
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                UNIQUE KEY uk_push_tokens_token (token),
                INDEX idx_push_tokens_user (user_id),
                INDEX idx_push_tokens_active (is_active),

                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ');
    }
}
