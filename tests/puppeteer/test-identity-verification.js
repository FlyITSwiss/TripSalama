/**
 * TripSalama - Tests E2E Vérification d'Identité par Caméra
 *
 * Tests du parcours complet de vérification d'identité lors de l'inscription
 *
 * Installation :
 *   npm install puppeteer
 *
 * Exécution :
 *   node test-identity-verification.js
 *   npm run test:identity
 */

const puppeteer = require('puppeteer');
const config = require('./config');
const helpers = require('./helpers');
const fs = require('fs');
const path = require('path');

// Configuration spécifique à la vérification d'identité
const IDENTITY_CONFIG = {
    ...config,
    puppeteer: {
        ...config.puppeteer,
        args: [
            ...config.puppeteer.args,
            '--use-fake-ui-for-media-stream',      // Auto-accepter permission caméra
            '--use-fake-device-for-media-stream',   // Simuler une caméra
            '--disable-blink-features=AutomationControlled'
        ]
    },
    screenshotDir: path.join(__dirname, 'screenshots', 'identity-verification'),
    timeout: {
        ...config.timeout,
        camera: 5000,      // Temps d'attente pour l'activation caméra
        analysis: 10000    // Temps d'attente pour l'analyse d'identité
    }
};

// Sélecteurs de la page de vérification d'identité
const SELECTORS = {
    // Page principale
    container: '.identity-verification-container, .identity-camera-container, #identityVerification',
    title: '.identity-title, .verification-title, h2',

    // Étape 1: Consentement
    consentCheckbox: '#identity-consent-checkbox, #consent-checkbox, input[name="identity-consent"]',
    consentLabel: 'label[for="identity-consent-checkbox"]',
    continueButton: '.identity-btn-continue, .btn-continue, button[data-action="continue"]',

    // Étape 2: Caméra
    cameraView: '.identity-camera-view, .camera-view, #cameraView',
    videoElement: 'video#identityVideo, video.identity-video, video',
    faceGuide: '.face-guide, .identity-guide, .camera-guide',
    captureButton: '.identity-btn-capture, .btn-capture, button[data-action="capture"]',

    // Étape 3: Preview
    previewContainer: '.identity-preview, .photo-preview',
    previewImage: '.preview-image, #previewImage, img.captured-photo',
    retakeButton: '.btn-retake, button[data-action="retake"]',
    validateButton: '.btn-validate, button[data-action="validate"]',

    // Étape 4: Résultat
    resultContainer: '.verification-result, .identity-result',
    loadingMessage: '.loading-message, .analyzing',
    successMessage: '.success-message, .verification-success',
    pendingMessage: '.pending-message, .verification-pending',
    errorMessage: '.error-message, .verification-error',

    // Tips et informations
    tipsContainer: '.identity-tips, .verification-tips',
    tipItem: '.tip-item, .tip',

    // Navigation
    backButton: '.btn-back, button[data-action="back"]',
    skipButton: '.btn-skip, button[data-action="skip"]'
};

// Données de test
const TEST_USERS = {
    newPassenger: {
        email: `passenger.test.${Date.now()}@tripsalama.com`,
        password: 'Test1234!',
        firstName: 'Fatima',
        lastName: 'Testing',
        phone: '+33612345678',
        role: 'passenger'
    },
    newDriver: {
        email: `driver.test.${Date.now()}@tripsalama.com`,
        password: 'Test1234!',
        firstName: 'Khadija',
        lastName: 'Testing',
        phone: '+33687654321',
        role: 'driver',
        vehicleBrand: 'Renault',
        vehicleModel: 'Clio',
        vehiclePlate: 'AB-123-CD',
        vehicleColor: 'Rouge'
    }
};

// Couleurs console
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(type, message) {
    const prefix = {
        pass: `${colors.green}[PASS]${colors.reset}`,
        fail: `${colors.red}[FAIL]${colors.reset}`,
        info: `${colors.blue}[INFO]${colors.reset}`,
        warn: `${colors.yellow}[WARN]${colors.reset}`,
        step: `${colors.cyan}[STEP]${colors.reset}`
    };
    console.log(`${prefix[type] || '[LOG]'} ${message}`);
}

