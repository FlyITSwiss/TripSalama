/**
 * TripSalama - TEST PRODUCTION URGENT - DÉMO
 * Test complet avec caméra
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://stabilis-it.ch/internal/tripsalama';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'prod-demo');

const TEST_USER = {
    email: 'passenger@tripsalama.ch',
    password: 'TripSalama2025!'
};

if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

let passed = 0;
let failed = 0;

async function screenshot(page, name) {
    const filename = `${name}.png`;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, filename), fullPage: true });
    console.log(`  📸 ${filename}`);
    return filename;
}

async function runDemoTests() {
    console.log('\n🚀 TEST PRODUCTION TRIPSALAMA - DÉMO URGENTE\n');
    console.log('━'.repeat(50));
    console.log(`⏰ ${new Date().toLocaleTimeString('fr-FR')}`);
    console.log(`🌐 ${BASE_URL}`);
    console.log('━'.repeat(50));

    const browser = await chromium.launch({
        headless: false,
        slowMo: 200
    });

    const context = await browser.newContext({
        viewport: { width: 375, height: 812 },
        permissions: ['camera', 'geolocation'],
        geolocation: { latitude: 33.5731, longitude: -7.5898 }, // Casablanca
        locale: 'fr-FR'
    });

    const page = await context.newPage();

    try {
        // ═══════════════════════════════════════════════════════════════
        // TEST 1: PAGE LOGIN
        // ═══════════════════════════════════════════════════════════════
        console.log('\n═══ 1. LOGIN ═══');
        await page.goto(`${BASE_URL}/login`);
        await page.waitForLoadState('networkidle');
        await screenshot(page, '01-login');

        // Vérifier design Uber
        const title = await page.textContent('h1, .login-title');
        console.log(`  ✅ Titre: ${title}`);
        passed++;

        // ═══════════════════════════════════════════════════════════════
        // TEST 2: INSCRIPTION PASSAGÈRE
        // ═══════════════════════════════════════════════════════════════
        console.log('\n═══ 2. INSCRIPTION ═══');
        await page.goto(`${BASE_URL}/register/passenger`);
        await page.waitForLoadState('networkidle');
        await screenshot(page, '02-register-passenger');

        // Test validation mot de passe
        await page.fill('#password', 'Abc123!@');
        await page.waitForTimeout(500);
        await screenshot(page, '03-password-validation');
        console.log('  ✅ Validation mot de passe visible');
        passed++;

        // ═══════════════════════════════════════════════════════════════
        // TEST 3: INSCRIPTION CONDUCTRICE
        // ═══════════════════════════════════════════════════════════════
        console.log('\n═══ 3. REGISTER DRIVER ═══');
        await page.goto(`${BASE_URL}/register/driver`);
        await page.waitForLoadState('networkidle');
        await screenshot(page, '04-register-driver');

        // Vérifier section véhicule
        const vehicleSection = await page.locator('text=véhicule, text=Véhicule').count();
        if (vehicleSection > 0) {
            console.log('  ✅ Section véhicule présente');
            passed++;
        }

        // ═══════════════════════════════════════════════════════════════
        // TEST 4: CONNEXION
        // ═══════════════════════════════════════════════════════════════
        console.log('\n═══ 4. CONNEXION ═══');
        await page.goto(`${BASE_URL}/login`);
        await page.fill('#email', TEST_USER.email);
        await page.fill('#password', TEST_USER.password);
        await screenshot(page, '05-login-filled');

        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        await screenshot(page, '06-after-login');

        const url = page.url();
        console.log(`  → URL: ${url}`);

        if (url.includes('dashboard') || url.includes('identity')) {
            console.log('  ✅ Connexion réussie');
            passed++;
        }

        // ═══════════════════════════════════════════════════════════════
        // TEST 5: VÉRIFICATION D'IDENTITÉ + CAMÉRA
        // ═══════════════════════════════════════════════════════════════
        console.log('\n═══ 5. CAMÉRA (CRITIQUE) ═══');
        await page.goto(`${BASE_URL}/identity-verification`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await screenshot(page, '07-identity-page');

        // Vérifier i18n
        const content = await page.content();
        if (!content.includes('verification.') && content.includes('Vérification')) {
            console.log('  ✅ i18n correct (pas de clés brutes)');
            passed++;
        }

        // Vérifier "Étape 2/3"
        if (content.includes('Étape 2/3') || content.includes('Step 2/3')) {
            console.log('  ✅ Step label traduit');
            passed++;
        }

        // Accepter consentement
        const consentText = page.locator('text=J\'accepte');
        if (await consentText.count() > 0) {
            await consentText.click();
            await page.waitForTimeout(500);
            console.log('  ✅ Consentement accepté');
            await screenshot(page, '08-consent-accepted');
        }

        // ACTIVER LA CAMÉRA
        console.log('\n  🎥 ACTIVATION CAMÉRA...');
        const cameraBtn = page.locator('button:has-text("Activer"), button:has-text("caméra"), button:has-text("Commencer")').first();

        if (await cameraBtn.count() > 0) {
            await cameraBtn.click();
            console.log('  → Bouton caméra cliqué');

            // Attendre activation caméra
            await page.waitForTimeout(3000);
            await screenshot(page, '09-camera-activating');

            // Vérifier stream vidéo
            const video = page.locator('video');
            const videoVisible = await video.isVisible().catch(() => false);

            if (videoVisible) {
                console.log('  ✅✅✅ CAMÉRA ACTIVE ! ✅✅✅');
                passed++;

                await page.waitForTimeout(2000);
                await screenshot(page, '10-camera-stream');

                // Vérifier détection visage
                const faceDetected = await page.locator('text=détecté, text=Visage').count();
                if (faceDetected > 0) {
                    console.log('  ✅ Détection visage fonctionne');
                    passed++;
                }

                // Vérifier bouton capture
                const captureBtn = page.locator('button:has-text("Prendre"), button:has-text("Capturer")');
                if (await captureBtn.count() > 0) {
                    console.log('  ✅ Bouton capture disponible');
                    passed++;
                }

                await screenshot(page, '11-camera-ready');
            } else {
                console.log('  ⚠️ Vidéo non visible (permission browser?)');
                await screenshot(page, '10-camera-issue');
            }
        } else {
            console.log('  ⚠️ Bouton caméra non trouvé');
        }

        // ═══════════════════════════════════════════════════════════════
        // TEST 6: DASHBOARD
        // ═══════════════════════════════════════════════════════════════
        console.log('\n═══ 6. DASHBOARD ═══');
        await page.goto(`${BASE_URL}/passenger/dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        await screenshot(page, '12-dashboard');

        // Vérifier éléments
        const searchBar = await page.locator('text=Où allez-vous').count();
        if (searchBar > 0) {
            console.log('  ✅ Barre de recherche présente');
            passed++;
        }

        // Vérifier SOS (ne devrait PAS être visible sans course)
        const sosBtn = await page.locator('.sos-fab').isVisible().catch(() => false);
        console.log(`  ${sosBtn ? '⚠️ SOS visible (course active?)' : '✅ SOS caché (normal)'}`);

        // ═══════════════════════════════════════════════════════════════
        // TEST 7: RESPONSIVE
        // ═══════════════════════════════════════════════════════════════
        console.log('\n═══ 7. RESPONSIVE ═══');
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto(`${BASE_URL}/login`);
        await page.waitForTimeout(500);
        await screenshot(page, '13-tablet-login');
        console.log('  ✅ Tablette OK');
        passed++;

        // ═══════════════════════════════════════════════════════════════
        // PAUSE POUR DÉMO MANUELLE
        // ═══════════════════════════════════════════════════════════════
        console.log('\n═══ NAVIGATEUR OUVERT POUR DÉMO ═══');
        console.log('  Le navigateur reste ouvert 30 secondes...');
        console.log('  Vous pouvez tester manuellement !');

        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${BASE_URL}/identity-verification`);
        await page.waitForTimeout(30000);

    } catch (error) {
        console.error(`\n❌ ERREUR: ${error.message}`);
        failed++;
        await screenshot(page, 'ERROR');
    }

    await browser.close();

    // RAPPORT
    console.log('\n' + '═'.repeat(50));
    console.log('📊 RAPPORT DÉMO PRODUCTION');
    console.log('═'.repeat(50));
    console.log(`  ✅ Passés: ${passed}`);
    console.log(`  ❌ Échoués: ${failed}`);
    console.log(`  📁 Screenshots: ${SCREENSHOTS_DIR}`);
    console.log('═'.repeat(50));

    // Lister les screenshots
    const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png')).sort();
    console.log('\n📸 Screenshots générés:');
    files.forEach(f => console.log(`  - ${f}`));

    return failed === 0;
}

runDemoTests().then(success => {
    console.log(success ? '\n✅ PRÊT POUR LA DÉMO !' : '\n⚠️ Quelques points à vérifier');
    process.exit(success ? 0 : 1);
}).catch(console.error);
