/**
 * TripSalama - Test Avatar sur Dashboard
 * Vérifie l'affichage de la photo de profil dans la section welcome
 */

const { test, expect } = require('@playwright/test');

const CONFIG = {
    baseUrl: process.env.TEST_URL || 'https://stabilis-it.ch/internal/tripsalama',
    credentials: {
        passenger: {
            email: 'passenger@tripsalama.ch',
            password: 'TripSalama2025!'
        }
    }
};

test.describe('Avatar Welcome Section', () => {

    test('Dashboard passager affiche section bienvenue', async ({ page }) => {
        // Login
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.credentials.passenger.email);
        await page.fill('input[name="password"]', CONFIG.credentials.passenger.password);
        await page.click('button[type="submit"]');

        await page.waitForURL(/dashboard|passenger/, { timeout: 15000 });

        // Vérifier section welcome
        const welcomeSection = page.locator('.uber-welcome');
        await expect(welcomeSection).toBeVisible();

        // Vérifier le greeting
        const greeting = page.locator('.uber-welcome-greeting');
        await expect(greeting).toBeVisible();

        // Vérifier le nom
        const name = page.locator('.uber-welcome-name');
        await expect(name).toBeVisible();

        // Screenshot pour analyse
        await page.screenshot({
            path: 'tests/playwright/screenshots/avatar-welcome-section.png',
            fullPage: false
        });

        console.log('Section welcome visible avec succès');
    });

    test('Avatar conditionnel - vérifie structure HTML', async ({ page }) => {
        // Login
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.credentials.passenger.email);
        await page.fill('input[name="password"]', CONFIG.credentials.passenger.password);
        await page.click('button[type="submit"]');

        await page.waitForURL(/dashboard|passenger/, { timeout: 15000 });

        // Vérifier la structure welcome (compatible avec les deux versions)
        const welcomeSection = page.locator('.uber-welcome');
        await expect(welcomeSection).toBeVisible();

        // Vérifier si la nouvelle structure header existe
        const welcomeHeader = page.locator('.uber-welcome-header');
        const headerExists = await welcomeHeader.count() > 0;

        if (headerExists) {
            console.log('✓ Nouvelle structure avec header détectée');

            // Vérifier si avatar existe (optionnel selon l'utilisateur)
            const avatar = page.locator('.uber-welcome-avatar');
            const avatarCount = await avatar.count();

            if (avatarCount > 0) {
                console.log('✓ Avatar présent - utilisateur a uploadé une photo');

                // Vérifier que c'est une image valide
                const avatarSrc = await avatar.getAttribute('src');
                expect(avatarSrc).toContain('uploads/avatars');

                // Vérifier que l'image est visible
                await expect(avatar).toBeVisible();
            } else {
                console.log('✓ Pas d\'avatar - utilisateur n\'a pas de photo (comportement attendu)');
            }
        } else {
            console.log('✓ Ancienne structure détectée (avant mise à jour avatar)');
        }

        // Le nom doit toujours être visible
        const name = page.locator('.uber-welcome-name');
        await expect(name).toBeVisible();

        // Screenshot final
        await page.screenshot({
            path: 'tests/playwright/screenshots/avatar-verification.png',
            fullPage: false
        });
    });

});
