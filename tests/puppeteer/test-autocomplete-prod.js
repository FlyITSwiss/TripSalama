/**
 * TripSalama - Debug Autocomplete PRODUCTION
 */
const puppeteer = require('puppeteer');

async function debugAutocompleteProd() {
    const baseUrl = 'https://stabilis-it.ch/internal/tripsalama';
    console.log('\n=== Debug Autocomplete PRODUCTION ===\n');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    // Capture console logs
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('TripSalama') || text.includes('Error') || text.includes('error')) {
            console.log('BROWSER:', msg.type(), text);
        }
    });

    // Capture errors
    page.on('pageerror', error => {
        console.log('PAGE ERROR:', error.message);
    });

    // Capture network failures
    page.on('requestfailed', request => {
        console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
    });

    try {
        // Login first
        console.log('[1] Login...');
        await page.goto(baseUrl + '/login', { waitUntil: 'networkidle2' });
        await page.type('input[name="email"]', 'fatima@example.com', { delay: 30 });
        await page.type('input[name="password"]', 'Test1234!', { delay: 30 });
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);
        console.log('[1] Logged in');

        // Go to booking page
        console.log('[2] Go to booking page...');
        await page.goto(baseUrl + '/passenger/book', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 3000));

        // Check if elements exist
        const pickupInput = await page.$('#pickupInput');
        const dropoffInput = await page.$('#dropoffInput');
        const pickupDropdown = await page.$('#pickupDropdown');
        const dropoffDropdown = await page.$('#dropoffDropdown');

        console.log('[3] Elements found:');
        console.log('    pickupInput:', !!pickupInput);
        console.log('    dropoffInput:', !!dropoffInput);
        console.log('    pickupDropdown:', !!pickupDropdown);
        console.log('    dropoffDropdown:', !!dropoffDropdown);

        // Wait for geolocation to complete
        console.log('[4] Waiting for geolocation...');
        await new Promise(r => setTimeout(r, 3000));

        // Try typing in dropoff input
        console.log('[5] Testing dropoff autocomplete with "Casablanca"...');
        await dropoffInput.click();
        await dropoffInput.type('Casablanca', { delay: 80 });

        console.log('[6] Waiting for autocomplete results...');
        await new Promise(r => setTimeout(r, 3000));

        // Check dropdown visibility
        const dropdownHidden = await page.$eval('#dropoffDropdown', el => el.classList.contains('hidden'));
        console.log('[7] Dropdown hidden:', dropdownHidden);

        // Get dropdown content
        const dropdownContent = await page.$eval('#dropoffDropdown', el => el.innerHTML);
        console.log('[8] Dropdown content length:', dropdownContent.length);
        if (dropdownContent.length > 0) {
            console.log('[8] Dropdown content:', dropdownContent.substring(0, 300) + '...');
        }

        // Check CSP and network
        console.log('\n[9] Testing direct API call from page...');
        const apiResult = await page.evaluate(async () => {
            try {
                const url = 'https://nominatim.openstreetmap.org/search?format=json&q=Casablanca&limit=3&addressdetails=1';
                const response = await fetch(url, {
                    headers: { 'Accept-Language': 'fr' }
                });
                const data = await response.json();
                return { success: true, count: data.length, firstResult: data[0]?.display_name };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        console.log('[9] API Result:', apiResult);

        // Also test pickup
        console.log('\n[10] Testing pickup autocomplete...');
        await pickupInput.click();
        await pickupInput.click({ clickCount: 3 }); // Select all
        await pickupInput.type('Rabat', { delay: 80 });
        await new Promise(r => setTimeout(r, 3000));

        const pickupDropdownHidden = await page.$eval('#pickupDropdown', el => el.classList.contains('hidden'));
        const pickupDropdownContent = await page.$eval('#pickupDropdown', el => el.innerHTML);
        console.log('[10] Pickup dropdown hidden:', pickupDropdownHidden);
        console.log('[10] Pickup dropdown content length:', pickupDropdownContent.length);

        console.log('\n=== Keeping browser open for manual inspection ===');
        console.log('Press Ctrl+C to close');

        // Keep browser open
        await new Promise(r => setTimeout(r, 120000));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugAutocompleteProd().catch(console.error);
