/**
 * TripSalama - GeoLocation Service
 * Service de géolocalisation mobile-ready
 * Supporte GPS haute précision et tracking continu
 */

'use strict';

const GeoLocationService = (function() {
    // Configuration
    const config = {
        // Options pour position unique (haute précision)
        // Timeout augmenté pour laisser le temps à l'utilisateur d'accepter la permission
        singlePosition: {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
        },
        // Options pour tracking continu (optimisé batterie)
        watchPosition: {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 5000
        },
        // Options pour position rapide (moins précise)
        quickPosition: {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 60000
        }
    };

    // État
    let watchId = null;
    let lastPosition = null;
    let isWatching = false;
    let permissionState = null;

    // Callbacks
    let onPositionUpdate = null;
    let onError = null;

    /**
     * Vérifier si la géolocalisation est supportée
     */
    function isSupported() {
        return 'geolocation' in navigator;
    }

    /**
     * Vérifier l'état des permissions
     * @returns {Promise<string>} 'granted', 'denied', 'prompt' ou 'unsupported'
     */
    async function checkPermission() {
        if (!isSupported()) {
            return 'unsupported';
        }

        // API Permissions (moderne)
        if ('permissions' in navigator) {
            try {
                const result = await navigator.permissions.query({ name: 'geolocation' });
                permissionState = result.state;

                // Écouter les changements de permission
                result.onchange = () => {
                    permissionState = result.state;
                    EventBus.emit(EventBus.Events.GEO_PERMISSION_CHANGE, { state: result.state });
                };

                return result.state;
            } catch (e) {
                // Fallback si query échoue
                return 'prompt';
            }
        }

        return 'prompt';
    }

    /**
     * Obtenir la position actuelle
     * @param {Object} options - Options de géolocalisation
     * @returns {Promise<Object>} Position avec lat, lng, accuracy, timestamp
     */
    function getCurrentPosition(options = {}) {
        return new Promise((resolve, reject) => {
            if (!isSupported()) {
                const error = createError('UNSUPPORTED', I18n.t('geolocation.unsupported'));
                EventBus.emit(EventBus.Events.GEO_ERROR, error);
                reject(error);
                return;
            }

            const opts = { ...config.singlePosition, ...options };

            EventBus.emit(EventBus.Events.GEO_DETECTING);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = formatPosition(position);
                    lastPosition = location;

                    EventBus.emit(EventBus.Events.GEO_POSITION_FOUND, location);
                    resolve(location);
                },
                (error) => {
                    const formattedError = handleGeolocationError(error);
                    EventBus.emit(EventBus.Events.GEO_ERROR, formattedError);
                    reject(formattedError);
                },
                opts
            );
        });
    }

    /**
     * Obtenir la position rapidement (moins précise)
     * Utile pour une première estimation avant GPS précis
     */
    function getQuickPosition() {
        return getCurrentPosition(config.quickPosition);
    }

    /**
     * Obtenir la position avec haute précision (GPS)
     */
    function getHighAccuracyPosition() {
        return getCurrentPosition(config.singlePosition);
    }

    /**
     * Démarrer le suivi de position
     * @param {Function} callback - Appelé à chaque mise à jour
     * @param {Object} options - Options de watch
     * @returns {number} watchId pour arrêter le suivi
     */
    function startWatching(callback, options = {}) {
        if (!isSupported()) {
            const error = createError('UNSUPPORTED', I18n.t('geolocation.unsupported'));
            if (callback) callback(null, error);
            return null;
        }

        // Arrêter le watch existant
        stopWatching();

        const opts = { ...config.watchPosition, ...options };
        onPositionUpdate = callback;

        isWatching = true;
        EventBus.emit(EventBus.Events.GEO_WATCH_START);

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const location = formatPosition(position);
                lastPosition = location;

                EventBus.emit(EventBus.Events.GEO_POSITION_UPDATE, location);

                if (onPositionUpdate) {
                    onPositionUpdate(location, null);
                }
            },
            (error) => {
                const formattedError = handleGeolocationError(error);
                EventBus.emit(EventBus.Events.GEO_ERROR, formattedError);

                if (onPositionUpdate) {
                    onPositionUpdate(null, formattedError);
                }
            },
            opts
        );

        return watchId;
    }

    /**
     * Arrêter le suivi de position
     */
    function stopWatching() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
            isWatching = false;
            onPositionUpdate = null;

            EventBus.emit(EventBus.Events.GEO_WATCH_STOP);
        }
    }

    /**
     * Obtenir la dernière position connue
     */
    function getLastPosition() {
        return lastPosition;
    }

    /**
     * Vérifier si le tracking est actif
     */
    function isTracking() {
        return isWatching;
    }

    /**
     * Calculer la distance entre deux points (Haversine)
     * @param {Object} pos1 - {lat, lng}
     * @param {Object} pos2 - {lat, lng}
     * @returns {number} Distance en mètres
     */
    function calculateDistance(pos1, pos2) {
        const R = 6371000; // Rayon de la Terre en mètres
        const lat1Rad = toRadians(pos1.lat);
        const lat2Rad = toRadians(pos2.lat);
        const deltaLat = toRadians(pos2.lat - pos1.lat);
        const deltaLng = toRadians(pos2.lng - pos1.lng);

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Calculer le cap (bearing) entre deux points
     * @param {Object} pos1 - {lat, lng}
     * @param {Object} pos2 - {lat, lng}
     * @returns {number} Cap en degrés (0-360)
     */
    function calculateBearing(pos1, pos2) {
        const lat1Rad = toRadians(pos1.lat);
        const lat2Rad = toRadians(pos2.lat);
        const deltaLng = toRadians(pos2.lng - pos1.lng);

        const x = Math.sin(deltaLng) * Math.cos(lat2Rad);
        const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLng);

        let bearing = Math.atan2(x, y);
        bearing = toDegrees(bearing);
        bearing = (bearing + 360) % 360;

        return bearing;
    }

    /**
     * Reverse geocoding via Nominatim
     * @param {number} lat
     * @param {number} lng
     * @returns {Promise<Object>} Adresse formatée
     */
    async function reverseGeocode(lat, lng) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;

            const response = await fetch(url, {
                headers: { 'Accept-Language': AppConfig.getLang() }
            });

            if (!response.ok) throw new Error('Geocoding failed');

            const data = await response.json();

            return {
                displayName: data.display_name,
                shortName: formatShortAddress(data),
                address: data.address,
                lat: parseFloat(data.lat),
                lng: parseFloat(data.lon)
            };
        } catch (error) {
            AppConfig.debug('Reverse geocoding error:', error);
            throw error;
        }
    }

    /**
     * Geocoding (adresse vers coordonnées) via Nominatim
     * @param {string} query
     * @returns {Promise<Array>} Liste de résultats
     */
    async function geocode(query) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;

            const response = await fetch(url, {
                headers: { 'Accept-Language': AppConfig.getLang() }
            });

            if (!response.ok) throw new Error('Geocoding failed');

            const results = await response.json();

            return results.map(result => ({
                displayName: result.display_name,
                shortName: result.name || result.display_name.split(',')[0],
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                type: result.type,
                address: result.address
            }));
        } catch (error) {
            AppConfig.debug('Geocoding error:', error);
            throw error;
        }
    }

    // === FONCTIONS UTILITAIRES ===

    /**
     * Formater une position du navigateur
     */
    function formatPosition(position) {
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
        };
    }

    /**
     * Formater une adresse courte
     */
    function formatShortAddress(data) {
        if (!data.address) return data.display_name;

        const addr = data.address;
        const parts = [];

        if (addr.house_number && addr.road) {
            parts.push(`${addr.house_number} ${addr.road}`);
        } else if (addr.road) {
            parts.push(addr.road);
        } else if (addr.neighbourhood) {
            parts.push(addr.neighbourhood);
        }

        if (addr.city || addr.town || addr.village) {
            parts.push(addr.city || addr.town || addr.village);
        }

        return parts.join(', ') || data.display_name;
    }

    /**
     * Gérer les erreurs de géolocalisation
     */
    function handleGeolocationError(error) {
        let message, code;

        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = I18n.t('geolocation.permission_denied');
                code = 'PERMISSION_DENIED';
                break;
            case error.POSITION_UNAVAILABLE:
                message = I18n.t('geolocation.unavailable');
                code = 'POSITION_UNAVAILABLE';
                break;
            case error.TIMEOUT:
                message = I18n.t('geolocation.timeout');
                code = 'TIMEOUT';
                break;
            default:
                message = I18n.t('geolocation.error');
                code = 'UNKNOWN';
        }

        return createError(code, message, error);
    }

    /**
     * Créer un objet erreur standardisé
     */
    function createError(code, message, originalError = null) {
        return {
            code,
            message,
            originalError,
            timestamp: Date.now()
        };
    }

    /**
     * Convertir degrés en radians
     */
    function toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Convertir radians en degrés
     */
    function toDegrees(radians) {
        return radians * (180 / Math.PI);
    }

    // === ENREGISTREMENT DES ÉVÉNEMENTS ===

    // Ajouter les événements au EventBus si non présents
    if (typeof EventBus !== 'undefined' && EventBus.Events) {
        const geoEvents = {
            GEO_DETECTING: 'geo:detecting',
            GEO_POSITION_FOUND: 'geo:position:found',
            GEO_POSITION_UPDATE: 'geo:position:update',
            GEO_ERROR: 'geo:error',
            GEO_WATCH_START: 'geo:watch:start',
            GEO_WATCH_STOP: 'geo:watch:stop',
            GEO_PERMISSION_CHANGE: 'geo:permission:change'
        };

        Object.assign(EventBus.Events, geoEvents);
    }

    // API publique
    return {
        // Vérifications
        isSupported,
        checkPermission,
        isTracking,

        // Position unique
        getCurrentPosition,
        getQuickPosition,
        getHighAccuracyPosition,
        getLastPosition,

        // Tracking continu
        startWatching,
        stopWatching,

        // Geocoding
        reverseGeocode,
        geocode,

        // Calculs géographiques
        calculateDistance,
        calculateBearing,

        // Configuration
        config
    };
})();

// Rendre disponible globalement
window.GeoLocationService = GeoLocationService;
