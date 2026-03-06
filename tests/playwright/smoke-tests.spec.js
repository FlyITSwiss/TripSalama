/**
 * TripSalama - Smoke Tests
 * Tests rapides pour valider l'application avant deploiement
 *
 * Usage LOCAL:
 *   npx playwright test tests/playwright/smoke-tests.spec.js --headed
 *
 * Usage PROD:
 *   TEST_URL=https://stabilis-it.ch/internal/tripsalama npx playwright test smoke-tests.spec.js
 *
 * @version 1.0.0
 */

const { test, expect } = require('@playwright/test');

// Configuration
const CONFIG = {
    baseUrl: process.env.TEST_URL || 'http://127.0.0.1:8080',
    credentials: {
        passenger: {
            email: 'passenger@tripsalama.ch',
            password: 'TripSalama2025!'
        },
        driver: {
            email: 'driver@tripsalama.ch',
            password: 'TripSalama2025!'
        },
        admin: {
            email: 'admin@tripsalama.ch',
            password: 'TripSalama2025!'
        }
    },
    timeouts: {
        page: 15000,
        action: 5000
    }
};

// ============================================
// SMOKE TESTS - CRITIQUES
// Ces tests doivent TOUS passer avant deploiement
// ============================================

test.describe('SMOKE TESTS - TripSalama', () => {

    test('SMOKE-01: Page Login accessible', async ({ page }) => {
        const response = await page.goto(`${CONFIG.baseUrl}/login`);

        expect(response?.status()).toBe(200);

        // Verifier elements critiques
        const form = page.locator('form');
        await expect(form).toBeVisible();

        const emailInput = page.locator('input[name="email"], input[type="email"]');
        await expect(emailInput).toBeVisible();

        const passwordInput = page.locator('input[name="password"], input[type="password"]');
        await expect(passwordInput).toBeVisible();

        const submitBtn = page.locator('button[type="submit"]');
        await expect(submitBtn).toBeVisible();
    });

    test('SMOKE-02: CSS charge correctement', async ({ page }) => {
        const responses = [];

        page.on('response', response => {
            if (response.url().includes('.css') && response.status() !== 304) {
                responses.push({
                    url: response.url(),
                    status: response.status()
                });
            }
        });

        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('networkidle');

        // Au moins un CSS charge
        expect(responses.length).toBeGreaterThan(0);

        // Tous les CSS ont status 200
        const failedCss = responses.filter(r => r.status !== 200);
        expect(failedCss.length).toBe(0);
    });

    test('SMOKE-03: JS charge sans erreur', async ({ page }) => {
        const jsErrors = [];

        page.on('pageerror', error => {
            jsErrors.push(error.message);
        });

        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('networkidle');

        // Pas d'erreur JS critique
        const criticalErrors = jsErrors.filter(e =>
            !e.includes('ResizeObserver') &&
            !e.includes('Network request failed')
        );

        expect(criticalErrors.length).toBe(0);
    });

    test('SMOKE-04: Login Passagere fonctionne', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        await page.fill('input[name="email"]', CONFIG.credentials.passenger.email);
        await page.fill('input[name="password"]', CONFIG.credentials.passenger.password);
        await page.click('button[type="submit"]');

        // Doit rediriger vers dashboard
        await page.waitForURL(/dashboard|passenger/, { timeout: CONFIG.timeouts.page });
        expect(page.url()).toMatch(/passenger|dashboard/);
    });

    test('SMOKE-05: Login Conductrice fonctionne', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        await page.fill('input[name="email"]', CONFIG.credentials.driver.email);
        await page.fill('input[name="password"]', CONFIG.credentials.driver.password);
        await page.click('button[type="submit"]');

        await page.waitForURL(/dashboard|driver/, { timeout: CONFIG.timeouts.page });
        expect(page.url()).toMatch(/driver|dashboard/);
    });

    test('SMOKE-06: API Health Check', async ({ request }) => {
        const response = await request.get(`${CONFIG.baseUrl}/api/health.php`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        // Accept both "ok" and "healthy" as valid status
        expect(['ok', 'healthy']).toContain(data.status);
    });

    test('SMOKE-07: CSRF Token present', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        const csrfMeta = page.locator('meta[name="csrf-token"]');
        const count = await csrfMeta.count();

        expect(count).toBeGreaterThan(0);
    });

    test('SMOKE-08: Page Booking accessible', async ({ page }) => {
        // Login first
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.credentials.passenger.email);
        await page.fill('input[name="password"]', CONFIG.credentials.passenger.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|passenger/, { timeout: CONFIG.timeouts.page });

        // Go to booking
        await page.goto(`${CONFIG.baseUrl}/passenger/book`);
        await page.waitForLoadState('networkidle');

        // Carte Leaflet presente
        const map = page.locator('.leaflet-container');
        await expect(map).toBeVisible();
    });

    test('SMOKE-09: Responsive - Pas de scroll horizontal', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('networkidle');

        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > window.innerWidth;
        });

        expect(hasHorizontalScroll).toBe(false);
    });

    test('SMOKE-10: Performance - Page charge en < 5s', async ({ page }) => {
        const start = Date.now();
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('domcontentloaded');
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(5000);
        console.log(`  Temps de chargement: ${duration}ms`);
    });
});

// ============================================
// SUMMARY
// ============================================
test.afterAll(async () => {
    console.log('\n========================================');
    console.log('  SMOKE TESTS COMPLETE');
    console.log('========================================');
    console.log('Tests executes: 10');
    console.log('');
    console.log('Si tous les tests passent:');
    console.log('  -> Application prete pour deploiement');
    console.log('========================================\n');
});
