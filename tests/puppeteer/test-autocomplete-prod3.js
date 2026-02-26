/**
 * TripSalama - Debug Autocomplete PRODUCTION v3
 * Correct production credentials
 */
const puppeteer = require('puppeteer');

async function debugAutocompleteProd() {
    const baseUrl = 'https://stabilis-it.ch/internal/tripsalama';
    console.log('\n=== Debug Autocomplete PRODUCTION v3 ===\n');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    // Capture console logs
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('TripSalama') || text.includes('Error') || text.includes('error') || text.includes('Booking')) {
            console.log('BROWSER:', msg.type(), text);
        }
    });

    page.on('pageerror', error => {
        console.log('PAGE ERROR:', error.message);
    });

    try {
        // Login with PRODUCTION credentials
        console.log('[1] Login with passenger@tripsalama.ch...');
        await page.goto(baseUrl + '/login', { waitUntil: 'networkidle2' });
        await page.type('input[name="email"]', 'passenger@tripsalama.ch', { delay: 30 });
        await page.type('input[name="password"]', 'password', { delay: 30 });
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
        ]);
        console.log('[1] After login, URL:', page.url());

        // Go to booking page
        console.log('\n[2] Go to booking page...');
        await page.goto(baseUrl + '/passenger/book', { waitUntil: 'networkidle2' });
        console.log('[2] Current URL:', page.url());

        // Wait for page load
        await new Promise(r => setTimeout(r, 3000));

        // Get page title
        const title = await page.title();
        console.log('[3] Page title:', title);

        // Check if elements exist
        const pickupInput = await page.$('#pickupInput');
        const dropoffInput = await page.$('#dropoffInput');

        console.log('[4] Elements found:');
        console.log('    pickupInput:', !!pickupInput);
        console.log('    dropoffInput:', !!dropoffInput);

        if (!pickupInput || !dropoffInput) {
            console.log('[4] ERROR: Elements not found. Page content check:');
            const content = await page.content();
            console.log('    Contains booking-page:', content.includes('booking-page'));
            console.log('    Contains pickupInput:', content.includes('pickupInput'));
            await page.screenshot({ path: 'screenshots/booking-prod-error.png' });
            console.log('[4] Screenshot saved');
        } else {
            // Wait for geolocation
            console.log('[5] Waiting for geolocation...');
            await new Promise(r => setTimeout(r, 4000));

            // Test dropoff autocomplete
            console.log('[6] Testing dropoff autocomplete with "Casablanca"...');
            await dropoffInput.click();
            await dropoffInput.type('Casablanca', { delay: 50 });

            console.log('[7] Waiting for autocomplete results...');
            await new Promise(r => setTimeout(r, 3000));

            // Check dropdown
            const dropdownHidden = await page.$eval('#dropoffDropdown', el => el.classList.contains('hidden'));
            const dropdownContent = await page.$eval('#dropoffDropdown', el => el.innerHTML);

            console.log('[8] Dropdown hidden:', dropdownHidden);
            console.log('[8] Dropdown content length:', dropdownContent.length);

            if (dropdownContent.length > 0 && !dropdownHidden) {
                console.log('[8] SUCCESS! Autocomplete is working');
                console.log('[8] Content preview:', dropdownContent.substring(0, 200));
            } else {
                console.log('[8] FAIL: No autocomplete results');

                // Test direct API call
                console.log('\n[9] Testing direct Nominatim API...');
                const apiResult = await page.evaluate(async () => {
                    try {
                        const url = 'https://nominatim.openstreetmap.org/search?format=json&q=Casablanca&limit=3';
                        const response = await fetch(url, {
                            headers: { 'Accept-Language': 'fr' }
                        });
                        const data = await response.json();
                        return { success: true, count: data.length };
                    } catch (error) {
                        return { success: false, error: error.message };
                    }
                });
                console.log('[9] API Result:', apiResult);
            }

            // Test pickup autocomplete
            console.log('\n[10] Testing pickup autocomplete with "Rabat"...');
            await pickupInput.click({ clickCount: 3 });
            await pickupInput.type('Rabat', { delay: 50 });
            await new Promise(r => setTimeout(r, 3000));

            const pickupHidden = await page.$eval('#pickupDropdown', el => el.classList.contains('hidden'));
            const pickupContent = await page.$eval('#pickupDropdown', el => el.innerHTML);
            console.log('[10] Pickup dropdown hidden:', pickupHidden);
            console.log('[10] Pickup dropdown content length:', pickupContent.length);
        }

        console.log('\n=== Keeping browser open for manual testing ===');
        await new Promise(r => setTimeout(r, 60000));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugAutocompleteProd().catch(console.error);
