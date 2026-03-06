/**
 * TripSalama - Test d'activation de la caméra pour vérification d'identité
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:8080';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'camera-test');

const TEST_USER = {
    email: 'test@tripsalama.com',
    password: 'Test123456!'
};

if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function testCameraActivation() {
    console.log('\n📷 Test d\'activation de la caméra\n');
    console.log('━'.repeat(50));

    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });

    const context = await browser.newContext({
        viewport: { width: 375, height: 812 },
        permissions: ['camera']  // Auto-grant camera permission
    });

    const page = await context.newPage();

    try {
        // 1. Login
        console.log('→ Connexion...');
        await page.goto(`${BASE_URL}/login`);
        await page.fill('#email', TEST_USER.email);
        await page.fill('#password', TEST_USER.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
        console.log('✅ Connecté');

        // 2. Aller à la page de vérification
        console.log('→ Page de vérification d\'identité...');
        await page.goto(`${BASE_URL}/identity-verification`);
        await page.waitForTimeout(2000);
        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, '01-identity-page.png'),
            fullPage: true
        });
        console.log('✅ Page chargée');

        // 3. Accepter le consentement (cliquer sur le label, pas l'input caché)
        console.log('→ Acceptation du consentement...');
        const consentLabel = page.locator('text=J\'accepte que ma photo').first();
        if (await consentLabel.count() > 0) {
            await consentLabel.click();
            await page.waitForTimeout(500);
            console.log('✅ Consentement accepté');
        } else {
            // Alternative: cliquer sur le conteneur du checkbox
            const consentContainer = page.locator('.consent-checkbox, .identity-consent, label:has(input[type="checkbox"])').first();
            if (await consentContainer.count() > 0) {
                await consentContainer.click();
                await page.waitForTimeout(500);
                console.log('✅ Consentement accepté (via conteneur)');
            }
        }

        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, '02-consent-accepted.png'),
            fullPage: true
        });

        // 4. Cliquer sur "Activer la caméra"
        console.log('→ Activation de la caméra...');
        const cameraBtn = page.locator('button:has-text("Activer la caméra"), button:has-text("camera"), button:has-text("Commencer")').first();

        if (await cameraBtn.count() > 0) {
            await cameraBtn.click();
            console.log('✅ Bouton caméra cliqué');

            // Attendre que la caméra s'active
            await page.waitForTimeout(3000);

            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, '03-camera-activated.png'),
                fullPage: true
            });

            // Vérifier si le stream vidéo est visible
            const videoElement = page.locator('video');
            const videoVisible = await videoElement.isVisible().catch(() => false);

            if (videoVisible) {
                console.log('✅ Stream vidéo actif !');

                // Attendre un peu plus pour voir la vidéo
                await page.waitForTimeout(2000);
                await page.screenshot({
                    path: path.join(SCREENSHOTS_DIR, '04-video-stream.png'),
                    fullPage: true
                });

                // Chercher le bouton de capture
                const captureBtn = page.locator('button:has-text("Prendre"), button:has-text("Capturer"), button:has-text("Photo")').first();
                if (await captureBtn.count() > 0) {
                    console.log('✅ Bouton de capture disponible');
                }
            } else {
                console.log('⚠️ Stream vidéo non visible - Vérifiez manuellement');
            }
        } else {
            console.log('⚠️ Bouton caméra non trouvé');
        }

        // 5. Pause pour inspection visuelle
        console.log('\n🔍 Inspection visuelle en cours...');
        console.log('   Le navigateur reste ouvert 10 secondes pour vérification');
        await page.waitForTimeout(10000);

    } catch (error) {
        console.error(`\n❌ Erreur: ${error.message}`);
        await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, 'error.png'),
            fullPage: true
        });
    }

    await browser.close();

    console.log('\n' + '━'.repeat(50));
    console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}`);

    const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    files.forEach(f => console.log(`  - ${f}`));
}

testCameraActivation().catch(console.error);
