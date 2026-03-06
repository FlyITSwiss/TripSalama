/**
 * TripSalama - Vérification visuelle du flux d'inscription
 * Prend des screenshots à chaque étape pour analyse
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:8080';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'visual-check');

// Créer le dossier screenshots
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runVisualCheck() {
    console.log('\n🎨 Vérification visuelle du flux d\'inscription\n');
    console.log('━'.repeat(50));

    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });

    // Test sur 3 tailles d'écran
    const viewports = [
        { name: 'mobile', width: 375, height: 812 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1440, height: 900 }
    ];

    for (const viewport of viewports) {
        console.log(`\n📱 Test viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
        console.log('─'.repeat(40));

        const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            permissions: ['camera']
        });
        const page = await context.newPage();

        try {
            // 1. Page de choix d'inscription
            console.log('  → Page choix inscription...');
            await page.goto(`${BASE_URL}/register`);
            await page.waitForTimeout(500);
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, `01-register-choice-${viewport.name}.png`),
                fullPage: true
            });
            console.log('  ✓ Screenshot: 01-register-choice');

            // 2. Page d'inscription passagère
            console.log('  → Page inscription passagère...');
            await page.goto(`${BASE_URL}/register/passenger`);
            await page.waitForTimeout(500);
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, `02-register-passenger-empty-${viewport.name}.png`),
                fullPage: true
            });
            console.log('  ✓ Screenshot: 02-register-passenger-empty');

            // 3. Formulaire avec validation dynamique
            console.log('  → Test validation dynamique...');
            await page.fill('#first_name', 'Test');
            await page.fill('#last_name', 'User');
            await page.fill('#email', 'test@example.com');
            await page.fill('#password', 'Test');  // Mot de passe incomplet
            await page.waitForTimeout(300);
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, `03-register-validation-partial-${viewport.name}.png`),
                fullPage: true
            });
            console.log('  ✓ Screenshot: 03-register-validation-partial');

            // 4. Formulaire complet valide
            await page.fill('#password', 'Test1234');  // Mot de passe valide
            await page.fill('#password_confirm', 'Test1234');
            await page.waitForTimeout(300);
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, `04-register-validation-complete-${viewport.name}.png`),
                fullPage: true
            });
            console.log('  ✓ Screenshot: 04-register-validation-complete');

            // 5. Page de vérification d'identité (avec utilisateur connecté)
            console.log('  → Page vérification identité...');

            // Se connecter d'abord
            await page.goto(`${BASE_URL}/login`);
            await page.fill('#email', 'test@tripsalama.com');
            await page.fill('#password', 'Test123456!');
            await page.click('button[type="submit"]');
            await page.waitForTimeout(1000);

            // Aller à la page de vérification
            await page.goto(`${BASE_URL}/identity-verification`);
            await page.waitForTimeout(1000);
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, `05-identity-verification-${viewport.name}.png`),
                fullPage: true
            });
            console.log('  ✓ Screenshot: 05-identity-verification');

            // 6. Page de login pour comparaison
            console.log('  → Page login (comparaison design)...');
            await page.goto(`${BASE_URL}/login`);
            await page.waitForTimeout(500);
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, `06-login-${viewport.name}.png`),
                fullPage: true
            });
            console.log('  ✓ Screenshot: 06-login');

        } catch (error) {
            console.error(`  ✗ Erreur: ${error.message}`);
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, `error-${viewport.name}.png`),
                fullPage: true
            });
        }

        await context.close();
    }

    await browser.close();

    console.log('\n' + '━'.repeat(50));
    console.log(`✅ Screenshots sauvegardés dans: ${SCREENSHOTS_DIR}`);
    console.log('\nFichiers générés:');

    const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    files.forEach(f => console.log(`  - ${f}`));

    console.log('\n📊 Analyse recommandée:');
    console.log('  1. Vérifier max-width sur desktop (doit être ~480px)');
    console.log('  2. Vérifier cohérence design login vs register');
    console.log('  3. Vérifier validation dynamique visible');
    console.log('  4. Vérifier écran vérification identité');
}

runVisualCheck().catch(console.error);
