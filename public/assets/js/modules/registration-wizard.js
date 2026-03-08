/**
 * TripSalama - Registration Wizard Module
 * Gère le flux d'inscription en 3 étapes:
 * 1. Vérification du genre (visage)
 * 2. Scan de la carte d'identité
 * 3. Formulaire pré-rempli
 *
 * @requires ApiService
 * @requires IdentityCamera
 * @requires i18n
 */

const RegistrationWizard = (function() {
    'use strict';

    // État privé
    let _state = {
        currentStep: 1,
        role: 'passenger',
        genderVerified: false,
        idVerified: false,
        prefillData: {},
        idStream: null,
        capturedIdImage: null
    };

    // Configuration
    const CONFIG = {
        steps: {
            GENDER: 1,
            ID_CARD: 2,
            FORM: 3
        },
        videoConstraints: {
            video: {
                facingMode: 'environment', // Caméra arrière pour scanner la carte
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        }
    };

    /**
     * Initialiser le wizard
     * @param {Object} options - Options de configuration
     */
    async function init(options = {}) {
        _state.role = options.role || 'passenger';
        _state.currentStep = options.currentStep || 1;
        _state.genderVerified = options.genderVerified || false;
        _state.idVerified = options.idVerified || false;
        _state.prefillData = options.prefillData || {};

        // Attendre que i18n soit prêt avant d'initialiser les composants
        if (typeof i18n !== 'undefined' && typeof i18n.ready === 'function') {
            await i18n.ready();
        }

        _initStep1GenderVerification();
        _initStep2IDScan();
        _initStep3Form();

        // Si déjà vérifié, passer aux étapes suivantes
        if (_state.genderVerified && _state.currentStep === 1) {
            _goToStep(CONFIG.steps.ID_CARD);
        }
        if (_state.idVerified && _state.currentStep <= 2) {
            _goToStep(CONFIG.steps.FORM);
        }

        AppConfig.log('RegistrationWizard initialized', _state);
    }

    /**
     * Initialiser l'étape 1: Vérification du genre
     */
    function _initStep1GenderVerification() {
        const container = document.getElementById('gender-camera-container');
        if (!container) return;

        // Initialiser IdentityCamera avec un callback personnalisé
        // apiAction: 'verify-gender' car c'est AVANT inscription (endpoint public)
        // realtimeDetection: true pour détection IA immédiate
        IdentityCamera.init('#gender-camera-container', {
            onComplete: 'handleGenderVerificationComplete',
            apiAction: 'verify-gender',
            realtimeDetection: true
        });

        // Exposer le callback globalement
        window.handleGenderVerificationComplete = async function(result) {
            AppConfig.log('Gender verification result:', result);

            // Vérifier les différents formats de réponse (verify-gender vs submit)
            const isVerified = result && (
                result.status === 'verified' ||
                result.can_proceed === true ||
                (result.is_female === true && result.confidence >= 0.7)
            );
            const isRejected = result && (
                result.status === 'rejected' ||
                result.is_female === false
            );

            if (isVerified) {
                // Vérification réussie - passer à l'étape suivante
                _state.genderVerified = true;
                _goToStep(CONFIG.steps.ID_CARD);
            } else if (isRejected) {
                // L'IA a détecté que ce n'est pas une femme
                _showRejectionModal();
            } else {
                // Cas "pending" ou "continuer quand même" - permettre de continuer
                // (vérification manuelle sera faite plus tard)
                _state.genderVerified = true;
                _goToStep(CONFIG.steps.ID_CARD);
            }
        };
    }

    /**
     * Vérifier le genre côté serveur
     */
    async function _verifyGenderOnServer() {
        try {
            // Récupérer l'image capturée par IdentityCamera
            const result = IdentityCamera.getResult();
            if (!result) {
                return { can_proceed: false };
            }

            // Envoyer au serveur pour vérification
            const response = await ApiService.post('verification?action=verify-gender', {
                image: result.image || ''
            });

            return response;
        } catch (error) {
            AppConfig.error('Gender verification server error:', error);
            return { can_proceed: false, message: error.message };
        }
    }

    /**
     * Initialiser l'étape 2: Scan de la carte d'identité
     */
    function _initStep2IDScan() {
        const startBtn = document.getElementById('btn-start-id-scan');
        const captureBtn = document.getElementById('btn-capture-id');
        const retakeBtn = document.getElementById('btn-retake-id');
        const submitBtn = document.getElementById('btn-submit-id');

        if (startBtn) {
            startBtn.addEventListener('click', _startIDCamera);
        }

        if (captureBtn) {
            captureBtn.addEventListener('click', _captureIDPhoto);
        }

        if (retakeBtn) {
            retakeBtn.addEventListener('click', _retakeIDPhoto);
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', _submitIDPhoto);
        }
    }

    /**
     * Démarrer la caméra pour le scan de carte
     */
    async function _startIDCamera() {
        try {
            _showIDStep('camera');

            const stream = await navigator.mediaDevices.getUserMedia(CONFIG.videoConstraints);
            _state.idStream = stream;

            const video = document.getElementById('id-video');
            if (video) {
                video.srcObject = stream;
                await video.play();
            }

        } catch (error) {
            AppConfig.error('ID camera error:', error);
            _showIDResult('error', __('verification.camera_error'));
        }
    }

    /**
     * Capturer la photo de la carte d'identité
     */
    function _captureIDPhoto() {
        const video = document.getElementById('id-video');
        if (!video) return;

        // Flash effect
        const wrapper = video.closest('.id-video-wrapper');
        if (wrapper) {
            wrapper.classList.add('flash');
            setTimeout(() => wrapper.classList.remove('flash'), 200);
        }

        // Capture
        setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            _state.capturedIdImage = canvas.toDataURL('image/jpeg', 0.92);

            // Afficher preview
            const previewImg = document.getElementById('id-preview-img');
            if (previewImg) {
                previewImg.src = _state.capturedIdImage;
            }

            _showIDStep('preview');
        }, 100);
    }

    /**
     * Reprendre la photo de la carte
     */
    function _retakeIDPhoto() {
        _state.capturedIdImage = null;
        _showIDStep('camera');
    }

    /**
     * Soumettre la photo de la carte pour OCR
     */
    async function _submitIDPhoto() {
        if (!_state.capturedIdImage) return;

        _showIDStep('analyzing');

        try {
            const response = await ApiService.post('verification?action=scan-id', {
                image: _state.capturedIdImage
            });

            if (response.success && response.can_proceed) {
                // Stockage des données préfill
                _state.prefillData = response.prefill_data || {};
                _state.idVerified = true;

                // Afficher succès puis passer au formulaire
                _showIDResult('success', __('verification.id_verified'), () => {
                    _goToStep(CONFIG.steps.FORM);
                    _prefillForm(_state.prefillData);
                });
            } else if (!response.is_female) {
                // La carte n'appartient pas à une femme
                _stopIDCamera();
                _showRejectionModal();
            } else {
                // Autre erreur
                _showIDResult('error', response.message || __('verification.id_verification_failed'));
            }

        } catch (error) {
            AppConfig.error('ID scan error:', error);
            _showIDResult('error', error.message || __('verification.ai_error'));
        }
    }

    /**
     * Afficher une étape du scan de carte
     */
    function _showIDStep(stepName) {
        const container = document.getElementById('id-scan-container');
        if (!container) return;

        const interface_ = container.querySelector('.id-scan-interface');
        if (interface_) {
            interface_.setAttribute('data-scan-step', stepName);
        }

        const allSteps = container.querySelectorAll('.id-scan-step');
        allSteps.forEach(step => {
            step.classList.add('hidden');
        });

        const targetStep = container.querySelector(`[data-content="${stepName}"]`);
        if (targetStep) {
            targetStep.classList.remove('hidden');
        }
    }

    /**
     * Afficher le résultat du scan de carte
     */
    function _showIDResult(status, message, onContinue = null) {
        _showIDStep('result');

        const iconContainer = document.querySelector('.id-result-icon');
        const titleEl = document.querySelector('.id-result-title');
        const messageEl = document.querySelector('.id-result-message');
        const actionBtn = document.querySelector('.id-result-action');

        let icon, title, actionText, btnClass;

        if (status === 'success') {
            icon = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#06C167" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>`;
            title = __('verification.id_verified');
            actionText = __('verification.continue_registration');
            btnClass = 'btn-accent';
        } else {
            icon = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#E11900" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>`;
            title = __('verification.id_verification_failed');
            actionText = __('verification.try_again');
            btnClass = 'btn-secondary';
        }

        if (iconContainer) iconContainer.innerHTML = icon;
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        if (actionBtn) {
            actionBtn.textContent = actionText;
            actionBtn.className = `btn btn-lg btn-block id-result-action ${btnClass}`;
            actionBtn.onclick = () => {
                if (status === 'success' && onContinue) {
                    onContinue();
                } else {
                    _retakeIDPhoto();
                }
            };
        }
    }

    /**
     * Arrêter la caméra de scan de carte
     */
    function _stopIDCamera() {
        if (_state.idStream) {
            _state.idStream.getTracks().forEach(track => track.stop());
            _state.idStream = null;
        }
    }

    /**
     * Initialiser l'étape 3: Formulaire
     */
    function _initStep3Form() {
        const form = document.getElementById('registration-form');
        if (!form) return;

        // Password toggle
        const passwordToggle = form.querySelector('.password-toggle');
        if (passwordToggle) {
            passwordToggle.addEventListener('click', function() {
                const input = this.previousElementSibling;
                const eyeOpen = this.querySelector('.eye-open');
                const eyeClosed = this.querySelector('.eye-closed');

                if (input.type === 'password') {
                    input.type = 'text';
                    eyeOpen.classList.add('hidden');
                    eyeClosed.classList.remove('hidden');
                } else {
                    input.type = 'password';
                    eyeOpen.classList.remove('hidden');
                    eyeClosed.classList.add('hidden');
                }
            });
        }

        // Password requirements validation
        const passwordInput = form.querySelector('#password');
        if (passwordInput) {
            passwordInput.addEventListener('input', function() {
                _validatePasswordRequirements(this.value);
            });
        }

        // Form submission
        form.addEventListener('submit', function(e) {
            if (!_validateForm()) {
                e.preventDefault();
            }
        });
    }

    /**
     * Valider les exigences du mot de passe
     */
    function _validatePasswordRequirements(password) {
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        Object.entries(requirements).forEach(([req, valid]) => {
            const el = document.querySelector(`.requirement[data-req="${req}"]`);
            if (el) {
                el.classList.toggle('valid', valid);
                el.classList.toggle('invalid', !valid);
            }
        });

        return Object.values(requirements).every(v => v);
    }

    /**
     * Valider le formulaire avant soumission
     */
    function _validateForm() {
        const form = document.getElementById('registration-form');
        if (!form) return false;

        const password = form.querySelector('#password').value;
        const passwordConfirm = form.querySelector('#password_confirm').value;

        if (password !== passwordConfirm) {
            _showFormError(__('validation.password_mismatch'));
            return false;
        }

        if (!_validatePasswordRequirements(password)) {
            _showFormError(__('validation.password_min_length'));
            return false;
        }

        return true;
    }

    /**
     * Afficher une erreur de formulaire
     */
    function _showFormError(message) {
        if (window.ToastNotification) {
            ToastNotification.show('error', message);
        } else {
            alert(message);
        }
    }

    /**
     * Pré-remplir le formulaire avec les données de la carte
     */
    function _prefillForm(data) {
        if (!data) return;

        const mappings = {
            'first_name': data.first_name,
            'last_name': data.last_name
        };

        Object.entries(mappings).forEach(([fieldId, value]) => {
            if (value) {
                const input = document.getElementById(fieldId);
                if (input) {
                    input.value = value;
                    // Ajouter une classe pour indiquer le pré-remplissage
                    input.classList.add('prefilled');
                }
            }
        });
    }

    /**
     * Passer à une étape spécifique
     */
    function _goToStep(stepNumber) {
        _state.currentStep = stepNumber;

        // Masquer toutes les étapes
        document.querySelectorAll('.wizard-panel').forEach(panel => {
            panel.hidden = true;
        });

        // Afficher l'étape cible (utiliser .wizard-panel pour éviter de matcher les indicateurs)
        const targetPanel = document.querySelector(`.wizard-panel[data-step="${stepNumber}"]`);
        if (targetPanel) {
            targetPanel.hidden = false;
        }

        // Mettre à jour la progression
        _updateProgress(stepNumber);

        // Arrêter les caméras si on quitte leurs étapes
        if (stepNumber !== CONFIG.steps.GENDER) {
            IdentityCamera.destroy();
        }
        if (stepNumber !== CONFIG.steps.ID_CARD) {
            _stopIDCamera();
        }
    }

    /**
     * Mettre à jour la barre de progression
     */
    function _updateProgress(step) {
        const progressFill = document.querySelector('.wizard-progress-fill');
        if (progressFill) {
            const progress = ((step - 1) / 2) * 100;
            progressFill.style.width = `${progress}%`;
        }

        document.querySelectorAll('.wizard-step').forEach(stepEl => {
            const stepNum = parseInt(stepEl.dataset.step);
            stepEl.classList.toggle('active', stepNum <= step);
            stepEl.classList.toggle('current', stepNum === step);
        });
    }

    /**
     * Afficher le modal de rejet (si homme détecté)
     */
    function _showRejectionModal() {
        const modal = document.getElementById('rejection-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }

        // Nettoyer les ressources
        IdentityCamera.destroy();
        _stopIDCamera();

        // Nettoyer la session côté serveur
        ApiService.post('verification?action=clear-registration').catch(() => {});
    }

    // API publique
    return {
        init: init,
        goToStep: _goToStep,
        getCurrentStep: () => _state.currentStep,
        isGenderVerified: () => _state.genderVerified,
        isIDVerified: () => _state.idVerified,
        getPrefillData: () => _state.prefillData
    };
})();

// Export pour usage module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RegistrationWizard;
}
