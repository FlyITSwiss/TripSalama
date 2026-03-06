/**
 * TripSalama - Test rapide i18n verification
 * Vérifie que les clés i18n se chargent correctement
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:8080';

async function testI18nVerification() {
    console.log('\n🔍 TEST i18n VERIFICATION\n');
    console.log('━'.repeat(50));

    const browser = await chromium.launch({
        headless: false,
        slowMo: 300
    });

    const context = await browser.newContext({
        viewport: { width: 375, height: 812 },
        permissions: ['camera']
    });

    const page = await context.newPage();

    // Capturer les logs console
    page.on('console', msg => {
        if (msg.text().includes('i18n') || msg.text().includes('verification')) {
            console.log(`  [Browser] ${msg.text()}`);
        }
    });

    try {
        // 1. Login
        console.log('→ Login...');
        await page.goto(`${BASE_URL}/login`);
        await page.waitForLoadState('networkidle');

        await page.fill('#email', 'passenger@tripsalama.ch');
        await page.fill('#password', 'TripSalama2025!');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
        console.log('✅ Connecté');

        // 2. Aller à identity-verification
        console.log('→ Page vérification...');
        await page.goto(`${BASE_URL}/identity-verification`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // 3. Vérifier que les textes sont traduits (pas de clés brutes)
        const content = await page.content();

        const rawKeys = [
            'verification.title',
            'verification.subtitle',
            'verification.tips_title',
            'verification.consent_text',
            'verification.start_camera',
            'verification.result_error'
        ];

        let hasRawKeys = false;
        for (const key of rawKeys) {
            if (content.includes(`>${key}<`) || content.includes(`"${key}"`)) {
                console.log(`❌ Clé brute trouvée: ${key}`);
                hasRawKeys = true;
            }
        }

        if (!hasRawKeys) {
            console.log('✅ Aucune clé brute détectée - i18n fonctionne !');
        }

        // 4. Vérifier des textes traduits spécifiques
        const expectedTexts = [
            'Vérification d\'identité',
            'TripSalama est réservé aux femmes',
            'Conseils pour une bonne photo',
            'J\'accepte que ma photo'
        ];

        for (const text of expectedTexts) {
            if (content.includes(text)) {
                console.log(`✅ Texte trouvé: "${text.substring(0, 30)}..."`);
            } else {
                console.log(`⚠️ Texte non trouvé: "${text}"`);
            }
        }

        // 5. Screenshot
        await page.screenshot({
            path: 'tests/playwright/screenshots/i18n-verification-test.png',
            fullPage: true
        });
        console.log('📸 Screenshot sauvegardé');

        // 6. Pause pour inspection
        console.log('\n🔍 Navigateur ouvert 5 secondes...');
        await page.waitForTimeout(5000);

    } catch (error) {
        console.error(`\n❌ Erreur: ${error.message}`);
    }

    await browser.close();
    console.log('\n━'.repeat(50));
    console.log('✅ Test terminé');
}

testI18nVerification().catch(console.error);
