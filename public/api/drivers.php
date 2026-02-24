<?php

declare(strict_types=1);

/**
 * TripSalama - API Drivers Endpoint
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

// Rate limiting global pour toutes les requêtes API drivers
requireRateLimit('api_request');

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

            // Validation des coordonnées si fournies
            if ($lat !== null && $lng !== null) {
                requireValidCoordinates($lat, $lng);
            }

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

            // Validation des coordonnées
            requireValidCoordinates($lat, $lng);

            $stmt = $db->prepare('
                UPDATE driver_status
                SET current_lat = :lat, current_lng = :lng, last_heartbeat = NOW()
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

        case 'checklist-status':
            // Vérifier si la checklist du jour est valide
            requireAuth();
            requireRole('driver');

            $driverId = (int)current_user()['id'];
            $today = date('Y-m-d');

            $stmt = $db->prepare('
                SELECT * FROM driver_daily_checklist
                WHERE driver_id = :driver_id AND check_date = :today
            ');
            $stmt->execute(['driver_id' => $driverId, 'today' => $today]);
            $checklist = $stmt->fetch();

            $isValid = false;
            if ($checklist) {
                $validUntil = strtotime($checklist['valid_until']);
                $isValid = $validUntil > time();
            }

            successResponse([
                'has_checklist' => (bool)$checklist,
                'is_valid' => $isValid,
                'valid_until' => $checklist['valid_until'] ?? null,
                'dashcam_verified' => !empty($checklist['dashcam_verified_at']),
            ]);
            break;

        case 'safety-checklist':
            // Soumettre la checklist de sécurité quotidienne
            if ($method !== 'POST') errorResponse('Method not allowed', 405);
            requireAuth();
            requireRole('driver');
            requireCsrf();

            $driverId = (int)current_user()['id'];
            $data = getRequestData();

            // Items de la checklist
            $checklistItems = [
                'seatbelt' => filter_var($data['seatbelt'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'mirror' => filter_var($data['mirror'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'dashcam' => filter_var($data['dashcam'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'lights' => filter_var($data['lights'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'brakes' => filter_var($data['brakes'] ?? false, FILTER_VALIDATE_BOOLEAN),
            ];

            // Tous les items doivent être cochés
            $allChecked = !in_array(false, $checklistItems, true);
            if (!$allChecked) {
                errorResponse(__('checklist.all_required'), 400);
            }

            $today = date('Y-m-d');
            $validUntil = date('Y-m-d 23:59:59'); // Valide jusqu'à minuit

            // Photo dashcam (optionnel mais recommandé)
            $dashcamPhotoPath = null;
            $dashcamVerifiedAt = null;

            if (isset($_FILES['dashcam_photo']) && $_FILES['dashcam_photo']['error'] === UPLOAD_ERR_OK) {
                // Validation du fichier
                $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
                $maxSize = 5 * 1024 * 1024; // 5MB

                if (!in_array($_FILES['dashcam_photo']['type'], $allowedTypes)) {
                    errorResponse(__('error.invalid_file_type'), 400);
                }

                if ($_FILES['dashcam_photo']['size'] > $maxSize) {
                    errorResponse(__('error.file_too_large'), 400);
                }

                // Créer le dossier si nécessaire
                $uploadDir = PUBLIC_PATH . '/uploads/dashcam/' . $driverId;
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }

                // Nom unique pour le fichier
                $ext = pathinfo($_FILES['dashcam_photo']['name'], PATHINFO_EXTENSION);
                $filename = $today . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
                $filepath = $uploadDir . '/' . $filename;

                if (move_uploaded_file($_FILES['dashcam_photo']['tmp_name'], $filepath)) {
                    $dashcamPhotoPath = '/uploads/dashcam/' . $driverId . '/' . $filename;
                    $dashcamVerifiedAt = date('Y-m-d H:i:s');
                }
            }

            // Insérer ou mettre à jour la checklist
            $stmt = $db->prepare('
                INSERT INTO driver_daily_checklist
                    (driver_id, check_date, checklist_items, dashcam_photo_path, dashcam_verified_at, valid_until)
                VALUES
                    (:driver_id, :check_date, :items, :photo, :verified, :valid_until)
                ON DUPLICATE KEY UPDATE
                    checklist_items = :items2,
                    dashcam_photo_path = COALESCE(:photo2, dashcam_photo_path),
                    dashcam_verified_at = COALESCE(:verified2, dashcam_verified_at),
                    valid_until = :valid_until2,
                    updated_at = NOW()
            ');
            $stmt->execute([
                'driver_id' => $driverId,
                'check_date' => $today,
                'items' => json_encode($checklistItems),
                'photo' => $dashcamPhotoPath,
                'verified' => $dashcamVerifiedAt,
                'valid_until' => $validUntil,
                'items2' => json_encode($checklistItems),
                'photo2' => $dashcamPhotoPath,
                'verified2' => $dashcamVerifiedAt,
                'valid_until2' => $validUntil,
            ]);

            // Mettre à jour le statut du driver avec la validité de la checklist
            $stmt = $db->prepare('
                UPDATE driver_status
                SET checklist_valid_until = :valid_until
                WHERE driver_id = :driver_id
            ');
            $stmt->execute([
                'driver_id' => $driverId,
                'valid_until' => $validUntil,
            ]);

            successResponse([
                'valid_until' => $validUntil,
                'dashcam_verified' => (bool)$dashcamVerifiedAt,
            ], __('checklist.submitted'));
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
