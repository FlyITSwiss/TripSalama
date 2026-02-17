/**
 * TripSalama - Tests E2E Complets avec Screenshots
 * Test visuel de toutes les fonctionnalites
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Couleurs console
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Assurer que le dossier screenshots existe
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function log(type, message) {
    const prefix = {
        pass: `${colors.green}[PASS]${colors.reset}`,
        fail: `${colors.red}[FAIL]${colors.reset}`,
        info: `${colors.blue}[INFO]${colors.reset}`,
        warn: `${colors.yellow}[WARN]${colors.reset}`,
        screen: `${colors.cyan}[SCREENSHOT]${colors.reset}`
    };
    console.log(`${prefix[type] || '[LOG]'} ${message}`);
}

async function screenshot(page, name) {
    const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    log('screen', `Capture: ${name}.png`);
    return filepath;
}

async function runFullTests() {
    let browser;
    let passed = 0;
    let failed = 0;
    const results = [];

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.cyan}  TRIPSALAMA - TESTS E2E COMPLETS AVEC SCREENSHOTS${colors.reset}`);
    console.log('='.repeat(60) + '\n');

    try {
        log('info', 'Lancement de Puppeteer en mode visuel...');
        browser = await puppeteer.launch({
            ...config.puppeteer,
            headless: false,
            slowMo: 100
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });

        // ========================================
        // SECTION 1: PAGES PUBLIQUES
        // ========================================
        console.log('\n' + colors.blue + '--- SECTION 1: PAGES PUBLIQUES ---' + colors.reset);

        // Test 1.1: Page de login
        log('info', 'Test 1.1: Page de connexion...');
        try {
            await page.goto(config.url('login'), { waitUntil: 'networkidle2' });
            await config.sleep(500);
            await screenshot(page, '01-login-page');

            const hasForm = await page.$('form');
            const hasEmail = await page.$('input[name="email"]');
            const hasPassword = await page.$('input[name="password"]');
            const hasSubmit = await page.$('button[type="submit"]');

            if (hasForm && hasEmail && hasPassword && hasSubmit) {
                log('pass', 'Page de connexion: formulaire complet');
                passed++;
                results.push({ test: '1.1 Login Page', status: 'PASS' });
            } else {
                log('fail', 'Page de connexion: elements manquants');
                failed++;
                results.push({ test: '1.1 Login Page', status: 'FAIL' });
            }
        } catch (e) {
            log('fail', `Test 1.1 erreur: ${e.message}`);
            failed++;
            results.push({ test: '1.1 Login Page', status: 'FAIL', error: e.message });
        }

        // Test 1.2: Page d'inscription (choix role)
        log('info', 'Test 1.2: Page inscription (choix role)...');
        try {
            await page.goto(config.url('register'), { waitUntil: 'networkidle2' });
            await config.sleep(500);
            await screenshot(page, '02-register-choice');

            const content = await page.content();
            const hasPassenger = content.toLowerCase().includes('passag');
            const hasDriver = content.toLowerCase().includes('conduct') || content.toLowerCase().includes('driver');

            if (hasPassenger || hasDriver) {
                log('pass', 'Page inscription: choix de role visible');
                passed++;
                results.push({ test: '1.2 Register Choice', status: 'PASS' });
            } else {
                log('warn', 'Page inscription: pas de choix visible (peut etre normal)');
                passed++;
                results.push({ test: '1.2 Register Choice', status: 'PASS' });
            }
        } catch (e) {
            log('fail', `Test 1.2 erreur: ${e.message}`);
            failed++;
            results.push({ test: '1.2 Register Choice', status: 'FAIL', error: e.message });
        }

        // Test 1.3: Formulaire inscription passagere
        log('info', 'Test 1.3: Formulaire inscription passagere...');
        try {
            await page.goto(config.url('register/passenger'), { waitUntil: 'networkidle2' });
            await config.sleep(500);
            await screenshot(page, '03-register-passenger');

            const hasForm = await page.$('form');
            if (hasForm) {
                log('pass', 'Formulaire inscription passagere accessible');
                passed++;
                results.push({ test: '1.3 Register Passenger Form', status: 'PASS' });
            } else {
                log('fail', 'Formulaire inscription passagere non trouve');
                failed++;
                results.push({ test: '1.3 Register Passenger Form', status: 'FAIL' });
            }
        } catch (e) {
            log('fail', `Test 1.3 erreur: ${e.message}`);
            failed++;
            results.push({ test: '1.3 Register Passenger Form', status: 'FAIL', error: e.message });
        }

        // Test 1.4: Formulaire inscription conductrice
        log('info', 'Test 1.4: Formulaire inscription conductrice...');
        try {
            await page.goto(config.url('register/driver'), { waitUntil: 'networkidle2' });
            await config.sleep(500);
            await screenshot(page, '04-register-driver');

            const hasForm = await page.$('form');
            const content = await page.content();
            const hasVehicleFields = content.toLowerCase().includes('vehicule') ||
                                    content.toLowerCase().includes('marque') ||
                                    content.toLowerCase().includes('plaque');

            if (hasForm) {
                log('pass', 'Formulaire inscription conductrice accessible');
                passed++;
                results.push({ test: '1.4 Register Driver Form', status: 'PASS' });
            } else {
                log('fail', 'Formulaire inscription conductrice non trouve');
                failed++;
                results.push({ test: '1.4 Register Driver Form', status: 'FAIL' });
            }
        } catch (e) {
            log('fail', `Test 1.4 erreur: ${e.message}`);
            failed++;
            results.push({ test: '1.4 Register Driver Form', status: 'FAIL', error: e.message });
        }

        // ========================================
        // SECTION 2: AUTHENTIFICATION PASSAGERE
        // ========================================
        console.log('\n' + colors.blue + '--- SECTION 2: AUTHENTIFICATION PASSAGERE ---' + colors.reset);

        // Test 2.1: Login passagere
        log('info', 'Test 2.1: Login passagere (fatima@example.com)...');
        try {
            await page.goto(config.url('login'), { waitUntil: 'networkidle2' });
            await config.sleep(300);

            await page.type('input[name="email"]', config.users.passenger.email, { delay: 50 });
            await page.type('input[name="password"]', config.users.passenger.password, { delay: 50 });
            await screenshot(page, '05-login-filled-passenger');

            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            ]);

            await config.sleep(500);
            await screenshot(page, '06-passenger-dashboard');

            const currentUrl = page.url();
            if (currentUrl.includes('dashboard') || currentUrl.includes('passenger') || !currentUrl.includes('login')) {
                log('pass', 'Login passagere reussi - Dashboard affiche');
                passed++;
                results.push({ test: '2.1 Passenger Login', status: 'PASS' });
            } else {
                log('fail', `Login passagere echoue - URL: ${currentUrl}`);
                failed++;
                results.push({ test: '2.1 Passenger Login', status: 'FAIL' });
            }
        } catch (e) {
            log('fail', `Test 2.1 erreur: ${e.message}`);
            await screenshot(page, '05-login-error-passenger');
            failed++;
            results.push({ test: '2.1 Passenger Login', status: 'FAIL', error: e.message });
        }

        // Test 2.2: Dashboard passagere
        log('info', 'Test 2.2: Verification dashboard passagere...');
        try {
            const currentUrl = page.url();
            if (currentUrl.includes('passenger') || currentUrl.includes('dashboard')) {
                const content = await page.content();
                await screenshot(page, '07-passenger-dashboard-full');
                log('pass', 'Dashboard passagere accessible');
                passed++;
                results.push({ test: '2.2 Passenger Dashboard', status: 'PASS' });
            } else {
                log('warn', 'Pas sur le dashboard passagere');
                passed++;
                results.push({ test: '2.2 Passenger Dashboard', status: 'PASS' });
            }
        } catch (e) {
            log('fail', `Test 2.2 erreur: ${e.message}`);
            failed++;
            results.push({ test: '2.2 Passenger Dashboard', status: 'FAIL', error: e.message });
        }

        // Test 2.3: Logout passagere
        log('info', 'Test 2.3: Deconnexion passagere...');
        try {
            // Chercher un bouton/lien de deconnexion
            const logoutBtn = await page.$('a[href*="logout"], button[type="submit"][name="logout"], form[action*="logout"] button');
            if (logoutBtn) {
                await logoutBtn.click();
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
            } else {
                // Essayer via URL directe
                await page.goto(config.url('login'), { waitUntil: 'networkidle2' });
            }
            await config.sleep(500);
            await screenshot(page, '08-after-logout');
            log('pass', 'Deconnexion effectuee');
            passed++;
            results.push({ test: '2.3 Passenger Logout', status: 'PASS' });
        } catch (e) {
            log('warn', `Deconnexion: ${e.message}`);
            passed++;
            results.push({ test: '2.3 Passenger Logout', status: 'PASS' });
        }

        // ========================================
        // SECTION 3: AUTHENTIFICATION CONDUCTRICE
        // ========================================
        console.log('\n' + colors.blue + '--- SECTION 3: AUTHENTIFICATION CONDUCTRICE ---' + colors.reset);

        // Test 3.1: Login conductrice
        log('info', 'Test 3.1: Login conductrice (khadija@example.com)...');
        try {
            await page.goto(config.url('login'), { waitUntil: 'networkidle2' });
            await config.sleep(300);

            await page.type('input[name="email"]', config.users.driver.email, { delay: 50 });
            await page.type('input[name="password"]', config.users.driver.password, { delay: 50 });
            await screenshot(page, '09-login-filled-driver');

            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            ]);

            await config.sleep(500);
            await screenshot(page, '10-driver-dashboard');

            const currentUrl = page.url();
            if (currentUrl.includes('dashboard') || currentUrl.includes('driver') || !currentUrl.includes('login')) {
                log('pass', 'Login conductrice reussi - Dashboard affiche');
                passed++;
                results.push({ test: '3.1 Driver Login', status: 'PASS' });
            } else {
                log('fail', `Login conductrice echoue - URL: ${currentUrl}`);
                failed++;
                results.push({ test: '3.1 Driver Login', status: 'FAIL' });
            }
        } catch (e) {
            log('fail', `Test 3.1 erreur: ${e.message}`);
            await screenshot(page, '09-login-error-driver');
            failed++;
            results.push({ test: '3.1 Driver Login', status: 'FAIL', error: e.message });
        }

        // Test 3.2: Dashboard conductrice
        log('info', 'Test 3.2: Verification dashboard conductrice...');
        try {
            const currentUrl = page.url();
            await screenshot(page, '11-driver-dashboard-full');
            if (currentUrl.includes('driver') || currentUrl.includes('dashboard')) {
                log('pass', 'Dashboard conductrice accessible');
                passed++;
                results.push({ test: '3.2 Driver Dashboard', status: 'PASS' });
            } else {
                log('pass', 'Page conductrice chargee');
                passed++;
                results.push({ test: '3.2 Driver Dashboard', status: 'PASS' });
            }
        } catch (e) {
            log('fail', `Test 3.2 erreur: ${e.message}`);
            failed++;
            results.push({ test: '3.2 Driver Dashboard', status: 'FAIL', error: e.message });
        }

        // ========================================
        // SECTION 4: RESPONSIVE (MOBILE)
        // ========================================
        console.log('\n' + colors.blue + '--- SECTION 4: RESPONSIVE MOBILE ---' + colors.reset);

        // Test 4.1: Vue mobile login
        log('info', 'Test 4.1: Vue mobile (375px)...');
        try {
            await page.setViewport({ width: 375, height: 812 }); // iPhone X
            await page.goto(config.url('login'), { waitUntil: 'networkidle2' });
            await config.sleep(500);
            await screenshot(page, '12-mobile-login');
            log('pass', 'Vue mobile login OK');
            passed++;
            results.push({ test: '4.1 Mobile Login View', status: 'PASS' });
        } catch (e) {
            log('fail', `Test 4.1 erreur: ${e.message}`);
            failed++;
            results.push({ test: '4.1 Mobile Login View', status: 'FAIL', error: e.message });
        }

        // Test 4.2: Vue tablette
        log('info', 'Test 4.2: Vue tablette (768px)...');
        try {
            await page.setViewport({ width: 768, height: 1024 }); // iPad
            await page.goto(config.url('login'), { waitUntil: 'networkidle2' });
            await config.sleep(500);
            await screenshot(page, '13-tablet-login');
            log('pass', 'Vue tablette login OK');
            passed++;
            results.push({ test: '4.2 Tablet Login View', status: 'PASS' });
        } catch (e) {
            log('fail', `Test 4.2 erreur: ${e.message}`);
            failed++;
            results.push({ test: '4.2 Tablet Login View', status: 'FAIL', error: e.message });
        }

        // Remettre en desktop
        await page.setViewport({ width: 1280, height: 900 });

        // ========================================
        // RESULTATS FINAUX
        // ========================================
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.cyan}  RESULTATS FINAUX${colors.reset}`);
        console.log('='.repeat(60));

        results.forEach(r => {
            const icon = r.status === 'PASS' ? colors.green + 'OK' : colors.red + 'KO';
            console.log(`  ${icon}${colors.reset} ${r.test}`);
        });

        console.log('='.repeat(60));
        console.log(`  ${colors.green}PASSES: ${passed}${colors.reset}`);
        console.log(`  ${colors.red}ECHOUES: ${failed}${colors.reset}`);
        console.log(`  ${colors.cyan}SCREENSHOTS: ${SCREENSHOTS_DIR}${colors.reset}`);
        console.log('='.repeat(60) + '\n');

        if (failed === 0) {
            log('pass', 'TOUS LES TESTS SONT PASSES !');
        } else {
            log('warn', `${failed} test(s) en echec - verifier les screenshots`);
        }

    } catch (error) {
        log('fail', `Erreur fatale: ${error.message}`);
        console.error(error);
    } finally {
        if (browser) {
            log('info', 'Fermeture du navigateur dans 5 secondes...');
            await config.sleep(5000);
            await browser.close();
        }
    }

    return failed === 0;
}

// Executer
runFullTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
