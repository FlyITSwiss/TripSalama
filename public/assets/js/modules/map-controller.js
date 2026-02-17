/**
 * TripSalama - Map Controller (Leaflet)
 * Gestion de la carte OpenStreetMap
 */

'use strict';

const MapController = (function() {
    let map = null;
    let markers = {};
    let routeLayer = null;
    let userMarker = null;

    // Options par defaut
    const defaultOptions = {
        center: [46.2044, 6.1432], // Geneve
        zoom: 13,
        zoomControl: true
    };

    // Styles des markers
    const markerIcons = {
        pickup: createIcon('pickup', '#4CAF50'),
        dropoff: createIcon('dropoff', '#E53935'),
        vehicle: createIcon('vehicle', '#2D5A4A'),
        user: createIcon('user', '#2196F3')
    };

    /**
     * Creer une icone personnalisee
     */
    function createIcon(type, color) {
        const svgMap = {
            pickup: `<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" fill="${color}"/>
                <circle cx="12" cy="12" r="5" fill="white"/>
            </svg>`,
            dropoff: `<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" fill="${color}"/>
                <circle cx="12" cy="12" r="5" fill="white"/>
            </svg>`,
            vehicle: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="3"/>
                <path d="M12 24v-8l3-4h10l3 4v8h-2v2h-3v-2h-6v2h-3v-2h-2zm4-7h8l-1.5-2h-5l-1.5 2zm-1 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" fill="white"/>
            </svg>`,
            user: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="white"/>
            </svg>`
        };

        const svg = svgMap[type] || svgMap.pickup;
        const size = type === 'vehicle' ? [40, 40] : (type === 'user' ? [24, 24] : [24, 36]);
        const anchor = type === 'vehicle' ? [20, 20] : (type === 'user' ? [12, 12] : [12, 36]);

        return L.divIcon({
            html: svg,
            className: `marker-${type}`,
            iconSize: size,
            iconAnchor: anchor,
            popupAnchor: [0, -anchor[1]]
        });
    }

    /**
     * Initialiser la carte
     */
    function init(containerId, options = {}) {
        const config = { ...defaultOptions, ...options };

        // Creer la carte
        map = L.map(containerId, {
            center: config.center,
            zoom: config.zoom,
            zoomControl: config.zoomControl
        });

        // Ajouter les tuiles OSM
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }).addTo(map);

        // Retirer le loading
        const loading = document.querySelector(`#${containerId} .map-loading`);
        if (loading) loading.remove();

        AppConfig.debug('Map initialized');
        EventBus.emit(EventBus.Events.MAP_READY, { map });

        return map;
    }

    /**
     * Ajouter un marker
     */
    function addMarker(id, lat, lng, type = 'pickup', popup = null) {
        if (!map) return null;

        // Supprimer le marker existant
        if (markers[id]) {
            map.removeLayer(markers[id]);
        }

        const icon = markerIcons[type] || markerIcons.pickup;
        const marker = L.marker([lat, lng], { icon }).addTo(map);

        if (popup) {
            marker.bindPopup(popup);
        }

        markers[id] = marker;
        return marker;
    }

    /**
     * Supprimer un marker
     */
    function removeMarker(id) {
        if (markers[id] && map) {
            map.removeLayer(markers[id]);
            delete markers[id];
        }
    }

    /**
     * Mettre a jour la position d'un marker
     */
    function updateMarkerPosition(id, lat, lng, animate = true) {
        if (markers[id]) {
            const newLatLng = L.latLng(lat, lng);
            if (animate) {
                // Animation fluide
                const currentLatLng = markers[id].getLatLng();
                animateMarker(markers[id], currentLatLng, newLatLng, 500);
            } else {
                markers[id].setLatLng(newLatLng);
            }
        }
    }

    /**
     * Animer un marker
     */
    function animateMarker(marker, from, to, duration) {
        const start = Date.now();
        const startLat = from.lat;
        const startLng = from.lng;
        const deltaLat = to.lat - startLat;
        const deltaLng = to.lng - startLng;

        function animate() {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);

            // Easing
            const eased = 1 - Math.pow(1 - progress, 3);

            const lat = startLat + deltaLat * eased;
            const lng = startLng + deltaLng * eased;

            marker.setLatLng([lat, lng]);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }

        requestAnimationFrame(animate);
    }

    /**
     * Dessiner une route
     */
    function drawRoute(coordinates, options = {}) {
        if (!map) return null;

        // Supprimer la route existante
        if (routeLayer) {
            map.removeLayer(routeLayer);
        }

        const defaultStyle = {
            color: '#2D5A4A',
            weight: 5,
            opacity: 0.8,
            smoothFactor: 1
        };

        routeLayer = L.polyline(coordinates, { ...defaultStyle, ...options }).addTo(map);

        return routeLayer;
    }

    /**
     * Effacer la route
     */
    function clearRoute() {
        if (routeLayer && map) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
    }

    /**
     * Centrer sur une position
     */
    function setCenter(lat, lng, zoom = null) {
        if (!map) return;

        if (zoom !== null) {
            map.setView([lat, lng], zoom);
        } else {
            map.panTo([lat, lng]);
        }
    }

    /**
     * Ajuster la vue pour voir tous les points
     */
    function fitBounds(points, padding = 50) {
        if (!map || points.length === 0) return;

        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [padding, padding] });
    }

    /**
     * Obtenir la position actuelle
     */
    function getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    EventBus.emit(EventBus.Events.MAP_LOCATION_FOUND, location);
                    resolve(location);
                },
                (error) => {
                    EventBus.emit(EventBus.Events.MAP_LOCATION_ERROR, error);
                    reject(error);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    /**
     * Afficher la position utilisateur
     */
    async function showUserLocation() {
        try {
            const location = await getCurrentLocation();

            if (userMarker && map) {
                map.removeLayer(userMarker);
            }

            userMarker = addMarker('user', location.lat, location.lng, 'user');
            setCenter(location.lat, location.lng, 15);

            return location;
        } catch (error) {
            AppConfig.debug('Geolocation error:', error);
            throw error;
        }
    }

    /**
     * Decoder une polyline encodee (format OSRM/Google)
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
     * Obtenir la carte Leaflet
     */
    function getMap() {
        return map;
    }

    /**
     * Detruire la carte
     */
    function destroy() {
        if (map) {
            map.remove();
            map = null;
            markers = {};
            routeLayer = null;
            userMarker = null;
        }
    }

    // API publique
    return {
        init,
        addMarker,
        removeMarker,
        updateMarkerPosition,
        drawRoute,
        clearRoute,
        setCenter,
        fitBounds,
        getCurrentLocation,
        showUserLocation,
        decodePolyline,
        getMap,
        destroy
    };
})();

// Rendre disponible globalement
window.MapController = MapController;
