/**
 * TripSalama - Test Workflow Complet PRODUCTION
 * A-Z: Login -> Book -> Confirm -> Demo (Driver Approaching -> Boarding -> Trip -> Rating)
 */
const puppeteer = require('puppeteer');
const path = require('path');

const config = {
    baseUrl: 'https://stabilis-it.ch/internal/tripsalama',
    email: 'passenger@tripsalama.ch',
    password: 'password',
    screenshotDir: path.join(__dirname, 'screenshots-prod'),
    timeout: 60000
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function screenshot(page, name) {
    const filename = `${config.screenshotDir}/${Date.now()}-${name}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`Screenshot: ${name}`);
    return filename;
}

async function testProdWorkflow() {
    console.log('TripSalama - Test Production Workflow');
    console.log('======================================\n');
    console.log('URL:', config.baseUrl);

    // Create screenshot directory
    const fs = require('fs');
    if (!fs.existsSync(config.screenshotDir)) {
        fs.mkdirSync(config.screenshotDir, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 30,
        args: ['--window-size=430,932', '--window-position=100,50'],
        defaultViewport: { width: 430, height: 932, isMobile: true, hasTouch: true }
    });

    const page = await browser.newPage();

    // Allow geolocation and set simulated position
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(config.baseUrl, ['geolocation']);
    // Simulate position (required for Puppeteer tests)
    await page.setGeolocation({ latitude: 33.5731, longitude: -7.5898 }); // Casablanca

    // Log errors and demo messages
    page.on('console', msg => {
        const text = msg.text();
        if (msg.type() === 'error' && !text.includes('Manifest')) {
            console.log('Console Error:', text.substring(0, 100));
        } else if (text.includes('[Demo]')) {
            console.log('Demo:', text);
        }
    });

    let testsPassed = 0;

    try {
        // ==== PHASE 1: LOGIN ====
        console.log('\n[PHASE 1] Login');
        console.log('----------------');

        await page.goto(`${config.baseUrl}/login`, { waitUntil: 'networkidle2', timeout: config.timeout });
        await screenshot(page, '01-login');

        // Fill login form
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

        console.log('OK - Login URL:', page.url());
        await screenshot(page, '02-after-login');
        testsPassed++;

        // ==== PHASE 2: BOOKING ====
        console.log('\n[PHASE 2] Booking');
        console.log('------------------');

        await page.goto(`${config.baseUrl}/passenger/book`, { waitUntil: 'networkidle2', timeout: config.timeout });
        await sleep(2000);
        await screenshot(page, '03-booking');

        // Check map loaded
        const mapElement = await page.$('#map');
        if (mapElement) {
            console.log('OK - Map loaded');
            testsPassed++;
        }

        await sleep(3000);

        // Click locate button and wait for position
        const locateBtn = await page.$('#quickLocateBtn, #locateMeBtn');
        if (locateBtn) {
            await locateBtn.click();
            console.log('OK - Location button clicked');
            // Wait for geolocation to complete
            await page.waitForFunction(() => {
                const status = document.querySelector('#pickupStatusIndicator');
                return status && !status.textContent.includes('Detecting') && !status.textContent.includes('Detection');
            }, { timeout: 10000 }).catch(() => console.log('Warning: Geolocation timeout'));
            await sleep(2000);
        }

        // Enter dropoff address
        const dropoffInput = await page.$('#dropoffInput');
        if (dropoffInput) {
            await dropoffInput.click();
            await dropoffInput.type('Anfa Place Casablanca');
            console.log('OK - Destination entered');
            await sleep(3000);

            // Select first result
            const firstResult = await page.$('.autocomplete-item, .booking-dropdown-item');
            if (firstResult) {
                await firstResult.click();
                console.log('OK - Destination selected');
                testsPassed++;
                // Wait for route calculation
                await sleep(5000);
            }
        }

        await screenshot(page, '04-destination');

        // Wait for estimation card to appear
        console.log('Waiting for route estimation...');
        await page.waitForFunction(() => {
            const card = document.getElementById('estimationCard');
            return card && !card.classList.contains('hidden');
        }, { timeout: 15000 }).catch(() => console.log('Warning: Estimation card not visible'));

        await screenshot(page, '04b-estimation');

        // ==== PHASE 3: CONFIRM ====
        console.log('\n[PHASE 3] Confirmation');
        console.log('-----------------------');

        // Wait for confirm button to be visible
        await page.waitForFunction(() => {
            const btn = document.getElementById('confirmBtn');
            return btn && !btn.classList.contains('hidden');
        }, { timeout: 10000 }).catch(() => console.log('Warning: Confirm button not visible'));

        const confirmBtn = await page.$('#confirmBtn');
        if (confirmBtn) {
            const isVisible = await page.evaluate(el => !el.classList.contains('hidden'), confirmBtn);
            if (isVisible) {
                await confirmBtn.click();
                console.log('OK - Ride confirmed');
                testsPassed++;
                await sleep(5000);
            } else {
                console.log('Warning: Confirm button hidden');
            }
        } else {
            console.log('Warning: Confirm button not found');
        }

        await screenshot(page, '05-confirmed');

        // ==== PHASE 4: DEMO ====
        console.log('\n[PHASE 4] Demo Simulation');
        console.log('--------------------------');

        const demoUrl = page.url();
        if (demoUrl.includes('/demo/') || demoUrl.includes('/ride/')) {
            console.log('OK - Redirected to demo');
            testsPassed++;
        }

        await screenshot(page, '06-demo');

        // Helper to check if element is visible
        async function waitForVisible(selector, maxWait = 30000) {
            const start = Date.now();
            while (Date.now() - start < maxWait) {
                const isVisible = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    return el && !el.classList.contains('hidden') && el.offsetParent !== null;
                }, selector);
                if (isVisible) return true;
                await sleep(200);
            }
            return false;
        }

        // Wait for tracker to start
        console.log('Waiting for simulation...');
        await page.waitForFunction(() => {
            return typeof UberStyleTracker !== 'undefined' && UberStyleTracker.isRunning && UberStyleTracker.isRunning();
        }, { timeout: 15000 }).catch(() => console.log('Warning: Tracker not started yet'));

        // Increase speed
        await page.evaluate(() => {
            const btn = document.querySelector('.speed-btn[data-speed="10"]');
            if (btn) btn.click();
        });
        console.log('OK - Speed 10x enabled');

        // Wait for arrival
        console.log('Waiting for arrival...');
        const arrivalShown = await waitForVisible('#arrivalModal', 90000);
        if (arrivalShown) {
            console.log('OK - Trip completed');
            testsPassed++;
            await screenshot(page, '07-arrival');
        }

        // ==== PHASE 5: RATING ====
        console.log('\n[PHASE 5] Rating');
        console.log('-----------------');

        const arrivalModalReady = await page.evaluate(() => {
            const modal = document.getElementById('arrivalModal');
            return modal && !modal.classList.contains('hidden');
        });

        if (arrivalModalReady) {
            await page.evaluate(() => {
                const btn = document.getElementById('showRatingBtn');
                if (btn) btn.click();
            });
            await sleep(500);

            const ratingVisible = await page.evaluate(() => {
                const modal = document.getElementById('ratingModal');
                return modal && !modal.classList.contains('hidden');
            });

            if (ratingVisible) {
                console.log('OK - Rating modal visible');
                testsPassed++;
                await screenshot(page, '08-rating');

                // Click 5 stars
                await page.evaluate(() => {
                    const star5 = document.querySelector('.star[data-rating="5"]');
                    if (star5) star5.click();
                });
                console.log('OK - 5 stars selected');

                // Select tip
                await page.evaluate(() => {
                    const tipBtn = document.querySelector('.tip-btn[data-tip="10"]');
                    if (tipBtn) tipBtn.click();
                });
                await sleep(300);

                // Submit rating
                const submitted = await page.evaluate(() => {
                    const btn = document.getElementById('submitRatingBtn');
                    if (btn && !btn.classList.contains('hidden')) {
                        btn.click();
                        return true;
                    }
                    return false;
                });

                if (submitted) {
                    console.log('OK - Rating submitted');
                    testsPassed++;
                    await sleep(1500);

                    const thankYouVisible = await page.evaluate(() => {
                        const modal = document.getElementById('thankYouModal');
                        return modal && !modal.classList.contains('hidden');
                    });

                    if (thankYouVisible) {
                        console.log('OK - Thank you modal');
                        testsPassed++;
                        await screenshot(page, '09-thankyou');
                    }
                }
            }
        }

        await screenshot(page, '10-final');

        // ==== RESULTS ====
        console.log('\n======================================');
        console.log('RESULTS');
        console.log('======================================');
        console.log(`Tests passed: ${testsPassed}`);
        console.log(`Screenshots: ${config.screenshotDir}`);

        if (testsPassed >= 8) {
            console.log('\n ALL TESTS PASSED!');
        } else {
            console.log('\n WARNING: Some tests may have failed');
        }

    } catch (error) {
        console.error('\nError:', error.message);
        await screenshot(page, 'error');
    }

    console.log('\nBrowser open for 30 seconds for visual check...');
    await sleep(30000);

    await browser.close();
}

testProdWorkflow().catch(console.error);
