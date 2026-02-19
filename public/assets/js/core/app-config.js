/**
 * TripSalama - Configuration Application
 * Configuration centralisee accessible globalement
 */

(function() {
    'use strict';

    // Configuration injectee depuis PHP
    const config = window.AppConfig || {};

    /**
     * AppConfig - Configuration globale
     */
    window.AppConfig = {
        // Proprietes de base
        basePath: config.basePath || '',
        apiPath: config.apiPath || '/api',
        lang: config.lang || 'fr',
        csrfToken: config.csrfToken || '',
        _debug: config.debug || false,

        /**
         * Generer une URL complete
         * @param {string} path - Chemin relatif
         * @returns {string} URL complete
         */
        baseUrl: function(path = '') {
            const base = this.basePath;
            if (!path) return base || '/';
            return base + '/' + path.replace(/^\//, '');
        },

        /**
         * Generer une URL API
         * @param {string} endpoint - Endpoint API
         * @returns {string} URL API complete
         */
        apiUrl: function(endpoint) {
            const base = this.basePath + this.apiPath;
            return base + '/' + endpoint.replace(/^\//, '');
        },

        /**
         * Generer une URL asset
         * @param {string} path - Chemin de l'asset
         * @returns {string} URL asset complete
         */
        assetUrl: function(path) {
            return this.baseUrl('assets/' + path.replace(/^\//, ''));
        },

        /**
         * Naviguer vers une URL
         * @param {string} path - Chemin de destination
         */
        navigateTo: function(path) {
            window.location.href = this.baseUrl(path);
        },

        /**
         * Recharger la page courante
         */
        reload: function() {
            window.location.reload();
        },

        /**
         * Obtenir le token CSRF
         * @returns {string} Token CSRF
         */
        getCsrfToken: function() {
            // Essayer depuis la meta tag en priorite
            const meta = document.querySelector('meta[name="csrf-token"]');
            if (meta) {
                return meta.getAttribute('content');
            }
            return this.csrfToken;
        },

        /**
         * Log de debug (uniquement en mode debug)
         * @param {...any} args - Arguments a logger
         */
        log: function(...args) {
            if (this._debug) {
                console.log('[TripSalama]', ...args);
            }
        },

        /**
         * Alias pour log() - utilise pour la compatibilite
         * @param {...any} args - Arguments a logger
         */
        debug: function(...args) {
            this.log(...args);
        },

        /**
         * Log d'erreur
         * @param {...any} args - Arguments a logger
         */
        error: function(...args) {
            console.error('[TripSalama Error]', ...args);
        },

        /**
         * Verifier si l'utilisateur est sur mobile
         * @returns {boolean}
         */
        isMobile: function() {
            return window.innerWidth < 518;
        },

        /**
         * Verifier si l'utilisateur est sur tablette
         * @returns {boolean}
         */
        isTablet: function() {
            return window.innerWidth >= 518 && window.innerWidth < 838;
        },

        /**
         * Verifier si l'utilisateur est sur desktop
         * @returns {boolean}
         */
        isDesktop: function() {
            return window.innerWidth >= 838;
        },

        /**
         * Obtenir la langue courante
         * @returns {string}
         */
        getLang: function() {
            return this.lang;
        }
    };

    // Initialiser
    AppConfig.log('Configuration initialisee', {
        basePath: AppConfig.basePath,
        apiPath: AppConfig.apiPath,
        lang: AppConfig.lang
    });

})();
