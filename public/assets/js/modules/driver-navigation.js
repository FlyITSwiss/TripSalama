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

        // PIN input handlers
        setupPinInputHandlers();
    }

    /**
     * Configurer les handlers pour les inputs PIN
     */
    function setupPinInputHandlers() {
        const pinInputs = [
            document.getElementById('pinInput1'),
            document.getElementById('pinInput2'),
            document.getElementById('pinInput3'),
            document.getElementById('pinInput4')
        ];

        const verifyBtn = document.getElementById('verifyPinBtn');
        if (!verifyBtn) return;

        // Auto-focus et navigation entre inputs
        pinInputs.forEach((input, index) => {
            if (!input) return;

            input.addEventListener('input', (e) => {
                const value = e.target.value.replace(/\D/g, '');
                e.target.value = value;

                // Passer au suivant si un chiffre est entré
                if (value && index < 3) {
                    pinInputs[index + 1].focus();
                }

                // Activer/désactiver le bouton verify
                const pin = pinInputs.map(i => i.value).join('');
                verifyBtn.disabled = pin.length !== 4;
            });

            input.addEventListener('keydown', (e) => {
                // Backspace: revenir au précédent si vide
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    pinInputs[index - 1].focus();
                }
                // Enter: soumettre si complet
                if (e.key === 'Enter') {
                    const pin = pinInputs.map(i => i.value).join('');
                    if (pin.length === 4) {
                        handleVerifyPin();
                    }
                }
            });

            // Sélectionner tout au focus
            input.addEventListener('focus', () => {
                input.select();
            });
        });

        // Bouton vérifier
        verifyBtn.addEventListener('click', handleVerifyPin);
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
     * Étape 1: Génère le PIN et l'envoie par SMS à la passagère
     */
    async function handleArrivedAtPickup() {
        const btn = document.getElementById('arrivedBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-small"></span> ${config.i18n.pinGenerating || 'Generating...'}`;
        }

        try {
            // Appeler l'action "arrived" qui génère le PIN et envoie le SMS
            const response = await ApiService.put('rides', {
                action: 'arrived',
                ride_id: config.rideId
            });

            // Afficher le modal PIN
            showPinModal();

            // Notification
            Toast.info(config.i18n.pinSentSms || 'Code sent via SMS');

        } catch (error) {
            Toast.error(error.message || config.i18n.error);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg> ${config.i18n.arrivedPickup}`;
            }
        }
    }

    /**
     * Afficher le modal de saisie du PIN
     */
    function showPinModal() {
        const modal = document.getElementById('pinModal');
        if (modal) {
            modal.classList.remove('hidden');
            // Focus sur le premier input
            setTimeout(() => {
                const firstInput = document.getElementById('pinInput1');
                if (firstInput) firstInput.focus();
            }, 300);
        }
    }

    /**
     * Masquer le modal PIN
     */
    function hidePinModal() {
        const modal = document.getElementById('pinModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        // Reset les inputs
        for (let i = 1; i <= 4; i++) {
            const input = document.getElementById('pinInput' + i);
            if (input) {
                input.value = '';
                input.classList.remove('error', 'success');
            }
        }
        document.getElementById('pinHint').textContent = config.i18n.pinSentSms || '';
        document.getElementById('pinHint').classList.remove('error');
        document.getElementById('pinAttempts').textContent = '';
    }

    /**
     * Gérer la vérification du PIN
     * Étape 2: Vérifie le PIN puis démarre la course
     */
    async function handleVerifyPin() {
        const pinInputs = [
            document.getElementById('pinInput1'),
            document.getElementById('pinInput2'),
            document.getElementById('pinInput3'),
            document.getElementById('pinInput4')
        ];

        const pin = pinInputs.map(i => i.value).join('');
        if (pin.length !== 4) return;

        const verifyBtn = document.getElementById('verifyPinBtn');
        if (verifyBtn) {
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<span class="spinner-small"></span>';
        }

        try {
            // Vérifier le PIN
            const response = await ApiService.put('rides', {
                action: 'verify-pin',
                ride_id: config.rideId,
                pin: pin
            });

            // PIN valide - animation succès
            pinInputs.forEach(input => {
                input.classList.remove('error');
                input.classList.add('success');
            });

            Toast.success(config.i18n.pinVerified || 'Code verified');

            // Attendre un peu pour l'animation puis démarrer la course
            setTimeout(async () => {
                await startRideAfterPinVerified();
            }, 800);

        } catch (error) {
            // PIN invalide - animation erreur
            pinInputs.forEach(input => {
                input.classList.add('error');
                setTimeout(() => input.classList.remove('error'), 500);
            });

            const hint = document.getElementById('pinHint');
            const attempts = document.getElementById('pinAttempts');

            // Gérer les différents types d'erreurs
            if (error.data && error.data.error_code === 'max_attempts') {
                hint.textContent = config.i18n.pinMaxAttempts || 'Maximum attempts reached';
                hint.classList.add('error');
                // Fermer le modal et réinitialiser
                setTimeout(() => {
                    hidePinModal();
                    const btn = document.getElementById('arrivedBtn');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg> ${config.i18n.arrivedPickup}`;
                    }
                }, 2000);
            } else if (error.data && error.data.error_code === 'expired') {
                hint.textContent = config.i18n.pinExpired || 'Code expired';
                hint.classList.add('error');
            } else {
                hint.textContent = config.i18n.pinInvalid || 'Invalid code';
                hint.classList.add('error');

                // Afficher les tentatives restantes
                if (error.data && error.data.attempts_left !== undefined) {
                    const remaining = error.data.attempts_left;
                    const attemptsText = (config.i18n.pinAttemptsLeft || ':count attempts remaining')
                        .replace(':count', remaining);
                    attempts.textContent = attemptsText;
                }
            }

            // Reset les inputs pour nouvelle tentative
            pinInputs.forEach(input => input.value = '');
            pinInputs[0].focus();

            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = config.i18n.pinVerify || 'Verify';
            }
        }
    }

    /**
     * Démarrer la course après vérification du PIN
     */
    async function startRideAfterPinVerified() {
        try {
            // Appeler l'action "start" pour démarrer officiellement la course
            await ApiService.put('rides', {
                action: 'start',
                ride_id: config.rideId
            });

            // Fermer le modal PIN
            hidePinModal();

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
