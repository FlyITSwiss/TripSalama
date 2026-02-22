<?php

declare(strict_types=1);

/**
 * TripSalama - API Véhicules Endpoint
 * Gestion des types de véhicules et tarification
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

requireRateLimit('api_request');

try {
    require_once BACKEND_PATH . '/Services/VehicleTypeService.php';

    $db = getDbConnection();
    $vehicleService = new \TripSalama\Services\VehicleTypeService($db);

    switch ($action) {
        /**
         * Obtenir les types de véhicules actifs
         * GET /api/vehicles.php?action=types
         */
        case 'types':
            $types = $vehicleService->getActive();

            successResponse(['vehicle_types' => $types]);
            break;

        /**
         * Obtenir tous les types de véhicules (admin)
         * GET /api/vehicles.php?action=all-types
         */
        case 'all-types':
            requireAuth();
            requireRole('admin');

            $types = $vehicleService->getAll();

            successResponse(['vehicle_types' => $types]);
            break;

        /**
         * Calculer le prix pour une course
         * GET /api/vehicles.php?action=estimate
         */
        case 'estimate':
            $distanceKm = (float) getParam('distance', 0, 'float');
            $durationMinutes = (int) getParam('duration', 0, 'int');
            $vehicleType = getParam('type', 'standard', 'string');
            $pickupLat = (float) getParam('pickup_lat', 0, 'float');
            $pickupLng = (float) getParam('pickup_lng', 0, 'float');

            if ($distanceKm <= 0 || $durationMinutes <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            // Calculer le surge si coordonnées fournies
            $surgeMultiplier = 1.0;
            if ($pickupLat !== 0.0 && $pickupLng !== 0.0) {
                $surgeMultiplier = $vehicleService->calculateSurgeMultiplier($pickupLat, $pickupLng);
            }

            $price = $vehicleService->calculatePrice(
                $vehicleType,
                $distanceKm,
                $durationMinutes,
                $surgeMultiplier
            );

            successResponse($price);
            break;

        /**
         * Calculer les prix pour tous les types
         * GET /api/vehicles.php?action=estimate-all
         */
        case 'estimate-all':
            $distanceKm = (float) getParam('distance', 0, 'float');
            $durationMinutes = (int) getParam('duration', 0, 'int');
            $pickupLat = (float) getParam('pickup_lat', 0, 'float');
            $pickupLng = (float) getParam('pickup_lng', 0, 'float');

            if ($distanceKm <= 0 || $durationMinutes <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            // Calculer le surge
            $surgeMultiplier = 1.0;
            if ($pickupLat !== 0.0 && $pickupLng !== 0.0) {
                $surgeMultiplier = $vehicleService->calculateSurgeMultiplier($pickupLat, $pickupLng);
            }

            $prices = $vehicleService->calculateAllPrices($distanceKm, $durationMinutes, $surgeMultiplier);

            successResponse([
                'estimates' => $prices,
                'surge_multiplier' => $surgeMultiplier,
                'surge_active' => $surgeMultiplier > 1.0,
            ]);
            break;

        /**
         * Obtenir les types disponibles dans une zone
         * GET /api/vehicles.php?action=available
         */
        case 'available':
            $lat = (float) getParam('lat', 0, 'float');
            $lng = (float) getParam('lng', 0, 'float');
            $radius = (int) getParam('radius', 5, 'int');

            requireValidCoordinates($lat, $lng);

            $available = $vehicleService->getAvailableInArea($lat, $lng, $radius);

            successResponse(['available_types' => $available]);
            break;

        /**
         * Obtenir les ETA par type de véhicule
         * GET /api/vehicles.php?action=eta
         */
        case 'eta':
            $lat = (float) getParam('lat', 0, 'float');
            $lng = (float) getParam('lng', 0, 'float');

            requireValidCoordinates($lat, $lng);

            $etas = $vehicleService->getETAByType($lat, $lng);

            successResponse(['etas' => $etas]);
            break;

        /**
         * Obtenir le surge pricing actuel
         * GET /api/vehicles.php?action=surge
         */
        case 'surge':
            $lat = (float) getParam('lat', 0, 'float');
            $lng = (float) getParam('lng', 0, 'float');

            requireValidCoordinates($lat, $lng);

            $multiplier = $vehicleService->calculateSurgeMultiplier($lat, $lng);

            $surgeLevel = 'none';
            if ($multiplier >= 1.8) {
                $surgeLevel = 'high';
            } elseif ($multiplier >= 1.4) {
                $surgeLevel = 'medium';
            } elseif ($multiplier > 1.0) {
                $surgeLevel = 'low';
            }

            successResponse([
                'surge_multiplier' => $multiplier,
                'surge_level' => $surgeLevel,
                'surge_active' => $multiplier > 1.0,
                'message' => $multiplier > 1.0
                    ? sprintf(__('surge.message'), number_format(($multiplier - 1) * 100, 0) . '%')
                    : null,
            ]);
            break;

        /**
         * Créer un type de véhicule (admin)
         * POST /api/vehicles.php?action=create-type
         */
        case 'create-type':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireRole('admin');
            requireCsrf();

            $data = getRequestData();

            if (empty($data['code']) || empty($data['name'])) {
                errorResponse(__('validation.required_field'), 400);
            }

            // Vérifier que le code n'existe pas
            if ($vehicleService->getByCode($data['code'])) {
                errorResponse(__('vehicle.code_exists'), 400);
            }

            $typeId = $vehicleService->create($data);

            successResponse(['type_id' => $typeId], __('vehicle.created'));
            break;

        /**
         * Mettre à jour un type de véhicule (admin)
         * PUT /api/vehicles.php?action=update-type
         */
        case 'update-type':
            if ($method !== 'PUT') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireRole('admin');
            requireCsrf();

            $data = getRequestData();
            $typeId = (int) ($data['type_id'] ?? 0);

            if ($typeId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $vehicleService->update($typeId, $data);

            successResponse(null, __('msg.updated'));
            break;

        /**
         * Activer/Désactiver un type (admin)
         * PUT /api/vehicles.php?action=toggle-type
         */
        case 'toggle-type':
            if ($method !== 'PUT') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireRole('admin');
            requireCsrf();

            $data = getRequestData();
            $typeId = (int) ($data['type_id'] ?? 0);

            if ($typeId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $vehicleService->toggleActive($typeId);

            successResponse(null, __('msg.updated'));
            break;

        /**
         * Initialiser les types par défaut (admin)
         * POST /api/vehicles.php?action=init-defaults
         */
        case 'init-defaults':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireAuth();
            requireRole('admin');
            requireCsrf();

            $vehicleService->initializeDefaults();

            successResponse(null, __('vehicle.defaults_initialized'));
            break;

        default:
            errorResponse('Action not found', 404);
    }
} catch (\Exception $e) {
    if (config('debug', false)) {
        errorResponse($e->getMessage(), 500);
    } else {
        app_log('error', 'Vehicles API Error: ' . $e->getMessage());
        errorResponse(__('error.generic'), 500);
    }
}
