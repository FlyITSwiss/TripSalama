/**
 * TripSalama - Test Géolocalisation PRODUCTION
 *
 * Vérifie:
 * - Pas d'erreur 404 pour address-autocomplete.js
 * - Pas de skip-link visible
 * - Permissions-Policy OK pour géolocalisation
 * - Carte Leaflet fonctionne
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://stabilis-it.ch/internal/tripsalama';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'geolocation-test');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function run() {
    console.log('\n' + '═'.repeat(60));
    console.log('🗺️ TEST GÉOLOCALISATION PRODUCTION');
    console.log('═'.repeat(60));
    console.log('URL:', BASE_URL);
    console.log('');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 30,
        defaultViewport: { width: 414, height: 896 },
        args: ['--no-sandbox', '--ignore-certificate-errors']
    });

    const context = browser.defaultBrowserContext();
    // Autoriser la géolocalisation pour le domaine
    await context.overridePermissions(BASE_URL, ['geolocation']);

    const results = { passed: 0, failed: 0, tests: [] };

    function logTest(name, passed, details = '') {
        const icon = passed ? '✅' : '❌';
        console.log(`   ${icon} ${name}${details ? ' - ' + details : ''}`);
        results.tests.push({ name, passed, details });
        if (passed) results.passed++;
        else results.failed++;
    }

    const page = await browser.newPage();

    // Mock geolocation (Genève)
    await page.setGeolocation({ latitude: 46.2044, longitude: 6.1432 });

    // Capturer les erreurs
    const errors404 = [];
    const cspErrors = [];
    const allErrors = [];

    page.on('console', msg => {
        const text = msg.text();
        if (msg.type() === 'error') {
            allErrors.push(text);
            if (text.includes('404')) errors404.push(text);
            if (text.includes('Permissions policy') || text.includes('Geolocation')) {
                cspErrors.push(text);
            }
        }
    });

    page.on('requestfailed', request => {
        if (request.url().includes('address-autocomplete')) {
            errors404.push(`404: ${request.url()}`);
        }
    });

    try {
        // ========================================
        // TEST 1: LOGIN
        // ========================================
        console.log('\n🔐 TEST 1: Connexion');
        console.log('-'.repeat(50));

        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await page.type('input[name="email"], #email', 'passenger@tripsalama.ch');
        await page.type('input[name="password"], #password', 'password');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

        const isLoggedIn = !page.url().includes('/login');
        logTest('Connexion réussie', isLoggedIn);

        // ========================================
        // TEST 2: PAGE RÉSERVATION - VÉRIFICATIONS
        // ========================================
        console.log('\n📍 TEST 2: Page de réservation');
        console.log('-'.repeat(50));

        // Clear errors before navigating
        errors404.length = 0;
        cspErrors.length = 0;
        allErrors.length = 0;

        await page.goto(`${BASE_URL}/passenger/book`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 3000));

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-book-page.png') });

        // Vérifier pas d'erreur 404 pour address-autocomplete.js
        const noAutocompleteError = !errors404.some(e => e.includes('address-autocomplete'));
        logTest('Pas d\'erreur address-autocomplete.js', noAutocompleteError);

        // Vérifier pas de skip-link visible
        const skipLinkExists = await page.$('.skip-link, a[href="#main-content"]');
        logTest('Skip-link supprimé', !skipLinkExists);

        // Vérifier pas d'erreur Permissions-Policy pour géoloc
        const noGeolocationPolicyError = !cspErrors.some(e =>
            e.includes('geolocation') || e.includes('Geolocation')
        );
        logTest('Permissions-Policy OK pour géoloc', noGeolocationPolicyError,
            cspErrors.length > 0 ? cspErrors[0].substring(0, 50) : '');

        // ========================================
        // TEST 3: CARTE LEAFLET
        // ========================================
        console.log('\n🗺️ TEST 3: Carte Leaflet');
        console.log('-'.repeat(50));

        const leafletLoaded = await page.evaluate(() => {
            return typeof L !== 'undefined' && typeof L.map === 'function';
        });
        logTest('Leaflet chargé', leafletLoaded);

        const mapExists = await page.$('#map, .leaflet-container');
        logTest('Conteneur carte présent', !!mapExists);

        const tilesLoaded = await page.evaluate(() => {
            const tiles = document.querySelectorAll('.leaflet-tile');
            return tiles.length > 0;
        });
        logTest('Tuiles de carte chargées', tilesLoaded);

        // ========================================
        // TEST 4: TEST GÉOLOCALISATION
        // ========================================
        console.log('\n📍 TEST 4: Géolocalisation');
        console.log('-'.repeat(50));

        // Chercher le bouton de géolocalisation
        const locateMeBtn = await page.$('#locateMeBtn, .locate-me-btn, button[data-action="locate"]');

        if (locateMeBtn) {
            // Clear errors avant le clic
            cspErrors.length = 0;

            await locateMeBtn.click();
            await new Promise(r => setTimeout(r, 2000));

            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-after-locate.png') });

            // Vérifier qu'il n'y a pas eu d'erreur de permissions
            const noPermissionError = !cspErrors.some(e =>
                e.includes('Permissions policy violation') ||
                e.includes('geolocation')
            );
            logTest('Géolocalisation sans erreur Permissions-Policy', noPermissionError);

            // Vérifier si une adresse a été trouvée
            const pickupValue = await page.evaluate(() => {
                const input = document.getElementById('pickupInput');
                return input ? input.value : '';
            });
            logTest('Adresse de pickup obtenue', pickupValue.length > 0, pickupValue.substring(0, 30));
        } else {
            console.log('   ⚠️ Bouton géolocalisation non trouvé');
        }

        // ========================================
        // RÉSUMÉ
        // ========================================
        console.log('\n' + '═'.repeat(60));
        console.log('📊 RÉSUMÉ');
        console.log('═'.repeat(60));
        console.log(`✅ Tests réussis: ${results.passed}`);
        console.log(`❌ Tests échoués: ${results.failed}`);
        console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}`);

        if (allErrors.length > 0) {
            console.log(`\n⚠️ Erreurs console (${allErrors.length}):`);
            allErrors.slice(0, 5).forEach(e => console.log('   ' + e.substring(0, 80)));
        }

        if (results.failed === 0) {
            console.log('\n🎉 TOUS LES TESTS PASSENT !');
        } else {
            console.log('\n⚠️ Tests en échec:');
            results.tests.filter(t => !t.passed).forEach(t => {
                console.log(`   ❌ ${t.name}${t.details ? ': ' + t.details : ''}`);
            });
        }

    } catch (error) {
        console.error('\n❌ Erreur fatale:', error.message);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error.png') });
    } finally {
        await browser.close();
    }

    return results.failed === 0;
}

run().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
