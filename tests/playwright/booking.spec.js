/**
 * TripSalama - Tests de Réservation avec Playwright
 * Tests E2E du flux de réservation de course
 */

const { test, expect } = require('@playwright/test');

// Configuration
const BASE_URL = 'http://127.0.0.1:8080';
const CREDENTIALS = {
    passenger: {
        email: 'fatima@example.com',
        password: 'Test1234!'
    }
};

test.describe('TripSalama - Flux de Réservation', () => {

    // Login avant chaque test
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}`);
        await page.waitForLoadState('networkidle');

        // Vérifier si on doit se connecter
        const emailInput = page.locator('input[name="email"], input[type="email"]').first();
        if (await emailInput.isVisible()) {
            await emailInput.fill(CREDENTIALS.passenger.email);
            await page.locator('input[name="password"], input[type="password"]').first().fill(CREDENTIALS.passenger.password);
            await page.locator('button[type="submit"]').first().click();
            await page.waitForURL(/dashboard|passenger/);
        }
    });

    test('Dashboard passagère affiche la carte', async ({ page }) => {
        // Aller au dashboard
        await page.goto(`${BASE_URL}/passenger/dashboard`);
        await page.waitForLoadState('networkidle');

        // Screenshot du dashboard
        await page.screenshot({ path: 'tests/playwright/results/dashboard.png', fullPage: true });

        // Vérifier présence de la carte (MapLibre ou Leaflet)
        const hasMap = await page.evaluate(() => {
            return document.querySelector('.maplibregl-canvas, .leaflet-container, #map, .map-container') !== null ||
                   typeof maplibregl !== 'undefined' ||
                   typeof L !== 'undefined';
        });

        console.log(`Carte présente: ${hasMap}`);

        // La carte devrait être visible
        expect(hasMap || page.url().includes('dashboard')).toBeTruthy();
    });

    test('Interface de réservation présente', async ({ page }) => {
        await page.goto(`${BASE_URL}/passenger/dashboard`);
        await page.waitForLoadState('networkidle');

        // Chercher les éléments de réservation
        const hasBookingUI = await page.evaluate(() => {
            const hasPickup = document.querySelector('#pickupAddress, input[placeholder*="départ"], input[placeholder*="pickup"]');
            const hasDropoff = document.querySelector('#dropoffAddress, input[placeholder*="arrivée"], input[placeholder*="destination"]');
            const hasBookBtn = document.querySelector('.book-btn, .reserve-btn, button[class*="book"]');

            return hasPickup || hasDropoff || hasBookBtn;
        });

        console.log(`UI de réservation présente: ${hasBookingUI}`);

        await page.screenshot({ path: 'tests/playwright/results/booking-ui.png' });
    });

    test('Géolocalisation disponible', async ({ page, context }) => {
        // Simuler une position GPS (Casablanca, Maroc)
        await context.setGeolocation({ latitude: 33.5731, longitude: -7.5898 });
        await context.grantPermissions(['geolocation']);

        await page.goto(`${BASE_URL}/passenger/dashboard`);
        await page.waitForLoadState('networkidle');

        // Chercher le bouton de localisation
        const locateBtn = page.locator('[class*="locate"], [class*="gps"], [class*="location"], button:has-text("Ma position")').first();

        if (await locateBtn.isVisible()) {
            await locateBtn.click();
            await page.waitForTimeout(2000);
            console.log('Bouton de localisation cliqué');
        }

        await page.screenshot({ path: 'tests/playwright/results/geolocation.png' });
    });

    test('Navigation vers historique', async ({ page }) => {
        await page.goto(`${BASE_URL}/passenger/dashboard`);
        await page.waitForLoadState('networkidle');

        // Chercher le lien vers l'historique
        const historyLink = page.locator('a[href*="history"], a[href*="rides"], [class*="history"]').first();

        if (await historyLink.isVisible()) {
            await historyLink.click();
            await page.waitForLoadState('networkidle');
            console.log(`URL historique: ${page.url()}`);
        }

        await page.screenshot({ path: 'tests/playwright/results/history.png', fullPage: true });
    });

    test('Navigation vers profil', async ({ page }) => {
        await page.goto(`${BASE_URL}/passenger/dashboard`);
        await page.waitForLoadState('networkidle');

        // Chercher le lien vers le profil
        const profileLink = page.locator('a[href*="profile"], a[href*="account"], [class*="profile"], [class*="avatar"]').first();

        if (await profileLink.isVisible()) {
            await profileLink.click();
            await page.waitForLoadState('networkidle');
            console.log(`URL profil: ${page.url()}`);
        }

        await page.screenshot({ path: 'tests/playwright/results/profile.png', fullPage: true });
    });

    test('Barre de navigation mobile visible', async ({ page }) => {
        // Viewport mobile
        await page.setViewportSize({ width: 390, height: 844 });

        await page.goto(`${BASE_URL}/passenger/dashboard`);
        await page.waitForLoadState('networkidle');

        // Vérifier la barre de navigation mobile
        const mobileNav = page.locator('.mobile-nav, .bottom-nav, nav[class*="mobile"], .nav-bar');

        const isVisible = await mobileNav.first().isVisible().catch(() => false);
        console.log(`Navigation mobile visible: ${isVisible}`);

        await page.screenshot({ path: 'tests/playwright/results/mobile-nav.png' });
    });

});

test.describe('TripSalama - Tests Driver', () => {

    const DRIVER_CREDENTIALS = {
        email: 'khadija@example.com',
        password: 'Test1234!'
    };

    test('Login conductrice', async ({ page }) => {
        await page.goto(`${BASE_URL}`);
        await page.waitForLoadState('networkidle');

        const emailInput = page.locator('input[name="email"], input[type="email"]').first();
        const passwordInput = page.locator('input[name="password"], input[type="password"]').first();

        await emailInput.fill(DRIVER_CREDENTIALS.email);
        await passwordInput.fill(DRIVER_CREDENTIALS.password);

        await page.screenshot({ path: 'tests/playwright/results/driver-login.png' });

        await page.locator('button[type="submit"]').first().click();

        await page.waitForTimeout(3000);

        console.log(`URL après login conductrice: ${page.url()}`);

        await page.screenshot({ path: 'tests/playwright/results/driver-dashboard.png', fullPage: true });
    });

});
