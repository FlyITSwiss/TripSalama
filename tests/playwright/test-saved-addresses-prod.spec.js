// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test PRODUCTION: Fonctionnalité d'ajout d'adresses sauvegardées
 */

const CONFIG = {
    baseUrl: 'https://stabilis-it.ch/internal/tripsalama',
    users: {
        passenger: {
            email: 'passenger@tripsalama.ch',
            password: 'TripSalama2025!'
        }
    },
    timeout: 30000
};

test.describe('PROD - Saved Addresses Feature', () => {

    test.beforeEach(async ({ page }) => {
        // Login as passenger
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[name="email"], input[type="email"], #email', CONFIG.users.passenger.email);
        await page.fill('input[name="password"], input[type="password"], #password', CONFIG.users.passenger.password);

        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard**', { timeout: CONFIG.timeout });
    });

    test('PROD-01: Dashboard affiche les boutons Domicile et Travail', async ({ page }) => {
        const homeBtn = page.locator('.saved-place[data-type="home"]');
        const workBtn = page.locator('.saved-place[data-type="work"]');

        await expect(homeBtn).toBeVisible();
        await expect(workBtn).toBeVisible();
    });

    test('PROD-02: Cliquer sur Ajouter Domicile ouvre le modal', async ({ page }) => {
        const homeBtn = page.locator('.saved-place[data-type="home"]');
        await homeBtn.click();

        const modal = page.locator('#addressModal');
        await expect(modal).toHaveClass(/active/);

        const title = page.locator('#addressModalTitle');
        await expect(title).toContainText(/domicile|home/i);

        await expect(page.locator('#addressSearchInput')).toBeVisible();
        await expect(page.locator('#addressMap')).toBeVisible();
    });

    test('PROD-03: Rechercher et sauvegarder une adresse', async ({ page }) => {
        // Ouvrir le modal pour Travail
        await page.locator('.saved-place[data-type="work"]').click();
        await expect(page.locator('#addressModal')).toHaveClass(/active/);

        // Rechercher une adresse
        await page.locator('#addressSearchInput').fill('Lausanne, Suisse');
        await page.waitForTimeout(500);

        // Attendre et cliquer sur la première suggestion
        const firstSuggestion = page.locator('.address-suggestion').first();
        await expect(firstSuggestion).toBeVisible({ timeout: 5000 });
        await firstSuggestion.click();

        // Sauvegarder
        const saveBtn = page.locator('#addressSaveBtn');
        await expect(saveBtn).not.toBeDisabled();
        await saveBtn.click();

        // Vérifier fermeture du modal
        await expect(page.locator('#addressModal')).not.toHaveClass(/active/, { timeout: 5000 });

        // Vérifier que l'adresse est affichée
        const workBtn = page.locator('.saved-place[data-type="work"]');
        const addressText = workBtn.locator('.saved-place-address');
        await expect(addressText).toContainText(/Lausanne/i);
    });

    test('PROD-04: Fermer le modal avec le bouton X', async ({ page }) => {
        await page.locator('.saved-place[data-type="home"]').click();
        await expect(page.locator('#addressModal')).toHaveClass(/active/);

        await page.locator('#addressModalClose').click();
        await expect(page.locator('#addressModal')).not.toHaveClass(/active/);
    });

});
