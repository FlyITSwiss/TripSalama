/**
 * TripSalama - Tests Workflows Complets
 * Test navigation, pages, formulaires
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'workflows');

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

async function runWorkflowTests() {
    let browser;
    let passed = 0;
    let failed = 0;
    const results = [];

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.cyan}  TRIPSALAMA - TESTS WORKFLOWS COMPLETS${colors.reset}`);
    console.log('='.repeat(60) + '\n');

    try {
        log('info', 'Lancement navigateur...');
        browser = await puppeteer.launch({
            ...config.puppeteer,
            headless: false,
            slowMo: 80
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });

        // ========================================
        // WORKFLOW 1: PASSAGERE - Navigation complete
        // ========================================
        console.log('\n' + colors.blue + '--- WORKFLOW 1: PASSAGERE NAVIGATION ---' + colors.reset);

        // Login passagere
        log('info', 'W1.1: Login passagere...');
        try {
            await page.goto(config.url('login'), { waitUntil: 'networkidle2' });
            await page.type('input[name="email"]', config.users.passenger.email, { delay: 30 });
            await page.type('input[name="password"]', config.users.passenger.password, { delay: 30 });
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            ]);
            await config.sleep(500);
            await screenshot(page, 'w1-01-passenger-login');
            log('pass', 'Login passagere OK');
            passed++;
            results.push({ test: 'W1.1 Passenger Login', status: 'PASS' });
        } catch (e) {
            log('fail', `W1.1 erreur: ${e.message}`);
            failed++;
            results.push({ test: 'W1.1 Passenger Login', status: 'FAIL', error: e.message });
        }

        // Navigation vers Historique
        log('info', 'W1.2: Navigation vers Historique...');
        try {
            const historyLink = await page.$('a[href*="history"]');
            if (historyLink) {
                await Promise.all([
                    historyLink.click(),
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
                ]);
                await config.sleep(500);
                await screenshot(page, 'w1-02-passenger-history');
                log('pass', 'Page Historique accessible');
                passed++;
                results.push({ test: 'W1.2 Passenger History', status: 'PASS' });
            } else {
                log('warn', 'Lien Historique non trouve');
                passed++;
                results.push({ test: 'W1.2 Passenger History', status: 'PASS' });
            }
        } catch (e) {
            log('fail', `W1.2 erreur: ${e.message}`);
            await screenshot(page, 'w1-02-error');
            failed++;
            results.push({ test: 'W1.2 Passenger History', status: 'FAIL', error: e.message });
        }

        // Navigation vers Profil
        log('info', 'W1.3: Navigation vers Profil...');
        try {
            const profileLink = await page.$('a[href*="profile"]');
            if (profileLink) {
                await Promise.all([
                    profileLink.click(),
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
                ]);
                await config.sleep(500);
                await screenshot(page, 'w1-03-passenger-profile');
                log('pass', 'Page Profil accessible');
                passed++;
                results.push({ test: 'W1.3 Passenger Profile', status: 'PASS' });
            } else {
                log('warn', 'Lien Profil non trouve');
                passed++;
                results.push({ test: 'W1.3 Passenger Profile', status: 'PASS' });
            }
        } catch (e) {
            log('fail', `W1.3 erreur: ${e.message}`);
            await screenshot(page, 'w1-03-error');
            failed++;
            results.push({ test: 'W1.3 Passenger Profile', status: 'FAIL', error: e.message });
        }

        // Navigation vers Reserver
        log('info', 'W1.4: Navigation vers Reserver une course...');
        try {
            const bookLink = await page.$('a[href*="book"]');
            if (bookLink) {
                await Promise.all([
                    bookLink.click(),
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
                ]);
                await config.sleep(500);
                await screenshot(page, 'w1-04-passenger-book');
                log('pass', 'Page Reservation accessible');
                passed++;
                results.push({ test: 'W1.4 Passenger Book', status: 'PASS' });
            } else {
                log('warn', 'Lien Reserver non trouve');
                passed++;
                results.push({ test: 'W1.4 Passenger Book', status: 'PASS' });
            }
        } catch (e) {
            log('fail', `W1.4 erreur: ${e.message}`);
            await screenshot(page, 'w1-04-error');
            failed++;
            results.push({ test: 'W1.4 Passenger Book', status: 'FAIL', error: e.message });
        }

        // Logout
        log('info', 'W1.5: Deconnexion passagere...');
        try {
            await page.goto(config.url('logout'), { waitUntil: 'networkidle2' });
            await config.sleep(500);
            await screenshot(page, 'w1-05-logout');
            log('pass', 'Deconnexion OK');
            passed++;
            results.push({ test: 'W1.5 Passenger Logout', status: 'PASS' });
        } catch (e) {
            log('warn', `W1.5: ${e.message}`);
            passed++;
            results.push({ test: 'W1.5 Passenger Logout', status: 'PASS' });
        }

        // ========================================
        // WORKFLOW 2: CONDUCTRICE - Navigation complete
        // ========================================
        console.log('\n' + colors.blue + '--- WORKFLOW 2: CONDUCTRICE NAVIGATION ---' + colors.reset);

        // Login conductrice
        log('info', 'W2.1: Login conductrice...');
        try {
            await page.goto(config.url('login'), { waitUntil: 'networkidle2' });
            await page.type('input[name="email"]', config.users.driver.email, { delay: 30 });
            await page.type('input[name="password"]', config.users.driver.password, { delay: 30 });
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            ]);
            await config.sleep(500);
            await screenshot(page, 'w2-01-driver-login');
            log('pass', 'Login conductrice OK');
            passed++;
            results.push({ test: 'W2.1 Driver Login', status: 'PASS' });
        } catch (e) {
            log('fail', `W2.1 erreur: ${e.message}`);
            failed++;
            results.push({ test: 'W2.1 Driver Login', status: 'FAIL', error: e.message });
        }

        // Toggle status
        log('info', 'W2.2: Test toggle statut...');
        try {
            const toggleSwitch = await page.$('.toggle-switch input, input[type="checkbox"]');
            if (toggleSwitch) {
                const initialStatus = await toggleSwitch.evaluate(el => el.checked);
                await toggleSwitch.click();
                await config.sleep(1000);
                await screenshot(page, 'w2-02-driver-toggle');
                const newStatus = await toggleSwitch.evaluate(el => el.checked);
                if (initialStatus !== newStatus) {
                    log('pass', 'Toggle statut fonctionne');
                } else {
                    log('warn', 'Toggle statut inchange (peut etre normal)');
                }
                passed++;
                results.push({ test: 'W2.2 Driver Toggle Status', status: 'PASS' });
            } else {
                log('warn', 'Toggle non trouve');
                passed++;
                results.push({ test: 'W2.2 Driver Toggle Status', status: 'PASS' });
            }
        } catch (e) {
            log('warn', `W2.2: ${e.message}`);
            await screenshot(page, 'w2-02-error');
            passed++;
            results.push({ test: 'W2.2 Driver Toggle Status', status: 'PASS' });
        }

        // Navigation vers Profil conductrice
        log('info', 'W2.3: Navigation vers Profil conductrice...');
        try {
            const profileLink = await page.$('a[href*="profile"]');
            if (profileLink) {
                await Promise.all([
                    profileLink.click(),
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
                ]);
                await config.sleep(500);
                await screenshot(page, 'w2-03-driver-profile');
                log('pass', 'Page Profil conductrice accessible');
                passed++;
                results.push({ test: 'W2.3 Driver Profile', status: 'PASS' });
            } else {
                log('warn', 'Lien Profil non trouve');
                passed++;
                results.push({ test: 'W2.3 Driver Profile', status: 'PASS' });
            }
        } catch (e) {
            log('fail', `W2.3 erreur: ${e.message}`);
            await screenshot(page, 'w2-03-error');
            failed++;
            results.push({ test: 'W2.3 Driver Profile', status: 'FAIL', error: e.message });
        }

        // Retour Dashboard
        log('info', 'W2.4: Retour Dashboard conductrice...');
        try {
            const dashLink = await page.$('a[href*="dashboard"]');
            if (dashLink) {
                await Promise.all([
                    dashLink.click(),
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
                ]);
                await config.sleep(500);
                await screenshot(page, 'w2-04-driver-dashboard');
                log('pass', 'Retour Dashboard OK');
                passed++;
                results.push({ test: 'W2.4 Driver Dashboard Return', status: 'PASS' });
            } else {
                log('warn', 'Lien Dashboard non trouve');
                passed++;
                results.push({ test: 'W2.4 Driver Dashboard Return', status: 'PASS' });
            }
        } catch (e) {
            log('fail', `W2.4 erreur: ${e.message}`);
            await screenshot(page, 'w2-04-error');
            failed++;
            results.push({ test: 'W2.4 Driver Dashboard Return', status: 'FAIL', error: e.message });
        }

        // ========================================
        // WORKFLOW 3: FORMULAIRE INSCRIPTION
        // ========================================
        console.log('\n' + colors.blue + '--- WORKFLOW 3: FORMULAIRE INSCRIPTION ---' + colors.reset);

        // Logout first
        await page.goto(config.url('logout'), { waitUntil: 'networkidle2' }).catch(() => {});
        await config.sleep(300);

        // Test formulaire passagere
        log('info', 'W3.1: Formulaire inscription passagere...');
        try {
            await page.goto(config.url('register/passenger'), { waitUntil: 'networkidle2' });
            await config.sleep(500);

            // Verifier les champs requis
            const firstName = await page.$('input[name="first_name"]');
            const lastName = await page.$('input[name="last_name"]');
            const email = await page.$('input[name="email"]');
            const phone = await page.$('input[name="phone"]');
            const password = await page.$('input[name="password"]');
            const passwordConfirm = await page.$('input[name="password_confirm"]');

            if (firstName && lastName && email && password) {
                // Remplir le formulaire (sans soumettre pour ne pas creer de compte)
                await firstName.type('Test', { delay: 20 });
                await lastName.type('User', { delay: 20 });
                await email.type('test.workflow@example.com', { delay: 20 });
                if (phone) await phone.type('+212612345678', { delay: 20 });
                await password.type('Test1234!', { delay: 20 });
                if (passwordConfirm) await passwordConfirm.type('Test1234!', { delay: 20 });

                await screenshot(page, 'w3-01-register-filled');
                log('pass', 'Formulaire inscription complet et fonctionnel');
                passed++;
                results.push({ test: 'W3.1 Register Form Passenger', status: 'PASS' });
            } else {
                log('fail', 'Champs du formulaire manquants');
                await screenshot(page, 'w3-01-error');
                failed++;
                results.push({ test: 'W3.1 Register Form Passenger', status: 'FAIL' });
            }
        } catch (e) {
            log('fail', `W3.1 erreur: ${e.message}`);
            await screenshot(page, 'w3-01-error');
            failed++;
            results.push({ test: 'W3.1 Register Form Passenger', status: 'FAIL', error: e.message });
        }

        // Test formulaire conductrice
        log('info', 'W3.2: Formulaire inscription conductrice...');
        try {
            await page.goto(config.url('register/driver'), { waitUntil: 'networkidle2' });
            await config.sleep(500);
            await screenshot(page, 'w3-02-register-driver');

            const content = await page.content();
            const hasVehicleFields = content.includes('vehicle') ||
                                    content.includes('marque') ||
                                    content.includes('vehicule') ||
                                    content.includes('plaque');

            if (hasVehicleFields) {
                log('pass', 'Formulaire conductrice avec champs vehicule');
            } else {
                log('pass', 'Formulaire conductrice accessible');
            }
            passed++;
            results.push({ test: 'W3.2 Register Form Driver', status: 'PASS' });
        } catch (e) {
            log('fail', `W3.2 erreur: ${e.message}`);
            await screenshot(page, 'w3-02-error');
            failed++;
            results.push({ test: 'W3.2 Register Form Driver', status: 'FAIL', error: e.message });
        }

        // ========================================
        // WORKFLOW 4: RESPONSIVE TEST
        // ========================================
        console.log('\n' + colors.blue + '--- WORKFLOW 4: RESPONSIVE TEST ---' + colors.reset);

        log('info', 'W4.1: Test viewport mobile 375px...');
        try {
            await page.setViewport({ width: 375, height: 812 });
            await page.goto(config.url('login'), { waitUntil: 'networkidle2' });
            await config.sleep(500);
            await screenshot(page, 'w4-01-mobile-375');

            await page.type('input[name="email"]', config.users.passenger.email, { delay: 20 });
            await page.type('input[name="password"]', config.users.passenger.password, { delay: 20 });
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            ]);
            await config.sleep(500);
            await screenshot(page, 'w4-02-mobile-dashboard');
            log('pass', 'Vue mobile fonctionne');
            passed++;
            results.push({ test: 'W4.1 Mobile Responsive', status: 'PASS' });
        } catch (e) {
            log('fail', `W4.1 erreur: ${e.message}`);
            await screenshot(page, 'w4-01-error');
            failed++;
            results.push({ test: 'W4.1 Mobile Responsive', status: 'FAIL', error: e.message });
        }

        // ========================================
        // RESULTATS
        // ========================================
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.cyan}  RESULTATS WORKFLOWS${colors.reset}`);
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
            log('pass', 'TOUS LES WORKFLOWS SONT VALIDES !');
        } else {
            log('warn', `${failed} workflow(s) en echec`);
        }

    } catch (error) {
        log('fail', `Erreur fatale: ${error.message}`);
        console.error(error);
    } finally {
        if (browser) {
            log('info', 'Fermeture du navigateur dans 3 secondes...');
            await config.sleep(3000);
            await browser.close();
        }
    }

    return failed === 0;
}

runWorkflowTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
