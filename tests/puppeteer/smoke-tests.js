/**
 * SMOKE TESTS - Tests E2E rapides pour TripSalama post-deploy
 *
 * Objectif: Valider les fonctionnalités critiques en < 90 secondes
 *
 * Tests inclus:
 * 1. Page login accessible
 * 2. CSS/JS assets chargent (pas de 404)
 * 3. CSRF token généré
 * 4. Login passager fonctionnel
 * 5. Dashboard passager charge
 * 6. Page profil accessible
 * 7. Page changement mot de passe accessible
 * 8. Login conductrice fonctionnel
 * 9. Dashboard conductrice charge
 * 10. Pas d'erreurs JS critiques
 * 11. Logout fonctionne
 *
 * Usage:
 *   node tests/puppeteer/smoke-tests.js [--visual] [--prod]
 */

const puppeteer = require('puppeteer');

// Options ligne de commande
const args = process.argv.slice(2);
const VISUAL_MODE = args.includes('--visual') || args.includes('--headed');
const PRODUCTION_MODE = args.includes('--production') || args.includes('--prod');

// Configuration
const config = PRODUCTION_MODE
    ? require('./config-prod')
    : require('./config');

const BASE_URL = config.baseUrl;
const TIMEOUT = PRODUCTION_MODE ? 45000 : 20000;

// ═══════════════════════════════════════════════════════════════════
// TIMEOUT GLOBAL - Évite que le script reste bloqué indéfiniment
// ═══════════════════════════════════════════════════════════════════
const GLOBAL_TIMEOUT = 180000; // 3 minutes max
const globalTimeoutId = setTimeout(() => {
    console.error('\n\x1b[31m🚨 TIMEOUT GLOBAL ATTEINT (180s) - Arrêt forcé\x1b[0m');
    process.exit(1);
}, GLOBAL_TIMEOUT);
process.on('exit', () => clearTimeout(globalTimeoutId));

// Couleurs console
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

// Résultats
const results = {
    passed: 0,
    failed: 0,
    errors: []
};

function log(color, symbol, message) {
    console.log(`${colors[color]}${symbol}${colors.reset} ${message}`);
}

async function runTest(name, testFn, page) {
    const startTime = Date.now();
    try {
        await Promise.race([
            testFn(page),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), TIMEOUT)
            )
        ]);
        const elapsed = Date.now() - startTime;
        log('green', '✅', `${name} (${elapsed}ms)`);
        results.passed++;
        return true;
    } catch (error) {
        const elapsed = Date.now() - startTime;
        log('red', '❌', `${name} (${elapsed}ms) - ${error.message}`);
        results.failed++;
        results.errors.push({ name, error: error.message });
        return false;
    }
}

/**
 * Tests de smoke
 */
