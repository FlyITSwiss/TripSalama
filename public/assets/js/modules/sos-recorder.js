/**
 * TripSalama - SOS Recorder Module
 * Enregistrement vidéo/audio d'urgence avec MediaDevices API
 */

'use strict';

const SOSRecorder = (function() {
    // State
    let mediaRecorder = null;
    let recordedChunks = [];
    let stream = null;
    let isRecording = false;
    let recordingType = 'video'; // 'video' ou 'audio'
    let startTime = null;
    let timerInterval = null;
    let rideId = null;
    let sosAlertId = null;

    // Config
    const config = {
        maxDuration: 300, // 5 minutes max
        videoConstraints: {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        },
        audioConstraints: {
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        },
        mimeTypes: [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4',
            'audio/webm;codecs=opus',
            'audio/webm'
        ]
    };

    // Callbacks
    let onRecordingStart = null;
    let onRecordingStop = null;
    let onRecordingProgress = null;
    let onUploadProgress = null;
    let onUploadComplete = null;
    let onError = null;

    /**
     * Initialiser le recorder
     */
    function init(options = {}) {
        rideId = options.rideId || null;
        onRecordingStart = options.onRecordingStart || null;
        onRecordingStop = options.onRecordingStop || null;
        onRecordingProgress = options.onRecordingProgress || null;
        onUploadProgress = options.onUploadProgress || null;
        onUploadComplete = options.onUploadComplete || null;
        onError = options.onError || null;

        AppConfig.debug('SOSRecorder: Initialized', { rideId });
    }

    /**
     * Vérifier si MediaDevices est supporté
     */
    function isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    /**
     * Vérifier la permission caméra/micro
     */
    async function checkPermissions(type = 'video') {
        if (!isSupported()) {
            return { granted: false, reason: 'not_supported' };
        }

        try {
            const constraints = type === 'video'
                ? config.videoConstraints
                : config.audioConstraints;

            const testStream = await navigator.mediaDevices.getUserMedia(constraints);
            // Arrêter immédiatement les tracks du test
            testStream.getTracks().forEach(track => track.stop());

            return { granted: true };
        } catch (error) {
            let reason = 'unknown';
            if (error.name === 'NotAllowedError') {
                reason = 'permission_denied';
            } else if (error.name === 'NotFoundError') {
                reason = 'no_device';
            } else if (error.name === 'NotReadableError') {
                reason = 'device_in_use';
            }

            return { granted: false, reason, error: error.message };
        }
    }

    /**
     * Obtenir le meilleur type MIME supporté
     */
    function getSupportedMimeType(forVideo = true) {
        const types = forVideo
            ? config.mimeTypes.filter(t => t.startsWith('video'))
            : config.mimeTypes.filter(t => t.startsWith('audio'));

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return forVideo ? 'video/webm' : 'audio/webm';
    }

    /**
     * Démarrer l'enregistrement
     */
    async function startRecording(type = 'video') {
        if (isRecording) {
            console.warn('SOSRecorder: Already recording');
            return false;
        }

        recordingType = type;
        recordedChunks = [];

        try {
            // Demander l'accès au média
            const constraints = type === 'video'
                ? config.videoConstraints
                : config.audioConstraints;

            stream = await navigator.mediaDevices.getUserMedia(constraints);

            // Créer le MediaRecorder
            const mimeType = getSupportedMimeType(type === 'video');
            const options = { mimeType };

            mediaRecorder = new MediaRecorder(stream, options);

            // Event handlers
            mediaRecorder.ondataavailable = handleDataAvailable;
            mediaRecorder.onstop = handleRecordingStop;
            mediaRecorder.onerror = handleRecordingError;

            // Démarrer
            mediaRecorder.start(1000); // Chunks toutes les secondes
            isRecording = true;
            startTime = Date.now();

            // Timer pour la durée
            timerInterval = setInterval(updateTimer, 1000);

            // Auto-stop après durée max
            setTimeout(() => {
                if (isRecording) {
                    console.log('SOSRecorder: Max duration reached, auto-stopping');
                    stopRecording();
                }
            }, config.maxDuration * 1000);

            AppConfig.debug('SOSRecorder: Recording started', { type, mimeType });

            if (onRecordingStart) {
                onRecordingStart({ type, mimeType });
            }

            return true;

        } catch (error) {
            console.error('SOSRecorder: Start error', error);
            cleanup();

            if (onError) {
                onError({ action: 'start', error: error.message, name: error.name });
            }

            return false;
        }
    }

    /**
     * Arrêter l'enregistrement
     */
    function stopRecording() {
        if (!isRecording || !mediaRecorder) {
            return false;
        }

        try {
            mediaRecorder.stop();
            isRecording = false;

            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            AppConfig.debug('SOSRecorder: Recording stopped');
            return true;

        } catch (error) {
            console.error('SOSRecorder: Stop error', error);
            cleanup();
            return false;
        }
    }

    /**
     * Gérer les données disponibles
     */
    function handleDataAvailable(event) {
        if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    }

    /**
     * Gérer la fin de l'enregistrement
     */
    function handleRecordingStop() {
        // Arrêter le stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        // Créer le blob
        const mimeType = getSupportedMimeType(recordingType === 'video');
        const blob = new Blob(recordedChunks, { type: mimeType });
        const duration = Math.round((Date.now() - startTime) / 1000);

        AppConfig.debug('SOSRecorder: Recording complete', {
            size: blob.size,
            duration,
            type: mimeType
        });

        if (onRecordingStop) {
            onRecordingStop({ blob, duration, mimeType });
        }

        // Upload automatique
        uploadRecording(blob, duration, mimeType);
    }

    /**
     * Gérer les erreurs d'enregistrement
     */
    function handleRecordingError(event) {
        console.error('SOSRecorder: Recording error', event.error);
        cleanup();

        if (onError) {
            onError({ action: 'recording', error: event.error?.message || 'Unknown error' });
        }
    }

    /**
     * Mettre à jour le timer
     */
    function updateTimer() {
        if (!startTime) return;

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const remaining = config.maxDuration - elapsed;

        if (onRecordingProgress) {
            onRecordingProgress({ elapsed, remaining, maxDuration: config.maxDuration });
        }
    }

    /**
     * Uploader l'enregistrement
     */
    async function uploadRecording(blob, duration, mimeType) {
        if (!blob || blob.size === 0) {
            console.warn('SOSRecorder: No data to upload');
            return;
        }

        try {
            const formData = new FormData();

            // Extension basée sur le type MIME
            const ext = mimeType.startsWith('video') ? 'webm' : 'webm';
            const filename = `sos_${Date.now()}.${ext}`;

            formData.append('recording', blob, filename);
            formData.append('recording_type', recordingType);
            formData.append('duration_seconds', String(duration));
            formData.append('mime_type', mimeType);

            if (rideId) {
                formData.append('ride_id', String(rideId));
            }
            if (sosAlertId) {
                formData.append('sos_alert_id', String(sosAlertId));
            }

            AppConfig.debug('SOSRecorder: Uploading', { filename, size: blob.size });

            const xhr = new XMLHttpRequest();

            // Progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onUploadProgress) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onUploadProgress({ loaded: e.loaded, total: e.total, percent });
                }
            });

            // Complete
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        AppConfig.debug('SOSRecorder: Upload complete', response);

                        if (onUploadComplete) {
                            onUploadComplete({ success: true, data: response });
                        }
                    } catch (e) {
                        if (onUploadComplete) {
                            onUploadComplete({ success: true, data: null });
                        }
                    }
                } else {
                    if (onError) {
                        onError({ action: 'upload', error: `HTTP ${xhr.status}` });
                    }
                }
            });

            // Error
            xhr.addEventListener('error', () => {
                if (onError) {
                    onError({ action: 'upload', error: 'Network error' });
                }
            });

            // Send
            xhr.open('POST', AppConfig.apiUrl('sos?action=upload-recording'));
            xhr.setRequestHeader('X-CSRF-Token', AppConfig.csrfToken);
            xhr.send(formData);

        } catch (error) {
            console.error('SOSRecorder: Upload error', error);
            if (onError) {
                onError({ action: 'upload', error: error.message });
            }
        }
    }

    /**
     * Nettoyer les ressources
     */
    function cleanup() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        mediaRecorder = null;
        recordedChunks = [];
        isRecording = false;
        startTime = null;
    }

    /**
     * Définir l'ID de l'alerte SOS
     */
    function setSOSAlertId(id) {
        sosAlertId = id;
    }

    /**
     * Définir l'ID de la course
     */
    function setRideId(id) {
        rideId = id;
    }

    /**
     * Obtenir l'état actuel
     */
    function getState() {
        return {
            isRecording,
            recordingType,
            duration: startTime ? Math.round((Date.now() - startTime) / 1000) : 0,
            hasData: recordedChunks.length > 0
        };
    }

    /**
     * Obtenir le stream actif (pour affichage preview)
     */
    function getStream() {
        return stream;
    }

    // API publique
    return {
        init,
        isSupported,
        checkPermissions,
        startRecording,
        stopRecording,
        setSOSAlertId,
        setRideId,
        getState,
        getStream,
        cleanup
    };
})();

// Rendre disponible globalement
window.SOSRecorder = SOSRecorder;
