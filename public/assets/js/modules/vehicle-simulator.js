/**
 * TripSalama - Vehicle Simulator
 * Simulation du deplacement vehicule (mode demo)
 */

'use strict';

const VehicleSimulator = (function() {
    // Etat
    let routePoints = [];
    let currentIndex = 0;
    let isRunning = false;
    let isPaused = false;
    let speedMultiplier = 1;
    let animationFrame = null;
    let lastUpdate = 0;

    // Configuration
    const config = {
        baseSpeed: 30, // km/h
        updateInterval: 50, // ms entre les updates
        pointsPerSecond: 2 // Points de route parcourus par seconde a vitesse 1x
    };

    /**
     * Demarrer la simulation
     */
    function start(polyline) {
        if (!polyline) {
            AppConfig.debug('VehicleSimulator: No polyline provided');
            return;
        }

        // Decoder la polyline
        routePoints = MapController.decodePolyline(polyline);

        if (routePoints.length < 2) {
            AppConfig.debug('VehicleSimulator: Not enough route points');
            return;
        }

        currentIndex = 0;
        isRunning = true;
        isPaused = false;
        lastUpdate = Date.now();

        // Placer le vehicule au debut
        const startPoint = routePoints[0];
        MapController.addMarker('vehicle', startPoint[0], startPoint[1], 'vehicle');

        // Demarrer l'animation
        animate();

        EventBus.emit(EventBus.Events.SIM_STARTED);
        AppConfig.debug('VehicleSimulator: Started');
    }

    /**
     * Boucle d'animation
     */
    function animate() {
        if (!isRunning || isPaused) return;

        const now = Date.now();
        const delta = now - lastUpdate;

        // Calculer le nombre de points a avancer
        const pointsToAdvance = (delta / 1000) * config.pointsPerSecond * speedMultiplier;

        if (pointsToAdvance >= 1) {
            currentIndex = Math.min(currentIndex + Math.floor(pointsToAdvance), routePoints.length - 1);
            lastUpdate = now;

            // Mettre a jour la position du vehicule
            const currentPoint = routePoints[currentIndex];
            MapController.updateMarkerPosition('vehicle', currentPoint[0], currentPoint[1], true);

            // Emettre l'evenement de mise a jour
            const progress = (currentIndex / (routePoints.length - 1)) * 100;
            EventBus.emit(EventBus.Events.SIM_POSITION_UPDATE, {
                lat: currentPoint[0],
                lng: currentPoint[1],
                progress: progress,
                remaining: routePoints.length - 1 - currentIndex
            });

            // Verifier si arrive
            if (currentIndex >= routePoints.length - 1) {
                stop();
                EventBus.emit(EventBus.Events.SIM_ARRIVED);
                return;
            }
        }

        animationFrame = requestAnimationFrame(animate);
    }

    /**
     * Arreter la simulation
     */
    function stop() {
        isRunning = false;
        isPaused = false;

        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        EventBus.emit(EventBus.Events.SIM_STOPPED);
        AppConfig.debug('VehicleSimulator: Stopped');
    }

    /**
     * Mettre en pause
     */
    function pause() {
        if (!isRunning) return;

        isPaused = true;

        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        AppConfig.debug('VehicleSimulator: Paused');
    }

    /**
     * Reprendre
     */
    function resume() {
        if (!isRunning || !isPaused) return;

        isPaused = false;
        lastUpdate = Date.now();
        animate();

        AppConfig.debug('VehicleSimulator: Resumed');
    }

    /**
     * Definir la vitesse
     */
    function setSpeed(multiplier) {
        speedMultiplier = Math.max(0.5, Math.min(10, multiplier));
        AppConfig.debug('VehicleSimulator: Speed set to', speedMultiplier + 'x');
    }

    /**
     * Obtenir la position actuelle
     */
    function getCurrentPosition() {
        if (routePoints.length === 0 || currentIndex >= routePoints.length) {
            return null;
        }

        return {
            lat: routePoints[currentIndex][0],
            lng: routePoints[currentIndex][1],
            progress: (currentIndex / (routePoints.length - 1)) * 100
        };
    }

    /**
     * Obtenir la progression
     */
    function getProgress() {
        if (routePoints.length === 0) return 0;
        return (currentIndex / (routePoints.length - 1)) * 100;
    }

    /**
     * Est en cours ?
     */
    function isActive() {
        return isRunning && !isPaused;
    }

    // API publique
    return {
        start,
        stop,
        pause,
        resume,
        setSpeed,
        getCurrentPosition,
        getProgress,
        isActive
    };
})();

// Rendre disponible globalement
window.VehicleSimulator = VehicleSimulator;
