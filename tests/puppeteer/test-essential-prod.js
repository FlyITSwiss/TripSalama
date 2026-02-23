/**
 * TripSalama - Test ESSENTIEL Production
 * Teste uniquement les APIs critiques avec délais pour rate limiting
 */

const puppeteer = require('puppeteer');

const config = {
    baseUrl: 'https://stabilis-it.ch/internal/tripsalama',
    delay: 15000 // 15 secondes entre chaque requête (rate limiting très strict)
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

let passed = 0, failed = 0;

function log(type, msg) {
    const prefix = type === 'pass' ? colors.green + '✓' : type === 'fail' ? colors.red + '✗' : colors.blue + '→';
    console.log(prefix + colors.reset + ' ' + msg);
}

function record(name, success, detail) {
    if (success) { passed++; log('pass', name + (detail ? ' - ' + detail : '')); }
    else { failed++; log('fail', name + (detail ? ' - ' + detail : '')); }
}

async function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function runTests() {
    console.log('\n' + colors.bold + colors.cyan + '═══ TRIPSALAMA - TEST PRODUCTION ═══' + colors.reset + '\n');

    const browser = await puppeteer.launch({ headless: false, slowMo: 30, defaultViewport: { width: 1200, height: 800 } });
    const page = await browser.newPage();

    try {
        // Test 1: Page Login
        console.log(colors.yellow + '\n[PAGE LOGIN]' + colors.reset);
        const loginRes = await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
        record('Page login accessible', loginRes.status() === 200, 'HTTP ' + loginRes.status());
        await sleep(config.delay);

        // Test 2: Types de véhicules
        console.log(colors.yellow + '\n[TYPES VÉHICULES]' + colors.reset);
        let res = await page.evaluate(async function(url) {
            const r = await fetch(url); return { status: r.status, json: await r.json() };
        }, config.baseUrl + '/api/vehicles.php?action=types');

        // Structure: {success, data: {vehicle_types: [...]}}
        const typesData = res.json && res.json.data ? res.json.data : {};
        const types = typesData.vehicle_types || [];
        record('API Types véhicules', res.status === 200 && types.length === 4, types.length + ' types');

        if (types.length > 0) {
            types.forEach(function(t) { console.log('   • ' + t.name + ' (' + t.code + ')'); });
        }
        await sleep(config.delay);

        // Test 3: Estimation prix
        console.log(colors.yellow + '\n[ESTIMATION PRIX]' + colors.reset);
        res = await page.evaluate(async function(url) {
            const r = await fetch(url); return { status: r.status, json: await r.json() };
        }, config.baseUrl + '/api/vehicles.php?action=estimate-all&distance=10&duration=25&pickup_lat=33.5731&pickup_lng=-7.5898');

        const estData = res.json && res.json.data ? res.json.data : {};
        const estimates = estData.estimates || [];
        record('API Estimations', res.status === 200 && estimates.length > 0, estimates.length + ' estimations');

        if (estimates.length > 0) {
            estimates.forEach(function(e) { console.log('   • ' + e.vehicle_name + ': ' + e.total + ' MAD'); });
            console.log('   Surge actif: ' + (estData.surge_active ? 'OUI (' + estData.surge_multiplier + 'x)' : 'NON'));
        }
        await sleep(config.delay);

        // Test 4: ETA course
        console.log(colors.yellow + '\n[ETA COURSE]' + colors.reset);
        res = await page.evaluate(async function(url) {
            const r = await fetch(url); return { status: r.status, json: await r.json() };
        }, config.baseUrl + '/api/eta.php?action=ride&pickup_lat=33.5731&pickup_lng=-7.5898&dropoff_lat=33.5890&dropoff_lng=-7.6110');

        const eta = res.json && res.json.data ? res.json.data : null;
        record('API ETA', res.status === 200 && eta && eta.distance_km,
            eta ? eta.distance_km + 'km, ' + eta.duration_minutes + 'min' : '');
        await sleep(config.delay);

        // Test 5: Surge pricing
        console.log(colors.yellow + '\n[SURGE PRICING]' + colors.reset);
        res = await page.evaluate(async function(url) {
            const r = await fetch(url); return { status: r.status, json: await r.json() };
        }, config.baseUrl + '/api/vehicles.php?action=surge&lat=33.5731&lng=-7.5898');

        const surge = res.json && res.json.data ? res.json.data : null;
        record('API Surge', res.status === 200 && surge,
            surge ? 'Multiplier: ' + surge.surge_multiplier + 'x, Level: ' + surge.surge_level : '');
        await sleep(config.delay);

        // Test 6: Conductrices proches
        console.log(colors.yellow + '\n[CONDUCTRICES]' + colors.reset);
        res = await page.evaluate(async function(url) {
            const r = await fetch(url); return { status: r.status, json: await r.json() };
        }, config.baseUrl + '/api/eta.php?action=nearest&lat=33.5731&lng=-7.5898&limit=5');

        const driversData = res.json && res.json.data ? res.json.data : {};
        const drivers = driversData.drivers || [];
        record('API Conductrices', res.status === 200, drivers.length + ' disponibles');
        await sleep(config.delay);

        // Test 7: APIs protégées (doivent retourner 401)
        console.log(colors.yellow + '\n[PROTECTION AUTH]' + colors.reset);

        res = await page.evaluate(async function(url) {
            const r = await fetch(url, { credentials: 'include' }); return r.status;
        }, config.baseUrl + '/api/payments.php?action=wallet');
        record('Wallet protégé', res === 401, 'Status ' + res);
        await sleep(config.delay);

        res = await page.evaluate(async function(url) {
            const r = await fetch(url, { credentials: 'include' }); return r.status;
        }, config.baseUrl + '/api/admin.php?action=dashboard');
        record('Admin protégé', res === 401, 'Status ' + res);
        await sleep(config.delay);

        // Test 8: UI
        console.log(colors.yellow + '\n[UI]' + colors.reset);

        const hasCsrf = await page.evaluate(function() {
            return !!document.querySelector('meta[name="csrf-token"]');
        });
        record('CSRF token présent', hasCsrf);

        const hasForm = await page.evaluate(function() {
            return !!(document.querySelector('input[name="email"]') && document.querySelector('input[name="password"]'));
        });
        record('Formulaire login OK', hasForm);

        // Screenshot
        await page.screenshot({ path: __dirname + '/screenshots/essential-test.png' });
        record('Screenshot sauvé', true);

    } catch (e) {
        console.log(colors.red + 'ERREUR: ' + e.message + colors.reset);
    }

    // Résultats
    console.log('\n' + '═'.repeat(50));
    console.log(colors.green + 'PASSÉS:  ' + passed + colors.reset);
    console.log(colors.red + 'ÉCHOUÉS: ' + failed + colors.reset);
    const rate = Math.round(passed / (passed + failed) * 100);
    console.log(colors.bold + 'TAUX: ' + rate + '%' + colors.reset);
    console.log('═'.repeat(50) + '\n');

    if (failed === 0) {
        console.log(colors.green + colors.bold + '✓ TOUS LES TESTS ESSENTIELS PASSÉS!' + colors.reset);
    }

    console.log('\nFermeture dans 5 secondes...');
    await sleep(5000);
    await browser.close();

    return failed === 0;
}

runTests().then(function(s) { process.exit(s ? 0 : 1); }).catch(function(e) { console.error(e); process.exit(1); });
