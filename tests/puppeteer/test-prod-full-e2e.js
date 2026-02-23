/**
 * TripSalama - Test Complet PRODUCTION
 *
 * Tests E2E de toutes les fonctionnalités en production :
 * - Login/Logout
 * - Page de réservation avec carte Leaflet
 * - Création de course
 * - Chat conductrice-passagère
 * - Suivi de course
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Configuration PRODUCTION
const BASE_URL = 'https://stabilis-it.ch/internal/tripsalama';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'prod-test');

// Créer le dossier screenshots si nécessaire
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function run() {
    console.log('\n' + '═'.repeat(60));
    console.log('🚀 TEST COMPLET PRODUCTION - TRIPSALAMA');
    console.log('═'.repeat(60));
    console.log('URL:', BASE_URL);
    console.log('');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        defaultViewport: { width: 414, height: 896 },
        args: ['--no-sandbox', '--ignore-certificate-errors']
    });

    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    function logTest(name, passed, details = '') {
        const icon = passed ? '✅' : '❌';
        console.log(`   ${icon} ${name}${details ? ' - ' + details : ''}`);
        results.tests.push({ name, passed, details });
        if (passed) results.passed++;
        else results.failed++;
    }

    const page = await browser.newPage();

    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('favicon')) {
            consoleErrors.push(msg.text());
        }
    });

    try {
        // ========================================
        // TEST 1: PAGE LOGIN
        // ========================================
        console.log('\n📝 TEST 1: Page de connexion');
        console.log('-'.repeat(50));

        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-login-page.png') });

        const loginForm = await page.$('form');
        logTest('Page login accessible', !!loginForm);

        const emailInput = await page.$('input[name="email"], #email');
        const passwordInput = await page.$('input[name="password"], #password');
        logTest('Champs de connexion présents', emailInput && passwordInput);

        // ========================================
        // TEST 2: CONNEXION PASSAGÈRE
        // ========================================
        console.log('\n🔐 TEST 2: Connexion passagère');
        console.log('-'.repeat(50));

        // Credentials production (bcrypt hash = 'password')
        await page.type('input[name="email"], #email', 'passenger@tripsalama.ch');
        await page.type('input[name="password"], #password', 'password');
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-login-filled.png') });

        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

        const isLoggedIn = !page.url().includes('/login');
        logTest('Connexion réussie', isLoggedIn, page.url().split('/').pop());
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-after-login.png') });

        // ========================================
        // TEST 3: PAGE DE RÉSERVATION + CARTE
        // ========================================
        console.log('\n🗺️ TEST 3: Page de réservation avec carte');
        console.log('-'.repeat(50));

        await page.goto(`${BASE_URL}/passenger/book`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 3000)); // Attendre chargement carte

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-book-page.png') });

        // Vérifier que Leaflet est chargé
        const leafletLoaded = await page.evaluate(() => {
            return typeof L !== 'undefined' && typeof L.map === 'function';
        });
        logTest('Leaflet chargé', leafletLoaded);

        // Vérifier la carte
        const mapExists = await page.$('#map, .leaflet-container');
        logTest('Conteneur carte présent', !!mapExists);

        // Vérifier les tiles (pas d'erreur CSP)
        const tilesLoaded = await page.evaluate(() => {
            const tiles = document.querySelectorAll('.leaflet-tile');
            return tiles.length > 0;
        });
        logTest('Tiles de carte chargées (CSP OK)', tilesLoaded);

        // Vérifier champs d'adresse
        const pickupInput = await page.$('#pickup-address, input[name="pickup"]');
        const dropoffInput = await page.$('#dropoff-address, input[name="dropoff"]');
        logTest('Champs adresse présents', pickupInput && dropoffInput);

        // Vérifier erreurs CSP dans console
        const cspErrors = consoleErrors.filter(e =>
            e.includes('Content Security Policy') ||
            e.includes('violates')
        );
        logTest('Aucune erreur CSP', cspErrors.length === 0, cspErrors.length > 0 ? `${cspErrors.length} erreur(s)` : '');

        // ========================================
        // TEST 4: TABLEAU DE BORD PASSAGÈRE
        // ========================================
        console.log('\n📊 TEST 4: Tableau de bord passagère');
        console.log('-'.repeat(50));

        await page.goto(`${BASE_URL}/passenger/dashboard`, { waitUntil: 'networkidle2' });
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-passenger-dashboard.png') });

        const dashboardContent = await page.$('.dashboard, .content, main');
        logTest('Dashboard passagère accessible', !!dashboardContent);

        // ========================================
        // TEST 5: PAGE SUIVI DE COURSE (si course active)
        // ========================================
        console.log('\n📍 TEST 5: Page de suivi de course');
        console.log('-'.repeat(50));

        // Essayer d'accéder à une course (ID 12 de test)
        await page.goto(`${BASE_URL}/passenger/ride/12`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-ride-tracking.png') });

        // Vérifier si on est sur la page de suivi ou redirigé
        const trackingPage = await page.$('.tracking-page, .tracking-panel, #trackingPanel');
        const isTrackingPage = !!trackingPage || page.url().includes('/ride/');
        logTest('Page suivi accessible', isTrackingPage);

        // ========================================
        // TEST 6: CHAT (si course active)
        // ========================================
        console.log('\n💬 TEST 6: Fonctionnalité Chat');
        console.log('-'.repeat(50));

        if (isTrackingPage) {
            const chatBtn = await page.$('#chatToggleBtn');
            logTest('Bouton chat présent', !!chatBtn);

            if (chatBtn) {
                await chatBtn.click();
                await new Promise(r => setTimeout(r, 500));

                const chatPanel = await page.$('#chatPanel.active');
                logTest('Panel chat s\'ouvre', !!chatPanel);

                const quickMsgs = await page.$$('.quick-message-btn');
                logTest('Messages rapides disponibles', quickMsgs.length >= 4, `${quickMsgs.length} messages`);

                await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-chat-open.png') });

                // Fermer le chat
                const closeBtn = await page.$('#chatCloseBtn');
                if (closeBtn) await closeBtn.click();
            }
        } else {
            console.log('   ⚠️ Pas de course active - chat non testable');
        }

        // ========================================
        // TEST 7: HISTORIQUE COURSES
        // ========================================
        console.log('\n📜 TEST 7: Historique des courses');
        console.log('-'.repeat(50));

        await page.goto(`${BASE_URL}/passenger/history`, { waitUntil: 'networkidle2' });
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-history.png') });

        const historyPage = await page.$('.history, .rides-list, .ride-history');
        logTest('Page historique accessible', !!historyPage || page.url().includes('/history'));

        // ========================================
        // TEST 8: DÉCONNEXION
        // ========================================
        console.log('\n🚪 TEST 8: Déconnexion');
        console.log('-'.repeat(50));

        // Chercher le bouton de déconnexion
        const logoutBtn = await page.$('a[href*="logout"], button[data-action="logout"], .logout-btn');
        if (logoutBtn) {
            await logoutBtn.click();
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
        } else {
            // Essayer via l'API
            await page.goto(`${BASE_URL}/logout`, { waitUntil: 'networkidle2' });
        }

        const isLoggedOut = page.url().includes('/login') || page.url().endsWith('/tripsalama');
        logTest('Déconnexion réussie', isLoggedOut);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-logout.png') });

        // ========================================
        // RÉSUMÉ
        // ========================================
        console.log('\n' + '═'.repeat(60));
        console.log('📊 RÉSUMÉ DES TESTS PRODUCTION');
        console.log('═'.repeat(60));
        console.log(`✅ Tests réussis: ${results.passed}`);
        console.log(`❌ Tests échoués: ${results.failed}`);
        console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}`);

        if (consoleErrors.length > 0) {
            console.log(`\n⚠️ Erreurs console (${consoleErrors.length}):`);
            consoleErrors.slice(0, 5).forEach(e => console.log('   ' + e.substring(0, 100)));
        }

        if (results.failed === 0) {
            console.log('\n🎉 TOUS LES TESTS PASSENT EN PRODUCTION !');
        } else {
            console.log('\n⚠️ Certains tests ont échoué - vérifier les détails ci-dessus.');

            // Afficher les tests en échec
            console.log('\nTests en échec:');
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