const smokeTests = {
    /**
     * Test 1: Page de login accessible
     */
    async loginPageLoads(page) {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

        const emailInput = await page.$('input[name="email"], input[type="email"], #email');
        const passwordInput = await page.$('input[name="password"], input[type="password"], #password');
        const submitBtn = await page.$('button[type="submit"]');

        if (!emailInput || !passwordInput || !submitBtn) {
            throw new Error('Formulaire de login incomplet');
        }
    },

    /**
     * Test 2: CSS/JS Assets chargent (pas de 404)
     */
    async cssAssetsLoad(page) {
        const failedRequests = [];
        const cssJsRequests = [];

        const responseHandler = response => {
            const url = response.url();
            const status = response.status();

            if (url.match(/\.(css|js)(\?|$)/i)) {
                cssJsRequests.push({ url, status });
                if (status === 404 || status === 500) {
                    failedRequests.push({ url, status });
                }
            }
        };

        page.on('response', responseHandler);

        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

        page.off('response', responseHandler);

        if (cssJsRequests.length === 0) {
            throw new Error('Aucun fichier CSS/JS détecté');
        }

        if (failedRequests.length > 0) {
            const firstFail = failedRequests[0];
            throw new Error(
                `${failedRequests.length} asset(s) en erreur: ${firstFail.url.split('/').pop()} (HTTP ${firstFail.status})`
            );
        }
    },

    /**
     * Test 3: CSRF token présent
     */
    async csrfTokenPresent(page) {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

        const hasCsrf = await page.evaluate(() => {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta && meta.content && meta.content.length > 10;
        });

        if (!hasCsrf) {
            throw new Error('CSRF token non trouvé ou invalide');
        }
    },

    /**
     * Test 4: Login passager fonctionnel
     */
    async passengerLoginWorks(page) {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

        // Remplir le formulaire
        await page.type('input[name="email"], #email', config.users.passenger.email);
        await page.type('input[name="password"], #password', config.users.passenger.password);

        // Soumettre
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }).catch(() => {}),
            page.click('button[type="submit"]')
        ]);

        await new Promise(r => setTimeout(r, 2000));

        const url = page.url();
        if (url.includes('/login')) {
            const content = await page.content();
            if (content.includes('incorrect') || content.includes('Invalid') || content.includes('Erreur')) {
                throw new Error('Credentials passager invalides');
            }
            throw new Error('Toujours sur /login après soumission');
        }
    },

    /**
     * Test 5: Dashboard passager charge
     */
    async passengerDashboardLoads(page) {
        await page.goto(`${BASE_URL}/passenger/dashboard`, { waitUntil: 'networkidle2' });

        const url = page.url();
        if (url.includes('/login')) {
            throw new Error('Redirigé vers login - session passager non valide');
        }

        const bodyText = await page.evaluate(() => document.body.innerText);
        if (bodyText.length < 50) {
            throw new Error('Dashboard passager semble vide');
        }
    },

    /**
     * Test 6: Page profil accessible
     */
    async profilePageLoads(page) {
        await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle2' });

        const url = page.url();
        if (url.includes('/login')) {
            throw new Error('Redirigé vers login');
        }

        const content = await page.content();
        if (!content.toLowerCase().includes('profil') && !content.toLowerCase().includes('profile')) {
            throw new Error('Page profil sans contenu attendu');
        }
    },

    /**
     * Test 7: Page changement mot de passe accessible
     */
    async passwordPageLoads(page) {
        await page.goto(`${BASE_URL}/profile/password`, { waitUntil: 'networkidle2' });

        const url = page.url();
        if (url.includes('/login')) {
            throw new Error('Redirigé vers login');
        }

        const currentPwd = await page.$('input[name="current_password"], #current_password');
        const newPwd = await page.$('input[name="new_password"], #new_password');
        const confirmPwd = await page.$('input[name="confirm_password"], #confirm_password');

        if (!currentPwd || !newPwd || !confirmPwd) {
            throw new Error('Formulaire mot de passe incomplet');
        }
    },

    /**
     * Test 8: Login conductrice fonctionnel
     */
    async driverLoginWorks(page) {
        // Logout d'abord
        await page.goto(`${BASE_URL}/logout`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1000));

        // Login conductrice
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

        // Clear + remplir
        await page.evaluate(() => {
            const email = document.querySelector('input[name="email"], #email');
            const pwd = document.querySelector('input[name="password"], #password');
            if (email) email.value = '';
            if (pwd) pwd.value = '';
        });

        await page.type('input[name="email"], #email', config.users.driver.email);
        await page.type('input[name="password"], #password', config.users.driver.password);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }).catch(() => {}),
            page.click('button[type="submit"]')
        ]);

        await new Promise(r => setTimeout(r, 2000));

        const url = page.url();
        if (url.includes('/login')) {
            throw new Error('Login conductrice échoué');
        }
    },

    /**
     * Test 9: Dashboard conductrice charge
     */
    async driverDashboardLoads(page) {
        await page.goto(`${BASE_URL}/driver/dashboard`, { waitUntil: 'networkidle2' });

        const url = page.url();
        if (url.includes('/login')) {
            throw new Error('Redirigé vers login - session conductrice non valide');
        }

        const bodyText = await page.evaluate(() => document.body.innerText);
        if (bodyText.length < 50) {
            throw new Error('Dashboard conductrice semble vide');
        }
    },

    /**
     * Test 10: Pas d'erreurs JavaScript critiques
     */
    async noJsErrors(page) {
        const jsErrors = [];

        const errorHandler = error => {
            const msg = error.message || error.toString();
            if (!msg.includes('ResizeObserver') &&
                !msg.includes('ChunkLoadError') &&
                !msg.includes('Script error')) {
                jsErrors.push(msg);
            }
        };

        page.on('pageerror', errorHandler);

        await page.goto(`${BASE_URL}/driver/dashboard`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));

        page.off('pageerror', errorHandler);

        if (jsErrors.length > 0) {
            throw new Error(`${jsErrors.length} erreur(s) JS: ${jsErrors[0].substring(0, 80)}`);
        }
    },

    /**
     * Test 11: Logout fonctionne
     */
    async logoutWorks(page) {
        await page.goto(`${BASE_URL}/logout`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1000));

        await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle2' });

        const url = page.url();
        if (!url.includes('/login')) {
            throw new Error('Logout inefficace - toujours connecté');
        }
    }
};

