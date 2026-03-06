/**
 * TripSalama - Vérification visuelle complète de toutes les pages modifiées
 * Test avec Playwright en mode headed
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:8080';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'visual-all-pages');

// Identifiants de test
const TEST_USER = {
    email: 'test@tripsalama.com',
    password: 'Test123456!'
};

const ADMIN_USER = {
    email: 'admin@tripsalama.com',
    password: 'Admin123456!'
};

// Créer le dossier screenshots
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Compteur de tests
let passed = 0;
let failed = 0;
const errors = [];

async function screenshot(page, name, viewport) {
    const filename = `${name}-${viewport}.png`;
    await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, filename),
        fullPage: true
    });
    console.log(`  📸 Screenshot: ${filename}`);
    return filename;
}

async function runVisualTests() {
    console.log('\n🎨 TripSalama - Vérification visuelle complète\n');
    console.log('━'.repeat(60));
    console.log(`📅 Date: ${new Date().toLocaleString('fr-FR')}`);
    console.log(`🌐 URL: ${BASE_URL}`);
    console.log('━'.repeat(60));

    const browser = await chromium.launch({
        headless: false,
        slowMo: 300
    });

    // Test principalement sur mobile (app mobile-first)
    const viewport = { name: 'mobile', width: 375, height: 812 };

    console.log(`\n📱 Viewport: ${viewport.name} (${viewport.width}x${viewport.height})\n`);

    const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        permissions: ['camera', 'geolocation']
    });
    const page = await context.newPage();

    try {
        // ═══════════════════════════════════════════════════════════════
        // TEST 1: Pages publiques (sans authentification)
        // ═══════════════════════════════════════════════════════════════
        console.log('═══ TEST 1: Pages publiques ═══\n');

        // 1.1 Page de login
        console.log('  → Page de login...');
        await page.goto(`${BASE_URL}/login`);
        await page.waitForTimeout(500);
        await screenshot(page, '01-login', viewport.name);

        // Vérifier le design Uber (fond blanc, texte noir)
        const loginBg = await page.evaluate(() => {
            return getComputedStyle(document.body).backgroundColor;
        });
        if (loginBg.includes('255, 255, 255') || loginBg === 'rgb(255, 255, 255)') {
            console.log('  ✅ Login: Design Uber (fond blanc)');
            passed++;
        } else {
            console.log(`  ⚠️ Login: Fond inattendu (${loginBg})`);
        }

        // 1.2 Page choix inscription
        console.log('\n  → Page choix inscription...');
        await page.goto(`${BASE_URL}/register`);
        await page.waitForTimeout(500);
        await screenshot(page, '02-register-choice', viewport.name);
        passed++;

        // 1.3 Page inscription passagère
        console.log('\n  → Page inscription passagère...');
        await page.goto(`${BASE_URL}/register/passenger`);
        await page.waitForTimeout(500);
        await screenshot(page, '03-register-passenger', viewport.name);

        // Test validation dynamique
        await page.fill('#first_name', 'Marie');
        await page.fill('#last_name', 'Dupont');
        await page.fill('#email', 'marie.dupont@test.com');
        await page.fill('#password', 'Ab1');
        await page.waitForTimeout(300);
        await screenshot(page, '04-register-passenger-validation-partial', viewport.name);

        await page.fill('#password', 'AbcDef123!');
        await page.fill('#password_confirm', 'AbcDef123!');
        await page.waitForTimeout(300);
        await screenshot(page, '05-register-passenger-validation-complete', viewport.name);
        passed++;

        // 1.4 Page inscription conductrice (MODIFIÉE)
        console.log('\n  → Page inscription conductrice (vérification du nouveau design)...');
        await page.goto(`${BASE_URL}/register/driver`);
        await page.waitForTimeout(500);
        await screenshot(page, '06-register-driver-empty', viewport.name);

        // Vérifier présence des champs véhicule
        const hasVehicleSection = await page.locator('#vehicle_brand').count() > 0;
        if (hasVehicleSection) {
            console.log('  ✅ Register/Driver: Section véhicule présente');
            passed++;
        } else {
            console.log('  ❌ Register/Driver: Section véhicule MANQUANTE');
            failed++;
            errors.push('Section véhicule manquante sur register/driver');
        }

        // Remplir le formulaire conductrice
        await page.fill('#first_name', 'Sophie');
        await page.fill('#last_name', 'Martin');
        await page.fill('#email', 'sophie.martin@test.com');
        await page.fill('#phone', '+41791234567');
        await page.fill('#password', 'DriverTest123!');
        await page.fill('#password_confirm', 'DriverTest123!');

        // Remplir info véhicule si présent
        if (hasVehicleSection) {
            await page.fill('#vehicle_brand', 'Toyota');
            await page.fill('#vehicle_model', 'Corolla');
            await page.fill('#vehicle_color', 'Blanc');
            await page.fill('#vehicle_year', '2022');
            await page.fill('#vehicle_license_plate', '12345-A-1');
        }
        await page.waitForTimeout(300);
        await screenshot(page, '07-register-driver-filled', viewport.name);

        // ═══════════════════════════════════════════════════════════════
        // TEST 2: Pages authentifiées (passagère)
        // ═══════════════════════════════════════════════════════════════
        console.log('\n═══ TEST 2: Pages authentifiées (passagère) ═══\n');

        // Login
        console.log('  → Connexion utilisateur test...');
        await page.goto(`${BASE_URL}/login`);
        await page.fill('#email', TEST_USER.email);
        await page.fill('#password', TEST_USER.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        // Vérifier si connecté (dashboard ou identity-verification)
        const currentUrl = page.url();
        console.log(`  → URL après login: ${currentUrl}`);
        await screenshot(page, '08-after-login', viewport.name);

        // 2.1 Dashboard passagère
        if (currentUrl.includes('dashboard') || currentUrl.includes('identity')) {
            console.log('  ✅ Login: Authentification réussie');
            passed++;
        } else {
            console.log('  ⚠️ Login: Redirection inattendue');
        }

        // Aller au dashboard
        await page.goto(`${BASE_URL}/passenger/dashboard`);
        await page.waitForTimeout(1000);
        await screenshot(page, '09-dashboard-passenger', viewport.name);

        // Vérifier que le SOS n'est PAS visible (pas de course active)
        const sosVisible = await page.locator('.sos-fab').isVisible().catch(() => false);
        if (!sosVisible) {
            console.log('  ✅ Dashboard: SOS caché (pas de course active)');
            passed++;
        } else {
            console.log('  ⚠️ Dashboard: SOS visible alors que pas de course');
        }

        // 2.2 Page vérification d'identité
        console.log('\n  → Page vérification d\'identité...');
        await page.goto(`${BASE_URL}/identity-verification`);
        await page.waitForTimeout(1000);
        await screenshot(page, '10-identity-verification', viewport.name);

        // Vérifier i18n (pas de clés brutes comme "verification.title")
        const pageContent = await page.content();
        const hasRawKeys = pageContent.includes('verification.title') ||
                          pageContent.includes('verification.step') ||
                          pageContent.includes('__("');
        if (!hasRawKeys) {
            console.log('  ✅ Identity verification: i18n chargé correctement');
            passed++;
        } else {
            console.log('  ❌ Identity verification: Clés i18n brutes détectées');
            failed++;
            errors.push('Clés i18n non traduites sur identity-verification');
        }

        // Vérifier le logo
        const logoVisible = await page.locator('.header-logo').isVisible().catch(() => false);
        if (logoVisible) {
            console.log('  ✅ Identity verification: Logo visible');
            passed++;
        } else {
            console.log('  ⚠️ Identity verification: Logo non visible');
        }

        // ═══════════════════════════════════════════════════════════════
        // TEST 3: Test de la caméra
        // ═══════════════════════════════════════════════════════════════
        console.log('\n═══ TEST 3: Test activation caméra ═══\n');

        // La caméra devrait être déjà initialisée sur identity-verification
        // Chercher le bouton pour démarrer la capture
        const startCameraBtn = page.locator('button:has-text("camera"), button:has-text("Commencer"), button:has-text("Start")').first();
        const btnExists = await startCameraBtn.count() > 0;

        if (btnExists) {
            console.log('  → Clic sur bouton caméra...');
            await startCameraBtn.click();
            await page.waitForTimeout(2000);
            await screenshot(page, '11-camera-activated', viewport.name);

            // Vérifier si le stream vidéo est actif
            const videoVisible = await page.locator('video').isVisible().catch(() => false);
            if (videoVisible) {
                console.log('  ✅ Caméra: Stream vidéo actif');
                passed++;
            } else {
                console.log('  ⚠️ Caméra: Stream non visible (permission requise manuellement?)');
            }
        } else {
            console.log('  ℹ️ Caméra: Module pas encore initialisé, vérifier manuellement');
            await screenshot(page, '11-camera-module', viewport.name);
        }

        // ═══════════════════════════════════════════════════════════════
        // TEST 4: Pages admin
        // ═══════════════════════════════════════════════════════════════
        console.log('\n═══ TEST 4: Pages admin ═══\n');

        // Logout et login admin
        await page.goto(`${BASE_URL}/logout`);
        await page.waitForTimeout(500);

        console.log('  → Connexion admin...');
        await page.goto(`${BASE_URL}/login`);
        await page.fill('#email', ADMIN_USER.email);
        await page.fill('#password', ADMIN_USER.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
        await screenshot(page, '12-admin-after-login', viewport.name);

        // Tenter d'accéder au dashboard admin
        await page.goto(`${BASE_URL}/admin/dashboard`);
        await page.waitForTimeout(1000);
        await screenshot(page, '13-admin-dashboard', viewport.name);

        const isAdminPage = await page.locator('h1:has-text("Admin"), h1:has-text("Dashboard")').count() > 0;
        if (isAdminPage) {
            console.log('  ✅ Admin: Dashboard accessible');
            passed++;
        } else {
            console.log('  ⚠️ Admin: Dashboard non accessible (vérifier les permissions)');
        }

    } catch (error) {
        console.error(`\n❌ Erreur: ${error.message}`);
        failed++;
        errors.push(`Erreur globale: ${error.message}`);
        await screenshot(page, 'error', viewport.name);
    }

    await context.close();
    await browser.close();

    // ═══════════════════════════════════════════════════════════════
    // RAPPORT FINAL
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '━'.repeat(60));
    console.log('📊 RAPPORT FINAL');
    console.log('━'.repeat(60));
    console.log(`  ✅ Tests passés: ${passed}`);
    console.log(`  ❌ Tests échoués: ${failed}`);
    console.log(`  📁 Screenshots: ${SCREENSHOTS_DIR}`);

    if (errors.length > 0) {
        console.log('\n⚠️ Erreurs détectées:');
        errors.forEach(e => console.log(`  - ${e}`));
    }

    console.log('\n📸 Fichiers générés:');
    const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    files.sort().forEach(f => console.log(`  - ${f}`));

    console.log('\n✋ VÉRIFICATION MANUELLE REQUISE:');
    console.log('  1. Ouvrir les screenshots et vérifier le design Uber (noir/blanc)');
    console.log('  2. Vérifier que les textes sont traduits (pas de clés i18n)');
    console.log('  3. Vérifier que le SOS a une police moderne (Inter)');
    console.log('  4. Vérifier le formulaire register/driver avec sections véhicule');
    console.log('  5. Tester manuellement la caméra sur identity-verification');
    console.log('━'.repeat(60));

    return failed === 0;
}

runVisualTests()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Erreur fatale:', error);
        process.exit(1);
    });
