/**
 * TripSalama - Background Geolocation Service
 * Tracking en arrière-plan pour Capacitor (iOS/Android) et PWA
 *
 * Améliorations v2.0:
 * - Modes de batterie adaptatifs (performance, balanced, power-saving)
 * - Filtrage de précision intelligent
 * - Détection automatique du mouvement (driving/idle)
 * - Gestion optimisée de la batterie Android
 */

'use strict';

const BackgroundGeolocation = (function() {
    // Modes de batterie
    const BATTERY_MODES = {
        PERFORMANCE: {
            name: 'performance',
            distanceFilter: 5,           // 5m - très précis
            interval: 2000,              // 2s
            desiredAccuracy: 'high',
            stationaryRadius: 15,
        },
        BALANCED: {
            name: 'balanced',
            distanceFilter: 10,          // 10m - équilibré
            interval: 5000,              // 5s
            desiredAccuracy: 'high',
            stationaryRadius: 25,
        },
        POWER_SAVING: {
            name: 'power-saving',
            distanceFilter: 25,          // 25m - économie
            interval: 15000,             // 15s
            desiredAccuracy: 'medium',
            stationaryRadius: 50,
        },
    };

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

        // Filtrage de précision
        minAccuracy: 50,                 // Ignorer positions avec précision > 50m
        maxSpeedKmh: 200,                // Ignorer vitesses > 200 km/h (GPS error)
        minSpeedKmh: 2,                  // Considérer immobile si < 2 km/h

        // Notifications (Android)
        notification: {
            title: 'TripSalama',
            text: 'Course en cours...',
            icon: 'notification_icon',
            color: '#2D5A4A',
            channelName: 'Tracking',
            priority: 'high',            // Éviter le kill par Android
            sticky: true,                // Notification persistante
        },

        // Android spécifique
        android: {
            foregroundService: true,     // Service foreground obligatoire
            notificationChannelImportance: 'high',
            allowIdenticalLocations: false,
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
    let currentBatteryMode = BATTERY_MODES.BALANCED;
    let movementState = 'idle';          // 'idle', 'moving', 'driving'
    let consecutiveIdleCount = 0;
    let batteryLevel = 100;

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
                EventBus.emit('geolocation:permissionDenied');
                return false;
            }

            // Écouter les changements de permission
            permission.addEventListener('change', () => {
                AppConfig.debug(`BackgroundGeolocation: Permission → ${permission.state}`);
                EventBus.emit('geolocation:permissionChanged', { state: permission.state });

                if (permission.state === 'denied' && isTracking) {
                    stopTracking();
                }
            });

            // Initialiser le monitoring batterie
            await initBatteryMonitor();

            AppConfig.debug('BackgroundGeolocation: Initialisé (PWA)');
            return true;

        } catch (error) {
            AppConfig.debug('BackgroundGeolocation: Erreur permissions', error);
            // Continuer quand même, on testera au moment du tracking
            await initBatteryMonitor();
            return true;
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
            enableHighAccuracy: currentBatteryMode.desiredAccuracy === 'high',
            timeout: 15000,
            maximumAge: currentBatteryMode.interval / 2, // Cache adaptatif
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
                handleGeolocationError(error);
            },
            options
        );
    }

    /**
     * Gérer les erreurs de géolocalisation
     * @param {GeolocationPositionError} error Erreur
     */
    function handleGeolocationError(error) {
        let errorMessage = 'Erreur inconnue';
        let shouldRetry = false;

        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Permission de localisation refusée';
                EventBus.emit('geolocation:permissionDenied');
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Position indisponible (GPS désactivé ?)';
                shouldRetry = true;
                break;
            case error.TIMEOUT:
                errorMessage = 'Délai de localisation dépassé';
                shouldRetry = true;
                break;
        }

        AppConfig.debug(`BackgroundGeolocation: ${errorMessage}`, error);
        EventBus.emit('geolocation:error', { code: error.code, message: errorMessage });

        // Retry après 5s si erreur temporaire
        if (shouldRetry && isTracking) {
            setTimeout(() => {
                if (isTracking && watchId === null) {
                    AppConfig.debug('BackgroundGeolocation: Retry après erreur');
                    startPWATracking();
                }
            }, 5000);
        }
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
        // Filtrage de précision - ignorer les positions imprécises
        if (!isValidPosition(position)) {
            AppConfig.debug('BackgroundGeolocation: Position ignorée (précision insuffisante)', {
                accuracy: position.accuracy,
                speed: position.speed,
            });
            return;
        }

        // Vérifier si la position a changé significativement
        if (lastPosition) {
            const distance = calculateDistance(
                lastPosition.lat, lastPosition.lng,
                position.lat, position.lng
            );

            // Ignorer si mouvement < distanceFilter actuel
            if (distance < currentBatteryMode.distanceFilter / 1000) {
                return;
            }

            // Calculer la vitesse réelle entre les deux points
            const timeDiff = (position.timestamp - lastPosition.timestamp) / 1000; // en secondes
            if (timeDiff > 0) {
                const calculatedSpeedKmh = (distance / timeDiff) * 3600;
                position.calculatedSpeed = calculatedSpeedKmh;
            }
        }

        // Détecter l'état de mouvement et ajuster le mode batterie
        detectMovementState(position);

        lastPosition = position;

        // Ajouter au buffer
        positionBuffer.push({
            rideId: currentRideId,
            batteryMode: currentBatteryMode.name,
            movementState: movementState,
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
     * Valider une position GPS
     * @param {Object} position Position à valider
     * @returns {boolean} true si valide
     */
    function isValidPosition(position) {
        // Vérifier la précision
        if (position.accuracy && position.accuracy > config.minAccuracy) {
            return false;
        }

        // Vérifier la vitesse (si disponible)
        if (position.speed !== null && position.speed !== undefined) {
            const speedKmh = position.speed * 3.6; // m/s → km/h

            // Vitesse impossible (GPS error)
            if (speedKmh > config.maxSpeedKmh) {
                return false;
            }
        }

        // Vérifier les coordonnées valides
        if (position.lat < -90 || position.lat > 90 ||
            position.lng < -180 || position.lng > 180) {
            return false;
        }

        return true;
    }

    /**
     * Détecter l'état de mouvement et ajuster le mode batterie
     * @param {Object} position Position actuelle
     */
    function detectMovementState(position) {
        const speedKmh = position.speed ? position.speed * 3.6 : 0;

        // Déterminer l'état de mouvement
        let newState = movementState;

        if (speedKmh < config.minSpeedKmh) {
            consecutiveIdleCount++;
            if (consecutiveIdleCount >= 3) {
                newState = 'idle';
            }
        } else if (speedKmh > 30) {
            newState = 'driving';
            consecutiveIdleCount = 0;
        } else {
            newState = 'moving';
            consecutiveIdleCount = 0;
        }

        // Changement d'état détecté
        if (newState !== movementState) {
            movementState = newState;
            AppConfig.debug(`BackgroundGeolocation: État mouvement → ${movementState}`);
            EventBus.emit('geolocation:movementStateChanged', { state: movementState });

            // Ajuster le mode batterie automatiquement
            autoAdjustBatteryMode();
        }
    }

    /**
     * Ajuster automatiquement le mode batterie selon l'état
     */
    function autoAdjustBatteryMode() {
        let newMode;

        // Si batterie faible, forcer power-saving
        if (batteryLevel < 20) {
            newMode = BATTERY_MODES.POWER_SAVING;
        } else if (movementState === 'driving') {
            // Conduite → performance pour précision
            newMode = BATTERY_MODES.PERFORMANCE;
        } else if (movementState === 'idle') {
            // Immobile → économie
            newMode = BATTERY_MODES.POWER_SAVING;
        } else {
            // Mouvement normal → équilibré
            newMode = BATTERY_MODES.BALANCED;
        }

        if (newMode !== currentBatteryMode) {
            setBatteryMode(newMode.name);
        }
    }

    /**
     * Définir le mode batterie
     * @param {string} mode 'performance', 'balanced', 'power-saving'
     */
    function setBatteryMode(mode) {
        const modeConfig = BATTERY_MODES[mode.toUpperCase().replace('-', '_')] ||
                          BATTERY_MODES.BALANCED;

        currentBatteryMode = modeConfig;
        AppConfig.debug(`BackgroundGeolocation: Mode batterie → ${modeConfig.name}`);

        // Mettre à jour la config PWA si actif
        if (isTracking && watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            startPWATracking();
        }

        EventBus.emit('geolocation:batteryModeChanged', { mode: modeConfig.name });
    }

    /**
     * Écouter le niveau de batterie (si disponible)
     */
    async function initBatteryMonitor() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                batteryLevel = Math.round(battery.level * 100);

                battery.addEventListener('levelchange', () => {
                    batteryLevel = Math.round(battery.level * 100);
                    AppConfig.debug(`BackgroundGeolocation: Batterie ${batteryLevel}%`);

                    // Ajuster si nécessaire
                    if (isTracking) {
                        autoAdjustBatteryMode();
                    }
                });
            } catch (error) {
                AppConfig.debug('BackgroundGeolocation: Battery API non disponible');
            }
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

    /**
     * Obtenir le mode batterie actuel
     * @returns {Object} Configuration du mode
     */
    function getBatteryMode() {
        return currentBatteryMode;
    }

    /**
     * Obtenir l'état de mouvement
     * @returns {string} 'idle', 'moving', 'driving'
     */
    function getMovementState() {
        return movementState;
    }

    /**
     * Obtenir les statistiques de tracking
     * @returns {Object} Stats
     */
    function getStats() {
        return {
            isTracking,
            rideId: currentRideId,
            batteryMode: currentBatteryMode.name,
            movementState,
            batteryLevel,
            bufferSize: positionBuffer.length,
            lastPosition: lastPosition ? {
                lat: lastPosition.lat,
                lng: lastPosition.lng,
                accuracy: lastPosition.accuracy,
                timestamp: lastPosition.timestamp,
            } : null,
        };
    }

    // API publique
    return {
        // Lifecycle
        init,
        isSupported,
        startTracking,
        stopTracking,

        // Position
        getCurrentPosition,
        getLastPosition,

        // État
        isActive,
        getStats,
        getMovementState,

        // Configuration batterie
        setBatteryMode,
        getBatteryMode,
        BATTERY_MODES,
    };
})();

// Exposer globalement
window.BackgroundGeolocation = BackgroundGeolocation;
