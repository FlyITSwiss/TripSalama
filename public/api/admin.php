<?php

declare(strict_types=1);

/**
 * TripSalama - API Admin Endpoint
 * Dashboard et gestion administrative
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

requireRateLimit('api_request');

// Toutes les actions admin nécessitent authentification et rôle admin
requireAuth();
requireRole('admin');

try {
    require_once BACKEND_PATH . '/Services/AdminService.php';

    $db = getDbConnection();
    $adminService = new \TripSalama\Services\AdminService($db);

    switch ($action) {
        /**
         * Dashboard principal
         * GET /api/admin.php?action=dashboard
         */
        case 'dashboard':
            $stats = $adminService->getDashboardStats();
            $kpis = $adminService->getKPIs();

            successResponse([
                'stats' => $stats,
                'kpis' => $kpis,
            ]);
            break;

        /**
         * Revenus par période
         * GET /api/admin.php?action=revenue&period=daily&limit=30
         */
        case 'revenue':
            $period = getParam('period', 'daily', 'string');
            $limit = (int) getParam('limit', 30, 'int');

            $revenue = $adminService->getRevenueByPeriod($period, min($limit, 365));

            successResponse(['revenue' => $revenue]);
            break;

        /**
         * Liste des conductrices
         * GET /api/admin.php?action=drivers&page=1&status=verified
         */
        case 'drivers':
            $page = (int) getParam('page', 1, 'int');
            $perPage = (int) getParam('per_page', 20, 'int');
            $status = getParam('status', null, 'string');

            $result = $adminService->getDriversWithStats($page, min($perPage, 100), $status);

            successResponse($result);
            break;

        /**
         * Liste des passagères
         * GET /api/admin.php?action=passengers&page=1
         */
        case 'passengers':
            $page = (int) getParam('page', 1, 'int');
            $perPage = (int) getParam('per_page', 20, 'int');

            $result = $adminService->getPassengersWithStats($page, min($perPage, 100));

            successResponse($result);
            break;

        /**
         * Liste des courses
         * GET /api/admin.php?action=rides&page=1&status=completed
         */
        case 'rides':
            $page = (int) getParam('page', 1, 'int');
            $perPage = (int) getParam('per_page', 20, 'int');
            $status = getParam('status', null, 'string');
            $dateFrom = getParam('date_from', null, 'string');
            $dateTo = getParam('date_to', null, 'string');

            $result = $adminService->getRides($page, min($perPage, 100), $status, $dateFrom, $dateTo);

            successResponse($result);
            break;

        /**
         * Alertes SOS
         * GET /api/admin.php?action=sos-alerts&status=active
         */
        case 'sos-alerts':
            $page = (int) getParam('page', 1, 'int');
            $perPage = (int) getParam('per_page', 20, 'int');
            $status = getParam('status', null, 'string');

            $alerts = $adminService->getSOSAlerts($page, min($perPage, 100), $status);

            successResponse(['alerts' => $alerts]);
            break;

        /**
         * Vérifier une conductrice
         * POST /api/admin.php?action=verify-driver
         */
        case 'verify-driver':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireCsrf();

            $data = getRequestData();
            $driverId = (int) ($data['driver_id'] ?? 0);

            if ($driverId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $adminService->verifyDriver($driverId);

            successResponse(null, __('admin.driver_verified'));
            break;

        /**
         * Suspendre un utilisateur
         * POST /api/admin.php?action=suspend-user
         */
        case 'suspend-user':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireCsrf();

            $data = getRequestData();
            $userId = (int) ($data['user_id'] ?? 0);
            $reason = $data['reason'] ?? null;

            if ($userId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $adminService->suspendUser($userId, $reason);

            successResponse(null, __('admin.user_suspended'));
            break;

        /**
         * Réactiver un utilisateur
         * POST /api/admin.php?action=reactivate-user
         */
        case 'reactivate-user':
            if ($method !== 'POST') {
                errorResponse('Method not allowed', 405);
            }
            requireCsrf();

            $data = getRequestData();
            $userId = (int) ($data['user_id'] ?? 0);

            if ($userId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            $adminService->reactivateUser($userId);

            successResponse(null, __('admin.user_reactivated'));
            break;

        /**
         * Transactions
         * GET /api/admin.php?action=transactions&type=payment
         */
        case 'transactions':
            $page = (int) getParam('page', 1, 'int');
            $perPage = (int) getParam('per_page', 20, 'int');
            $type = getParam('type', null, 'string');
            $dateFrom = getParam('date_from', null, 'string');
            $dateTo = getParam('date_to', null, 'string');

            $result = $adminService->getTransactions($page, min($perPage, 100), $type, $dateFrom, $dateTo);

            successResponse($result);
            break;

        /**
         * Statistiques géographiques
         * GET /api/admin.php?action=geographic
         */
        case 'geographic':
            $stats = $adminService->getGeographicStats();

            successResponse($stats);
            break;

        /**
         * KPIs
         * GET /api/admin.php?action=kpis
         */
        case 'kpis':
            $kpis = $adminService->getKPIs();

            successResponse(['kpis' => $kpis]);
            break;

        /**
         * Export des données
         * GET /api/admin.php?action=export&type=rides&format=csv
         */
        case 'export':
            $exportType = getParam('type', 'rides', 'string');
            $format = getParam('format', 'csv', 'string');
            $dateFrom = getParam('date_from', null, 'string');
            $dateTo = getParam('date_to', null, 'string');

            // Obtenir les données selon le type
            $data = match ($exportType) {
                'rides' => $adminService->getRides(1, 10000, null, $dateFrom, $dateTo)['rides'],
                'drivers' => $adminService->getDriversWithStats(1, 10000)['drivers'],
                'passengers' => $adminService->getPassengersWithStats(1, 10000)['passengers'],
                'transactions' => $adminService->getTransactions(1, 10000, null, $dateFrom, $dateTo)['transactions'],
                default => [],
            };

            if ($format === 'csv') {
                header('Content-Type: text/csv; charset=utf-8');
                header('Content-Disposition: attachment; filename="export_' . $exportType . '_' . date('Y-m-d') . '.csv"');

                $output = fopen('php://output', 'w');

                // En-têtes
                if (!empty($data)) {
                    fputcsv($output, array_keys($data[0]));
                }

                // Données
                foreach ($data as $row) {
                    fputcsv($output, $row);
                }

                fclose($output);
                exit;
            } else {
                successResponse(['data' => $data]);
            }
            break;

        /**
         * Configuration système
         * GET /api/admin.php?action=config
         */
        case 'config':
            // Obtenir la configuration actuelle
            $config = [
                'commission_rate' => config('commission_rate', 0.12),
                'min_driver_rating' => config('min_driver_rating', 4.0),
                'max_search_radius_km' => config('max_search_radius_km', 10),
                'referral_bonus_referrer' => config('referral_bonus_referrer', 20),
                'referral_bonus_referred' => config('referral_bonus_referred', 15),
                'currency' => config('currency', 'MAD'),
            ];

            successResponse(['config' => $config]);
            break;

        /**
         * Mettre à jour la configuration
         * PUT /api/admin.php?action=update-config
         */
        case 'update-config':
            if ($method !== 'PUT') {
                errorResponse('Method not allowed', 405);
            }
            requireCsrf();

            $data = getRequestData();

            // Sauvegarder dans la table settings
            foreach ($data as $key => $value) {
                $stmt = $db->prepare('
                    INSERT INTO settings (setting_key, setting_value, updated_at)
                    VALUES (:key, :value, NOW())
                    ON DUPLICATE KEY UPDATE setting_value = :value2, updated_at = NOW()
                ');
                $stmt->execute([
                    'key' => $key,
                    'value' => is_array($value) ? json_encode($value) : $value,
                    'value2' => is_array($value) ? json_encode($value) : $value,
                ]);
            }

            successResponse(null, __('admin.config_updated'));
            break;

        /**
         * Statistiques temps réel
         * GET /api/admin.php?action=realtime
         */
        case 'realtime':
            // Conductrices en ligne
            $onlineDrivers = $db->query('
                SELECT COUNT(*) FROM users
                WHERE role = "driver" AND is_online = 1
            ')->fetchColumn();

            // Courses actives
            $activeRides = $db->query('
                SELECT
                    COUNT(CASE WHEN status = "searching" THEN 1 END) as searching,
                    COUNT(CASE WHEN status = "accepted" THEN 1 END) as accepted,
                    COUNT(CASE WHEN status = "in_progress" THEN 1 END) as in_progress
                FROM rides
                WHERE status IN ("searching", "accepted", "in_progress")
            ')->fetch(PDO::FETCH_ASSOC);

            // Alertes SOS actives
            $activeSOS = $db->query('
                SELECT COUNT(*) FROM sos_alerts WHERE status = "active"
            ')->fetchColumn();

            // Courses des dernières 24h
            $last24h = $db->query('
                SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = "completed" THEN 1 END) as completed,
                    COALESCE(SUM(CASE WHEN status = "completed" THEN final_price ELSE 0 END), 0) as revenue
                FROM rides
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ')->fetch(PDO::FETCH_ASSOC);

            successResponse([
                'online_drivers' => (int) $onlineDrivers,
                'active_rides' => $activeRides,
                'active_sos_alerts' => (int) $activeSOS,
                'last_24h' => $last24h,
                'timestamp' => date('Y-m-d H:i:s'),
            ]);
            break;

        default:
            errorResponse('Action not found', 404);
    }
} catch (\Exception $e) {
    if (config('debug', false)) {
        errorResponse($e->getMessage(), 500);
    } else {
        app_log('error', 'Admin API Error: ' . $e->getMessage());
        errorResponse(__('error.generic'), 500);
    }
}
