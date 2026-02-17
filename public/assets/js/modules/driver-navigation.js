/**
 * TripSalama - Driver Navigation Module
 * Gère la navigation de la conductrice vers la passagère puis vers la destination
 */

'use strict';

const DriverNavigation = (function() {
    let config = null;
    let map = null;
    let vehicleMarker = null;
    let simulator = null;
    let positionUpdateInterval = null;

    /**
     * Initialiser
     */
    function init() {
        config = window.NavigationConfig;

        if (!config) {
            AppConfig.debug('DriverNavigation: No config');
            return;
        }

        initMap();
        setupEventListeners();
        startSimulation();
        startPositionUpdates();

        AppConfig.debug('DriverNavigation: Initialized');
    }

    /**
     * Initialiser la carte
     */
    function initMap() {
        // Créer la carte
        map = MapController.createMap('navigationMap', {
            center: [config.pickup.lat, config.pickup.lng],
            zoom: 14
        });

        // Ajouter marqueur pickup
        MapController.addPickupMarker(map, config.pickup.lat, config.pickup.lng);

        // Ajouter marqueur dropoff
        MapController.addDropoffMarker(map, config.dropoff.lat, config.dropoff.lng);

        // Ajouter marqueur véhicule (position initiale = pickup ou position actuelle)
        const startLat = config.status === 'accepted' ? config.pickup.lat - 0.01 : config.pickup.lat;
        const startLng = config.status === 'accepted' ? config.pickup.lng - 0.01 : config.pickup.lng;
        vehicleMarker = MapController.addVehicleMarker(map, startLat, startLng);

        // Dessiner la route si disponible
        if (config.routePolyline) {
            MapController.drawRouteFromPolyline(map, config.routePolyline);
        } else {
            // Calculer la route
            calculateAndDrawRoute();
        }

        // Ajuster la vue
        const bounds = [
            [config.pickup.lat, config.pickup.lng],
            [config.dropoff.lat, config.dropoff.lng]
        ];
        MapController.fitBounds(map, bounds);
    }

    /**
     * Calculer et dessiner la route
     */
    async function calculateAndDrawRoute() {
        try {
            let start, end;

            if (config.status === 'accepted') {
                // Route vers le pickup
                const currentPos = vehicleMarker.getLatLng();
                start = { lat: currentPos.lat, lng: currentPos.lng };
                end = { lat: config.pickup.lat, lng: config.pickup.lng };
            } else {
                // Route vers la destination
                start = { lat: config.pickup.lat, lng: config.pickup.lng };
                end = { lat: config.dropoff.lat, lng: config.dropoff.lng };
            }

            const route = await MapController.calculateRoute(start, end);

            if (route && route.geometry) {
                MapController.drawRouteFromPolyline(map, route.geometry);
            }
        } catch (error) {
            AppConfig.debug('Route calculation error:', error);
        }
    }

    /**
     * Configurer les écouteurs d'événements
     */
    function setupEventListeners() {
        // Bouton arrivée au pickup
        const arrivedBtn = document.getElementById('arrivedBtn');
        if (arrivedBtn) {
            arrivedBtn.addEventListener('click', handleArrivedAtPickup);
        }

        // Bouton terminer la course
        const completeBtn = document.getElementById('completeBtn');
        if (completeBtn) {
            completeBtn.addEventListener('click', handleCompleteRide);
        }

        // Bouton annuler
        const cancelBtn = document.getElementById('cancelRideBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', handleCancelRide);
        }
    }

    /**
     * Démarrer la simulation de mouvement
     */
    function startSimulation() {
        if (typeof VehicleSimulator === 'undefined') {
            AppConfig.debug('VehicleSimulator not available');
            return;
        }

        // Déterminer la destination selon le statut
        let destination;
        if (config.status === 'accepted') {
            destination = { lat: config.pickup.lat, lng: config.pickup.lng };
        } else if (config.status === 'in_progress') {
            destination = { lat: config.dropoff.lat, lng: config.dropoff.lng };
        } else {
            return;
        }

        // Créer le simulateur
        simulator = VehicleSimulator.create({
            marker: vehicleMarker,
            destination: destination,
            speed: 40, // km/h
            onPositionUpdate: handlePositionUpdate,
            onArrival: handleSimulatorArrival
        });

        simulator.start();
    }

    /**
     * Gérer la mise à jour de position
     */
    function handlePositionUpdate(position, stats) {
        // Mettre à jour l'affichage ETA et distance
        const etaEl = document.getElementById('etaValue');
        const distEl = document.getElementById('distanceValue');

        if (etaEl && stats.remainingTime !== undefined) {
            const minutes = Math.ceil(stats.remainingTime / 60);
            etaEl.textContent = minutes + ' min';
        }

        if (distEl && stats.remainingDistance !== undefined) {
            const km = (stats.remainingDistance / 1000).toFixed(1);
            distEl.textContent = km + ' km';
        }

        // Centrer la carte sur le véhicule (optionnel)
        // map.panTo([position.lat, position.lng]);
    }

    /**
     * Gérer l'arrivée du simulateur à destination
     */
    function handleSimulatorArrival() {
        if (config.status === 'accepted') {
            // Arrivée au pickup - notifier
            Toast.info(config.i18n.arrivedPickup);

            // Activer le bouton
            const arrivedBtn = document.getElementById('arrivedBtn');
            if (arrivedBtn) {
                arrivedBtn.classList.add('pulse');
            }
        } else if (config.status === 'in_progress') {
            // Arrivée à destination - notifier
            Toast.success(config.i18n.rideCompleted);

            // Activer le bouton
            const completeBtn = document.getElementById('completeBtn');
            if (completeBtn) {
                completeBtn.classList.add('pulse');
            }
        }
    }

    /**
     * Démarrer les mises à jour de position vers le serveur
     */
    function startPositionUpdates() {
        // Envoyer la position toutes les 5 secondes
        positionUpdateInterval = setInterval(async () => {
            if (!vehicleMarker) return;

            const pos = vehicleMarker.getLatLng();

            try {
                await ApiService.post('rides', {
                    action: 'position',
                    ride_id: config.rideId,
                    lat: pos.lat,
                    lng: pos.lng
                });
            } catch (error) {
                AppConfig.debug('Position update error:', error);
            }
        }, 5000);
    }

    /**
     * Gérer l'arrivée au point de pickup
     */
    async function handleArrivedAtPickup() {
        const btn = document.getElementById('arrivedBtn');
        if (btn) btn.disabled = true;

        try {
            await ApiService.put('rides', {
                action: 'start',
                ride_id: config.rideId
            });

            Toast.success(config.i18n.startRide);

            // Mettre à jour le statut local
            config.status = 'in_progress';

            // Arrêter le simulateur actuel et en démarrer un nouveau vers la destination
            if (simulator) {
                simulator.stop();
            }

            // Recalculer la route vers la destination
            await calculateAndDrawRoute();

            // Démarrer la simulation vers la destination
            simulator = VehicleSimulator.create({
                marker: vehicleMarker,
                destination: { lat: config.dropoff.lat, lng: config.dropoff.lng },
                speed: 40,
                onPositionUpdate: handlePositionUpdate,
                onArrival: handleSimulatorArrival
            });
            simulator.start();

            // Mettre à jour l'UI
            updateUIForInProgress();

        } catch (error) {
            Toast.error(error.message || config.i18n.error);
            if (btn) btn.disabled = false;
        }
    }

    /**
     * Gérer la fin de course
     */
    async function handleCompleteRide() {
        const btn = document.getElementById('completeBtn');
        if (btn) btn.disabled = true;

        try {
            await ApiService.put('rides', {
                action: 'complete',
                ride_id: config.rideId
            });

            Toast.success(config.i18n.rideCompleted);

            // Arrêter le simulateur
            if (simulator) {
                simulator.stop();
            }

            // Arrêter les mises à jour de position
            if (positionUpdateInterval) {
                clearInterval(positionUpdateInterval);
            }

            // Rediriger vers le dashboard après 2 secondes
            setTimeout(() => {
                AppConfig.navigateTo('driver/dashboard');
            }, 2000);

        } catch (error) {
            Toast.error(error.message || config.i18n.error);
            if (btn) btn.disabled = false;
        }
    }

    /**
     * Gérer l'annulation de course
     */
    async function handleCancelRide() {
        if (!confirm(config.i18n.confirmCancel)) {
            return;
        }

        try {
            await ApiService.put('rides', {
                action: 'cancel',
                ride_id: config.rideId
            });

            // Arrêter le simulateur
            if (simulator) {
                simulator.stop();
            }

            // Arrêter les mises à jour de position
            if (positionUpdateInterval) {
                clearInterval(positionUpdateInterval);
            }

            // Rediriger vers le dashboard
            AppConfig.navigateTo('driver/dashboard');

        } catch (error) {
            Toast.error(error.message || config.i18n.error);
        }
    }

    /**
     * Mettre à jour l'UI pour le statut in_progress
     */
    function updateUIForInProgress() {
        // Mettre à jour les classes d'adresse
        const pickupAddr = document.querySelector('.nav-address.pickup');
        const dropoffAddr = document.querySelector('.nav-address.dropoff');

        if (pickupAddr) pickupAddr.classList.remove('active');
        if (dropoffAddr) dropoffAddr.classList.add('active');

        // Remplacer le bouton
        const actionsContainer = document.querySelector('.navigation-actions');
        if (actionsContainer) {
            const arrivedBtn = document.getElementById('arrivedBtn');
            if (arrivedBtn) {
                arrivedBtn.outerHTML = `
                    <button type="button" class="btn btn-success btn-block" id="completeBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        ${config.i18n.completeRide}
                    </button>
                `;

                // Réattacher l'événement
                const newBtn = document.getElementById('completeBtn');
                if (newBtn) {
                    newBtn.addEventListener('click', handleCompleteRide);
                }
            }
        }

        // Mettre à jour le badge de statut
        const statusBadge = document.querySelector('.ride-status-badge');
        if (statusBadge) {
            statusBadge.className = 'ride-status-badge in_progress';
            statusBadge.textContent = __('ride.in_progress');
        }
    }

    /**
     * Nettoyer les ressources
     */
    function cleanup() {
        if (simulator) {
            simulator.stop();
        }

        if (positionUpdateInterval) {
            clearInterval(positionUpdateInterval);
        }
    }

    // Initialiser au chargement
    document.addEventListener('DOMContentLoaded', () => {
        if (window.NavigationConfig) {
            init();
        }
    });

    // Nettoyer à la fermeture
    window.addEventListener('beforeunload', cleanup);

    // API publique
    return {
        init,
        cleanup
    };
})();

// Rendre disponible globalement
window.DriverNavigation = DriverNavigation;
