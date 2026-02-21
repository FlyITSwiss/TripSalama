<?php

declare(strict_types=1);

/**
 * TripSalama - API Chat
 * Communication conductrice-passagère
 */

require_once __DIR__ . '/_bootstrap.php';

$action = getAction();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    require_once BACKEND_PATH . '/Models/Message.php';
    require_once BACKEND_PATH . '/Models/Ride.php';

    $db = getDbConnection();
    $messageModel = new \TripSalama\Models\Message($db);
    $rideModel = new \TripSalama\Models\Ride($db);

    switch ($action) {
        /**
         * Envoyer un message
         * POST /api/chat.php?action=send
         */
        case 'send':
            requireAuth();
            requireCsrf();

            $rideId = getParam('ride_id', 0, 'int');
            $content = getParam('content', '', 'string');
            $messageType = getParam('message_type', 'text', 'string');
            $userId = (int)current_user()['id'];

            // Validation
            if ($rideId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            if (empty(trim($content))) {
                errorResponse(__('validation.required_field'), 400);
            }

            // Vérifier l'accès à la course
            if (!$messageModel->userHasAccessToRide($rideId, $userId)) {
                errorResponse(__('error.forbidden'), 403);
            }

            // Vérifier que la course est active
            $ride = $rideModel->findById($rideId);
            if (!$ride || !in_array($ride['status'], ['accepted', 'driver_arriving', 'in_progress'], true)) {
                errorResponse(__('error.ride_not_active'), 400);
            }

            // Créer le message
            $messageId = $messageModel->create([
                'ride_id' => $rideId,
                'sender_id' => $userId,
                'content' => trim($content),
                'message_type' => in_array($messageType, ['text', 'quick'], true) ? $messageType : 'text',
            ]);

            successResponse(
                ['message_id' => $messageId],
                __('chat.message_sent')
            );
            break;

        /**
         * Lister les messages d'une course
         * GET /api/chat.php?action=list&ride_id=X
         */
        case 'list':
            requireAuth();

            $rideId = getParam('ride_id', 0, 'int');
            $userId = (int)current_user()['id'];

            if ($rideId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            // Vérifier l'accès
            if (!$messageModel->userHasAccessToRide($rideId, $userId)) {
                errorResponse(__('error.forbidden'), 403);
            }

            // Récupérer les messages
            $messages = $messageModel->getByRide($rideId);

            // Marquer comme lus
            $messageModel->markAsRead($rideId, $userId);

            successResponse([
                'messages' => $messages,
                'count' => count($messages),
            ]);
            break;

        /**
         * Marquer les messages comme lus
         * PUT /api/chat.php?action=mark-read
         */
        case 'mark-read':
            requireAuth();
            requireCsrf();

            $rideId = getParam('ride_id', 0, 'int');
            $userId = (int)current_user()['id'];

            if ($rideId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            if (!$messageModel->userHasAccessToRide($rideId, $userId)) {
                errorResponse(__('error.forbidden'), 403);
            }

            $messageModel->markAsRead($rideId, $userId);

            successResponse(null, __('msg.success'));
            break;

        /**
         * Obtenir les infos d'appel (numéro masqué)
         * GET /api/chat.php?action=call-info&ride_id=X
         */
        case 'call-info':
            requireAuth();

            $rideId = getParam('ride_id', 0, 'int');
            $userId = (int)current_user()['id'];

            if ($rideId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            // Vérifier l'accès
            if (!$messageModel->userHasAccessToRide($rideId, $userId)) {
                errorResponse(__('error.forbidden'), 403);
            }

            // Récupérer la course avec infos contact
            $ride = $rideModel->findById($rideId);
            if (!$ride) {
                errorResponse(__('error.not_found'), 404);
            }

            // Déterminer quel numéro retourner
            $user = current_user();
            $callerRole = $user['role'] ?? 'passenger';

            if ($callerRole === 'driver') {
                // Conductrice appelle passagère
                $phone = $ride['passenger_phone'] ?? null;
                $name = ($ride['passenger_first_name'] ?? '') . ' ' . ($ride['passenger_last_name'] ?? '');
            } else {
                // Passagère appelle conductrice
                $phone = $ride['driver_phone'] ?? null;
                $name = ($ride['driver_first_name'] ?? '') . ' ' . ($ride['driver_last_name'] ?? '');
            }

            if (empty($phone)) {
                errorResponse(__('call.not_available'), 400);
            }

            // Pour le MVP : retourner le vrai numéro
            // En production : intégrer Twilio Proxy pour masquage
            successResponse([
                'phone' => $phone,
                'name' => trim($name),
                'masked' => false, // true quand Twilio sera intégré
            ]);
            break;

        /**
         * Compter les messages non lus
         * GET /api/chat.php?action=unread-count&ride_id=X
         */
        case 'unread-count':
            requireAuth();

            $rideId = getParam('ride_id', 0, 'int');
            $userId = (int)current_user()['id'];

            if ($rideId <= 0) {
                errorResponse(__('validation.required_field'), 400);
            }

            if (!$messageModel->userHasAccessToRide($rideId, $userId)) {
                errorResponse(__('error.forbidden'), 403);
            }

            $count = $messageModel->getUnreadCount($rideId, $userId);

            successResponse(['unread_count' => $count]);
            break;

        default:
            errorResponse(__('error.not_found'), 404);
    }
} catch (\PDOException $e) {
    error_log('Chat API Error: ' . $e->getMessage());
    errorResponse(__('error.generic'), 500);
} catch (\Exception $e) {
    error_log('Chat API Error: ' . $e->getMessage());
    errorResponse($e->getMessage(), 400);
}
