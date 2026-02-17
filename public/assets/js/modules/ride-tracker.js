/**
 * TripSalama - Ride Tracker
 * Suivi d'une course en cours
 */

'use strict';

const RideTracker = (function() {
    let config = null;
    let pollingInterval = null;
    let statusText = null;
    let etaText = null;

    /**
     * Initialiser le tracker
     */
    function init() {
        config = window.TrackingConfig;

        if (!config || !config.rideId) {
            AppConfig.debug('RideTracker: No config found');
            return;
        }

        statusText = document.getElementById('statusText');
        etaText = document.getElementById('etaText');

        // Initialiser la carte
        MapController.init('map', {
            center: [config.pickup.lat, config.pickup.lng],
            zoom: 14
        });

        // Ajouter les markers
        MapController.addMarker('pickup', config.pickup.lat, config.pickup.lng, 'pickup');
        MapController.addMarker('dropoff', config.dropoff.lat, config.dropoff.lng, 'dropoff');

        // Dessiner la route si disponible
        if (config.routePolyline) {
            const coordinates = MapController.decodePolyline(config.routePolyline);
            MapController.drawRoute(coordinates);
            MapController.fitBounds([
                [config.pickup.lat, config.pickup.lng],
                [config.dropoff.lat, config.dropoff.lng]
            ]);
        }

        // Setup boutons de vitesse
        setupSpeedButtons();

        // Demarrer la simulation si course en cours
        if (['accepted', 'driver_arriving', 'in_progress'].includes(config.status)) {
            startSimulation();
        }

        // Setup bouton annuler
        const cancelBtn = document.getElementById('cancelRideBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', handleCancel);
        }

        // Ecouter les evenements
        EventBus.on(EventBus.Events.SIM_POSITION_UPDATE, handlePositionUpdate);
        EventBus.on(EventBus.Events.SIM_ARRIVED, handleArrival);

        AppConfig.debug('RideTracker: Initialized');
    }

    /**
     * Configurer les boutons de vitesse
     */
    function setupSpeedButtons() {
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Retirer la classe active des autres
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Definir la vitesse
                const speed = parseInt(btn.dataset.speed, 10) || 1;
                VehicleSimulator.setSpeed(speed);
            });
        });
    }

    /**
     * Demarrer la simulation
     */
    function startSimulation() {
        if (!config.routePolyline) return;

        // Selon le statut, demarrer a different endroits
        VehicleSimulator.start(config.routePolyline);

        // Mettre a jour le statut
        updateStatus('driver_arriving');
    }

    /**
     * Gerer la mise a jour de position
     */
    function handlePositionUpdate(data) {
        if (data.progress > 30 && config.status !== 'in_progress') {
            updateStatus('in_progress');
        }

        // Calculer l'ETA
        const remainingPoints = data.remaining || 0;
        const estimatedMinutes = Math.round(remainingPoints / 2); // Approximation
        updateETA(estimatedMinutes);
    }

    /**
     * Gerer l'arrivee
     */
    function handleArrival() {
        updateStatus('completed');
        Toast.success(config.i18n?.completed || 'Ride completed!');

        // Afficher le modal de notation apres un delai
        setTimeout(() => {
            showRatingModal();
        }, 2000);
    }

    /**
     * Mettre a jour le statut affiche
     */
    function updateStatus(status) {
        config.status = status;

        const statusDot = document.querySelector('.status-dot');
        if (statusDot) {
            statusDot.className = 'status-dot ' + status.replace('_', '-');
        }

        if (statusText) {
            statusText.textContent = config.i18n?.[status.replace('_', '')] ||
                                     config.i18n?.[status] ||
                                     status;
        }

        EventBus.emit(EventBus.Events.RIDE_STATUS_CHANGED, { status });
    }

    /**
     * Mettre a jour l'ETA
     */
    function updateETA(minutes) {
        if (etaText) {
            etaText.textContent = `${config.i18n?.eta || 'ETA'}: ${I18n.formatDuration(minutes)}`;
        }
    }

    /**
     * Afficher le modal de notation
     */
    function showRatingModal() {
        Modal.open({
            title: config.i18n?.rate || 'Rate your ride',
            content: `
                <div style="text-align: center;">
                    <p style="margin-bottom: var(--space-21);">${config.i18n?.rateDriver || 'How was your driver?'}</p>
                    <div class="rating-stars" id="ratingStars">
                        ${[1,2,3,4,5].map(n => `
                            <button class="rating-star" data-rating="${n}">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                </svg>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `,
            size: 'sm',
            buttons: [
                {
                    text: config.i18n?.submitRating || 'Submit',
                    class: 'btn-primary',
                    onClick: () => submitRating()
                }
            ]
        });

        // Setup star rating
        let selectedRating = 0;
        document.querySelectorAll('.rating-star').forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.rating, 10);
                document.querySelectorAll('.rating-star').forEach((s, i) => {
                    s.classList.toggle('active', i < selectedRating);
                });
            });

            star.addEventListener('mouseenter', () => {
                const rating = parseInt(star.dataset.rating, 10);
                document.querySelectorAll('.rating-star').forEach((s, i) => {
                    s.style.color = i < rating ? 'var(--color-accent)' : '';
                });
            });
        });

        document.getElementById('ratingStars')?.addEventListener('mouseleave', () => {
            document.querySelectorAll('.rating-star').forEach((s, i) => {
                s.style.color = i < selectedRating ? 'var(--color-accent)' : '';
            });
        });

        window._selectedRating = () => selectedRating;
    }

    /**
     * Soumettre la notation
     */
    async function submitRating() {
        const rating = window._selectedRating ? window._selectedRating() : 0;

        if (rating === 0) {
            Toast.warning('Please select a rating');
            return;
        }

        try {
            await ApiService.post('rides', {
                action: 'rate',
                ride_id: config.rideId,
                rating: rating
            });

            Modal.close();
            Toast.success(config.i18n?.ratingSubmitted || 'Thank you for your rating!');

            // Rediriger vers le dashboard
            setTimeout(() => {
                AppConfig.navigateTo('passenger/dashboard');
            }, 1500);

        } catch (error) {
            Toast.error(error.message);
        }
    }

    /**
     * Annuler la course
     */
    async function handleCancel() {
        const confirmed = await Modal.confirm(
            config.i18n?.cancelConfirm || 'Are you sure you want to cancel?',
            { danger: true }
        );

        if (!confirmed) return;

        try {
            await ApiService.put('rides', {
                action: 'cancel',
                ride_id: config.rideId
            });

            Toast.success('Ride cancelled');
            VehicleSimulator.stop();

            setTimeout(() => {
                AppConfig.navigateTo('passenger/dashboard');
            }, 1000);

        } catch (error) {
            Toast.error(error.message);
        }
    }

    /**
     * Arreter le tracking
     */
    function stop() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        VehicleSimulator.stop();
    }

    // Initialiser au chargement
    document.addEventListener('DOMContentLoaded', () => {
        if (window.TrackingConfig) {
            init();
        }
    });

    // API publique
    return {
        init,
        stop,
        updateStatus,
        updateETA
    };
})();

// Rendre disponible globalement
window.RideTracker = RideTracker;
