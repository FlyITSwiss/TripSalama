/**
 * TripSalama - Smoke Tests
 * Quick health checks for the application
 */

const puppeteer = require('puppeteer');
const config = require('./config');
const {
    sleep,
    waitForElement,
    checkUrl,
    TestReporter
} = require('./helpers');

async function runSmokeTests() {
    const reporter = new TestReporter('Smoke Tests');
    let browser;
    let page;

    try {
        console.log('\n Starting TripSalama Smoke Tests\n');

        browser = await puppeteer.launch(config.puppeteer);
        page = await browser.newPage();

        // Test 1: Homepage accessible
        await reporter.test('Homepage accessible', async () => {
            const response = await page.goto(config.baseUrl, {
                waitUntil: 'networkidle0',
                timeout: config.timeouts.navigation
            });

            if (!response || response.status() !== 200) {
                throw new Error(`HTTP ${response?.status() || 'no response'}`);
            }
        });

        // Test 2: Login page accessible
        await reporter.test('Login page accessible', async () => {
            const response = await page.goto(`${config.baseUrl}/login`, {
                waitUntil: 'networkidle0'
            });

            if (response.status() !== 200) {
                throw new Error(`HTTP ${response.status()}`);
            }

            const hasForm = await waitForElement(page, config.selectors.loginForm);
            if (!hasForm) {
                throw new Error('Login form not found');
            }
        });

        // Test 3: Registration page accessible
        await reporter.test('Passenger registration page accessible', async () => {
            const response = await page.goto(`${config.baseUrl}/register/passenger`, {
                waitUntil: 'networkidle0'
            });

            if (response.status() !== 200) {
                throw new Error(`HTTP ${response.status()}`);
            }

            const hasForm = await waitForElement(page, config.selectors.registerForm);
            if (!hasForm) {
                throw new Error('Registration form not found');
            }
        });

        // Test 4: CSS loaded
        await reporter.test('Design System CSS loaded', async () => {
            await page.goto(`${config.baseUrl}/login`);

            const hasCSSVariables = await page.evaluate(() => {
                const style = getComputedStyle(document.documentElement);
                // Check for Uber Design System or TripSalama variables
                return style.getPropertyValue('--uber-black') !== '' ||
                       style.getPropertyValue('--primary') !== '' ||
                       style.getPropertyValue('--color-bg') !== '';
            });

            if (!hasCSSVariables) {
                throw new Error('CSS variables not loaded');
            }
        });

        // Test 5: JS loaded
        await reporter.test('JavaScript core loaded', async () => {
            await page.goto(`${config.baseUrl}/login`);

            const hasAppConfig = await page.evaluate(() => {
                return typeof window.AppConfig !== 'undefined';
            });

            if (!hasAppConfig) {
                throw new Error('AppConfig not available');
            }
        });

        // Test 6: API health
        await reporter.test('API responds', async () => {
            const response = await page.goto(`${config.baseUrl}/api/auth.php?action=me`, {
                waitUntil: 'networkidle0'
            });

            // Should return 401 (not authenticated) or 200
            if (response.status() !== 401 && response.status() !== 200) {
                throw new Error(`API status: ${response.status()}`);
            }
        });

        // Test 7: Static assets
        await reporter.test('CSS assets accessible', async () => {
            const response = await page.goto(`${config.baseUrl}/assets/css/tripsalama-core.css`);

            if (response.status() !== 200) {
                throw new Error(`CSS not accessible: ${response.status()}`);
            }
        });

        // Test 8: i18n loaded
        await reporter.test('Translations loaded', async () => {
            await page.goto(`${config.baseUrl}/login`);

            // Check that the page has translation content
            const pageContent = await page.content();

            if (!pageContent.includes('Connexion') && !pageContent.includes('Login')) {
                throw new Error('Translation texts not found');
            }
        });

        // Test 9: Responsive meta tag
        await reporter.test('Mobile viewport configured', async () => {
            await page.goto(`${config.baseUrl}/login`);

            const hasViewport = await page.evaluate(() => {
                const meta = document.querySelector('meta[name="viewport"]');
                return meta && meta.content.includes('width=device-width');
            });

            if (!hasViewport) {
                throw new Error('Meta viewport not configured');
            }
        });

        // Test 10: CSRF token present
        await reporter.test('CSRF token generated', async () => {
            await page.goto(`${config.baseUrl}/login`);

            const hasCsrf = await page.evaluate(() => {
                const meta = document.querySelector('meta[name="csrf-token"]');
                return meta && meta.content && meta.content.length > 0;
            });

            if (!hasCsrf) {
                throw new Error('CSRF token not found');
            }
        });

    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    const success = reporter.summary();
    process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
    runSmokeTests();
}

module.exports = { runSmokeTests };
