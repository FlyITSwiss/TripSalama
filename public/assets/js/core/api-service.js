/**
 * TripSalama - API Service
 * Service centralise pour les appels API avec CSRF automatique
 */

'use strict';

const ApiService = (function() {
    /**
     * Effectuer une requete HTTP
     */
    async function request(method, endpoint, data = null, options = {}) {
        const url = AppConfig.apiUrl(endpoint);

        const fetchOptions = {
            method: method.toUpperCase(),
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin',
            ...options
        };

        // Ajouter CSRF pour les methodes qui modifient les donnees
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(fetchOptions.method)) {
            fetchOptions.headers['X-CSRF-TOKEN'] = AppConfig.getCsrfToken();
        }

        // Gestion des donnees
        if (data !== null) {
            if (data instanceof FormData) {
                // FormData: ne pas definir Content-Type (le navigateur le fait)
                fetchOptions.body = data;
            } else {
                // JSON
                fetchOptions.headers['Content-Type'] = 'application/json';
                fetchOptions.body = JSON.stringify(data);
            }
        }

        AppConfig.debug(`API ${method} ${url}`, data);

        try {
            const response = await fetch(url, fetchOptions);

            // Parser la reponse JSON
            let result;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                result = { success: response.ok, data: await response.text() };
            }

            AppConfig.debug(`API Response:`, result);

            // Gestion des erreurs HTTP
            if (!response.ok) {
                const error = new Error(result.message || `HTTP ${response.status}`);
                error.status = response.status;
                error.response = result;
                throw error;
            }

            return result;
        } catch (error) {
            AppConfig.debug('API Error:', error);

            // Erreur reseau
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                error.message = window.__ ? __('error.network') : 'Network error';
            }

            throw error;
        }
    }

    /**
     * GET request
     */
    function get(endpoint, params = {}) {
        // Ajouter les parametres a l'URL
        if (Object.keys(params).length > 0) {
            const searchParams = new URLSearchParams(params);
            endpoint = `${endpoint}?${searchParams.toString()}`;
        }
        return request('GET', endpoint);
    }

    /**
     * POST request
     */
    function post(endpoint, data = {}) {
        return request('POST', endpoint, data);
    }

    /**
     * PUT request
     */
    function put(endpoint, data = {}) {
        return request('PUT', endpoint, data);
    }

    /**
     * DELETE request
     */
    function del(endpoint, data = {}) {
        return request('DELETE', endpoint, data);
    }

    /**
     * PATCH request
     */
    function patch(endpoint, data = {}) {
        return request('PATCH', endpoint, data);
    }

    /**
     * Upload de fichier
     */
    function upload(endpoint, file, fieldName = 'file', additionalData = {}) {
        const formData = new FormData();
        formData.append(fieldName, file);

        // Ajouter les donnees supplementaires
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, value);
        });

        return request('POST', endpoint, formData);
    }

    // API publique
    return {
        get,
        post,
        put,
        delete: del,
        patch,
        upload,
        request
    };
})();

// Rendre disponible globalement
window.ApiService = ApiService;
