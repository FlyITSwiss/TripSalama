/**
 * TripSalama - Fetch Utilities
 * Utilitaires pour les requêtes réseau avec timeout et retry
 */

'use strict';

const FetchUtils = (function() {
    /**
     * Fetch avec timeout (AbortController)
     * @param {string} url - URL à fetcher
     * @param {Object} options - Options fetch standards
     * @param {number} timeout - Timeout en ms (défaut: 5000)
     * @returns {Promise<Response>}
     */
    async function fetchWithTimeout(url, options = {}, timeout = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    /**
     * Fetch avec retry et backoff exponentiel
     * @param {string} url - URL à fetcher
     * @param {Object} options - Options fetch standards
     * @param {number} maxRetries - Nombre max de retries (défaut: 2)
     * @param {number} timeout - Timeout par requête en ms (défaut: 5000)
     * @returns {Promise<Response>}
     */
    async function fetchWithRetry(url, options = {}, maxRetries = 2, timeout = 5000) {
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetchWithTimeout(url, options, timeout);
                return response;
            } catch (error) {
                lastError = error;
                console.debug(`Fetch attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);

                if (attempt < maxRetries) {
                    // Backoff exponentiel: 500ms, 1000ms, 2000ms...
                    await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
                }
            }
        }

        throw lastError;
    }

    /**
     * Calculer la distance Haversine entre deux points GPS
     * @param {number} lat1 - Latitude point 1
     * @param {number} lng1 - Longitude point 1
     * @param {number} lat2 - Latitude point 2
     * @param {number} lng2 - Longitude point 2
     * @returns {number} Distance en km
     */
    function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Estimer la durée de trajet basée sur la distance
     * @param {number} distanceKm - Distance en km
     * @param {number} avgSpeedKmh - Vitesse moyenne (défaut: 30 km/h en ville)
     * @returns {number} Durée en minutes
     */
    function estimateDuration(distanceKm, avgSpeedKmh = 30) {
        return Math.round((distanceKm / avgSpeedKmh) * 60);
    }

    // API publique
    return {
        fetchWithTimeout,
        fetchWithRetry,
        calculateHaversineDistance,
        estimateDuration
    };
})();

// Rendre disponible globalement
window.FetchUtils = FetchUtils;
