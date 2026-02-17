/**
 * TripSalama - State Manager
 * Gestion centralisee de l'etat de l'application
 */

'use strict';

const StateManager = (function() {
    // Etat global
    const state = new Map();

    // Subscribers par cle
    const subscribers = new Map();

    /**
     * Obtenir une valeur de l'etat
     * @param {string} key - Cle de l'etat
     * @param {*} defaultValue - Valeur par defaut
     * @returns {*}
     */
    function get(key, defaultValue = null) {
        return state.has(key) ? state.get(key) : defaultValue;
    }

    /**
     * Definir une valeur dans l'etat
     * @param {string} key - Cle de l'etat
     * @param {*} value - Nouvelle valeur
     */
    function set(key, value) {
        const oldValue = state.get(key);
        state.set(key, value);

        // Notifier les subscribers
        if (subscribers.has(key)) {
            subscribers.get(key).forEach(callback => {
                try {
                    callback(value, oldValue);
                } catch (error) {
                    console.error(`StateManager: Error in subscriber for "${key}"`, error);
                }
            });
        }

        AppConfig.debug(`State: "${key}" changed`, { old: oldValue, new: value });
    }

    /**
     * Mettre a jour partiellement un objet dans l'etat
     * @param {string} key - Cle de l'etat
     * @param {Object} updates - Mises a jour partielles
     */
    function update(key, updates) {
        const current = get(key, {});
        set(key, { ...current, ...updates });
    }

    /**
     * Supprimer une valeur de l'etat
     * @param {string} key - Cle de l'etat
     */
    function remove(key) {
        const oldValue = state.get(key);
        state.delete(key);

        if (subscribers.has(key)) {
            subscribers.get(key).forEach(callback => {
                callback(undefined, oldValue);
            });
        }
    }

    /**
     * S'abonner aux changements d'une cle
     * @param {string} key - Cle a observer
     * @param {Function} callback - Fonction appelee lors des changements
     * @returns {Function} - Fonction pour se desabonner
     */
    function subscribe(key, callback) {
        if (!subscribers.has(key)) {
            subscribers.set(key, new Set());
        }
        subscribers.get(key).add(callback);

        // Retourner une fonction pour se desabonner
        return function unsubscribe() {
            if (subscribers.has(key)) {
                subscribers.get(key).delete(callback);
            }
        };
    }

    /**
     * Obtenir l'etat complet
     * @returns {Object}
     */
    function getAll() {
        const result = {};
        state.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    /**
     * Reinitialiser l'etat
     */
    function clear() {
        state.clear();
        subscribers.clear();
    }

    /**
     * Verifier si une cle existe
     * @param {string} key - Cle a verifier
     * @returns {boolean}
     */
    function has(key) {
        return state.has(key);
    }

    // Cles d'etat predefinies
    const Keys = {
        // User
        USER: 'user',
        USER_ROLE: 'user.role',
        USER_POSITION: 'user.position',

        // Ride
        CURRENT_RIDE: 'ride.current',
        RIDE_STATUS: 'ride.status',
        RIDE_ESTIMATE: 'ride.estimate',

        // Booking
        BOOKING_PICKUP: 'booking.pickup',
        BOOKING_DROPOFF: 'booking.dropoff',
        BOOKING_ROUTE: 'booking.route',

        // Driver
        DRIVER_AVAILABLE: 'driver.available',
        DRIVER_POSITION: 'driver.position',
        PENDING_RIDES: 'driver.pending_rides',

        // Map
        MAP_CENTER: 'map.center',
        MAP_ZOOM: 'map.zoom',

        // UI
        LOADING: 'ui.loading',
        MODAL_OPEN: 'ui.modal_open',
        SIDEBAR_OPEN: 'ui.sidebar_open'
    };

    // API publique
    return {
        get,
        set,
        update,
        remove,
        subscribe,
        getAll,
        clear,
        has,
        Keys
    };
})();

// Rendre disponible globalement
window.StateManager = StateManager;
