/**
 * TripSalama - Test inscription + vérification identité
 * Test du flux complet d'inscription avec vérification caméra
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:8080';

async function testRegisterVerification() {
    console.log('\n🚀 TEST INSCRIPTION + VÉRIFICATION\n');
    console.log('━'.repeat(50));

    const browser = await chromium.launch({
        headless: false,
        slowMo: 200
    });

    const context = await browser.newContext({
        viewport: { width: 375, height: 812 },
        permissions: ['camera', 'geolocation'],
        geolocation: { latitude: 33.5731, longitude: -7.5898 }
    });

    const page = await context.newPage();

    // Capturer les logs console
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('i18n') || text.includes('verification') || text.includes('TripSalama')) {
            console.log(`  [Browser] ${text}`);
        }
    });

    try {
        // 1. Page d'inscription passagère
        console.log('→ Page inscription passagère...');
        await page.goto(`${BASE_URL}/register/passenger`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Vérifier que i18n est chargé
        const content1 = await page.content();
        console.log('  Page chargée');

        // 2. Remplir le formulaire avec un email unique
        const timestamp = Date.now();
        const testEmail = `test${timestamp}@demo.com`;

        console.log('→ Remplissage formulaire...');

        // Prénom
        const firstName = page.locator('#first_name, #firstName, input[name="first_name"]').first();
        if (await firstName.count() > 0) {
            await firstName.fill('Marie');
            console.log('  ✓ Prénom');
        }

        // Nom
        const lastName = page.locator('#last_name, #lastName, input[name="last_name"]').first();
        if (await lastName.count() > 0) {
            await lastName.fill('Dupont');
            console.log('  ✓ Nom');
        }

        // Email
        const email = page.locator('#email, input[name="email"]').first();
        if (await email.count() > 0) {
            await email.fill(testEmail);
            console.log(`  ✓ Email: ${testEmail}`);
        }

        // Téléphone
        const phone = page.locator('#phone, input[name="phone"]').first();
        if (await phone.count() > 0) {
            await phone.fill('+33612345678');
            console.log('  ✓ Téléphone');
        }

        // Mot de passe
        const password = page.locator('#password, input[name="password"]').first();
        if (await password.count() > 0) {
            await password.fill('Test123456!');
            console.log('  ✓ Mot de passe');
        }

        // Confirmation mot de passe
        const passwordConfirm = page.locator('#password_confirm, #passwordConfirm, input[name="password_confirm"]').first();
        if (await passwordConfirm.count() > 0) {
            await passwordConfirm.fill('Test123456!');
            console.log('  ✓ Confirmation');
        }

        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/playwright/screenshots/register-filled.png', fullPage: true });

        // 3. Soumettre le formulaire
        console.log('→ Soumission formulaire...');
        const submitBtn = page.locator('button[type="submit"]').first();
        if (await submitBtn.count() > 0) {
            await submitBtn.click();
            await page.waitForTimeout(3000);
        }

        // 4. Vérifier si on est redirigé vers la vérification d'identité
        const url = page.url();
        console.log(`  URL actuelle: ${url}`);

        await page.screenshot({ path: 'tests/playwright/screenshots/after-register-submit.png', fullPage: true });

        if (url.includes('identity-verification') || url.includes('verification')) {
            console.log('✅ Redirigé vers vérification d\'identité !');

            // Vérifier le contenu i18n
            await page.waitForTimeout(1500);
            const content2 = await page.content();

            // Chercher des clés brutes
            const rawKeys = ['verification.title', 'verification.subtitle', 'verification.consent_text'];
            let hasRawKeys = false;
            for (const key of rawKeys) {
                if (content2.includes(`>${key}<`)) {
                    console.log(`❌ Clé brute: ${key}`);
                    hasRawKeys = true;
                }
            }

            if (!hasRawKeys) {
                console.log('✅ i18n fonctionne - pas de clés brutes');
            }

            // Vérifier textes traduits
            if (content2.includes('Vérification d\'identité')) {
                console.log('✅ Titre traduit trouvé');
            }
            if (content2.includes('J\'accepte')) {
                console.log('✅ Consent traduit trouvé');
            }

            await page.screenshot({ path: 'tests/playwright/screenshots/verification-page.png', fullPage: true });

            // 5. Test de la caméra
            console.log('→ Test activation caméra...');

            // Cocher le consentement
            const consent = page.locator('#identity-consent-checkbox, input[type="checkbox"]').first();
            if (await consent.count() > 0) {
                await consent.check({ force: true });
                console.log('  ✓ Consentement accepté');
                await page.waitForTimeout(500);
            }

            // Cliquer sur Activer la caméra
            const cameraBtn = page.locator('button:has-text("caméra"), button:has-text("Activer"), .identity-btn-continue').first();
            if (await cameraBtn.count() > 0 && await cameraBtn.isEnabled()) {
                console.log('  → Clic sur bouton caméra...');
                await cameraBtn.click();
                await page.waitForTimeout(3000);

                // Vérifier si vidéo visible
                const video = page.locator('video');
                if (await video.isVisible().catch(() => false)) {
                    console.log('✅✅✅ CAMÉRA ACTIVE ! ✅✅✅');
                } else {
                    console.log('⚠️ Vidéo non visible');
                }

                await page.screenshot({ path: 'tests/playwright/screenshots/camera-active.png', fullPage: true });
            } else {
                console.log('⚠️ Bouton caméra non trouvé ou désactivé');
            }

        } else if (url.includes('error') || url.includes('login')) {
            console.log('⚠️ Erreur ou redirection vers login');
            console.log('  Vérifiez les logs serveur');
        } else {
            console.log(`⚠️ Page inattendue: ${url}`);
        }

        // 6. Pause pour inspection
        console.log('\n🔍 Navigateur ouvert 10 secondes pour démo...');
        await page.waitForTimeout(10000);

    } catch (error) {
        console.error(`\n❌ Erreur: ${error.message}`);
        await page.screenshot({ path: 'tests/playwright/screenshots/error.png', fullPage: true });
    }

    await browser.close();
    console.log('\n━'.repeat(50));
    console.log('✅ Test terminé');
}

testRegisterVerification().catch(console.error);
