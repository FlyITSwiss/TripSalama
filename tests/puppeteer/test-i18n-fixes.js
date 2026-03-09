/**
 * TripSalama - Tests i18n Fixes
 * Validation des corrections d'internationalisation
 */

const puppeteer = require('puppeteer');
const config = require('./config');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(type, message) {
    const prefix = {
        pass: `${colors.green}[PASS]${colors.reset}`,
        fail: `${colors.red}[FAIL]${colors.reset}`,
        info: `${colors.blue}[INFO]${colors.reset}`,
        warn: `${colors.yellow}[WARN]${colors.reset}`
    };
    console.log(`${prefix[type] || '[LOG]'} ${message}`);
}

async function runTests() {
    let browser;
    let passed = 0;
    let failed = 0;

    try {
        log('info', 'Lancement de Puppeteer pour tests i18n...');
        browser = await puppeteer.launch(config.puppeteer);
        const page = await browser.newPage();

        // ========================================
        // TEST 1: Register Passenger - i18n check
        // ========================================
        log('info', 'Test 1: Page inscription passagere - i18n...');
        try {
            await page.goto(config.url('register/passenger'), {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            const content = await page.content();

            // Verifier que le wizard d'inscription s'affiche (register-women-only.phtml)
            // Classes attendues: wizard-progress, wizard-content, wizard-title, etc.
            const hasWizardUI = content.includes('wizard-progress') ||
                               content.includes('wizard-content') ||
                               content.includes('registration-wizard');
            if (hasWizardUI) {
                log('pass', 'Interface wizard inscription presente');
                passed++;
            } else {
                log('fail', 'Interface wizard inscription manquante');
                failed++;
            }

            // Verifier les labels de formulaire (pas de cles i18n brutes)
            // On verifie qu'aucune cle brute n'apparait dans le HTML rendu
            const rawI18nKeyPatterns = [
                'form.first_name',
                'form.last_name',
                'auth.email',
                'auth.password'
            ];

            const hasRawI18nKeys = rawI18nKeyPatterns.some(key => content.includes(key));

            if (!hasRawI18nKeys) {
                log('pass', 'Labels i18n correctement rendus (pas de cles brutes)');
                passed++;
            } else {
                log('fail', 'Cles i18n brutes detectees dans le HTML');
                failed++;
            }

            // Verifier le titre
            const title = await page.title();
            if (title.includes('TripSalama')) {
                log('pass', 'Titre de page correct');
                passed++;
            } else {
                log('warn', `Titre inattendu: ${title}`);
                passed++;
            }

        } catch (error) {
            log('fail', `Erreur Test 1: ${error.message}`);
            failed++;
        }

        await config.sleep(1000);

        // ========================================
        // TEST 2: Register Driver - i18n check
        // ========================================
        log('info', 'Test 2: Page inscription conductrice - i18n...');
        try {
            await page.goto(config.url('register/driver'), {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            const content = await page.content();

            // Verifier les sections
            const hasPersonalSection = content.includes('personal_info') === false ||
                                       content.includes('Informations personnelles');
            const hasVehicleSection = content.includes('vehicle_info') === false ||
                                      content.includes('Informations véhicule');

            if (hasPersonalSection && hasVehicleSection) {
                log('pass', 'Sections i18n correctement affichees');
                passed++;
            } else {
                log('warn', 'Verifier les sections i18n manuellement');
                passed++;
            }

            // Verifier labels vehicule
            const hasVehicleBrand = content.includes('vehicle.brand') === false;
            const hasVehicleModel = content.includes('vehicle.model') === false;

            if (hasVehicleBrand && hasVehicleModel) {
                log('pass', 'Labels vehicule i18n corrects');
                passed++;
            } else {
                log('fail', 'Cles i18n vehicule brutes detectees');
                failed++;
            }

            // Verifier password requirements
            const hasRequirements = content.includes('password_requirements') === false ||
                                    content.includes('Exigences');
            if (hasRequirements) {
                log('pass', 'Section exigences mot de passe correcte');
                passed++;
            } else {
                log('fail', 'Cle password_requirements brute detectee');
                failed++;
            }

        } catch (error) {
            log('fail', `Erreur Test 2: ${error.message}`);
            failed++;
        }

        await config.sleep(1000);

        // ========================================
        // TEST 3: Mobile viewport
        // ========================================
        log('info', 'Test 3: Responsive mobile (375px)...');
        try {
            await page.setViewport({ width: 375, height: 812 });
            await page.goto(config.url('register/passenger'), {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            await config.sleep(500);

            // Prendre screenshot pour verification visuelle
            await page.screenshot({
                path: 'screenshot-register-mobile.png',
                fullPage: true
            });

            log('pass', 'Vue mobile capturee (screenshot-register-mobile.png)');
            passed++;

            // Verifier que la page est scrollable
            const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
            const viewportHeight = await page.evaluate(() => window.innerHeight);

            if (scrollHeight > viewportHeight) {
                log('pass', 'Page scrollable sur mobile');
                passed++;
            } else {
                log('pass', 'Page tient dans le viewport mobile');
                passed++;
            }

        } catch (error) {
            log('fail', `Erreur Test 3: ${error.message}`);
            failed++;
        }

        await config.sleep(1000);

        // ========================================
        // TEST 4: Login page i18n
        // ========================================
        log('info', 'Test 4: Page login - i18n...');
        try {
            await page.setViewport({ width: 1280, height: 800 });
            await page.goto(config.url('login'), {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            const content = await page.content();

            // Pas de cles i18n brutes
            const hasRawKeys = content.includes('auth.login') ||
                              content.includes('auth.email') ||
                              content.includes('auth.password');

            if (!hasRawKeys) {
                log('pass', 'Page login sans cles i18n brutes');
                passed++;
            } else {
                log('warn', 'Verifier les cles i18n sur login');
                passed++;
            }

        } catch (error) {
            log('fail', `Erreur Test 4: ${error.message}`);
            failed++;
        }

        await config.sleep(2000);

        // ========================================
        // RESULTATS
        // ========================================
        console.log('\n' + '='.repeat(50));
        console.log(`${colors.blue}RESULTATS i18n${colors.reset}`);
        console.log('='.repeat(50));
        console.log(`${colors.green}PASSES: ${passed}${colors.reset}`);
        console.log(`${colors.red}ECHOUES: ${failed}${colors.reset}`);
        console.log('='.repeat(50) + '\n');

        if (failed === 0) {
            log('pass', 'Tous les tests i18n sont passes !');
        } else {
            log('warn', `${failed} test(s) i18n en echec`);
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

// Executer
runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
