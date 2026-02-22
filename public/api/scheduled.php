<?php

declare(strict_types=1);

/**
 * TripSalama - API Courses Programmées Endpoint
 * Gestion des réservations à l'avance
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

requireRateLimit('api_request');

try {
    require_once BACKEND_PATH . '/Services/ScheduledRideService.php';

    $db = getDbConnection();
    $scheduledService = new \TripSalama\Services\ScheduledRideService($db);

    switch ($action) {
        /**
         * Programmer une course
         * POST /api/scheduled.php?action=schedule
         */
        case 'schedule':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];

            // Validation
            $required = ['pickup_address', 'pickup_lat', 'pickup_lng',
                'dropoff_address', 'dropoff_lat', 'dropoff_lng', 'scheduled_at'];

            foreach ($required as $field) {
                if (empty($data[$field])) {
                    errorResponse(__('validation.required_field') . ": {$field}", 400);
                }
            }

            requireValidCoordinates((float) $data['pickup_lat'], (float) $data['pickup_lng']);
            requireValidCoordinates((float) $data['dropoff_lat'], (float) $data['dropoff_lng']);

            $scheduleId = $scheduledService->schedule($userId, $data);

            successResponse(['schedule_id' => $scheduleId], __('scheduled.created'));
            break;

        /**
         * Annuler une course programmée
         * PUT /api/scheduled.php?action=cancel
         */
        case 'cancel':
            if ($method !== 'PUT') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $scheduleId = (int) ($data['schedule_id'] ?? 0);

            if ($scheduleId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $scheduledService->cancel($scheduleId, $userId);

            if ($result) {
                successResponse(null, __('scheduled.cancelled'));
            } else {
                errorResponse(__('scheduled.cancel_failed'), 400);
            }
            break;

        /**
         * Mettre à jour une course programmée
         * PUT /api/scheduled.php?action=update
         */
        case 'update':
            if ($method !== 'PUT') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $userId = (int) current_user()['id'];
            $scheduleId = (int) ($data['schedule_id'] ?? 0);

            if ($scheduleId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $scheduledService->update($scheduleId, $userId, $data);

            if ($result) {
                successResponse(null, __('msg.updated'));
            } else {
                errorResponse(__('scheduled.update_failed'), 400);
            }
            break;

        /**
         * Lister les courses programmées de l'utilisateur
         * GET /api/scheduled.php?action=list
         */
        case 'list':
            requireAuth();
            $userId = (int) current_user()['id'];
            $includeCompleted = filter_var(getParam('include_completed', 'false'), FILTER_VALIDATE_BOOLEAN);

            $rides = $scheduledService->getByUser($userId, $includeCompleted);

            successResponse(['scheduled_rides' => $rides]);
            break;

        /**
         * Obtenir une course programmée
         * GET /api/scheduled.php?action=get&id=X
         */
        case 'get':
            requireAuth();
            $scheduleId = (int) getParam('id', 0, 'int');

            if ($scheduleId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $ride = $scheduledService->findById($scheduleId);

            if (!$ride) {
                errorResponse(__('scheduled.not_found'), 404);
            }

            // Vérifier que l'utilisateur a accès
            $userId = (int) current_user()['id'];
            if ((int) $ride['passenger_id'] !== $userId && (int) ($ride['driver_id'] ?? 0) !== $userId) {
                errorResponse(__('error.forbidden'), 403);
            }

            successResponse(['scheduled_ride' => $ride]);
            break;

        /**
         * Obtenir les courses programmées pour une conductrice
         * GET /api/scheduled.php?action=driver-list
         */
        case 'driver-list':
            requireAuth();
            requireRole('driver');
            $driverId = (int) current_user()['id'];

            $rides = $scheduledService->getForDriver($driverId);

            successResponse(['scheduled_rides' => $rides]);
            break;

        /**
         * Accepter une course programmée (conductrice)
         * POST /api/scheduled.php?action=accept
         */
        case 'accept':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireRole('driver');
            requireCsrf();

            $data = getRequestData();
            $driverId = (int) current_user()['id'];
            $scheduleId = (int) ($data['schedule_id'] ?? 0);

            if ($scheduleId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $result = $scheduledService->assignDriver($scheduleId, $driverId);

            if ($result) {
                successResponse(null, __('scheduled.accepted'));
            } else {
                errorResponse(__('scheduled.accept_failed'), 400);
            }
            break;

        /**
         * Obtenir les courses à venir (worker/cron)
         * GET /api/scheduled.php?action=upcoming
         */
        case 'upcoming':
            requireAuth();
            requireRole('admin');

            $minutes = (int) getParam('minutes', 20, 'int');
            $rides = $scheduledService->getUpcoming($minutes);

            successResponse(['upcoming_rides' => $rides]);
            break;

        /**
         * Convertir en course réelle (worker/cron)
         * POST /api/scheduled.php?action=convert
         */
        case 'convert':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireRole('admin');
            requireCsrf();

            $data = getRequestData();
            $scheduleId = (int) ($data['schedule_id'] ?? 0);

            if ($scheduleId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $rideId = $scheduledService->convertToRide($scheduleId);

            if ($rideId) {
                successResponse(['ride_id' => $rideId], __('scheduled.converted'));
            } else {
                errorResponse(__('scheduled.convert_failed'), 400);
            }
            break;

        /**
         * Envoyer les rappels (worker/cron)
         * POST /api/scheduled.php?action=send-reminders
         */
        case 'send-reminders':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireRole('admin');
            requireCsrf();

            $sent = $scheduledService->sendReminders();

            successResponse(['reminders_sent' => count($sent), 'ride_ids' => $sent]);
            break;

        default:
            errorResponse('Action not found', 404);
    }
} catch (\Exception $e) {
    if (config('debug', false)) {
        errorResponse($e->getMessage(), 500);
    } else {
        app_log('error', 'Scheduled API Error: ' . $e->getMessage());
        errorResponse(__('error.generic'), 500);
    }
}
