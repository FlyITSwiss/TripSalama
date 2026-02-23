/**
 * TripSalama - Debug Driver API
 * Captures exact API error for driver availability toggle
 */
const puppeteer = require('puppeteer');

const BASE_URL = 'https://stabilis-it.ch/internal/tripsalama';
const DRIVER_EMAIL = 'driver@tripsalama.ch';
const PASSWORD = 'password';

async function run() {
    console.log('\n=== DEBUG DRIVER API ===\n');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        defaultViewport: { width: 414, height: 896 },
        args: ['--no-sandbox', '--ignore-certificate-errors']
    });

    const page = await browser.newPage();

    // Capture all network requests
    const apiResponses = [];
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/')) {
            try {
                const body = await response.text();
                apiResponses.push({
                    url,
                    status: response.status(),
                    body: body.substring(0, 500)
                });
                console.log(`\n[API] ${response.status()} ${url}`);
                console.log(`Response: ${body.substring(0, 300)}`);
            } catch (e) {
                // Ignore
            }
        }
    });

    try {
        // Login
        console.log('1. Logging in as driver...');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await page.type('input[name="email"], #email', DRIVER_EMAIL);
        await page.type('input[name="password"], #password', PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

        if (page.url().includes('/login')) {
            console.log('ERROR: Login failed!');
            await browser.close();
            return;
        }
        console.log('   Login successful');

        // Go to driver dashboard
        console.log('\n2. Going to driver dashboard...');
        await page.goto(`${BASE_URL}/driver/dashboard`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1000));

        // Get current state
        const isOnline = await page.evaluate(() => {
            const toggle = document.getElementById('availabilityToggle');
            return toggle ? toggle.checked : null;
        });
        console.log(`   Current status: ${isOnline ? 'Online' : 'Offline'}`);

        // Get CSRF token
        const csrfToken = await page.evaluate(() => {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta ? meta.getAttribute('content') : null;
        });
        console.log(`   CSRF Token: ${csrfToken ? csrfToken.substring(0, 20) + '...' : 'NOT FOUND'}`);

        // Get AppConfig
        const appConfig = await page.evaluate(() => {
            return window.AppConfig ? {
                basePath: window.AppConfig.basePath,
                apiPath: window.AppConfig.apiPath,
                csrfToken: window.AppConfig.csrfToken ? window.AppConfig.csrfToken.substring(0, 20) + '...' : null
            } : null;
        });
        console.log('   AppConfig:', JSON.stringify(appConfig, null, 2));

        // Try to toggle via API directly
        console.log('\n3. Calling driver availability API...');

        const result = await page.evaluate(async () => {
            try {
                const response = await ApiService.post('drivers?action=availability', {
                    is_available: true
                });
                return { success: true, response };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    status: error.status,
                    data: error.data
                };
            }
        });

        console.log('\n   API Result:', JSON.stringify(result, null, 2));

        // Wait to see the toast
        await new Promise(r => setTimeout(r, 3000));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        console.log('\n\n=== API RESPONSES CAPTURED ===');
        apiResponses.forEach(r => {
            console.log(`\n${r.status} ${r.url}`);
            console.log(r.body);
        });

        await browser.close();
    }
}

run().catch(console.error);
