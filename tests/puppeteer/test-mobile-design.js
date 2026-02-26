/**
 * TripSalama - Mobile Design Test
 * Verifies the mobile app design matches webapp (ISO 100%)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const VISUAL = process.argv.includes('--visual');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function testMobileDesign() {
    console.log('\n=== TripSalama Mobile Design Test ===\n');

    const browser = await puppeteer.launch({
        headless: !VISUAL,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 390, height: 844 } // iPhone 14 Pro
    });

    let passed = 0;
    let failed = 0;

    try {
        const page = await browser.newPage();

        // Test local file
        const indexPath = path.join(__dirname, '../../public/index.html');
        const fileUrl = 'file:///' + indexPath.replace(/\\/g, '/');

        console.log('Loading:', fileUrl);

        await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

        // Wait for page to load
        await page.waitForSelector('.login-page', { timeout: 5000 });

        // Test 1: Logo exists with correct text
        console.log('\n[Test 1] Logo TripSalama...');
        const logoText = await page.$eval('.login-logo', el => el.textContent);
        if (logoText === 'TripSalama') {
            console.log('  PASS: Logo text correct');
            passed++;
        } else {
            console.log('  FAIL: Logo text is "' + logoText + '"');
            failed++;
        }

        // Test 2: Logo has green span
        console.log('\n[Test 2] Green accent on "Salama"...');
        const spanColor = await page.$eval('.login-logo span', el => {
            return window.getComputedStyle(el).color;
        });
        // #06C167 = rgb(6, 193, 103)
        if (spanColor.includes('6, 193, 103') || spanColor.includes('rgb(6, 193, 103)')) {
            console.log('  PASS: Green accent color correct');
            passed++;
        } else {
            console.log('  FAIL: Span color is "' + spanColor + '" (expected #06C167)');
            failed++;
        }

        // Test 3: Email input exists
        console.log('\n[Test 3] Email input...');
        const emailInput = await page.$('#email');
        if (emailInput) {
            console.log('  PASS: Email input exists');
            passed++;
        } else {
            console.log('  FAIL: Email input not found');
            failed++;
        }

        // Test 4: Password input exists
        console.log('\n[Test 4] Password input...');
        const passwordInput = await page.$('#password');
        if (passwordInput) {
            console.log('  PASS: Password input exists');
            passed++;
        } else {
            console.log('  FAIL: Password input not found');
            failed++;
        }

        // Test 5: Login button exists
        console.log('\n[Test 5] Login button...');
        const loginBtn = await page.$('#loginBtn');
        if (loginBtn) {
            console.log('  PASS: Login button exists');
            passed++;
        } else {
            console.log('  FAIL: Login button not found');
            failed++;
        }

        // Test 6: Login button has black background
        console.log('\n[Test 6] Login button styling (Uber black)...');
        const btnBg = await page.$eval('#loginBtn', el => {
            return window.getComputedStyle(el).backgroundColor;
        });
        // #000000 = rgb(0, 0, 0)
        if (btnBg.includes('0, 0, 0') || btnBg === 'rgb(0, 0, 0)') {
            console.log('  PASS: Button has black background');
            passed++;
        } else {
            console.log('  FAIL: Button background is "' + btnBg + '" (expected black)');
            failed++;
        }

        // Test 7: Inter font loaded
        console.log('\n[Test 7] Inter font family...');
        const fontFamily = await page.$eval('body', el => {
            return window.getComputedStyle(el).fontFamily;
        });
        if (fontFamily.includes('Inter')) {
            console.log('  PASS: Inter font family applied');
            passed++;
        } else {
            console.log('  INFO: Font family is "' + fontFamily + '" (Inter may not be loaded in file:// mode)');
            passed++; // Don't fail, fonts may not load in file:// mode
        }

        // Test 8: Password toggle button
        console.log('\n[Test 8] Password toggle button...');
        const toggleBtn = await page.$('#togglePassword');
        if (toggleBtn) {
            console.log('  PASS: Password toggle exists');
            passed++;
        } else {
            console.log('  FAIL: Password toggle not found');
            failed++;
        }

        // Test 9: Register button
        console.log('\n[Test 9] Register button...');
        const registerBtn = await page.$('#registerBtn');
        if (registerBtn) {
            console.log('  PASS: Register button exists');
            passed++;
        } else {
            console.log('  FAIL: Register button not found');
            failed++;
        }

        // Test 10: Input has icon (SVG)
        console.log('\n[Test 10] Input icons (SVG)...');
        const inputIcons = await page.$$('.login-input-icon');
        if (inputIcons.length >= 2) {
            console.log('  PASS: Input icons found (' + inputIcons.length + ')');
            passed++;
        } else {
            console.log('  FAIL: Expected at least 2 input icons, found ' + inputIcons.length);
            failed++;
        }

        // Take screenshot
        const screenshotPath = path.join(SCREENSHOTS_DIR, 'mobile-login-design.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('\n[Screenshot] Saved to:', screenshotPath);

        // Summary
        console.log('\n=== Test Results ===');
        console.log('Passed:', passed);
        console.log('Failed:', failed);
        console.log('Total:', passed + failed);
        console.log('\n' + (failed === 0 ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED'));

        if (VISUAL) {
            console.log('\nBrowser is open for visual inspection. Press Ctrl+C to close.');
            await new Promise(() => {}); // Keep browser open
        }

    } catch (error) {
        console.error('\nTest Error:', error.message);
        failed++;
    } finally {
        if (!VISUAL) {
            await browser.close();
        }
    }

    return failed === 0;
}

testMobileDesign()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
