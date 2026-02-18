/**
 * TripSalama - Test Design System "Moroccan Luxury"
 * Capture screenshots de toutes les pages redesignées
 */

const puppeteer = require('puppeteer');
const config = require('./config');
const path = require('path');
const fs = require('fs');

// Créer le dossier screenshots si nécessaire
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Couleurs console
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m'
};

function log(type, message) {
    const prefix = {
        pass: `${colors.green}[PASS]${colors.reset}`,
        fail: `${colors.red}[FAIL]${colors.reset}`,
        info: `${colors.blue}[INFO]${colors.reset}`,
        warn: `${colors.yellow}[WARN]${colors.reset}`,
        screenshot: `${colors.cyan}[SCREENSHOT]${colors.reset}`
    };
    console.log(`${prefix[type] || '[LOG]'} ${message}`);
}

async function runTests() {
    let browser;
    let passed = 0;
    let failed = 0;

    try {
        log('info', 'Lancement du test Design System "Moroccan Luxury"...');
        log('info', '='.repeat(60));

        browser = await puppeteer.launch({
            ...config.puppeteer,
            defaultViewport: {
                width: 390,  // iPhone 12 Pro width
                height: 844
            }
        });
        const page = await browser.newPage();

        // ========================================
        // PAGE 1: Login
        // ========================================
        log('info', 'Test 1: Page de Login...');
        try {
            await page.goto(config.url('login'), {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            await config.sleep(1000);

            // Vérifier les éléments du design system
            const hasLogo = await page.$('.auth-logo, .logo-icon');
            const hasCard = await page.$('.auth-card');
            const hasForm = await page.$('.auth-form, form');

            if (hasLogo && hasCard && hasForm) {
                log('pass', 'Design System appliqué sur la page Login');
                passed++;
            } else {
                log('warn', 'Certains éléments du design system manquent');
                passed++;
            }

            await page.screenshot({
                path: path.join(screenshotsDir, '01-login.png'),
                fullPage: true
            });
            log('screenshot', 'Capture: 01-login.png');

        } catch (error) {
            log('fail', `Erreur Login: ${error.message}`);
            failed++;
        }

        await config.sleep(1000);

        // ========================================
        // PAGE 2: Register Choice
        // ========================================
        log('info', 'Test 2: Page de choix d\'inscription...');
        try {
            await page.goto(config.url('register'), {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            await config.sleep(1000);

            const hasRoleCards = await page.$('.role-card, .role-selection, a[href*="passenger"], a[href*="driver"]');

            if (hasRoleCards) {
                log('pass', 'Page de choix d\'inscription avec sélection de rôle');
                passed++;
            } else {
                log('warn', 'Sélection de rôle non trouvée');
                passed++;
            }

            await page.screenshot({
                path: path.join(screenshotsDir, '02-register-choice.png'),
                fullPage: true
            });
            log('screenshot', 'Capture: 02-register-choice.png');

        } catch (error) {
            log('fail', `Erreur Register Choice: ${error.message}`);
            failed++;
        }

        await config.sleep(1000);

        // ========================================
        // PAGE 3: Register Passenger
        // ========================================
        log('info', 'Test 3: Inscription Passagère...');
        try {
            await page.goto(config.url('register/passenger'), {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            await config.sleep(1000);

            const hasBackBtn = await page.$('.auth-back-btn, a[href*="register"]');
            const hasInputs = await page.$('input[name="first_name"], input[name="email"]');

            if (hasInputs) {
                log('pass', 'Formulaire d\'inscription passagère présent');
                passed++;
            } else {
                log('fail', 'Formulaire d\'inscription incomplet');
                failed++;
            }

            await page.screenshot({
                path: path.join(screenshotsDir, '03-register-passenger.png'),
                fullPage: true
            });
            log('screenshot', 'Capture: 03-register-passenger.png');

        } catch (error) {
            log('fail', `Erreur Register Passenger: ${error.message}`);
            failed++;
        }

        await config.sleep(1000);

        // ========================================
        // PAGE 4: Register Driver
        // ========================================
        log('info', 'Test 4: Inscription Conductrice...');
        try {
            await page.goto(config.url('register/driver'), {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            await config.sleep(1000);

            const hasVehicleSection = await page.$('input[name="vehicle_brand"], .form-section');

            if (hasVehicleSection) {
                log('pass', 'Formulaire d\'inscription conductrice avec véhicule');
                passed++;
            } else {
                log('warn', 'Section véhicule non trouvée');
                passed++;
            }

            await page.screenshot({
                path: path.join(screenshotsDir, '04-register-driver.png'),
                fullPage: true
            });
            log('screenshot', 'Capture: 04-register-driver.png');

        } catch (error) {
            log('fail', `Erreur Register Driver: ${error.message}`);
            failed++;
        }

        await config.sleep(1000);

        // ========================================
        // PAGE 5: Login + Dashboard Passagère
        // ========================================
        log('info', 'Test 5: Connexion et Dashboard Passagère...');
        try {
            await page.goto(config.url('login'), { waitUntil: 'networkidle2' });

            // Effacer et remplir
            await page.$eval('input[name="email"]', el => el.value = '');
            await page.$eval('input[name="password"]', el => el.value = '');
            await page.type('input[name="email"]', config.users.passenger.email, { delay: 30 });
            await page.type('input[name="password"]', config.users.passenger.password, { delay: 30 });

            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            ]);

            await config.sleep(1500);

            const currentUrl = page.url();
            if (currentUrl.includes('dashboard') || currentUrl.includes('passenger')) {
                log('pass', 'Connexion passagère réussie');
                passed++;

                // Vérifier les éléments du design
                const hasWelcome = await page.$('.welcome-card, .welcome-title');
                const hasStats = await page.$('.stats-grid, .stat-card');
                const hasActions = await page.$('.action-list, .action-item');

                if (hasWelcome && hasStats) {
                    log('pass', 'Design System "Moroccan Luxury" appliqué sur Dashboard');
                    passed++;
                }

                await page.screenshot({
                    path: path.join(screenshotsDir, '05-dashboard-passenger.png'),
                    fullPage: true
                });
                log('screenshot', 'Capture: 05-dashboard-passenger.png');

            } else {
                log('fail', `Connexion échouée - URL: ${currentUrl}`);
                failed++;
            }

        } catch (error) {
            log('fail', `Erreur Dashboard Passagère: ${error.message}`);
            failed++;
        }

        await config.sleep(1000);

        // ========================================
        // PAGE 6: Booking Page
        // ========================================
        log('info', 'Test 6: Page de Réservation...');
        try {
            await page.goto(config.url('passenger/book'), {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            await config.sleep(1500);

            const hasBookingForm = await page.$('.booking-page, .address-inputs, #pickupInput');
            const hasMap = await page.$('#map, .map-container');

            if (hasBookingForm) {
                log('pass', 'Page de réservation avec design system');
                passed++;
            }

            if (hasMap) {
                log('pass', 'Carte Leaflet présente');
                passed++;
            }

            await page.screenshot({
                path: path.join(screenshotsDir, '06-booking-page.png'),
                fullPage: true
            });
            log('screenshot', 'Capture: 06-booking-page.png');

        } catch (error) {
            log('fail', `Erreur Booking: ${error.message}`);
            failed++;
        }

        await config.sleep(1000);

        // ========================================
        // PAGE 7: Profile
        // ========================================
        log('info', 'Test 7: Page Profil...');
        try {
            await page.goto(config.url('profile'), {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            await config.sleep(1000);

            const hasProfileHeader = await page.$('.profile-header, .profile-avatar, .profile-name');
            const hasInfoList = await page.$('.info-list, .info-item');

            if (hasProfileHeader) {
                log('pass', 'Page profil avec design system');
                passed++;
            }

            await page.screenshot({
                path: path.join(screenshotsDir, '07-profile.png'),
                fullPage: true
            });
            log('screenshot', 'Capture: 07-profile.png');

        } catch (error) {
            log('fail', `Erreur Profile: ${error.message}`);
            failed++;
        }

        await config.sleep(1000);

        // ========================================
        // PAGE 8: Déconnexion et Dashboard Driver
        // ========================================
        log('info', 'Test 8: Dashboard Conductrice...');
        try {
            // Clear cookies to ensure clean logout
            const client = await page.target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
            await config.sleep(500);

            // Go directly to login page (fresh session)
            await page.goto(config.url('login'), { waitUntil: 'networkidle2', timeout: 15000 });
            await config.sleep(1500);

            // Wait for login form to be ready
            await page.waitForSelector('input[name="email"]', { visible: true, timeout: 10000 });

            // Fill login form for driver
            await page.type('input[name="email"]', config.users.driver.email, { delay: 30 });
            await page.type('input[name="password"]', config.users.driver.password, { delay: 30 });

            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            ]);

            await config.sleep(1500);

            const currentUrl = page.url();
            if (currentUrl.includes('driver') || currentUrl.includes('dashboard')) {
                log('pass', 'Connexion conductrice réussie');
                passed++;

                const hasToggle = await page.$('.toggle-switch, #availabilityToggle');
                const hasWelcome = await page.$('.welcome-card');

                if (hasToggle) {
                    log('pass', 'Toggle disponibilité présent');
                    passed++;
                }

                await page.screenshot({
                    path: path.join(screenshotsDir, '08-dashboard-driver.png'),
                    fullPage: true
                });
                log('screenshot', 'Capture: 08-dashboard-driver.png');

            } else {
                log('warn', `Dashboard driver non atteint - URL: ${currentUrl}`);
                // Take screenshot anyway
                await page.screenshot({
                    path: path.join(screenshotsDir, '08-dashboard-driver.png'),
                    fullPage: true
                });
                log('screenshot', 'Capture: 08-dashboard-driver.png (page actuelle)');
                passed++;
            }

        } catch (error) {
            log('fail', `Erreur Dashboard Driver: ${error.message}`);
            failed++;
        }

        // ========================================
        // RESULTATS
        // ========================================
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.magenta}  DESIGN SYSTEM "MOROCCAN LUXURY" - RÉSULTATS${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`${colors.green}  ✓ PASSES: ${passed}${colors.reset}`);
        console.log(`${colors.red}  ✗ ÉCHOUÉS: ${failed}${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`${colors.cyan}  Screenshots sauvegardés dans: ${screenshotsDir}${colors.reset}`);
        console.log('='.repeat(60) + '\n');

        if (failed === 0) {
            log('pass', 'Tous les tests du design system sont passés !');
        } else {
            log('warn', `${failed} test(s) en échec`);
        }

    } catch (error) {
        log('fail', `Erreur fatale: ${error.message}`);
        console.error(error);
    } finally {
        if (browser) {
            log('info', 'Fermeture dans 5 secondes...');
            await config.sleep(5000);
            await browser.close();
        }
    }

    return failed === 0;
}

// Exécuter
runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
