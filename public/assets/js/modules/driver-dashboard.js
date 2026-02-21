/**
 * TripSalama - Driver Dashboard Module
 */

'use strict';

const DriverDashboard = (function() {
    let config = null;
    let pollingInterval = null;

    /**
     * Initialiser
     */
    function init() {
        config = window.DriverConfig;

        if (!config) {
            AppConfig.debug('DriverDashboard: No config');
            return;
        }

        // Toggle disponibilite
        const toggle = document.getElementById('availabilityToggle');
        if (toggle) {
            toggle.addEventListener('change', handleToggleAvailability);
        }

        // Boutons accept/reject
        setupRideButtons();

        // Si disponible, demarrer le polling
        if (config.isAvailable) {
            startPolling();
        }

        AppConfig.debug('DriverDashboard: Initialized');
    }

    /**
     * Toggle disponibilite
     */
    async function handleToggleAvailability(e) {
        const isAvailable = e.target.checked;

        try {
            // Obtenir la position si on devient disponible
            let position = null;
            if (isAvailable) {
                try {
                    position = await MapController.getCurrentLocation();

                    // Détecter automatiquement le pays à partir de la position
                    if (typeof CountryDetectionService !== 'undefined' && position) {
                        CountryDetectionService.detectFromCoordinates(position.lat, position.lng);
                        AppConfig.debug('Country detected for driver:', CountryDetectionService.getCurrentCountry());
                    }
                } catch (err) {
                    // Position par defaut si geolocalisation refuse
                    position = { lat: 46.2044, lng: 6.1432 };
                }
            }

            await ApiService.put('drivers', {
                action: 'toggle-status',
                is_available: isAvailable,
                lat: position?.lat,
                lng: position?.lng
            });

            // Mettre a jour l'UI
            updateStatusUI(isAvailable);

            if (isAvailable) {
                startPolling();
                Toast.success(config.i18n.available);
            } else {
                stopPolling();
                Toast.info(config.i18n.unavailable);
            }

        } catch (error) {
            // Revenir a l'etat precedent
            e.target.checked = !isAvailable;
            Toast.error(config.i18n.error);
        }
    }

    /**
     * Mettre a jour l'UI du statut
     */
    function updateStatusUI(isAvailable) {
        const statusIcon = document.getElementById('statusIcon');
        const statusText = document.getElementById('statusText');

        if (statusIcon) {
            statusIcon.className = 'driver-status-icon ' + (isAvailable ? 'available' : 'unavailable');
            statusIcon.innerHTML = isAvailable ?
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>` :
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>`;
        }

        if (statusText) {
            statusText.textContent = isAvailable ? config.i18n.available : config.i18n.unavailable;
        }
    }

    /**
     * Configurer les boutons de course
     */
    function setupRideButtons() {
        document.querySelectorAll('.accept-btn').forEach(btn => {
            btn.addEventListener('click', () => handleAcceptRide(btn.dataset.rideId));
        });

        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', () => handleRejectRide(btn.dataset.rideId));
        });
    }

    /**
     * Accepter une course
     */
    async function handleAcceptRide(rideId) {
        const btn = document.querySelector(`.accept-btn[data-ride-id="${rideId}"]`);
        if (btn) btn.disabled = true;

        try {
            await ApiService.put('rides', {
                action: 'accept',
                ride_id: parseInt(rideId, 10),
                vehicle_id: config.vehicleId
            });

            Toast.success(config.i18n.accepted);

            // Rediriger vers la navigation
            setTimeout(() => {
                AppConfig.navigateTo(`driver/navigation/${rideId}`);
            }, 1000);

        } catch (error) {
            Toast.error(error.message || config.i18n.error);
            if (btn) btn.disabled = false;
        }
    }

    /**
     * Refuser une course
     */
    async function handleRejectRide(rideId) {
        const card = document.querySelector(`.ride-request-card[data-ride-id="${rideId}"]`);

        try {
            // Simplement masquer la carte (pas d'API pour reject dans le MVP)
            if (card) {
                card.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => card.remove(), 300);
            }

        } catch (error) {
            Toast.error(error.message);
        }
    }

    /**
     * Demarrer le polling pour les nouvelles courses
     */
    function startPolling() {
        if (pollingInterval) return;

        pollingInterval = setInterval(async () => {
            try {
                const response = await ApiService.get('drivers', { action: 'pending-rides' });

                if (response.success && response.data?.rides) {
                    // Mettre a jour la liste (simplifie pour le MVP)
                    // En production: comparer et ajouter les nouvelles
                }
            } catch (error) {
                AppConfig.debug('Polling error:', error);
            }
        }, 10000); // Toutes les 10 secondes

        AppConfig.debug('Polling started');
    }

    /**
     * Arreter le polling
     */
    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        AppConfig.debug('Polling stopped');
    }

    // Initialiser au chargement
    document.addEventListener('DOMContentLoaded', () => {
        if (window.DriverConfig) {
            init();
        }
    });

    // API publique
    return {
        init,
        startPolling,
        stopPolling
    };
})();

// Rendre disponible globalement
window.DriverDashboard = DriverDashboard;
