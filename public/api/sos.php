<?php

declare(strict_types=1);

/**
 * TripSalama - API SOS / Urgence Endpoint
 * Gestion des alertes d'urgence, contacts, partage de trajet
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

requireRateLimit('api_request');

try {
    require_once BACKEND_PATH . '/Services/SOSService.php';

    $db = getDbConnection();
    $sosService = new \TripSalama\Services\SOSService($db);

    switch ($action) {
        /**
         * Déclencher une alerte SOS
         * POST /api/sos.php?action=trigger
         */
        case 'trigger':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $lat = (float) ($data['latitude'] ?? 0);
            $lng = (float) ($data['longitude'] ?? 0);
            $rideId = isset($data['ride_id']) ? (int) $data['ride_id'] : null;
            $message = $data['message'] ?? null;

            requireValidCoordinates($lat, $lng);

            $result = $sosService->triggerSOS($userId, $lat, $lng, $rideId, 'manual', $message);

            successResponse($result, __('sos.alert_sent'));
            break;

        /**
         * Annuler/Résoudre une alerte SOS
         * PUT /api/sos.php?action=resolve
         */
        case 'resolve':
            if ($method !== 'PUT') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $alertId = (int) ($data['alert_id'] ?? 0);
            $status = $data['status'] ?? 'false_alarm'; // resolved, false_alarm
            $notes = $data['notes'] ?? null;

            if ($alertId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $sosService->resolveAlert($alertId, $userId, $status, $notes);

            successResponse(null, __('sos.alert_resolved'));
            break;

        /**
         * Obtenir l'alerte active
         * GET /api/sos.php?action=active
         */
        case 'active':
            requireAuth();
            $userId = (int) current_user()['id'];

            $alert = $sosService->getActiveAlert($userId);

            successResponse(['alert' => $alert]);
            break;

        /**
         * Obtenir les contacts d'urgence
         * GET /api/sos.php?action=contacts
         */
        case 'contacts':
            requireAuth();
            $userId = (int) current_user()['id'];

            $contacts = $sosService->getEmergencyContacts($userId);

            successResponse(['contacts' => $contacts]);
            break;

        /**
         * Ajouter un contact d'urgence
         * POST /api/sos.php?action=add-contact
         */
        case 'add-contact':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];

            if (empty($data['name']) || empty($data['phone'])) {
                errorResponse(__('validation.required_field'), 400);
            }

            $contactId = $sosService->addEmergencyContact($userId, $data);

            successResponse(['contact_id' => $contactId], __('sos.contact_added'));
            break;

        /**
         * Mettre à jour un contact d'urgence
         * PUT /api/sos.php?action=update-contact
         */
        case 'update-contact':
            if ($method !== 'PUT') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $contactId = (int) ($data['contact_id'] ?? 0);

            if ($contactId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $sosService->updateEmergencyContact($userId, $contactId, $data);

            successResponse(null, __('msg.updated'));
            break;

        /**
         * Supprimer un contact d'urgence
         * DELETE /api/sos.php?action=remove-contact
         */
        case 'remove-contact':
            if ($method !== 'DELETE') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $contactId = (int) ($data['contact_id'] ?? 0);

            if ($contactId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $sosService->removeEmergencyContact($userId, $contactId);

            successResponse(null, __('sos.contact_removed'));
            break;

        /**
         * Partager un trajet
         * POST /api/sos.php?action=share-ride
         */
        case 'share-ride':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $rideId = (int) ($data['ride_id'] ?? 0);

            if ($rideId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $shareWith = [
                'name' => $data['name'] ?? null,
                'phone' => $data['phone'] ?? null,
                'email' => $data['email'] ?? null,
            ];

            $result = $sosService->shareRide($rideId, $userId, $shareWith);

            successResponse($result, __('sos.ride_shared'));
            break;

        /**
         * Arrêter le partage d'un trajet
         * PUT /api/sos.php?action=stop-share
         */
        case 'stop-share':
            if ($method !== 'PUT') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $shareId = (int) ($data['share_id'] ?? 0);

            if ($shareId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $sosService->stopShareRide($shareId, $userId);

            successResponse(null, __('sos.share_stopped'));
            break;

        /**
         * Obtenir les infos de partage (public - pas d'auth)
         * GET /api/sos.php?action=shared-ride&token=xxx
         */
        case 'shared-ride':
            $token = getParam('token', '', 'string');

            if (empty($token)) {
                errorResponse(__('validation.required_field'), 400);
            }

            $ride = $sosService->getSharedRide($token);

            if (!$ride) {
                errorResponse(__('sos.share_not_found'), 404);
            }

            // Filtrer les données sensibles
            $publicData = [
                'passenger_name' => $ride['user_first_name'],
                'driver_name' => $ride['driver_first_name'] ?? null,
                'pickup_address' => $ride['pickup_address'],
                'dropoff_address' => $ride['dropoff_address'],
                'status' => $ride['status'],
                'vehicle' => $ride['vehicle_brand']
                    ? "{$ride['vehicle_brand']} {$ride['vehicle_model']} - {$ride['vehicle_color']}"
                    : null,
                'license_plate' => $ride['license_plate'] ?? null,
                'current_position' => $ride['current_position'],
                'started_at' => $ride['started_at'] ?? null,
            ];

            successResponse(['ride' => $publicData]);
            break;

        /**
         * Vérifier les anomalies d'une course
         * GET /api/sos.php?action=check-anomalies&ride_id=X
         */
        case 'check-anomalies':
            requireAuth();
            $rideId = (int) getParam('ride_id', 0, 'int');

            if ($rideId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $anomaly = $sosService->checkForAnomalies($rideId);

            successResponse(['anomaly' => $anomaly]);
            break;

        default:
            errorResponse('Action not found', 404);
    }
} catch (\Exception $e) {
    if (config('debug', false)) {
        errorResponse($e->getMessage(), 500);
    } else {
        app_log('error', 'SOS API Error: ' . $e->getMessage());
        errorResponse(__('error.generic'), 500);
    }
}
