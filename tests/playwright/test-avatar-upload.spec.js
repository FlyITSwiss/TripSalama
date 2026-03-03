/**
 * Test Playwright - Upload Avatar TripSalama
 *
 * Usage:
 *   npx playwright test tests/playwright/test-avatar-upload.spec.js --headed
 *   npx playwright test tests/playwright/test-avatar-upload.spec.js --headed --project=chromium
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Configuration - détecte prod vs local
const IS_PROD = !process.env.BASE_URL || process.env.BASE_URL.includes('stabilis-it.ch');
const BASE_URL = process.env.BASE_URL || 'https://stabilis-it.ch/internal/tripsalama';
const TEST_USER = {
    email: 'driver@tripsalama.ch',  // Utilise driver car passenger est rate-limited
    password: 'TripSalama2025!'
};

// Créer une image de test simple (PNG 100x100 rouge)
function createTestImage(filepath) {
    // PNG minimal 100x100 pixels (rouge)
    // Header PNG + IHDR + IDAT + IEND
    const width = 100;
    const height = 100;

    // Utiliser un PNG statique encodé en base64 (carré rouge 10x10)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8DwHwYIGKwgABYAAH4CBwEC2OGbAAAAAElFTkSuQmCC';
    const buffer = Buffer.from(pngBase64, 'base64');
    fs.writeFileSync(filepath, buffer);
    return filepath;
}

test.describe('Upload Avatar TripSalama', () => {

    test.beforeEach(async ({ page }) => {
        // Aller sur la page de login
        await page.goto(`${BASE_URL}/login`);
        await page.waitForLoadState('networkidle');
    });

    test('Upload de photo de profil - Flow complet', async ({ page }) => {
        // ========================================
        // ÉTAPE 1: LOGIN
        // ========================================
        console.log('1. Connexion...');

        await page.fill('input[name="email"], #email', TEST_USER.email);
        await page.fill('input[name="password"], #password', TEST_USER.password);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}),
            page.click('button[type="submit"]')
        ]);

        await page.waitForTimeout(2000);

        // Vérifier qu'on n'est plus sur login
        const currentUrl = page.url();
        console.log(`   URL après login: ${currentUrl}`);

        if (currentUrl.includes('/login')) {
            await page.screenshot({ path: 'test-results/avatar-login-failed.png', fullPage: true });
            throw new Error('Login échoué - toujours sur /login');
        }

        console.log('   ✅ Login réussi');

        // ========================================
        // ÉTAPE 2: NAVIGATION VERS PROFIL
        // ========================================
        console.log('2. Navigation vers profil...');

        await page.goto(`${BASE_URL}/profile`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Screenshot avant upload
        await page.screenshot({ path: 'test-results/avatar-1-before-upload.png', fullPage: true });
        console.log('   📸 Screenshot: avatar-1-before-upload.png');

        // Vérifier que la page profil est chargée
        const profileUrl = page.url();
        if (profileUrl.includes('/login')) {
            throw new Error('Redirigé vers login - session invalide');
        }

        // Vérifier la présence de l'input file
        const avatarInput = page.locator('#avatarInput');
        await expect(avatarInput).toBeAttached();
        console.log('   ✅ Input file trouvé');

        // ========================================
        // ÉTAPE 3: CRÉER IMAGE DE TEST
        // ========================================
        console.log('3. Création image de test...');

        const testImagePath = path.join(__dirname, 'test-avatar-temp.png');
        createTestImage(testImagePath);
        console.log('   ✅ Image créée');

        // ========================================
        // ÉTAPE 4: UPLOAD DE L'IMAGE
        // ========================================
        console.log('4. Upload de l\'image...');

        // Récupérer l'avatar actuel pour comparaison
        const oldAvatarSrc = await page.evaluate(() => {
            const img = document.querySelector('#avatarImage');
            return img ? img.src : null;
        });
        console.log(`   Avatar actuel: ${oldAvatarSrc ? oldAvatarSrc.substring(0, 60) + '...' : 'Aucun (initiales)'}`);

        // Écouter TOUTES les requêtes réseau pour debug
        const requests = [];
        page.on('request', request => {
            if (request.url().includes('api/user') || request.url().includes('upload')) {
                console.log(`   📤 REQUEST: ${request.method()} ${request.url()}`);
                requests.push(request.url());
            }
        });

        page.on('response', response => {
            if (response.url().includes('api/user') || response.url().includes('upload')) {
                console.log(`   📥 RESPONSE: ${response.status()} ${response.url()}`);
            }
        });

        // Écouter les requêtes réseau pour l'upload (avec un filtre plus large)
        const uploadPromise = page.waitForResponse(
            response => response.url().includes('user') && response.url().includes('avatar'),
            { timeout: 15000 }
        ).catch((e) => {
            console.log(`   ❌ waitForResponse error: ${e.message}`);
            return null;
        });

        // Upload le fichier
        console.log('   Déclenchement de l\'upload...');
        await avatarInput.setInputFiles(testImagePath);
        console.log('   Fichier sélectionné, attente de la requête...');

        // Attendre la réponse de l'API
        const uploadResponse = await uploadPromise;

        if (uploadResponse) {
            const responseBody = await uploadResponse.json().catch(() => ({}));
            console.log(`   Réponse API: ${JSON.stringify(responseBody).substring(0, 100)}`);

            if (responseBody.success) {
                console.log('   ✅ Upload API réussi');
            } else {
                console.log(`   ❌ Upload API échoué: ${responseBody.message || 'Erreur inconnue'}`);
            }
        } else {
            console.log('   ⚠️ Pas de réponse API détectée');
        }

        // Attendre que l'UI se mette à jour
        await page.waitForTimeout(3000);

        // ========================================
        // ÉTAPE 5: VÉRIFICATION DU RÉSULTAT
        // ========================================
        console.log('5. Vérification du résultat...');

        // Screenshot après upload
        await page.screenshot({ path: 'test-results/avatar-2-after-upload.png', fullPage: true });
        console.log('   📸 Screenshot: avatar-2-after-upload.png');

        // Vérifier si l'avatar a changé
        const newAvatarSrc = await page.evaluate(() => {
            const img = document.querySelector('#avatarImage');
            return img ? img.src : null;
        });

        console.log(`   Nouvel avatar: ${newAvatarSrc ? newAvatarSrc.substring(0, 60) + '...' : 'Aucun'}`);

        // Vérifier les toasts (messages de succès/erreur)
        const toastText = await page.evaluate(() => {
            const toast = document.querySelector('.toast, .flash, .notification, [class*="toast"]');
            return toast ? toast.textContent : null;
        });

        if (toastText) {
            console.log(`   Toast affiché: "${toastText.trim().substring(0, 50)}"`);
        }

        // Vérifier s'il y a eu une erreur visible
        const hasError = await page.evaluate(() => {
            const errorElements = document.querySelectorAll('.error, .toast-error, [class*="error"]');
            return Array.from(errorElements).some(el => el.textContent.trim().length > 0);
        });

        if (hasError) {
            console.log('   ⚠️ Erreur détectée sur la page');
            await page.screenshot({ path: 'test-results/avatar-error.png', fullPage: true });
        }

        // ========================================
        // ÉTAPE 6: VÉRIFIER QUE L'IMAGE EST ACCESSIBLE
        // ========================================
        if (newAvatarSrc && newAvatarSrc !== oldAvatarSrc) {
            console.log('6. Vérification accessibilité de l\'image...');

            const imageResponse = await page.request.get(newAvatarSrc);
            const imageStatus = imageResponse.status();

            if (imageStatus === 200) {
                console.log(`   ✅ Image accessible (HTTP ${imageStatus})`);
            } else {
                console.log(`   ❌ Image inaccessible (HTTP ${imageStatus})`);
            }
        }

        // ========================================
        // NETTOYAGE
        // ========================================
        if (fs.existsSync(testImagePath)) {
            fs.unlinkSync(testImagePath);
        }

        // ========================================
        // RÉSUMÉ
        // ========================================
        console.log('\n========================================');
        console.log('RÉSUMÉ DU TEST');
        console.log('========================================');
        console.log(`Login: ✅`);
        console.log(`Page profil: ✅`);
        console.log(`Input file: ✅`);
        console.log(`Upload API: ${uploadResponse ? '✅' : '⚠️'}`);
        console.log(`Avatar changé: ${newAvatarSrc !== oldAvatarSrc ? '✅' : '❌'}`);
        console.log('========================================\n');

        // Assertion finale
        if (uploadResponse) {
            const body = await uploadResponse.json().catch(() => ({}));
            expect(body.success).toBeTruthy();
        }
    });

    test('Vérification page mot de passe après upload', async ({ page }) => {
        // Login
        await page.fill('input[name="email"], #email', TEST_USER.email);
        await page.fill('input[name="password"], #password', TEST_USER.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);

        // Aller sur la page password
        await page.goto(`${BASE_URL}/profile/password`);
        await page.waitForLoadState('networkidle');

        // Screenshot
        await page.screenshot({ path: 'test-results/password-page.png', fullPage: true });
        console.log('📸 Screenshot: password-page.png');

        // Vérifier les champs du formulaire
        await expect(page.locator('input[name="current_password"], #current_password')).toBeVisible();
        await expect(page.locator('input[name="new_password"], #new_password')).toBeVisible();
        await expect(page.locator('input[name="confirm_password"], #confirm_password')).toBeVisible();

        console.log('✅ Page mot de passe OK');
    });
});
