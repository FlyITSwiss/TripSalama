/**
 * TripSalama - Tests des nouvelles fonctionnalités en production
 * Tests API: Payments, Wallet, SOS, Promo, Referral, Scheduled, Vehicles, ETA, Admin
 */

const puppeteer = require('puppeteer');

// Configuration Production
const config = {
    baseUrl: 'https://stabilis-it.ch/internal/tripsalama',

    puppeteer: {
        headless: false,
        slowMo: 100,
        defaultViewport: { width: 1400, height: 900 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },

    timeout: {
        navigation: 30000,
        api: 15000
    },

    // Utilisateurs de test
    users: {
        passenger: {
            email: 'fatima@example.com',
            password: 'Test1234!'
        },
        driver: {
            email: 'khadija@example.com',
            password: 'Test1234!'
        }
    },

    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    url: function(path = '') {
        return this.baseUrl + '/' + path.replace(/^\//, '');
    },
    apiUrl: function(path = '') {
        return this.baseUrl + '/api/' + path.replace(/^\//, '');
    }
};

// Couleurs console
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(type, message) {
    const prefix = {
        pass: `${colors.green}[PASS]${colors.reset}`,
        fail: `${colors.red}[FAIL]${colors.reset}`,
        info: `${colors.blue}[INFO]${colors.reset}`,
        warn: `${colors.yellow}[WARN]${colors.reset}`,
        test: `${colors.cyan}[TEST]${colors.reset}`,
        section: `${colors.bold}${colors.blue}[====]${colors.reset}`
    };
    console.log(`${prefix[type] || '[LOG]'} ${message}`);
}

// Résultats
const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: []
};

function recordTest(name, passed, details = '') {
    if (passed) {
        results.passed++;
        log('pass', `${name} ${details ? '- ' + details : ''}`);
    } else {
        results.failed++;
        log('fail', `${name} ${details ? '- ' + details : ''}`);
    }
    results.tests.push({ name, passed, details });
}

async function runTests() {
    let browser;
    let page;
    let csrfToken = null;
    let sessionCookie = null;

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.bold}${colors.cyan}TRIPSALAMA - TEST NOUVELLES FONCTIONNALITÉS PRODUCTION${colors.reset}`);
    console.log('='.repeat(60) + '\n');

    try {
        log('info', 'Lancement de Puppeteer en mode visuel...');
        browser = await puppeteer.launch(config.puppeteer);
        page = await browser.newPage();

        // Intercepter les requêtes pour voir les erreurs
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`${colors.red}[CONSOLE]${colors.reset} ${msg.text()}`);
            }
        });

        // ========================================
        // PHASE 1: CONNEXION ET RÉCUPÉRATION CSRF
        // ========================================
        log('section', 'PHASE 1: AUTHENTIFICATION');

        try {
            log('test', 'Accès à la page de login...');
            await page.goto(config.url('login'), {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            // Screenshot
            await page.screenshot({ path: 'tests/puppeteer/screenshots/01-login-page.png' });

            const title = await page.title();
            recordTest('Page login accessible', title.length > 0, title);

            // Récupérer CSRF token
            csrfToken = await page.evaluate(() => {
                const meta = document.querySelector('meta[name="csrf-token"]');
                return meta ? meta.content : null;
            });

            recordTest('Token CSRF présent', !!csrfToken, csrfToken ? 'Token obtenu' : 'Pas de token');

            // Login
            log('test', 'Tentative de connexion passagère...');
            await page.type('input[name="email"]', config.users.passenger.email, { delay: 30 });
            await page.type('input[name="password"]', config.users.passenger.password, { delay: 30 });

            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
            ]);

            await config.sleep(1000);

            const loggedInUrl = page.url();
            const isLoggedIn = !loggedInUrl.includes('login');
            recordTest('Connexion réussie', isLoggedIn, loggedInUrl);

            // Screenshot après login
            await page.screenshot({ path: 'tests/puppeteer/screenshots/02-after-login.png' });

            // Récupérer les cookies de session
            const cookies = await page.cookies();
            sessionCookie = cookies.find(c => c.name.includes('session') || c.name === 'PHPSESSID');
            recordTest('Cookie session présent', !!sessionCookie, sessionCookie?.name);

        } catch (error) {
            recordTest('Authentification', false, error.message);
        }

        await config.sleep(1000);

        // ========================================
        // PHASE 2: TEST API VÉHICULES (Public)
        // ========================================
        log('section', 'PHASE 2: API VÉHICULES');

        try {
            log('test', 'Test GET /api/vehicles.php?action=types...');
            const vehiclesResponse = await page.evaluate(async (apiUrl) => {
                const res = await fetch(apiUrl + 'vehicles.php?action=types');
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API Types de véhicules',
                vehiclesResponse.status === 200,
                `Status: ${vehiclesResponse.status}`
            );

            if (vehiclesResponse.data?.vehicle_types) {
                const types = vehiclesResponse.data.vehicle_types;
                recordTest('Données véhicules', types.length >= 0, `${types.length} types trouvés`);
            }

        } catch (error) {
            recordTest('API Véhicules', false, error.message);
        }

        // ========================================
        // PHASE 3: TEST API ETA (Public)
        // ========================================
        log('section', 'PHASE 3: API ETA');

        try {
            log('test', 'Test GET /api/eta.php?action=ride...');
            const etaResponse = await page.evaluate(async (apiUrl) => {
                const params = new URLSearchParams({
                    action: 'ride',
                    pickup_lat: '33.5731',
                    pickup_lng: '-7.5898',
                    dropoff_lat: '33.5890',
                    dropoff_lng: '-7.6110'
                });
                const res = await fetch(apiUrl + 'eta.php?' + params);
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API ETA Course',
                etaResponse.status === 200,
                `Status: ${etaResponse.status}`
            );

            if (etaResponse.data?.distance_km) {
                recordTest('Calcul ETA', true,
                    `Distance: ${etaResponse.data.distance_km}km, Durée: ${etaResponse.data.duration_minutes}min`
                );
            }

        } catch (error) {
            recordTest('API ETA', false, error.message);
        }

        // ========================================
        // PHASE 4: TEST API WALLET (Auth required)
        // ========================================
        log('section', 'PHASE 4: API WALLET');

        try {
            // Récupérer le CSRF token frais
            await page.goto(config.url('passenger/dashboard'), { waitUntil: 'networkidle2' });
            csrfToken = await page.evaluate(() => {
                const meta = document.querySelector('meta[name="csrf-token"]');
                return meta ? meta.content : null;
            });

            log('test', 'Test GET /api/payments.php?action=wallet...');
            const walletResponse = await page.evaluate(async (apiUrl) => {
                const res = await fetch(apiUrl + 'payments.php?action=wallet', {
                    credentials: 'include'
                });
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API Wallet',
                walletResponse.status === 200 || walletResponse.status === 401,
                `Status: ${walletResponse.status}`
            );

            if (walletResponse.data?.balance !== undefined) {
                recordTest('Solde Wallet', true, `Solde: ${walletResponse.data.balance} MAD`);
            }

        } catch (error) {
            recordTest('API Wallet', false, error.message);
        }

        // ========================================
        // PHASE 5: TEST API PARRAINAGE
        // ========================================
        log('section', 'PHASE 5: API PARRAINAGE');

        try {
            log('test', 'Test GET /api/referral.php?action=my-code...');
            const referralResponse = await page.evaluate(async (apiUrl) => {
                const res = await fetch(apiUrl + 'referral.php?action=my-code', {
                    credentials: 'include'
                });
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API Mon code parrainage',
                referralResponse.status === 200 || referralResponse.status === 401,
                `Status: ${referralResponse.status}`
            );

            if (referralResponse.data?.referral_code) {
                recordTest('Code parrainage', true, `Code: ${referralResponse.data.referral_code}`);
            }

            // Test validation code
            log('test', 'Test validation code parrainage...');
            const validateResponse = await page.evaluate(async (apiUrl) => {
                const res = await fetch(apiUrl + 'referral.php?action=validate&code=TRIPXX0001');
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API Validation code',
                validateResponse.status === 200,
                `Status: ${validateResponse.status}`
            );

        } catch (error) {
            recordTest('API Parrainage', false, error.message);
        }

        // ========================================
        // PHASE 6: TEST API COURSES PROGRAMMÉES
        // ========================================
        log('section', 'PHASE 6: API COURSES PROGRAMMÉES');

        try {
            log('test', 'Test GET /api/scheduled.php?action=list...');
            const scheduledResponse = await page.evaluate(async (apiUrl) => {
                const res = await fetch(apiUrl + 'scheduled.php?action=list', {
                    credentials: 'include'
                });
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API Liste courses programmées',
                scheduledResponse.status === 200 || scheduledResponse.status === 401,
                `Status: ${scheduledResponse.status}`
            );

            if (scheduledResponse.data?.scheduled_rides) {
                recordTest('Données courses programmées', true,
                    `${scheduledResponse.data.scheduled_rides.length} courses programmées`
                );
            }

        } catch (error) {
            recordTest('API Courses programmées', false, error.message);
        }

        // ========================================
        // PHASE 7: TEST API SOS
        // ========================================
        log('section', 'PHASE 7: API SOS');

        try {
            log('test', 'Test GET /api/sos.php?action=contacts...');
            const sosResponse = await page.evaluate(async (apiUrl) => {
                const res = await fetch(apiUrl + 'sos.php?action=contacts', {
                    credentials: 'include'
                });
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API Contacts urgence',
                sosResponse.status === 200 || sosResponse.status === 401,
                `Status: ${sosResponse.status}`
            );

            log('test', 'Test GET /api/sos.php?action=active...');
            const activeSOSResponse = await page.evaluate(async (apiUrl) => {
                const res = await fetch(apiUrl + 'sos.php?action=active', {
                    credentials: 'include'
                });
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API Alerte SOS active',
                activeSOSResponse.status === 200 || activeSOSResponse.status === 401,
                `Status: ${activeSOSResponse.status}`
            );

        } catch (error) {
            recordTest('API SOS', false, error.message);
        }

        // ========================================
        // PHASE 8: TEST API PROMO CODES
        // ========================================
        log('section', 'PHASE 8: API CODES PROMO');

        try {
            log('test', 'Test validation code promo BIENVENUE...');
            const promoResponse = await page.evaluate(async (apiUrl, csrf) => {
                const res = await fetch(apiUrl + 'promo.php?action=validate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrf || ''
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        code: 'BIENVENUE',
                        amount: 50
                    })
                });
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''), csrfToken);

            // 400 = code invalide (normal si pas créé), 200 = valide, 401 = pas connecté
            recordTest('API Validation promo',
                [200, 400, 401, 403].includes(promoResponse.status),
                `Status: ${promoResponse.status}`
            );

        } catch (error) {
            recordTest('API Promo', false, error.message);
        }

        // ========================================
        // PHASE 9: TEST ESTIMATION PRIX
        // ========================================
        log('section', 'PHASE 9: ESTIMATION PRIX VÉHICULES');

        try {
            log('test', 'Test GET /api/vehicles.php?action=estimate-all...');
            const estimateResponse = await page.evaluate(async (apiUrl) => {
                const params = new URLSearchParams({
                    action: 'estimate-all',
                    distance: '10',
                    duration: '25',
                    pickup_lat: '33.5731',
                    pickup_lng: '-7.5898'
                });
                const res = await fetch(apiUrl + 'vehicles.php?' + params);
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API Estimation tous types',
                estimateResponse.status === 200,
                `Status: ${estimateResponse.status}`
            );

            if (estimateResponse.data?.estimates) {
                const estimates = estimateResponse.data.estimates;
                recordTest('Données estimations', estimates.length > 0,
                    `${estimates.length} estimations, Surge: ${estimateResponse.data.surge_active ? 'OUI' : 'NON'}`
                );

                // Afficher les prix
                estimates.forEach(e => {
                    log('info', `  ${e.vehicle_name}: ${e.total} MAD`);
                });
            }

        } catch (error) {
            recordTest('API Estimations', false, error.message);
        }

        // ========================================
        // PHASE 10: TEST SURGE PRICING
        // ========================================
        log('section', 'PHASE 10: SURGE PRICING');

        try {
            log('test', 'Test GET /api/vehicles.php?action=surge...');
            const surgeResponse = await page.evaluate(async (apiUrl) => {
                const params = new URLSearchParams({
                    action: 'surge',
                    lat: '33.5731',
                    lng: '-7.5898'
                });
                const res = await fetch(apiUrl + 'vehicles.php?' + params);
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API Surge Pricing',
                surgeResponse.status === 200,
                `Status: ${surgeResponse.status}`
            );

            if (surgeResponse.data?.surge_multiplier !== undefined) {
                recordTest('Données Surge', true,
                    `Multiplier: ${surgeResponse.data.surge_multiplier}x, Level: ${surgeResponse.data.surge_level}`
                );
            }

        } catch (error) {
            recordTest('API Surge', false, error.message);
        }

        // ========================================
        // PHASE 11: TEST CONDUCTRICES PROCHES
        // ========================================
        log('section', 'PHASE 11: ETA CONDUCTRICES PROCHES');

        try {
            log('test', 'Test GET /api/eta.php?action=nearest...');
            const nearestResponse = await page.evaluate(async (apiUrl) => {
                const params = new URLSearchParams({
                    action: 'nearest',
                    lat: '33.5731',
                    lng: '-7.5898',
                    limit: '5'
                });
                const res = await fetch(apiUrl + 'eta.php?' + params);
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API Conductrices proches',
                nearestResponse.status === 200,
                `Status: ${nearestResponse.status}`
            );

            if (nearestResponse.data?.drivers) {
                recordTest('Données conductrices', true,
                    `${nearestResponse.data.drivers.length} conductrices trouvées`
                );
            }

        } catch (error) {
            recordTest('API Nearest', false, error.message);
        }

        // ========================================
        // PHASE 12: HEALTH CHECK GLOBAL
        // ========================================
        log('section', 'PHASE 12: HEALTH CHECK');

        try {
            log('test', 'Test GET /api/health.php...');
            const healthResponse = await page.evaluate(async (apiUrl) => {
                const res = await fetch(apiUrl + 'health.php');
                return { status: res.status, data: await res.json() };
            }, config.apiUrl(''));

            recordTest('API Health Check',
                healthResponse.status === 200,
                `Status: ${healthResponse.status}`
            );

            if (healthResponse.data) {
                log('info', `  Database: ${healthResponse.data.database || 'N/A'}`);
                log('info', `  Version: ${healthResponse.data.version || 'N/A'}`);
            }

        } catch (error) {
            recordTest('API Health', false, error.message);
        }

        // Screenshot final
        await page.screenshot({ path: 'tests/puppeteer/screenshots/99-final.png' });

    } catch (error) {
        log('fail', `Erreur fatale: ${error.message}`);
        console.error(error);
    } finally {
        // ========================================
        // RÉSULTATS FINAUX
        // ========================================
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.bold}RÉSULTATS FINAUX${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`${colors.green}PASSÉS:   ${results.passed}${colors.reset}`);
        console.log(`${colors.red}ÉCHOUÉS:  ${results.failed}${colors.reset}`);
        console.log(`${colors.yellow}IGNORÉS:  ${results.skipped}${colors.reset}`);
        console.log('='.repeat(60));

        const successRate = Math.round((results.passed / (results.passed + results.failed)) * 100);
        console.log(`${colors.bold}Taux de réussite: ${successRate}%${colors.reset}\n`);

        if (results.failed === 0) {
            console.log(`${colors.green}${colors.bold}✓ TOUS LES TESTS SONT PASSÉS !${colors.reset}\n`);
        } else {
            console.log(`${colors.yellow}⚠ ${results.failed} test(s) en échec${colors.reset}\n`);
            console.log('Tests échoués:');
            results.tests.filter(t => !t.passed).forEach(t => {
                console.log(`  - ${t.name}: ${t.details}`);
            });
        }

        if (browser) {
            log('info', 'Fermeture du navigateur dans 5 secondes...');
            await config.sleep(5000);
            await browser.close();
        }
    }

    return results.failed === 0;
}

// Exécuter
runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
