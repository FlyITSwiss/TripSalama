/**
 * TripSalama - Test Admin Production
 * Test visuel de l'interface admin avec screenshots
 */

const puppeteer = require('puppeteer');
const config = require('./config-prod');

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
    const filename = `screenshots/admin-prod-${name}-${timestamp}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    log('screen', `Saved: ${filename}`);
    return filename;
}

async function runAdminTest() {
    const screenshots = [];
    let browser;
    let passed = 0;
    let failed = 0;

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.cyan}TripSalama - TEST ADMIN PRODUCTION${colors.reset}`);
    console.log('='.repeat(60));
    console.log(`URL: ${config.baseUrl}`);
    console.log(`Admin: ${config.users.admin.email}\n`);

    try {
        browser = await puppeteer.launch({
            headless: false,
            slowMo: 100,
            defaultViewport: { width: 1280, height: 900 },
            args: ['--no-sandbox', '--start-maximized']
        });

        const page = await browser.newPage();

        // Capture des erreurs
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`${colors.red}[CONSOLE]${colors.reset} ${msg.text().substring(0, 100)}`);
            }
        });

        // ===== ETAPE 1: Page Login Admin =====
        log('info', 'ETAPE 1: Page login...');
        await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2' });
        await sleep(1000);
        screenshots.push(await screenshot(page, '01-login'));

        // ===== ETAPE 2: Login Admin =====
        log('info', 'ETAPE 2: Login admin...');
        await page.type('input[name="email"]', config.users.admin.email, { delay: 50 });
        await page.type('input[name="password"]', config.users.admin.password, { delay: 50 });
        await sleep(500);
        screenshots.push(await screenshot(page, '02-login-filled'));

        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
        ]);
        await sleep(1000);

        const afterLoginUrl = page.url();
        log('info', `URL apres login: ${afterLoginUrl}`);

        if (!afterLoginUrl.includes('login')) {
            log('pass', 'Login admin reussi');
            passed++;
        } else {
            log('fail', 'Login admin echoue');
            failed++;
            screenshots.push(await screenshot(page, '02-login-failed'));
        }

        // ===== ETAPE 3: Admin Dashboard =====
        log('info', 'ETAPE 3: Admin Dashboard...');
        await page.goto(config.baseUrl + '/admin/dashboard', { waitUntil: 'networkidle2' });
        await sleep(2000);
        screenshots.push(await screenshot(page, '03-admin-dashboard'));

        const dashboardUrl = page.url();
        if (dashboardUrl.includes('admin')) {
            log('pass', 'Admin dashboard accessible');
            passed++;

            // Verifier les elements du dashboard
            const hasStats = await page.evaluate(() => {
                return document.body.textContent.includes('users') ||
                       document.body.textContent.includes('rides') ||
                       document.body.textContent.includes('Utilisateurs') ||
                       document.querySelector('.stat-card') !== null;
            });

            if (hasStats) {
                log('pass', 'Statistiques affichees');
                passed++;
            } else {
                log('info', 'Statistiques non detectees');
            }
        } else {
            log('fail', 'Redirection non-admin');
            failed++;
        }

        // ===== ETAPE 4: Admin Settings =====
        log('info', 'ETAPE 4: Admin Settings...');
        await page.goto(config.baseUrl + '/admin/settings', { waitUntil: 'networkidle2' });
        await sleep(2000);
        screenshots.push(await screenshot(page, '04-admin-settings'));

        const settingsUrl = page.url();
        if (settingsUrl.includes('admin/settings')) {
            log('pass', 'Page settings accessible');
            passed++;

            // Verifier les sections
            const sections = await page.evaluate(() => {
                return {
                    hasSafetySection: document.body.textContent.includes('safety') ||
                                      document.body.textContent.includes('Safety') ||
                                      document.body.textContent.includes('securite'),
                    hasSMSSection: document.body.textContent.includes('SMS') ||
                                   document.body.textContent.includes('sms'),
                    hasSOSSection: document.body.textContent.includes('SOS') ||
                                   document.body.textContent.includes('sos'),
                    hasChecklistSection: document.body.textContent.includes('checklist') ||
                                         document.body.textContent.includes('Checklist'),
                    hasToggleSwitches: document.querySelectorAll('.toggle-switch, input[type="checkbox"]').length > 0,
                    hasForm: document.querySelector('form') !== null,
                    hasSubmitBtn: document.querySelector('button[type="submit"]') !== null
                };
            });

            console.log('   Sections detectees:', sections);

            if (sections.hasForm) {
                log('pass', 'Formulaire settings present');
                passed++;
            } else {
                log('fail', 'Formulaire settings manquant');
                failed++;
            }

            if (sections.hasToggleSwitches) {
                log('pass', 'Toggle switches presents');
                passed++;
            }

            if (sections.hasSubmitBtn) {
                log('pass', 'Bouton submit present');
                passed++;
            }

        } else {
            log('fail', 'Page settings non accessible');
            failed++;
        }

        // ===== ETAPE 5: Scroll page settings =====
        log('info', 'ETAPE 5: Scroll complet de la page...');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(1000);
        screenshots.push(await screenshot(page, '05-settings-bottom'));

        // ===== ETAPE 6: Stats Cards =====
        log('info', 'ETAPE 6: Verification stats cards...');
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(500);

        const statsCards = await page.evaluate(() => {
            const cards = document.querySelectorAll('.stat-card');
            return {
                count: cards.length,
                values: Array.from(cards).map(card => {
                    const value = card.querySelector('.stat-card-value');
                    const label = card.querySelector('.stat-card-label');
                    return {
                        value: value ? value.textContent.trim() : 'N/A',
                        label: label ? label.textContent.trim() : 'N/A'
                    };
                })
            };
        });

        if (statsCards.count > 0) {
            log('pass', `${statsCards.count} stats cards trouvees`);
            statsCards.values.forEach(card => {
                console.log(`   - ${card.label}: ${card.value}`);
            });
            passed++;
        } else {
            log('info', 'No stats cards detected');
        }

        screenshots.push(await screenshot(page, '06-stats-cards'));

        // ===== ETAPE 7: Test toggle switch =====
        log('info', 'ETAPE 7: Test interaction toggle...');
        const toggles = await page.$$('.toggle-switch input');
        if (toggles.length > 0) {
            const firstToggle = toggles[0];
            const initialState = await page.evaluate(el => el.checked, firstToggle);
            log('info', `Toggle initial: ${initialState ? 'ON' : 'OFF'}`);

            // Cliquer pour changer l'etat
            await firstToggle.click();
            await sleep(500);

            const newState = await page.evaluate(el => el.checked, firstToggle);
            log('info', `Toggle apres click: ${newState ? 'ON' : 'OFF'}`);

            if (initialState !== newState) {
                log('pass', 'Toggle switch fonctionne');
                passed++;
            }

            // Remettre l'etat initial
            await firstToggle.click();
            await sleep(300);
        }

        screenshots.push(await screenshot(page, '07-toggle-test'));

        // ===== ETAPE 8: Logout =====
        log('info', 'ETAPE 8: Deconnexion...');
        await page.goto(config.baseUrl + '/logout', { waitUntil: 'networkidle2' });
        await sleep(1000);
        screenshots.push(await screenshot(page, '08-logout'));

        // ===== RESUME =====
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.cyan}RESULTATS ADMIN TEST${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`${colors.green}PASSES: ${passed}${colors.reset}`);
        console.log(`${colors.red}ECHOUES: ${failed}${colors.reset}`);
        console.log(`Screenshots: ${screenshots.length}`);
        console.log('='.repeat(60));

        screenshots.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

        // Garder ouvert pour inspection
        log('info', 'Navigateur ouvert pendant 20s pour inspection...');
        await sleep(20000);

    } catch (error) {
        log('fail', `Erreur: ${error.message}`);
        console.error(error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    return { passed, failed, screenshots };
}

// Executer
runAdminTest()
    .then(result => {
        console.log(`\nTotal: ${result.passed} passes, ${result.failed} echecs`);
        process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
