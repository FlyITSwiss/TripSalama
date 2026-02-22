/**
 * TripSalama - Offline Sync Service
 * Synchronisation des données hors-ligne avec IndexedDB
 */

'use strict';

const OfflineSync = (function() {
    // Configuration
    const DB_NAME = 'tripsalama-offline';
    const DB_VERSION = 1;
    const STORES = {
        POSITIONS: 'positions',
        RIDES: 'rides',
        MESSAGES: 'messages',
        SYNC_QUEUE: 'syncQueue',
    };

    // État
    let db = null;
    let isOnline = navigator.onLine;
    let syncInProgress = false;

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
     */
    async function addToSyncQueue(type, data) {
        if (!db) return;

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
            const store = tx.objectStore(STORES.SYNC_QUEUE);
            const request = store.add({
                type,
                data,
                createdAt: Date.now(),
                attempts: 0,
            });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
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
                const items = request.result;

                for (const item of items) {
                    try {
                        await processQueueItem(item);

                        // Supprimer de la file
                        const deleteTx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
                        const deleteStore = deleteTx.objectStore(STORES.SYNC_QUEUE);
                        deleteStore.delete(item.id);

                    } catch (error) {
                        AppConfig.debug('OfflineSync: Erreur item queue', error);

                        // Incrémenter les tentatives
                        item.attempts++;

                        if (item.attempts < 3) {
                            const updateTx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
                            const updateStore = updateTx.objectStore(STORES.SYNC_QUEUE);
                            updateStore.put(item);
                        } else {
                            // Supprimer après 3 tentatives
                            const deleteTx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
                            const deleteStore = deleteTx.objectStore(STORES.SYNC_QUEUE);
                            deleteStore.delete(item.id);
                        }
                    }
                }

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

    // API publique
    return {
        init,
        savePosition,
        saveRide,
        getRide,
        addToSyncQueue,
        syncPendingData,
        cleanup,
        isOnline: isNetworkOnline,
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
