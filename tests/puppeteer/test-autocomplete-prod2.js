/**
 * TripSalama - Debug Autocomplete PRODUCTION v2
 */
const puppeteer = require('puppeteer');

async function debugAutocompleteProd() {
    const baseUrl = 'https://stabilis-it.ch/internal/tripsalama';
    console.log('\n=== Debug Autocomplete PRODUCTION v2 ===\n');

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
        if (text.includes('TripSalama') || text.includes('Error') || text.includes('error') || text.includes('Booking')) {
            console.log('BROWSER:', msg.type(), text);
        }
    });

    // Capture errors
    page.on('pageerror', error => {
        console.log('PAGE ERROR:', error.message);
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
        console.log('[1] Logged in, URL:', page.url());

        // Go to booking page
        console.log('[2] Go to booking page...');
        const response = await page.goto(baseUrl + '/passenger/book', { waitUntil: 'networkidle2' });
        console.log('[2] Response status:', response.status());
        console.log('[2] Current URL:', page.url());
        await new Promise(r => setTimeout(r, 2000));

        // Get page title
        const title = await page.title();
        console.log('[3] Page title:', title);

        // Get page content
        const pageContent = await page.content();
        console.log('[3] Page contains bookingForm:', pageContent.includes('bookingForm'));
        console.log('[3] Page contains pickupInput:', pageContent.includes('pickupInput'));
        console.log('[3] Page contains dropoffInput:', pageContent.includes('dropoffInput'));
        console.log('[3] Page contains booking-page:', pageContent.includes('booking-page'));
        console.log('[3] Page contains booking.js:', pageContent.includes('booking.js'));

        // Check if elements exist
        const pickupInput = await page.$('#pickupInput');
        const dropoffInput = await page.$('#dropoffInput');
        const bookingForm = await page.$('#bookingForm');
        const map = await page.$('#map');

        console.log('[4] Elements found:');
        console.log('    bookingForm:', !!bookingForm);
        console.log('    map:', !!map);
        console.log('    pickupInput:', !!pickupInput);
        console.log('    dropoffInput:', !!dropoffInput);

        if (!pickupInput) {
            // Take screenshot
            await page.screenshot({ path: 'screenshots/booking-page-error.png' });
            console.log('[5] Screenshot saved to screenshots/booking-page-error.png');

            // Print first 2000 chars of HTML
            console.log('\n[6] Page HTML (first 2000 chars):');
            console.log(pageContent.substring(0, 2000));
        } else {
            // Test autocomplete
            console.log('\n[5] Testing autocomplete...');
            await dropoffInput.click();
            await dropoffInput.type('Casablanca', { delay: 80 });
            await new Promise(r => setTimeout(r, 3000));

            const dropdownHidden = await page.$eval('#dropoffDropdown', el => el.classList.contains('hidden'));
            console.log('[5] Dropdown hidden:', dropdownHidden);
        }

        console.log('\n=== Keeping browser open ===');
        await new Promise(r => setTimeout(r, 60000));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugAutocompleteProd().catch(console.error);
