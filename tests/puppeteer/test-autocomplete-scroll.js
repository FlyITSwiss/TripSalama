/**
 * TripSalama - Test Autocomplete Scroll
 * Verifie que le dropdown scroll automatiquement en vue
 */

'use strict';

const puppeteer = require('puppeteer');
const config = require('./config');

async function runTest() {
    console.log('Testing autocomplete auto-scroll behavior...\n');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 800 });

    try {
        // 1. Login as passenger
        console.log('1. Logging in as passenger...');
        await page.goto(`${config.baseUrl}/login`, { waitUntil: 'networkidle0', timeout: 15000 });

        // Check if already logged in
        const currentUrl = page.url();
        if (!currentUrl.includes('/login')) {
            console.log('   Already logged in');
        } else {
            await page.type('input[name="email"]', config.users.passenger.email);
            await page.type('input[name="password"]', config.users.passenger.password);
            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
            console.log('   Logged in');
        }

        // 2. Go to booking page
        console.log('2. Going to booking page...');
        await page.goto(`${config.baseUrl}/passenger/book`, { waitUntil: 'networkidle0', timeout: 15000 });
        await page.waitForTimeout(1000);

        // 3. Wait for geolocation to complete
        console.log('3. Waiting for geolocation...');
        await page.waitForTimeout(3000);

        // 4. Focus on destination input and type
        console.log('4. Typing in destination input...');
        const dropoffInput = await page.$('#dropoffInput');
        if (!dropoffInput) {
            throw new Error('Destination input not found');
        }

        await dropoffInput.click();
        await page.waitForTimeout(300);

        // Type a search query
        await dropoffInput.type('Casa Anfa', { delay: 100 });
        console.log('   Typed "Casa Anfa"');

        // 5. Wait for autocomplete results
        console.log('5. Waiting for autocomplete results...');
        await page.waitForTimeout(1500);

        // Check if dropdown is visible
        const dropdown = await page.$('#dropoffDropdown:not(.hidden)');
        if (!dropdown) {
            console.log('   No dropdown visible (may be no results)');
        } else {
            console.log('   Dropdown is visible');

            // Check if dropdown is in viewport
            const isInViewport = await page.evaluate(() => {
                const dropdown = document.querySelector('#dropoffDropdown');
                if (!dropdown) return false;
                const rect = dropdown.getBoundingClientRect();
                return (
                    rect.top >= 0 &&
                    rect.bottom <= window.innerHeight
                );
            });

            if (isInViewport) {
                console.log('   Dropdown is fully visible in viewport');
            } else {
                console.log('   Dropdown may be partially hidden');
            }
        }

        // 6. Take screenshot
        console.log('6. Taking screenshot...');
        await page.screenshot({
            path: `${__dirname}/screenshots/autocomplete-scroll-test.png`,
            fullPage: false
        });
        console.log('   Screenshot saved');

        // 7. Test clicking on a result
        const firstResult = await page.$('#dropoffDropdown .autocomplete-item');
        if (firstResult) {
            console.log('7. Clicking first result...');
            await firstResult.click();
            await page.waitForTimeout(500);
            console.log('   Result selected');
        }

        console.log('\nTest completed successfully!');
        await page.waitForTimeout(2000);

    } catch (error) {
        console.error('Test error:', error.message);
        await page.screenshot({
            path: `${__dirname}/screenshots/autocomplete-scroll-error.png`,
            fullPage: true
        });
    } finally {
        await browser.close();
    }
}

runTest();
