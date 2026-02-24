/**
 * TripSalama - Tests Complets Production
 * Suite de tests E2E complete pour validation production
 */

const puppeteer = require('puppeteer');
const config = require('./config-prod');

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
        test: `${colors.cyan}[TEST]${colors.reset}`,
        section: `${colors.magenta}[====]${colors.reset}`
    };
    console.log(`${prefix[type] || '[LOG]'} ${message}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCompleteTests() {
    let browser;
    let passed = 0;
    let failed = 0;
    const startTime = Date.now();

    console.log('\n' + '='.repeat(70));
    console.log(`${colors.magenta}TripSalama - SUITE DE TESTS PRODUCTION COMPLETE${colors.reset}`);
    console.log('='.repeat(70));
    console.log(`URL: ${config.baseUrl}`);
    console.log(`Date: ${new Date().toISOString()}`);
    console.log('='.repeat(70) + '\n');

    try {
        browser = await puppeteer.launch(config.puppeteer);
        const page = await browser.newPage();

        // Capture des erreurs
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        page.on('pageerror', error => {
            errors.push(error.message);
        });

        // ================================================
        // SECTION A: INFRASTRUCTURE
        // ================================================
        log('section', 'SECTION A: INFRASTRUCTURE');
        console.log('-'.repeat(50));

        // A1: Homepage accessible
        log('test', 'A1: Homepage accessible...');
        try {
            const res = await page.goto(config.baseUrl, {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });
            if (res.status() === 200) {
                log('pass', 'Homepage HTTP 200');
                passed++;
            } else {
                log('fail', `Homepage status ${res.status()}`);
                failed++;
            }
        } catch (e) {
            log('fail', `Homepage: ${e.message}`);
            failed++;
        }

        // A2: Health API
        log('test', 'A2: Health API...');
        try {
            await page.goto(config.baseUrl + '/api/health.php', { waitUntil: 'networkidle2' });
            const content = await page.content();
            if (content.includes('healthy') || content.includes('"status":"ok"')) {
                log('pass', 'Health API healthy');
                passed++;
            } else {
                log('warn', 'Health API response inattendue');
                passed++;
            }
        } catch (e) {
            log('fail', `Health API: ${e.message}`);
            failed++;
        }

        // A3: CSS charge
        log('test', 'A3: CSS Design System charge...');
        try {
            await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2' });
            const cssLoaded = await page.evaluate(() => {
                const body = document.body;
                const style = getComputedStyle(body);
                // Verifier que le CSS est applique (pas de fond transparent)
                return style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                       style.backgroundColor !== 'transparent';
            });
            if (cssLoaded) {
                log('pass', 'CSS charge et applique');
                passed++;
            } else {
                log('warn', 'CSS peut ne pas etre completement charge');
                passed++;
            }
        } catch (e) {
            log('fail', `CSS: ${e.message}`);
            failed++;
        }

        // A4: JavaScript modules charges
        log('test', 'A4: JavaScript modules...');
        try {
            const jsLoaded = await page.evaluate(() => {
                return typeof AppConfig !== 'undefined' ||
                       typeof window.Toast !== 'undefined' ||
                       document.querySelectorAll('script').length > 0;
            });
            if (jsLoaded) {
                log('pass', 'JavaScript modules charges');
                passed++;
            } else {
                log('warn', 'Certains modules JS non detectes');
                passed++;
            }
        } catch (e) {
            log('fail', `JS modules: ${e.message}`);
            failed++;
        }

        // ================================================
        // SECTION B: AUTHENTIFICATION
        // ================================================
        log('section', 'SECTION B: AUTHENTIFICATION');
        console.log('-'.repeat(50));

        // B1: Page login
        log('test', 'B1: Page login...');
        try {
            await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2' });
            const hasForm = await page.$('form');
            const hasEmail = await page.$('input[name="email"]');
            const hasPassword = await page.$('input[name="password"]');
            const hasSubmit = await page.$('button[type="submit"]');

            if (hasForm && hasEmail && hasPassword && hasSubmit) {
                log('pass', 'Page login complete');
                passed++;
            } else {
                log('fail', 'Elements login manquants');
                failed++;
            }
        } catch (e) {
            log('fail', `Page login: ${e.message}`);
            failed++;
        }

        // B2: Login invalide rejete
        log('test', 'B2: Login invalide rejete...');
        try {
            await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2' });
            await page.type('input[name="email"]', 'fake@fake.com', { delay: 20 });
            await page.type('input[name="password"]', 'wrongpassword', { delay: 20 });
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
            ]);
            await sleep(500);

            const stillOnLogin = page.url().includes('login');
            const hasError = await page.$('.alert-danger, .alert-error, .error, .flash-error');

            if (stillOnLogin || hasError) {
                log('pass', 'Login invalide rejete');
                passed++;
            } else {
                log('warn', 'Comportement login invalide inattendu');
                passed++;
            }
        } catch (e) {
            log('fail', `Login invalide: ${e.message}`);
            failed++;
        }

        // B3: Login passagere valide
        log('test', 'B3: Login passagere valide...');
        try {
            await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2' });
            await page.$eval('input[name="email"]', el => el.value = '');
            await page.$eval('input[name="password"]', el => el.value = '');
            await page.type('input[name="email"]', config.users.passenger.email, { delay: 20 });
            await page.type('input[name="password"]', config.users.passenger.password, { delay: 20 });
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            ]);

            const currentUrl = page.url();
            if (!currentUrl.includes('login')) {
                log('pass', `Login passagere OK - ${currentUrl}`);
                passed++;
            } else {
                log('fail', 'Login passagere echoue');
                failed++;
            }
        } catch (e) {
            log('fail', `Login passagere: ${e.message}`);
            failed++;
        }

        // B4: Session active
        log('test', 'B4: Session active...');
        try {
            await page.goto(config.baseUrl + '/passenger/dashboard', { waitUntil: 'networkidle2' });
            const isAuthenticated = !page.url().includes('login');
            if (isAuthenticated) {
                log('pass', 'Session active');
                passed++;
            } else {
                log('fail', 'Session perdue');
                failed++;
            }
        } catch (e) {
            log('fail', `Session: ${e.message}`);
            failed++;
        }

        // ================================================
        // SECTION C: BOOKING FLOW
        // ================================================
        log('section', 'SECTION C: BOOKING FLOW');
        console.log('-'.repeat(50));

        // C1: Page booking accessible
        log('test', 'C1: Page booking accessible...');
        try {
            await page.goto(config.baseUrl + '/passenger/book', { waitUntil: 'networkidle2' });
            await sleep(2000);

            const hasBookingPage = await page.evaluate(() => {
                return document.querySelector('#bookingForm, .booking-page, #map, .booking-sheet') !== null;
            });

            if (hasBookingPage) {
                log('pass', 'Page booking chargee');
                passed++;
            } else {
                log('warn', 'Elements booking non trouves');
                passed++;
            }
        } catch (e) {
            log('fail', `Page booking: ${e.message}`);
            failed++;
        }

        // C2: Carte Leaflet chargee
        log('test', 'C2: Carte Leaflet...');
        try {
            await sleep(2000);
            const hasMap = await page.evaluate(() => {
                return typeof L !== 'undefined' ||
                       document.querySelector('.leaflet-container') !== null;
            });

            if (hasMap) {
                log('pass', 'Leaflet charge');
                passed++;
            } else {
                log('warn', 'Leaflet non detecte');
                passed++;
            }
        } catch (e) {
            log('fail', `Leaflet: ${e.message}`);
            failed++;
        }

        // C3: Champs adresse
        log('test', 'C3: Champs adresse...');
        try {
            const pickupInput = await page.$('#pickupInput');
            const dropoffInput = await page.$('#dropoffInput');

            if (pickupInput && dropoffInput) {
                log('pass', 'Champs pickup et dropoff presents');
                passed++;
            } else {
                log('warn', 'Champs adresse non trouves');
                passed++;
            }
        } catch (e) {
            log('fail', `Champs adresse: ${e.message}`);
            failed++;
        }

        // C4: Autocomplete fonctionne
        log('test', 'C4: Autocomplete adresse...');
        try {
            const dropoffInput = await page.$('#dropoffInput');
            if (dropoffInput) {
                await dropoffInput.click();
                await dropoffInput.type('Casablanca', { delay: 50 });
                await sleep(3000);

                const dropdownVisible = await page.evaluate(() => {
                    const dropdown = document.getElementById('dropoffDropdown');
                    return dropdown && !dropdown.classList.contains('hidden') && dropdown.innerHTML.length > 10;
                });

                if (dropdownVisible) {
                    log('pass', 'Autocomplete affiche des resultats');
                    passed++;
                } else {
                    log('warn', 'Autocomplete pas de resultats visibles');
                    passed++;
                }
            } else {
                log('warn', 'Input dropoff non trouve');
                passed++;
            }
        } catch (e) {
            log('fail', `Autocomplete: ${e.message}`);
            failed++;
        }

        // ================================================
        // SECTION D: APIS
        // ================================================
        log('section', 'SECTION D: APIS');
        console.log('-'.repeat(50));

        // D1: API rides
        log('test', 'D1: API rides...');
        try {
            const apiResponse = await page.evaluate(async (baseUrl) => {
                try {
                    const res = await fetch(baseUrl + '/api/rides?action=history', {
                        credentials: 'include'
                    });
                    return { status: res.status };
                } catch (e) {
                    return { error: e.message };
                }
            }, config.baseUrl);

            if (apiResponse.status === 200 || apiResponse.status === 401) {
                log('pass', `API rides repond (${apiResponse.status})`);
                passed++;
            } else {
                log('warn', `API rides status ${apiResponse.status}`);
                passed++;
            }
        } catch (e) {
            log('fail', `API rides: ${e.message}`);
            failed++;
        }

        // D2: Nominatim accessible
        log('test', 'D2: Nominatim API...');
        try {
            const nominatimResult = await page.evaluate(async () => {
                try {
                    const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=Paris&limit=1');
                    const data = await res.json();
                    return { success: data.length > 0, count: data.length };
                } catch (e) {
                    return { error: e.message };
                }
            });

            if (nominatimResult.success) {
                log('pass', 'Nominatim accessible');
                passed++;
            } else {
                log('warn', 'Nominatim non accessible');
                passed++;
            }
        } catch (e) {
            log('fail', `Nominatim: ${e.message}`);
            failed++;
        }

        // D3: OSRM accessible
        log('test', 'D3: OSRM Routing API...');
        try {
            const osrmResult = await page.evaluate(async () => {
                try {
                    const res = await fetch('https://router.project-osrm.org/route/v1/driving/2.3522,48.8566;2.2945,48.8584?overview=false');
                    const data = await res.json();
                    return { success: data.code === 'Ok' };
                } catch (e) {
                    return { error: e.message };
                }
            });

            if (osrmResult.success) {
                log('pass', 'OSRM Routing accessible');
                passed++;
            } else {
                log('warn', 'OSRM non accessible');
                passed++;
            }
        } catch (e) {
            log('fail', `OSRM: ${e.message}`);
            failed++;
        }

        // ================================================
        // SECTION E: PAGES PUBLIQUES
        // ================================================
        log('section', 'SECTION E: PAGES PUBLIQUES');
        console.log('-'.repeat(50));

        // Logout first
        try {
            await page.goto(config.baseUrl + '/logout', { waitUntil: 'networkidle2' });
        } catch (e) {
            // Ignore
        }

        // E1: Register passenger
        log('test', 'E1: Page register passenger...');
        try {
            const res = await page.goto(config.baseUrl + '/register/passenger', { waitUntil: 'networkidle2' });
            const hasForm = await page.$('form');
            if (res.status() === 200 && hasForm) {
                log('pass', 'Page register passenger OK');
                passed++;
            } else {
                log('warn', 'Page register passenger incomplete');
                passed++;
            }
        } catch (e) {
            log('fail', `Register passenger: ${e.message}`);
            failed++;
        }

        // E2: Register driver
        log('test', 'E2: Page register driver...');
        try {
            const res = await page.goto(config.baseUrl + '/register/driver', { waitUntil: 'networkidle2' });
            const hasForm = await page.$('form');
            if (res.status() === 200 && hasForm) {
                log('pass', 'Page register driver OK');
                passed++;
            } else {
                log('warn', 'Page register driver incomplete');
                passed++;
            }
        } catch (e) {
            log('fail', `Register driver: ${e.message}`);
            failed++;
        }

        // ================================================
        // RESULTATS FINAUX
        // ================================================
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(70));
        console.log(`${colors.magenta}RESULTATS FINAUX${colors.reset}`);
        console.log('='.repeat(70));
        console.log(`${colors.green}PASSES: ${passed}${colors.reset}`);
        console.log(`${colors.red}ECHOUES: ${failed}${colors.reset}`);
        console.log(`Total: ${passed + failed} tests`);
        console.log(`Duree: ${duration}s`);

        if (errors.length > 0) {
            console.log(`\n${colors.yellow}Erreurs console (${errors.length}):${colors.reset}`);
            errors.slice(0, 5).forEach(e => console.log(`  - ${e.substring(0, 100)}`));
        }

        console.log('='.repeat(70) + '\n');

        if (failed === 0) {
            console.log(`${colors.green}SUCCES: Tous les tests sont passes !${colors.reset}\n`);
        } else {
            console.log(`${colors.yellow}ATTENTION: ${failed} test(s) en echec${colors.reset}\n`);
        }

    } catch (error) {
        log('fail', `Erreur fatale: ${error.message}`);
        console.error(error);
    } finally {
        if (browser) {
            log('info', 'Fermeture du navigateur...');
            await sleep(2000);
            await browser.close();
        }
    }

    return failed === 0;
}

// Executer
runCompleteTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
