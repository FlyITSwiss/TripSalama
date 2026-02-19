/**
 * TripSalama - Demo Mode
 * Mode démonstration avec simulation véhicule temps réel
 * Comparable à l'expérience Uber
 */

'use strict';

const DemoMode = (function() {
    // État
    let isActive = false;
    let userPosition = null;
    let vehiclePosition = null;
    let routePoints = [];
    let currentPointIndex = 0;
    let animationFrame = null;
    let lastUpdateTime = 0;
    let eta = null;
    let driverInfo = null;

    // Configuration
    const config = {
        // Vitesse de simulation (mètres par seconde réel)
        baseSpeedMps: 8.33, // ~30 km/h en ville
        // Distance initiale du véhicule (mètres)
        minStartDistance: 1000,  // 1 km
        maxStartDistance: 5000,  // 5 km
        // Intervalle de mise à jour (ms)
        updateInterval: 50,
        // Points par frame
        pointsPerUpdate: 0.5,
        // Multiplicateur de vitesse
        speedMultiplier: 1,
        // OSRM routing URL
        osrmUrl: 'https://router.project-osrm.org/route/v1/driving',
        // Seuil de proximité pour arrivée (mètres)
        arrivalThreshold: 30
    };

    // Conducteurs fictifs pour la démo
    const demoDrivers = [
        { name: 'Mohamed K.', rating: 4.9, car: 'Toyota Corolla', plate: 'GE 123 456', photo: null },
        { name: 'Amadou D.', rating: 4.8, car: 'Renault Clio', plate: 'GE 789 012', photo: null },
        { name: 'Ibrahim S.', rating: 4.7, car: 'Peugeot 208', plate: 'GE 345 678', photo: null },
        { name: 'Fatou B.', rating: 4.9, car: 'Volkswagen Golf', plate: 'GE 901 234', photo: null },
        { name: 'Oumar T.', rating: 4.6, car: 'Citroën C3', plate: 'GE 567 890', photo: null }
    ];

    /**
     * Initialiser le mode démo
     */
    async function init() {
        // Vérifier le support
        if (!GeoLocationService.isSupported()) {
            EventBus.emit('demo:error', {
                code: 'GEO_UNSUPPORTED',
                message: (typeof I18n !== 'undefined' && I18n.t) ? I18n.t('demo.geo_unsupported') : 'Geolocation not supported'
            });
            return false;
        }

        // Enregistrer les événements
        registerEvents();

        AppConfig.log('DemoMode initialized');
        return true;
    }

    /**
     * Démarrer la démo
     */
    async function start() {
        if (isActive) {
            stop();
        }

        EventBus.emit('demo:starting');

        try {
            // 1. Obtenir la position de l'utilisateur
            userPosition = await GeoLocationService.getCurrentPosition();
            EventBus.emit('demo:user_located', userPosition);

            // 2. Générer une position de départ aléatoire
            const startPosition = generateRandomStartPosition(userPosition);
            vehiclePosition = { ...startPosition };

            // 3. Sélectionner un conducteur aléatoire
            driverInfo = demoDrivers[Math.floor(Math.random() * demoDrivers.length)];
            EventBus.emit('demo:driver_assigned', driverInfo);

            // 4. Obtenir la route via OSRM
            const routeData = await fetchRoute(startPosition, userPosition);

            if (!routeData || !routeData.routes || routeData.routes.length === 0) {
                throw new Error('No route found');
            }

            // 5. Décoder la polyline
            const route = routeData.routes[0];
            routePoints = decodePolyline(route.geometry);

            // ETA initial
            eta = {
                distance: route.distance,
                duration: route.duration,
                durationMinutes: Math.ceil(route.duration / 60)
            };

            // 6. Démarrer la simulation
            isActive = true;
            currentPointIndex = 0;
            lastUpdateTime = Date.now();

            EventBus.emit('demo:started', {
                userPosition,
                vehiclePosition,
                driverInfo,
                eta,
                routePoints: routePoints.length
            });

            // Lancer l'animation
            animate();

            return true;
        } catch (error) {
            AppConfig.log('Demo start error:', error);
            EventBus.emit('demo:error', {
                code: 'START_FAILED',
                message: error.message
            });
            return false;
        }
    }

    /**
     * Arrêter la démo
     */
    function stop() {
        isActive = false;

        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        routePoints = [];
        currentPointIndex = 0;
        vehiclePosition = null;
        eta = null;

        EventBus.emit('demo:stopped');
        AppConfig.log('DemoMode stopped');
    }

    /**
     * Mettre en pause
     */
    function pause() {
        if (!isActive) return;

        isActive = false;
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        EventBus.emit('demo:paused');
    }

    /**
     * Reprendre
     */
    function resume() {
        if (isActive || routePoints.length === 0) return;

        isActive = true;
        lastUpdateTime = Date.now();
        animate();

        EventBus.emit('demo:resumed');
    }

    /**
     * Définir la vitesse de simulation
     */
    function setSpeed(multiplier) {
        config.speedMultiplier = Math.max(0.5, Math.min(10, multiplier));
        EventBus.emit('demo:speed_changed', { speed: config.speedMultiplier });
    }

    /**
     * Boucle d'animation principale
     */
    function animate() {
        if (!isActive) return;

        const now = Date.now();
        const deltaTime = (now - lastUpdateTime) / 1000; // En secondes
        lastUpdateTime = now;

        // Calculer la distance à parcourir
        const distanceToTravel = config.baseSpeedMps * config.speedMultiplier * deltaTime;

        // Avancer sur la route
        let distanceTraveled = 0;

        while (distanceTraveled < distanceToTravel && currentPointIndex < routePoints.length - 1) {
            const currentPoint = routePoints[currentPointIndex];
            const nextPoint = routePoints[currentPointIndex + 1];

            const segmentDistance = calculateDistance(
                { lat: currentPoint[0], lng: currentPoint[1] },
                { lat: nextPoint[0], lng: nextPoint[1] }
            );

            if (distanceTraveled + segmentDistance <= distanceToTravel) {
                // On peut passer au point suivant
                currentPointIndex++;
                distanceTraveled += segmentDistance;
            } else {
                // Interpoler la position sur le segment
                const remainingDistance = distanceToTravel - distanceTraveled;
                const fraction = remainingDistance / segmentDistance;

                vehiclePosition = {
                    lat: currentPoint[0] + (nextPoint[0] - currentPoint[0]) * fraction,
                    lng: currentPoint[1] + (nextPoint[1] - currentPoint[1]) * fraction
                };
                break;
            }
        }

        // Mettre à jour la position si on a changé de point
        if (currentPointIndex < routePoints.length) {
            const point = routePoints[currentPointIndex];
            vehiclePosition = { lat: point[0], lng: point[1] };
        }

        // Calculer l'ETA mise à jour
        updateETA();

        // Calculer le cap (bearing)
        let heading = 0;
        if (currentPointIndex < routePoints.length - 1) {
            const current = routePoints[currentPointIndex];
            const next = routePoints[currentPointIndex + 1];
            heading = calculateBearing(
                { lat: current[0], lng: current[1] },
                { lat: next[0], lng: next[1] }
            );
        }

        // Émettre la mise à jour
        const progress = (currentPointIndex / (routePoints.length - 1)) * 100;

        EventBus.emit('demo:position_update', {
            position: vehiclePosition,
            heading,
            progress,
            eta,
            pointIndex: currentPointIndex,
            totalPoints: routePoints.length
        });

        // Vérifier si arrivé
        const distanceToUser = calculateDistance(vehiclePosition, userPosition);

        if (distanceToUser < config.arrivalThreshold || currentPointIndex >= routePoints.length - 1) {
            handleArrival();
            return;
        }

        // Continuer l'animation
        animationFrame = requestAnimationFrame(animate);
    }

    /**
     * Mettre à jour l'ETA
     */
    function updateETA() {
        if (!vehiclePosition || !userPosition) return;

        const remainingDistance = calculateDistance(vehiclePosition, userPosition);
        const speedMps = config.baseSpeedMps * config.speedMultiplier;
        const remainingSeconds = remainingDistance / speedMps;

        eta = {
            distance: Math.round(remainingDistance),
            distanceFormatted: formatDistance(remainingDistance),
            duration: Math.round(remainingSeconds),
            durationMinutes: Math.ceil(remainingSeconds / 60),
            durationFormatted: formatDuration(Math.ceil(remainingSeconds / 60)),
            arrivalTime: new Date(Date.now() + remainingSeconds * 1000)
        };
    }

    /**
     * Gérer l'arrivée du véhicule
     */
    function handleArrival() {
        isActive = false;

        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        EventBus.emit('demo:arrived', {
            driverInfo,
            userPosition,
            arrivalTime: new Date()
        });

        AppConfig.log('DemoMode: Vehicle arrived');
    }

    /**
     * Générer une position de départ aléatoire
     */
    function generateRandomStartPosition(center) {
        // Distance aléatoire
        const distance = config.minStartDistance +
            Math.random() * (config.maxStartDistance - config.minStartDistance);

        // Angle aléatoire (0-360°)
        const bearing = Math.random() * 360;

        // Calculer la nouvelle position
        return calculateDestination(center, distance, bearing);
    }

    /**
     * Calculer une position de destination
     */
    function calculateDestination(start, distance, bearing) {
        const R = 6371000; // Rayon Terre en mètres
        const bearingRad = bearing * (Math.PI / 180);
        const lat1Rad = start.lat * (Math.PI / 180);
        const lng1Rad = start.lng * (Math.PI / 180);

        const lat2Rad = Math.asin(
            Math.sin(lat1Rad) * Math.cos(distance / R) +
            Math.cos(lat1Rad) * Math.sin(distance / R) * Math.cos(bearingRad)
        );

        const lng2Rad = lng1Rad + Math.atan2(
            Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(lat1Rad),
            Math.cos(distance / R) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
        );

        return {
            lat: lat2Rad * (180 / Math.PI),
            lng: lng2Rad * (180 / Math.PI)
        };
    }

    /**
     * Récupérer la route via OSRM
     */
    async function fetchRoute(start, end) {
        const url = `${config.osrmUrl}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=polyline&steps=true`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`OSRM error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            AppConfig.log('OSRM fetch error:', error);

            // Fallback: générer une route directe
            return generateDirectRoute(start, end);
        }
    }

    /**
     * Générer une route directe (fallback)
     */
    function generateDirectRoute(start, end) {
        const points = [];
        const steps = 50;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            points.push([
                start.lat + (end.lat - start.lat) * t,
                start.lng + (end.lng - start.lng) * t
            ]);
        }

        const distance = calculateDistance(start, end);
        const duration = distance / config.baseSpeedMps;

        return {
            routes: [{
                geometry: encodePolyline(points),
                distance,
                duration
            }]
        };
    }

    /**
     * Décoder une polyline Google/OSRM
     */
    function decodePolyline(encoded) {
        const points = [];
        let index = 0, len = encoded.length;
        let lat = 0, lng = 0;

        while (index < len) {
            let b, shift = 0, result = 0;

            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);

            const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += dlat;

            shift = 0;
            result = 0;

            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);

            const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lng += dlng;

            points.push([lat / 1e5, lng / 1e5]);
        }

        return points;
    }

    /**
     * Encoder en polyline (pour fallback)
     */
    function encodePolyline(points) {
        let encoded = '';
        let prevLat = 0, prevLng = 0;

        for (const point of points) {
            const lat = Math.round(point[0] * 1e5);
            const lng = Math.round(point[1] * 1e5);

            encoded += encodeNumber(lat - prevLat);
            encoded += encodeNumber(lng - prevLng);

            prevLat = lat;
            prevLng = lng;
        }

        return encoded;
    }

    function encodeNumber(num) {
        let sgn_num = num << 1;
        if (num < 0) sgn_num = ~sgn_num;

        let encoded = '';
        while (sgn_num >= 0x20) {
            encoded += String.fromCharCode((0x20 | (sgn_num & 0x1f)) + 63);
            sgn_num >>= 5;
        }
        encoded += String.fromCharCode(sgn_num + 63);

        return encoded;
    }

    /**
     * Calculer la distance entre deux points (Haversine)
     */
    function calculateDistance(pos1, pos2) {
        const R = 6371000;
        const lat1Rad = pos1.lat * (Math.PI / 180);
        const lat2Rad = pos2.lat * (Math.PI / 180);
        const deltaLat = (pos2.lat - pos1.lat) * (Math.PI / 180);
        const deltaLng = (pos2.lng - pos1.lng) * (Math.PI / 180);

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Calculer le cap (bearing)
     */
    function calculateBearing(pos1, pos2) {
        const lat1Rad = pos1.lat * (Math.PI / 180);
        const lat2Rad = pos2.lat * (Math.PI / 180);
        const deltaLng = (pos2.lng - pos1.lng) * (Math.PI / 180);

        const x = Math.sin(deltaLng) * Math.cos(lat2Rad);
        const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLng);

        let bearing = Math.atan2(x, y) * (180 / Math.PI);
        return (bearing + 360) % 360;
    }

    /**
     * Formater la distance
     */
    function formatDistance(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        return `${(meters / 1000).toFixed(1)} km`;
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
     * Enregistrer les événements
     */
    function registerEvents() {
        if (typeof EventBus !== 'undefined' && EventBus.Events) {
            const demoEvents = {
                DEMO_STARTING: 'demo:starting',
                DEMO_STARTED: 'demo:started',
                DEMO_STOPPED: 'demo:stopped',
                DEMO_PAUSED: 'demo:paused',
                DEMO_RESUMED: 'demo:resumed',
                DEMO_USER_LOCATED: 'demo:user_located',
                DEMO_DRIVER_ASSIGNED: 'demo:driver_assigned',
                DEMO_POSITION_UPDATE: 'demo:position_update',
                DEMO_SPEED_CHANGED: 'demo:speed_changed',
                DEMO_ARRIVED: 'demo:arrived',
                DEMO_ERROR: 'demo:error'
            };

            Object.assign(EventBus.Events, demoEvents);
        }
    }

    /**
     * Obtenir l'état actuel
     */
    function getState() {
        return {
            isActive,
            userPosition,
            vehiclePosition,
            driverInfo,
            eta,
            progress: routePoints.length > 0
                ? (currentPointIndex / (routePoints.length - 1)) * 100
                : 0,
            speedMultiplier: config.speedMultiplier
        };
    }

    // API publique
    return {
        init,
        start,
        stop,
        pause,
        resume,
        setSpeed,
        getState,
        config
    };
})();

// Rendre disponible globalement
window.DemoMode = DemoMode;
