/**
 * TripSalama - Debug Autocomplete
 */
const puppeteer = require('puppeteer');

async function debugAutocomplete() {
    const baseUrl = 'http://127.0.0.1:8080';
    console.log('\n=== Debug Autocomplete ===\n');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    // Capture console logs
    page.on('console', msg => {
        console.log('BROWSER:', msg.type(), msg.text());
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
        await new Promise(r => setTimeout(r, 2000));

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
        console.log('[5] Testing dropoff autocomplete with "Casa"...');
        await dropoffInput.click();
        await dropoffInput.type('Casa', { delay: 100 });

        console.log('[6] Waiting for autocomplete results...');
        await new Promise(r => setTimeout(r, 2000));

        // Check dropdown visibility
        const dropdownHidden = await page.$eval('#dropoffDropdown', el => el.classList.contains('hidden'));
        console.log('[7] Dropdown hidden:', dropdownHidden);

        // Get dropdown content
        const dropdownContent = await page.$eval('#dropoffDropdown', el => el.innerHTML);
        console.log('[8] Dropdown content length:', dropdownContent.length);
        if (dropdownContent.length > 0) {
            console.log('[8] Dropdown content:', dropdownContent.substring(0, 200) + '...');
        }

        // Try with more characters
        console.log('[9] Trying with "Casablanca"...');
        await dropoffInput.click({ clickCount: 3 }); // Select all
        await dropoffInput.type('Casablanca', { delay: 50 });

        await new Promise(r => setTimeout(r, 3000));

        const dropdownHidden2 = await page.$eval('#dropoffDropdown', el => el.classList.contains('hidden'));
        console.log('[10] Dropdown hidden after Casablanca:', dropdownHidden2);

        const dropdownContent2 = await page.$eval('#dropoffDropdown', el => el.innerHTML);
        console.log('[11] Dropdown content:', dropdownContent2.substring(0, 300));

        // Check for any network requests to nominatim
        console.log('\n[12] Testing direct API call...');
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
        console.log('[12] API Result:', apiResult);

        console.log('\n=== Keeping browser open for manual inspection ===');
        console.log('Press Ctrl+C to close');

        // Keep browser open
        await new Promise(r => setTimeout(r, 60000));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugAutocomplete().catch(console.error);
