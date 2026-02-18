/**
 * TripSalama - Test Puppeteer pour Identity Camera
 * Test E2E du composant de vérification d'identité
 *
 * @requires puppeteer
 */

const puppeteer = require('puppeteer');

// Configuration
const CONFIG = {
    baseUrl: 'http://127.0.0.1:8080',
    headless: false,
    slowMo: 50,
    defaultViewport: {
        width: 420,
        height: 900,
        deviceScaleFactor: 2
    },
    screenshotsDir: './screenshots/identity-camera'
};

// Utilitaires
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const log = (message, ...args) => {
    console.log(`[${new Date().toISOString()}] ${message}`, ...args);
};

const error = (message, ...args) => {
    console.error(`[${new Date().toISOString()}] ❌ ${message}`, ...args);
};

const success = (message, ...args) => {
    console.log(`[${new Date().toISOString()}] ✅ ${message}`, ...args);
};

/**
 * Test principal
 */
async function runTests() {
    let browser;
    let page;
    let screenshotCounter = 1;

    try {
        log('Démarrage du test Identity Camera...');

        // Lancer le navigateur
        browser = await puppeteer.launch({
            headless: CONFIG.headless,
            slowMo: CONFIG.slowMo,
            defaultViewport: CONFIG.defaultViewport,
            args: [
                '--use-fake-ui-for-media-stream', // Simuler autorisation caméra
                '--use-fake-device-for-media-stream', // Utiliser fausse caméra
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        page = await browser.newPage();

        // Activer console logs
        page.on('console', msg => {
            const type = msg.type();
            if (type === 'error') {
                error(`Console Error: ${msg.text()}`);
            } else if (type === 'warning') {
                log(`Console Warning: ${msg.text()}`);
            } else {
                log(`Console: ${msg.text()}`);
            }
        });

        // Capturer les erreurs de page
        page.on('pageerror', err => {
            error('Page Error:', err.message);
        });

        // Helper screenshot
        const screenshot = async (name) => {
            const filename = `${String(screenshotCounter).padStart(2, '0')}-${name}.png`;
            await page.screenshot({
                path: `${CONFIG.screenshotsDir}/${filename}`,
                fullPage: true
            });
            log(`Screenshot: ${filename}`);
            screenshotCounter++;
        };

        // ==========================================
        // TEST 1: Chargement de la page
        // ==========================================
        log('\n[TEST 1] Chargement de la page démo...');

        await page.goto(`${CONFIG.baseUrl}/demo-identity-camera.html`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await wait(2000); // Attendre chargement i18n

        await screenshot('01-page-loaded');
        success('Page chargée avec succès');

        // ==========================================
        // TEST 2: Vérifier présence du composant
        // ==========================================
        log('\n[TEST 2] Vérification de la présence du composant...');

        const container = await page.$('.identity-camera-container');
        if (!container) {
            throw new Error('Container du composant non trouvé');
        }

        const intro = await page.$('.identity-intro');
        if (!intro) {
            throw new Error('Étape intro non trouvée');
        }

        await screenshot('02-component-visible');
        success('Composant affiché correctement');

        // ==========================================
        // TEST 3: Vérifier textes i18n
        // ==========================================
        log('\n[TEST 3] Vérification des textes i18n...');

        const title = await page.$eval('.identity-title', el => el.textContent);
        log(`Titre: "${title}"`);

        if (title === 'verification.title') {
            throw new Error('Traduction i18n non chargée (clé brute affichée)');
        }

        const tips = await page.$$eval('.tip-item', items => items.map(el => el.textContent.trim()));
        log(`Tips: ${tips.length} éléments`);

        if (tips.length !== 4) {
            throw new Error(`Attendu 4 tips, trouvé ${tips.length}`);
        }

        success('Textes i18n chargés correctement');

        // ==========================================
        // TEST 4: Checkbox consentement
        // ==========================================
        log('\n[TEST 4] Test checkbox consentement...');

        const checkbox = await page.$('#identity-consent-checkbox');
        const continueBtn = await page.$('.identity-btn-continue');

        // Vérifier que le bouton est disabled
        const isDisabled = await continueBtn.evaluate(el => el.disabled);
        if (!isDisabled) {
            throw new Error('Bouton devrait être disabled initialement');
        }

        // Cocher la checkbox
        await checkbox.click();
        await wait(500);

        await screenshot('03-consent-checked');

        // Vérifier que le bouton est maintenant enabled
        const isNowEnabled = await continueBtn.evaluate(el => !el.disabled);
        if (!isNowEnabled) {
            throw new Error('Bouton devrait être enabled après consentement');
        }

        success('Checkbox consentement fonctionne');

        // ==========================================
        // TEST 5: Passage à l'étape caméra
        // ==========================================
        log('\n[TEST 5] Clic sur "Continuer" et chargement face-api...');

        await continueBtn.click();
        await wait(5000); // Temps pour charger face-api.js + modèles

        await screenshot('04-loading-camera');

        // Attendre que l'étape caméra soit visible
        await page.waitForSelector('.identity-camera-view:not(.hidden)', {
            timeout: 10000
        });

        await wait(2000);

        await screenshot('05-camera-view');
        success('Transition vers vue caméra réussie');

        // ==========================================
        // TEST 6: Vérifier flux vidéo
        // ==========================================
        log('\n[TEST 6] Vérification du flux vidéo...');

        const video = await page.$('.identity-video');
        if (!video) {
            throw new Error('Élément vidéo non trouvé');
        }

        // Vérifier que la vidéo est active
        const videoReady = await video.evaluate(v => {
            return v.readyState >= 2; // HAVE_CURRENT_DATA
        });

        if (!videoReady) {
            throw new Error('Flux vidéo non actif');
        }

        success('Flux vidéo actif');

        // ==========================================
        // TEST 7: Guide visage visible
        // ==========================================
        log('\n[TEST 7] Vérification du guide visage...');

        const faceGuide = await page.$('.identity-face-guide');
        if (!faceGuide) {
            throw new Error('Guide visage non trouvé');
        }

        const guideVisible = await faceGuide.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.opacity !== '0';
        });

        if (!guideVisible) {
            throw new Error('Guide visage non visible');
        }

        success('Guide visage affiché');

        // ==========================================
        // TEST 8: Capture photo
        // ==========================================
        log('\n[TEST 8] Capture de la photo...');

        await wait(2000); // Laisser la détection tourner

        const captureBtn = await page.$('.identity-btn-capture');
        await captureBtn.click();

        await wait(1000);

        await screenshot('06-photo-captured');

        // Vérifier que l'étape preview est affichée
        await page.waitForSelector('.identity-preview:not(.hidden)', {
            timeout: 5000
        });

        success('Photo capturée et preview affichée');

        // ==========================================
        // TEST 9: Vérifier preview image
        // ==========================================
        log('\n[TEST 9] Vérification de l\'image de preview...');

        const previewImg = await page.$('.preview-image');
        const imgSrc = await previewImg.evaluate(img => img.src);

        if (!imgSrc.startsWith('data:image/jpeg')) {
            throw new Error('Image preview n\'est pas un data URL JPEG');
        }

        await screenshot('07-preview-visible');
        success('Image de preview valide');

        // ==========================================
        // TEST 10: Tester bouton "Reprendre"
        // ==========================================
        log('\n[TEST 10] Test bouton "Reprendre"...');

        const retakeBtn = await page.$('.identity-btn-retake');
        await retakeBtn.click();

        await wait(1000);

        // Vérifier retour à la vue caméra
        const backToCamera = await page.$('.identity-camera-view:not(.hidden)');
        if (!backToCamera) {
            throw new Error('Retour à la vue caméra échoué');
        }

        await screenshot('08-back-to-camera');
        success('Bouton "Reprendre" fonctionne');

        // ==========================================
        // TEST 11: Re-capturer et soumettre
        // ==========================================
        log('\n[TEST 11] Re-capture et soumission...');

        await wait(2000);

        await captureBtn.click();
        await wait(1000);

        await page.waitForSelector('.identity-preview:not(.hidden)');

        const submitBtn = await page.$('.identity-btn-submit');
        await submitBtn.click();

        await screenshot('09-submitting');

        // Attendre l'étape analyzing
        await page.waitForSelector('.identity-analyzing:not(.hidden)', {
            timeout: 5000
        });

        await screenshot('10-analyzing');
        success('Étape "Analyzing" affichée');

        // ==========================================
        // TEST 12: Vérifier résultat
        // ==========================================
        log('\n[TEST 12] Vérification du résultat...');

        // Attendre le résultat (avec timeout généreux pour face-api)
        await page.waitForSelector('.identity-result:not(.hidden)', {
            timeout: 15000
        });

        await wait(2000);

        await screenshot('11-result-displayed');

        // Vérifier le contenu du résultat
        const resultIcon = await page.$('.identity-result-icon');
        const resultTitle = await page.$eval('.identity-result-title', el => el.textContent);
        const resultMessage = await page.$eval('.identity-result-message', el => el.textContent);

        log(`Résultat: ${resultTitle}`);
        log(`Message: ${resultMessage}`);

        if (!resultIcon) {
            throw new Error('Icône de résultat non trouvée');
        }

        success('Résultat affiché avec succès');

        // ==========================================
        // TEST 13: Vérifier styles CSS (Design System)
        // ==========================================
        log('\n[TEST 13] Vérification du Design System...');

        // Vérifier que les variables CSS sont utilisées
        const containerStyle = await page.$eval('.identity-camera-container', el => {
            const style = window.getComputedStyle(el);
            return {
                padding: style.padding,
                borderRadius: style.borderRadius
            };
        });

        log(`Container padding: ${containerStyle.padding}`);
        log(`Container border-radius: ${containerStyle.borderRadius}`);

        // Vérifier couleurs
        const primaryColor = await page.evaluate(() => {
            return getComputedStyle(document.documentElement)
                .getPropertyValue('--color-primary').trim();
        });

        log(`Couleur primaire: ${primaryColor}`);

        if (!primaryColor || primaryColor === '') {
            throw new Error('Variables CSS du Design System non chargées');
        }

        success('Design System φ appliqué correctement');

        // ==========================================
        // SUCCÈS GLOBAL
        // ==========================================
        await screenshot('12-final-state');

        success('\n✅ ========================================');
        success('✅ TOUS LES TESTS SONT PASSÉS !');
        success('✅ ========================================\n');

        log(`Screenshots sauvegardés dans: ${CONFIG.screenshotsDir}`);

    } catch (err) {
        error('\n❌ ========================================');
        error('❌ TEST FAILED');
        error('❌ ========================================\n');
        error('Error:', err.message);
        error('Stack:', err.stack);

        // Screenshot de l'échec
        if (page) {
            try {
                await page.screenshot({
                    path: `${CONFIG.screenshotsDir}/ERROR-${Date.now()}.png`,
                    fullPage: true
                });
            } catch (screenshotErr) {
                error('Impossible de capturer screenshot d\'erreur:', screenshotErr.message);
            }
        }

        process.exit(1);

    } finally {
        if (browser) {
            if (!CONFIG.headless) {
                log('\nAppuyez sur Entrée pour fermer le navigateur...');
                await new Promise(resolve => {
                    process.stdin.once('data', resolve);
                });
            }

            await browser.close();
            log('Navigateur fermé');
        }
    }
}

// Créer le dossier screenshots si nécessaire
const fs = require('fs');
const path = require('path');

const screenshotsPath = path.resolve(__dirname, CONFIG.screenshotsDir);
if (!fs.existsSync(screenshotsPath)) {
    fs.mkdirSync(screenshotsPath, { recursive: true });
    log(`Dossier créé: ${screenshotsPath}`);
}

// Exécuter les tests
runTests().catch(err => {
    error('Uncaught error:', err);
    process.exit(1);
});
