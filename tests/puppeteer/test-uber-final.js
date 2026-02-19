/**
 * TripSalama - Uber Design Final Visual Test
 * Captures all key pages with the new Uber-like design
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Configuration
const BASE_URL = 'http://127.0.0.1:8080';
const VIEWPORT = { width: 420, height: 896 };
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'uber-final');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function takeScreenshot(page, name) {
    const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`  📸 ${name}.png`);
    return filepath;
}

async function runTests() {
    console.log('\n🚀 TripSalama - Uber Design Final Test');
    console.log('═'.repeat(50));

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        args: ['--window-size=420,896']
    });

    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    try {
        // ==========================================
        // 1. Login Page
        // ==========================================
        console.log('\n📱 1. Login Page');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(1000);
        await takeScreenshot(page, '01-login-page');

        // Check for Uber design elements
        const bgColor = await page.evaluate(() => {
            return window.getComputedStyle(document.body).backgroundColor;
        });
        console.log(`  🎨 Body background: ${bgColor}`);

        const hasUberCSS = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
            return links.some(link => link.href.includes('uber-design-system'));
        });
        console.log(`  ✅ Uber CSS loaded: ${hasUberCSS}`);

        // ==========================================
        // 2. Login as Passenger
        // ==========================================
        console.log('\n📱 2. Login as Passenger');
        await page.type('input[name="email"]', 'fatima@example.com');
        await page.type('input[name="password"]', 'Test1234!');
        await takeScreenshot(page, '02-login-filled');

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
            page.click('button[type="submit"]')
        ]).catch(() => {});
        await sleep(1500);
        await takeScreenshot(page, '03-passenger-dashboard');

        // ==========================================
        // 3. Booking Page
        // ==========================================
        console.log('\n📱 3. Booking Page');
        const bookLink = await page.$('a[href*="book"]');
        if (bookLink) {
            await bookLink.click();
            await sleep(2000);
            await takeScreenshot(page, '04-booking-page');
        }

        // ==========================================
        // 4. History Page
        // ==========================================
        console.log('\n📱 4. History Page');
        await page.goto(`${BASE_URL}/passenger/history`, { waitUntil: 'networkidle2' });
        await sleep(1000);
        await takeScreenshot(page, '05-history-page');

        // ==========================================
        // 5. Profile Page
        // ==========================================
        console.log('\n📱 5. Profile Page');
        await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle2' });
        await sleep(1000);
        await takeScreenshot(page, '06-profile-page');

        // ==========================================
        // 6. Logout & Login as Driver
        // ==========================================
        console.log('\n📱 6. Driver Dashboard');
        await page.goto(`${BASE_URL}/logout`, { waitUntil: 'networkidle2' }).catch(() => {});
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await sleep(500);

        await page.type('input[name="email"]', 'khadija@example.com');
        await page.type('input[name="password"]', 'Test1234!');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
            page.click('button[type="submit"]')
        ]).catch(() => {});
        await sleep(1500);
        await takeScreenshot(page, '07-driver-dashboard');

        // ==========================================
        // 7. Desktop View
        // ==========================================
        console.log('\n💻 7. Desktop View');
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await sleep(1000);
        await takeScreenshot(page, '08-desktop-login');

        // ==========================================
        // Summary
        // ==========================================
        console.log('\n' + '═'.repeat(50));
        console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);
        console.log('\n✅ Test complete! Check screenshots for visual verification.\n');

        // Keep browser open for inspection
        console.log('🔍 Browser kept open for 30 seconds...');
        await sleep(30000);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        await takeScreenshot(page, 'error-state');
    } finally {
        await browser.close();
    }
}

runTests().catch(console.error);
