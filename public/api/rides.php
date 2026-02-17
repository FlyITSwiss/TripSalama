<?php

declare(strict_types=1);

/**
 * TripSalama - API Rides Endpoint
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

try {
    require_once BACKEND_PATH . '/Models/Ride.php';
    require_once BACKEND_PATH . '/Models/Vehicle.php';

    $db = getDbConnection();
    $rideModel = new \TripSalama\Models\Ride($db);

    switch ($action) {
        case 'create':
            if ($method !== 'POST') errorResponse('Method not allowed', 405);
            requireAuth();
            requireRole('passenger');
            requireCsrf();

            $data = getRequestData();
            $userId = (int)current_user()['id'];

            $rideId = $rideModel->create([
                'passenger_id' => $userId,
                'pickup_address' => $data['pickup_address'] ?? '',
                'pickup_lat' => (float)($data['pickup_lat'] ?? 0),
                'pickup_lng' => (float)($data['pickup_lng'] ?? 0),
                'dropoff_address' => $data['dropoff_address'] ?? '',
                'dropoff_lat' => (float)($data['dropoff_lat'] ?? 0),
                'dropoff_lng' => (float)($data['dropoff_lng'] ?? 0),
                'estimated_distance_km' => (float)($data['estimated_distance_km'] ?? 0),
                'estimated_duration_min' => (int)($data['estimated_duration_min'] ?? 0),
                'estimated_price' => (float)($data['estimated_price'] ?? 0),
                'route_polyline' => $data['route_polyline'] ?? null,
            ]);

            successResponse(['ride_id' => $rideId], __('msg.ride_created'));
            break;

        case 'get':
            requireAuth();
            $rideId = (int)getParam('ride_id', 0, 'int');
            $ride = $rideModel->findById($rideId);

            if (!$ride) errorResponse(__('error.not_found'), 404);

            successResponse($ride);
            break;

        case 'cancel':
            if ($method !== 'PUT') errorResponse('Method not allowed', 405);
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $rideId = (int)($data['ride_id'] ?? 0);
            $ride = $rideModel->findById($rideId);

            if (!$ride) errorResponse(__('error.not_found'), 404);

            // Verifier que c'est la passagere ou la conductrice
            $userId = (int)current_user()['id'];
            if ((int)$ride['passenger_id'] !== $userId && (int)$ride['driver_id'] !== $userId) {
                errorResponse(__('error.forbidden'), 403);
            }

            $rideModel->updateStatus($rideId, 'cancelled');
            successResponse(null, __('msg.ride_cancelled'));
            break;

        case 'accept':
            if ($method !== 'PUT') errorResponse('Method not allowed', 405);
            requireAuth();
            requireRole('driver');
            requireCsrf();

            $data = getRequestData();
            $rideId = (int)($data['ride_id'] ?? 0);
            $vehicleId = (int)($data['vehicle_id'] ?? 0);
            $driverId = (int)current_user()['id'];

            $ride = $rideModel->findById($rideId);
            if (!$ride || $ride['status'] !== 'pending') {
                errorResponse(__('error.not_found'), 404);
            }

            $rideModel->assignDriver($rideId, $driverId, $vehicleId);
            successResponse(['ride_id' => $rideId], __('msg.ride_accepted'));
            break;

        case 'start':
            if ($method !== 'PUT') errorResponse('Method not allowed', 405);
            requireAuth();
            requireRole('driver');
            requireCsrf();

            $data = getRequestData();
            $rideId = (int)($data['ride_id'] ?? 0);

            $rideModel->updateStatus($rideId, 'in_progress');
            successResponse(null, __('msg.status_changed'));
            break;

        case 'complete':
            if ($method !== 'PUT') errorResponse('Method not allowed', 405);
            requireAuth();
            requireRole('driver');
            requireCsrf();

            $data = getRequestData();
            $rideId = (int)($data['ride_id'] ?? 0);

            $ride = $rideModel->findById($rideId);
            if ($ride) {
                // Copier le prix estime vers le prix final
                $stmt = $db->prepare('UPDATE rides SET final_price = estimated_price WHERE id = :id');
                $stmt->execute(['id' => $rideId]);
            }

            $rideModel->updateStatus($rideId, 'completed');
            successResponse(null, __('msg.ride_completed'));
            break;

        case 'rate':
            if ($method !== 'POST') errorResponse('Method not allowed', 405);
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $rideId = (int)($data['ride_id'] ?? 0);
            $rating = (int)($data['rating'] ?? 0);
            $comment = $data['comment'] ?? null;

            if ($rating < 1 || $rating > 5) {
                errorResponse(__('error.validation'), 400);
            }

            $user = current_user();
            $ride = $rideModel->findById($rideId);

            if (!$ride) errorResponse(__('error.not_found'), 404);

            // Creer ou mettre a jour la notation
            if ((int)$ride['passenger_id'] === (int)$user['id']) {
                // Passagere note la conductrice
                $stmt = $db->prepare('
                    INSERT INTO ratings (ride_id, passenger_rating, passenger_comment, passenger_rated_at)
                    VALUES (:ride_id, :rating, :comment, NOW())
                    ON DUPLICATE KEY UPDATE passenger_rating = :rating2, passenger_comment = :comment2, passenger_rated_at = NOW()
                ');
                $stmt->execute([
                    'ride_id' => $rideId,
                    'rating' => $rating,
                    'comment' => $comment,
                    'rating2' => $rating,
                    'comment2' => $comment,
                ]);
            } else if ((int)$ride['driver_id'] === (int)$user['id']) {
                // Conductrice note la passagere
                $stmt = $db->prepare('
                    INSERT INTO ratings (ride_id, driver_rating, driver_comment, driver_rated_at)
                    VALUES (:ride_id, :rating, :comment, NOW())
                    ON DUPLICATE KEY UPDATE driver_rating = :rating2, driver_comment = :comment2, driver_rated_at = NOW()
                ');
                $stmt->execute([
                    'ride_id' => $rideId,
                    'rating' => $rating,
                    'comment' => $comment,
                    'rating2' => $rating,
                    'comment2' => $comment,
                ]);
            }

            successResponse(null, __('msg.rating_submitted'));
            break;

        case 'history':
            requireAuth();
            $user = current_user();

            if ($user['role'] === 'driver') {
                $rides = $rideModel->getByDriver((int)$user['id']);
            } else {
                $rides = $rideModel->getByPassenger((int)$user['id']);
            }

            successResponse(['rides' => $rides]);
            break;

        case 'position':
            if ($method !== 'POST') errorResponse('Method not allowed', 405);
            requireAuth();
            requireCsrf();

            $data = getRequestData();
            $rideId = (int)($data['ride_id'] ?? 0);
            $lat = (float)($data['lat'] ?? 0);
            $lng = (float)($data['lng'] ?? 0);

            $rideModel->savePosition($rideId, $lat, $lng);
            successResponse(null, __('msg.position_updated'));
            break;

        case 'current-position':
            requireAuth();
            $rideId = (int)getParam('ride_id', 0, 'int');
            $position = $rideModel->getLastPosition($rideId);

            successResponse(['position' => $position]);
            break;

        default:
            errorResponse('Action not found', 404);
    }

} catch (\Exception $e) {
    if (config('debug', false)) {
        errorResponse($e->getMessage(), 500);
    } else {
        app_log('error', $e->getMessage());
        errorResponse(__('error.generic'), 500);
    }
}
