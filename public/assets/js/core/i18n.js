/**
 * TripSalama - Internationalisation (i18n)
 * Systeme de traduction pour le frontend
 */

(function() {
    'use strict';

    // Cache des traductions
    let translations = {};
    let currentLang = 'fr';
    let isLoaded = false;

    /**
     * i18n - Gestion des traductions
     */
    window.i18n = {
        /**
         * Initialiser le systeme i18n
         * @param {string} lang - Langue a charger
         * @returns {Promise<void>}
         */
        init: async function(lang = null) {
            currentLang = lang || AppConfig.lang || 'fr';

            try {
                const url = AppConfig.assetUrl('lang/' + currentLang + '.json');
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error('Fichier de langue non trouve');
                }

                translations = await response.json();
                isLoaded = true;

                AppConfig.log('i18n charge:', currentLang, Object.keys(translations).length, 'cles');

            } catch (error) {
                AppConfig.error('i18n loading error:', error.message);
                translations = {};
                isLoaded = true;
            }
        },

        /**
         * Obtenir une traduction
         * @param {string} key - Cle de traduction (ex: "auth.login")
         * @param {Object} params - Parametres de remplacement
         * @returns {string} Texte traduit
         */
        t: function(key, params = {}) {
            // Naviguer dans l'objet avec les cles imbriquees
            const keys = key.split('.');
            let value = translations;

            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    // Cle non trouvee, retourner la cle
                    AppConfig.log('i18n: cle manquante:', key);
                    return key;
                }
            }

            if (typeof value !== 'string') {
                return key;
            }

            // Remplacer les parametres :param
            let result = value;
            for (const [param, val] of Object.entries(params)) {
                result = result.replace(new RegExp(':' + param, 'g'), String(val));
            }

            return result;
        },

        /**
         * Alias pour t()
         */
        get: function(key, params = {}) {
            return this.t(key, params);
        },

        /**
         * Verifier si une cle existe
         * @param {string} key - Cle a verifier
         * @returns {boolean}
         */
        has: function(key) {
            const keys = key.split('.');
            let value = translations;

            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    return false;
                }
            }

            return typeof value === 'string';
        },

        /**
         * Obtenir la langue courante
         * @returns {string}
         */
        getLang: function() {
            return currentLang;
        },

        /**
         * Changer de langue
         * @param {string} lang - Nouvelle langue
         * @returns {Promise<void>}
         */
        setLang: async function(lang) {
            if (lang !== currentLang) {
                await this.init(lang);
            }
        },

        /**
         * Verifier si les traductions sont chargees
         * @returns {boolean}
         */
        isReady: function() {
            return isLoaded;
        }
    };

    /**
     * Fonction globale de traduction (shortcut)
     * @param {string} key - Cle de traduction
     * @param {Object} params - Parametres
     * @returns {string}
     */
    window.__ = function(key, params = {}) {
        return i18n.t(key, params);
    };

    /**
     * Fonction globale alias
     */
    window.t = window.__;

    // Auto-initialiser si le DOM est pret
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            i18n.init();
        });
    } else {
        i18n.init();
    }

})();
