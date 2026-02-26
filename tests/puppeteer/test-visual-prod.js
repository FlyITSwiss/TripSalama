/**
 * TripSalama - Test Visuel Production avec Screenshots
 * Test complet avec capture d'ecran a chaque etape
 */

const puppeteer = require('puppeteer');
const config = require('./config-prod');
const path = require('path');

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
        screen: `${colors.cyan}[SCREEN]${colors.reset}`
    };
    console.log(`${prefix[type] || '[LOG]'} ${message}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function screenshot(page, name) {
    const timestamp = Date.now();
    const filename = `screenshots/visual-prod-${name}-${timestamp}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    log('screen', `Saved: ${filename}`);
    return filename;
}

async function runVisualTest() {
    const screenshots = [];
    let browser;

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.cyan}TripSalama - TEST VISUEL PRODUCTION${colors.reset}`);
    console.log('='.repeat(60));
    console.log(`URL: ${config.baseUrl}`);
    console.log(`Date: ${new Date().toISOString()}\n`);

    try {
        browser = await puppeteer.launch({
            headless: false,
            slowMo: 100,
            defaultViewport: { width: 1280, height: 800 },
            args: ['--no-sandbox', '--start-maximized']
        });

        const page = await browser.newPage();

        // ===== ETAPE 1: Page Login =====
        log('info', 'ETAPE 1: Page de connexion...');
        await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2' });
        await sleep(1000);
        screenshots.push(await screenshot(page, '01-login'));

        // ===== ETAPE 2: Remplir login =====
        log('info', 'ETAPE 2: Remplissage formulaire...');
        await page.type('input[name="email"]', config.users.passenger.email, { delay: 50 });
        await page.type('input[name="password"]', config.users.passenger.password, { delay: 50 });
        await sleep(500);
        screenshots.push(await screenshot(page, '02-login-filled'));

        // ===== ETAPE 3: Soumettre login =====
        log('info', 'ETAPE 3: Soumission login...');
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
        ]);
        await sleep(1000);
        screenshots.push(await screenshot(page, '03-dashboard'));

        const dashboardUrl = page.url();
        log('info', `URL apres login: ${dashboardUrl}`);

        // ===== ETAPE 4: Page Booking =====
        log('info', 'ETAPE 4: Navigation vers booking...');
        await page.goto(config.baseUrl + '/passenger/book', { waitUntil: 'networkidle2' });
        await sleep(2000);
        screenshots.push(await screenshot(page, '04-booking-page'));

        // ===== ETAPE 5: Attendre carte =====
        log('info', 'ETAPE 5: Attente chargement carte...');
        await sleep(3000);
        screenshots.push(await screenshot(page, '05-map-loaded'));

        // ===== ETAPE 6: Test autocomplete dropoff =====
        log('info', 'ETAPE 6: Test autocomplete destination...');
        const dropoffInput = await page.$('#dropoffInput');
        if (dropoffInput) {
            await dropoffInput.click();
            await dropoffInput.type('Casablanca', { delay: 80 });
            await sleep(3000);
            screenshots.push(await screenshot(page, '06-autocomplete-casablanca'));

            // Verifier dropdown
            const dropdownVisible = await page.evaluate(() => {
                const dropdown = document.getElementById('dropoffDropdown');
                return dropdown && !dropdown.classList.contains('hidden');
            });

            if (dropdownVisible) {
                log('pass', 'Autocomplete affiche des resultats');

                // Cliquer sur premier resultat
                const firstResult = await page.$('#dropoffDropdown .autocomplete-item');
                if (firstResult) {
                    await firstResult.click();
                    await sleep(1000);
                    screenshots.push(await screenshot(page, '07-destination-selected'));
                }
            } else {
                log('info', 'Dropdown non visible');
            }
        }

        // ===== ETAPE 7: Test autocomplete pickup =====
        log('info', 'ETAPE 7: Test autocomplete depart...');
        const pickupInput = await page.$('#pickupInput');
        if (pickupInput) {
            await pickupInput.click({ clickCount: 3 });
            await pickupInput.type('Rabat', { delay: 80 });
            await sleep(3000);
            screenshots.push(await screenshot(page, '08-autocomplete-rabat'));
        }

        // ===== ETAPE 8: Verifier estimation =====
        log('info', 'ETAPE 8: Verification estimation prix...');
        await sleep(2000);
        const hasEstimation = await page.evaluate(() => {
            const card = document.getElementById('estimationCard');
            return card && !card.classList.contains('hidden');
        });

        if (hasEstimation) {
            log('pass', 'Estimation prix affichee');
        }
        screenshots.push(await screenshot(page, '09-estimation'));

        // ===== ETAPE 9: Page historique =====
        log('info', 'ETAPE 9: Page historique...');
        await page.goto(config.baseUrl + '/passenger/history', { waitUntil: 'networkidle2' });
        await sleep(1000);
        screenshots.push(await screenshot(page, '10-history'));

        // ===== ETAPE 10: Logout =====
        log('info', 'ETAPE 10: Deconnexion...');
        await page.goto(config.baseUrl + '/logout', { waitUntil: 'networkidle2' });
        await sleep(1000);
        screenshots.push(await screenshot(page, '11-logout'));

        // ===== RESUME =====
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.green}TEST VISUEL TERMINE${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`Screenshots captures: ${screenshots.length}`);
        screenshots.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
        console.log('='.repeat(60));

        // Garder ouvert pour inspection
        log('info', 'Navigateur ouvert pendant 30s pour inspection...');
        await sleep(30000);

    } catch (error) {
        log('fail', `Erreur: ${error.message}`);
        console.error(error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    return screenshots;
}

// Executer
runVisualTest()
    .then(screenshots => {
        console.log(`\nTotal screenshots: ${screenshots.length}`);
        process.exit(0);
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