/**
 * Exécution principale
 */
async function runSmokeTests() {
    console.log('');
    console.log(`${colors.cyan}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║          TRIPSALAMA SMOKE TESTS (Post-deploy)             ║${colors.reset}`);
    console.log(`${colors.cyan}╠═══════════════════════════════════════════════════════════╣${colors.reset}`);
    console.log(`${colors.cyan}║  Mode: ${(PRODUCTION_MODE ? 'PRODUCTION' : 'LOCAL').padEnd(48)}║${colors.reset}`);
    console.log(`${colors.cyan}║  URL:  ${BASE_URL.padEnd(48)}║${colors.reset}`);
    console.log(`${colors.cyan}╚═══════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log('');

    const startTime = Date.now();

    const browser = await puppeteer.launch({
        headless: !VISUAL_MODE,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 800 }
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT);

    try {
        await runTest('1. Page login accessible', smokeTests.loginPageLoads, page);
        await runTest('2. CSS/JS assets chargent (pas 404)', smokeTests.cssAssetsLoad, page);
        await runTest('3. CSRF token présent', smokeTests.csrfTokenPresent, page);
        await runTest('4. Login passager fonctionnel', smokeTests.passengerLoginWorks, page);
        await runTest('5. Dashboard passager charge', smokeTests.passengerDashboardLoads, page);
        await runTest('6. Page profil accessible', smokeTests.profilePageLoads, page);
        await runTest('7. Page mot de passe accessible', smokeTests.passwordPageLoads, page);
        await runTest('8. Login conductrice fonctionnel', smokeTests.driverLoginWorks, page);
        await runTest('9. Dashboard conductrice charge', smokeTests.driverDashboardLoads, page);
        await runTest('10. Pas d\'erreurs JS critiques', smokeTests.noJsErrors, page);
        await runTest('11. Logout fonctionne', smokeTests.logoutWorks, page);

    } catch (error) {
        log('red', '💥', `Erreur fatale: ${error.message}`);
        results.failed++;
    } finally {
        await browser.close();
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}Résumé: ${results.passed} passé(s), ${results.failed} échoué(s) | Temps: ${totalTime}s${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

    if (results.failed > 0) {
        console.log('');
        log('red', '❌', 'SMOKE TESTS ÉCHOUÉS');
        console.log('');
        results.errors.forEach(err => {
            console.log(`   - ${err.name}: ${err.error}`);
        });
        console.log('');
        process.exit(1);
    } else {
        console.log('');
        log('green', '✅', 'TOUS LES SMOKE TESTS PASSENT');
        console.log('');
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    runSmokeTests();
}

module.exports = { runSmokeTests };
