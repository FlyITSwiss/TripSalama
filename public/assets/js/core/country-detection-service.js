/**
 * TripSalama - Country Detection Service
 * Détection automatique du pays (France/Maroc) et gestion des devises
 */

'use strict';

const CountryDetectionService = (function() {

    // Configuration des pays supportés
    const COUNTRIES = {
        FR: {
            name: 'France',
            currency: 'EUR',
            currencySymbol: '€',
            currencyPosition: 'after',
            decimalSeparator: ',',
            thousandsSeparator: ' ',
            bounds: {
                minLat: 41.3,
                maxLat: 51.1,
                minLng: -5.1,
                maxLng: 9.6
            },
            pricing: {
                basePrice: 2.50,
                pricePerKm: 1.10,
                pricePerMin: 0.20,
                minPrice: 4.00
            }
        },
        MA: {
            name: 'Maroc',
            currency: 'MAD',
            currencySymbol: 'DH',
            currencyPosition: 'after',
            decimalSeparator: ',',
            thousandsSeparator: ' ',
            bounds: {
                minLat: 27.6,
                maxLat: 35.9,
                minLng: -13.2,
                maxLng: -1.0
            },
            pricing: {
                basePrice: 10.00,
                pricePerKm: 5.00,
                pricePerMin: 1.00,
                minPrice: 15.00
            }
        }
    };

    // État interne
    let currentCountry = null;
    let isDetecting = false;
    let detectionPromise = null;

    /**
     * Détecter le pays depuis les coordonnées GPS
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {string|null} Code pays (FR, MA) ou null
     */
    function detectFromCoordinates(lat, lng) {
        for (const [code, config] of Object.entries(COUNTRIES)) {
            const bounds = config.bounds;
            if (lat >= bounds.minLat && lat <= bounds.maxLat &&
                lng >= bounds.minLng && lng <= bounds.maxLng) {
                setCountry(code);
                return code;
            }
        }
        return null;
    }

    /**
     * Détecter le pays via reverse geocoding (Nominatim)
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<string|null>} Code pays
     */
    async function detectFromGeocoding(lat, lng) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3&addressdetails=1`;

            const response = await fetch(url, {
                headers: {
                    'Accept-Language': AppConfig.getLang()
                }
            });

            if (!response.ok) {
                throw new Error('Geocoding failed');
            }

            const data = await response.json();
            const countryCode = (data.address?.country_code || '').toUpperCase();

            if (isSupported(countryCode)) {
                setCountry(countryCode);
                return countryCode;
            }

            return null;
        } catch (error) {
            AppConfig.debug('Country detection geocoding error:', error);
            return null;
        }
    }

    /**
     * Détection automatique complète
     * Utilise les bounding boxes puis fallback sur geocoding
     * @returns {Promise<string>} Code pays détecté
     */
    async function autoDetect() {
        // Éviter les détections multiples simultanées
        if (isDetecting && detectionPromise) {
            return detectionPromise;
        }

        // Si déjà détecté en session, retourner directement
        const storedCountry = getStoredCountry();
        if (storedCountry) {
            currentCountry = storedCountry;
            return storedCountry;
        }

        isDetecting = true;

        detectionPromise = new Promise(async (resolve) => {
            try {
                // Obtenir la position GPS
                const position = await GeoLocationService.getCurrentPosition();

                if (position && position.lat && position.lng) {
                    // Essayer d'abord les bounding boxes (rapide)
                    let detected = detectFromCoordinates(position.lat, position.lng);

                    // Si pas trouvé, utiliser le geocoding (plus lent mais précis)
                    if (!detected) {
                        detected = await detectFromGeocoding(position.lat, position.lng);
                    }

                    if (detected) {
                        AppConfig.debug('Country detected:', detected);
                        EventBus.emit(EventBus.Events.COUNTRY_DETECTED, {
                            country: detected,
                            config: COUNTRIES[detected]
                        });
                        resolve(detected);
                        return;
                    }
                }

                // Fallback sur pays par défaut
                const defaultCountry = getDefaultCountry();
                setCountry(defaultCountry);
                resolve(defaultCountry);

            } catch (error) {
                AppConfig.debug('Country detection error:', error);
                const defaultCountry = getDefaultCountry();
                setCountry(defaultCountry);
                resolve(defaultCountry);
            } finally {
                isDetecting = false;
            }
        });

        return detectionPromise;
    }

    /**
     * Vérifier si un pays est supporté
     */
    function isSupported(countryCode) {
        return COUNTRIES.hasOwnProperty(countryCode?.toUpperCase());
    }

    /**
     * Définir le pays manuellement
     */
    function setCountry(countryCode) {
        countryCode = countryCode?.toUpperCase();

        if (!isSupported(countryCode)) {
            AppConfig.debug('Country not supported:', countryCode);
            return false;
        }

        currentCountry = countryCode;
        storeCountry(countryCode);

        // Notifier le serveur
        syncWithServer(countryCode);

        EventBus.emit(EventBus.Events.COUNTRY_CHANGED, {
            country: countryCode,
            config: COUNTRIES[countryCode]
        });

        return true;
    }

    /**
     * Stocker le pays en localStorage
     */
    function storeCountry(countryCode) {
        try {
            localStorage.setItem('tripsalama_country', countryCode);
        } catch (e) {
            // localStorage indisponible
        }
    }

    /**
     * Récupérer le pays stocké
     */
    function getStoredCountry() {
        try {
            const stored = localStorage.getItem('tripsalama_country');
            if (stored && isSupported(stored)) {
                return stored;
            }
        } catch (e) {
            // localStorage indisponible
        }
        return null;
    }

    /**
     * Obtenir le pays par défaut
     */
    function getDefaultCountry() {
        // Utiliser la config serveur si disponible
        if (window.AppConfig?.defaultCountry) {
            return window.AppConfig.defaultCountry;
        }
        return 'FR';
    }

    /**
     * Synchroniser avec le serveur
     */
    async function syncWithServer(countryCode) {
        try {
            await ApiService.post('user/set-country', { country: countryCode });
        } catch (error) {
            // Silencieux - la session PHP sera mise à jour à la prochaine requête
            AppConfig.debug('Country sync error:', error);
        }
    }

    /**
     * Obtenir la configuration du pays actuel
     */
    function getCurrentConfig() {
        const country = currentCountry || getStoredCountry() || getDefaultCountry();
        return COUNTRIES[country] || COUNTRIES.FR;
    }

    /**
     * Obtenir le code pays actuel
     */
    function getCurrentCountry() {
        return currentCountry || getStoredCountry() || getDefaultCountry();
    }

    /**
     * Obtenir la devise actuelle
     */
    function getCurrentCurrency() {
        return getCurrentConfig().currency;
    }

    /**
     * Obtenir le symbole de devise actuel
     */
    function getCurrentCurrencySymbol() {
        return getCurrentConfig().currencySymbol;
    }

    /**
     * Obtenir la configuration pricing du pays actuel
     */
    function getCurrentPricing() {
        return getCurrentConfig().pricing;
    }

    /**
     * Formater un prix selon la devise du pays
     * @param {number} amount - Montant à formater
     * @returns {string} Prix formaté avec devise
     */
    function formatPrice(amount) {
        const config = getCurrentConfig();

        // Formater le nombre
        const parts = amount.toFixed(2).split('.');
        const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);
        const formatted = intPart + config.decimalSeparator + parts[1];

        // Ajouter le symbole
        if (config.currencyPosition === 'before') {
            return config.currencySymbol + ' ' + formatted;
        }
        return formatted + ' ' + config.currencySymbol;
    }

    /**
     * Calculer le prix estimé d'une course
     * @param {number} distanceKm - Distance en km
     * @param {number} durationMin - Durée en minutes
     * @returns {number} Prix estimé
     */
    function calculateEstimatedPrice(distanceKm, durationMin) {
        const pricing = getCurrentPricing();

        let price = pricing.basePrice;
        price += distanceKm * pricing.pricePerKm;
        price += durationMin * pricing.pricePerMin;

        return Math.max(price, pricing.minPrice);
    }

    /**
     * Obtenir tous les pays supportés
     */
    function getSupportedCountries() {
        const result = [];
        for (const [code, config] of Object.entries(COUNTRIES)) {
            result.push({
                code: code,
                name: config.name,
                currency: config.currency,
                currencySymbol: config.currencySymbol
            });
        }
        return result;
    }

    // Enregistrer les événements
    if (typeof EventBus !== 'undefined' && EventBus.Events) {
        Object.assign(EventBus.Events, {
            COUNTRY_DETECTED: 'country:detected',
            COUNTRY_CHANGED: 'country:changed'
        });
    }

    // API publique
    return {
        // Détection
        autoDetect,
        detectFromCoordinates,
        detectFromGeocoding,

        // Configuration
        setCountry,
        getCurrentCountry,
        getCurrentConfig,
        getCurrentCurrency,
        getCurrentCurrencySymbol,
        getCurrentPricing,
        getSupportedCountries,
        isSupported,

        // Formatage
        formatPrice,
        calculateEstimatedPrice,

        // Constantes
        COUNTRIES
    };
})();

// Rendre disponible globalement
window.CountryDetectionService = CountryDetectionService;
