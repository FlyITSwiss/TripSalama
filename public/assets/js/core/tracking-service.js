/**
 * TripSalama - Tracking Service
 * Service de suivi en temps réel pour courses et véhicules
 * Mobile-ready avec support PWA et background sync
 */

'use strict';

const TrackingService = (function() {
    // Configuration
    const config = {
        // Intervalle de mise à jour position (ms)
        updateInterval: 3000,
        // Intervalle minimum entre deux envois au serveur (ms)
        minServerUpdateInterval: 5000,
        // Distance minimum pour déclencher une mise à jour (mètres)
        minDistanceChange: 10,
        // Timeout pour considérer une position comme périmée (ms)
        positionTimeout: 30000,
        // Nombre de positions à garder en historique
        historyLength: 50,
        // API endpoint pour les mises à jour
        apiEndpoint: 'rides'
    };

    // État
    let isTracking = false;
    let currentRideId = null;
    let userType = null; // 'passenger' ou 'driver'
    let positionHistory = [];
    let lastServerUpdate = 0;
    let trackingInterval = null;
    let serviceWorkerRegistration = null;

    // Statistiques de trajet
    let tripStats = {
        startTime: null,
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        lastPosition: null
    };

    /**
     * Initialiser le service
     * @param {Object} options - Options de configuration
     */
    function init(options = {}) {
        Object.assign(config, options);

        // Enregistrer les événements
        registerEvents();

        // Vérifier le support Service Worker pour background sync
        checkServiceWorkerSupport();

        AppConfig.debug('TrackingService initialized');
    }

    /**
     * Démarrer le tracking pour une course
     * @param {number} rideId - ID de la course
     * @param {string} type - 'passenger' ou 'driver'
     */
    async function startTracking(rideId, type = 'passenger') {
        if (isTracking) {
            stopTracking();
        }

        currentRideId = rideId;
        userType = type;
        isTracking = true;

        // Réinitialiser les stats
        tripStats = {
            startTime: Date.now(),
            totalDistance: 0,
            averageSpeed: 0,
            maxSpeed: 0,
            lastPosition: null
        };
        positionHistory = [];

        // Démarrer le suivi GPS
        GeoLocationService.startWatching(handlePositionUpdate, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        });

        // Timer de backup pour les mises à jour serveur
        trackingInterval = setInterval(sendPositionToServer, config.minServerUpdateInterval);

        EventBus.emit(EventBus.Events.TRACKING_STARTED, { rideId, type });

        // Enregistrer pour background sync si disponible
        if (serviceWorkerRegistration && 'sync' in serviceWorkerRegistration) {
            try {
                await serviceWorkerRegistration.sync.register('position-sync');
            } catch (e) {
                AppConfig.debug('Background sync registration failed:', e);
            }
        }

        AppConfig.debug('Tracking started for ride:', rideId);
    }

    /**
     * Arrêter le tracking
     */
    function stopTracking() {
        if (!isTracking) return;

        isTracking = false;
        GeoLocationService.stopWatching();

        if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = null;
        }

        const finalStats = { ...tripStats };
        finalStats.endTime = Date.now();
        finalStats.duration = finalStats.endTime - finalStats.startTime;

        EventBus.emit(EventBus.Events.TRACKING_STOPPED, {
            rideId: currentRideId,
            stats: finalStats
        });

        currentRideId = null;
        userType = null;

        AppConfig.debug('Tracking stopped');
    }

    /**
     * Gérer la mise à jour de position
     * @param {Object} position - Position du GeoLocationService
     * @param {Object} error - Erreur éventuelle
     */
    function handlePositionUpdate(position, error) {
        if (error) {
            EventBus.emit(EventBus.Events.TRACKING_ERROR, error);
            return;
        }

        if (!isTracking) return;

        // Ajouter à l'historique
        positionHistory.push({
            ...position,
            recordedAt: Date.now()
        });

        // Limiter la taille de l'historique
        if (positionHistory.length > config.historyLength) {
            positionHistory.shift();
        }

        // Calculer les statistiques
        updateTripStats(position);

        // Émettre l'événement de mise à jour
        EventBus.emit(EventBus.Events.TRACKING_POSITION_UPDATE, {
            rideId: currentRideId,
            position,
            stats: tripStats
        });

        // Envoyer au serveur si nécessaire
        checkAndSendToServer(position);
    }

    /**
     * Mettre à jour les statistiques du trajet
     */
    function updateTripStats(position) {
        if (tripStats.lastPosition) {
            // Calculer la distance depuis la dernière position
            const distance = GeoLocationService.calculateDistance(
                tripStats.lastPosition,
                position
            );

            tripStats.totalDistance += distance;

            // Calculer la vitesse
            if (position.speed !== null && position.speed > 0) {
                const speedKmh = position.speed * 3.6; // m/s to km/h
                if (speedKmh > tripStats.maxSpeed) {
                    tripStats.maxSpeed = speedKmh;
                }
            }
        }

        // Calculer la vitesse moyenne
        const elapsedHours = (Date.now() - tripStats.startTime) / 3600000;
        if (elapsedHours > 0) {
            tripStats.averageSpeed = (tripStats.totalDistance / 1000) / elapsedHours;
        }

        tripStats.lastPosition = position;
    }

    /**
     * Vérifier et envoyer la position au serveur
     */
    function checkAndSendToServer(position) {
        const now = Date.now();

        // Vérifier l'intervalle minimum
        if (now - lastServerUpdate < config.minServerUpdateInterval) {
            return;
        }

        // Vérifier la distance minimum (sauf pour la première mise à jour)
        if (tripStats.lastPosition && positionHistory.length > 1) {
            const lastSentPosition = positionHistory[positionHistory.length - 2];
            const distance = GeoLocationService.calculateDistance(lastSentPosition, position);

            if (distance < config.minDistanceChange) {
                return;
            }
        }

        sendPositionToServer();
    }

    /**
     * Envoyer la position au serveur
     */
    async function sendPositionToServer() {
        if (!isTracking || !currentRideId || positionHistory.length === 0) {
            return;
        }

        const latestPosition = positionHistory[positionHistory.length - 1];

        try {
            await ApiService.post(config.apiEndpoint, {
                action: 'position',
                ride_id: currentRideId,
                lat: latestPosition.lat,
                lng: latestPosition.lng,
                accuracy: latestPosition.accuracy,
                heading: latestPosition.heading,
                speed: latestPosition.speed,
                timestamp: latestPosition.timestamp
            });

            lastServerUpdate = Date.now();

            EventBus.emit(EventBus.Events.TRACKING_SYNC_SUCCESS, {
                rideId: currentRideId,
                position: latestPosition
            });

        } catch (error) {
            AppConfig.debug('Position sync error:', error);

            EventBus.emit(EventBus.Events.TRACKING_SYNC_ERROR, {
                rideId: currentRideId,
                error
            });

            // Stocker pour sync ultérieur (offline support)
            storeForLaterSync(latestPosition);
        }
    }

    /**
     * Stocker la position pour synchronisation ultérieure
     */
    function storeForLaterSync(position) {
        try {
            const pendingPositions = JSON.parse(localStorage.getItem('pendingPositions') || '[]');
            pendingPositions.push({
                rideId: currentRideId,
                ...position,
                storedAt: Date.now()
            });

            // Limiter le stockage
            if (pendingPositions.length > 100) {
                pendingPositions.splice(0, pendingPositions.length - 100);
            }

            localStorage.setItem('pendingPositions', JSON.stringify(pendingPositions));
        } catch (e) {
            AppConfig.debug('Failed to store position for later sync:', e);
        }
    }

    /**
     * Synchroniser les positions en attente
     */
    async function syncPendingPositions() {
        try {
            const pendingPositions = JSON.parse(localStorage.getItem('pendingPositions') || '[]');

            if (pendingPositions.length === 0) return;

            for (const position of pendingPositions) {
                await ApiService.post(config.apiEndpoint, {
                    action: 'position',
                    ride_id: position.rideId,
                    lat: position.lat,
                    lng: position.lng,
                    accuracy: position.accuracy,
                    heading: position.heading,
                    speed: position.speed,
                    timestamp: position.timestamp
                });
            }

            localStorage.removeItem('pendingPositions');

            EventBus.emit(EventBus.Events.TRACKING_PENDING_SYNCED, {
                count: pendingPositions.length
            });

        } catch (error) {
            AppConfig.debug('Failed to sync pending positions:', error);
        }
    }

    /**
     * Obtenir les statistiques actuelles du trajet
     */
    function getTripStats() {
        return { ...tripStats };
    }

    /**
     * Obtenir l'historique des positions
     */
    function getPositionHistory() {
        return [...positionHistory];
    }

    /**
     * Obtenir la dernière position
     */
    function getLastPosition() {
        return positionHistory.length > 0
            ? positionHistory[positionHistory.length - 1]
            : null;
    }

    /**
     * Calculer l'ETA vers une destination
     * @param {Object} destination - {lat, lng}
     * @returns {Object} {distance, duration, eta}
     */
    function calculateETA(destination) {
        const currentPos = getLastPosition();
        if (!currentPos || !destination) return null;

        const distance = GeoLocationService.calculateDistance(currentPos, destination);

        // Utiliser la vitesse actuelle ou une vitesse par défaut (30 km/h en ville)
        let speed = currentPos.speed ? currentPos.speed * 3.6 : 30;
        if (speed < 5) speed = 30; // Vitesse minimum

        const durationHours = (distance / 1000) / speed;
        const durationMinutes = Math.ceil(durationHours * 60);

        return {
            distance: Math.round(distance),
            distanceKm: (distance / 1000).toFixed(2),
            durationMinutes,
            durationFormatted: formatDuration(durationMinutes),
            eta: new Date(Date.now() + durationMinutes * 60000)
        };
    }

    /**
     * Formater la durée
     */
    function formatDuration(minutes) {
        if (minutes < 1) return '< 1 min';
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }

    /**
     * Vérifier le support Service Worker
     */
    async function checkServiceWorkerSupport() {
        if ('serviceWorker' in navigator) {
            try {
                serviceWorkerRegistration = await navigator.serviceWorker.ready;
            } catch (e) {
                AppConfig.debug('Service Worker not available:', e);
            }
        }
    }

    /**
     * Enregistrer les événements EventBus
     */
    function registerEvents() {
        if (typeof EventBus !== 'undefined' && EventBus.Events) {
            const trackingEvents = {
                TRACKING_STARTED: 'tracking:started',
                TRACKING_STOPPED: 'tracking:stopped',
                TRACKING_POSITION_UPDATE: 'tracking:position:update',
                TRACKING_ERROR: 'tracking:error',
                TRACKING_SYNC_SUCCESS: 'tracking:sync:success',
                TRACKING_SYNC_ERROR: 'tracking:sync:error',
                TRACKING_PENDING_SYNCED: 'tracking:pending:synced'
            };

            Object.assign(EventBus.Events, trackingEvents);
        }
    }

    /**
     * Vérifier si le tracking est actif
     */
    function isActive() {
        return isTracking;
    }

    /**
     * Obtenir l'ID de la course en cours
     */
    function getCurrentRideId() {
        return currentRideId;
    }

    // API publique
    return {
        init,
        startTracking,
        stopTracking,
        isActive,
        getCurrentRideId,
        getTripStats,
        getPositionHistory,
        getLastPosition,
        calculateETA,
        syncPendingPositions,
        config
    };
})();

// Rendre disponible globalement
window.TrackingService = TrackingService;