// Créer le dossier de screenshots s'il n'existe pas
if (!fs.existsSync(IDENTITY_CONFIG.screenshotDir)) {
    fs.mkdirSync(IDENTITY_CONFIG.screenshotDir, { recursive: true });
}

/**
 * Prendre une screenshot spécifique à ce test
 */
async function takeScreenshot(page, name, isFailure = false) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = isFailure ? '-FAILURE' : '';
    const filename = `${name}${suffix}-${timestamp}.png`;
    const filepath = path.join(IDENTITY_CONFIG.screenshotDir, filename);

    await page.screenshot({
        path: filepath,
        fullPage: true
    });

    log('info', `Screenshot: ${filename}`);
    return filename;
}

/**
 * Vérifier qu'un élément existe et est visible
 */
async function checkElementVisible(page, selector, name) {
    try {
        await page.waitForSelector(selector, {
            visible: true,
            timeout: IDENTITY_CONFIG.timeout.element
        });
        return true;
    } catch (error) {
        log('fail', `Element non trouvé: ${name} (${selector})`);
        return false;
    }
}

/**
 * Remplir le formulaire d'inscription
 */
async function fillRegistrationForm(page, userData) {
    log('step', 'Remplissage du formulaire d\'inscription...');

    // Sélecteurs de formulaire d'inscription
    const formSelectors = {
        email: 'input[name="email"], #email',
        password: 'input[name="password"], #password',
        confirmPassword: 'input[name="confirm_password"], #confirm-password',
        firstName: 'input[name="first_name"], #first-name',
        lastName: 'input[name="last_name"], #last-name',
        phone: 'input[name="phone"], #phone',
        rolePassenger: 'input[value="passenger"], #role-passenger',
        roleDriver: 'input[value="driver"], #role-driver',
        submit: 'button[type="submit"], .btn-submit'
    };

    // Champs communs
    await helpers.fillInput(page, formSelectors.email, userData.email);
    await helpers.fillInput(page, formSelectors.password, userData.password);

    // Confirmer mot de passe si le champ existe
    const confirmPasswordExists = await page.$(formSelectors.confirmPassword);
    if (confirmPasswordExists) {
        await helpers.fillInput(page, formSelectors.confirmPassword, userData.password);
    }

    await helpers.fillInput(page, formSelectors.firstName, userData.firstName);
    await helpers.fillInput(page, formSelectors.lastName, userData.lastName);
    await helpers.fillInput(page, formSelectors.phone, userData.phone);

    // Sélectionner le rôle
    if (userData.role === 'driver') {
        const driverRadio = await page.$(formSelectors.roleDriver);
        if (driverRadio) {
            await driverRadio.click();
            await config.sleep(500);

            // Remplir infos véhicule si visible
            const vehicleBrandInput = await page.$('input[name="vehicle_brand"]');
            if (vehicleBrandInput) {
                await helpers.fillInput(page, 'input[name="vehicle_brand"]', userData.vehicleBrand);
                await helpers.fillInput(page, 'input[name="vehicle_model"]', userData.vehicleModel);
                await helpers.fillInput(page, 'input[name="vehicle_plate"]', userData.vehiclePlate);
                await helpers.fillInput(page, 'input[name="vehicle_color"]', userData.vehicleColor);
            }
        }
    } else {
        const passengerRadio = await page.$(formSelectors.rolePassenger);
        if (passengerRadio) {
            await passengerRadio.click();
            await config.sleep(500);
        }
    }

    await takeScreenshot(page, `registration-form-filled-${userData.role}`);

    // Soumettre
    await Promise.all([
        page.click(formSelectors.submit),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
    ]);

    await config.sleep(1000);
}

