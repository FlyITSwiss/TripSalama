/**
 * TripSalama - Permission Manager
 * Gestion des permissions Android/iOS avec UX optimisée
 *
 * Features:
 * - Demande de permissions progressive (pré-prompt)
 * - Gestion des états denied/blocked
 * - Rationale explicatif avant la demande système
 * - Deep link vers les settings si bloqué
 * - Support Capacitor natif + PWA fallback
 */

'use strict';

const PermissionManager = (function() {
    // Types de permissions
    const PERMISSIONS = {
        LOCATION: 'location',
        LOCATION_BACKGROUND: 'location-background',
        CAMERA: 'camera',
        NOTIFICATIONS: 'notifications',
        MICROPHONE: 'microphone',
    };

    // États des permissions
    const STATES = {
        GRANTED: 'granted',
        DENIED: 'denied',
        PROMPT: 'prompt',
        BLOCKED: 'blocked',      // Refusé définitivement (need settings)
        UNAVAILABLE: 'unavailable',
    };

    // Rationales par type de permission
    const RATIONALES = {
        [PERMISSIONS.LOCATION]: {
            title: 'Localisation requise',
            message: 'TripSalama a besoin de votre position pour vous connecter avec des conductrices à proximité et suivre votre trajet en temps réel.',
            icon: 'location',
            benefits: [
                'Trouver des conductrices proches',
                'Suivre votre trajet en direct',
                'Partager votre position avec vos proches',
            ],
        },
        [PERMISSIONS.LOCATION_BACKGROUND]: {
            title: 'Localisation en arrière-plan',
            message: 'Pour continuer à suivre votre trajet même quand l\'app est en arrière-plan, nous avons besoin de cette permission.',
            icon: 'location-background',
            benefits: [
                'Suivi continu pendant la course',
                'Notifications d\'arrivée',
                'Partage de position fiable',
            ],
        },
        [PERMISSIONS.CAMERA]: {
            title: 'Appareil photo requis',
            message: 'L\'appareil photo est utilisé pour vérifier votre identité et garantir la sécurité de toutes nos utilisatrices.',
            icon: 'camera',
            benefits: [
                'Vérification d\'identité',
                'Photo de profil',
                'Sécurité renforcée',
            ],
        },
        [PERMISSIONS.NOTIFICATIONS]: {
            title: 'Notifications',
            message: 'Recevez des alertes importantes sur vos courses, l\'arrivée de votre conductrice et les messages.',
            icon: 'notifications',
            benefits: [
                'Alertes de course en temps réel',
                'Messages de la conductrice',
                'Offres et promotions',
            ],
        },
    };

    // Cache des états
    let permissionStates = {};
    let isCapacitorNative = false;

    /**
     * Initialiser le manager
     */
    async function init() {
        isCapacitorNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

        // Charger les états sauvegardés
        const saved = localStorage.getItem('tripsalama_permissions');
        if (saved) {
            try {
                permissionStates = JSON.parse(saved);
            } catch (e) {
                permissionStates = {};
            }
        }

        // Vérifier les permissions actuelles
        await refreshAllPermissions();

        AppConfig.debug('PermissionManager: Initialisé', { native: isCapacitorNative });
    }

    /**
     * Rafraîchir toutes les permissions
     */
    async function refreshAllPermissions() {
        const permissions = Object.values(PERMISSIONS);

        for (const permission of permissions) {
            await checkPermission(permission);
        }

        saveStates();
    }

    /**
     * Vérifier l'état d'une permission
     * @param {string} permission Type de permission
     * @returns {Promise<string>} État
     */
    async function checkPermission(permission) {
        let state = STATES.UNAVAILABLE;

        try {
            if (isCapacitorNative) {
                state = await checkCapacitorPermission(permission);
            } else {
                state = await checkWebPermission(permission);
            }
        } catch (error) {
            AppConfig.debug(`PermissionManager: Erreur check ${permission}`, error);
        }

        permissionStates[permission] = state;
        return state;
    }

    /**
     * Vérifier une permission via Capacitor (natif)
     */
    async function checkCapacitorPermission(permission) {
        switch (permission) {
            case PERMISSIONS.LOCATION:
            case PERMISSIONS.LOCATION_BACKGROUND: {
                const { Geolocation } = await import('@capacitor/geolocation');
                const result = await Geolocation.checkPermissions();

                if (permission === PERMISSIONS.LOCATION_BACKGROUND) {
                    return mapCapacitorState(result.coarseLocation); // Android background uses coarse
                }
                return mapCapacitorState(result.location);
            }

            case PERMISSIONS.CAMERA: {
                const { Camera } = await import('@capacitor/camera');
                const result = await Camera.checkPermissions();
                return mapCapacitorState(result.camera);
            }

            case PERMISSIONS.NOTIFICATIONS: {
                const { PushNotifications } = await import('@capacitor/push-notifications');
                const result = await PushNotifications.checkPermissions();
                return mapCapacitorState(result.receive);
            }

            default:
                return STATES.UNAVAILABLE;
        }
    }

    /**
     * Vérifier une permission via Web API
     */
    async function checkWebPermission(permission) {
        if (!('permissions' in navigator)) {
            return STATES.UNAVAILABLE;
        }

        const webPermissionMap = {
            [PERMISSIONS.LOCATION]: 'geolocation',
            [PERMISSIONS.CAMERA]: 'camera',
            [PERMISSIONS.NOTIFICATIONS]: 'notifications',
            [PERMISSIONS.MICROPHONE]: 'microphone',
        };

        const webName = webPermissionMap[permission];
        if (!webName) {
            return STATES.UNAVAILABLE;
        }

        try {
            const result = await navigator.permissions.query({ name: webName });

            // Écouter les changements
            result.addEventListener('change', () => {
                permissionStates[permission] = mapWebState(result.state);
                saveStates();
                EventBus.emit('permission:changed', {
                    permission,
                    state: permissionStates[permission],
                });
            });

            return mapWebState(result.state);
        } catch (error) {
            return STATES.UNAVAILABLE;
        }
    }

    /**
     * Mapper l'état Capacitor
     */
    function mapCapacitorState(state) {
        switch (state) {
            case 'granted': return STATES.GRANTED;
            case 'denied': return STATES.DENIED;
            case 'prompt': return STATES.PROMPT;
            case 'prompt-with-rationale': return STATES.PROMPT;
            default: return STATES.UNAVAILABLE;
        }
    }

    /**
     * Mapper l'état Web API
     */
    function mapWebState(state) {
        switch (state) {
            case 'granted': return STATES.GRANTED;
            case 'denied': return STATES.BLOCKED; // Web denied = need settings
            case 'prompt': return STATES.PROMPT;
            default: return STATES.UNAVAILABLE;
        }
    }

    /**
     * Demander une permission avec UX optimisée
     * @param {string} permission Type de permission
     * @param {boolean} showRationale Afficher l'explication d'abord
     * @returns {Promise<boolean>} true si accordée
     */
    async function requestPermission(permission, showRationale = true) {
        // Vérifier l'état actuel
        const currentState = await checkPermission(permission);

        // Déjà accordée
        if (currentState === STATES.GRANTED) {
            return true;
        }

        // Bloquée → ouvrir settings
        if (currentState === STATES.BLOCKED) {
            const shouldOpenSettings = await showBlockedDialog(permission);
            if (shouldOpenSettings) {
                openAppSettings();
            }
            return false;
        }

        // Afficher le rationale si demandé
        if (showRationale && currentState === STATES.PROMPT) {
            const userAccepted = await showRationaleDialog(permission);
            if (!userAccepted) {
                EventBus.emit('permission:declined', { permission });
                return false;
            }
        }

        // Demander la permission
        let granted = false;

        if (isCapacitorNative) {
            granted = await requestCapacitorPermission(permission);
        } else {
            granted = await requestWebPermission(permission);
        }

        // Mettre à jour l'état
        permissionStates[permission] = granted ? STATES.GRANTED : STATES.DENIED;
        saveStates();

        EventBus.emit('permission:result', {
            permission,
            granted,
        });

        return granted;
    }

    /**
     * Demander via Capacitor
     */
    async function requestCapacitorPermission(permission) {
        try {
            switch (permission) {
                case PERMISSIONS.LOCATION:
                case PERMISSIONS.LOCATION_BACKGROUND: {
                    const { Geolocation } = await import('@capacitor/geolocation');
                    const result = await Geolocation.requestPermissions({
                        permissions: permission === PERMISSIONS.LOCATION_BACKGROUND
                            ? ['coarseLocation', 'location']
                            : ['location'],
                    });
                    return result.location === 'granted';
                }

                case PERMISSIONS.CAMERA: {
                    const { Camera } = await import('@capacitor/camera');
                    const result = await Camera.requestPermissions({
                        permissions: ['camera'],
                    });
                    return result.camera === 'granted';
                }

                case PERMISSIONS.NOTIFICATIONS: {
                    const { PushNotifications } = await import('@capacitor/push-notifications');
                    const result = await PushNotifications.requestPermissions();
                    return result.receive === 'granted';
                }

                default:
                    return false;
            }
        } catch (error) {
            AppConfig.debug(`PermissionManager: Erreur request ${permission}`, error);
            return false;
        }
    }

    /**
     * Demander via Web API
     */
    async function requestWebPermission(permission) {
        try {
            switch (permission) {
                case PERMISSIONS.LOCATION:
                case PERMISSIONS.LOCATION_BACKGROUND: {
                    return new Promise((resolve) => {
                        navigator.geolocation.getCurrentPosition(
                            () => resolve(true),
                            (error) => resolve(error.code !== error.PERMISSION_DENIED),
                            { timeout: 10000 }
                        );
                    });
                }

                case PERMISSIONS.NOTIFICATIONS: {
                    const result = await Notification.requestPermission();
                    return result === 'granted';
                }

                case PERMISSIONS.CAMERA: {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    stream.getTracks().forEach(track => track.stop());
                    return true;
                }

                default:
                    return false;
            }
        } catch (error) {
            AppConfig.debug(`PermissionManager: Erreur request web ${permission}`, error);
            return false;
        }
    }

    /**
     * Afficher le dialogue de rationale
     * @param {string} permission Type de permission
     * @returns {Promise<boolean>} true si l'utilisateur accepte
     */
    async function showRationaleDialog(permission) {
        const rationale = RATIONALES[permission];
        if (!rationale) {
            return true; // Pas de rationale, continuer
        }

        return new Promise((resolve) => {
            // Créer le modal
            const modal = document.createElement('div');
            modal.className = 'permission-rationale-modal';
            modal.innerHTML = `
                <div class="permission-rationale-backdrop"></div>
                <div class="permission-rationale-content">
                    <div class="permission-rationale-icon">
                        <i class="icon-${rationale.icon}"></i>
                    </div>
                    <h2 class="permission-rationale-title">${rationale.title}</h2>
                    <p class="permission-rationale-message">${rationale.message}</p>
                    <ul class="permission-rationale-benefits">
                        ${rationale.benefits.map(b => `<li>${b}</li>`).join('')}
                    </ul>
                    <div class="permission-rationale-actions">
                        <button class="btn-secondary" data-action="cancel">Plus tard</button>
                        <button class="btn-primary" data-action="continue">Continuer</button>
                    </div>
                </div>
            `;

            // Handlers
            modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            modal.querySelector('[data-action="continue"]').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });

            modal.querySelector('.permission-rationale-backdrop').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            document.body.appendChild(modal);

            // Animation d'entrée
            requestAnimationFrame(() => {
                modal.classList.add('visible');
            });
        });
    }

    /**
     * Afficher le dialogue pour permission bloquée
     * @param {string} permission Type de permission
     * @returns {Promise<boolean>} true si l'utilisateur veut ouvrir les settings
     */
    async function showBlockedDialog(permission) {
        const rationale = RATIONALES[permission] || {};

        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'permission-rationale-modal';
            modal.innerHTML = `
                <div class="permission-rationale-backdrop"></div>
                <div class="permission-rationale-content permission-blocked">
                    <div class="permission-rationale-icon blocked">
                        <i class="icon-settings"></i>
                    </div>
                    <h2 class="permission-rationale-title">Permission requise</h2>
                    <p class="permission-rationale-message">
                        La permission "${rationale.title || permission}" a été refusée.
                        Pour utiliser cette fonctionnalité, vous devez l'activer dans les paramètres de l'application.
                    </p>
                    <div class="permission-rationale-actions">
                        <button class="btn-secondary" data-action="cancel">Annuler</button>
                        <button class="btn-primary" data-action="settings">Ouvrir les paramètres</button>
                    </div>
                </div>
            `;

            modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            modal.querySelector('[data-action="settings"]').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });

            modal.querySelector('.permission-rationale-backdrop').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            document.body.appendChild(modal);

            requestAnimationFrame(() => {
                modal.classList.add('visible');
            });
        });
    }

    /**
     * Ouvrir les paramètres de l'application
     */
    async function openAppSettings() {
        if (isCapacitorNative) {
            try {
                // Android: ouvrir les paramètres de l'app
                const { App } = await import('@capacitor/app');
                // Note: Capacitor n'a pas de méthode native pour ça
                // On utilise un intent Android
                if (typeof AndroidSettings !== 'undefined') {
                    AndroidSettings.openAppSettings();
                }
            } catch (error) {
                AppConfig.debug('PermissionManager: Erreur ouverture settings', error);
            }
        }

        // Pour PWA, on ne peut pas ouvrir les settings directement
        // On affiche un message d'aide
        if (!isCapacitorNative) {
            alert('Pour modifier les permissions, allez dans les paramètres de votre navigateur > Paramètres du site > TripSalama');
        }
    }

    /**
     * Obtenir l'état d'une permission
     * @param {string} permission Type de permission
     * @returns {string} État
     */
    function getState(permission) {
        return permissionStates[permission] || STATES.UNAVAILABLE;
    }

    /**
     * Vérifier si une permission est accordée
     * @param {string} permission Type de permission
     * @returns {boolean}
     */
    function isGranted(permission) {
        return permissionStates[permission] === STATES.GRANTED;
    }

    /**
     * Sauvegarder les états
     */
    function saveStates() {
        localStorage.setItem('tripsalama_permissions', JSON.stringify(permissionStates));
    }

    /**
     * Demander toutes les permissions nécessaires pour une course
     * @returns {Promise<Object>} Résultats
     */
    async function requestRidePermissions() {
        const results = {
            location: await requestPermission(PERMISSIONS.LOCATION),
            notifications: await requestPermission(PERMISSIONS.NOTIFICATIONS),
        };

        // Demander la localisation en background si location accordée
        if (results.location) {
            results.locationBackground = await requestPermission(
                PERMISSIONS.LOCATION_BACKGROUND,
                true
            );
        }

        return results;
    }

    // API publique
    return {
        // Lifecycle
        init,
        refreshAllPermissions,

        // Check
        checkPermission,
        getState,
        isGranted,

        // Request
        requestPermission,
        requestRidePermissions,

        // Settings
        openAppSettings,

        // Constants
        PERMISSIONS,
        STATES,
    };
})();

// Exposer globalement
window.PermissionManager = PermissionManager;

// Initialiser automatiquement
document.addEventListener('DOMContentLoaded', () => {
    PermissionManager.init().catch(error => {
        console.warn('PermissionManager: Initialisation échouée', error);
    });
});
