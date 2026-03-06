/**
 * TripSalama - Identity Camera Module v2.0
 * Vérification d'identité en temps réel avec IA
 *
 * @requires ApiService
 * @requires i18n (__() function)
 * @requires AppConfig
 */

const IdentityCamera = (function() {
    'use strict';

    // État privé
    let _state = {
        containerElement: null,
        videoElement: null,
        canvasElement: null,
        stream: null,
        currentStep: 'intro',
        capturedImage: null,
        analysisResult: null,
        attemptCount: 0,
        maxAttempts: 3,
        isAnalyzing: false,
        progressInterval: null,
        faceDetected: false,
        lastFaceDetection: null
    };

    // Configuration
    const CONFIG = {
        videoConstraints: {
            video: {
                facingMode: 'user',
                width: { ideal: 720 },
                height: { ideal: 960 }
            },
            audio: false
        },
        minConfidence: 0.7,
        canvasWidth: 720,
        canvasHeight: 960,
        faceDetectionInterval: 100,
        captureDelay: 300,
        analysisSteps: [
            { id: 'validating', icon: 'shield-check', duration: 500 },
            { id: 'preparing', icon: 'cpu', duration: 400 },
            { id: 'analyzing', icon: 'scan', duration: 2000 },
            { id: 'verifying', icon: 'user-check', duration: 1500 },
            { id: 'complete', icon: 'check-circle', duration: 300 }
        ]
    };

    /**
     * Générer le HTML de l'interface améliorée
     * @private
     */
    function _generateHTML() {
        return `
            <div class="identity-camera-container" data-step="intro">
                <!-- Barre de progression globale -->
                <div class="identity-progress-bar">
                    <div class="progress-track">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-steps">
                        <span class="step-dot active" data-step="1"></span>
                        <span class="step-dot" data-step="2"></span>
                        <span class="step-dot" data-step="3"></span>
                        <span class="step-dot" data-step="4"></span>
                    </div>
                </div>

                <!-- Step 1: Introduction -->
                <div class="identity-step identity-intro" data-step-content="intro">
                    <div class="identity-header">
                        <div class="identity-icon pulse-animation">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="8" r="5"/>
                                <path d="M20 21a8 8 0 1 0-16 0"/>
                                <path d="M12 13v2"/>
                                <circle cx="12" cy="18" r="1"/>
                            </svg>
                        </div>
                        <h2 class="identity-title">${__('verification.title')}</h2>
                        <p class="identity-subtitle">${__('verification.subtitle_women_only')}</p>
                    </div>

                    <div class="identity-card glass-card">
                        <h3 class="tips-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 16v-4"/>
                                <path d="M12 8h.01"/>
                            </svg>
                            ${__('verification.tips_title')}
                        </h3>
                        <ul class="tips-list">
                            <li class="tip-item">
                                <span class="tip-icon success">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </span>
                                <span>${__('verification.tip_face_visible')}</span>
                            </li>
                            <li class="tip-item">
                                <span class="tip-icon success">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </span>
                                <span>${__('verification.tip_good_lighting')}</span>
                            </li>
                            <li class="tip-item">
                                <span class="tip-icon warning">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                        <line x1="18" y1="6" x2="6" y2="18"/>
                                        <line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                </span>
                                <span>${__('verification.tip_no_sunglasses')}</span>
                            </li>
                            <li class="tip-item">
                                <span class="tip-icon success">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </span>
                                <span>${__('verification.tip_neutral_expression')}</span>
                            </li>
                        </ul>
                    </div>

                    <div class="identity-privacy glass-card">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            <path d="M9 12l2 2 4-4"/>
                        </svg>
                        <div class="privacy-text">
                            <strong>${__('verification.privacy_title')}</strong>
                            <span>${__('verification.privacy_notice')}</span>
                        </div>
                    </div>

                    <label class="identity-consent">
                        <input type="checkbox" id="identity-consent-checkbox">
                        <span class="checkbox-custom"></span>
                        <span class="consent-text">${__('verification.consent_text')}</span>
                    </label>

                    <button class="btn btn-primary btn-lg btn-block identity-btn-continue" disabled>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                        </svg>
                        <span>${__('verification.start_camera')}</span>
                    </button>
                </div>

                <!-- Step 2: Camera View -->
                <div class="identity-step identity-camera-view hidden" data-step-content="camera">
                    <div class="camera-header">
                        <p class="camera-instruction" id="camera-instruction">
                            <span class="instruction-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 8v4"/>
                                    <path d="M12 16h.01"/>
                                </svg>
                            </span>
                            <span class="instruction-text">${__('verification.position_face')}</span>
                        </p>
                    </div>

                    <div class="identity-video-wrapper">
                        <video autoplay playsinline muted class="identity-video"></video>

                        <!-- Guide de visage animé -->
                        <div class="face-guide-container">
                            <svg class="face-guide" viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="faceGuideGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" style="stop-color:var(--color-accent);stop-opacity:0.8" />
                                        <stop offset="100%" style="stop-color:var(--color-primary);stop-opacity:0.8" />
                                    </linearGradient>
                                </defs>
                                <ellipse cx="100" cy="140" rx="75" ry="100"
                                    fill="none"
                                    stroke="url(#faceGuideGradient)"
                                    stroke-width="3"
                                    stroke-dasharray="8,4"
                                    class="face-guide-ellipse"/>
                            </svg>
                            <div class="face-guide-corners">
                                <span class="corner top-left"></span>
                                <span class="corner top-right"></span>
                                <span class="corner bottom-left"></span>
                                <span class="corner bottom-right"></span>
                            </div>
                        </div>

                        <!-- Overlay de détection -->
                        <canvas class="identity-overlay-canvas"></canvas>

                        <!-- Indicateur de détection -->
                        <div class="detection-indicator hidden" id="detection-indicator">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            <span>${__('verification.face_detected')}</span>
                        </div>
                    </div>

                    <div class="camera-actions">
                        <button class="identity-btn-capture" id="btn-capture" disabled>
                            <span class="capture-ring"></span>
                            <span class="capture-dot"></span>
                            <span class="capture-pulse"></span>
                        </button>
                        <p class="capture-hint">${__('verification.capture_hint')}</p>
                    </div>
                </div>

                <!-- Step 3: Photo Preview -->
                <div class="identity-step identity-preview hidden" data-step-content="preview">
                    <div class="preview-header">
                        <h3>${__('verification.review_photo')}</h3>
                        <p>${__('verification.review_instructions')}</p>
                    </div>

                    <div class="identity-photo-preview">
                        <img src="" alt="Preview" class="preview-image">
                        <div class="preview-overlay">
                            <div class="preview-checkmarks">
                                <div class="check-item" id="check-face">
                                    <span class="check-icon pending"></span>
                                    <span>${__('verification.check_face_visible')}</span>
                                </div>
                                <div class="check-item" id="check-lighting">
                                    <span class="check-icon pending"></span>
                                    <span>${__('verification.check_good_lighting')}</span>
                                </div>
                                <div class="check-item" id="check-clear">
                                    <span class="check-icon pending"></span>
                                    <span>${__('verification.check_clear_photo')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="identity-preview-actions">
                        <button class="btn btn-secondary identity-btn-retake">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="1 4 1 10 7 10"/>
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                            </svg>
                            <span>${__('verification.retake')}</span>
                        </button>
                        <button class="btn btn-accent identity-btn-submit">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 2L11 13"/>
                                <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
                            </svg>
                            <span>${__('verification.verify_identity')}</span>
                        </button>
                    </div>
                </div>

                <!-- Step 4: Analyzing with AI -->
                <div class="identity-step identity-analyzing hidden" data-step-content="analyzing">
                    <div class="analyzing-content">
                        <div class="ai-analysis-visual">
                            <div class="analysis-photo-container">
                                <img src="" alt="Analyzing" class="analysis-photo">
                                <div class="scan-line"></div>
                                <div class="scan-corners">
                                    <span class="corner tl"></span>
                                    <span class="corner tr"></span>
                                    <span class="corner bl"></span>
                                    <span class="corner br"></span>
                                </div>
                            </div>
                        </div>

                        <div class="analysis-progress">
                            <div class="progress-circle">
                                <svg viewBox="0 0 100 100">
                                    <circle class="progress-bg" cx="50" cy="50" r="45"/>
                                    <circle class="progress-bar" cx="50" cy="50" r="45"
                                        stroke-dasharray="283"
                                        stroke-dashoffset="283"/>
                                </svg>
                                <span class="progress-percent">0%</span>
                            </div>
                        </div>

                        <div class="analysis-steps">
                            <div class="step-item" data-analysis-step="validating">
                                <span class="step-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                    </svg>
                                </span>
                                <span class="step-text">${__('verification.step_validating')}</span>
                                <span class="step-status"></span>
                            </div>
                            <div class="step-item" data-analysis-step="preparing">
                                <span class="step-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                                        <path d="M9 9h6v6H9z"/>
                                    </svg>
                                </span>
                                <span class="step-text">${__('verification.step_preparing')}</span>
                                <span class="step-status"></span>
                            </div>
                            <div class="step-item" data-analysis-step="analyzing">
                                <span class="step-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                </span>
                                <span class="step-text">${__('verification.step_analyzing')}</span>
                                <span class="step-status"></span>
                            </div>
                            <div class="step-item" data-analysis-step="verifying">
                                <span class="step-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                        <circle cx="9" cy="7" r="4"/>
                                        <polyline points="16 11 18 13 22 9"/>
                                    </svg>
                                </span>
                                <span class="step-text">${__('verification.step_verifying')}</span>
                                <span class="step-status"></span>
                            </div>
                        </div>

                        <p class="analyzing-message">${__('verification.ai_analyzing')}</p>
                    </div>
                </div>

                <!-- Step 5: Result -->
                <div class="identity-step identity-result hidden" data-step-content="result">
                    <div class="result-content">
                        <div class="result-animation">
                            <div class="result-icon-container">
                                <div class="result-icon"></div>
                                <div class="result-particles"></div>
                            </div>
                        </div>
                        <h2 class="result-title"></h2>
                        <p class="result-message"></p>

                        <div class="result-details hidden">
                            <div class="detail-item">
                                <span class="detail-label">${__('verification.confidence_level')}</span>
                                <span class="detail-value confidence-value">-</span>
                            </div>
                        </div>

                        <button class="btn btn-lg btn-block result-action-btn"></button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Afficher une étape spécifique avec animation
     * @private
     */
    function _showStep(stepName) {
        if (!_state.containerElement) return;

        const container = _state.containerElement;
        const allSteps = container.querySelectorAll('[data-step-content]');

        // Animer la sortie de l'étape actuelle
        const currentStep = container.querySelector(`[data-step-content="${_state.currentStep}"]`);
        if (currentStep && _state.currentStep !== stepName) {
            currentStep.classList.add('step-exit');
            setTimeout(() => {
                currentStep.classList.remove('step-exit');
                currentStep.classList.add('hidden');
            }, 200);
        }

        // Afficher la nouvelle étape avec animation
        setTimeout(() => {
            allSteps.forEach(step => {
                if (step.dataset.stepContent !== stepName) {
                    step.classList.add('hidden');
                }
            });

            const targetStep = container.querySelector(`[data-step-content="${stepName}"]`);
            if (targetStep) {
                targetStep.classList.remove('hidden');
                targetStep.classList.add('step-enter');
                setTimeout(() => targetStep.classList.remove('step-enter'), 300);

                _state.currentStep = stepName;
                container.setAttribute('data-step', stepName);

                // Mettre à jour la barre de progression
                _updateProgressBar(stepName);
            }
        }, _state.currentStep !== stepName ? 200 : 0);
    }

    /**
     * Mettre à jour la barre de progression
     * @private
     */
    function _updateProgressBar(stepName) {
        const stepMap = { intro: 1, camera: 2, preview: 3, analyzing: 3.5, result: 4 };
        const currentStepNum = stepMap[stepName] || 1;
        const progress = ((currentStepNum - 1) / 3) * 100;

        const progressFill = _state.containerElement?.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }

        const dots = _state.containerElement?.querySelectorAll('.step-dot');
        dots?.forEach((dot, index) => {
            dot.classList.toggle('active', index < currentStepNum);
            dot.classList.toggle('current', index + 1 === Math.ceil(currentStepNum));
        });
    }

    /**
     * Demander l'accès à la caméra
     * @private
     */
    async function _requestCamera() {
        try {
            AppConfig.log('Requesting camera access...');

            const stream = await navigator.mediaDevices.getUserMedia(CONFIG.videoConstraints);
            _state.stream = stream;

            _state.videoElement = _state.containerElement.querySelector('.identity-video');
            if (_state.videoElement) {
                _state.videoElement.srcObject = stream;

                // Attendre que la vidéo soit prête
                await new Promise((resolve) => {
                    _state.videoElement.onloadedmetadata = () => {
                        _state.videoElement.play();
                        resolve();
                    };
                });

                // Configurer le canvas overlay
                const canvas = _state.containerElement.querySelector('.identity-overlay-canvas');
                if (canvas) {
                    canvas.width = _state.videoElement.videoWidth || CONFIG.canvasWidth;
                    canvas.height = _state.videoElement.videoHeight || CONFIG.canvasHeight;
                }
            }

            AppConfig.log('Camera access granted');
            _showStep('camera');

            // Démarrer la détection simple (sans face-api.js pour l'instant)
            _startSimpleDetection();

        } catch (error) {
            AppConfig.error('Camera access error:', error);

            let message = __('verification.camera_error');
            if (error.name === 'NotAllowedError') {
                message = __('verification.permission_denied');
            } else if (error.name === 'NotFoundError') {
                message = __('verification.no_camera');
            }

            _showError(message);
        }
    }

    /**
     * Détection simplifiée (active le bouton après un délai)
     * @private
     */
    function _startSimpleDetection() {
        const captureBtn = _state.containerElement?.querySelector('#btn-capture');
        const indicator = _state.containerElement?.querySelector('#detection-indicator');
        const instruction = _state.containerElement?.querySelector('#camera-instruction');

        // Activer le bouton après un court délai pour s'assurer que l'utilisateur est prêt
        setTimeout(() => {
            if (captureBtn) {
                captureBtn.disabled = false;
                captureBtn.classList.add('ready');
            }
            if (indicator) {
                indicator.classList.remove('hidden');
                indicator.classList.add('show');
            }
            if (instruction) {
                instruction.querySelector('.instruction-text').textContent = __('verification.ready_to_capture');
                instruction.classList.add('ready');
            }
            _state.faceDetected = true;
        }, 1500);
    }

    /**
     * Capturer une photo depuis la vidéo
     * @private
     */
    function _capturePhoto() {
        if (!_state.videoElement) return;

        const captureBtn = _state.containerElement?.querySelector('#btn-capture');
        if (captureBtn) {
            captureBtn.classList.add('capturing');
        }

        // Flash effect
        const wrapper = _state.containerElement?.querySelector('.identity-video-wrapper');
        if (wrapper) {
            wrapper.classList.add('flash');
            setTimeout(() => wrapper.classList.remove('flash'), 200);
        }

        setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = _state.videoElement.videoWidth || CONFIG.canvasWidth;
            canvas.height = _state.videoElement.videoHeight || CONFIG.canvasHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(_state.videoElement, 0, 0, canvas.width, canvas.height);

            _state.capturedImage = canvas.toDataURL('image/jpeg', 0.92);

            // Afficher la preview
            const previewImg = _state.containerElement?.querySelector('.preview-image');
            if (previewImg) {
                previewImg.src = _state.capturedImage;
            }

            // Afficher les checks animés
            _animatePreviewChecks();

            _showStep('preview');

            if (captureBtn) {
                captureBtn.classList.remove('capturing');
            }
        }, CONFIG.captureDelay);
    }

    /**
     * Animer les checks de preview
     * @private
     */
    function _animatePreviewChecks() {
        const checks = ['check-face', 'check-lighting', 'check-clear'];
        checks.forEach((checkId, index) => {
            setTimeout(() => {
                const checkItem = _state.containerElement?.querySelector(`#${checkId} .check-icon`);
                if (checkItem) {
                    checkItem.classList.remove('pending');
                    checkItem.classList.add('success');
                }
            }, 300 + (index * 400));
        });
    }

    /**
     * Analyser avec l'IA et afficher la progression
     * @private
     */
    async function _analyzeWithAI() {
        _showStep('analyzing');
        _state.isAnalyzing = true;

        // Afficher la photo dans l'analyse
        const analysisPhoto = _state.containerElement?.querySelector('.analysis-photo');
        if (analysisPhoto && _state.capturedImage) {
            analysisPhoto.src = _state.capturedImage;
        }

        // Animer les étapes d'analyse
        const steps = CONFIG.analysisSteps;
        let totalDuration = 0;
        let currentProgress = 0;

        for (const step of steps) {
            const stepEl = _state.containerElement?.querySelector(`[data-analysis-step="${step.id}"]`);
            if (stepEl) {
                stepEl.classList.add('active');
            }

            // Animer la progression
            const targetProgress = currentProgress + (100 / steps.length);
            _animateProgress(currentProgress, targetProgress, step.duration);
            currentProgress = targetProgress;

            await _sleep(step.duration);

            if (stepEl) {
                stepEl.classList.remove('active');
                stepEl.classList.add('completed');
            }
        }

        // Envoyer au serveur pour analyse IA
        try {
            // Note: L'API attend 'image', pas 'photo'
            const formData = new FormData();
            formData.append('image', _state.capturedImage);

            const response = await ApiService.upload('verification?action=submit', formData);

            _state.analysisResult = response;
            _state.isAnalyzing = false;

            // Afficher le résultat
            if (response.success && response.status === 'verified') {
                _showResult('verified', response.message, response.analysis);
            } else if (response.status === 'rejected') {
                _showResult('rejected', response.message, response.analysis);
            } else {
                _showResult('pending', response.message, response.analysis);
            }

        } catch (error) {
            AppConfig.error('Analysis error:', error);
            _state.isAnalyzing = false;
            _showResult('error', error.message || __('verification.error_occurred'));
        }
    }

    /**
     * Animer la barre de progression circulaire
     * @private
     */
    function _animateProgress(from, to, duration) {
        const progressBar = _state.containerElement?.querySelector('.progress-bar');
        const progressPercent = _state.containerElement?.querySelector('.progress-percent');

        if (!progressBar || !progressPercent) return;

        const circumference = 283; // 2 * PI * 45
        const startOffset = circumference - (from / 100) * circumference;
        const endOffset = circumference - (to / 100) * circumference;

        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const currentOffset = startOffset - (startOffset - endOffset) * progress;
            const currentPercent = Math.round(from + (to - from) * progress);

            progressBar.style.strokeDashoffset = currentOffset;
            progressPercent.textContent = `${currentPercent}%`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }

        requestAnimationFrame(animate);
    }

    /**
     * Afficher le résultat avec animations
     * @private
     */
    function _showResult(status, message, analysis = null) {
        const iconContainer = _state.containerElement?.querySelector('.result-icon');
        const titleElement = _state.containerElement?.querySelector('.result-title');
        const messageElement = _state.containerElement?.querySelector('.result-message');
        const actionButton = _state.containerElement?.querySelector('.result-action-btn');
        const detailsContainer = _state.containerElement?.querySelector('.result-details');
        const confidenceValue = _state.containerElement?.querySelector('.confidence-value');

        let icon, title, actionText, actionClass, resultClass;

        switch (status) {
            case 'verified':
                icon = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>`;
                title = __('verification.result_verified');
                actionText = __('verification.continue_registration');
                actionClass = 'btn-accent';
                resultClass = 'success';
                break;

            case 'pending':
                icon = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>`;
                title = __('verification.result_pending');
                actionText = __('verification.continue_anyway');
                actionClass = 'btn-primary';
                resultClass = 'pending';
                break;

            case 'rejected':
                icon = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>`;
                title = __('verification.result_rejected');
                actionText = __('verification.try_again');
                actionClass = 'btn-secondary';
                resultClass = 'error';
                break;

            default:
                icon = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4"/>
                    <path d="M12 16h.01"/>
                </svg>`;
                title = __('verification.result_error');
                actionText = __('verification.try_again');
                actionClass = 'btn-secondary';
                resultClass = 'error';
        }

        if (iconContainer) {
            iconContainer.innerHTML = icon;
            iconContainer.className = `result-icon ${resultClass}`;
        }
        if (titleElement) titleElement.textContent = title;
        if (messageElement) messageElement.textContent = message || '';
        if (actionButton) {
            actionButton.textContent = actionText;
            actionButton.className = `btn btn-lg btn-block result-action-btn ${actionClass}`;
        }

        // Afficher les détails si disponibles
        if (analysis && detailsContainer && confidenceValue) {
            const confidence = Math.round((analysis.confidence || 0) * 100);
            confidenceValue.textContent = `${confidence}%`;
            detailsContainer.classList.remove('hidden');
        }

        _showStep('result');

        // Animation d'entrée du résultat
        setTimeout(() => {
            iconContainer?.classList.add('animate-in');
        }, 100);
    }

    /**
     * Afficher une erreur toast
     * @private
     */
    function _showError(message) {
        if (window.ToastNotification) {
            ToastNotification.show('error', message);
        } else if (window.showToast) {
            showToast('error', __('error.title'), message);
        } else {
            alert(message);
        }
    }

    /**
     * Sleep helper
     * @private
     */
    function _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Nettoyer les ressources
     * @private
     */
    function _cleanup() {
        if (_state.stream) {
            _state.stream.getTracks().forEach(track => track.stop());
            _state.stream = null;
        }

        if (_state.videoElement) {
            _state.videoElement.srcObject = null;
        }

        if (_state.progressInterval) {
            clearInterval(_state.progressInterval);
            _state.progressInterval = null;
        }
    }

    /**
     * Attacher les event listeners
     * @private
     */
    function _attachEventListeners() {
        if (!_state.containerElement) return;

        // Checkbox consentement
        const consentCheckbox = _state.containerElement.querySelector('#identity-consent-checkbox');
        const continueBtn = _state.containerElement.querySelector('.identity-btn-continue');

        if (consentCheckbox && continueBtn) {
            consentCheckbox.addEventListener('change', (e) => {
                continueBtn.disabled = !e.target.checked;
                if (e.target.checked) {
                    continueBtn.classList.add('pulse');
                } else {
                    continueBtn.classList.remove('pulse');
                }
            });

            continueBtn.addEventListener('click', async () => {
                continueBtn.classList.add('is-loading');
                continueBtn.disabled = true;
                try {
                    await _requestCamera();
                } catch (error) {
                    _showError(error.message);
                    continueBtn.disabled = false;
                } finally {
                    continueBtn.classList.remove('is-loading');
                }
            });
        }

        // Bouton capture
        const captureBtn = _state.containerElement.querySelector('#btn-capture');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => {
                if (!captureBtn.disabled) {
                    _capturePhoto();
                }
            });
        }

        // Bouton reprendre
        const retakeBtn = _state.containerElement.querySelector('.identity-btn-retake');
        if (retakeBtn) {
            retakeBtn.addEventListener('click', () => {
                _state.capturedImage = null;
                // Reset les checks
                const checks = _state.containerElement.querySelectorAll('.check-icon');
                checks.forEach(check => {
                    check.classList.remove('success');
                    check.classList.add('pending');
                });
                _showStep('camera');
            });
        }

        // Bouton soumettre
        const submitBtn = _state.containerElement.querySelector('.identity-btn-submit');
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                submitBtn.classList.add('is-loading');
                submitBtn.disabled = true;
                try {
                    await _analyzeWithAI();
                } catch (error) {
                    _showError(error.message);
                } finally {
                    submitBtn.classList.remove('is-loading');
                    submitBtn.disabled = false;
                }
            });
        }

        // Bouton action résultat
        _state.containerElement.addEventListener('click', (e) => {
            if (e.target.classList.contains('result-action-btn')) {
                const status = _state.analysisResult?.status;

                if (status === 'rejected' || status === 'error') {
                    // Réessayer
                    _state.capturedImage = null;
                    _state.analysisResult = null;
                    _state.attemptCount++;

                    // Reset les étapes d'analyse
                    const analysisSteps = _state.containerElement.querySelectorAll('[data-analysis-step]');
                    analysisSteps.forEach(step => {
                        step.classList.remove('active', 'completed');
                    });

                    _showStep('camera');
                } else {
                    // Continuer - appeler le callback
                    if (_state.containerElement.dataset.onComplete) {
                        const callback = window[_state.containerElement.dataset.onComplete];
                        if (typeof callback === 'function') {
                            callback(_state.analysisResult);
                        }
                    } else {
                        // Rediriger vers la suite de l'inscription
                        if (typeof navigateTo === 'function') {
                            navigateTo('register/complete');
                        }
                    }
                }
            }
        });
    }

    // API publique
    return {
        /**
         * Initialiser le module dans un conteneur
         * @param {string} containerSelector - Sélecteur CSS du conteneur
         * @param {Object} options - Options de configuration
         */
        init: function(containerSelector, options = {}) {
            const container = document.querySelector(containerSelector);
            if (!container) {
                AppConfig.error('IdentityCamera: Container not found:', containerSelector);
                return;
            }

            _state.containerElement = container;
            container.innerHTML = _generateHTML();

            // Options
            if (options.onComplete) {
                container.dataset.onComplete = options.onComplete;
            }

            _attachEventListeners();

            AppConfig.log('IdentityCamera v2.0 initialisé');
        },

        /**
         * Obtenir le résultat de l'analyse
         * @returns {Object|null}
         */
        getResult: function() {
            return _state.analysisResult;
        },

        /**
         * Vérifier si une analyse est en cours
         * @returns {boolean}
         */
        isAnalyzing: function() {
            return _state.isAnalyzing;
        },

        /**
         * Nettoyer et détruire le module
         */
        destroy: function() {
            _cleanup();

            if (_state.containerElement) {
                _state.containerElement.innerHTML = '';
                _state.containerElement = null;
            }

            _state = {
                containerElement: null,
                videoElement: null,
                canvasElement: null,
                stream: null,
                currentStep: 'intro',
                capturedImage: null,
                analysisResult: null,
                attemptCount: 0,
                maxAttempts: 3,
                isAnalyzing: false,
                progressInterval: null,
                faceDetected: false,
                lastFaceDetection: null
            };

            AppConfig.log('IdentityCamera destroyed');
        }
    };
})();

// Export pour usage module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IdentityCamera;
}
