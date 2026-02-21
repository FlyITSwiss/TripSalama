<?php

declare(strict_types=1);

/**
 * TripSalama - API Drivers Endpoint
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

try {
    require_once BACKEND_PATH . '/Models/Ride.php';

    $db = getDbConnection();

    switch ($action) {
        case 'availability':
        case 'toggle-status':
            if ($method !== 'POST' && $method !== 'PUT') errorResponse('Method not allowed', 405);
            requireAuth();
            requireRole('driver');
            requireCsrf();

            $data = getRequestData();
            $driverId = (int)current_user()['id'];
            $isAvailable = filter_var($data['is_available'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $lat = isset($data['lat']) ? (float)$data['lat'] : null;
            $lng = isset($data['lng']) ? (float)$data['lng'] : null;

            $stmt = $db->prepare('
                INSERT INTO driver_status (driver_id, is_available, current_lat, current_lng)
                VALUES (:driver_id, :is_available, :lat, :lng)
                ON DUPLICATE KEY UPDATE is_available = :is_available2, current_lat = :lat2, current_lng = :lng2
            ');
            $stmt->execute([
                'driver_id' => $driverId,
                'is_available' => $isAvailable ? 1 : 0,
                'lat' => $lat,
                'lng' => $lng,
                'is_available2' => $isAvailable ? 1 : 0,
                'lat2' => $lat,
                'lng2' => $lng,
            ]);

            successResponse([
                'is_available' => $isAvailable
            ], __('msg.status_changed'));
            break;

        case 'update-position':
            if ($method !== 'PUT') errorResponse('Method not allowed', 405);
            requireAuth();
            requireRole('driver');
            requireCsrf();

            $data = getRequestData();
            $driverId = (int)current_user()['id'];
            $lat = (float)($data['lat'] ?? 0);
            $lng = (float)($data['lng'] ?? 0);

            $stmt = $db->prepare('
                UPDATE driver_status
                SET current_lat = :lat, current_lng = :lng
                WHERE driver_id = :driver_id
            ');
            $stmt->execute([
                'driver_id' => $driverId,
                'lat' => $lat,
                'lng' => $lng,
            ]);

            successResponse(null, __('msg.position_updated'));
            break;

        case 'pending-rides':
            requireAuth();
            requireRole('driver');

            $driverId = (int)current_user()['id'];

            // Obtenir la position de la conductrice
            $stmt = $db->prepare('SELECT current_lat, current_lng FROM driver_status WHERE driver_id = :id');
            $stmt->execute(['id' => $driverId]);
            $status = $stmt->fetch();

            $lat = (float)($status['current_lat'] ?? 46.2044);
            $lng = (float)($status['current_lng'] ?? 6.1432);

            $rideModel = new \TripSalama\Models\Ride($db);
            $rides = $rideModel->getPending($lat, $lng);

            successResponse(['rides' => $rides]);
            break;

        case 'status':
            requireAuth();
            requireRole('driver');

            $driverId = (int)current_user()['id'];

            $stmt = $db->prepare('SELECT * FROM driver_status WHERE driver_id = :id');
            $stmt->execute(['id' => $driverId]);
            $status = $stmt->fetch();

            successResponse(['status' => $status ?: ['is_available' => false]]);
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
