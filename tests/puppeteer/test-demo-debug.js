/**
 * TripSalama - Test Demo Debug
 * Quick test to see console logs and identify issues
 */
const puppeteer = require('puppeteer');

const config = {
    baseUrl: 'http://localhost:8080',
    email: 'passenger@tripsalama.ch',
    password: 'password',
    timeout: 60000
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testDemoDebug() {
    console.log('🔍 TripSalama - Demo Debug Test');
    console.log('================================\n');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 30,
        args: ['--window-size=430,932', '--window-position=100,50'],
        defaultViewport: { width: 430, height: 932, isMobile: true, hasTouch: true }
    });

    const page = await browser.newPage();

    // Allow geolocation
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(config.baseUrl, ['geolocation']);
    await page.setGeolocation({ latitude: 33.5731, longitude: -7.5898 });

    // Log ALL console messages
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error') {
            console.log('❌ ERROR:', text);
        } else if (type === 'warning') {
            console.log('⚠️  WARN:', text);
        } else if (text.includes('[Demo]')) {
            console.log('🔵 DEMO:', text);
        }
    });

    // Log page errors
    page.on('pageerror', error => {
        console.log('💥 PAGE ERROR:', error.message);
    });

    try {
        // Login
        console.log('📍 Step 1: Login');
        await page.goto(`${config.baseUrl}/login`, { waitUntil: 'networkidle2', timeout: config.timeout });

        const emailInput = await page.$('input[type="email"], input[name="email"]');
        const passwordInput = await page.$('input[type="password"], input[name="password"]');

        if (emailInput && passwordInput) {
            await emailInput.click({ clickCount: 3 });
            await emailInput.type(config.email);
            await passwordInput.type(config.password);

            const submitBtn = await page.$('button[type="submit"]');
            if (submitBtn) {
                await submitBtn.click();
                await sleep(3000);
            }
        }

        console.log('✅ Logged in, URL:', page.url());

        // Go directly to demo page
        console.log('\n📍 Step 2: Go to Demo Page');
        await page.goto(`${config.baseUrl}/passenger/demo/0`, { waitUntil: 'networkidle2', timeout: config.timeout });
        console.log('✅ Demo page loaded');

        // Wait and watch the console
        console.log('\n📍 Step 3: Watching for 30 seconds...');
        await sleep(30000);

        // Check vehicle marker
        const hasVehicle = await page.evaluate(() => {
            return document.querySelector('.uber-vehicle-marker, .marker-vehicle, .uber-vehicle-icon') !== null;
        });
        console.log('\n🚗 Vehicle marker visible:', hasVehicle);

        // Check ETA values
        const etaValue = await page.evaluate(() => {
            const el = document.getElementById('etaTime');
            return el ? el.textContent : 'NOT FOUND';
        });
        console.log('⏱️  ETA value:', etaValue);

        const distValue = await page.evaluate(() => {
            const el = document.getElementById('distanceKm');
            return el ? el.textContent : 'NOT FOUND';
        });
        console.log('📏 Distance value:', distValue);

        // Keep browser open
        console.log('\n⏳ Browser open for 30 more seconds...');
        await sleep(30000);

    } catch (error) {
        console.error('\n❌ Test error:', error.message);
    }

    await browser.close();
}

testDemoDebug().catch(console.error);
