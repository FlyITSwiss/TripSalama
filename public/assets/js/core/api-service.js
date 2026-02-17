/**
 * TripSalama - API Service
 * Service centralise pour les appels API avec gestion CSRF automatique
 */

(function() {
    'use strict';

    /**
     * ApiService - Gestion des appels API
     */
    window.ApiService = {
        /**
         * Effectuer une requete GET
         * @param {string} endpoint - Endpoint API
         * @param {Object} params - Parametres query string
         * @returns {Promise<Object>}
         */
        get: async function(endpoint, params = {}) {
            const url = this._buildUrl(endpoint, params);
            return this._request(url, {
                method: 'GET'
            });
        },

        /**
         * Effectuer une requete POST
         * @param {string} endpoint - Endpoint API
         * @param {Object} data - Donnees a envoyer
         * @returns {Promise<Object>}
         */
        post: async function(endpoint, data = {}) {
            const url = this._buildUrl(endpoint);
            return this._request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': AppConfig.getCsrfToken()
                },
                body: JSON.stringify(data)
            });
        },

        /**
         * Effectuer une requete PUT
         * @param {string} endpoint - Endpoint API
         * @param {Object} data - Donnees a envoyer
         * @returns {Promise<Object>}
         */
        put: async function(endpoint, data = {}) {
            const url = this._buildUrl(endpoint);
            return this._request(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': AppConfig.getCsrfToken()
                },
                body: JSON.stringify(data)
            });
        },

        /**
         * Effectuer une requete DELETE
         * @param {string} endpoint - Endpoint API
         * @param {Object} data - Donnees optionnelles
         * @returns {Promise<Object>}
         */
        delete: async function(endpoint, data = {}) {
            const url = this._buildUrl(endpoint);
            const options = {
                method: 'DELETE',
                headers: {
                    'X-CSRF-Token': AppConfig.getCsrfToken()
                }
            };

            if (Object.keys(data).length > 0) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(data);
            }

            return this._request(url, options);
        },

        /**
         * Envoyer un formulaire avec fichiers (FormData)
         * @param {string} endpoint - Endpoint API
         * @param {FormData} formData - Donnees du formulaire
         * @returns {Promise<Object>}
         */
        upload: async function(endpoint, formData) {
            const url = this._buildUrl(endpoint);

            // Ajouter le token CSRF au FormData
            formData.append('_csrf_token', AppConfig.getCsrfToken());

            return this._request(url, {
                method: 'POST',
                body: formData
                // Ne pas definir Content-Type, le navigateur le fait automatiquement
            });
        },

        /**
         * Construire l'URL complete
         * @private
         */
        _buildUrl: function(endpoint, params = {}) {
            let url = AppConfig.apiUrl(endpoint);

            if (Object.keys(params).length > 0) {
                const queryString = new URLSearchParams(params).toString();
                url += '?' + queryString;
            }

            return url;
        },

        /**
         * Effectuer la requete HTTP
         * @private
         */
        _request: async function(url, options = {}) {
            try {
                // Options par defaut
                const defaultOptions = {
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json'
                    }
                };

                // Fusionner les options
                const mergedOptions = {
                    ...defaultOptions,
                    ...options,
                    headers: {
                        ...defaultOptions.headers,
                        ...options.headers
                    }
                };

                AppConfig.log('API Request:', options.method || 'GET', url);

                const response = await fetch(url, mergedOptions);

                // Parser la reponse JSON
                let data;
                const contentType = response.headers.get('Content-Type');

                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = { message: await response.text() };
                }

                AppConfig.log('API Response:', response.status, data);

                // Gerer les erreurs HTTP
                if (!response.ok) {
                    const error = new Error(data.message || data.error || 'Server error');
                    error.status = response.status;
                    error.data = data;
                    throw error;
                }

                return data;

            } catch (error) {
                AppConfig.error('API Error:', error.message);
                throw error;
            }
        }
    };

    AppConfig.log('ApiService initialise');

})();
