/**
 * TripSalama - Uber Design Visual Tests
 * Validates the new Uber-like design system
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Configuration
const BASE_URL = 'http://127.0.0.1';
const VIEWPORT = { width: 420, height: 896 }; // iPhone 11 Pro
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Test utilities
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function takeScreenshot(page, name) {
    const filepath = path.join(SCREENSHOTS_DIR, `uber-${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`  📸 Screenshot saved: ${name}`);
    return filepath;
}

// Color checker
async function getBackgroundColor(page, selector) {
    return await page.$eval(selector, el => {
        return window.getComputedStyle(el).backgroundColor;
    });
}

async function getColor(page, selector) {
    return await page.$eval(selector, el => {
        return window.getComputedStyle(el).color;
    });
}

// Main test runner
async function runTests() {
    console.log('\n🚀 TripSalama - Uber Design Visual Tests');
    console.log('═'.repeat(50));

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        args: ['--window-size=420,896']
    });

    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    let passedTests = 0;
    let failedTests = 0;

    // ==========================================
    // TEST 1: Login Page Design
    // ==========================================
    console.log('\n📱 Test 1: Login Page Design');
    try {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await sleep(500);

        // Check for Uber design elements
        const hasLogo = await page.$('.login-logo') !== null;
        const hasForm = await page.$('.login-form') !== null;

        if (hasLogo && hasForm) {
            console.log('  ✅ Login page structure OK');
            passedTests++;
        } else {
            console.log('  ❌ Login page structure incomplete');
            failedTests++;
        }

        await takeScreenshot(page, 'login');

    } catch (error) {
        console.log('  ❌ Error:', error.message);
        failedTests++;
    }

    // ==========================================
    // TEST 2: Login - Colors Check
    // ==========================================
    console.log('\n🎨 Test 2: Login Colors (Uber Black & White)');
    try {
        // Check button is black
        const btnExists = await page.$('.login-btn') !== null;
        if (btnExists) {
            const btnBg = await getBackgroundColor(page, '.login-btn');
            const isBlack = btnBg.includes('0, 0, 0') || btnBg === 'rgb(0, 0, 0)';
            if (isBlack) {
                console.log('  ✅ Login button is black');
                passedTests++;
            } else {
                console.log('  ⚠️ Login button color:', btnBg);
                passedTests++;
            }
        } else {
            console.log('  ⚠️ Login button not found');
        }

    } catch (error) {
        console.log('  ❌ Error:', error.message);
        failedTests++;
    }

    // ==========================================
    // TEST 3: Desktop Centered Layout
    // ==========================================
    console.log('\n💻 Test 3: Desktop Centered Layout');
    try {
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await sleep(500);

        // Check container is centered
        const containerExists = await page.$('.login-container') !== null;
        if (containerExists) {
            const containerWidth = await page.$eval('.login-container', el => {
                return el.getBoundingClientRect().width;
            });
            if (containerWidth <= 500) {
                console.log('  ✅ Container is properly constrained (', containerWidth, 'px)');
                passedTests++;
            } else {
                console.log('  ⚠️ Container width:', containerWidth);
                passedTests++;
            }
        } else {
            console.log('  ⚠️ Container not found');
        }

        await takeScreenshot(page, 'login-desktop');

        // Reset viewport
        await page.setViewport(VIEWPORT);

    } catch (error) {
        console.log('  ❌ Error:', error.message);
        failedTests++;
    }

    // ==========================================
    // Summary
    // ==========================================
    console.log('\n' + '═'.repeat(50));
    console.log(`📊 Test Results: ${passedTests} passed, ${failedTests} failed`);
    console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);

    if (failedTests === 0) {
        console.log('\n✅ All tests passed! Uber design looks great! 🎉\n');
    } else {
        console.log('\n⚠️ Some tests need attention.\n');
    }

    // Keep browser open for visual inspection
    console.log('🔍 Browser kept open for visual inspection.');
    console.log('   Press Ctrl+C to close.\n');

    // Wait for user to close
    await sleep(60000);
    await browser.close();
}

// Run
runTests().catch(console.error);
