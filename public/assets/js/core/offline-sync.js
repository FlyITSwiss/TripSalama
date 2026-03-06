/**
 * TripSalama - Offline Sync Service
 * Synchronisation des données hors-ligne avec IndexedDB
 *
 * Améliorations v2.0:
 * - Exponential backoff avec jitter pour les retries
 * - Gestion de priorité dans la queue de sync
 * - Limite de taille de queue avec purge automatique
 * - Retry intelligent basé sur le type d'erreur
 */

'use strict';

const OfflineSync = (function() {
    // Configuration
    const DB_NAME = 'tripsalama-offline';
    const DB_VERSION = 2; // Nouvelle version pour migration
    const STORES = {
        POSITIONS: 'positions',
        RIDES: 'rides',
        MESSAGES: 'messages',
        SYNC_QUEUE: 'syncQueue',
    };

    // Configuration des limites et retry
    const SYNC_CONFIG = {
        maxQueueSize: 500,               // Max items dans la queue
        maxPositions: 1000,              // Max positions stockées
        maxRetries: 5,                   // Max tentatives par item
        baseRetryDelay: 1000,            // Délai de base (1s)
        maxRetryDelay: 60000,            // Délai max (60s)
        batchSize: 50,                   // Taille des batches
        syncDebounceMs: 2000,            // Debounce entre syncs
        priorities: {
            CRITICAL: 1,                 // Status de course (start, end, SOS)
            HIGH: 2,                     // Messages
            NORMAL: 3,                   // Positions
            LOW: 4,                      // Analytics
        },
    };

    // État
    let db = null;
    let isOnline = navigator.onLine;
    let syncInProgress = false;
    let syncDebounceTimer = null;
    let retryTimers = new Map();         // itemId → timerId

    /**
     * Initialiser IndexedDB
     * @returns {Promise<IDBDatabase>}
     */
    async function init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                AppConfig.debug('OfflineSync: Erreur ouverture DB', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                db = request.result;
                AppConfig.debug('OfflineSync: DB ouverte');

                // Écouter les changements de connexion
                window.addEventListener('online', handleOnline);
                window.addEventListener('offline', handleOffline);

                // Synchroniser si en ligne
                if (navigator.onLine) {
                    syncPendingData();
                }

                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                // Store positions GPS
                if (!database.objectStoreNames.contains(STORES.POSITIONS)) {
                    const positionStore = database.createObjectStore(STORES.POSITIONS, {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    positionStore.createIndex('rideId', 'rideId', { unique: false });
                    positionStore.createIndex('timestamp', 'timestamp', { unique: false });
                    positionStore.createIndex('synced', 'synced', { unique: false });
                }

                // Store courses
                if (!database.objectStoreNames.contains(STORES.RIDES)) {
                    const rideStore = database.createObjectStore(STORES.RIDES, {
                        keyPath: 'id',
                    });
                    rideStore.createIndex('status', 'status', { unique: false });
                    rideStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                // Store messages
                if (!database.objectStoreNames.contains(STORES.MESSAGES)) {
                    const messageStore = database.createObjectStore(STORES.MESSAGES, {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    messageStore.createIndex('rideId', 'rideId', { unique: false });
                    messageStore.createIndex('synced', 'synced', { unique: false });
                }

                // Store file d'attente de sync
                if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
                    const syncStore = database.createObjectStore(STORES.SYNC_QUEUE, {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    syncStore.createIndex('type', 'type', { unique: false });
                    syncStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                AppConfig.debug('OfflineSync: Stores créés');
            };
        });
    }

    /**
     * Sauvegarder une position GPS localement
     * @param {number} rideId ID de la course
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     * @param {number} heading Direction
     * @param {number} speed Vitesse
     */
    async function savePosition(rideId, lat, lng, heading = null, speed = null) {
        if (!db) return;

        const data = {
            rideId,
            lat,
            lng,
            heading,
            speed,
            timestamp: Date.now(),
            synced: false,
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.POSITIONS, 'readwrite');
            const store = tx.objectStore(STORES.POSITIONS);
            const request = store.add(data);

            request.onsuccess = () => {
                // Si en ligne, synchroniser immédiatement
                if (isOnline) {
                    syncPosition(request.result);
                }
                resolve(request.result);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Sauvegarder une course localement
     * @param {Object} ride Données de la course
     */
    async function saveRide(ride) {
        if (!db) return;

        ride.updatedAt = Date.now();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.RIDES, 'readwrite');
            const store = tx.objectStore(STORES.RIDES);
            const request = store.put(ride);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Récupérer une course locale
     * @param {number} rideId ID de la course
     */
    async function getRide(rideId) {
        if (!db) return null;

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.RIDES, 'readonly');
            const store = tx.objectStore(STORES.RIDES);
            const request = store.get(rideId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Ajouter un élément à la file de sync
     * @param {string} type Type d'action
     * @param {Object} data Données
     * @param {number} priority Priorité (1=critical, 4=low)
     */
    async function addToSyncQueue(type, data, priority = SYNC_CONFIG.priorities.NORMAL) {
        if (!db) return;

        // Vérifier la taille de la queue avant d'ajouter
        await enforceQueueLimit();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
            const store = tx.objectStore(STORES.SYNC_QUEUE);
            const request = store.add({
                type,
                data,
                priority,
                createdAt: Date.now(),
                attempts: 0,
                lastAttemptAt: null,
                lastError: null,
            });

            request.onsuccess = () => {
                AppConfig.debug(`OfflineSync: Ajouté à la queue (${type}, priorité ${priority})`);

                // Déclencher une sync si en ligne
                if (isOnline) {
                    debouncedSync();
                }

                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Sync avec debounce pour éviter les appels trop fréquents
     */
    function debouncedSync() {
        if (syncDebounceTimer) {
            clearTimeout(syncDebounceTimer);
        }

        syncDebounceTimer = setTimeout(() => {
            syncPendingData();
        }, SYNC_CONFIG.syncDebounceMs);
    }

    /**
     * Calculer le délai de retry avec exponential backoff + jitter
     * @param {number} attempt Numéro de tentative (1-based)
     * @returns {number} Délai en ms
     */
    function calculateRetryDelay(attempt) {
        // Exponential backoff: baseDelay * 2^(attempt-1)
        const exponentialDelay = SYNC_CONFIG.baseRetryDelay * Math.pow(2, attempt - 1);

        // Cap au max
        const cappedDelay = Math.min(exponentialDelay, SYNC_CONFIG.maxRetryDelay);

        // Ajouter du jitter (±25%) pour éviter les "thundering herd"
        const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);

        return Math.round(cappedDelay + jitter);
    }

    /**
     * Vérifier si une erreur est récupérable
     * @param {Error} error Erreur
     * @returns {boolean} true si retry possible
     */
    function isRetryableError(error) {
        // Erreurs réseau → retry
        if (error.message && (
            error.message.includes('network') ||
            error.message.includes('fetch') ||
            error.message.includes('timeout') ||
            error.message.includes('ECONNREFUSED')
        )) {
            return true;
        }

        // Erreurs HTTP récupérables
        if (error.status) {
            // 408 Request Timeout, 429 Too Many Requests, 5xx Server Errors
            return error.status === 408 || error.status === 429 || error.status >= 500;
        }

        // Par défaut, considérer comme récupérable
        return true;
    }

    /**
     * Appliquer la limite de taille de la queue
     */
    async function enforceQueueLimit() {
        if (!db) return;

        return new Promise((resolve) => {
            const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
            const store = tx.objectStore(STORES.SYNC_QUEUE);
            const countRequest = store.count();

            countRequest.onsuccess = () => {
                const count = countRequest.result;

                if (count >= SYNC_CONFIG.maxQueueSize) {
                    // Supprimer les plus anciens items de basse priorité
                    const index = store.index('createdAt');
                    let deleted = 0;
                    const toDelete = count - SYNC_CONFIG.maxQueueSize + 50; // Marge de 50

                    index.openCursor().onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor && deleted < toDelete) {
                            // Ne pas supprimer les items critiques
                            if (cursor.value.priority > SYNC_CONFIG.priorities.CRITICAL) {
                                cursor.delete();
                                deleted++;
                            }
                            cursor.continue();
                        } else {
                            AppConfig.debug(`OfflineSync: ${deleted} anciens items supprimés de la queue`);
                            resolve();
                        }
                    };
                } else {
                    resolve();
                }
            };

            countRequest.onerror = () => resolve();
        });
    }

    /**
     * Synchroniser les données en attente
     */
    async function syncPendingData() {
        if (!db || syncInProgress || !isOnline) return;

        syncInProgress = true;
        AppConfig.debug('OfflineSync: Début synchronisation');

        try {
            // 1. Synchroniser les positions non synchronisées
            await syncPositions();

            // 2. Traiter la file d'attente
            await processSyncQueue();

            AppConfig.debug('OfflineSync: Synchronisation terminée');
            EventBus.emit('offline:synced');

        } catch (error) {
            AppConfig.debug('OfflineSync: Erreur sync', error);
            EventBus.emit('offline:syncError', error);

        } finally {
            syncInProgress = false;
        }
    }

    /**
     * Synchroniser les positions non envoyées
     */
    async function syncPositions() {
        const tx = db.transaction(STORES.POSITIONS, 'readonly');
        const store = tx.objectStore(STORES.POSITIONS);
        const index = store.index('synced');
        const request = index.getAll(IDBKeyRange.only(false));

        return new Promise((resolve, reject) => {
            request.onsuccess = async () => {
                const positions = request.result;

                if (positions.length === 0) {
                    resolve();
                    return;
                }

                AppConfig.debug(`OfflineSync: ${positions.length} positions à synchroniser`);

                // Envoyer par batch de 50
                const batches = [];
                for (let i = 0; i < positions.length; i += 50) {
                    batches.push(positions.slice(i, i + 50));
                }

                for (const batch of batches) {
                    try {
                        await ApiService.post('rides', {
                            action: 'batch-positions',
                            positions: batch.map(p => ({
                                ride_id: p.rideId,
                                lat: p.lat,
                                lng: p.lng,
                                heading: p.heading,
                                speed: p.speed,
                                timestamp: p.timestamp,
                            })),
                        });

                        // Marquer comme synchronisées
                        const updateTx = db.transaction(STORES.POSITIONS, 'readwrite');
                        const updateStore = updateTx.objectStore(STORES.POSITIONS);

                        for (const pos of batch) {
                            pos.synced = true;
                            updateStore.put(pos);
                        }

                    } catch (error) {
                        AppConfig.debug('OfflineSync: Erreur batch positions', error);
                    }
                }

                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Traiter la file d'attente de sync
     */
    async function processSyncQueue() {
        const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
        const store = tx.objectStore(STORES.SYNC_QUEUE);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = async () => {
                let items = request.result;

                if (items.length === 0) {
                    resolve();
                    return;
                }

                // Trier par priorité (1=critical first) puis par date
                items.sort((a, b) => {
                    if (a.priority !== b.priority) {
                        return (a.priority || 3) - (b.priority || 3);
                    }
                    return a.createdAt - b.createdAt;
                });

                AppConfig.debug(`OfflineSync: ${items.length} items à synchroniser`);

                let successCount = 0;
                let failCount = 0;

                for (const item of items) {
                    // Vérifier si on doit attendre (backoff)
                    if (item.lastAttemptAt && item.attempts > 0) {
                        const delay = calculateRetryDelay(item.attempts);
                        const timeSinceLastAttempt = Date.now() - item.lastAttemptAt;

                        if (timeSinceLastAttempt < delay) {
                            // Pas encore le moment de retry
                            continue;
                        }
                    }

                    try {
                        await processQueueItem(item);

                        // Succès → supprimer de la file
                        const deleteTx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
                        const deleteStore = deleteTx.objectStore(STORES.SYNC_QUEUE);
                        deleteStore.delete(item.id);

                        // Annuler le timer de retry si existant
                        if (retryTimers.has(item.id)) {
                            clearTimeout(retryTimers.get(item.id));
                            retryTimers.delete(item.id);
                        }

                        successCount++;

                    } catch (error) {
                        AppConfig.debug(`OfflineSync: Erreur item ${item.id}`, error);
                        failCount++;

                        // Mettre à jour l'item avec les infos d'erreur
                        item.attempts++;
                        item.lastAttemptAt = Date.now();
                        item.lastError = error.message || 'Unknown error';

                        if (item.attempts < SYNC_CONFIG.maxRetries && isRetryableError(error)) {
                            // Planifier un retry
                            const updateTx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
                            const updateStore = updateTx.objectStore(STORES.SYNC_QUEUE);
                            updateStore.put(item);

                            // Programmer un retry avec backoff
                            const retryDelay = calculateRetryDelay(item.attempts);
                            AppConfig.debug(`OfflineSync: Retry item ${item.id} dans ${Math.round(retryDelay/1000)}s`);

                            const timerId = setTimeout(() => {
                                retryTimers.delete(item.id);
                                if (isOnline) {
                                    debouncedSync();
                                }
                            }, retryDelay);

                            retryTimers.set(item.id, timerId);

                        } else {
                            // Trop de tentatives ou erreur non récupérable → supprimer
                            AppConfig.debug(`OfflineSync: Item ${item.id} abandonné après ${item.attempts} tentatives`);

                            const deleteTx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
                            const deleteStore = deleteTx.objectStore(STORES.SYNC_QUEUE);
                            deleteStore.delete(item.id);

                            // Émettre un événement pour logging/analytics
                            EventBus.emit('offline:itemFailed', {
                                id: item.id,
                                type: item.type,
                                attempts: item.attempts,
                                error: item.lastError,
                            });
                        }
                    }
                }

                AppConfig.debug(`OfflineSync: Queue traitée - ${successCount} succès, ${failCount} échecs`);
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Traiter un élément de la file
     * @param {Object} item Élément à traiter
     */
    async function processQueueItem(item) {
        switch (item.type) {
            case 'position':
                await ApiService.post('rides', {
                    action: 'position',
                    ...item.data,
                });
                break;

            case 'message':
                await ApiService.post('chat', {
                    action: 'send',
                    ...item.data,
                });
                break;

            case 'status':
                await ApiService.put('rides', {
                    action: item.data.action,
                    ride_id: item.data.rideId,
                });
                break;

            default:
                AppConfig.debug('OfflineSync: Type inconnu', item.type);
        }
    }

    /**
     * Synchroniser une position unique
     * @param {number} positionId ID local de la position
     */
    async function syncPosition(positionId) {
        const tx = db.transaction(STORES.POSITIONS, 'readwrite');
        const store = tx.objectStore(STORES.POSITIONS);
        const request = store.get(positionId);

        request.onsuccess = async () => {
            const position = request.result;
            if (!position) return;

            try {
                await ApiService.post('rides', {
                    action: 'position',
                    ride_id: position.rideId,
                    lat: position.lat,
                    lng: position.lng,
                    heading: position.heading,
                    speed: position.speed,
                });

                position.synced = true;
                store.put(position);

            } catch (error) {
                AppConfig.debug('OfflineSync: Erreur sync position', error);
            }
        };
    }

    /**
     * Nettoyer les anciennes données
     * @param {number} maxAge Âge max en millisecondes (défaut: 24h)
     */
    async function cleanup(maxAge = 24 * 60 * 60 * 1000) {
        if (!db) return;

        const cutoff = Date.now() - maxAge;

        // Nettoyer les positions synchronisées
        const tx = db.transaction(STORES.POSITIONS, 'readwrite');
        const store = tx.objectStore(STORES.POSITIONS);
        const index = store.index('timestamp');
        const range = IDBKeyRange.upperBound(cutoff);

        index.openCursor(range).onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if (cursor.value.synced) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
    }

    /**
     * Gérer le passage en ligne
     */
    function handleOnline() {
        isOnline = true;
        AppConfig.debug('OfflineSync: Connexion rétablie');
        EventBus.emit('offline:online');

        // Synchroniser les données en attente
        setTimeout(syncPendingData, 1000);
    }

    /**
     * Gérer le passage hors ligne
     */
    function handleOffline() {
        isOnline = false;
        AppConfig.debug('OfflineSync: Connexion perdue');
        EventBus.emit('offline:offline');
    }

    /**
     * Vérifier si on est en ligne
     * @returns {boolean}
     */
    function isNetworkOnline() {
        return isOnline;
    }

    /**
     * Obtenir les statistiques de la queue
     * @returns {Promise<Object>} Stats
     */
    async function getQueueStats() {
        if (!db) return { pending: 0, byPriority: {}, byType: {} };

        return new Promise((resolve) => {
            const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
            const store = tx.objectStore(STORES.SYNC_QUEUE);
            const request = store.getAll();

            request.onsuccess = () => {
                const items = request.result;
                const stats = {
                    pending: items.length,
                    byPriority: {},
                    byType: {},
                    oldestItem: null,
                    totalRetries: 0,
                };

                for (const item of items) {
                    // Par priorité
                    const priority = item.priority || 3;
                    stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

                    // Par type
                    stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;

                    // Plus ancien
                    if (!stats.oldestItem || item.createdAt < stats.oldestItem.createdAt) {
                        stats.oldestItem = {
                            id: item.id,
                            type: item.type,
                            createdAt: item.createdAt,
                            age: Date.now() - item.createdAt,
                        };
                    }

                    // Total retries
                    stats.totalRetries += item.attempts || 0;
                }

                resolve(stats);
            };

            request.onerror = () => resolve({ pending: 0, byPriority: {}, byType: {} });
        });
    }

    /**
     * Forcer une synchronisation immédiate
     */
    function forceSync() {
        if (syncDebounceTimer) {
            clearTimeout(syncDebounceTimer);
            syncDebounceTimer = null;
        }
        return syncPendingData();
    }

    /**
     * Annuler tous les timers de retry
     */
    function cancelAllRetries() {
        for (const timerId of retryTimers.values()) {
            clearTimeout(timerId);
        }
        retryTimers.clear();
    }

    // API publique
    return {
        // Lifecycle
        init,
        cleanup,

        // Data storage
        savePosition,
        saveRide,
        getRide,

        // Queue
        addToSyncQueue,
        syncPendingData,
        forceSync,
        getQueueStats,
        cancelAllRetries,

        // Status
        isOnline: isNetworkOnline,

        // Constantes
        PRIORITIES: SYNC_CONFIG.priorities,
    };
})();

// Exposer globalement
window.OfflineSync = OfflineSync;

// Initialiser automatiquement
document.addEventListener('DOMContentLoaded', () => {
    OfflineSync.init().catch(error => {
        console.warn('OfflineSync: Initialisation échouée', error);
    });
});
