/**
 * TripSalama - Event Bus
 * Systeme de publication/abonnement pour la communication entre composants
 */

'use strict';

const EventBus = (function() {
    // Stockage des listeners
    const listeners = new Map();

    /**
     * S'abonner a un evenement
     * @param {string} event - Nom de l'evenement
     * @param {Function} callback - Fonction a appeler
     * @returns {Function} - Fonction pour se desabonner
     */
    function on(event, callback) {
        if (!listeners.has(event)) {
            listeners.set(event, new Set());
        }
        listeners.get(event).add(callback);

        AppConfig.debug(`EventBus: subscribed to "${event}"`);

        // Retourner une fonction pour se desabonner
        return function unsubscribe() {
            off(event, callback);
        };
    }

    /**
     * S'abonner a un evenement une seule fois
     * @param {string} event - Nom de l'evenement
     * @param {Function} callback - Fonction a appeler
     */
    function once(event, callback) {
        const wrapper = function(data) {
            off(event, wrapper);
            callback(data);
        };
        on(event, wrapper);
    }

    /**
     * Se desabonner d'un evenement
     * @param {string} event - Nom de l'evenement
     * @param {Function} callback - Fonction a retirer
     */
    function off(event, callback) {
        if (listeners.has(event)) {
            listeners.get(event).delete(callback);
            AppConfig.debug(`EventBus: unsubscribed from "${event}"`);
        }
    }

    /**
     * Emettre un evenement
     * @param {string} event - Nom de l'evenement
     * @param {*} data - Donnees a transmettre
     */
    function emit(event, data = null) {
        AppConfig.debug(`EventBus: emit "${event}"`, data);

        if (listeners.has(event)) {
            listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`EventBus: Error in listener for "${event}"`, error);
                }
            });
        }
    }

    /**
     * Verifier si un evenement a des listeners
     * @param {string} event - Nom de l'evenement
     * @returns {boolean}
     */
    function hasListeners(event) {
        return listeners.has(event) && listeners.get(event).size > 0;
    }

    /**
     * Supprimer tous les listeners d'un evenement
     * @param {string} event - Nom de l'evenement
     */
    function clear(event) {
        if (event) {
            listeners.delete(event);
        } else {
            listeners.clear();
        }
    }

    // Liste des evenements predefinies
    const Events = {
        // Auth
        AUTH_LOGIN: 'auth:login',
        AUTH_LOGOUT: 'auth:logout',
        AUTH_ERROR: 'auth:error',

        // Ride
        RIDE_CREATED: 'ride:created',
        RIDE_ACCEPTED: 'ride:accepted',
        RIDE_STARTED: 'ride:started',
        RIDE_COMPLETED: 'ride:completed',
        RIDE_CANCELLED: 'ride:cancelled',
        RIDE_STATUS_CHANGED: 'ride:status-changed',

        // Map
        MAP_READY: 'map:ready',
        MAP_CLICK: 'map:click',
        MAP_LOCATION_FOUND: 'map:location-found',
        MAP_LOCATION_ERROR: 'map:location-error',

        // Booking
        BOOKING_PICKUP_SET: 'booking:pickup-set',
        BOOKING_DROPOFF_SET: 'booking:dropoff-set',
        BOOKING_ESTIMATE_READY: 'booking:estimate-ready',
        BOOKING_CONFIRMED: 'booking:confirmed',

        // Driver
        DRIVER_STATUS_CHANGED: 'driver:status-changed',
        DRIVER_POSITION_UPDATED: 'driver:position-updated',
        DRIVER_RIDE_REQUEST: 'driver:ride-request',

        // Simulation
        SIM_STARTED: 'simulation:started',
        SIM_STOPPED: 'simulation:stopped',
        SIM_POSITION_UPDATE: 'simulation:position-update',
        SIM_ARRIVED: 'simulation:arrived',

        // UI
        TOAST_SHOW: 'toast:show',
        MODAL_OPEN: 'modal:open',
        MODAL_CLOSE: 'modal:close',
        LOADING_START: 'loading:start',
        LOADING_END: 'loading:end'
    };

    // API publique
    return {
        on,
        once,
        off,
        emit,
        hasListeners,
        clear,
        Events
    };
})();

// Rendre disponible globalement
window.EventBus = EventBus;
