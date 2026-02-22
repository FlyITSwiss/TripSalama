/**
 * TripSalama - Background Geolocation Service
 * Tracking en arrière-plan pour Capacitor (iOS/Android) et PWA
 */

'use strict';

const BackgroundGeolocation = (function() {
    // Configuration
    const config = {
        // Général
        desiredAccuracy: 'high',        // 'high', 'medium', 'low'
        distanceFilter: 10,              // Mètres minimum entre updates
        stationaryRadius: 25,            // Rayon considéré comme stationnaire
        stopOnTerminate: false,          // Continuer après fermeture app
        startOnBoot: true,               // Démarrer au boot
        enableHeadless: true,            // Mode headless

        // Intervalle
        interval: 5000,                  // Intervalle en ms (actif)
        fastestInterval: 1000,           // Intervalle minimum
        activitiesInterval: 10000,       // Intervalle détection activité

        // Batterie
        preventSuspend: true,
        heartbeatInterval: 60,           // Heartbeat toutes les 60s

        // Notifications (Android)
        notification: {
            title: 'TripSalama',
            text: 'Course en cours...',
            icon: 'notification_icon',
            color: '#2D5A4A',
            channelName: 'Tracking',
        },

        // Debug
        debug: false,
        logLevel: 'OFF',                 // 'OFF', 'ERROR', 'WARNING', 'INFO', 'DEBUG', 'VERBOSE'
    };

    // État
    let isTracking = false;
    let currentRideId = null;
    let watchId = null;
    let lastPosition = null;
    let onPositionCallback = null;
    let positionBuffer = [];
    let bufferFlushInterval = null;

    /**
     * Vérifier si Capacitor est disponible
     */
    function isCapacitor() {
        return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    }

    /**
     * Vérifier si la géoloc en background est supportée
     */
    function isSupported() {
        if (isCapacitor()) {
            return true;
        }

        // PWA - vérifier l'API Geolocation
        return 'geolocation' in navigator;
    }

    /**
     * Initialiser le service
     * @param {Object} options Options de configuration
     */
    async function init(options = {}) {
        Object.assign(config, options);

        if (isCapacitor()) {
            return initCapacitor();
        }

        return initPWA();
    }

    /**
     * Initialiser pour Capacitor (natif)
     */
    async function initCapacitor() {
        try {
            const { Geolocation } = await import('@capacitor/geolocation');
            const { BackgroundGeolocation: BGGeo } = await import('@capacitor-community/background-geolocation');

            // Configurer le plugin natif
            await BGGeo.configure({
                locationProvider: BGGeo.ACTIVITY_PROVIDER,
                desiredAccuracy: BGGeo.HIGH_ACCURACY,
                stationaryRadius: config.stationaryRadius,
                distanceFilter: config.distanceFilter,
                notificationTitle: config.notification.title,
                notificationText: config.notification.text,
                debug: config.debug,
                interval: config.interval,
                fastestInterval: config.fastestInterval,
                activitiesInterval: config.activitiesInterval,
                stopOnTerminate: config.stopOnTerminate,
                startOnBoot: config.startOnBoot,
            });

            // Écouter les positions
            BGGeo.onLocation((location) => {
                handlePosition({
                    lat: location.latitude,
                    lng: location.longitude,
                    accuracy: location.accuracy,
                    heading: location.bearing,
                    speed: location.speed,
                    timestamp: location.time,
                });
            });

            // Écouter les erreurs
            BGGeo.onError((error) => {
                AppConfig.debug('BackgroundGeolocation: Erreur', error);
                EventBus.emit('geolocation:error', error);
            });

            AppConfig.debug('BackgroundGeolocation: Initialisé (Capacitor)');
            return true;

        } catch (error) {
            AppConfig.debug('BackgroundGeolocation: Erreur init Capacitor', error);
            return false;
        }
    }

    /**
     * Initialiser pour PWA (navigateur)
     */
    async function initPWA() {
        // Vérifier les permissions
        if (!('geolocation' in navigator)) {
            AppConfig.debug('BackgroundGeolocation: Non supporté');
            return false;
        }

        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });

            if (permission.state === 'denied') {
                AppConfig.debug('BackgroundGeolocation: Permission refusée');
                return false;
            }

            AppConfig.debug('BackgroundGeolocation: Initialisé (PWA)');
            return true;

        } catch (error) {
            AppConfig.debug('BackgroundGeolocation: Erreur permissions', error);
            return true; // Continuer quand même
        }
    }

    /**
     * Démarrer le tracking
     * @param {number} rideId ID de la course
     * @param {Function} onPosition Callback à chaque position
     */
    async function startTracking(rideId, onPosition = null) {
        if (isTracking) {
            AppConfig.debug('BackgroundGeolocation: Déjà en cours');
            return;
        }

        currentRideId = rideId;
        onPositionCallback = onPosition;
        isTracking = true;
        positionBuffer = [];

        EventBus.emit('geolocation:started', { rideId });

        if (isCapacitor()) {
            await startCapacitorTracking();
        } else {
            startPWATracking();
        }

        // Démarrer le flush du buffer
        bufferFlushInterval = setInterval(flushBuffer, 10000); // 10 secondes

        AppConfig.debug('BackgroundGeolocation: Tracking démarré', { rideId });
    }

    /**
     * Démarrer le tracking Capacitor
     */
    async function startCapacitorTracking() {
        try {
            const { BackgroundGeolocation: BGGeo } = await import('@capacitor-community/background-geolocation');
            await BGGeo.start();
        } catch (error) {
            AppConfig.debug('BackgroundGeolocation: Erreur start Capacitor', error);
            // Fallback vers PWA
            startPWATracking();
        }
    }

    /**
     * Démarrer le tracking PWA
     */
    function startPWATracking() {
        const options = {
            enableHighAccuracy: config.desiredAccuracy === 'high',
            timeout: 15000,
            maximumAge: 0,
        };

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                handlePosition({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: position.timestamp,
                });
            },
            (error) => {
                AppConfig.debug('BackgroundGeolocation: Erreur PWA', error);
                EventBus.emit('geolocation:error', error);
            },
            options
        );
    }

    /**
     * Arrêter le tracking
     */
    async function stopTracking() {
        if (!isTracking) return;

        isTracking = false;

        // Flush final du buffer
        await flushBuffer();

        if (bufferFlushInterval) {
            clearInterval(bufferFlushInterval);
            bufferFlushInterval = null;
        }

        if (isCapacitor()) {
            try {
                const { BackgroundGeolocation: BGGeo } = await import('@capacitor-community/background-geolocation');
                await BGGeo.stop();
            } catch (error) {
                AppConfig.debug('BackgroundGeolocation: Erreur stop Capacitor', error);
            }
        }

        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }

        EventBus.emit('geolocation:stopped', { rideId: currentRideId });

        currentRideId = null;
        onPositionCallback = null;
        lastPosition = null;

        AppConfig.debug('BackgroundGeolocation: Tracking arrêté');
    }

    /**
     * Traiter une nouvelle position
     * @param {Object} position Données de position
     */
    function handlePosition(position) {
        // Vérifier si la position a changé significativement
        if (lastPosition) {
            const distance = calculateDistance(
                lastPosition.lat, lastPosition.lng,
                position.lat, position.lng
            );

            // Ignorer si mouvement < distanceFilter
            if (distance < config.distanceFilter / 1000) {
                return;
            }
        }

        lastPosition = position;

        // Ajouter au buffer
        positionBuffer.push({
            rideId: currentRideId,
            ...position,
        });

        // Callback utilisateur
        if (onPositionCallback) {
            onPositionCallback(position);
        }

        // Émettre l'événement
        EventBus.emit('geolocation:position', position);
        EventBus.emit(EventBus.Events.SIM_POSITION_UPDATE, {
            lat: position.lat,
            lng: position.lng,
            heading: position.heading,
            speed: position.speed,
        });

        // Sauvegarder hors-ligne
        if (window.OfflineSync) {
            OfflineSync.savePosition(
                currentRideId,
                position.lat,
                position.lng,
                position.heading,
                position.speed
            );
        }
    }

    /**
     * Vider le buffer vers le serveur
     */
    async function flushBuffer() {
        if (positionBuffer.length === 0) return;

        const positions = [...positionBuffer];
        positionBuffer = [];

        try {
            // Envoyer via WebSocket si disponible
            if (window.WebSocketService && WebSocketService.isConnected()) {
                for (const pos of positions) {
                    WebSocketService.sendPosition(
                        pos.rideId,
                        pos.lat,
                        pos.lng,
                        pos.heading,
                        pos.speed
                    );
                }
            } else {
                // Fallback API REST
                await ApiService.post('rides', {
                    action: 'batch-positions',
                    positions: positions.map(p => ({
                        ride_id: p.rideId,
                        lat: p.lat,
                        lng: p.lng,
                        heading: p.heading,
                        speed: p.speed,
                        timestamp: p.timestamp,
                    })),
                });
            }

        } catch (error) {
            AppConfig.debug('BackgroundGeolocation: Erreur flush buffer', error);
            // Remettre dans le buffer
            positionBuffer = positions.concat(positionBuffer);
        }
    }

    /**
     * Obtenir la position actuelle
     * @returns {Promise<Object>} Position
     */
    async function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: position.timestamp,
                    });
                },
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                }
            );
        });
    }

    /**
     * Calculer la distance entre deux points (Haversine)
     */
    function calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Rayon Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Vérifier si le tracking est actif
     */
    function isActive() {
        return isTracking;
    }

    /**
     * Obtenir la dernière position connue
     */
    function getLastPosition() {
        return lastPosition;
    }

    // API publique
    return {
        init,
        isSupported,
        startTracking,
        stopTracking,
        getCurrentPosition,
        isActive,
        getLastPosition,
    };
})();

// Exposer globalement
window.BackgroundGeolocation = BackgroundGeolocation;
