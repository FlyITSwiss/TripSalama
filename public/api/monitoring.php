<?php

declare(strict_types=1);

/**
 * TripSalama - Monitoring Endpoint
 * Advanced monitoring with LoggingService integration
 */

require_once __DIR__ . '/_bootstrap.php';

$startTime = microtime(true);
$action = getAction() ?: 'status';

try {
    require_once BACKEND_PATH . '/Services/LoggingService.php';
    $logger = \TripSalama\Services\LoggingService::getInstance();
    $db = getDbConnection();

    switch ($action) {
        case 'status':
            $response = $logger->healthCheck();
            $response['db_connected'] = true;
            successResponse($response);
            break;

        case 'stats':
            $date = getParam('date', date('Y-m-d'));
            $stats = $logger->getStats($date);

            // Add DB stats
            $stats['db'] = [
                'users' => (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn(),
                'rides_today' => (int) $db->query('SELECT COUNT(*) FROM rides WHERE DATE(created_at) = CURDATE()')->fetchColumn(),
                'active_drivers' => (int) $db->query('SELECT COUNT(*) FROM users WHERE role = "driver" AND is_online = 1')->fetchColumn(),
                'pending_rides' => (int) $db->query('SELECT COUNT(*) FROM rides WHERE status = "pending"')->fetchColumn(),
            ];

            successResponse($stats);
            break;

        case 'logs':
            requireAuth();
            $user = current_user();
            if ($user['role'] !== 'admin') {
                errorResponse('Admin access required', 403);
            }

            $date = getParam('date', date('Y-m-d'));
            $type = getParam('type', 'error');
            $limit = (int) getParam('limit', 100);

            $logsPath = \TripSalama\Helpers\PathHelper::getLogsPath();
            $logFile = $logsPath . '/' . $type . '-' . $date . '.log';

            $logs = [];
            if (file_exists($logFile)) {
                $lines = array_slice(file($logFile), -$limit);
                foreach ($lines as $line) {
                    $decoded = json_decode(trim($line), true);
                    if ($decoded) {
                        $logs[] = $decoded;
                    }
                }
            }

            successResponse([
                'date' => $date,
                'type' => $type,
                'count' => count($logs),
                'logs' => array_reverse($logs),
            ]);
            break;

        case 'rotate':
            requireAuth();
            $user = current_user();
            if ($user['role'] !== 'admin') {
                errorResponse('Admin access required', 403);
            }

            $days = (int) getParam('days', 30);
            $deleted = $logger->rotateLogs($days);

            successResponse([
                'rotated' => true,
                'deleted_files' => $deleted,
                'retention_days' => $days,
            ]);
            break;

        case 'services':
            $services = [
                'stripe' => [
                    'configured' => !empty($_ENV['STRIPE_SECRET_KEY']),
                    'mode' => str_contains($_ENV['STRIPE_SECRET_KEY'] ?? '', 'test') ? 'test' : 'live',
                ],
                'twilio' => [
                    'configured' => !empty($_ENV['TWILIO_ACCOUNT_SID']),
                ],
                'fcm' => [
                    'configured' => !empty($_ENV['FCM_SERVER_KEY']),
                ],
                'mail' => [
                    'configured' => !empty($_ENV['MAIL_HOST']),
                    'host' => $_ENV['MAIL_HOST'] ?? 'not set',
                ],
                'prayer_api' => [
                    'configured' => !empty($_ENV['PRAYER_API_URL']),
                    'method' => $_ENV['PRAYER_CALCULATION_METHOD'] ?? '21',
                ],
            ];
            successResponse($services);
            break;

        default:
            errorResponse('Unknown action', 404);
    }
} catch (Exception $e) {
    $response = [
        'status' => 'error',
        'message' => $e->getMessage(),
        'response_time_ms' => round((microtime(true) - $startTime) * 1000, 2),
    ];
    http_response_code(500);
    echo json_encode($response);
}
