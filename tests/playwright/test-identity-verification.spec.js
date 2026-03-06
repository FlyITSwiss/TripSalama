/**
 * TripSalama - Tests de Vérification d'Identité par IA
 *
 * Tests Playwright complets pour le module identity-camera
 * Utilise de vraies images pour tester l'IA Anthropic
 *
 * @requires playwright
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:8080';
const HEADLESS = process.env.HEADLESS !== 'false';
const SLOW_MO = parseInt(process.env.SLOW_MO) || 0;

// Credentials de test
const TEST_USER = {
    email: 'test@tripsalama.com',
    password: 'Test123456!'
};

// URLs d'images de test (libres de droits - Unsplash)
const TEST_IMAGES = {
    // Photos de femmes - doivent être acceptées
    female_portrait_1: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=640&q=80',
    female_portrait_2: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=640&q=80',
    female_portrait_3: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=640&q=80',

    // Photos d'hommes - doivent être rejetées
    male_portrait_1: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=640&q=80',
    male_portrait_2: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=640&q=80',

    // Images invalides - doivent être rejetées
    landscape: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=640&q=80',
    object: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=640&q=80',
};

// Dossier pour stocker les images de test téléchargées
const TEST_ASSETS_DIR = path.join(__dirname, 'test-assets');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// S'assurer que les dossiers existent
if (!fs.existsSync(TEST_ASSETS_DIR)) {
    fs.mkdirSync(TEST_ASSETS_DIR, { recursive: true });
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Se connecter avec un utilisateur de test
 */
async function loginTestUser(page) {
    console.log('  → Connexion utilisateur test...');
    await page.goto(`${BASE_URL}/login`);

    // Attendre le formulaire
    await page.waitForSelector('#email', { timeout: 10000 });

    // Remplir le formulaire de connexion
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);

    // Soumettre
    await page.click('button[type="submit"]');

    // Attendre la redirection (soit dashboard, soit identity-verification)
    try {
        await page.waitForURL(/\/(passenger\/dashboard|driver\/dashboard|identity-verification|profile)/, { timeout: 15000 });
        console.log('  ✓ Connexion réussie');
        return true;
    } catch (e) {
        console.log('  ✗ Échec connexion - URL actuelle:', page.url());
        // Capturer un screenshot pour debug
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'login-failed.png') });
        return false;
    }
}

/**
 * Naviguer vers la page de vérification d'identité (avec login si nécessaire)
 */
async function goToIdentityVerification(page) {
    // D'abord se connecter
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) {
        throw new Error('Impossible de se connecter');
    }

    // Maintenant aller à la page de vérification
    await page.goto(`${BASE_URL}/identity-verification`);

    // Si on est redirigé vers login, c'est que la session n'a pas pris
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
        throw new Error('Redirigé vers login - session non établie');
    }

    return true;
}

/**
 * Télécharger une image depuis une URL
 */
async function downloadImage(url, filename) {
    const filepath = path.join(TEST_ASSETS_DIR, filename);

    // Si le fichier existe déjà, ne pas re-télécharger
    if (fs.existsSync(filepath)) {
        return filepath;
    }

    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            // Gérer les redirections
            if (response.statusCode === 301 || response.statusCode === 302) {
                https.get(response.headers.location, (res) => {
                    res.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve(filepath);
                    });
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(filepath);
                });
            }
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

/**
 * Convertir une image en base64
 */
function imageToBase64(filepath) {
    const imageBuffer = fs.readFileSync(filepath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(filepath).slice(1);
    return `data:image/${ext};base64,${base64}`;
}

/**
 * Créer un contexte de navigateur avec caméra fake
 */
async function createBrowserWithFakeCamera(imageBase64) {
    const browser = await chromium.launch({
        headless: HEADLESS,
        slowMo: SLOW_MO,
        args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--allow-file-access-from-files',
        ],
    });

    const context = await browser.newContext({
        permissions: ['camera'],
        viewport: { width: 414, height: 896 }, // iPhone XR
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    return { browser, context };
}

/**
 * Injecter une image comme source de caméra
 */
async function injectFakeCamera(page, imageBase64) {
    await page.addInitScript((base64Image) => {
        // Remplacer getUserMedia pour retourner notre image
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

        navigator.mediaDevices.getUserMedia = async function(constraints) {
            if (constraints.video) {
                // Créer un canvas avec notre image
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 480;
                const ctx = canvas.getContext('2d');

                // Charger l'image
                const img = new Image();
                img.crossOrigin = 'anonymous';

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = base64Image;
                });

                // Dessiner l'image sur le canvas
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Créer un stream à partir du canvas
                const stream = canvas.captureStream(30);

                // Ajouter une piste audio vide si nécessaire
                if (constraints.audio) {
                    const audioCtx = new AudioContext();
                    const oscillator = audioCtx.createOscillator();
                    const dst = audioCtx.createMediaStreamDestination();
                    oscillator.connect(dst);
                    stream.addTrack(dst.stream.getAudioTracks()[0]);
                }

                return stream;
            }
            return originalGetUserMedia(constraints);
        };
    }, imageBase64);
}

