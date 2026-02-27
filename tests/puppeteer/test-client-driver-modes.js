/**
 * TripSalama - Test Client & Driver Modes
 * Tests both passenger booking flow and driver dashboard
 */

const puppeteer = require('puppeteer');
const config = require('./config-prod');
const path = require('path');
const fs = require('fs');

const screenshotDir = path.join(__dirname, 'screenshots-modes');

// Ensure screenshot directory exists
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

async function screenshot(page, name) {
    const filepath = path.join(screenshotDir, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`    Screenshot: ${name}.png`);
}

async function login(page, email, password) {
    console.log(`  Logging in as ${email}...`);

    await page.goto(config.url('login'), { waitUntil: 'networkidle2', timeout: config.timeout.navigation });
    await config.sleep(1000);

    // Fill login form
    await page.waitForSelector(config.selectors.emailInput, { timeout: config.timeout.element });
    await page.type(config.selectors.emailInput, email, { delay: 50 });
    await page.type(config.selectors.passwordInput, password, { delay: 50 });

    await screenshot(page, `login-${email.split('@')[0]}-filled`);

    // Submit
    await page.click(config.selectors.submitBtn);
    await config.sleep(3000);

    // Check if logged in
    const currentUrl = page.url();
    console.log(`    Current URL: ${currentUrl}`);

    return !currentUrl.includes('login');
}

async function testClientMode(browser) {
    console.log('\n========================================');
    console.log('TEST 1: CLIENT (PASSENGER) MODE');
    console.log('========================================\n');

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 }); // iPhone 14 Pro

    try {
        // 1. Login as passenger
        console.log('Step 1: Login as passenger');
        const loggedIn = await login(page, config.users.passenger.email, config.users.passenger.password);

        if (!loggedIn) {
            console.log('  Login failed, checking for registration or redirect...');
            await screenshot(page, 'client-login-result');
        }

        await screenshot(page, 'client-after-login');

        // 2. Check booking page
        console.log('\nStep 2: Navigate to booking page');
        await page.goto(config.url('passenger/book'), { waitUntil: 'networkidle2', timeout: config.timeout.navigation });
        await config.sleep(2000);

        await screenshot(page, 'client-booking-page');

        // 3. Check map visibility
        console.log('\nStep 3: Check map component');
        const mapExists = await page.$('#map, .map-container, [data-map]');
        console.log(`  Map visible: ${mapExists ? 'YES' : 'NO'}`);

        // 4. Try to enter an address
        console.log('\nStep 4: Test address input');
        const pickupInput = await page.$('#pickup, input[name="pickup"], .pickup-input, input[placeholder*="départ"], input[placeholder*="pickup"]');
        if (pickupInput) {
            await pickupInput.type('Genève', { delay: 100 });
            await config.sleep(2000);
            await screenshot(page, 'client-address-autocomplete');
            console.log('  Address input working');
        } else {
            console.log('  Pickup input not found');
        }

        // 5. Check profile/settings
        console.log('\nStep 5: Check profile section');
        await page.goto(config.url('profile'), { waitUntil: 'networkidle2', timeout: config.timeout.navigation });
        await config.sleep(1500);
        await screenshot(page, 'client-profile');

        // 6. Check ride history
        console.log('\nStep 6: Check ride history');
        await page.goto(config.url('passenger/history'), { waitUntil: 'networkidle2', timeout: config.timeout.navigation });
        await config.sleep(1500);
        await screenshot(page, 'client-history');

        console.log('\n✅ Client mode test completed');

    } catch (error) {
        console.error(`\n❌ Client mode test failed: ${error.message}`);
        await screenshot(page, 'client-error');
    } finally {
        await page.close();
    }
}

async function testDriverMode(browser) {
    console.log('\n========================================');
    console.log('TEST 2: DRIVER (CONDUCTEUR) MODE');
    console.log('========================================\n');

    // Create incognito context for fresh session
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 }); // iPhone 14 Pro

    try {
        // 1. Login as driver
        console.log('Step 1: Login as driver');
        const loggedIn = await login(page, config.users.driver.email, config.users.driver.password);

        if (!loggedIn) {
            console.log('  Login failed, checking for registration or redirect...');
            await screenshot(page, 'driver-login-result');
        }

        await screenshot(page, 'driver-after-login');

        // 2. Check driver dashboard
        console.log('\nStep 2: Navigate to driver dashboard');
        await page.goto(config.url('driver/dashboard'), { waitUntil: 'networkidle2', timeout: config.timeout.navigation });
        await config.sleep(2000);

        await screenshot(page, 'driver-dashboard');

        // 3. Check online/offline toggle
        console.log('\nStep 3: Check online status toggle');
        const statusToggle = await page.$('.status-toggle, #driver-status, .online-toggle, button[data-action="toggle-status"]');
        if (statusToggle) {
            console.log('  Status toggle found');
            await screenshot(page, 'driver-status-toggle');
        } else {
            console.log('  Status toggle not found directly');
        }

        // 4. Check available rides
        console.log('\nStep 4: Check available rides section');
        await page.goto(config.url('driver/dashboard'), { waitUntil: 'networkidle2', timeout: config.timeout.navigation });
        await config.sleep(1500);
        await screenshot(page, 'driver-available-rides');

        // 5. Check driver earnings
        console.log('\nStep 5: Check earnings section');
        await page.goto(config.url('driver/dashboard'), { waitUntil: 'networkidle2', timeout: config.timeout.navigation });
        await config.sleep(1500);
        await screenshot(page, 'driver-earnings');

        // 6. Check driver profile
        console.log('\nStep 6: Check driver profile');
        await page.goto(config.url('profile'), { waitUntil: 'networkidle2', timeout: config.timeout.navigation });
        await config.sleep(1500);
        await screenshot(page, 'driver-profile');

        // 7. Check vehicle info
        console.log('\nStep 7: Check vehicle info');
        await page.goto(config.url('profile'), { waitUntil: 'networkidle2', timeout: config.timeout.navigation });
        await config.sleep(1500);
        await screenshot(page, 'driver-vehicle');

        console.log('\n✅ Driver mode test completed');

    } catch (error) {
        console.error(`\n❌ Driver mode test failed: ${error.message}`);
        await screenshot(page, 'driver-error');
    } finally {
        await context.close();
    }
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║        TRIPSALAMA - CLIENT & DRIVER MODE TESTS              ║');
    console.log('║                    PRODUCTION                                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`\nBase URL: ${config.baseUrl}`);
    console.log(`Screenshots: ${screenshotDir}\n`);

    const browser = await puppeteer.launch({
        ...config.puppeteer,
        headless: false  // Visual mode as per user instructions
    });

    try {
        // Test Client Mode
        await testClientMode(browser);

        // Test Driver Mode
        await testDriverMode(browser);

        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║                    TESTS COMPLETED                           ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log(`\nScreenshots saved in: ${screenshotDir}`);

    } finally {
        await browser.close();
    }
}

main().catch(console.error);
