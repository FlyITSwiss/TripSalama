<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;

/**
 * Service SOS / Urgence
 * Gestion des alertes d'urgence, contacts, partage de trajet
 */
class SOSService
{
    private PDO $db;
    private ?PushNotificationService $pushService = null;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->ensureTablesExist();

        // Charger le service de notifications si disponible
        if (class_exists(PushNotificationService::class)) {
            $this->pushService = new PushNotificationService($db);
        }
    }

    /**
     * Déclencher une alerte SOS
     */
    public function triggerSOS(
        int $userId,
        float $latitude,
        float $longitude,
        ?int $rideId = null,
        string $alertType = 'manual',
        ?string $message = null
    ): array {
        $this->db->beginTransaction();

        try {
            // Créer l'alerte
            $stmt = $this->db->prepare('
                INSERT INTO sos_alerts (
                    user_id, ride_id, alert_type, status,
                    latitude, longitude, message, created_at
                ) VALUES (
                    :user_id, :ride_id, :alert_type, "active",
                    :latitude, :longitude, :message, NOW()
                )
            ');
            $stmt->execute([
                'user_id' => $userId,
                'ride_id' => $rideId,
                'alert_type' => $alertType,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'message' => $message,
            ]);
            $alertId = (int) $this->db->lastInsertId();

            // Récupérer l'adresse approximative
            $address = $this->reverseGeocode($latitude, $longitude);
            if ($address) {
                $stmt = $this->db->prepare('UPDATE sos_alerts SET address = :address WHERE id = :id');
                $stmt->execute(['id' => $alertId, 'address' => $address]);
            }

            // Notifier les contacts d'urgence
            $contacts = $this->getEmergencyContacts($userId);
            $notifiedContacts = [];

            foreach ($contacts as $contact) {
                if ($contact['notify_on_sos']) {
                    $this->notifyContact($contact, $userId, $alertId, $latitude, $longitude, $address);
                    $notifiedContacts[] = [
                        'name' => $contact['name'],
                        'phone' => $contact['phone'],
                        'notified_at' => date('Y-m-d H:i:s'),
                    ];
                }
            }

            // Sauvegarder les contacts notifiés
            $stmt = $this->db->prepare('
                UPDATE sos_alerts SET contacts_notified = :contacts WHERE id = :id
            ');
            $stmt->execute([
                'id' => $alertId,
                'contacts' => json_encode($notifiedContacts),
            ]);

            // Si course active, notifier la conductrice ou passagère
            if ($rideId) {
                $this->notifyRideParticipant($rideId, $userId, $alertId);
            }

            $this->db->commit();

            return [
                'success' => true,
                'alert_id' => $alertId,
                'contacts_notified' => count($notifiedContacts),
                'address' => $address,
            ];
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Annuler/Résoudre une alerte SOS
     */
    public function resolveAlert(
        int $alertId,
        int $resolvedBy,
        string $status = 'resolved',
        ?string $notes = null
    ): bool {
        $stmt = $this->db->prepare('
            UPDATE sos_alerts
            SET status = :status,
                resolved_by = :resolved_by,
                resolved_at = NOW(),
                resolution_notes = :notes,
                updated_at = NOW()
            WHERE id = :id
        ');

        return $stmt->execute([
            'id' => $alertId,
            'status' => $status,
            'resolved_by' => $resolvedBy,
            'notes' => $notes,
        ]);
    }

    /**
     * Obtenir l'alerte active d'un utilisateur
     */
    public function getActiveAlert(int $userId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT sa.*, r.pickup_address, r.dropoff_address
            FROM sos_alerts sa
            LEFT JOIN rides r ON sa.ride_id = r.id
            WHERE sa.user_id = :user_id
            AND sa.status = "active"
            ORDER BY sa.created_at DESC
            LIMIT 1
        ');
        $stmt->execute(['user_id' => $userId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    /**
     * Ajouter un contact d'urgence
     */
    public function addEmergencyContact(int $userId, array $data): int
    {
        // Vérifier le nombre de contacts (max 5)
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM emergency_contacts WHERE user_id = :user_id');
        $stmt->execute(['user_id' => $userId]);
        if ($stmt->fetchColumn() >= 5) {
            throw new \Exception(__('sos.max_contacts_reached'));
        }

        // Si c'est le premier ou marqué primaire, ajuster les autres
        $isPrimary = (bool) ($data['is_primary'] ?? false);
        if ($isPrimary) {
            $this->db->prepare('UPDATE emergency_contacts SET is_primary = 0 WHERE user_id = :user_id')
                ->execute(['user_id' => $userId]);
        }

        $stmt = $this->db->prepare('
            INSERT INTO emergency_contacts (
                user_id, name, phone, email, relationship,
                is_primary, notify_on_ride_start, notify_on_sos
            ) VALUES (
                :user_id, :name, :phone, :email, :relationship,
                :is_primary, :notify_on_ride_start, :notify_on_sos
            )
        ');

        $stmt->execute([
            'user_id' => $userId,
            'name' => $data['name'],
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
            'relationship' => $data['relationship'] ?? null,
            'is_primary' => $isPrimary ? 1 : 0,
            'notify_on_ride_start' => ($data['notify_on_ride_start'] ?? false) ? 1 : 0,
            'notify_on_sos' => ($data['notify_on_sos'] ?? true) ? 1 : 0,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Obtenir les contacts d'urgence
     */
    public function getEmergencyContacts(int $userId): array
    {
        $stmt = $this->db->prepare('
            SELECT * FROM emergency_contacts
            WHERE user_id = :user_id
            ORDER BY is_primary DESC, created_at ASC
        ');
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Supprimer un contact d'urgence
     */
    public function removeEmergencyContact(int $userId, int $contactId): bool
    {
        $stmt = $this->db->prepare('
            DELETE FROM emergency_contacts
            WHERE id = :id AND user_id = :user_id
        ');

        return $stmt->execute([
            'id' => $contactId,
            'user_id' => $userId,
        ]);
    }

    /**
     * Mettre à jour un contact d'urgence
     */
    public function updateEmergencyContact(int $userId, int $contactId, array $data): bool
    {
        $fields = [];
        $params = ['id' => $contactId, 'user_id' => $userId];

        foreach (['name', 'phone', 'email', 'relationship'] as $field) {
            if (isset($data[$field])) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $data[$field];
            }
        }

        foreach (['is_primary', 'notify_on_ride_start', 'notify_on_sos'] as $field) {
            if (isset($data[$field])) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $data[$field] ? 1 : 0;
            }
        }

        if (empty($fields)) {
            return false;
        }

        // Si on définit comme primaire, retirer des autres
        if (isset($data['is_primary']) && $data['is_primary']) {
            $this->db->prepare('UPDATE emergency_contacts SET is_primary = 0 WHERE user_id = :user_id')
                ->execute(['user_id' => $userId]);
        }

        $sql = 'UPDATE emergency_contacts SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = :id AND user_id = :user_id';

        return $this->db->prepare($sql)->execute($params);
    }

    /**
     * Partager un trajet en temps réel
     */
    public function shareRide(int $rideId, int $userId, array $shareWith): array
    {
        $token = bin2hex(random_bytes(32));

        $stmt = $this->db->prepare('
            INSERT INTO ride_shares (
                ride_id, user_id, share_token,
                shared_with_name, shared_with_phone, shared_with_email,
                expires_at
            ) VALUES (
                :ride_id, :user_id, :token,
                :name, :phone, :email,
                DATE_ADD(NOW(), INTERVAL 24 HOUR)
            )
        ');

        $stmt->execute([
            'ride_id' => $rideId,
            'user_id' => $userId,
            'token' => $token,
            'name' => $shareWith['name'] ?? null,
            'phone' => $shareWith['phone'] ?? null,
            'email' => $shareWith['email'] ?? null,
        ]);

        $shareId = (int) $this->db->lastInsertId();
        $shareUrl = config('url') . '/track/' . $token;

        // Envoyer la notification au contact
        if (!empty($shareWith['phone'])) {
            $this->sendSMS(
                $shareWith['phone'],
                sprintf(
                    __('sos.share_ride_sms'),
                    $shareWith['name'] ?? 'Un proche',
                    $shareUrl
                )
            );
        }

        return [
            'share_id' => $shareId,
            'share_token' => $token,
            'share_url' => $shareUrl,
        ];
    }

    /**
     * Obtenir les infos de partage de trajet (public)
     */
    public function getSharedRide(string $token): ?array
    {
        $stmt = $this->db->prepare('
            SELECT rs.*, r.*, u.first_name as user_first_name,
                   d.first_name as driver_first_name,
                   v.brand as vehicle_brand, v.model as vehicle_model,
                   v.color as vehicle_color, v.license_plate
            FROM ride_shares rs
            JOIN rides r ON rs.ride_id = r.id
            JOIN users u ON rs.user_id = u.id
            LEFT JOIN users d ON r.driver_id = d.id
            LEFT JOIN vehicles v ON r.vehicle_id = v.id
            WHERE rs.share_token = :token
            AND rs.is_active = 1
            AND (rs.expires_at IS NULL OR rs.expires_at > NOW())
        ');
        $stmt->execute(['token' => $token]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($result) {
            // Incrémenter le compteur de vues
            $this->db->prepare('
                UPDATE ride_shares
                SET view_count = view_count + 1, last_viewed_at = NOW()
                WHERE share_token = :token
            ')->execute(['token' => $token]);

            // Obtenir la dernière position
            $stmt = $this->db->prepare('
                SELECT lat, lng, recorded_at
                FROM ride_positions
                WHERE ride_id = :ride_id
                ORDER BY recorded_at DESC
                LIMIT 1
            ');
            $stmt->execute(['ride_id' => $result['ride_id']]);
            $result['current_position'] = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        return $result ?: null;
    }

    /**
     * Arrêter le partage d'un trajet
     */
    public function stopShareRide(int $shareId, int $userId): bool
    {
        $stmt = $this->db->prepare('
            UPDATE ride_shares
            SET is_active = 0
            WHERE id = :id AND user_id = :user_id
        ');

        return $stmt->execute([
            'id' => $shareId,
            'user_id' => $userId,
        ]);
    }

    /**
     * Détecter une anomalie (arrêt suspect, déviation)
     */
    public function checkForAnomalies(int $rideId): ?array
    {
        // Obtenir les dernières positions
        $stmt = $this->db->prepare('
            SELECT lat, lng, recorded_at
            FROM ride_positions
            WHERE ride_id = :ride_id
            ORDER BY recorded_at DESC
            LIMIT 10
        ');
        $stmt->execute(['ride_id' => $rideId]);
        $positions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($positions) < 2) {
            return null;
        }

        // Vérifier arrêt prolongé (même position depuis 5+ minutes)
        $latest = $positions[0];
        $previousSimilar = 0;

        foreach (array_slice($positions, 1) as $pos) {
            $distance = $this->calculateDistance(
                (float) $latest['lat'],
                (float) $latest['lng'],
                (float) $pos['lat'],
                (float) $pos['lng']
            );

            // Si moins de 50m de différence
            if ($distance < 0.05) {
                $previousSimilar++;
            } else {
                break;
            }
        }

        // Si 5+ positions similaires (= ~5 minutes d'arrêt)
        if ($previousSimilar >= 5) {
            return [
                'type' => 'suspicious_stop',
                'message' => __('sos.suspicious_stop_detected'),
                'position' => [
                    'lat' => (float) $latest['lat'],
                    'lng' => (float) $latest['lng'],
                ],
                'duration_minutes' => $previousSimilar,
            ];
        }

        return null;
    }

    /**
     * Notifier un contact
     */
    private function notifyContact(
        array $contact,
        int $userId,
        int $alertId,
        float $lat,
        float $lng,
        ?string $address
    ): void {
        // Obtenir les infos utilisateur
        $stmt = $this->db->prepare('SELECT first_name, last_name FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        $userName = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
        $mapUrl = "https://www.google.com/maps?q={$lat},{$lng}";

        // SMS d'urgence
        if (!empty($contact['phone'])) {
            $message = sprintf(
                __('sos.emergency_sms'),
                $userName,
                $address ?? "Lat: {$lat}, Lng: {$lng}",
                $mapUrl
            );
            $this->sendSMS($contact['phone'], $message);
        }

        // Email d'urgence
        if (!empty($contact['email'])) {
            $this->sendEmergencyEmail($contact['email'], $userName, $lat, $lng, $address);
        }
    }

    /**
     * Notifier l'autre participant de la course
     */
    private function notifyRideParticipant(int $rideId, int $alertUserId, int $alertId): void
    {
        $stmt = $this->db->prepare('
            SELECT passenger_id, driver_id FROM rides WHERE id = :id
        ');
        $stmt->execute(['id' => $rideId]);
        $ride = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$ride) {
            return;
        }

        // Notifier l'autre personne
        $notifyUserId = (int) $ride['passenger_id'] === $alertUserId
            ? (int) $ride['driver_id']
            : (int) $ride['passenger_id'];

        if ($notifyUserId && $this->pushService) {
            $this->pushService->sendToUser(
                $notifyUserId,
                __('sos.alert_title'),
                __('sos.alert_participant_message'),
                [
                    'type' => 'sos_alert',
                    'alert_id' => $alertId,
                    'ride_id' => $rideId,
                ]
            );
        }
    }

    /**
     * Envoyer un SMS (mock - à implémenter avec Twilio)
     */
    private function sendSMS(string $phone, string $message): void
    {
        // TODO: Intégrer Twilio
        app_log('info', "SOS SMS to {$phone}: {$message}");
    }

    /**
     * Envoyer un email d'urgence
     */
    private function sendEmergencyEmail(
        string $email,
        string $userName,
        float $lat,
        float $lng,
        ?string $address
    ): void {
        // TODO: Implémenter l'envoi d'email
        app_log('info', "SOS Email to {$email} for {$userName}");
    }

    /**
     * Reverse geocoding (obtenir adresse depuis coordonnées)
     */
    private function reverseGeocode(float $lat, float $lng): ?string
    {
        $url = "https://nominatim.openstreetmap.org/reverse?format=json&lat={$lat}&lon={$lng}&zoom=18";

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERAGENT => 'TripSalama/1.0',
            CURLOPT_TIMEOUT => 5,
        ]);

        $response = curl_exec($ch);
        curl_close($ch);

        if ($response) {
            $data = json_decode($response, true);
            return $data['display_name'] ?? null;
        }

        return null;
    }

    /**
     * Calculer la distance entre deux points (km)
     */
    private function calculateDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371; // km

        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLng / 2) * sin($dLng / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    /**
     * S'assurer que les tables existent
     */
    private function ensureTablesExist(): void
    {
        // Les tables sont créées par la migration 007
    }
}