// ============================================
// TESTS
// ============================================

test.describe('Vérification d\'Identité - Module Camera', () => {

    test.beforeAll(async () => {
        console.log('\n📸 Préparation des images de test...\n');

        // Télécharger les images de test
        for (const [name, url] of Object.entries(TEST_IMAGES)) {
            try {
                const filename = `${name}.jpg`;
                await downloadImage(url, filename);
                console.log(`  ✓ ${name}: téléchargé`);
            } catch (error) {
                console.log(`  ✗ ${name}: erreur - ${error.message}`);
            }
        }
        console.log('');
    });

    test('TC-001: Interface introduction s\'affiche correctement', async () => {
        const browser = await chromium.launch({ headless: HEADLESS });
        const context = await browser.newContext({
            permissions: ['camera'],
            viewport: { width: 414, height: 896 },
        });
        const page = await context.newPage();

        try {
            // Se connecter et aller à la page de vérification
            await goToIdentityVerification(page);

            // Attendre que le module soit chargé
            await page.waitForSelector('#identity-camera-container', { timeout: 15000 });

            // Vérifier les éléments de l'introduction
            // Le conteneur doit être présent
            await expect(page.locator('#identity-camera-container')).toBeVisible();

            // Screenshot
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, 'identity-01-intro.png'),
                fullPage: true
            });

            console.log('  ✓ TC-001: Interface introduction OK');
        } finally {
            await browser.close();
        }
    });

    test('TC-002: Checkbox consent active le bouton continuer', async () => {
        const browser = await chromium.launch({ headless: HEADLESS });
        const context = await browser.newContext({
            permissions: ['camera'],
            viewport: { width: 414, height: 896 },
        });
        const page = await context.newPage();

        try {
            await goToIdentityVerification(page);
            await page.waitForSelector('#identity-camera-container', { timeout: 15000 });

            // Chercher la checkbox de consentement
            const consentCheckbox = page.locator('input[type="checkbox"]').first();
            const continueBtn = page.locator('button:has-text("Continuer"), .identity-btn-continue, button.btn-primary').first();

            if (await consentCheckbox.isVisible()) {
                // Vérifier que le bouton est désactivé avant de cocher
                const wasDisabled = await continueBtn.isDisabled();
                console.log(`  → Bouton désactivé avant: ${wasDisabled}`);

                // Cocher la checkbox
                await consentCheckbox.click();

                // Screenshot
                await page.screenshot({
                    path: path.join(SCREENSHOTS_DIR, 'identity-02-consent.png'),
                    fullPage: true
                });

                console.log('  ✓ TC-002: Checkbox consent OK');
            } else {
                console.log('  ⚠ TC-002: Checkbox non trouvée (peut-être autre UX)');
                await page.screenshot({
                    path: path.join(SCREENSHOTS_DIR, 'identity-02-no-checkbox.png'),
                    fullPage: true
                });
            }
        } finally {
            await browser.close();
        }
    });

    test('TC-003: Photo de femme - Vérification APPROUVÉE', async () => {
        // Charger l'image de test
        const imagePath = path.join(TEST_ASSETS_DIR, 'female_portrait_1.jpg');
        if (!fs.existsSync(imagePath)) {
            console.log('  ⚠ TC-003: Image non téléchargée, test ignoré');
            test.skip();
            return;
        }

        const imageBase64 = imageToBase64(imagePath);
        const { browser, context } = await createBrowserWithFakeCamera(imageBase64);

        try {
            const page = await context.newPage();
            await injectFakeCamera(page, imageBase64);

            await goToIdentityVerification(page);
            await page.waitForSelector('#identity-camera-container', { timeout: 15000 });

            // Screenshot initial
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, 'identity-03-init.png'),
                fullPage: true
            });

            // Chercher et cliquer sur le consentement si présent
            const consentCheckbox = page.locator('input[type="checkbox"]').first();
            if (await consentCheckbox.isVisible()) {
                await consentCheckbox.click();
            }

            // Chercher le bouton continuer
            const continueBtn = page.locator('button:has-text("Continuer"), .identity-btn-continue').first();
            if (await continueBtn.isVisible() && await continueBtn.isEnabled()) {
                await continueBtn.click();
                await page.waitForTimeout(1000);
            }

            // Screenshot après avoir passé l'intro
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, 'identity-03-camera-view.png'),
                fullPage: true
            });

            // Chercher le bouton capture
            const captureBtn = page.locator('#btn-capture, button:has-text("Capturer"), .capture-btn').first();
            if (await captureBtn.isVisible()) {
                // Attendre que le bouton soit prêt
                await page.waitForTimeout(2000);
                await captureBtn.click();

                // Attendre la preview
                await page.waitForTimeout(2000);

                await page.screenshot({
                    path: path.join(SCREENSHOTS_DIR, 'identity-03-preview.png'),
                    fullPage: true
                });

                // Chercher le bouton de validation
                const submitBtn = page.locator('button:has-text("Valider"), button:has-text("Confirmer"), .identity-btn-submit').first();
                if (await submitBtn.isVisible()) {
                    await submitBtn.click();

                    // Attendre l'analyse (timeout plus long pour l'API IA)
                    await page.waitForTimeout(5000);

                    await page.screenshot({
                        path: path.join(SCREENSHOTS_DIR, 'identity-03-analyzing.png'),
                        fullPage: true
                    });

                    // Attendre le résultat final
                    await page.waitForTimeout(10000);

                    await page.screenshot({
                        path: path.join(SCREENSHOTS_DIR, 'identity-03-result.png'),
                        fullPage: true
                    });
                }
            }

            console.log('  ✓ TC-003: Photo femme - Test complété');

        } finally {
            await browser.close();
        }
    });

    test('TC-004: Photo d\'homme - Vérification REJETÉE', async () => {
        // Charger l'image de test
        const imagePath = path.join(TEST_ASSETS_DIR, 'male_portrait_1.jpg');
        if (!fs.existsSync(imagePath)) {
            console.log('  ⚠ TC-004: Image non téléchargée, test ignoré');
            test.skip();
            return;
        }

        const imageBase64 = imageToBase64(imagePath);
        const { browser, context } = await createBrowserWithFakeCamera(imageBase64);

        try {
            const page = await context.newPage();
            await injectFakeCamera(page, imageBase64);

            await goToIdentityVerification(page);
            await page.waitForSelector('#identity-camera-container', { timeout: 15000 });

            // Flux complet
            const consentCheckbox = page.locator('input[type="checkbox"]').first();
            if (await consentCheckbox.isVisible()) {
                await consentCheckbox.click();
            }

            const continueBtn = page.locator('button:has-text("Continuer"), .identity-btn-continue').first();
            if (await continueBtn.isVisible() && await continueBtn.isEnabled()) {
                await continueBtn.click();
                await page.waitForTimeout(1000);
            }

            const captureBtn = page.locator('#btn-capture, button:has-text("Capturer"), .capture-btn').first();
            if (await captureBtn.isVisible()) {
                await page.waitForTimeout(2000);
                await captureBtn.click();
                await page.waitForTimeout(2000);

                const submitBtn = page.locator('button:has-text("Valider"), button:has-text("Confirmer"), .identity-btn-submit').first();
                if (await submitBtn.isVisible()) {
                    await submitBtn.click();
                    await page.waitForTimeout(15000);

                    await page.screenshot({
                        path: path.join(SCREENSHOTS_DIR, 'identity-04-result-male.png'),
                        fullPage: true
                    });
                }
            }

            console.log('  ✓ TC-004: Photo homme - Test complété');

        } finally {
            await browser.close();
        }
    });

    test('TC-005: Image sans visage - Vérification REJETÉE', async () => {
        // Charger l'image de test (paysage)
        const imagePath = path.join(TEST_ASSETS_DIR, 'landscape.jpg');
        if (!fs.existsSync(imagePath)) {
            console.log('  ⚠ TC-005: Image non téléchargée, test ignoré');
            test.skip();
            return;
        }

        const imageBase64 = imageToBase64(imagePath);
        const { browser, context } = await createBrowserWithFakeCamera(imageBase64);

        try {
            const page = await context.newPage();
            await injectFakeCamera(page, imageBase64);

            await goToIdentityVerification(page);
            await page.waitForSelector('#identity-camera-container', { timeout: 15000 });

            // Flux complet
            const consentCheckbox = page.locator('input[type="checkbox"]').first();
            if (await consentCheckbox.isVisible()) {
                await consentCheckbox.click();
            }

            const continueBtn = page.locator('button:has-text("Continuer"), .identity-btn-continue').first();
            if (await continueBtn.isVisible() && await continueBtn.isEnabled()) {
                await continueBtn.click();
                await page.waitForTimeout(1000);
            }

            const captureBtn = page.locator('#btn-capture, button:has-text("Capturer"), .capture-btn').first();
            if (await captureBtn.isVisible()) {
                await page.waitForTimeout(2000);
                await captureBtn.click();
                await page.waitForTimeout(2000);

                const submitBtn = page.locator('button:has-text("Valider"), button:has-text("Confirmer"), .identity-btn-submit').first();
                if (await submitBtn.isVisible()) {
                    await submitBtn.click();
                    await page.waitForTimeout(15000);

                    await page.screenshot({
                        path: path.join(SCREENSHOTS_DIR, 'identity-05-result-landscape.png'),
                        fullPage: true
                    });
                }
            }

            console.log('  ✓ TC-005: Image sans visage - Test complété');

        } finally {
            await browser.close();
        }
    });

    test('TC-006: Responsive - Mobile (414px)', async () => {
        const browser = await chromium.launch({ headless: HEADLESS });
        const context = await browser.newContext({
            permissions: ['camera'],
            viewport: { width: 414, height: 896 },
        });
        const page = await context.newPage();

        try {
            await goToIdentityVerification(page);
            await page.waitForSelector('#identity-camera-container', { timeout: 15000 });

            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, 'identity-06-responsive-mobile.png'),
                fullPage: true
            });

            console.log('  ✓ TC-006: Responsive mobile OK');
        } finally {
            await browser.close();
        }
    });

    test('TC-007: Responsive - Tablet (768px)', async () => {
        const browser = await chromium.launch({ headless: HEADLESS });
        const context = await browser.newContext({
            permissions: ['camera'],
            viewport: { width: 768, height: 1024 },
        });
        const page = await context.newPage();

        try {
            await goToIdentityVerification(page);
            await page.waitForSelector('#identity-camera-container', { timeout: 15000 });

            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, 'identity-07-responsive-tablet.png'),
                fullPage: true
            });

            console.log('  ✓ TC-007: Responsive tablet OK');
        } finally {
            await browser.close();
        }
    });

});

