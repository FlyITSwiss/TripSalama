/**
 * TripSalama - Test Responsive Booking Page
 * Teste l'affichage sur différentes tailles d'écran
 */

const puppeteer = require('puppeteer');
const path = require('path');
const config = require('./config');

const viewports = [
    { name: 'iPhone-SE', width: 375, height: 667 },
    { name: 'iPhone-14-Pro', width: 393, height: 852 },
    { name: 'iPhone-14-Pro-Max', width: 430, height: 932 },
    { name: 'Pixel-7', width: 412, height: 915 },
    { name: 'iPad-Mini', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 800 }
];

async function runResponsiveTests() {
    const browser = await puppeteer.launch({
        ...config.puppeteer,
        headless: false
    });

    const page = await browser.newPage();
    const screenshotDir = path.join(__dirname, 'screenshots');
    let passed = 0;
    let failed = 0;

    console.log('\n[Responsive Test] Démarrage des tests...\n');

    try {
        // Login first at desktop size
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(config.url('login'), {
            waitUntil: 'networkidle0',
            timeout: config.timeout.navigation
        });

        await page.waitForSelector(config.selectors.emailInput, { timeout: config.timeout.element });
        await page.type(config.selectors.emailInput, config.users.passenger.email);
        await page.type(config.selectors.passwordInput, config.users.passenger.password);

        await Promise.all([
            page.click(config.selectors.submitBtn),
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: config.timeout.navigation }).catch(() => {})
        ]);

        await config.sleep(1000);

        // Go to booking page
        await page.goto(config.url('passenger/book'), {
            waitUntil: 'networkidle0',
            timeout: config.timeout.navigation
        });
        await page.waitForSelector('#map', { timeout: config.timeout.element });
        await config.sleep(1500);

        // Test each viewport
        for (const viewport of viewports) {
            console.log(`  Testing ${viewport.name} (${viewport.width}x${viewport.height})...`);

            await page.setViewport({
                width: viewport.width,
                height: viewport.height,
                deviceScaleFactor: viewport.width < 768 ? 2 : 1,
                isMobile: viewport.width < 768
            });

            await config.sleep(500);

            // Check critical elements are visible
            const checks = await page.evaluate(() => {
                const map = document.getElementById('map');
                const mapRect = map?.getBoundingClientRect();
                const pickupInput = document.getElementById('pickupInput');
                const locateBtn = document.getElementById('locateMeBtn');
                const card = document.querySelector('.booking-card');
                const cardRect = card?.getBoundingClientRect();

                return {
                    mapVisible: map && mapRect.width > 0 && mapRect.height > 0,
                    mapWidth: mapRect?.width,
                    inputVisible: pickupInput && pickupInput.offsetParent !== null,
                    locateBtnVisible: locateBtn && locateBtn.offsetParent !== null,
                    cardNotOverflowing: cardRect ? cardRect.right <= window.innerWidth + 5 : false,
                    noHorizontalScroll: document.documentElement.scrollWidth <= window.innerWidth + 5
                };
            });

            const allPassed = Object.values(checks).every(v => v === true || typeof v === 'number');

            if (allPassed) {
                console.log(`    \x1b[32m✓\x1b[0m ${viewport.name} - OK`);
                passed++;
            } else {
                console.log(`    \x1b[31m✗\x1b[0m ${viewport.name} - FAILED`);
                console.log('      Checks:', JSON.stringify(checks));
                failed++;
            }

            // Take screenshot
            const filename = `responsive-${viewport.name.toLowerCase()}-booking-${Date.now()}.png`;
            await page.screenshot({
                path: path.join(screenshotDir, filename),
                fullPage: false
            });
            console.log(`    📸 ${filename}`);
        }

    } catch (error) {
        console.error('\x1b[31mError:\x1b[0m', error.message);
        failed++;
    } finally {
        await browser.close();
    }

    // Summary
    console.log('\n============================================================');
    console.log('Suite: Responsive Booking Page');
    console.log(`Total: ${viewports.length} viewports`);
    console.log(`\x1b[32mPassed: ${passed}\x1b[0m`);
    if (failed > 0) console.log(`\x1b[31mFailed: ${failed}\x1b[0m`);
    console.log('============================================================\n');

    return failed === 0;
}

runResponsiveTests().then(success => {
    process.exit(success ? 0 : 1);
});
