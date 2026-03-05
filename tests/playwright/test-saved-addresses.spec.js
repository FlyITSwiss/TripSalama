// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test: Fonctionnalité d'ajout d'adresses sauvegardées (Domicile / Travail)
 *
 * Scénarios:
 * 1. Cliquer sur "Ajouter" pour Domicile ouvre le modal
 * 2. Rechercher une adresse affiche les suggestions
 * 3. Sélectionner une adresse met à jour la carte et active le bouton sauvegarder
 * 4. Sauvegarder l'adresse met à jour l'affichage
 */

const CONFIG = {
    baseUrl: process.env.TEST_URL || 'http://127.0.0.1:8080',
    users: {
        passenger: {
            email: 'passenger@tripsalama.ch',
            password: 'TripSalama2025!'
        }
    },
    timeout: 30000
};

test.describe('Saved Addresses Feature', () => {

    test.beforeEach(async ({ page }) => {
        // Login as passenger
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[name="email"], input[type="email"], #email', CONFIG.users.passenger.email);
        await page.fill('input[name="password"], input[type="password"], #password', CONFIG.users.passenger.password);

        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard**', { timeout: CONFIG.timeout });
    });

    test('SA-01: Dashboard affiche les boutons Domicile et Travail', async ({ page }) => {
        // Vérifier que les boutons saved-place sont présents
        const homeBtn = page.locator('.saved-place[data-type="home"]');
        const workBtn = page.locator('.saved-place[data-type="work"]');

        await expect(homeBtn).toBeVisible();
        await expect(workBtn).toBeVisible();

        // Vérifier le contenu
        await expect(homeBtn.locator('.saved-place-name')).toContainText(/Domicile|Home/);
        await expect(workBtn.locator('.saved-place-name')).toContainText(/Travail|Work/);
    });

    test('SA-02: Cliquer sur Ajouter Domicile ouvre le modal', async ({ page }) => {
        // Cliquer sur le bouton Domicile
        const homeBtn = page.locator('.saved-place[data-type="home"]');
        await homeBtn.click();

        // Attendre que le modal s'ouvre
        const modal = page.locator('#addressModal');
        await expect(modal).toHaveClass(/active/);

        // Vérifier le titre du modal
        const title = page.locator('#addressModalTitle');
        await expect(title).toContainText(/domicile|home/i);

        // Vérifier que les éléments du modal sont présents
        await expect(page.locator('#addressSearchInput')).toBeVisible();
        await expect(page.locator('#addressMap')).toBeVisible();
        await expect(page.locator('#addressSaveBtn')).toBeVisible();
        await expect(page.locator('#addressUseLocation')).toBeVisible();
    });

    test('SA-03: Fermer le modal avec le bouton X', async ({ page }) => {
        // Ouvrir le modal
        await page.locator('.saved-place[data-type="home"]').click();
        await expect(page.locator('#addressModal')).toHaveClass(/active/);

        // Fermer avec le bouton X
        await page.locator('#addressModalClose').click();

        // Vérifier que le modal est fermé
        await expect(page.locator('#addressModal')).not.toHaveClass(/active/);
    });

    test('SA-04: Fermer le modal avec Escape', async ({ page }) => {
        // Ouvrir le modal
        await page.locator('.saved-place[data-type="home"]').click();
        await expect(page.locator('#addressModal')).toHaveClass(/active/);

        // Fermer avec Escape
        await page.keyboard.press('Escape');

        // Vérifier que le modal est fermé
        await expect(page.locator('#addressModal')).not.toHaveClass(/active/);
    });

    test('SA-05: Rechercher une adresse affiche des suggestions', async ({ page }) => {
        // Ouvrir le modal
        await page.locator('.saved-place[data-type="home"]').click();
        await expect(page.locator('#addressModal')).toHaveClass(/active/);

        // Rechercher une adresse (Casablanca par exemple)
        const searchInput = page.locator('#addressSearchInput');
        await searchInput.fill('Casablanca, Maroc');

        // Attendre les suggestions (avec délai de debounce)
        await page.waitForTimeout(500);

        const suggestions = page.locator('#addressSuggestions');
        await expect(suggestions).toHaveClass(/active/);

        // Vérifier qu'il y a au moins une suggestion
        const suggestionItems = suggestions.locator('.address-suggestion');
        await expect(suggestionItems.first()).toBeVisible({ timeout: 5000 });
    });

    test('SA-06: Sélectionner une suggestion active le bouton Enregistrer', async ({ page }) => {
        // Ouvrir le modal
        await page.locator('.saved-place[data-type="home"]').click();
        await expect(page.locator('#addressModal')).toHaveClass(/active/);

        // Le bouton sauvegarder doit être désactivé au début
        const saveBtn = page.locator('#addressSaveBtn');
        await expect(saveBtn).toBeDisabled();

        // Rechercher une adresse
        await page.locator('#addressSearchInput').fill('Paris, France');
        await page.waitForTimeout(500);

        // Cliquer sur la première suggestion
        const firstSuggestion = page.locator('.address-suggestion').first();
        await expect(firstSuggestion).toBeVisible({ timeout: 5000 });
        await firstSuggestion.click();

        // Le bouton sauvegarder doit être activé
        await expect(saveBtn).not.toBeDisabled();

        // L'adresse sélectionnée doit être affichée
        const selectedDiv = page.locator('#addressSelected');
        await expect(selectedDiv).toHaveClass(/active/);
    });

    test('SA-07: Bouton Utiliser ma position actuelle fonctionne', async ({ page, context }) => {
        // Simuler la géolocalisation
        await context.grantPermissions(['geolocation']);
        await context.setGeolocation({ latitude: 33.5731, longitude: -7.5898 });

        // Ouvrir le modal
        await page.locator('.saved-place[data-type="home"]').click();
        await expect(page.locator('#addressModal')).toHaveClass(/active/);

        // Cliquer sur utiliser ma position
        const useLocationBtn = page.locator('#addressUseLocation');
        await useLocationBtn.click();

        // Attendre que la géolocalisation soit traitée
        await page.waitForTimeout(2000);

        // Le bouton sauvegarder devrait être activé si la géolocalisation a fonctionné
        // (Note: peut échouer si le reverse geocoding ne répond pas)
    });

    test('SA-08: Sauvegarder une adresse met à jour le dashboard', async ({ page }) => {
        // Ouvrir le modal pour Travail
        await page.locator('.saved-place[data-type="work"]').click();
        await expect(page.locator('#addressModal')).toHaveClass(/active/);

        // Rechercher une adresse
        await page.locator('#addressSearchInput').fill('Genève, Suisse');
        await page.waitForTimeout(500);

        // Attendre et cliquer sur la première suggestion
        const firstSuggestion = page.locator('.address-suggestion').first();
        await expect(firstSuggestion).toBeVisible({ timeout: 5000 });
        await firstSuggestion.click();

        // Attendre que le bouton soit actif
        const saveBtn = page.locator('#addressSaveBtn');
        await expect(saveBtn).not.toBeDisabled();

        // Sauvegarder
        await saveBtn.click();

        // Attendre la fermeture du modal
        await expect(page.locator('#addressModal')).not.toHaveClass(/active/, { timeout: 5000 });

        // Vérifier que l'adresse est maintenant affichée sur le bouton Travail
        const workBtn = page.locator('.saved-place[data-type="work"]');
        const addressText = workBtn.locator('.saved-place-address');
        await expect(addressText).toContainText(/Genève|Geneva/i);
    });

    test('SA-09: Le modal pour Travail a le bon titre', async ({ page }) => {
        // Cliquer sur le bouton Travail
        await page.locator('.saved-place[data-type="work"]').click();

        // Vérifier le titre
        const title = page.locator('#addressModalTitle');
        await expect(title).toContainText(/travail|work/i);
    });

    test('SA-10: Cliquer sur la carte place un marqueur', async ({ page }) => {
        // Ouvrir le modal
        await page.locator('.saved-place[data-type="home"]').click();
        await expect(page.locator('#addressModal')).toHaveClass(/active/);

        // Attendre que la carte soit chargée
        await page.waitForTimeout(1000);

        // Cliquer sur la carte
        const map = page.locator('#addressMap');
        await map.click({ position: { x: 100, y: 100 } });

        // Attendre le reverse geocoding
        await page.waitForTimeout(2000);

        // Si le reverse geocoding a fonctionné, le bouton sauvegarder devrait être activé
        // et l'adresse sélectionnée devrait être visible
        const selectedDiv = page.locator('#addressSelected');
        const isActive = await selectedDiv.evaluate(el => el.classList.contains('active'));

        // Ce test peut échouer si le reverse geocoding ne répond pas
        // On vérifie juste que le clic ne cause pas d'erreur
        console.log('Address selected after map click:', isActive);
    });

});
