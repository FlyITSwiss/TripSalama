/**
 * TripSalama - WebSocket Service
 * Connexion temps réel pour le tracking véhicule
 *
 * Améliorations v2.0:
 * - Exponential backoff avec jitter pour éviter "thundering herd"
 * - Connection quality monitoring
 * - Reconnection intelligente basée sur l'état réseau
 * - Message queue pendant la déconnexion
 * - Heartbeat adaptatif
 */

'use strict';

const WebSocketService = (function() {
    // Configuration
    const config = {
        // Reconnection
        baseReconnectInterval: 1000,     // 1s de base
        maxReconnectInterval: 60000,     // Max 60s
        maxReconnectAttempts: 15,
        reconnectJitterPercent: 0.25,    // ±25% jitter

        // Heartbeat
        heartbeatInterval: 30000,
        heartbeatTimeout: 10000,         // Timeout pour pong
        adaptiveHeartbeat: true,         // Ajuster selon qualité

        // Message queue
        maxQueueSize: 100,
        queueDuringDisconnect: true,

        // Connection
        wsPath: '/ws',
        connectionTimeout: 15000,
    };

    // État
    let socket = null;
    let reconnectAttempts = 0;
    let heartbeatTimer = null;
    let heartbeatTimeoutTimer = null;
    let isConnecting = false;
    let isIntentionalDisconnect = false;
    let userId = null;
    let currentRideId = null;
    let messageHandlers = new Map();
    let reconnectTimer = null;

    // Message queue
    let messageQueue = [];
    let lastPongTime = Date.now();

    // Connection quality
    let connectionQuality = {
        latency: 0,
        missedPongs: 0,
        successfulReconnects: 0,
        totalDisconnects: 0,
        lastConnectedAt: null,
        lastDisconnectedAt: null,
    };

    /**
     * Initialiser la connexion WebSocket
     * @param {Object} options Configuration
     */
    function connect(options = {}) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            AppConfig.debug('WebSocket: Déjà connecté');
            return Promise.resolve();
        }

        if (isConnecting) {
            AppConfig.debug('WebSocket: Connexion en cours...');
            return Promise.resolve();
        }

        isConnecting = true;
        userId = options.userId || null;
        currentRideId = options.rideId || null;

        return new Promise((resolve, reject) => {
            try {
                // Construire l'URL WebSocket
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const host = window.location.host;
                const wsUrl = `${protocol}//${host}${config.wsPath}`;

                AppConfig.debug(`WebSocket: Connexion à ${wsUrl}`);
                socket = new WebSocket(wsUrl);

                socket.onopen = () => {
                    AppConfig.debug('WebSocket: Connecté');
                    isConnecting = false;
                    isIntentionalDisconnect = false;
                    reconnectAttempts = 0;

                    // Mettre à jour les stats
                    connectionQuality.lastConnectedAt = Date.now();
                    if (connectionQuality.totalDisconnects > 0) {
                        connectionQuality.successfulReconnects++;
                    }

                    // Authentification
                    if (userId) {
                        send('auth', { userId: userId });
                    }

                    // Rejoindre le room de la course
                    if (currentRideId) {
                        joinRide(currentRideId);
                    }

                    // Vider la queue de messages
                    flushMessageQueue();

                    // Démarrer le heartbeat
                    startHeartbeat();

                    EventBus.emit('websocket:connected', {
                        reconnected: connectionQuality.successfulReconnects > 0,
                    });
                    resolve();
                };

                socket.onmessage = (event) => {
                    handleMessage(event.data);
                };

                socket.onclose = (event) => {
                    AppConfig.debug(`WebSocket: Fermé (code: ${event.code}, reason: ${event.reason || 'none'})`);
                    isConnecting = false;
                    stopHeartbeat();

                    // Mettre à jour les stats
                    connectionQuality.totalDisconnects++;
                    connectionQuality.lastDisconnectedAt = Date.now();

                    EventBus.emit('websocket:disconnected', {
                        code: event.code,
                        reason: event.reason,
                        wasClean: event.wasClean,
                    });

                    // Reconnecter si pas fermé intentionnellement (code 1000) et pas force reconnect (4000)
                    if (event.code !== 1000 && !isIntentionalDisconnect) {
                        scheduleReconnect();
                    }
                };

                socket.onerror = (error) => {
                    AppConfig.debug('WebSocket: Erreur', error);
                    isConnecting = false;
                    EventBus.emit('websocket:error', error);
                    reject(error);
                };

            } catch (error) {
                isConnecting = false;
                AppConfig.debug('WebSocket: Erreur de création', error);
                reject(error);
            }
        });
    }

    /**
     * Déconnecter
     * @param {boolean} clearQueue Vider la queue de messages
     */
    function disconnect(clearQueue = true) {
        isIntentionalDisconnect = true;

        cancelReconnect();
        stopHeartbeat();

        if (socket) {
            socket.close(1000, 'Déconnexion normale');
            socket = null;
        }

        reconnectAttempts = 0;
        isConnecting = false;

        if (clearQueue) {
            messageQueue = [];
        }
    }

    /**
     * Envoyer un message
     * @param {string} type Type de message
     * @param {Object} data Données
     * @param {boolean} queue Mettre en queue si déconnecté
     */
    function send(type, data = {}, queue = false) {
        const message = {
            type: type,
            data: data,
            timestamp: Date.now()
        };

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            // Mettre en queue si configuré
            if (queue && config.queueDuringDisconnect && type !== 'ping') {
                queueMessage(message);
                return false;
            }

            AppConfig.debug('WebSocket: Non connecté, message ignoré');
            return false;
        }

        socket.send(JSON.stringify(message));
        return true;
    }

    /**
     * Ajouter un message à la queue
     * @param {Object} message Message à mettre en queue
     */
    function queueMessage(message) {
        if (messageQueue.length >= config.maxQueueSize) {
            // Supprimer le plus ancien message (sauf les critiques)
            const oldestNonCritical = messageQueue.findIndex(m =>
                m.type !== 'position' && m.type !== 'status'
            );
            if (oldestNonCritical >= 0) {
                messageQueue.splice(oldestNonCritical, 1);
            } else {
                messageQueue.shift();
            }
        }

        messageQueue.push(message);
        AppConfig.debug(`WebSocket: Message en queue (${messageQueue.length})`);
    }

    /**
     * Vider la queue de messages
     */
    function flushMessageQueue() {
        if (messageQueue.length === 0) return;

        AppConfig.debug(`WebSocket: Envoi de ${messageQueue.length} messages en queue`);

        while (messageQueue.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
            const message = messageQueue.shift();
            socket.send(JSON.stringify(message));
        }
    }

    /**
     * Traiter un message reçu
     * @param {string} rawMessage Message brut
     */
    function handleMessage(rawMessage) {
        try {
            const message = JSON.parse(rawMessage);
            const { type, data } = message;

            // Ne pas logger les pong (trop fréquents)
            if (type !== 'pong') {
                AppConfig.debug(`WebSocket: Message reçu - ${type}`, data);
            }

            // Handler spécifique
            if (messageHandlers.has(type)) {
                messageHandlers.get(type)(data);
            }

            // Émettre l'événement
            EventBus.emit(`ws:${type}`, data);

            // Événements spéciaux
            switch (type) {
                case 'pong':
                    handlePong(data);
                    break;
                case 'position':
                    EventBus.emit(EventBus.Events.SIM_POSITION_UPDATE, data);
                    break;
                case 'ride_status':
                    EventBus.emit(EventBus.Events.RIDE_STATUS_CHANGED, data);
                    break;
                case 'driver_arrived':
                    EventBus.emit(EventBus.Events.SIM_ARRIVED, data);
                    break;
            }

        } catch (error) {
            AppConfig.debug('WebSocket: Erreur parsing message', error);
        }
    }

    /**
     * Enregistrer un handler pour un type de message
     * @param {string} type Type de message
     * @param {Function} handler Fonction de traitement
     */
    function on(type, handler) {
        messageHandlers.set(type, handler);
    }

    /**
     * Supprimer un handler
     * @param {string} type Type de message
     */
    function off(type) {
        messageHandlers.delete(type);
    }

    /**
     * Rejoindre le room d'une course
     * @param {number} rideId ID de la course
     */
    function joinRide(rideId) {
        currentRideId = rideId;
        send('join_ride', { rideId: rideId });
    }

    /**
     * Quitter le room d'une course
     * @param {number} rideId ID de la course
     */
    function leaveRide(rideId) {
        send('leave_ride', { rideId: rideId });
        if (currentRideId === rideId) {
            currentRideId = null;
        }
    }

    /**
     * Envoyer une position GPS
     * @param {number} rideId ID de la course
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     * @param {number} heading Direction
     * @param {number} speed Vitesse
     */
    function sendPosition(rideId, lat, lng, heading = null, speed = null) {
        send('position', {
            rideId: rideId,
            lat: lat,
            lng: lng,
            heading: heading,
            speed: speed
        });
    }

    /**
     * Démarrer le heartbeat
     */
    function startHeartbeat() {
        stopHeartbeat();

        // Calculer l'intervalle adaptatif si activé
        let interval = config.heartbeatInterval;
        if (config.adaptiveHeartbeat && connectionQuality.missedPongs > 0) {
            // Réduire l'intervalle si la connexion est instable
            interval = Math.max(10000, interval / 2);
        }

        heartbeatTimer = setInterval(() => {
            sendHeartbeat();
        }, interval);
    }

    /**
     * Envoyer un heartbeat et surveiller la réponse
     */
    function sendHeartbeat() {
        const pingTime = Date.now();

        // Envoyer le ping
        const sent = send('ping', { timestamp: pingTime });

        if (!sent) {
            return;
        }

        // Timeout pour le pong
        if (heartbeatTimeoutTimer) {
            clearTimeout(heartbeatTimeoutTimer);
        }

        heartbeatTimeoutTimer = setTimeout(() => {
            connectionQuality.missedPongs++;
            AppConfig.debug(`WebSocket: Pong timeout (${connectionQuality.missedPongs} missed)`);

            // Si trop de pongs manqués, forcer la reconnexion
            if (connectionQuality.missedPongs >= 3) {
                AppConfig.debug('WebSocket: Connexion instable, reconnexion...');
                forceReconnect();
            }
        }, config.heartbeatTimeout);
    }

    /**
     * Traiter la réponse pong
     * @param {Object} data Données du pong
     */
    function handlePong(data) {
        if (heartbeatTimeoutTimer) {
            clearTimeout(heartbeatTimeoutTimer);
            heartbeatTimeoutTimer = null;
        }

        // Calculer la latence
        const now = Date.now();
        if (data && data.timestamp) {
            connectionQuality.latency = now - data.timestamp;
        }

        connectionQuality.missedPongs = 0;
        lastPongTime = now;

        // Émettre les stats de connexion
        EventBus.emit('websocket:quality', {
            latency: connectionQuality.latency,
            status: getConnectionQualityStatus(),
        });
    }

    /**
     * Obtenir le statut de qualité de connexion
     * @returns {string} 'excellent', 'good', 'poor', 'critical'
     */
    function getConnectionQualityStatus() {
        if (connectionQuality.latency < 100) return 'excellent';
        if (connectionQuality.latency < 300) return 'good';
        if (connectionQuality.latency < 1000) return 'poor';
        return 'critical';
    }

    /**
     * Arrêter le heartbeat
     */
    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
        if (heartbeatTimeoutTimer) {
            clearTimeout(heartbeatTimeoutTimer);
            heartbeatTimeoutTimer = null;
        }
    }

    /**
     * Forcer une reconnexion
     */
    function forceReconnect() {
        if (socket) {
            socket.close(4000, 'Force reconnect');
        }
        reconnectAttempts = 0;
        scheduleReconnect();
    }

    /**
     * Calculer le délai de reconnexion avec exponential backoff + jitter
     * @param {number} attempt Numéro de tentative
     * @returns {number} Délai en ms
     */
    function calculateReconnectDelay(attempt) {
        // Exponential backoff: baseInterval * 2^(attempt-1)
        const exponentialDelay = config.baseReconnectInterval * Math.pow(2, attempt - 1);

        // Cap au maximum
        const cappedDelay = Math.min(exponentialDelay, config.maxReconnectInterval);

        // Ajouter du jitter (±25%) pour éviter les "thundering herd"
        const jitter = cappedDelay * config.reconnectJitterPercent * (Math.random() * 2 - 1);

        return Math.round(cappedDelay + jitter);
    }

    /**
     * Planifier une reconnexion
     */
    function scheduleReconnect() {
        // Ne pas reconnecter si déconnexion intentionnelle
        if (isIntentionalDisconnect) {
            AppConfig.debug('WebSocket: Déconnexion intentionnelle, pas de reconnexion');
            return;
        }

        // Vérifier si réseau disponible
        if (!navigator.onLine) {
            AppConfig.debug('WebSocket: Hors ligne, attente du réseau...');
            // Écouter le retour en ligne
            const onOnline = () => {
                window.removeEventListener('online', onOnline);
                AppConfig.debug('WebSocket: Réseau rétabli, reconnexion...');
                scheduleReconnect();
            };
            window.addEventListener('online', onOnline);
            return;
        }

        // Annuler le timer précédent si existant
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
        }

        reconnectAttempts++;

        if (reconnectAttempts > config.maxReconnectAttempts) {
            AppConfig.debug(`WebSocket: Max tentatives atteintes (${config.maxReconnectAttempts})`);
            EventBus.emit('websocket:maxRetriesReached', { attempts: reconnectAttempts });
            return;
        }

        const delay = calculateReconnectDelay(reconnectAttempts);

        AppConfig.debug(`WebSocket: Reconnexion dans ${Math.round(delay / 1000)}s (tentative ${reconnectAttempts}/${config.maxReconnectAttempts})`);

        EventBus.emit('websocket:reconnecting', {
            attempt: reconnectAttempts,
            maxAttempts: config.maxReconnectAttempts,
            delayMs: delay,
        });

        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                connect({ userId: userId, rideId: currentRideId });
            }
        }, delay);
    }

    /**
     * Annuler la reconnexion planifiée
     */
    function cancelReconnect() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    /**
     * Vérifier si connecté
     * @returns {boolean}
     */
    function isConnected() {
        return socket && socket.readyState === WebSocket.OPEN;
    }

    /**
     * Obtenir l'état de connexion
     * @returns {string}
     */
    function getState() {
        if (!socket) return 'disconnected';

        switch (socket.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'connected';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'disconnected';
            default: return 'unknown';
        }
    }

    /**
     * Obtenir les statistiques de connexion
     * @returns {Object} Stats
     */
    function getConnectionStats() {
        return {
            ...connectionQuality,
            isConnected: isConnected(),
            state: getState(),
            queuedMessages: messageQueue.length,
            reconnectAttempts: reconnectAttempts,
        };
    }

    /**
     * Réinitialiser les tentatives de reconnexion
     * Utile quand l'utilisateur revient sur l'app
     */
    function resetReconnectAttempts() {
        reconnectAttempts = 0;
        connectionQuality.missedPongs = 0;
    }

    // API publique
    return {
        // Lifecycle
        connect,
        disconnect,
        forceReconnect,

        // Messaging
        send,
        on,
        off,

        // Ride management
        joinRide,
        leaveRide,
        sendPosition,

        // Status
        isConnected,
        getState,
        getConnectionStats,

        // Utilities
        resetReconnectAttempts,
        cancelReconnect,
        flushMessageQueue,
    };
})();

// Exposer globalement
window.WebSocketService = WebSocketService;
