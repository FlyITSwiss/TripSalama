/**
 * TripSalama Mobile App Test
 * Tests the mobile web app (APK content) with visual rendering
 * Simulates APK behavior in browser
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Configuration
const BASE_URL = 'https://stabilis-it.ch/internal/tripsalama';
const LOCAL_URL = 'http://127.0.0.1/internal/tripsalama';

// Test credentials from the build notification email
const TEST_CREDENTIALS = {
    passenger: {
        email: 'passenger@tripsalama.ch',
        password: 'TripSalama2025!'
    },
    driver: {
        email: 'driver@tripsalama.ch',
        password: 'TripSalama2025!'
    }
};

async function testMobileApp() {
    console.log('\n🚗 TripSalama Mobile App Test\n');

    // Create screenshots directory
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: false, // Visual mode
        defaultViewport: { width: 390, height: 844 }, // iPhone 14 Pro
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    });

    const page = await browser.newPage();

    // Mobile user agent (Android)
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');

    try {
        // Detect environment
        const isLocal = await testConnection(LOCAL_URL);
        const baseUrl = isLocal ? LOCAL_URL : BASE_URL;
        console.log(`📍 Testing on: ${baseUrl}\n`);

        // Test 1: Load mobile app
        console.log('📱 Test 1: Loading mobile app...');
        await page.goto(`${baseUrl}/mobile/index.html`, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(2000);

        await page.screenshot({
            path: path.join(screenshotsDir, 'mobile-01-splash.png'),
            fullPage: true
        });
        console.log('   ✅ Splash screen loaded\n');

        // Test 2: Check login screen appears
        console.log('📱 Test 2: Waiting for login screen...');
        await page.waitForSelector('#login-screen.active', { timeout: 5000 });
        await page.waitForTimeout(1000);

        await page.screenshot({
            path: path.join(screenshotsDir, 'mobile-02-login.png'),
            fullPage: true
        });
        console.log('   ✅ Login screen displayed\n');

        // Test 3: Login as passenger
        console.log('📱 Test 3: Testing passenger login...');
        await page.type('#login-email', TEST_CREDENTIALS.passenger.email, { delay: 50 });
        await page.type('#login-password', TEST_CREDENTIALS.passenger.password, { delay: 50 });

        await page.screenshot({
            path: path.join(screenshotsDir, 'mobile-03-login-filled.png'),
            fullPage: true
        });

        console.log('   🔐 Submitting login...');
        await page.click('#login-btn');
        await page.waitForTimeout(3000);

        // Check if login succeeded or failed
        const errorVisible = await page.evaluate(() => {
            const errorDiv = document.getElementById('login-error');
            return errorDiv && errorDiv.classList.contains('visible');
        });

        await page.screenshot({
            path: path.join(screenshotsDir, 'mobile-04-after-login.png'),
            fullPage: true
        });

        if (errorVisible) {
            const errorMessage = await page.$eval('#login-error', el => el.textContent);
            console.log(`   ❌ Login failed: ${errorMessage}`);

            // Try to get more details from console
            page.on('console', msg => console.log('   📋 Browser console:', msg.text()));

            // Check network errors
            page.on('requestfailed', request => {
                console.log(`   ⚠️  Network failed: ${request.url()} - ${request.failure().errorText}`);
            });

            // Check responses
            page.on('response', async response => {
                const url = response.url();
                if (url.includes('/api/auth')) {
                    console.log(`   🌐 API Response: ${response.status()} - ${url}`);
                    try {
                        const body = await response.text();
                        console.log(`   📦 Response body: ${body.substring(0, 200)}`);
                    } catch (e) {
                        // Ignore
                    }
                }
            });

        } else {
            // Check if dashboard is displayed
            const dashboardActive = await page.evaluate(() => {
                const passengerScreen = document.getElementById('passenger-screen');
                return passengerScreen && passengerScreen.classList.contains('active');
            });

            if (dashboardActive) {
                console.log('   ✅ Login successful! Passenger dashboard displayed\n');

                // Test 4: Test passenger dashboard
                console.log('📱 Test 4: Testing passenger dashboard...');
                await page.waitForTimeout(2000);

                await page.screenshot({
                    path: path.join(screenshotsDir, 'mobile-05-passenger-dashboard.png'),
                    fullPage: true
                });

                // Check map loaded
                const mapExists = await page.$('#map');
                if (mapExists) {
                    console.log('   ✅ Map container found');
                }

                // Test 5: Logout
                console.log('\n📱 Test 5: Testing logout...');
                await page.click('.logout-btn');
                await page.waitForTimeout(2000);

                await page.screenshot({
                    path: path.join(screenshotsDir, 'mobile-06-after-logout.png'),
                    fullPage: true
                });

                const backToLogin = await page.evaluate(() => {
                    const loginScreen = document.getElementById('login-screen');
                    return loginScreen && loginScreen.classList.contains('active');
                });

                if (backToLogin) {
                    console.log('   ✅ Logout successful - back to login screen\n');
                } else {
                    console.log('   ⚠️  Logout may have issues\n');
                }

                // Test 6: Login as driver
                console.log('📱 Test 6: Testing driver login...');
                await page.type('#login-email', TEST_CREDENTIALS.driver.email, { delay: 50 });
                await page.type('#login-password', TEST_CREDENTIALS.driver.password, { delay: 50 });

                await page.click('#login-btn');
                await page.waitForTimeout(3000);

                const driverDashboard = await page.evaluate(() => {
                    const driverScreen = document.getElementById('driver-screen');
                    return driverScreen && driverScreen.classList.contains('active');
                });

                if (driverDashboard) {
                    console.log('   ✅ Driver login successful!\n');

                    await page.screenshot({
                        path: path.join(screenshotsDir, 'mobile-07-driver-dashboard.png'),
                        fullPage: true
                    });

                    // Test driver status toggle
                    console.log('📱 Test 7: Testing driver status toggle...');
                    await page.click('#status-toggle');
                    await page.waitForTimeout(1000);

                    await page.screenshot({
                        path: path.join(screenshotsDir, 'mobile-08-driver-online.png'),
                        fullPage: true
                    });

                    const isOnline = await page.evaluate(() => {
                        const toggle = document.getElementById('status-toggle');
                        return toggle && toggle.classList.contains('active');
                    });

                    if (isOnline) {
                        console.log('   ✅ Driver status toggled to online\n');
                    }
                }
            } else {
                console.log('   ⚠️  Login response unclear - check screenshot\n');
            }
        }

        console.log('\n✅ Mobile App tests completed!');
        console.log('📸 Screenshots saved in tests/puppeteer/screenshots/');
        console.log('\n⏳ Browser will close in 15 seconds...');
        await page.waitForTimeout(15000);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);

        await page.screenshot({
            path: path.join(screenshotsDir, 'mobile-ERROR.png'),
            fullPage: true
        });

    } finally {
        await browser.close();
    }
}

/**
 * Test if a URL is reachable
 */
async function testConnection(url) {
    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        const response = await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 5000
        });
        await browser.close();
        return response && response.ok();
    } catch (e) {
        return false;
    }
}

// Run the test
testMobileApp();
