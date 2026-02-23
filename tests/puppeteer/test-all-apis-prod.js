/**
 * TripSalama - Test TOUTES les APIs en Production
 * Test exhaustif de toutes les fonctionnalités
 */

const puppeteer = require('puppeteer');

const config = {
    baseUrl: 'https://stabilis-it.ch/internal/tripsalama',
    puppeteer: {
        headless: false,
        slowMo: 50,
        defaultViewport: { width: 1400, height: 900 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    timeout: 30000
};

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

const results = { passed: 0, failed: 0, tests: [] };

function log(type, msg) {
    const prefixes = {
        pass: colors.green + '✓' + colors.reset,
        fail: colors.red + '✗' + colors.reset,
        info: colors.blue + 'ℹ' + colors.reset,
        test: colors.cyan + '►' + colors.reset,
        section: colors.bold + colors.yellow + '═══' + colors.reset
    };
    console.log((prefixes[type] || '•') + ' ' + msg);
}

function record(name, passed, details) {
    details = details || '';
    if (passed) {
        results.passed++;
        log('pass', name + (details ? ' (' + details + ')' : ''));
    } else {
        results.failed++;
        log('fail', name + (details ? ' (' + details + ')' : ''));
    }
    results.tests.push({ name: name, passed: passed, details: details });
}

async function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
}

async function testAPI(page, endpoint) {
    // Délai pour éviter rate limiting
    await sleep(2000);

    try {
        const url = config.baseUrl + '/api/' + endpoint;
        const response = await page.evaluate(async function(url) {
            const res = await fetch(url, { credentials: 'include' });
            let data;
            try { data = await res.json(); } catch (e) { data = null; }
            return { status: res.status, data: data };
        }, url);
        return response;
    } catch (e) {
        return { status: 0, error: e.message };
    }
}

async function runTests() {
    let browser;

    console.log('\n' + '═'.repeat(70));
    console.log(colors.bold + colors.cyan + ' TRIPSALAMA - TEST EXHAUSTIF PRODUCTION' + colors.reset);
    console.log('═'.repeat(70) + '\n');

    try {
        browser = await puppeteer.launch(config.puppeteer);
        const page = await browser.newPage();

        // ═══════════════════════════════════════
        // PHASE 1: PAGES WEB ACCESSIBLES
        // ═══════════════════════════════════════
        log('section', ' PHASE 1: PAGES WEB ACCESSIBLES');

        const pages = [
            { path: '', name: 'Accueil' },
            { path: 'login', name: 'Login' },
            { path: 'register', name: 'Inscription' },
        ];

        for (const p of pages) {
            try {
                const res = await page.goto(config.baseUrl + '/' + p.path, {
                    waitUntil: 'networkidle2',
                    timeout: config.timeout
                });
                record('Page ' + p.name, res.status() === 200, 'HTTP ' + res.status());
            } catch (e) {
                record('Page ' + p.name, false, e.message);
            }
        }

        // ═══════════════════════════════════════
        // PHASE 2: API HEALTH & SYSTÈME
        // ═══════════════════════════════════════
        log('section', ' PHASE 2: API HEALTH & SYSTÈME');

        let res = await testAPI(page, 'health.php');
        record('API Health Check', res.status === 200, 'Status ' + res.status);

        // ═══════════════════════════════════════
        // PHASE 3: API VÉHICULES
        // ═══════════════════════════════════════
        log('section', ' PHASE 3: API VÉHICULES');

        res = await testAPI(page, 'vehicles.php?action=types');
        record('Types de véhicules', res.status === 200,
            (res.data && res.data.vehicle_types ? res.data.vehicle_types.length : 0) + ' types');

        if (res.data && res.data.vehicle_types) {
            const types = res.data.vehicle_types;
            const expectedTypes = ['standard', 'comfort', 'van', 'premium'];
            for (const expected of expectedTypes) {
                const found = types.find(function(t) { return t.code === expected; });
                record('  → Type ' + expected, !!found, found ? found.name : 'MANQUANT');
            }
        }

        res = await testAPI(page, 'vehicles.php?action=estimate-all&distance=10&duration=25&pickup_lat=33.5731&pickup_lng=-7.5898');
        record('Estimations tous types', res.status === 200 && res.data && res.data.estimates,
            (res.data && res.data.estimates ? res.data.estimates.length : 0) + ' estimations');

        if (res.data && res.data.estimates) {
            log('info', '  Prix estimés pour 10km / 25min:');
            res.data.estimates.forEach(function(e) {
                log('info', '    • ' + e.vehicle_name + ': ' + e.total + ' MAD');
            });
        }

        res = await testAPI(page, 'vehicles.php?action=surge&lat=33.5731&lng=-7.5898');
        record('Surge Pricing', res.status === 200,
            'Multiplier: ' + (res.data ? res.data.surge_multiplier : '?') + 'x');

        // ═══════════════════════════════════════
        // PHASE 4: API ETA
        // ═══════════════════════════════════════
        log('section', ' PHASE 4: API ETA (Temps d\'arrivée)');

        res = await testAPI(page, 'eta.php?action=ride&pickup_lat=33.5731&pickup_lng=-7.5898&dropoff_lat=33.5890&dropoff_lng=-7.6110');
        record('ETA Course', res.status === 200,
            res.data && res.data.distance_km ? res.data.distance_km + 'km, ' + res.data.duration_minutes + 'min' : '');

        res = await testAPI(page, 'eta.php?action=nearest&lat=33.5731&lng=-7.5898&limit=5');
        record('Conductrices proches', res.status === 200,
            (res.data && res.data.drivers ? res.data.drivers.length : 0) + ' disponibles');

        res = await testAPI(page, 'eta.php?action=all-types&lat=33.5731&lng=-7.5898');
        record('ETA par type véhicule', res.status === 200,
            (res.data && res.data.etas ? res.data.etas.length : 0) + ' types');

        // ═══════════════════════════════════════
        // PHASE 5: API PARRAINAGE
        // ═══════════════════════════════════════
        log('section', ' PHASE 5: API PARRAINAGE');

        res = await testAPI(page, 'referral.php?action=validate&code=TESTCODE');
        record('Validation code parrainage', res.status === 200 || res.status === 400,
            res.data && res.data.valid ? 'Code valide' : 'Code invalide (normal)');

        res = await testAPI(page, 'referral.php?action=my-code');
        record('Mon code (auth requise)', res.status === 401, 'Status ' + res.status);

        res = await testAPI(page, 'referral.php?action=stats');
        record('Stats parrainage (auth requise)', res.status === 401, 'Status ' + res.status);

        // ═══════════════════════════════════════
        // PHASE 6: API COURSES PROGRAMMÉES
        // ═══════════════════════════════════════
        log('section', ' PHASE 6: API COURSES PROGRAMMÉES');

        res = await testAPI(page, 'scheduled.php?action=list');
        record('Liste courses (auth requise)', res.status === 401, 'Status ' + res.status);

        res = await testAPI(page, 'scheduled.php?action=upcoming');
        record('Courses à venir (auth requise)', res.status === 401, 'Status ' + res.status);

        // ═══════════════════════════════════════
        // PHASE 7: API SOS / URGENCE
        // ═══════════════════════════════════════
        log('section', ' PHASE 7: API SOS / URGENCE');

        res = await testAPI(page, 'sos.php?action=contacts');
        record('Contacts urgence (auth requise)', res.status === 401, 'Status ' + res.status);

        res = await testAPI(page, 'sos.php?action=active');
        record('Alerte active (auth requise)', res.status === 401, 'Status ' + res.status);

        res = await testAPI(page, 'sos.php?action=my-alerts');
        record('Mes alertes (auth requise)', res.status === 401, 'Status ' + res.status);

        // ═══════════════════════════════════════
        // PHASE 8: API PAIEMENTS & WALLET
        // ═══════════════════════════════════════
        log('section', ' PHASE 8: API PAIEMENTS & WALLET');

        res = await testAPI(page, 'payments.php?action=wallet');
        record('Solde wallet (auth requise)', res.status === 401, 'Status ' + res.status);

        res = await testAPI(page, 'payments.php?action=methods');
        record('Méthodes paiement (auth requise)', res.status === 401, 'Status ' + res.status);

        res = await testAPI(page, 'payments.php?action=transactions');
        record('Transactions (auth requise)', res.status === 401, 'Status ' + res.status);

        // ═══════════════════════════════════════
        // PHASE 9: API CODES PROMO
        // ═══════════════════════════════════════
        log('section', ' PHASE 9: API CODES PROMO');

        res = await testAPI(page, 'promo.php?action=my-codes');
        record('Mes codes promo (auth requise)', res.status === 401, 'Status ' + res.status);

        // ═══════════════════════════════════════
        // PHASE 10: API ADMIN (accès restreint)
        // ═══════════════════════════════════════
        log('section', ' PHASE 10: API ADMIN (accès restreint)');

        const adminAPIs = [
            'admin.php?action=dashboard',
            'admin.php?action=drivers',
            'admin.php?action=passengers',
            'admin.php?action=rides',
            'admin.php?action=sos-alerts',
            'admin.php?action=transactions',
            'admin.php?action=kpis',
            'admin.php?action=realtime'
        ];

        for (const endpoint of adminAPIs) {
            res = await testAPI(page, endpoint);
            const name = endpoint.split('action=')[1];
            record('Admin ' + name, res.status === 401, 'Status ' + res.status);
        }

        // ═══════════════════════════════════════
        // PHASE 11: SÉCURITÉ
        // ═══════════════════════════════════════
        log('section', ' PHASE 11: SÉCURITÉ');

        // Vérifier CSRF
        await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2' });
        const hasCsrf = await page.evaluate(function() {
            return !!document.querySelector('meta[name="csrf-token"]');
        });
        record('Protection CSRF présente', hasCsrf);

        // Test POST sans CSRF
        res = await page.evaluate(async function(baseUrl) {
            const response = await fetch(baseUrl + '/api/promo.php?action=validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'TEST', amount: 50 })
            });
            return response.status;
        }, config.baseUrl);
        record('CSRF bloque POST non-auth', res === 401 || res === 403, 'Status ' + res);

        // ═══════════════════════════════════════
        // PHASE 12: UI RESPONSIVE
        // ═══════════════════════════════════════
        log('section', ' PHASE 12: UI RESPONSIVE');

        const viewports = [
            { width: 375, height: 667, name: 'iPhone SE' },
            { width: 414, height: 896, name: 'iPhone 11' },
            { width: 768, height: 1024, name: 'iPad' },
            { width: 1920, height: 1080, name: 'Desktop HD' }
        ];

        for (const vp of viewports) {
            await page.setViewport({ width: vp.width, height: vp.height });
            await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2' });

            const isVisible = await page.evaluate(function() {
                const form = document.querySelector('form');
                if (!form) return false;
                const rect = form.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });

            record('Responsive ' + vp.name, isVisible, vp.width + 'x' + vp.height);
        }

        // Screenshot final
        await page.setViewport({ width: 1400, height: 900 });
        await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2' });
        await page.screenshot({ path: __dirname + '/screenshots/test-all-apis-final.png' });

    } catch (error) {
        log('fail', 'Erreur fatale: ' + error.message);
        console.error(error);
    } finally {
        // Résultats
        console.log('\n' + '═'.repeat(70));
        console.log(colors.bold + 'RÉSULTATS FINAUX' + colors.reset);
        console.log('═'.repeat(70));
        console.log(colors.green + 'PASSÉS:  ' + results.passed + colors.reset);
        console.log(colors.red + 'ÉCHOUÉS: ' + results.failed + colors.reset);
        console.log('─'.repeat(70));

        const rate = Math.round((results.passed / (results.passed + results.failed)) * 100);
        const rateColor = rate >= 90 ? colors.green : rate >= 70 ? colors.yellow : colors.red;
        console.log(rateColor + colors.bold + 'TAUX DE RÉUSSITE: ' + rate + '%' + colors.reset + '\n');

        if (results.failed > 0) {
            console.log(colors.yellow + 'Tests échoués:' + colors.reset);
            results.tests.filter(function(t) { return !t.passed; }).forEach(function(t) {
                console.log('  ' + colors.red + '✗' + colors.reset + ' ' + t.name + ': ' + t.details);
            });
        } else {
            console.log(colors.green + colors.bold + '✓ TOUS LES TESTS PASSÉS!' + colors.reset);
        }

        if (browser) {
            log('info', 'Fermeture dans 5 secondes...');
            await new Promise(function(r) { setTimeout(r, 5000); });
            await browser.close();
        }
    }

    return results.failed === 0;
}

runTests()
    .then(function(success) { process.exit(success ? 0 : 1); })
    .catch(function(e) { console.error(e); process.exit(1); });
