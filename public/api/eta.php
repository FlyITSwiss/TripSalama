<?php

declare(strict_types=1);

/**
 * TripSalama - API ETA Endpoint
 * Estimation des temps d'arrivée
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

requireRateLimit('api_request');

try {
    require_once BACKEND_PATH . '/Services/ETAService.php';

    $db = getDbConnection();
    $etaService = new \TripSalama\Services\ETAService($db);

    switch ($action) {
        /**
         * Obtenir l'ETA d'une conductrice vers un point
         * GET /api/eta.php?action=driver&driver_id=X&lat=Y&lng=Z
         */
        case 'driver':
            $driverId = (int) getParam('driver_id', 0, 'int');
            $lat = (float) getParam('lat', 0, 'float');
            $lng = (float) getParam('lng', 0, 'float');

            if ($driverId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            requireValidCoordinates($lat, $lng);

            $eta = $etaService->calculateDriverETA($driverId, $lat, $lng);

            successResponse($eta);
            break;

        /**
         * Trouver les conductrices proches avec ETA
         * GET /api/eta.php?action=nearest&lat=Y&lng=Z
         */
        case 'nearest':
            $lat = (float) getParam('lat', 0, 'float');
            $lng = (float) getParam('lng', 0, 'float');
            $vehicleType = getParam('vehicle_type', null, 'string');
            $limit = (int) getParam('limit', 5, 'int');

            requireValidCoordinates($lat, $lng);

            $drivers = $etaService->findNearestDriverWithETA($lat, $lng, $vehicleType, min($limit, 10));

            successResponse(['drivers' => $drivers]);
            break;

        /**
         * Calculer l'ETA d'une course (pickup -> destination)
         * GET /api/eta.php?action=ride
         */
        case 'ride':
            $pickupLat = (float) getParam('pickup_lat', 0, 'float');
            $pickupLng = (float) getParam('pickup_lng', 0, 'float');
            $dropoffLat = (float) getParam('dropoff_lat', 0, 'float');
            $dropoffLng = (float) getParam('dropoff_lng', 0, 'float');

            requireValidCoordinates($pickupLat, $pickupLng);
            requireValidCoordinates($dropoffLat, $dropoffLng);

            $eta = $etaService->calculateRideETA($pickupLat, $pickupLng, $dropoffLat, $dropoffLng);

            successResponse($eta);
            break;

        /**
         * Obtenir l'ETA en temps réel pour une course active
         * GET /api/eta.php?action=realtime&ride_id=X
         */
        case 'realtime':
            requireAuth();
            $rideId = (int) getParam('ride_id', 0, 'int');

            if ($rideId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            // Vérifier que l'utilisateur a accès à cette course
            $userId = (int) current_user()['id'];
            $stmt = $db->prepare('
                SELECT id FROM rides
                WHERE id = :ride_id AND (passenger_id = :user_id OR driver_id = :user_id2)
            ');
            $stmt->execute(['ride_id' => $rideId, 'user_id' => $userId, 'user_id2' => $userId]);

            if (!$stmt->fetch()) {
                errorResponse(__('error.forbidden'), 403);
            }

            $eta = $etaService->getRealTimeETA($rideId);

            successResponse($eta);
            break;

        /**
         * Mettre à jour la position de la conductrice
         * POST /api/eta.php?action=update-location
         */
        case 'update-location':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireRole('driver');
            requireCsrf();

            $data = getRequestData();
            $driverId = (int) current_user()['id'];
            $lat = (float) ($data['latitude'] ?? 0);
            $lng = (float) ($data['longitude'] ?? 0);
            $heading = isset($data['heading']) ? (float) $data['heading'] : null;
            $speed = isset($data['speed']) ? (float) $data['speed'] : null;

            requireValidCoordinates($lat, $lng);

            $etaService->updateDriverLocation($driverId, $lat, $lng, $heading, $speed);

            successResponse(null);
            break;

        /**
         * Obtenir l'ETA pour tous les types de véhicules
         * GET /api/eta.php?action=all-types&lat=Y&lng=Z
         */
        case 'all-types':
            $lat = (float) getParam('lat', 0, 'float');
            $lng = (float) getParam('lng', 0, 'float');

            requireValidCoordinates($lat, $lng);

            // Charger le service de types de véhicules
            require_once BACKEND_PATH . '/Services/VehicleTypeService.php';
            $vehicleService = new \TripSalama\Services\VehicleTypeService($db);

            $etas = $vehicleService->getETAByType($lat, $lng);

            successResponse(['etas' => $etas]);
            break;

        default:
            errorResponse('Action not found', 404);
    }
} catch (\Exception $e) {
    if (config('debug', false)) {
        errorResponse($e->getMessage(), 500);
    } else {
        app_log('error', 'ETA API Error: ' . $e->getMessage());
        errorResponse(__('error.generic'), 500);
    }
}
