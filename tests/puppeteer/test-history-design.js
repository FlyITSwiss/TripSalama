/**
 * TripSalama - Test Design Historique
 * Test visuel pour le nouveau design de l'historique des courses
 */

const puppeteer = require('puppeteer');
const config = require('./config');
const path = require('path');

// Couleurs console
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(type, message) {
    const prefix = {
        pass: `${colors.green}[PASS]${colors.reset}`,
        fail: `${colors.red}[FAIL]${colors.reset}`,
        info: `${colors.blue}[INFO]${colors.reset}`,
        warn: `${colors.yellow}[WARN]${colors.reset}`,
        step: `${colors.cyan}[STEP]${colors.reset}`
    };
    console.log(`${prefix[type] || '[LOG]'} ${message}`);
}

async function runTests() {
    let browser;
    const screenshotsDir = path.join(__dirname, 'screenshots');

    try {
        log('info', '='.repeat(50));
        log('info', 'TEST DESIGN HISTORIQUE DES COURSES');
        log('info', '='.repeat(50));
        log('info', '');

        log('step', 'Lancement de Puppeteer en mode visuel...');
        browser = await puppeteer.launch({
            ...config.puppeteer,
            headless: false,
            slowMo: 100,
            defaultViewport: {
                width: 1440,
                height: 900
            }
        });

        const page = await browser.newPage();

        // ========================================
        // ÉTAPE 1: Connexion
        // ========================================
        log('step', '1/4 - Connexion au compte passager...');

        await page.goto(config.url('login'), {
            waitUntil: 'networkidle2',
            timeout: config.timeout.navigation
        });

        await page.type('input[name="email"]', config.users.passenger.email, { delay: 30 });
        await page.type('input[name="password"]', config.users.passenger.password, { delay: 30 });

        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
        ]);

        await config.sleep(1000);

        const loginSuccess = !page.url().includes('login');
        if (loginSuccess) {
            log('pass', 'Connexion réussie !');
        } else {
            log('warn', 'Possible échec de connexion, continuation du test...');
        }

        // ========================================
        // ÉTAPE 2: Navigation vers Historique
        // ========================================
        log('step', '2/4 - Navigation vers la page Historique...');

        await page.goto(config.url('passenger/history'), {
            waitUntil: 'networkidle2',
            timeout: config.timeout.navigation
        });

        await config.sleep(1000);

        // Vérifier que la page s'affiche
        const pageTitle = await page.$eval('.history-title', el => el.textContent).catch(() => null);
        if (pageTitle) {
            log('pass', `Page Historique chargée: "${pageTitle}"`);
        } else {
            log('warn', 'Titre de page non trouvé');
        }

        // ========================================
        // ÉTAPE 3: Capture Desktop
        // ========================================
        log('step', '3/4 - Capture écran Desktop (1440px)...');

        await page.screenshot({
            path: path.join(screenshotsDir, 'history-desktop.png'),
            fullPage: true
        });
        log('pass', 'Screenshot Desktop sauvegardé: screenshots/history-desktop.png');

        // Vérifier les éléments du design
        const hasStats = await page.$('.history-stats');
        const hasList = await page.$('.history-list, .history-empty-state');
        const hasCards = await page.$$('.history-card');

        if (hasStats) {
            log('pass', 'Section statistiques présente');
        }

        if (hasList) {
            log('pass', 'Liste ou état vide présent');
        }

        log('info', `Nombre de cartes de course: ${hasCards.length}`);

        // ========================================
        // ÉTAPE 4: Capture Tablette
        // ========================================
        log('step', '4/4 - Capture écran Tablette (768px)...');

        await page.setViewport({ width: 768, height: 1024 });
        await config.sleep(500);

        await page.screenshot({
            path: path.join(screenshotsDir, 'history-tablet.png'),
            fullPage: true
        });
        log('pass', 'Screenshot Tablette sauvegardé: screenshots/history-tablet.png');

        // Capture Mobile
        log('step', 'Bonus - Capture écran Mobile (375px)...');

        await page.setViewport({ width: 375, height: 812 });
        await config.sleep(500);

        await page.screenshot({
            path: path.join(screenshotsDir, 'history-mobile.png'),
            fullPage: true
        });
        log('pass', 'Screenshot Mobile sauvegardé: screenshots/history-mobile.png');

        // ========================================
        // RÉSULTAT
        // ========================================
        log('info', '');
        log('info', '='.repeat(50));
        log('pass', 'TEST TERMINÉ AVEC SUCCÈS !');
        log('info', '='.repeat(50));
        log('info', '');
        log('info', 'Screenshots générés dans: tests/puppeteer/screenshots/');
        log('info', '  - history-desktop.png (1440px)');
        log('info', '  - history-tablet.png (768px)');
        log('info', '  - history-mobile.png (375px)');
        log('info', '');
        log('info', 'Le navigateur reste ouvert pour inspection visuelle.');
        log('info', 'Fermez le navigateur manuellement quand vous avez terminé.');

        // Garder le navigateur ouvert pour inspection
        await new Promise(resolve => setTimeout(resolve, 60000 * 5)); // 5 minutes

    } catch (error) {
        log('fail', `Erreur: ${error.message}`);
        console.error(error);

        if (browser) {
            await browser.close();
        }
        process.exit(1);
    }
}

// Exécution
runTests();
