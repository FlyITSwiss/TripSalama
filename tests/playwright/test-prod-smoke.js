/**
 * TripSalama - Production Smoke Test
 * Quick visual verification of core functionality
 */

const { chromium } = require('playwright');

const PROD_URL = 'https://stabilis-it.ch/internal/tripsalama';
const TEST_CREDENTIALS = {
    driver: { email: 'driver@test.com', password: 'Test123!' },
    passenger: { email: 'passenger@test.com', password: 'Test123!' }
};

async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 TripSalama Production Smoke Test');
    console.log('='.repeat(60) + '\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });

    const context = await browser.newContext({
        viewport: { width: 430, height: 932 }, // iPhone 14 Pro Max
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    });

    const page = await context.newPage();
    let passed = 0;
    let failed = 0;

    try {
        // Test 1: Login page loads
        console.log('📍 Test 1: Login page...');
        await page.goto(PROD_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 });
        await page.screenshot({ path: 'test-results/prod-01-login.png' });

        const loginForm = await page.$('form');
        if (loginForm) {
            console.log('   ✅ Login page OK');
            passed++;
        } else {
            console.log('   ❌ Login form not found');
            failed++;
        }

        // Test 2: Try login as passenger
        console.log('📍 Test 2: Login as passenger...');
        await page.fill('input[name="email"], input[type="email"]', TEST_CREDENTIALS.passenger.email);
        await page.fill('input[name="password"], input[type="password"]', TEST_CREDENTIALS.passenger.password);
        await page.click('button[type="submit"]');

        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'test-results/prod-02-after-login.png' });

        const currentUrl = page.url();
        console.log('   Current URL:', currentUrl);

        if (currentUrl.includes('dashboard') || currentUrl.includes('verification')) {
            console.log('   ✅ Login redirected correctly');
            passed++;
        } else {
            console.log('   ⚠️ Unexpected URL after login');
            failed++;
        }

        // Test 3: Check for console errors
        console.log('📍 Test 3: Console errors check...');
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error' && !msg.text().includes('favicon')) {
                consoleErrors.push(msg.text());
            }
        });

        await page.reload();
        await page.waitForTimeout(2000);

        if (consoleErrors.length === 0) {
            console.log('   ✅ No console errors');
            passed++;
        } else {
            console.log('   ⚠️ Console errors:', consoleErrors.slice(0, 3));
            failed++;
        }

        // Test 4: Check API health
        console.log('📍 Test 4: API health check...');
        const apiResponse = await page.evaluate(async () => {
            try {
                const res = await fetch('/internal/tripsalama/api/health');
                return { status: res.status, ok: res.ok };
            } catch (e) {
                return { error: e.message };
            }
        });

        if (apiResponse.ok || apiResponse.status === 200) {
            console.log('   ✅ API health OK');
            passed++;
        } else {
            console.log('   ⚠️ API health:', apiResponse);
            failed++;
        }

        // Test 5: Check registration page
        console.log('📍 Test 5: Registration page...');
        await page.goto(PROD_URL + '/register', { waitUntil: 'networkidle', timeout: 30000 });
        await page.screenshot({ path: 'test-results/prod-05-register.png' });

        const registerContent = await page.textContent('body');
        if (registerContent.includes('Passag') || registerContent.includes('Conduct')) {
            console.log('   ✅ Registration page OK');
            passed++;
        } else {
            console.log('   ❌ Registration page incomplete');
            failed++;
        }

    } catch (error) {
        console.error('❌ Test error:', error.message);
        await page.screenshot({ path: 'test-results/prod-error.png' });
        failed++;
    } finally {
        console.log('\n' + '='.repeat(60));
        console.log(`📊 Results: ${passed} passed, ${failed} failed`);
        console.log('='.repeat(60));

        await browser.close();
    }

    process.exit(failed > 0 ? 1 : 0);
}

// Ensure test-results directory exists
const fs = require('fs');
if (!fs.existsSync('test-results')) {
    fs.mkdirSync('test-results', { recursive: true });
}

runTests().catch(console.error);
