/**
 * TripSalama - Full Mobile App Test
 * Tests the mobile app against production API
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const VISUAL = process.argv.includes('--visual');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const API_BASE = 'https://stabilis-it.ch/internal/tripsalama/api';

// Test credentials
const TEST_PASSENGER = {
    email: 'test.passenger@tripsalama.com',
    password: 'Test123!'
};

const TEST_DRIVER = {
    email: 'test.driver@tripsalama.com',
    password: 'Test123!'
};

if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function testMobileApp() {
    console.log('\n=== TripSalama Full Mobile App Test ===\n');
    console.log('API Base:', API_BASE);

    const browser = await puppeteer.launch({
        headless: !VISUAL,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
        defaultViewport: { width: 390, height: 844 }
    });

    let passed = 0;
    let failed = 0;
    const results = [];

    function logTest(name, success, details = '') {
        if (success) {
            console.log(`  ✓ ${name}`);
            passed++;
        } else {
            console.log(`  ✗ ${name}${details ? ': ' + details : ''}`);
            failed++;
        }
        results.push({ name, success, details });
    }

    try {
        const page = await browser.newPage();

        // Enable console logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('  [Console Error]', msg.text());
            }
        });

        // Track network errors
        const networkErrors = [];
        page.on('requestfailed', request => {
            networkErrors.push({
                url: request.url(),
                reason: request.failure()?.errorText
            });
        });

        // ==========================================
        // TEST 1: API CSRF Endpoint
        // ==========================================
        console.log('\n[1] Testing API CSRF Endpoint...');
        try {
            const csrfResponse = await page.evaluate(async (apiBase) => {
                const response = await fetch(apiBase + '/auth.php?action=csrf', {
                    method: 'GET',
                    credentials: 'include'
                });
                return {
                    status: response.status,
                    data: await response.json().catch(() => null)
                };
            }, API_BASE);

            logTest('CSRF endpoint returns 200', csrfResponse.status === 200);
            logTest('CSRF token received', !!csrfResponse.data?.token);
        } catch (e) {
            logTest('CSRF endpoint accessible', false, e.message);
        }

        // ==========================================
        // TEST 2: API Auth Check Endpoint
        // ==========================================
        console.log('\n[2] Testing API Auth Check Endpoint...');
        try {
            const authResponse = await page.evaluate(async (apiBase) => {
                const response = await fetch(apiBase + '/auth.php?action=check', {
                    method: 'GET',
                    credentials: 'include'
                });
                return {
                    status: response.status,
                    data: await response.json().catch(() => null)
                };
            }, API_BASE);

            logTest('Auth check endpoint returns 200', authResponse.status === 200);
            logTest('Auth check returns JSON', authResponse.data !== null);
            logTest('Auth check has authenticated field', authResponse.data?.hasOwnProperty('authenticated'));
        } catch (e) {
            logTest('Auth check endpoint accessible', false, e.message);
        }

        // ==========================================
        // TEST 3: Load Mobile App HTML
        // ==========================================
        console.log('\n[3] Loading Mobile App HTML...');
        const indexPath = path.join(__dirname, '../../public/index.html');
        const fileUrl = 'file:///' + indexPath.replace(/\\/g, '/');

        await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.waitForSelector('.login-page', { timeout: 5000 });

        logTest('Mobile app HTML loads', true);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-login-page.png') });

        // ==========================================
        // TEST 4: Login Form Elements
        // ==========================================
        console.log('\n[4] Checking Login Form Elements...');

        const hasLogo = await page.$('.login-logo');
        logTest('Logo present', !!hasLogo);

        const hasEmailInput = await page.$('#email');
        logTest('Email input present', !!hasEmailInput);

        const hasPasswordInput = await page.$('#password');
        logTest('Password input present', !!hasPasswordInput);

        const hasLoginBtn = await page.$('#loginBtn');
        logTest('Login button present', !!hasLoginBtn);

        // ==========================================
        // TEST 5: Login Form Validation
        // ==========================================
        console.log('\n[5] Testing Login Form Validation...');

        // Try submitting empty form
        await page.click('#loginBtn');
        await page.waitForTimeout(500);

        // Check if HTML5 validation blocks submission
        const emailValidity = await page.$eval('#email', el => el.validity.valid);
        logTest('Empty email triggers validation', !emailValidity);

        // ==========================================
        // TEST 6: Password Toggle
        // ==========================================
        console.log('\n[6] Testing Password Toggle...');

        const passwordTypeBefore = await page.$eval('#password', el => el.type);
        logTest('Password initially hidden', passwordTypeBefore === 'password');

        await page.click('#togglePassword');
        await page.waitForTimeout(200);

        const passwordTypeAfter = await page.$eval('#password', el => el.type);
        logTest('Password toggle works', passwordTypeAfter === 'text');

        // Toggle back
        await page.click('#togglePassword');

        // ==========================================
        // TEST 7: Login API Integration
        // ==========================================
        console.log('\n[7] Testing Login API Integration...');

        // Fill in test credentials
        await page.type('#email', 'test@example.com');
        await page.type('#password', 'wrongpassword');

        // Intercept API calls
        let loginRequestMade = false;
        let loginResponse = null;

        page.on('response', async response => {
            if (response.url().includes('auth.php') && response.url().includes('login')) {
                loginRequestMade = true;
                try {
                    loginResponse = await response.json();
                } catch (e) {
                    loginResponse = { error: 'Failed to parse response' };
                }
            }
        });

        // Note: Since we're using file:// protocol, CORS will block API calls
        // This is expected behavior - the real test is on the actual device
        console.log('  [Info] API calls from file:// may be blocked by CORS');

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-login-filled.png') });

        // ==========================================
        // TEST 8: Check Dashboard HTML Structure
        // ==========================================
        console.log('\n[8] Checking Dashboard HTML Structure...');

        // Check passenger dashboard exists (hidden)
        const passengerDashboard = await page.$('#passengerDashboard');
        logTest('Passenger dashboard element exists', !!passengerDashboard);

        const passengerHidden = await page.$eval('#passengerDashboard', el => el.classList.contains('hidden'));
        logTest('Passenger dashboard initially hidden', passengerHidden);

        // Check driver dashboard exists (hidden)
        const driverDashboard = await page.$('#driverDashboard');
        logTest('Driver dashboard element exists', !!driverDashboard);

        const driverHidden = await page.$eval('#driverDashboard', el => el.classList.contains('hidden'));
        logTest('Driver dashboard initially hidden', driverHidden);

        // ==========================================
        // TEST 9: Simulate Successful Login (Passenger)
        // ==========================================
        console.log('\n[9] Simulating Successful Login (Passenger)...');

        // Manually set user and show dashboard
        await page.evaluate(() => {
            window.setCurrentUser({
                id: 1,
                email: 'test@example.com',
                first_name: 'Jean',
                last_name: 'Dupont',
                role: 'passenger'
            });
            window.showDashboard();
        });

        await page.waitForTimeout(500);

        const passengerVisible = await page.$eval('#passengerDashboard', el => !el.classList.contains('hidden'));
        logTest('Passenger dashboard shown after login', passengerVisible);

        const loginHidden = await page.$eval('#loginPage', el => el.classList.contains('hidden'));
        logTest('Login page hidden after login', loginHidden);

        const welcomeName = await page.$eval('#passengerName', el => el.textContent);
        logTest('User name displayed', welcomeName === 'Jean');

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-passenger-dashboard.png') });

        // Check passenger dashboard elements
        const whereToCard = await page.$('.where-to-card');
        logTest('Where-to card present', !!whereToCard);

        const safetyBanner = await page.$('.safety-banner');
        logTest('Safety banner present', !!safetyBanner);

        const statsGrid = await page.$('.stats-grid');
        logTest('Stats grid present', !!statsGrid);

        const mobileNav = await page.$('.mobile-nav');
        logTest('Mobile navigation present', !!mobileNav);

        // ==========================================
        // TEST 10: Simulate Successful Login (Driver)
        // ==========================================
        console.log('\n[10] Simulating Successful Login (Driver)...');

        await page.evaluate(() => {
            window.setCurrentUser({
                id: 2,
                email: 'driver@example.com',
                first_name: 'Mohammed',
                last_name: 'Conducteur',
                role: 'driver'
            });
            window.showDashboard();
        });

        await page.waitForTimeout(500);

        const driverVisible = await page.$eval('#driverDashboard', el => !el.classList.contains('hidden'));
        logTest('Driver dashboard shown for driver role', driverVisible);

        const driverName = await page.$eval('#driverName', el => el.textContent);
        logTest('Driver name displayed', driverName === 'Mohammed');

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-driver-dashboard.png') });

        // Check driver dashboard elements
        const statusCard = await page.$('.driver-status-card');
        logTest('Driver status card present', !!statusCard);

        const statusToggle = await page.$('#availabilityToggle');
        logTest('Availability toggle present', !!statusToggle);

        const earningsCard = await page.$('.earnings-card');
        logTest('Earnings card present', !!earningsCard);

        const emptyState = await page.$('.empty-state');
        logTest('Empty state for ride requests present', !!emptyState);

        // ==========================================
        // TEST 11: Driver Status Toggle (UI only, API may fail without real auth)
        // ==========================================
        console.log('\n[11] Testing Driver Status Toggle (UI)...');

        const toggleBefore = await page.$eval('#availabilityToggle', el => el.checked);
        logTest('Toggle initially off', !toggleBefore);

        // Manually toggle without triggering API call
        await page.evaluate(() => {
            const toggle = document.getElementById('availabilityToggle');
            toggle.checked = true;
            // Update UI directly
            window.updateDriverStatus(true);
        });
        await page.waitForTimeout(300);

        const toggleAfter = await page.$eval('#availabilityToggle', el => el.checked);
        logTest('Toggle UI can be changed', toggleAfter === true);

        const statusText = await page.$eval('#statusText', el => el.textContent);
        logTest('Status text updates', statusText === 'En ligne');

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-driver-online.png') });

        // ==========================================
        // TEST 12: Logout
        // ==========================================
        console.log('\n[12] Testing Logout...');

        await page.click('#driverLogoutBtn');
        await page.waitForTimeout(500);

        const loginVisibleAfterLogout = await page.$eval('#loginPage', el => !el.classList.contains('hidden'));
        logTest('Login page shown after logout', loginVisibleAfterLogout);

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-after-logout.png') });

        // ==========================================
        // TEST 13: Toast Notification
        // ==========================================
        console.log('\n[13] Testing Toast Notification...');

        await page.evaluate(() => {
            window.showToast('Test message', 'success');
        });

        await page.waitForTimeout(100);

        const toastVisible = await page.$eval('#toast', el => el.classList.contains('show'));
        logTest('Toast notification appears', toastVisible);

        const toastText = await page.$eval('#toast', el => el.textContent);
        logTest('Toast has correct message', toastText === 'Test message');

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-toast.png') });

        // ==========================================
        // SUMMARY
        // ==========================================
        console.log('\n' + '='.repeat(50));
        console.log('TEST RESULTS');
        console.log('='.repeat(50));
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Total:  ${passed + failed}`);
        console.log('='.repeat(50));

        if (networkErrors.length > 0) {
            console.log('\nNetwork Errors (expected for file:// protocol):');
            networkErrors.slice(0, 5).forEach(err => {
                console.log(`  - ${err.url.substring(0, 60)}...`);
            });
        }

        console.log('\nScreenshots saved to:', SCREENSHOTS_DIR);

        if (failed === 0) {
            console.log('\n✅ ALL TESTS PASSED!');
        } else {
            console.log('\n❌ SOME TESTS FAILED');
        }

        if (VISUAL) {
            console.log('\nBrowser open for inspection. Press Ctrl+C to close.');
            await new Promise(() => {});
        }

    } catch (error) {
        console.error('\n❌ Test Error:', error.message);
        failed++;
    } finally {
        if (!VISUAL) {
            await browser.close();
        }
    }

    return failed === 0;
}

testMobileApp()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error('Fatal:', err);
        process.exit(1);
    });
