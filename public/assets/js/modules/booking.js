/**
 * TripSalama - Booking Module
 * Gestion de la reservation de course
 */

'use strict';

const Booking = (function() {
    // Elements DOM
    let pickupInput, dropoffInput;
    let pickupDropdown, dropoffDropdown;
    let estimationCard, confirmBtn;
    let locateMeBtn;

    // Etat
    let pickup = null;
    let dropoff = null;
    let routeData = null;
    let searchTimeout = null;

    /**
     * Initialiser le module
     */
    function init() {
        // Elements
        pickupInput = document.getElementById('pickupInput');
        dropoffInput = document.getElementById('dropoffInput');
        pickupDropdown = document.getElementById('pickupDropdown');
        dropoffDropdown = document.getElementById('dropoffDropdown');
        estimationCard = document.getElementById('estimationCard');
        confirmBtn = document.getElementById('confirmBtn');
        locateMeBtn = document.getElementById('locateMeBtn');

        if (!pickupInput || !dropoffInput) {
            AppConfig.debug('Booking: Required elements not found');
            return;
        }

        // Initialiser la carte
        MapController.init('map', {
            center: window.BookingConfig?.defaultCenter || [46.2044, 6.1432],
            zoom: window.BookingConfig?.defaultZoom || 13
        });

        // Event listeners
        setupAutocomplete(pickupInput, pickupDropdown, 'pickup');
        setupAutocomplete(dropoffInput, dropoffDropdown, 'dropoff');

        locateMeBtn.addEventListener('click', handleLocateMe);

        document.getElementById('bookingForm').addEventListener('submit', handleSubmit);

        // Fermer les dropdowns en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!pickupInput.contains(e.target) && !pickupDropdown.contains(e.target)) {
                pickupDropdown.classList.add('hidden');
            }
            if (!dropoffInput.contains(e.target) && !dropoffDropdown.contains(e.target)) {
                dropoffDropdown.classList.add('hidden');
            }
        });

        AppConfig.debug('Booking module initialized');
    }

    /**
     * Configurer l'autocompletion
     */
    function setupAutocomplete(input, dropdown, type) {
        input.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const query = input.value.trim();

            if (query.length < 3) {
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
     */
    async function searchAddress(query, dropdown, type) {
        try {
            // Utiliser Nominatim directement (sans proxy serveur pour le MVP)
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;

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
    }

    /**
     * Selectionner une location
     */
    function selectLocation(type, location) {
        if (type === 'pickup') {
            pickup = location;
            pickupInput.value = location.name.split(',')[0];
            document.getElementById('pickupLat').value = location.lat;
            document.getElementById('pickupLng').value = location.lng;
            document.getElementById('pickupAddress').value = location.name;

            MapController.addMarker('pickup', location.lat, location.lng, 'pickup', location.name);

            EventBus.emit(EventBus.Events.BOOKING_PICKUP_SET, location);

        } else {
            dropoff = location;
            dropoffInput.value = location.name.split(',')[0];
            document.getElementById('dropoffLat').value = location.lat;
            document.getElementById('dropoffLng').value = location.lng;
            document.getElementById('dropoffAddress').value = location.name;

            MapController.addMarker('dropoff', location.lat, location.lng, 'dropoff', location.name);

            EventBus.emit(EventBus.Events.BOOKING_DROPOFF_SET, location);
        }

        // Si les deux sont definis, calculer la route
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

            const response = await fetch(url);
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
            AppConfig.debug('Routing error:', error);
            Toast.error(window.BookingConfig?.i18n?.error || 'Error calculating route');
        }
    }

    /**
     * Calculer le prix
     */
    function calculatePrice(distanceKm, durationMin) {
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
     * Gerer "Ma position"
     */
    async function handleLocateMe() {
        locateMeBtn.disabled = true;
        locateMeBtn.classList.add('locating');

        try {
            const location = await MapController.showUserLocation();

            // Reverse geocoding
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}`;
            const response = await fetch(url);
            const data = await response.json();

            selectLocation('pickup', {
                lat: location.lat,
                lng: location.lng,
                name: data.display_name
            });

        } catch (error) {
            Toast.error(window.BookingConfig?.i18n?.geolocationError || 'Unable to get location');
        } finally {
            locateMeBtn.disabled = false;
            locateMeBtn.classList.remove('locating');
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
                Toast.success(window.__ ? __('msg.ride_created') : 'Ride created');
                EventBus.emit(EventBus.Events.BOOKING_CONFIRMED, response.data);

                // Rediriger vers le tracking
                setTimeout(() => {
                    AppConfig.navigateTo(`passenger/ride/${response.data.ride_id}`);
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
