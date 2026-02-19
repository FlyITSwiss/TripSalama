/**
 * TripSalama - Uber Style Tracker
 * Tracking véhicule niveau Uber avec:
 * - Interpolation fluide entre positions GPS
 * - Rotation du véhicule selon la direction
 * - Animation 60fps optimisée mobile
 * - ETA dynamique basé sur progression réelle
 * - Support mode réel + simulation
 */

'use strict';

const UberStyleTracker = (function() {
    // === CONFIGURATION ===
    const config = {
        // Animation
        fps: 60,
        interpolationDuration: 1000, // ms pour interpoler entre 2 positions
        rotationSmoothing: 0.15, // Facteur de lissage rotation (0-1)

        // Vitesse simulation
        baseSpeedKmh: 40,
        minSpeedKmh: 5,
        maxSpeedKmh: 120,

        // ETA
        etaUpdateInterval: 2000, // ms
        trafficFactor: 1.2, // Facteur trafic (1.0 = pas de trafic)

        // Route
        routePassedColor: 'rgba(45, 90, 74, 0.3)', // Route parcourue (faded)
        routeRemainingColor: '#2D5A4A', // Route restante
        routeWeight: 5,

        // Mobile optimizations
        reducedMotion: false,
        lowPowerMode: false
    };

    // === ÉTAT ===
    let map = null;
    let vehicleMarker = null;
    let routeLayerPassed = null;
    let routeLayerRemaining = null;

    // Route
    let fullRoutePoints = [];
    let currentSegmentIndex = 0;
    let segmentProgress = 0; // 0-1 dans le segment actuel

    // Animation
    let isRunning = false;
    let isPaused = false;
    let animationFrameId = null;
    let lastFrameTime = 0;
    let speedMultiplier = 1;

    // Position interpolée
    let currentPosition = { lat: 0, lng: 0 };
    let targetPosition = { lat: 0, lng: 0 };
    let currentHeading = 0;
    let targetHeading = 0;

    // Stats
    let stats = {
        startTime: null,
        distanceCovered: 0,
        distanceRemaining: 0,
        etaMinutes: 0,
        currentSpeedKmh: 0,
        progress: 0
    };

    // Callbacks
    let onPositionUpdate = null;
    let onArrival = null;
    let onETAUpdate = null;

    // === INITIALISATION ===

    /**
     * Initialiser le tracker
     * @param {Object} options - Configuration
     */
    function init(options = {}) {
        Object.assign(config, options);

        // Détecter les préférences utilisateur
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            config.reducedMotion = true;
        }

        // Détecter le mode économie d'énergie
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                if (battery.level < 0.2 && !battery.charging) {
                    config.lowPowerMode = true;
                    config.fps = 30;
                }
            });
        }

        map = MapController.getMap();

        AppConfig.debug('UberStyleTracker initialized');
    }

    /**
     * Démarrer le tracking sur une route
     * @param {string|Array} route - Polyline encodée ou tableau de [lat, lng]
     * @param {Object} options - Options
     */
    function start(route, options = {}) {
        if (isRunning) stop();

        // Décoder la route si nécessaire
        if (typeof route === 'string') {
            fullRoutePoints = MapController.decodePolyline(route);
        } else {
            fullRoutePoints = route;
        }

        if (fullRoutePoints.length < 2) {
            AppConfig.debug('UberStyleTracker: Route trop courte');
            return false;
        }

        // Callbacks
        onPositionUpdate = options.onPositionUpdate || null;
        onArrival = options.onArrival || null;
        onETAUpdate = options.onETAUpdate || null;

        // Initialiser l'état
        currentSegmentIndex = 0;
        segmentProgress = 0;
        isRunning = true;
        isPaused = false;

        // Position initiale
        const startPoint = fullRoutePoints[0];
        currentPosition = { lat: startPoint[0], lng: startPoint[1] };
        targetPosition = { ...currentPosition };

        // Calculer le cap initial
        if (fullRoutePoints.length > 1) {
            const nextPoint = fullRoutePoints[1];
            currentHeading = calculateBearing(
                currentPosition,
                { lat: nextPoint[0], lng: nextPoint[1] }
            );
            targetHeading = currentHeading;
        }

        // Stats initiales
        stats.startTime = Date.now();
        stats.distanceCovered = 0;
        stats.distanceRemaining = calculateTotalDistance(fullRoutePoints);
        stats.progress = 0;

        // Créer le marqueur véhicule avec rotation
        createVehicleMarker(currentPosition, currentHeading);

        // Dessiner la route
        drawRoute();

        // Centrer la carte
        MapController.fitBounds(fullRoutePoints.map(p => [p[0], p[1]]), 80);

        // Démarrer l'animation
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(animationLoop);

        // Timer ETA
        startETAUpdater();

        EventBus.emit('tracker:started', { stats });
        AppConfig.debug('UberStyleTracker: Started');

        return true;
    }

    /**
     * Créer le marqueur véhicule avec rotation CSS
     */
    function createVehicleMarker(position, heading) {
        if (vehicleMarker && map) {
            map.removeLayer(vehicleMarker);
        }

        // SVG du véhicule avec rotation
        const vehicleSvg = `
            <div class="uber-vehicle-marker" style="transform: rotate(${heading}deg);">
                <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id="vehicleShadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
                        </filter>
                    </defs>
                    <circle cx="20" cy="20" r="18" fill="#1a1a2e" stroke="#00D26A" stroke-width="3" filter="url(#vehicleShadow)"/>
                    <g transform="translate(10, 8)">
                        <path d="M2 16V8L5 4H15L18 8V16H16V18H13V16H7V18H4V16H2Z" fill="#00D26A"/>
                        <path d="M4 9H16L14.5 6H5.5L4 9Z" fill="#0a0a0f"/>
                        <circle cx="5" cy="12" r="1.5" fill="#FFD700"/>
                        <circle cx="15" cy="12" r="1.5" fill="#FFD700"/>
                    </g>
                </svg>
            </div>
        `;

        const icon = L.divIcon({
            html: vehicleSvg,
            className: 'uber-vehicle-icon',
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        });

        vehicleMarker = L.marker([position.lat, position.lng], {
            icon,
            zIndexOffset: 1000
        }).addTo(map);
    }

    /**
     * Mettre à jour la rotation du marqueur
     */
    function updateVehicleRotation(heading) {
        if (!vehicleMarker) return;

        const markerElement = vehicleMarker.getElement();
        if (markerElement) {
            const vehicleDiv = markerElement.querySelector('.uber-vehicle-marker');
            if (vehicleDiv) {
                vehicleDiv.style.transform = `rotate(${heading}deg)`;
            }
        }
    }

    /**
     * Dessiner la route (parcourue + restante)
     */
    function drawRoute() {
        if (!map) return;

        // Supprimer les anciennes couches
        if (routeLayerPassed) map.removeLayer(routeLayerPassed);
        if (routeLayerRemaining) map.removeLayer(routeLayerRemaining);

        // Points parcourus
        const passedPoints = fullRoutePoints.slice(0, currentSegmentIndex + 1);
        if (passedPoints.length > 1) {
            routeLayerPassed = L.polyline(passedPoints, {
                color: config.routePassedColor,
                weight: config.routeWeight,
                opacity: 0.6
            }).addTo(map);
        }

        // Points restants
        const remainingPoints = fullRoutePoints.slice(currentSegmentIndex);
        if (remainingPoints.length > 1) {
            routeLayerRemaining = L.polyline(remainingPoints, {
                color: config.routeRemainingColor,
                weight: config.routeWeight,
                opacity: 1
            }).addTo(map);
        }
    }

    // === BOUCLE D'ANIMATION ===

    /**
     * Boucle d'animation principale (60fps)
     */
    function animationLoop(timestamp) {
        if (!isRunning || isPaused) return;

        const deltaTime = timestamp - lastFrameTime;
        const targetFrameTime = 1000 / config.fps;

        // Limiter le framerate
        if (deltaTime < targetFrameTime) {
            animationFrameId = requestAnimationFrame(animationLoop);
            return;
        }

        lastFrameTime = timestamp;

        // Calculer la progression
        const progressDelta = calculateProgressDelta(deltaTime);
        advanceOnRoute(progressDelta);

        // Interpoler la position
        interpolatePosition(deltaTime);

        // Mettre à jour l'affichage
        updateDisplay();

        // Vérifier si arrivé (dernier segment est length-2 car on interpole entre index et index+1)
        if (currentSegmentIndex >= fullRoutePoints.length - 2 && segmentProgress >= 1) {
            handleArrival();
            return;
        }

        animationFrameId = requestAnimationFrame(animationLoop);
    }

    /**
     * Calculer la progression basée sur le temps
     */
    function calculateProgressDelta(deltaTime) {
        // Vitesse en points par seconde
        const speedFactor = (config.baseSpeedKmh / 30) * speedMultiplier;
        const pointsPerMs = speedFactor * 0.002; // Ajusté pour fluidité

        return deltaTime * pointsPerMs;
    }

    /**
     * Avancer sur la route
     */
    function advanceOnRoute(progressDelta) {
        segmentProgress += progressDelta;

        // Passer au segment suivant si nécessaire
        while (segmentProgress >= 1 && currentSegmentIndex < fullRoutePoints.length - 2) {
            segmentProgress -= 1;
            currentSegmentIndex++;

            // Mettre à jour la route affichée
            if (currentSegmentIndex % 5 === 0) {
                drawRoute();
            }
        }

        // Limiter la progression
        if (currentSegmentIndex >= fullRoutePoints.length - 1) {
            segmentProgress = Math.min(segmentProgress, 1);
        }

        // Calculer la position cible
        const currentPoint = fullRoutePoints[currentSegmentIndex];
        const nextIndex = Math.min(currentSegmentIndex + 1, fullRoutePoints.length - 1);
        const nextPoint = fullRoutePoints[nextIndex];

        // Interpolation linéaire entre les deux points
        targetPosition = {
            lat: currentPoint[0] + (nextPoint[0] - currentPoint[0]) * segmentProgress,
            lng: currentPoint[1] + (nextPoint[1] - currentPoint[1]) * segmentProgress
        };

        // Calculer le cap cible
        if (nextIndex > currentSegmentIndex) {
            targetHeading = calculateBearing(
                { lat: currentPoint[0], lng: currentPoint[1] },
                { lat: nextPoint[0], lng: nextPoint[1] }
            );
        }

        // Mettre à jour les stats
        updateStats();
    }

    /**
     * Interpoler la position pour fluidité
     */
    function interpolatePosition(deltaTime) {
        const factor = Math.min(deltaTime / config.interpolationDuration * 10, 1);

        // Interpolation position
        currentPosition.lat += (targetPosition.lat - currentPosition.lat) * factor;
        currentPosition.lng += (targetPosition.lng - currentPosition.lng) * factor;

        // Interpolation rotation (avec gestion du passage 360°->0°)
        let headingDiff = targetHeading - currentHeading;

        // Normaliser la différence (-180 à 180)
        while (headingDiff > 180) headingDiff -= 360;
        while (headingDiff < -180) headingDiff += 360;

        currentHeading += headingDiff * config.rotationSmoothing;

        // Normaliser le cap (0-360)
        currentHeading = ((currentHeading % 360) + 360) % 360;
    }

    /**
     * Mettre à jour l'affichage
     */
    function updateDisplay() {
        if (!vehicleMarker) return;

        // Position
        vehicleMarker.setLatLng([currentPosition.lat, currentPosition.lng]);

        // Rotation
        updateVehicleRotation(currentHeading);

        // Callback
        if (onPositionUpdate) {
            onPositionUpdate({
                position: { ...currentPosition },
                heading: currentHeading,
                stats: { ...stats }
            });
        }

        // Événement
        EventBus.emit('tracker:position', {
            position: currentPosition,
            heading: currentHeading,
            stats
        });
    }

    /**
     * Mettre à jour les statistiques
     */
    function updateStats() {
        const totalPoints = fullRoutePoints.length - 1;
        const progressPoints = currentSegmentIndex + segmentProgress;

        // Limiter la progression à 100%
        stats.progress = Math.min((progressPoints / totalPoints) * 100, 100);

        // Distance
        const totalDistance = calculateTotalDistance(fullRoutePoints);
        stats.distanceCovered = totalDistance * (stats.progress / 100);
        stats.distanceRemaining = Math.max(0, totalDistance - stats.distanceCovered);

        // Vitesse simulée avec variation réaliste
        stats.currentSpeedKmh = config.baseSpeedKmh * speedMultiplier * (0.8 + Math.random() * 0.4);

        // Calculer ETA basé sur distance restante et vitesse
        if (stats.currentSpeedKmh > 0) {
            stats.etaMinutes = Math.max(0, Math.ceil((stats.distanceRemaining / 1000) / stats.currentSpeedKmh * 60));
        }
    }

    /**
     * Gérer l'arrivée
     */
    function handleArrival() {
        isRunning = false;

        // Position finale exacte
        const finalPoint = fullRoutePoints[fullRoutePoints.length - 1];
        currentPosition = { lat: finalPoint[0], lng: finalPoint[1] };
        vehicleMarker.setLatLng([finalPoint[0], finalPoint[1]]);

        // Mettre à jour la route
        drawRoute();

        stats.progress = 100;
        stats.distanceRemaining = 0;
        stats.etaMinutes = 0;

        if (onArrival) {
            onArrival(stats);
        }

        EventBus.emit('tracker:arrived', { stats });
        AppConfig.debug('UberStyleTracker: Arrived');
    }

    // === ETA ===

    let etaIntervalId = null;

    /**
     * Démarrer le calcul ETA périodique
     */
    function startETAUpdater() {
        if (etaIntervalId) clearInterval(etaIntervalId);

        updateETA();
        etaIntervalId = setInterval(updateETA, config.etaUpdateInterval);
    }

    /**
     * Calculer l'ETA
     */
    function updateETA() {
        if (!isRunning) return;

        // Distance restante en km
        const distanceKm = stats.distanceRemaining / 1000;

        // Vitesse effective (avec trafic)
        const effectiveSpeed = (config.baseSpeedKmh * speedMultiplier) / config.trafficFactor;

        // ETA en minutes
        stats.etaMinutes = Math.ceil((distanceKm / effectiveSpeed) * 60);

        if (onETAUpdate) {
            onETAUpdate(stats.etaMinutes, stats.distanceRemaining);
        }

        EventBus.emit('tracker:eta', {
            etaMinutes: stats.etaMinutes,
            distanceRemaining: stats.distanceRemaining
        });
    }

    // === CONTRÔLES ===

    /**
     * Mettre en pause
     */
    function pause() {
        if (!isRunning) return;

        isPaused = true;

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        if (etaIntervalId) {
            clearInterval(etaIntervalId);
            etaIntervalId = null;
        }

        EventBus.emit('tracker:paused');
    }

    /**
     * Reprendre
     */
    function resume() {
        if (!isRunning || !isPaused) return;

        isPaused = false;
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(animationLoop);
        startETAUpdater();

        EventBus.emit('tracker:resumed');
    }

    /**
     * Arrêter
     */
    function stop() {
        isRunning = false;
        isPaused = false;

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        if (etaIntervalId) {
            clearInterval(etaIntervalId);
            etaIntervalId = null;
        }

        // Nettoyer la carte
        if (map) {
            if (vehicleMarker) map.removeLayer(vehicleMarker);
            if (routeLayerPassed) map.removeLayer(routeLayerPassed);
            if (routeLayerRemaining) map.removeLayer(routeLayerRemaining);
        }

        vehicleMarker = null;
        routeLayerPassed = null;
        routeLayerRemaining = null;

        EventBus.emit('tracker:stopped');
    }

    /**
     * Définir la vitesse
     */
    function setSpeed(multiplier) {
        speedMultiplier = Math.max(0.5, Math.min(10, multiplier));
        AppConfig.debug('UberStyleTracker: Speed', speedMultiplier + 'x');
    }

    /**
     * Centrer sur le véhicule
     */
    function centerOnVehicle(zoom = null) {
        if (!map || !currentPosition.lat) return;

        if (zoom) {
            map.setView([currentPosition.lat, currentPosition.lng], zoom);
        } else {
            map.panTo([currentPosition.lat, currentPosition.lng]);
        }
    }

    // === TRACKING TEMPS RÉEL ===

    /**
     * Mettre à jour depuis une position GPS réelle
     * (utilisé quand on reçoit des positions du serveur)
     */
    function updateFromRealPosition(position) {
        if (!vehicleMarker) {
            createVehicleMarker(position, 0);
        }

        // Calculer le cap depuis la dernière position
        if (currentPosition.lat && currentPosition.lng) {
            targetHeading = calculateBearing(currentPosition, position);
        }

        targetPosition = { ...position };

        // Démarrer l'interpolation si pas déjà en cours
        if (!animationFrameId) {
            lastFrameTime = performance.now();
            animationFrameId = requestAnimationFrame(realTimeAnimationLoop);
        }
    }

    /**
     * Boucle d'animation pour tracking temps réel
     */
    function realTimeAnimationLoop(timestamp) {
        const deltaTime = timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        interpolatePosition(deltaTime);

        if (vehicleMarker) {
            vehicleMarker.setLatLng([currentPosition.lat, currentPosition.lng]);
            updateVehicleRotation(currentHeading);
        }

        // Continuer si pas encore à la cible
        const dist = calculateDistance(currentPosition, targetPosition);
        if (dist > 0.5) { // > 0.5m
            animationFrameId = requestAnimationFrame(realTimeAnimationLoop);
        } else {
            animationFrameId = null;
        }
    }

    // === UTILITAIRES ===

    /**
     * Calculer le cap entre deux points
     */
    function calculateBearing(from, to) {
        const lat1 = toRadians(from.lat);
        const lat2 = toRadians(to.lat);
        const deltaLng = toRadians(to.lng - from.lng);

        const x = Math.sin(deltaLng) * Math.cos(lat2);
        const y = Math.cos(lat1) * Math.sin(lat2) -
                  Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

        let bearing = Math.atan2(x, y);
        bearing = toDegrees(bearing);
        bearing = (bearing + 360) % 360;

        return bearing;
    }

    /**
     * Calculer la distance entre deux points (mètres)
     */
    function calculateDistance(from, to) {
        const R = 6371000;
        const lat1Rad = toRadians(from.lat);
        const lat2Rad = toRadians(to.lat);
        const deltaLat = toRadians(to.lat - from.lat);
        const deltaLng = toRadians(to.lng - from.lng);

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Calculer la distance totale d'une route
     */
    function calculateTotalDistance(points) {
        let total = 0;
        for (let i = 0; i < points.length - 1; i++) {
            total += calculateDistance(
                { lat: points[i][0], lng: points[i][1] },
                { lat: points[i + 1][0], lng: points[i + 1][1] }
            );
        }
        return total;
    }

    function toRadians(deg) {
        return deg * (Math.PI / 180);
    }

    function toDegrees(rad) {
        return rad * (180 / Math.PI);
    }

    // === API PUBLIQUE ===

    return {
        init,
        start,
        stop,
        pause,
        resume,
        setSpeed,
        centerOnVehicle,
        updateFromRealPosition,

        // Getters
        isRunning: () => isRunning,
        isPaused: () => isPaused,
        getStats: () => ({ ...stats }),
        getPosition: () => ({ ...currentPosition }),
        getHeading: () => currentHeading,

        // Config
        config
    };
})();

// Rendre disponible globalement
window.UberStyleTracker = UberStyleTracker;
