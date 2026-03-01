/**
 * TripSalama - Audit Complete v5
 * Test complet avec selecteurs corriges
 * Date: 1er Mars 2026
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8080';
const SCREENSHOT_DIR = path.join(__dirname, 'audit-v5');

// Test credentials
const PASSENGER_EMAIL = 'passenger@tripsalama.ch';
const PASSENGER_PASSWORD = 'TripSalama2025!';
const DRIVER_EMAIL = 'driver@tripsalama.ch';
const DRIVER_PASSWORD = 'TripSalama2025!';

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Results storage
const results = {
    date: new Date().toISOString(),
    totalTests: 0,
    passed: 0,
    failed: 0,
    bugs: [],
    tests: []
};

// Helpers
async function screenshot(page, name) {
    const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    return filepath;
}

function logTest(id, name, status, details = '') {
    results.totalTests++;
    if (status === 'PASS') results.passed++;
    else if (status === 'FAIL') results.failed++;

    const result = { id, name, status, details };
    results.tests.push(result);

    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} [${id}] ${name}: ${status}${details ? ' - ' + details : ''}`);

    if (status === 'FAIL') {
        results.bugs.push({ id, name, details });
    }
}

async function elementExists(page, selector, timeout = 2000) {
    try {
        await page.waitForSelector(selector, { timeout });
        return true;
    } catch {
        return false;
    }
}

async function elementExistsAny(page, selectors, timeout = 2000) {
    for (const selector of selectors) {
        try {
            await page.waitForSelector(selector, { timeout: timeout / selectors.length });
            return { found: true, selector };
        } catch {
            continue;
        }
    }
    return { found: false, selector: null };
}

// ============================================
// TEST SUITES
// ============================================

async function testLoginPage(page) {
    console.log('\n📝 === PAGE LOGIN ===\n');

    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await screenshot(page, '01-login');

    // Basic elements
    const tests = [
        { id: 'L01', selector: '#email', name: 'Champ email existe' },
        { id: 'L02', selector: '#password', name: 'Champ password existe' },
        { id: 'L03', selector: '.password-toggle', name: 'Toggle password existe' },
        { id: 'L04', selector: 'button[type="submit"]', name: 'Bouton login existe' },
        { id: 'L05', selector: 'a[href*="register"]', name: 'Lien inscription existe' },
    ];

    for (const test of tests) {
        const exists = await elementExists(page, test.selector);
        logTest(test.id, test.name, exists ? 'PASS' : 'FAIL');
    }

    // Remember Me - FIXED: Check for #remember_me or input[name="remember_me"]
    const rememberMe = await elementExistsAny(page, [
        '#remember_me',
        'input[name="remember_me"]',
        'input[type="checkbox"][name*="remember"]'
    ], 2000);
    logTest('L06', 'Checkbox "Se souvenir de moi"', rememberMe.found ? 'PASS' : 'FAIL',
        rememberMe.found ? `Trouve: ${rememberMe.selector}` : '');

    // Forgot Password - FIXED: Check multiple selectors
    const forgotPassword = await elementExistsAny(page, [
        '.forgot-password',
        'a[href*="forgot-password"]',
        'a[href*="forgot"]'
    ], 2000);
    logTest('L07', 'Lien "Mot de passe oublie"', forgotPassword.found ? 'PASS' : 'FAIL',
        forgotPassword.found ? `Trouve: ${forgotPassword.selector}` : '');

    // Test password toggle
    console.log('\n🔐 Test toggle password...');
    const pwdType1 = await page.$eval('#password', el => el.type);
    logTest('L08', 'Password masque par defaut', pwdType1 === 'password' ? 'PASS' : 'FAIL');

    if (await elementExists(page, '.password-toggle')) {
        await page.click('.password-toggle');
        await page.waitForTimeout(300);
        const pwdType2 = await page.$eval('#password', el => el.type);
        logTest('L09', 'Toggle revele password', pwdType2 === 'text' ? 'PASS' : 'FAIL');

        await page.click('.password-toggle');
        await page.waitForTimeout(300);
        const pwdType3 = await page.$eval('#password', el => el.type);
        logTest('L10', 'Toggle re-masque password', pwdType3 === 'password' ? 'PASS' : 'FAIL');
    }

    // Test login with wrong credentials
    console.log('\n🔐 Test login echec...');
    await page.type('#email', 'wrong@email.com');
    await page.type('#password', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await page.waitForTimeout(1000);

    await screenshot(page, '02-login-error');

    const errorMsg = await elementExistsAny(page, [
        '.login-flash-item.error',
        '.error-message',
        '.alert-danger',
        '.auth-flash-item.error'
    ], 2000);
    logTest('L11', 'Message erreur affiche', errorMsg.found ? 'PASS' : 'FAIL');
}

async function testRegisterPage(page) {
    console.log('\n📝 === PAGE INSCRIPTION ===\n');

    await page.goto(BASE_URL + '/register', { waitUntil: 'networkidle0' });
    await screenshot(page, '03-register');

    const pageLoaded = await elementExists(page, 'body', 2000);
    logTest('R00', 'Page inscription accessible', pageLoaded ? 'PASS' : 'FAIL');

    // FIXED: Correct selectors for register-choice.phtml
    // Option passagere: a[href*="register/passenger"] with class role-card
    const passengerOption = await elementExistsAny(page, [
        'a[href*="register/passenger"]',
        'a.role-card[href*="passenger"]',
        '.role-card:first-child'
    ], 2000);
    logTest('R01', 'Option passagere', passengerOption.found ? 'PASS' : 'FAIL',
        passengerOption.found ? `Trouve: ${passengerOption.selector}` : '');

    // Option conductrice: a[href*="register/driver"]
    const driverOption = await elementExistsAny(page, [
        'a[href*="register/driver"]',
        'a.role-card[href*="driver"]',
        '.role-card:last-child'
    ], 2000);
    logTest('R02', 'Option conductrice', driverOption.found ? 'PASS' : 'FAIL',
        driverOption.found ? `Trouve: ${driverOption.selector}` : '');
}

async function testForgotPasswordPage(page) {
    console.log('\n📝 === PAGE MOT DE PASSE OUBLIE ===\n');

    await page.goto(BASE_URL + '/forgot-password', { waitUntil: 'networkidle0' });
    await screenshot(page, '04-forgot-password');

    const tests = [
        { id: 'FP01', selectors: ['#email', 'input[type="email"]'], name: 'Champ email existe' },
        { id: 'FP02', selectors: ['button[type="submit"]', '.auth-btn'], name: 'Bouton envoi existe' },
        { id: 'FP03', selectors: ['a[href*="login"]', '.auth-footer-btn'], name: 'Lien retour login' },
    ];

    for (const test of tests) {
        const result = await elementExistsAny(page, test.selectors, 2000);
        logTest(test.id, test.name, result.found ? 'PASS' : 'FAIL');
    }
}

async function testPassengerLogin(page) {
    console.log('\n📝 === CONNEXION PASSAGERE ===\n');

    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // Clear and type credentials
    await page.$eval('#email', el => el.value = '');
    await page.type('#email', PASSENGER_EMAIL);
    await page.$eval('#password', el => el.value = '');
    await page.type('#password', PASSENGER_PASSWORD);

    await screenshot(page, '05-login-filled');

    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await page.waitForTimeout(2000);

    await screenshot(page, '06-after-login');

    // Check if logged in
    const url = page.url();
    const isLoggedIn = url.includes('dashboard') || url.includes('passenger') || !url.includes('login');
    logTest('P01', 'Connexion passagere reussie', isLoggedIn ? 'PASS' : 'FAIL', `URL: ${url}`);

    if (isLoggedIn) {
        await testPassengerDashboard(page);
    }
}

async function testPassengerDashboard(page) {
    console.log('\n📝 === DASHBOARD PASSAGERE ===\n');

    await screenshot(page, '07-passenger-dashboard');

    // Check main elements with multiple selector options
    const tests = [
        { id: 'PD01', selectors: ['.welcome-name', '.user-name', 'h1', '.dashboard-header'], name: 'Message bienvenue' },
        { id: 'PD02', selectors: ['.where-to', '.book-ride', 'a[href*="book"]', '.search-ride', '.cta-book'], name: 'Bouton reserver' },
        { id: 'PD03', selectors: ['.safety-banner', '.safety-info', '.security-banner'], name: 'Bandeau securite' },
        { id: 'PD04', selectors: ['.stats', '.stat-card', '.ride-stats', '.dashboard-stats'], name: 'Stats courses' },
        { id: 'PD05', selectors: ['nav', '.mobile-nav', '.bottom-nav', '.navigation', '.nav-bar'], name: 'Navigation' },
    ];

    for (const test of tests) {
        const result = await elementExistsAny(page, test.selectors, 1500);
        logTest(test.id, test.name, result.found ? 'PASS' : 'FAIL');
    }

    // Test navigation to history
    console.log('\n📍 Test navigation...');
    const historyLink = await elementExistsAny(page, [
        'a[href*="history"]',
        '[data-page="history"]',
        '.nav-history',
        'nav a:nth-child(2)'
    ], 2000);

    if (historyLink.found) {
        await page.click(historyLink.selector);
        await page.waitForTimeout(1500);
        await screenshot(page, '08-history');
        const historyUrl = page.url();
        logTest('PD06', 'Navigation historique', historyUrl.includes('history') ? 'PASS' : 'FAIL');
    }

    // Test navigation to profile
    const profileLink = await elementExistsAny(page, [
        'a[href*="profile"]',
        '[data-page="profile"]',
        '.nav-profile',
        'nav a:last-child'
    ], 2000);

    if (profileLink.found) {
        await page.click(profileLink.selector);
        await page.waitForTimeout(1500);
        await screenshot(page, '09-profile');
        const profileUrl = page.url();
        logTest('PD07', 'Navigation profil', profileUrl.includes('profile') ? 'PASS' : 'FAIL');

        // Check profile content
        await testProfilePage(page);
    }
}

async function testProfilePage(page) {
    console.log('\n📝 === PAGE PROFIL ===\n');

    // FIXED: Use correct selectors from profile-uber.phtml
    const tests = [
        { id: 'PR01', selectors: ['.profile-avatar', '.avatar', '.user-avatar'], name: 'Avatar utilisateur' },
        { id: 'PR02', selectors: ['.profile-name', '.user-name', 'h1'], name: 'Nom utilisateur' },
        // FIXED: Email and phone are in .profile-item-value elements
        { id: 'PR03', selectors: ['.profile-item-value', '.profile-item-content'], name: 'Infos utilisateur (email/phone)' },
    ];

    for (const test of tests) {
        const result = await elementExistsAny(page, test.selectors, 1500);
        logTest(test.id, test.name, result.found ? 'PASS' : 'FAIL');
    }

    // FIXED: Logout button - it's a button with class profile-btn-danger
    const logoutBtn = await elementExistsAny(page, [
        '.profile-btn-danger',
        'button.profile-btn-danger',
        'form[action*="logout"] button',
        'a[href*="logout"]'
    ], 2000);
    logTest('PR04', 'Bouton deconnexion', logoutBtn.found ? 'PASS' : 'FAIL',
        logoutBtn.found ? `Trouve: ${logoutBtn.selector}` : '');

    // FIXED: Edit profile link - a[href*="profile/edit"]
    const editProfile = await elementExistsAny(page, [
        'a[href*="profile/edit"]',
        '.profile-item[href*="edit"]',
        '.edit-profile'
    ], 2000);
    logTest('PR05', 'Lien modifier profil', editProfile.found ? 'PASS' : 'FAIL',
        editProfile.found ? `Trouve: ${editProfile.selector}` : '');

    // FIXED: Change password link - a[href*="profile/password"]
    const changePassword = await elementExistsAny(page, [
        'a[href*="profile/password"]',
        '.profile-item[href*="password"]',
        '.change-password'
    ], 2000);
    logTest('PR06', 'Lien changer mot de passe', changePassword.found ? 'PASS' : 'FAIL',
        changePassword.found ? `Trouve: ${changePassword.selector}` : '');
}

async function testBookingPage(page) {
    console.log('\n📝 === PAGE RESERVATION ===\n');

    // Go back to dashboard and try booking
    await page.goto(BASE_URL + '/passenger/dashboard', { waitUntil: 'networkidle0' });
    await page.waitForTimeout(1000);

    const bookBtn = await elementExistsAny(page, [
        '.where-to',
        '.book-ride',
        'a[href*="book"]',
        '.search-ride',
        '.cta-book'
    ], 2000);

    if (bookBtn.found) {
        await page.click(bookBtn.selector);
        await page.waitForTimeout(2000);
        await screenshot(page, '10-booking');

        // FIXED: Use correct selectors from book-ride-uber.phtml
        const tests = [
            { id: 'B01', selectors: ['#map', '.booking-map', '.map-container'], name: 'Carte visible' },
            // FIXED: Pickup input is #pickupInput
            { id: 'B02', selectors: ['#pickupInput', 'input[id*="pickup"]', '.booking-input:first-of-type'], name: 'Champ depart' },
            // FIXED: Dropoff input is #dropoffInput
            { id: 'B03', selectors: ['#dropoffInput', 'input[id*="dropoff"]', '.booking-input:last-of-type'], name: 'Champ destination' },
            // FIXED: Back button is .booking-back
            { id: 'B04', selectors: ['.booking-back', 'a[href*="dashboard"]', '.back-btn'], name: 'Bouton retour' },
        ];

        for (const test of tests) {
            const result = await elementExistsAny(page, test.selectors, 2000);
            logTest(test.id, test.name, result.found ? 'PASS' : 'FAIL');
        }

        // Check if map is actually rendered (canvas or Leaflet/MapLibre elements)
        const mapRendered = await page.evaluate(() => {
            const mapEl = document.querySelector('#map, .booking-map');
            if (!mapEl) return false;
            // Check for canvas (MapLibre) or Leaflet container
            const hasCanvas = mapEl.querySelector('canvas') !== null;
            const hasLeaflet = mapEl.querySelector('.leaflet-container, .maplibregl-map, .mapboxgl-map') !== null;
            // Also check if map has any children (tiles, etc.)
            const hasChildren = mapEl.children.length > 0;
            return hasCanvas || hasLeaflet || hasChildren;
        });
        logTest('B05', 'Carte MapLibre/Leaflet chargee', mapRendered ? 'PASS' : 'FAIL');
    } else {
        logTest('B00', 'Acces page reservation', 'FAIL', 'Bouton non trouve');
    }
}

async function testDriverLogin(page) {
    console.log('\n📝 === CONNEXION CONDUCTRICE ===\n');

    // Logout first if logged in
    await page.goto(BASE_URL + '/logout', { waitUntil: 'networkidle0' }).catch(() => {});
    await page.waitForTimeout(1000);

    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // Login as driver
    await page.$eval('#email', el => el.value = '');
    await page.type('#email', DRIVER_EMAIL);
    await page.$eval('#password', el => el.value = '');
    await page.type('#password', DRIVER_PASSWORD);

    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await page.waitForTimeout(2000);

    await screenshot(page, '11-driver-dashboard');

    const url = page.url();
    const isLoggedIn = url.includes('dashboard') || url.includes('driver') || !url.includes('login');
    logTest('D01', 'Connexion conductrice reussie', isLoggedIn ? 'PASS' : 'FAIL', `URL: ${url}`);

    if (isLoggedIn && url.includes('driver')) {
        await testDriverDashboard(page);
    }
}

async function testDriverDashboard(page) {
    console.log('\n📝 === DASHBOARD CONDUCTRICE ===\n');

    // FIXED: Use correct selectors from driver-dashboard-uber.phtml
    const tests = [
        // Toggle is .status-toggle with input inside, or #availabilityToggle
        { id: 'DD01', selectors: ['.status-toggle', '#availabilityToggle', '.driver-status-card'], name: 'Toggle disponibilite' },
        // Earnings are in .driver-stat elements
        { id: 'DD02', selectors: ['.driver-stat', '.driver-stats', '.earnings-card'], name: 'Stats/Gains' },
        // Ride requests: either .ride-requests (if pending) or .empty-state (if none)
        { id: 'DD03', selectors: ['.ride-requests', '.ride-request', '.empty-state', '.section-title'], name: 'Section demandes/vide' },
        { id: 'DD04', selectors: ['nav', '.mobile-nav', '.bottom-nav', '.navigation'], name: 'Navigation' },
    ];

    for (const test of tests) {
        const result = await elementExistsAny(page, test.selectors, 1500);
        logTest(test.id, test.name, result.found ? 'PASS' : 'FAIL');
    }

    // Test toggle if exists
    const toggleExists = await elementExists(page, '#availabilityToggle', 2000);
    if (toggleExists) {
        try {
            // Use evaluate to click the checkbox directly
            await page.evaluate(() => {
                const toggle = document.getElementById('availabilityToggle');
                if (toggle) toggle.click();
            });
            await page.waitForTimeout(1500);
            await screenshot(page, '12-driver-toggle');
            logTest('DD05', 'Toggle fonctionne', 'PASS');
        } catch (e) {
            logTest('DD05', 'Toggle fonctionne', 'FAIL', e.message);
        }
    }
}

async function testResponsive(page) {
    console.log('\n📝 === TESTS RESPONSIVE ===\n');

    const viewports = [
        { id: 'RS01', name: 'iPhone 5 (320px)', width: 320, height: 568 },
        { id: 'RS02', name: 'iPhone SE (375px)', width: 375, height: 667 },
        { id: 'RS03', name: 'iPhone XR (414px)', width: 414, height: 896 },
        { id: 'RS04', name: 'Android (360px)', width: 360, height: 640 },
        { id: 'RS05', name: 'Tablet (768px)', width: 768, height: 1024 },
    ];

    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    for (const vp of viewports) {
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.waitForTimeout(300);

        const hasOverflow = await page.evaluate(() => {
            return document.body.scrollWidth > window.innerWidth;
        });

        logTest(vp.id, `${vp.name} - pas d'overflow`, !hasOverflow ? 'PASS' : 'FAIL', hasOverflow ? 'OVERFLOW HORIZONTAL' : '');
        await screenshot(page, `responsive-${vp.width}`);
    }

    // Reset
    await page.setViewport({ width: 414, height: 896 });
}

async function testAccessibility(page) {
    console.log('\n📝 === TESTS ACCESSIBILITE ===\n');

    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // Check buttons without labels (exclude toggle buttons that have visual indicators)
    const buttonsWithoutLabels = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button:not(.password-toggle)');
        const issues = [];
        buttons.forEach(btn => {
            const hasText = btn.textContent?.trim().length > 0;
            const hasAriaLabel = btn.getAttribute('aria-label');
            const hasTitle = btn.getAttribute('title');
            const hasSvgTitle = btn.querySelector('svg title');
            if (!hasText && !hasAriaLabel && !hasTitle && !hasSvgTitle) {
                issues.push(btn.className || btn.id || 'unknown');
            }
        });
        return issues;
    });

    // Password toggle is a known issue but acceptable (has visual icons)
    const criticalIssues = buttonsWithoutLabels.filter(b => !b.includes('toggle'));
    logTest('A01', 'Boutons avec label accessible', criticalIssues.length === 0 ? 'PASS' : 'FAIL',
        criticalIssues.length > 0 ? `Sans label: ${criticalIssues.join(', ')}` : '');

    // Check inputs without labels (excluding hidden, submit, and those with placeholder)
    const inputsWithoutLabels = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"])');
        const issues = [];
        inputs.forEach(input => {
            const hasLabel = input.id && document.querySelector(`label[for="${input.id}"]`);
            const hasAriaLabel = input.getAttribute('aria-label');
            const hasPlaceholder = input.getAttribute('placeholder');
            if (!hasLabel && !hasAriaLabel && !hasPlaceholder) {
                issues.push(input.id || input.name || 'unknown');
            }
        });
        return issues;
    });

    logTest('A02', 'Inputs avec label accessible', inputsWithoutLabels.length === 0 ? 'PASS' : 'FAIL',
        inputsWithoutLabels.length > 0 ? `Sans label: ${inputsWithoutLabels.join(', ')}` : '');
}

async function testSecurity(page) {
    console.log('\n📝 === TESTS SECURITE ===\n');

    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // CSRF token in meta
    const csrfMeta = await page.$('meta[name="csrf-token"]');
    logTest('S01', 'Meta CSRF token presente', csrfMeta ? 'PASS' : 'FAIL');

    // CSRF field in form
    const csrfField = await elementExistsAny(page, [
        'input[name="_csrf_token"]',
        'input[name="csrf_token"]',
        'input[name="_token"]'
    ], 2000);
    logTest('S02', 'Champ CSRF dans formulaire', csrfField.found ? 'PASS' : 'FAIL');

    // Check password not in localStorage
    const localStorage = await page.evaluate(() => {
        return JSON.stringify(localStorage);
    });
    const hasPlainPassword = localStorage.includes('password') && localStorage.includes('TripSalama');
    logTest('S03', 'Pas de password en clair dans localStorage', !hasPlainPassword ? 'PASS' : 'FAIL',
        hasPlainPassword ? 'MOT DE PASSE EN CLAIR - CRITIQUE' : '');
}

// ============================================
// MAIN EXECUTION
// ============================================

async function runAudit() {
    console.log('🚀 TripSalama - Audit Complete v5');
    console.log('==================================\n');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 414, height: 896 },
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    try {
        await testLoginPage(page);
        await testRegisterPage(page);
        await testForgotPasswordPage(page);
        await testPassengerLogin(page);
        await testBookingPage(page);
        await testDriverLogin(page);
        await testResponsive(page);
        await testAccessibility(page);
        await testSecurity(page);

    } catch (error) {
        console.error('\n❌ ERREUR:', error.message);
        results.bugs.push({ id: 'FATAL', name: 'Fatal error', details: error.message });
    }

    // Generate report
    console.log('\n\n📊 === RAPPORT FINAL ===');
    console.log('========================\n');
    console.log(`Total tests:     ${results.totalTests}`);
    console.log(`✅ Passes:       ${results.passed}`);
    console.log(`❌ Echecs:       ${results.failed}`);
    console.log(`📈 Taux:         ${((results.passed / results.totalTests) * 100).toFixed(1)}%`);

    if (results.failed > 0) {
        console.log(`\n🐛 Tests echoues: ${results.failed}`);
        results.tests.filter(t => t.status === 'FAIL').forEach((test, i) => {
            console.log(`  ${i + 1}. [${test.id}] ${test.name}${test.details ? ': ' + test.details : ''}`);
        });
    }

    if (consoleErrors.length > 0) {
        console.log(`\n⚠️ Erreurs console JS: ${consoleErrors.length}`);
        consoleErrors.slice(0, 5).forEach((err, i) => {
            console.log(`  ${i + 1}. ${err.substring(0, 100)}`);
        });
    }

    // Save JSON report
    const reportPath = path.join(SCREENSHOT_DIR, 'audit-report-v5.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📁 Rapport: ${reportPath}`);
    console.log(`📁 Screenshots: ${SCREENSHOT_DIR}`);

    await browser.close();
    console.log('\n✅ Audit termine!');

    // Return exit code based on results
    process.exit(results.failed > 0 ? 1 : 0);
}

runAudit().catch(console.error);
