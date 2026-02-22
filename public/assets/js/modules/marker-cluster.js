/**
 * TripSalama - Marker Clustering
 * Regroupement des marqueurs pour les cartes à haute densité
 *
 * Utilise un algorithme de clustering simple basé sur la distance
 * pour regrouper les marqueurs proches et améliorer les performances
 */

'use strict';

const MarkerCluster = (function() {
    // Configuration
    const config = {
        clusterRadius: 60,        // Rayon en pixels pour le clustering
        maxZoom: 18,              // Zoom max où le clustering est désactivé
        spiderfyOnMaxZoom: true,  // Afficher les marqueurs en araignée au zoom max
        animateAddingMarkers: true,
        chunkedLoading: true,
        chunkSize: 100,
        chunkInterval: 50,
    };

    // État
    let map = null;
    let markers = [];
    let clusters = [];
    let clusterLayer = null;
    let isInitialized = false;

    /**
     * Initialiser le clustering sur une carte
     * @param {L.Map} mapInstance Instance Leaflet
     * @param {Object} options Options de configuration
     */
    function init(mapInstance, options = {}) {
        map = mapInstance;
        Object.assign(config, options);

        // Créer le layer groupe pour les clusters
        clusterLayer = L.layerGroup().addTo(map);

        // Écouter les changements de zoom
        map.on('zoomend', handleZoomChange);
        map.on('moveend', handleMoveEnd);

        isInitialized = true;
        AppConfig.debug('MarkerCluster: Initialisé');
    }

    /**
     * Ajouter des marqueurs au cluster
     * @param {Array} markerData Tableau de données de marqueurs [{lat, lng, data}]
     */
    function addMarkers(markerData) {
        if (!isInitialized) {
            AppConfig.debug('MarkerCluster: Non initialisé');
            return;
        }

        // Ajouter les marqueurs par chunks pour éviter le gel du navigateur
        if (config.chunkedLoading && markerData.length > config.chunkSize) {
            let index = 0;

            const processChunk = () => {
                const chunk = markerData.slice(index, index + config.chunkSize);

                chunk.forEach(data => {
                    markers.push({
                        lat: data.lat,
                        lng: data.lng,
                        data: data.data || {},
                        marker: null, // Créé à la demande
                    });
                });

                index += config.chunkSize;

                if (index < markerData.length) {
                    setTimeout(processChunk, config.chunkInterval);
                } else {
                    updateClusters();
                }
            };

            processChunk();
        } else {
            markerData.forEach(data => {
                markers.push({
                    lat: data.lat,
                    lng: data.lng,
                    data: data.data || {},
                    marker: null,
                });
            });

            updateClusters();
        }
    }

    /**
     * Supprimer tous les marqueurs
     */
    function clearMarkers() {
        markers = [];
        clusters = [];
        if (clusterLayer) {
            clusterLayer.clearLayers();
        }
    }

    /**
     * Mettre à jour les clusters
     */
    function updateClusters() {
        if (!map || markers.length === 0) return;

        const zoom = map.getZoom();
        const bounds = map.getBounds();

        // Filtrer les marqueurs visibles
        const visibleMarkers = markers.filter(m => bounds.contains([m.lat, m.lng]));

        // Si zoom max ou peu de marqueurs, pas de clustering
        if (zoom >= config.maxZoom || visibleMarkers.length < 10) {
            renderIndividualMarkers(visibleMarkers);
            return;
        }

        // Calculer les clusters
        clusters = calculateClusters(visibleMarkers, zoom);
        renderClusters();
    }

    /**
     * Calculer les clusters avec un algorithme simple basé sur la grille
     * @param {Array} markerList Liste des marqueurs
     * @param {number} zoom Niveau de zoom actuel
     * @returns {Array} Liste des clusters
     */
    function calculateClusters(markerList, zoom) {
        const result = [];
        const used = new Set();

        // Taille de cellule basée sur le zoom
        const cellSize = config.clusterRadius / Math.pow(2, zoom - 10);

        markerList.forEach((marker, i) => {
            if (used.has(i)) return;

            const cluster = {
                lat: marker.lat,
                lng: marker.lng,
                markers: [marker],
                count: 1,
            };

            // Chercher les voisins
            markerList.forEach((other, j) => {
                if (i === j || used.has(j)) return;

                const distance = getPixelDistance(marker, other);
                if (distance < config.clusterRadius) {
                    cluster.markers.push(other);
                    cluster.count++;
                    used.add(j);

                    // Mettre à jour le centre du cluster
                    cluster.lat = (cluster.lat * (cluster.count - 1) + other.lat) / cluster.count;
                    cluster.lng = (cluster.lng * (cluster.count - 1) + other.lng) / cluster.count;
                }
            });

            used.add(i);
            result.push(cluster);
        });

        return result;
    }

    /**
     * Calculer la distance en pixels entre deux points
     */
    function getPixelDistance(p1, p2) {
        if (!map) return Infinity;

        const point1 = map.latLngToContainerPoint([p1.lat, p1.lng]);
        const point2 = map.latLngToContainerPoint([p2.lat, p2.lng]);

        return Math.sqrt(
            Math.pow(point1.x - point2.x, 2) +
            Math.pow(point1.y - point2.y, 2)
        );
    }

    /**
     * Afficher les marqueurs individuels (sans clustering)
     */
    function renderIndividualMarkers(markerList) {
        clusterLayer.clearLayers();

        markerList.forEach(m => {
            const marker = L.marker([m.lat, m.lng], {
                icon: createMarkerIcon(m.data),
            });

            if (m.data.popup) {
                marker.bindPopup(m.data.popup);
            }

            if (m.data.onClick) {
                marker.on('click', m.data.onClick);
            }

            clusterLayer.addLayer(marker);
        });
    }

    /**
     * Afficher les clusters
     */
    function renderClusters() {
        clusterLayer.clearLayers();

        clusters.forEach(cluster => {
            if (cluster.count === 1) {
                // Un seul marqueur, afficher normalement
                const m = cluster.markers[0];
                const marker = L.marker([m.lat, m.lng], {
                    icon: createMarkerIcon(m.data),
                });

                if (m.data.popup) {
                    marker.bindPopup(m.data.popup);
                }

                clusterLayer.addLayer(marker);
            } else {
                // Plusieurs marqueurs, afficher comme cluster
                const clusterMarker = L.marker([cluster.lat, cluster.lng], {
                    icon: createClusterIcon(cluster.count),
                });

                // Au clic, zoomer sur le cluster
                clusterMarker.on('click', () => {
                    const bounds = L.latLngBounds(cluster.markers.map(m => [m.lat, m.lng]));
                    map.fitBounds(bounds, { padding: [50, 50] });
                });

                clusterLayer.addLayer(clusterMarker);
            }
        });
    }

    /**
     * Créer l'icône d'un marqueur individuel
     */
    function createMarkerIcon(data) {
        const type = data.type || 'default';
        const colors = {
            driver: '#2D5A4A',
            pickup: '#10B981',
            dropoff: '#EF4444',
            default: '#C9A962',
        };

        return L.divIcon({
            className: 'ts-marker ts-marker-' + type,
            html: `
                <div class="ts-marker-inner" style="background-color: ${colors[type]};">
                    ${getMarkerSvg(type)}
                </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 34],
        });
    }

    /**
     * Créer l'icône d'un cluster
     */
    function createClusterIcon(count) {
        // Fibonacci sizing: 34, 55, 89
        let size = 34;
        let className = 'ts-cluster-small';

        if (count >= 100) {
            size = 89;
            className = 'ts-cluster-large';
        } else if (count >= 10) {
            size = 55;
            className = 'ts-cluster-medium';
        }

        return L.divIcon({
            className: `ts-cluster ${className}`,
            html: `<div class="ts-cluster-inner"><span>${count}</span></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }

    /**
     * Obtenir le SVG pour un type de marqueur
     */
    function getMarkerSvg(type) {
        const svgs = {
            driver: '<svg viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>',
            pickup: '<svg viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/></svg>',
            dropoff: '<svg viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
            default: '<svg viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>',
        };

        return svgs[type] || svgs.default;
    }

    /**
     * Gérer le changement de zoom
     */
    function handleZoomChange() {
        updateClusters();
    }

    /**
     * Gérer le déplacement de la carte
     */
    function handleMoveEnd() {
        updateClusters();
    }

    /**
     * Détruire le cluster manager
     */
    function destroy() {
        if (map) {
            map.off('zoomend', handleZoomChange);
            map.off('moveend', handleMoveEnd);
        }

        clearMarkers();
        clusterLayer = null;
        map = null;
        isInitialized = false;
    }

    // API publique
    return {
        init,
        addMarkers,
        clearMarkers,
        updateClusters,
        destroy,
    };
})();

// Exposer globalement
window.MarkerCluster = MarkerCluster;