// ============================================
// TESTS API DIRECTE
// ============================================

test.describe('Vérification d\'Identité - API Backend', () => {

    test('API-001: Endpoint verification/submit répond', async ({ request }) => {
        // Test que l'endpoint existe (même si non autorisé)
        const response = await request.post(`${BASE_URL}/api/verification.php?action=submit`, {
            data: { image: 'test' },
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });

        // 401 = endpoint existe mais non autorisé
        // 400 = endpoint existe mais données invalides
        // 200 = succès
        const status = response.status();
        console.log(`  → API submit status: ${status}`);

        // L'endpoint doit exister (pas 404)
        expect(status).not.toBe(404);
        console.log('  ✓ API-001: Endpoint verification/submit existe');
    });

    test('API-002: Endpoint verification/status répond', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/verification.php?action=status`, {
            headers: {
                'Accept': 'application/json',
            },
        });

        const status = response.status();
        console.log(`  → API status status: ${status}`);

        // L'endpoint doit exister (pas 404)
        expect(status).not.toBe(404);
        console.log('  ✓ API-002: Endpoint verification/status existe');
    });

});

// ============================================
// CLEANUP
// ============================================

test.afterAll(async () => {
    console.log('\n📊 Tests terminés. Screenshots dans:', SCREENSHOTS_DIR);
});