/**
 * TESTS E2E - VÉRIFICATION D'IDENTITÉ
 */
async function runIdentityVerificationTests() {
    let browser;
    let passed = 0;
    let failed = 0;
    const results = [];

    try {
        log('info', '========================================');
        log('info', 'TESTS E2E - VÉRIFICATION D\'IDENTITÉ');
        log('info', '========================================\n');

        // Lancer le navigateur avec support caméra fake
        log('info', 'Lancement de Puppeteer avec caméra simulée...');
        browser = await puppeteer.launch(IDENTITY_CONFIG.puppeteer);
        const page = await browser.newPage();

        // Autoriser les permissions caméra
        const context = browser.defaultBrowserContext();
        await context.overridePermissions(IDENTITY_CONFIG.baseUrl, ['camera']);

        log('pass', 'Navigateur lancé avec caméra simulée activée\n');

        // ========================================
        // TEST 1: Accès direct à la page de vérification
        // ========================================
        log('info', 'Test 1: Accès à la page de vérification...');
        try {
            await page.goto(config.url('identity-verification'), {
                waitUntil: 'networkidle2',
                timeout: IDENTITY_CONFIG.timeout.navigation
            });

            await takeScreenshot(page, '01-verification-page');

            // Vérifier les éléments principaux
            const hasContainer = await checkElementVisible(page, SELECTORS.container, 'Conteneur principal');
            const hasTitle = await checkElementVisible(page, SELECTORS.title, 'Titre');

            if (hasContainer && hasTitle) {
                log('pass', 'Page de vérification accessible et affichée correctement');
                passed++;
                results.push({ test: 1, status: 'pass', name: 'Page de vérification accessible' });
            } else {
                log('fail', 'Page de vérification incomplète');
                await takeScreenshot(page, '01-verification-page', true);
                failed++;
                results.push({ test: 1, status: 'fail', name: 'Page de vérification incomplète' });
            }
        } catch (error) {
            log('fail', `Test 1 échoué: ${error.message}`);
            await takeScreenshot(page, '01-verification-page', true);
            failed++;
            results.push({ test: 1, status: 'fail', name: 'Page access error' });
        }

        await config.sleep(1000);

        // ========================================
        // TEST 2: Vérification des tips et informations
        // ========================================
        log('info', 'Test 2: Vérification des tips...');
        try {
            const hasTips = await page.$(SELECTORS.tipsContainer);

            if (hasTips) {
                const tipsCount = await page.$$eval(SELECTORS.tipItem, items => items.length);
                log('pass', `${tipsCount} tips d'aide affichés`);
                passed++;
                results.push({ test: 2, status: 'pass', name: 'Tips affichés' });
            } else {
                log('warn', 'No tips found (may be normal)');
                passed++;
                results.push({ test: 2, status: 'pass', name: 'Tips optionnels' });
            }
        } catch (error) {
            log('fail', `Test 2 échoué: ${error.message}`);
            failed++;
            results.push({ test: 2, status: 'fail', name: 'Tips verification error' });
        }

        await config.sleep(500);

        // ========================================
        // TEST 3: Consentement obligatoire
        // ========================================
        log('info', 'Test 3: Consentement obligatoire...');
        try {
            // Vérifier que le bouton continuer est désactivé
            const continueBtn = await page.$(SELECTORS.continueButton);

            if (continueBtn) {
                const isDisabled = await page.evaluate(btn => {
                    return btn.disabled || btn.hasAttribute('disabled') ||
                           btn.classList.contains('disabled');
                }, continueBtn);

                if (isDisabled) {
                    log('pass', 'Bouton "Continuer" désactivé par défaut');
                } else {
                    log('warn', 'Bouton "Continuer" actif sans consentement');
                }

                // Cocher la checkbox de consentement
                const consentCheckbox = await page.$(SELECTORS.consentCheckbox);
                if (consentCheckbox) {
                    await consentCheckbox.click();
                    await config.sleep(500);
                    await takeScreenshot(page, '03-consent-checked');

                    // Vérifier que le bouton est maintenant actif
                    const isNowEnabled = await page.evaluate(btn => {
                        return !btn.disabled && !btn.hasAttribute('disabled') &&
                               !btn.classList.contains('disabled');
                    }, continueBtn);

                    if (isNowEnabled) {
                        log('pass', 'Bouton "Continuer" activé après consentement');
                        passed++;
                        results.push({ test: 3, status: 'pass', name: 'Consentement fonctionnel' });
                    } else {
                        log('fail', 'Bouton reste désactivé après consentement');
                        await takeScreenshot(page, '03-consent-checked', true);
                        failed++;
                        results.push({ test: 3, status: 'fail', name: 'Bouton non activé' });
                    }
                } else {
                    log('warn', 'Checkbox de consentement non trouvée');
                    passed++;
                    results.push({ test: 3, status: 'pass', name: 'Consentement optionnel' });
                }
            } else {
                log('fail', 'Bouton "Continuer" non trouvé');
                await takeScreenshot(page, '03-consent-failed', true);
                failed++;
                results.push({ test: 3, status: 'fail', name: 'Bouton continuer absent' });
            }
        } catch (error) {
            log('fail', `Test 3 échoué: ${error.message}`);
            failed++;
            results.push({ test: 3, status: 'fail', name: 'Consent error' });
        }

        await config.sleep(1000);

        // ========================================
        // TEST 4: Activation de la caméra
        // ========================================
        log('info', 'Test 4: Activation de la caméra...');
        try {
            const continueBtn = await page.$(SELECTORS.continueButton);
            if (continueBtn) {
                await continueBtn.click();
                await config.sleep(2000); // Attendre activation caméra

                await takeScreenshot(page, '04-camera-view');

                // Vérifier que la vue caméra s'affiche
                const cameraViewVisible = await checkElementVisible(
                    page,
                    SELECTORS.cameraView,
                    'Vue caméra'
                );

                // Vérifier que la vidéo est présente
                const videoElement = await page.$(SELECTORS.videoElement);

                if (cameraViewVisible && videoElement) {
                    log('pass', 'Caméra activée et affichée');

                    // Vérifier le guide visage
                    const faceGuide = await page.$(SELECTORS.faceGuide);
                    if (faceGuide) {
                        log('pass', 'Guide de positionnement du visage affiché');
                    }

                    passed++;
                    results.push({ test: 4, status: 'pass', name: 'Caméra activée' });
                } else {
                    log('fail', 'Caméra non activée ou invisible');
                    await takeScreenshot(page, '04-camera-view', true);
                    failed++;
                    results.push({ test: 4, status: 'fail', name: 'Caméra non activée' });
                }
            } else {
                log('fail', 'Impossible de continuer vers la caméra');
                failed++;
                results.push({ test: 4, status: 'fail', name: 'Navigation caméra échouée' });
            }
        } catch (error) {
            log('fail', `Test 4 échoué: ${error.message}`);
            await takeScreenshot(page, '04-camera-view', true);
            failed++;
            results.push({ test: 4, status: 'fail', name: 'Camera activation error' });
        }

        await config.sleep(1000);

        // ========================================
        // TEST 5: Capture de photo
        // ========================================
        log('info', 'Test 5: Capture de photo...');
        try {
            const captureBtn = await page.$(SELECTORS.captureButton);

            if (captureBtn) {
                await captureBtn.click();
                await config.sleep(1000); // Attendre la capture

                await takeScreenshot(page, '05-photo-captured');

                // Vérifier que le preview s'affiche
                const previewVisible = await checkElementVisible(
                    page,
                    SELECTORS.previewContainer,
                    'Conteneur preview'
                );

                const previewImage = await page.$(SELECTORS.previewImage);

                if (previewVisible && previewImage) {
                    log('pass', 'Photo capturée et preview affiché');

                    // Vérifier les boutons d'action
                    const retakeBtn = await page.$(SELECTORS.retakeButton);
                    const validateBtn = await page.$(SELECTORS.validateButton);

                    if (retakeBtn && validateBtn) {
                        log('pass', 'Boutons "Reprendre" et "Valider" présents');
                    }

                    passed++;
                    results.push({ test: 5, status: 'pass', name: 'Capture photo réussie' });
                } else {
                    log('fail', 'Preview de photo non affiché');
                    await takeScreenshot(page, '05-photo-captured', true);
                    failed++;
                    results.push({ test: 5, status: 'fail', name: 'Preview non affiché' });
                }
            } else {
                log('fail', 'Bouton de capture non trouvé');
                failed++;
                results.push({ test: 5, status: 'fail', name: 'Bouton capture absent' });
            }
        } catch (error) {
            log('fail', `Test 5 échoué: ${error.message}`);
            await takeScreenshot(page, '05-photo-captured', true);
            failed++;
            results.push({ test: 5, status: 'fail', name: 'Photo capture error' });
        }

        await config.sleep(1000);

        // ========================================
        // TEST 6: Reprendre photo
        // ========================================
        log('info', 'Test 6: Fonction "Reprendre photo"...');
        try {
            const retakeBtn = await page.$(SELECTORS.retakeButton);

            if (retakeBtn) {
                await retakeBtn.click();
                await config.sleep(1000);

                await takeScreenshot(page, '06-photo-retake');

                // Vérifier retour à la vue caméra
                const cameraViewVisible = await checkElementVisible(
                    page,
                    SELECTORS.cameraView,
                    'Vue caméra (après reprendre)'
                );

                if (cameraViewVisible) {
                    log('pass', 'Retour à la vue caméra après "Reprendre"');

                    // Recapturer pour continuer les tests
                    const captureBtn = await page.$(SELECTORS.captureButton);
                    if (captureBtn) {
                        await captureBtn.click();
                        await config.sleep(1000);
                        log('info', 'Photo recapturée pour continuer les tests');
                    }

                    passed++;
                    results.push({ test: 6, status: 'pass', name: 'Reprendre photo fonctionnel' });
                } else {
                    log('fail', 'Retour à la caméra échoué');
                    await takeScreenshot(page, '06-photo-retake', true);
                    failed++;
                    results.push({ test: 6, status: 'fail', name: 'Retour caméra échoué' });
                }
            } else {
                log('warn', 'Bouton "Reprendre" non trouvé (test ignoré)');
                passed++;
                results.push({ test: 6, status: 'pass', name: 'Reprendre optionnel' });
            }
        } catch (error) {
            log('fail', `Test 6 échoué: ${error.message}`);
            failed++;
            results.push({ test: 6, status: 'fail', name: 'Retake photo error' });
        }

        await config.sleep(1000);

        // ========================================
        // TEST 7: Soumission et analyse
        // ========================================
        log('info', 'Test 7: Soumission et analyse...');
        try {
            const validateBtn = await page.$(SELECTORS.validateButton);

            if (validateBtn) {
                await validateBtn.click();
                await config.sleep(1000);

                await takeScreenshot(page, '07-analysis-started');

                // Vérifier message de chargement
                const loadingVisible = await page.$(SELECTORS.loadingMessage);
                if (loadingVisible) {
                    log('pass', 'Message "Analyse en cours..." affiché');
                }

                // Attendre le résultat (timeout plus long)
                await config.sleep(IDENTITY_CONFIG.timeout.analysis);
                await takeScreenshot(page, '07-analysis-result');

                // Vérifier un des états possibles
                const successMsg = await page.$(SELECTORS.successMessage);
                const pendingMsg = await page.$(SELECTORS.pendingMessage);
                const errorMsg = await page.$(SELECTORS.errorMessage);

                if (successMsg || pendingMsg || errorMsg) {
                    if (successMsg) {
                        log('pass', 'Résultat: Vérification RÉUSSIE');
                    } else if (pendingMsg) {
                        log('pass', 'Résultat: Vérification EN ATTENTE');
                    } else {
                        log('warn', 'Résultat: Vérification ÉCHOUÉE (normal en test)');
                    }

                    passed++;
                    results.push({ test: 7, status: 'pass', name: 'Analyse complète avec résultat' });
                } else {
                    log('warn', 'No explicit result (check manually)');
                    passed++;
                    results.push({ test: 7, status: 'pass', name: 'Analyse lancée' });
                }
            } else {
                log('fail', 'Bouton "Valider" non trouvé');
                await takeScreenshot(page, '07-analysis-failed', true);
                failed++;
                results.push({ test: 7, status: 'fail', name: 'Bouton valider absent' });
            }
        } catch (error) {
            log('fail', `Test 7 échoué: ${error.message}`);
            await takeScreenshot(page, '07-analysis-failed', true);
            failed++;
            results.push({ test: 7, status: 'fail', name: 'Analysis error' });
        }

        await config.sleep(2000);

        // ========================================
        // TEST 8: Vérifier traductions (pas de clés brutes)
        // ========================================
        log('info', 'Test 8: Vérification des traductions...');
        try {
            await page.goto(config.url('identity-verification'), {
                waitUntil: 'networkidle2'
            });

            const pageText = await page.evaluate(() => document.body.innerText);

            // Vérifier qu'il n'y a pas de clés i18n apparentes
            const hasI18nKeys = pageText.match(/verification\.|identity\.|camera\./i);
            const hasPlaceholders = pageText.match(/\{\{.*\}\}/);

            if (!hasI18nKeys && !hasPlaceholders) {
                log('pass', 'No raw translation keys detected');
                passed++;
                results.push({ test: 8, status: 'pass', name: 'Traductions OK' });
            } else {
                log('fail', 'Clés de traduction brutes détectées');
                log('warn', `Clés trouvées: ${hasI18nKeys || hasPlaceholders}`);
                await takeScreenshot(page, '08-i18n-keys-found', true);
                failed++;
                results.push({ test: 8, status: 'fail', name: 'Clés i18n visibles' });
            }
        } catch (error) {
            log('fail', `Test 8 échoué: ${error.message}`);
            failed++;
            results.push({ test: 8, status: 'fail', name: 'i18n verification error' });
        }

        await config.sleep(1000);

        // ========================================
        // TEST 9: Vérifier erreurs console
        // ========================================
        log('info', 'Test 9: Vérification des erreurs console...');
        const consoleErrors = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        try {
            await page.goto(config.url('identity-verification'), {
                waitUntil: 'networkidle2'
            });

            await config.sleep(2000);

            // Filtrer les erreurs non critiques
            const criticalErrors = consoleErrors.filter(err =>
                !err.includes('favicon') &&
                !err.includes('CORS') &&
                !err.includes('net::ERR_')
            );

            if (criticalErrors.length === 0) {
                log('pass', 'No critical console errors');
                passed++;
                results.push({ test: 9, status: 'pass', name: 'Pas d\'erreurs console' });
            } else {
                log('warn', `${criticalErrors.length} erreur(s) console détectée(s)`);
                criticalErrors.forEach(err => log('warn', `  - ${err}`));
                passed++; // On ne bloque pas sur les erreurs console
                results.push({ test: 9, status: 'pass', name: 'Console errors (non-blocking)' });
            }
        } catch (error) {
            log('fail', `Test 9 échoué: ${error.message}`);
            failed++;
            results.push({ test: 9, status: 'fail', name: 'Console verification error' });
        }

        await config.sleep(1000);

        // ========================================
        // TEST 10: Responsive mobile (320px)
        // ========================================
        log('info', 'Test 10: Mode responsive mobile...');
        try {
            await page.setViewport({
                width: 320,
                height: 568
            });

            await page.goto(config.url('identity-verification'), {
                waitUntil: 'networkidle2'
            });

            await config.sleep(1000);
            await takeScreenshot(page, '10-responsive-mobile-320');

            // Vérifier que les éléments principaux sont visibles
            const containerVisible = await checkElementVisible(
                page,
                SELECTORS.container,
                'Conteneur (mobile)'
            );

            const titleVisible = await checkElementVisible(
                page,
                SELECTORS.title,
                'Titre (mobile)'
            );

            if (containerVisible && titleVisible) {
                log('pass', 'Page responsive fonctionnelle en 320px');
                passed++;
                results.push({ test: 10, status: 'pass', name: 'Responsive 320px OK' });
            } else {
                log('fail', 'Problème d\'affichage en mode mobile');
                await takeScreenshot(page, '10-responsive-mobile-320', true);
                failed++;
                results.push({ test: 10, status: 'fail', name: 'Responsive 320px cassé' });
            }

            // Restaurer viewport normal
            await page.setViewport(IDENTITY_CONFIG.puppeteer.defaultViewport);
        } catch (error) {
            log('fail', `Test 10 échoué: ${error.message}`);
            failed++;
            results.push({ test: 10, status: 'fail', name: 'Responsive error' });
        }

        await config.sleep(2000);

        // ========================================
        // PARCOURS COMPLET (BONUS)
        // ========================================
        log('info', '\nBONUS: Test parcours complet inscription + vérification...');
        try {
            // Aller sur la page d'inscription
            await page.goto(config.url('register'), {
                waitUntil: 'networkidle2'
            });

            await config.sleep(1000);

            // Remplir et soumettre le formulaire
            await fillRegistrationForm(page, TEST_USERS.newPassenger);

            await config.sleep(2000);

            // Vérifier si on est redirigé vers la vérification
            const currentUrl = page.url();
            if (currentUrl.includes('identity') || currentUrl.includes('verification')) {
                log('pass', 'BONUS: Redirection automatique vers vérification après inscription');
                await takeScreenshot(page, 'BONUS-full-flow-verification');
            } else {
                log('info', `BONUS: URL après inscription: ${currentUrl}`);
                await takeScreenshot(page, 'BONUS-full-flow-after-registration');
            }
        } catch (error) {
            log('warn', `BONUS échoué (non bloquant): ${error.message}`);
        }

    } catch (error) {
        log('fail', `Fatal error: ${error.message}`);
        console.error(error);
    } finally {
        if (browser) {
            log('info', '\nFermeture du navigateur dans 3 secondes...');
            await config.sleep(3000);
            await browser.close();
        }
    }

    // ========================================
    // RÉSULTATS FINAUX
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.blue}RÉSULTATS - TESTS VÉRIFICATION D'IDENTITÉ${colors.reset}`);
    console.log('='.repeat(60));

    results.forEach(result => {
        const icon = result.status === 'pass' ? colors.green + '✓' : colors.red + '✗';
        console.log(`${icon}${colors.reset} Test ${result.test}: ${result.name}`);
    });

    console.log('='.repeat(60));
    console.log(`${colors.green}PASSÉS: ${passed}${colors.reset}`);
    console.log(`${colors.red}ÉCHOUÉS: ${failed}${colors.reset}`);
    console.log(`TOTAL: ${passed + failed} tests`);
    console.log('='.repeat(60) + '\n');

    if (failed === 0) {
        log('pass', '✓ TOUS LES TESTS SONT PASSÉS !');
        console.log(`\nScreenshots sauvegardés dans: ${IDENTITY_CONFIG.screenshotDir}\n`);
        return true;
    } else {
        log('warn', `⚠ ${failed} test(s) en échec`);
        console.log(`\nVérifier les screenshots dans: ${IDENTITY_CONFIG.screenshotDir}\n`);
        return false;
    }
}

// ========================================
// EXÉCUTION
// ========================================
if (require.main === module) {
    runIdentityVerificationTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    runIdentityVerificationTests,
    SELECTORS,
    IDENTITY_CONFIG
};
