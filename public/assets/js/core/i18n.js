/**
 * TripSalama - Internationalization (i18n)
 * Systeme de traduction pour le frontend
 */

'use strict';

const I18n = (function() {
    // Traductions chargees
    let translations = {};
    let currentLang = 'fr';
    let isLoaded = false;

    /**
     * Charger les traductions pour une langue
     * @param {string} lang - Code de langue (fr, en)
     * @returns {Promise}
     */
    async function load(lang = null) {
        lang = lang || AppConfig.getLang();
        currentLang = lang;

        try {
            const url = AppConfig.assetUrl(`lang/${lang}.json`);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to load translations: ${response.status}`);
            }

            translations = await response.json();
            isLoaded = true;

            AppConfig.debug(`I18n: Loaded ${lang} translations`);
            EventBus.emit('i18n:loaded', { lang });

            return translations;
        } catch (error) {
            console.error('I18n: Error loading translations', error);
            // Fallback: essayer de charger le francais
            if (lang !== 'fr') {
                return load('fr');
            }
            throw error;
        }
    }

    /**
     * Traduire une cle
     * @param {string} key - Cle de traduction (ex: "auth.login")
     * @param {Object} params - Parametres de remplacement
     * @returns {string}
     */
    function t(key, params = {}) {
        if (!isLoaded) {
            console.warn('I18n: Translations not loaded yet');
            return key;
        }

        // Parcourir la cle imbriquee
        const keys = key.split('.');
        let value = translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                AppConfig.debug(`I18n: Key not found "${key}"`);
                return key;
            }
        }

        if (typeof value !== 'string') {
            return key;
        }

        // Remplacer les parametres :param
        Object.entries(params).forEach(([param, val]) => {
            value = value.replace(new RegExp(`:${param}`, 'g'), String(val));
        });

        return value;
    }

    /**
     * Verifier si une cle existe
     * @param {string} key - Cle a verifier
     * @returns {boolean}
     */
    function has(key) {
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
    }

    /**
     * Obtenir la langue courante
     * @returns {string}
     */
    function getLang() {
        return currentLang;
    }

    /**
     * Changer de langue
     * @param {string} lang - Nouvelle langue
     * @returns {Promise}
     */
    async function setLang(lang) {
        if (lang === currentLang && isLoaded) {
            return translations;
        }
        return load(lang);
    }

    /**
     * Verifier si les traductions sont chargees
     * @returns {boolean}
     */
    function loaded() {
        return isLoaded;
    }

    /**
     * Formater une date selon la locale
     * @param {Date|string} date - Date a formater
     * @param {Object} options - Options Intl.DateTimeFormat
     * @returns {string}
     */
    function formatDate(date, options = {}) {
        if (typeof date === 'string') {
            date = new Date(date);
        }

        const defaultOptions = {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        };

        const locale = currentLang === 'fr' ? 'fr-CH' : 'en-US';
        return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(date);
    }

    /**
     * Formater une heure selon la locale
     * @param {Date|string} date - Date/heure a formater
     * @returns {string}
     */
    function formatTime(date) {
        if (typeof date === 'string') {
            date = new Date(date);
        }

        const locale = currentLang === 'fr' ? 'fr-CH' : 'en-US';
        return new Intl.DateTimeFormat(locale, {
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    /**
     * Formater un montant selon la locale
     * @param {number} amount - Montant
     * @param {string} currency - Devise (default: CHF)
     * @returns {string}
     */
    function formatCurrency(amount, currency = 'CHF') {
        const locale = currentLang === 'fr' ? 'fr-CH' : 'en-US';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    /**
     * Formater une distance
     * @param {number} km - Distance en km
     * @returns {string}
     */
    function formatDistance(km) {
        if (km < 1) {
            return Math.round(km * 1000) + ' m';
        }
        return km.toFixed(1).replace('.', currentLang === 'fr' ? ',' : '.') + ' km';
    }

    /**
     * Formater une duree en minutes
     * @param {number} minutes - Duree en minutes
     * @returns {string}
     */
    function formatDuration(minutes) {
        if (minutes < 60) {
            return minutes + ' min';
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours + 'h' + (mins > 0 ? String(mins).padStart(2, '0') : '');
    }

    // API publique
    return {
        load,
        t,
        has,
        getLang,
        setLang,
        loaded,
        formatDate,
        formatTime,
        formatCurrency,
        formatDistance,
        formatDuration
    };
})();

// Fonction globale raccourcie
function __(key, params = {}) {
    return I18n.t(key, params);
}

// Rendre disponible globalement
window.I18n = I18n;
window.__ = __;

// Charger les traductions au demarrage
document.addEventListener('DOMContentLoaded', () => {
    I18n.load().catch(error => {
        console.error('Failed to load translations:', error);
    });
});
