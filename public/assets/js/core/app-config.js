/**
 * TripSalama - App Configuration
 * Configuration centralisee pour le frontend
 */

'use strict';

const AppConfig = (function() {
    // Configuration par defaut
    const defaults = {
        basePath: '',
        apiPath: '/api',
        lang: 'fr',
        csrfToken: '',
        debug: false
    };

    // Fusionner avec la config du serveur
    const config = Object.assign({}, defaults, window.AppConfig || {});

    /**
     * Obtenir le base path
     */
    function getBasePath() {
        return config.basePath || '';
    }

    /**
     * Generer une URL complete
     */
    function baseUrl(path = '') {
        const base = getBasePath();
        path = path.replace(/^\/+/, '');
        if (!path) return base || '/';
        return `${base}/${path}`;
    }

    /**
     * Generer une URL pour l'API
     * ATTENTION: Ne pas re-prefixer avec /api
     */
    function apiUrl(endpoint) {
        endpoint = endpoint.replace(/^\/+/, '');
        return `${config.apiPath}/${endpoint}`;
    }

    /**
     * Generer une URL pour un asset
     */
    function assetUrl(path) {
        path = path.replace(/^\/+/, '');
        return baseUrl(`assets/${path}`);
    }

    /**
     * Obtenir le token CSRF
     */
    function getCsrfToken() {
        // D'abord depuis la config
        if (config.csrfToken) {
            return config.csrfToken;
        }
        // Sinon depuis la meta tag
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    }

    /**
     * Obtenir la langue courante
     */
    function getLang() {
        return config.lang || 'fr';
    }

    /**
     * Mode debug actif ?
     */
    function isDebug() {
        return config.debug === true;
    }

    /**
     * Log de debug (uniquement en mode debug)
     */
    function debug(...args) {
        if (isDebug()) {
            console.log('[TripSalama]', ...args);
        }
    }

    /**
     * Navigation vers une URL
     */
    function navigateTo(path) {
        window.location.href = baseUrl(path);
    }

    /**
     * Recharger la page
     */
    function reload() {
        window.location.reload();
    }

    // API publique
    return {
        getBasePath,
        baseUrl,
        apiUrl,
        assetUrl,
        getCsrfToken,
        getLang,
        isDebug,
        debug,
        navigateTo,
        reload,
        // Acces direct a la config
        config
    };
})();

// Rendre disponible globalement
window.AppConfig = AppConfig;
