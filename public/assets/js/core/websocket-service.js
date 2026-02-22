/**
 * TripSalama - WebSocket Service
 * Connexion temps réel pour le tracking véhicule
 */

'use strict';

const WebSocketService = (function() {
    // Configuration
    const config = {
        reconnectInterval: 3000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000,
        wsPath: '/ws'
    };

    // État
    let socket = null;
    let reconnectAttempts = 0;
    let heartbeatTimer = null;
    let isConnecting = false;
    let userId = null;
    let currentRideId = null;
    let messageHandlers = new Map();

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
                    reconnectAttempts = 0;

                    // Authentification
                    if (userId) {
                        send('auth', { userId: userId });
                    }

                    // Rejoindre le room de la course
                    if (currentRideId) {
                        joinRide(currentRideId);
                    }

                    // Démarrer le heartbeat
                    startHeartbeat();

                    EventBus.emit('websocket:connected');
                    resolve();
                };

                socket.onmessage = (event) => {
                    handleMessage(event.data);
                };

                socket.onclose = (event) => {
                    AppConfig.debug(`WebSocket: Fermé (code: ${event.code})`);
                    isConnecting = false;
                    stopHeartbeat();

                    EventBus.emit('websocket:disconnected');

                    // Reconnecter si pas fermé intentionnellement
                    if (event.code !== 1000 && reconnectAttempts < config.maxReconnectAttempts) {
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
     */
    function disconnect() {
        stopHeartbeat();

        if (socket) {
            socket.close(1000, 'Déconnexion normale');
            socket = null;
        }

        reconnectAttempts = 0;
        isConnecting = false;
    }

    /**
     * Envoyer un message
     * @param {string} type Type de message
     * @param {Object} data Données
     */
    function send(type, data = {}) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            AppConfig.debug('WebSocket: Non connecté, message ignoré');
            return false;
        }

        const message = JSON.stringify({
            type: type,
            data: data,
            timestamp: Date.now()
        });

        socket.send(message);
        return true;
    }

    /**
     * Traiter un message reçu
     * @param {string} rawMessage Message brut
     */
    function handleMessage(rawMessage) {
        try {
            const message = JSON.parse(rawMessage);
            const { type, data } = message;

            AppConfig.debug(`WebSocket: Message reçu - ${type}`, data);

            // Handler spécifique
            if (messageHandlers.has(type)) {
                messageHandlers.get(type)(data);
            }

            // Émettre l'événement
            EventBus.emit(`ws:${type}`, data);

            // Événements spéciaux
            switch (type) {
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
        heartbeatTimer = setInterval(() => {
            send('ping');
        }, config.heartbeatInterval);
    }

    /**
     * Arrêter le heartbeat
     */
    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    /**
     * Planifier une reconnexion
     */
    function scheduleReconnect() {
        reconnectAttempts++;
        const delay = config.reconnectInterval * Math.pow(1.5, reconnectAttempts - 1);

        AppConfig.debug(`WebSocket: Reconnexion dans ${Math.round(delay / 1000)}s (tentative ${reconnectAttempts}/${config.maxReconnectAttempts})`);

        setTimeout(() => {
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                connect({ userId: userId, rideId: currentRideId });
            }
        }, delay);
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

    // API publique
    return {
        connect,
        disconnect,
        send,
        on,
        off,
        joinRide,
        leaveRide,
        sendPosition,
        isConnected,
        getState
    };
})();

// Exposer globalement
window.WebSocketService = WebSocketService;
