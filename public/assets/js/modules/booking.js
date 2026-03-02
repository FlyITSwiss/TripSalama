/**
 * TripSalama - Booking Module
 * Gestion de la réservation de course
 * Avec géolocalisation automatique et modification de position
 */

'use strict';

const Booking = (function() {
    // Éléments DOM
    let pickupInput, dropoffInput;
    let pickupDropdown, dropoffDropdown;
    let estimationCard, confirmBtn;
    let locateMeBtn, quickLocateBtn;
    let pickupStatusIndicator;

    // État
    let pickup = null;
    let dropoff = null;
    let routeData = null;
    let searchTimeout = null;
    let isAutoLocating = false;
    let hasAutoLocated = false;

    /**
     * Initialiser le module
     */
    function init() {
        // Éléments
        pickupInput = document.getElementById('pickupInput');
        dropoffInput = document.getElementById('dropoffInput');
        pickupDropdown = document.getElementById('pickupDropdown');
        dropoffDropdown = document.getElementById('dropoffDropdown');
        estimationCard = document.getElementById('estimationCard');
        confirmBtn = document.getElementById('confirmBtn');
        locateMeBtn = document.getElementById('locateMeBtn');
        quickLocateBtn = document.getElementById('quickLocateBtn');
        pickupStatusIndicator = document.getElementById('pickupStatusIndicator');

        if (!pickupInput || !dropoffInput) {
            AppConfig.debug('Booking: Required elements not found');
            return;
        }

        // Initialiser la carte avec style sombre type Uber
        MapController.init('map', {
            center: window.BookingConfig?.defaultCenter || [46.2044, 6.1432],
            zoom: window.BookingConfig?.defaultZoom || 13,
            darkMode: true
        });

        // Event listeners
        setupAutocomplete(pickupInput, pickupDropdown, 'pickup');
        setupAutocomplete(dropoffInput, dropoffDropdown, 'dropoff');

        if (locateMeBtn) {
            locateMeBtn.addEventListener('click', handleLocateMe);
        }

        if (quickLocateBtn) {
            quickLocateBtn.addEventListener('click', handleLocateMe);
        }

        document.getElementById('bookingForm').addEventListener('submit', handleSubmit);

        // Permettre de modifier la position en cliquant sur l'input même si déjà géolocalisé
        pickupInput.addEventListener('focus', handlePickupFocus);

        // Fermer les dropdowns en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!pickupInput.contains(e.target) && !pickupDropdown.contains(e.target)) {
                pickupDropdown.classList.add('hidden');
            }
            if (!dropoffInput.contains(e.target) && !dropoffDropdown.contains(e.target)) {
                dropoffDropdown.classList.add('hidden');
            }
        });

        // Écouter les événements de géolocalisation
        setupGeoLocationEvents();

        // Géolocalisation automatique au chargement
        autoLocateOnLoad();

        AppConfig.debug('Booking module initialized');
    }

    /**
     * Configurer les événements de géolocalisation
     */
    function setupGeoLocationEvents() {
        if (typeof EventBus !== 'undefined') {
            EventBus.on(EventBus.Events.GEO_DETECTING, () => {
                showPickupStatus('detecting');
            });

            EventBus.on(EventBus.Events.GEO_ERROR, (error) => {
                showPickupStatus('error', error.message);
            });
        }
    }

    /**
     * Géolocalisation automatique au chargement
     */
    async function autoLocateOnLoad() {
        if (hasAutoLocated) return;

        // Vérifier si la géolocalisation est supportée
        if (!GeoLocationService.isSupported()) {
            AppConfig.debug('Geolocation not supported');
            return;
        }

        // Vérifier les permissions
        const permission = await GeoLocationService.checkPermission();

        if (permission === 'denied') {
            AppConfig.debug('Geolocation permission denied');
            return;
        }

        // Lancer la géolocalisation automatique
        isAutoLocating = true;
        showPickupStatus('detecting');

        try {
            // D'abord essayer une position rapide
            let position;
            try {
                position = await GeoLocationService.getQuickPosition();
                await setPickupFromPosition(position, true);

                // Puis améliorer avec position précise en arrière-plan
                GeoLocationService.getHighAccuracyPosition().then(async (precisePos) => {
                    if (precisePos.accuracy < position.accuracy) {
                        await setPickupFromPosition(precisePos, false);
                    }
                }).catch(() => {
                    // Ignorer - on garde la position rapide
                });

            } catch (quickError) {
                // Position rapide échouée, essayer directement la haute précision
                AppConfig.debug('Quick position failed, trying high accuracy:', quickError);
                position = await GeoLocationService.getHighAccuracyPosition();
                await setPickupFromPosition(position, true);
            }

        } catch (error) {
            AppConfig.debug('Auto-location failed:', error);
            // Ne pas afficher l'erreur immédiatement, l'utilisateur peut entrer manuellement
            showPickupStatus('error', error.message);
            // Masquer l'erreur après 5 secondes
            setTimeout(() => {
                if (pickupStatusIndicator) {
                    pickupStatusIndicator.classList.add('hidden');
                }
            }, 5000);
        } finally {
            isAutoLocating = false;
            hasAutoLocated = true;
        }
    }

    /**
     * Définir le point de départ depuis une position GPS
     */
    async function setPickupFromPosition(position, showLoader = true) {
        if (showLoader) {
            showPickupStatus('detecting');
        }

        try {
            // Reverse geocoding
            const address = await GeoLocationService.reverseGeocode(position.lat, position.lng);

            // Détecter le pays automatiquement à partir des coordonnées
            if (typeof CountryDetectionService !== 'undefined') {
                CountryDetectionService.detectFromCoordinates(position.lat, position.lng);
                AppConfig.debug('Country detection from coordinates:', CountryDetectionService.getCurrentCountry());
            }

            selectLocation('pickup', {
                lat: position.lat,
                lng: position.lng,
                name: address.displayName,
                shortName: address.shortName,
                accuracy: position.accuracy
            });

            showPickupStatus('found', null, position.accuracy);

            // Afficher le marqueur utilisateur
            MapController.addMarker('user', position.lat, position.lng, 'user');
            MapController.setCenter(position.lat, position.lng, 15);

        } catch (error) {
            showPickupStatus('error', getText('geolocation.error'));
            throw error;
        }
    }

    /**
     * Obtenir une traduction avec fallback sur BookingConfig.i18n
     */
    function getText(key, params = {}) {
        // Essayer I18n si disponible et prêt
        if (typeof I18n !== 'undefined' && I18n.isReady && I18n.isReady()) {
            return I18n.t(key, params);
        }

        // Fallback sur BookingConfig.i18n (défini dans le PHP) ou I18n global
        const config = window.BookingConfig?.i18n || {};
        const i18n = window.I18n;
        const keyMap = {
            'geolocation.detecting': config.detectingLocation || (i18n?.t('geolocation.detecting') ?? key),
            'geolocation.detected': config.locationFound || (i18n?.t('geolocation.detected') ?? key),
            'geolocation.accuracy': config.positionAccuracy || (i18n?.t('geolocation.accuracy') ?? key),
            'geolocation.error': config.geolocationError || (i18n?.t('geolocation.error') ?? key),
            'geolocation.use_current': config.useCurrentLocation || (i18n?.t('geolocation.use_current') ?? key)
        };

        let text = keyMap[key] || key;

        // Remplacer les paramètres :param
        for (const [param, val] of Object.entries(params)) {
            text = text.replace(new RegExp(':' + param, 'g'), String(val));
        }

        return text;
    }

    /**
     * Afficher le statut du point de départ
     */
    function showPickupStatus(status, message = null, accuracy = null) {
        if (!pickupStatusIndicator) return;

        pickupStatusIndicator.classList.remove('hidden', 'detecting', 'found', 'error');

        switch (status) {
            case 'detecting':
                pickupStatusIndicator.classList.add('detecting');
                pickupStatusIndicator.innerHTML = `
                    <span class="status-spinner"></span>
                    <span class="status-text">${getText('geolocation.detecting')}</span>
                `;
                pickupStatusIndicator.classList.remove('hidden');
                break;

            case 'found':
                pickupStatusIndicator.classList.add('found');
                const accuracyText = accuracy ? getText('geolocation.accuracy', { meters: Math.round(accuracy) }) : '';
                pickupStatusIndicator.innerHTML = `
                    <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span class="status-text">${getText('geolocation.detected')}</span>
                    ${accuracyText ? `<span class="status-accuracy">${accuracyText}</span>` : ''}
                `;
                pickupStatusIndicator.classList.remove('hidden');

                // Masquer après 3 secondes
                setTimeout(() => {
                    pickupStatusIndicator.classList.add('hidden');
                }, 3000);
                break;

            case 'error':
                pickupStatusIndicator.classList.add('error');
                pickupStatusIndicator.innerHTML = `
                    <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span class="status-text">${message || getText('geolocation.error')}</span>
                `;
                pickupStatusIndicator.classList.remove('hidden');
                break;

            default:
                pickupStatusIndicator.classList.add('hidden');
        }
    }

    /**
     * Gérer le focus sur l'input pickup
     * Permet de modifier la position même après géolocalisation
     */
    function handlePickupFocus() {
        // Sélectionner tout le texte pour faciliter la modification
        pickupInput.select();

        // Si une position est définie, proposer de la modifier
        if (pickup && pickupDropdown) {
            // Afficher une option pour utiliser la position actuelle
            pickupDropdown.innerHTML = `
                <div class="booking-dropdown-item current-location" data-action="use-current">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <div class="autocomplete-item-text">
                        <div class="autocomplete-item-primary">${getText('geolocation.use_current')}</div>
                        <div class="autocomplete-item-secondary">${pickup.shortName || pickup.name}</div>
                    </div>
                </div>
            `;

            // Handler pour réutiliser la position actuelle
            pickupDropdown.querySelector('[data-action="use-current"]')?.addEventListener('click', () => {
                handleLocateMe();
                pickupDropdown.classList.add('hidden');
            });

            pickupDropdown.classList.remove('hidden');

            // Auto-scroll pour afficher le dropdown
            scrollDropdownIntoView(pickupDropdown);
        }
    }

    /**
     * Configurer l'autocompletion
     */
    function setupAutocomplete(input, dropdown, type) {
        input.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const query = input.value.trim();

            if (query.length < 4) {
                dropdown.classList.add('hidden');
                return;
            }

            searchTimeout = setTimeout(() => {
                searchAddress(query, dropdown, type);
            }, 300);
        });

        input.addEventListener('focus', () => {
            if (dropdown.children.length > 0) {
                dropdown.classList.remove('hidden');
            }
        });
    }

    /**
     * Rechercher une adresse via Nominatim
     * Pour le dropoff, limite les résultats dans un rayon de 30km autour du pickup
     */
    async function searchAddress(query, dropdown, type) {
        try {
            // Construire l'URL Nominatim
            let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;

            // Pour la destination, limiter au rayon de 30km autour du point de départ
            if (type === 'dropoff' && pickup) {
                // 30km ≈ 0.27 degrés de latitude, ajuster longitude selon la latitude
                const radiusDeg = 0.27;
                const lngRadius = radiusDeg / Math.cos(pickup.lat * Math.PI / 180);

                // viewbox = lon_min, lat_min, lon_max, lat_max
                const viewbox = [
                    (pickup.lng - lngRadius).toFixed(4),
                    (pickup.lat - radiusDeg).toFixed(4),
                    (pickup.lng + lngRadius).toFixed(4),
                    (pickup.lat + radiusDeg).toFixed(4)
                ].join(',');

                url += `&viewbox=${viewbox}&bounded=1`;
                AppConfig.debug('Dropoff search bounded to 30km around pickup');
            }

            const response = await fetch(url, {
                headers: { 'Accept-Language': AppConfig.getLang() }
            });

            if (!response.ok) throw new Error('Search failed');

            const results = await response.json();
            displayResults(results, dropdown, type);

        } catch (error) {
            AppConfig.debug('Search error:', error);
            dropdown.innerHTML = `<div class="autocomplete-item" style="color: var(--color-text-muted);">
                ${window.BookingConfig?.i18n?.noResults || 'No results'}
            </div>`;
            dropdown.classList.remove('hidden');
        }
    }

    /**
     * Afficher les resultats
     */
    function displayResults(results, dropdown, type) {
        if (results.length === 0) {
            dropdown.innerHTML = `<div class="autocomplete-item" style="color: var(--color-text-muted);">
                ${window.BookingConfig?.i18n?.noResults || 'No results'}
            </div>`;
            dropdown.classList.remove('hidden');
            scrollDropdownIntoView(dropdown);
            return;
        }

        dropdown.innerHTML = results.map(result => `
            <div class="autocomplete-item" data-lat="${result.lat}" data-lng="${result.lon}" data-name="${result.display_name}">
                <svg class="autocomplete-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; flex-shrink: 0;">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
                <div class="autocomplete-item-text">
                    <div class="autocomplete-item-primary">${result.name || result.display_name.split(',')[0]}</div>
                    <div class="autocomplete-item-secondary">${result.display_name}</div>
                </div>
            </div>
        `).join('');

        // Ajouter les click handlers
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                selectLocation(type, {
                    lat: parseFloat(item.dataset.lat),
                    lng: parseFloat(item.dataset.lng),
                    name: item.dataset.name
                });
                dropdown.classList.add('hidden');
            });
        });

        dropdown.classList.remove('hidden');

        // Auto-scroll pour afficher le dropdown
        scrollDropdownIntoView(dropdown);
    }

    /**
     * Scroll automatique pour afficher le dropdown de suggestions
     * Fait scroller la bottom sheet pour que le dropdown soit visible
     * Optimisé pour mobile avec clavier virtuel (Capacitor/APK)
     */
    function scrollDropdownIntoView(dropdown) {
        // Délai plus long pour attendre que le clavier virtuel s'ouvre sur mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const delay = isMobile ? 350 : 50; // Plus de temps sur mobile pour le clavier

        setTimeout(() => {
            // Trouver le container scrollable (booking-sheet)
            const sheet = document.querySelector('.booking-sheet');
            if (!sheet) return;

            // Trouver l'input wrapper parent du dropdown
            const inputWrapper = dropdown.closest('.booking-input-wrapper');
            if (!inputWrapper) return;

            const input = inputWrapper.querySelector('input');

            // Sur mobile, utiliser visualViewport si disponible pour gérer le clavier
            const viewportHeight = window.visualViewport
                ? window.visualViewport.height
                : window.innerHeight;

            // Calculer les positions
            const sheetRect = sheet.getBoundingClientRect();
            const dropdownRect = dropdown.getBoundingClientRect();
            const inputRect = input ? input.getBoundingClientRect() : null;

            // Zone visible = min entre la sheet et le viewport (moins le clavier)
            const visibleBottom = Math.min(sheetRect.bottom, viewportHeight - 20);

            // D'abord, s'assurer que l'input est visible
            if (inputRect && inputRect.top < sheetRect.top) {
                sheet.scrollBy({
                    top: inputRect.top - sheetRect.top - 20,
                    behavior: 'smooth'
                });
            }

            // Ensuite, s'assurer que le dropdown est visible
            if (dropdownRect.bottom > visibleBottom) {
                const scrollNeeded = dropdownRect.bottom - visibleBottom + 30; // Marge pour bien voir

                // Sur mobile, aussi forcer le scroll du body/window
                if (isMobile) {
                    // Scroller la sheet
                    sheet.scrollBy({
                        top: scrollNeeded,
                        behavior: 'smooth'
                    });

                    // Et forcer le focus scroll natif après un court délai
                    setTimeout(() => {
                        if (input && document.activeElement === input) {
                            // Utiliser scrollIntoView avec block: 'center' pour mobile
                            inputWrapper.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                        }
                    }, 100);
                } else {
                    sheet.scrollBy({
                        top: scrollNeeded,
                        behavior: 'smooth'
                    });
                }
            }

            // Listener pour visualViewport resize (clavier qui s'ouvre/ferme)
            if (window.visualViewport && !window._bookingViewportListener) {
                window._bookingViewportListener = true;
                window.visualViewport.addEventListener('resize', () => {
                    // Re-ajuster si un dropdown est visible
                    const visibleDropdown = document.querySelector('.booking-dropdown:not(.hidden)');
                    if (visibleDropdown) {
                        requestAnimationFrame(() => scrollDropdownIntoView(visibleDropdown));
                    }
                });
            }
        }, delay);
    }

    /**
     * Sélectionner une location
     */
    function selectLocation(type, location) {
        // Utiliser shortName si disponible, sinon extraire de name
        const displayName = location.shortName || location.name.split(',')[0];

        if (type === 'pickup') {
            pickup = {
                ...location,
                shortName: displayName
            };
            pickupInput.value = displayName;
            document.getElementById('pickupLat').value = location.lat;
            document.getElementById('pickupLng').value = location.lng;
            document.getElementById('pickupAddress').value = location.name;

            MapController.addMarker('pickup', location.lat, location.lng, 'pickup', location.name);

            if (typeof EventBus !== 'undefined') {
                EventBus.emit(EventBus.Events.BOOKING_PICKUP_SET, location);
            }

            // Masquer le bouton de localisation rapide si position définie
            if (quickLocateBtn) {
                quickLocateBtn.classList.add('hidden');
            }

        } else {
            dropoff = {
                ...location,
                shortName: displayName
            };
            dropoffInput.value = displayName;
            document.getElementById('dropoffLat').value = location.lat;
            document.getElementById('dropoffLng').value = location.lng;
            document.getElementById('dropoffAddress').value = location.name;

            MapController.addMarker('dropoff', location.lat, location.lng, 'dropoff', location.name);

            if (typeof EventBus !== 'undefined') {
                EventBus.emit(EventBus.Events.BOOKING_DROPOFF_SET, location);
            }
        }

        // Si les deux sont définis, calculer la route
        if (pickup && dropoff) {
            calculateRoute();
        }
    }

    /**
     * Calculer la route
     */
    async function calculateRoute() {
        try {
            // OSRM public API pour le MVP
            const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=polyline`;

            const response = typeof FetchUtils !== 'undefined'
                ? await FetchUtils.fetchWithRetry(url, {}, 2, 5000)
                : await fetch(url);
            if (!response.ok) throw new Error('Routing failed');

            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                routeData = {
                    distance: route.distance / 1000, // km
                    duration: Math.round(route.duration / 60), // minutes
                    polyline: route.geometry
                };

                // Dessiner la route
                const coordinates = MapController.decodePolyline(routeData.polyline);
                MapController.drawRoute(coordinates);

                // Ajuster la vue
                MapController.fitBounds([
                    [pickup.lat, pickup.lng],
                    [dropoff.lat, dropoff.lng]
                ]);

                // Calculer le prix
                const price = calculatePrice(routeData.distance, routeData.duration);

                // Afficher l'estimation
                showEstimation(routeData.distance, routeData.duration, price);

                StateManager.set(StateManager.Keys.BOOKING_ROUTE, routeData);
                EventBus.emit(EventBus.Events.BOOKING_ESTIMATE_READY, { ...routeData, price });
            }

        } catch (error) {
            AppConfig.debug('OSRM failed, using Haversine fallback:', error.message);

            // Fallback Haversine avec facteur route (1.3x distance directe)
            const calcDistance = (lat1, lng1, lat2, lng2) => {
                const R = 6371;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLng = (lng2 - lng1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            };

            const distance = calcDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng) * 1.3;
            const duration = Math.round((distance / 30) * 60);

            routeData = {
                distance: Math.round(distance * 100) / 100,
                duration: duration,
                polyline: null,
                isEstimate: true
            };

            MapController.drawRoute([[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]]);
            MapController.fitBounds([[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]]);

            const price = calculatePrice(routeData.distance, routeData.duration);
            showEstimation(routeData.distance, routeData.duration, price);

            StateManager.set(StateManager.Keys.BOOKING_ROUTE, routeData);
            EventBus.emit(EventBus.Events.BOOKING_ESTIMATE_READY, { ...routeData, price });

            Toast.warning(window.BookingConfig?.i18n?.estimateOnly || 'Estimated route');
        }
    }

    /**
     * Calculer le prix selon le pays détecté
     */
    function calculatePrice(distanceKm, durationMin) {
        // Utiliser CountryDetectionService si disponible
        if (typeof CountryDetectionService !== 'undefined') {
            return CountryDetectionService.calculateEstimatedPrice(distanceKm, durationMin);
        }

        // Fallback sur valeurs par défaut
        const basePrice = 3.50;
        const pricePerKm = 1.20;
        const pricePerMin = 0.25;
        const minPrice = 5.00;

        let price = basePrice + (distanceKm * pricePerKm) + (durationMin * pricePerMin);
        return Math.max(price, minPrice);
    }

    /**
     * Afficher l'estimation
     */
    function showEstimation(distance, duration, price) {
        document.getElementById('estimatedDistance').textContent = I18n.formatDistance(distance);
        document.getElementById('estimatedDuration').textContent = I18n.formatDuration(duration);
        document.getElementById('estimatedPrice').textContent = I18n.formatCurrency(price);

        estimationCard.classList.remove('hidden');
        confirmBtn.classList.remove('hidden');
    }

    /**
     * Gérer "Ma position"
     */
    async function handleLocateMe() {
        // Désactiver les boutons pendant la géolocalisation
        if (locateMeBtn) {
            locateMeBtn.disabled = true;
            locateMeBtn.classList.add('locating');
        }
        if (quickLocateBtn) {
            quickLocateBtn.disabled = true;
            quickLocateBtn.classList.add('locating');
        }

        showPickupStatus('detecting');

        try {
            // Utiliser GeoLocationService pour une meilleure gestion
            const position = await GeoLocationService.getHighAccuracyPosition();
            await setPickupFromPosition(position);

        } catch (error) {
            const errorMessage = error.message || I18n.t('geolocation.error');
            Toast.error(errorMessage);
            showPickupStatus('error', errorMessage);
        } finally {
            if (locateMeBtn) {
                locateMeBtn.disabled = false;
                locateMeBtn.classList.remove('locating');
            }
            if (quickLocateBtn) {
                quickLocateBtn.disabled = false;
                quickLocateBtn.classList.remove('locating');
            }
        }
    }

    /**
     * Soumettre la reservation
     */
    async function handleSubmit(e) {
        e.preventDefault();

        if (!pickup || !dropoff || !routeData) {
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px;"></span>';

        try {
            const response = await ApiService.post('rides', {
                action: 'create',
                pickup_address: pickup.name,
                pickup_lat: pickup.lat,
                pickup_lng: pickup.lng,
                dropoff_address: dropoff.name,
                dropoff_lat: dropoff.lat,
                dropoff_lng: dropoff.lng,
                estimated_distance_km: routeData.distance,
                estimated_duration_min: routeData.duration,
                estimated_price: calculatePrice(routeData.distance, routeData.duration),
                route_polyline: routeData.polyline
            });

            if (response.success && response.data?.ride_id) {
                Toast.success(window.BookingConfig?.i18n?.rideCreated || 'Ride created');
                EventBus.emit(EventBus.Events.BOOKING_CONFIRMED, response.data);

                // Rediriger vers le mode démo (simulation complète)
                setTimeout(() => {
                    AppConfig.navigateTo(`passenger/demo/${response.data.ride_id}`);
                }, 1000);
            }

        } catch (error) {
            Toast.error(error.message || 'Error creating ride');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = window.__ ? __('booking.confirm_ride') : 'Confirm ride';
        }
    }

    // Initialiser au chargement
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('bookingForm')) {
            init();
        }
    });

    // API publique
    return {
        init,
        selectLocation,
        calculateRoute
    };
})();

// Rendre disponible globalement
window.Booking = Booking;
