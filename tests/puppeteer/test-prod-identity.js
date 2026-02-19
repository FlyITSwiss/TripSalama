/**
 * Test Production TripSalama - Identity Verification
 * URL: https://stabilis-it.ch/internal/tripsalama
 */
const puppeteer = require('puppeteer');
const fs = require('fs');

const CONFIG = {
    baseUrl: 'https://stabilis-it.ch/internal/tripsalama',
    headless: false,
    slowMo: 100,
    defaultViewport: { width: 1280, height: 900 }
};

async function runTest() {
    console.log('🚀 Test Production TripSalama - Identity Verification\n');
    console.log('URL:', CONFIG.baseUrl, '\n');

    const browser = await puppeteer.launch({
        headless: CONFIG.headless,
        slowMo: CONFIG.slowMo,
        defaultViewport: CONFIG.defaultViewport,
        args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--no-sandbox'
        ]
    });

    const page = await browser.newPage();
    let screenshotCount = 1;

    const screenshot = async (name) => {
        const filename = `prod-${String(screenshotCount++).padStart(2, '0')}-${name}.png`;
        await page.screenshot({
            path: `./screenshots/production/${filename}`,
            fullPage: true
        });
        console.log(`📸 Screenshot: ${filename}`);
        return filename;
    };

    try {
        // Créer dossier screenshots
        if (!fs.existsSync('./screenshots/production')) {
            fs.mkdirSync('./screenshots/production', { recursive: true });
        }

        // Test 1: Page d'accueil
        console.log('\n[TEST 1] Page d\'accueil...');
        await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await screenshot('homepage');
        const homeTitle = await page.title();
        console.log(`   Titre: "${homeTitle}"`);
        console.log('✅ Page d\'accueil chargée');

        // Test 2: Page login
        console.log('\n[TEST 2] Page login...');
        await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle2' });
        await screenshot('login-page');

        // Vérifier formulaire login
        const emailInput = await page.$('input[type="email"], input[name="email"], #email');
        const passwordInput = await page.$('input[type="password"], input[name="password"], #password');
        console.log(`   Champ email: ${emailInput ? '✅' : '❌'}`);
        console.log(`   Champ password: ${passwordInput ? '✅' : '❌'}`);
        console.log('✅ Page login accessible');

        // Test 3: Page inscription
        console.log('\n[TEST 3] Page inscription...');
        await page.goto(`${CONFIG.baseUrl}/register`, { waitUntil: 'networkidle2' });
        await screenshot('register-page');

        // Vérifier les options d'inscription
        const pageContent = await page.content();
        const hasPassenger = pageContent.includes('passag') || pageContent.includes('Passag');
        const hasDriver = pageContent.includes('conduct') || pageContent.includes('Conduct') || pageContent.includes('driver');
        console.log(`   Option passagère: ${hasPassenger ? '✅' : '❌'}`);
        console.log(`   Option conductrice: ${hasDriver ? '✅' : '❌'}`);
        console.log('✅ Page inscription accessible');

        // Test 4: Page identity-verification (nécessite auth)
        console.log('\n[TEST 4] Page identity-verification...');
        const verifyResponse = await page.goto(`${CONFIG.baseUrl}/identity-verification`, {
            waitUntil: 'networkidle2',
            timeout: 15000
        });

        const verifyStatus = verifyResponse.status();
        const verifyUrl = page.url();
        await screenshot('identity-verification-page');

        console.log(`   Status: ${verifyStatus}`);
        console.log(`   URL finale: ${verifyUrl}`);

        if (verifyUrl.includes('login')) {
            console.log('✅ Redirection vers login (auth requise - normal)');
        } else if (verifyStatus === 200) {
            console.log('✅ Page identity-verification accessible');

            // Vérifier les éléments
            const hasComponent = await page.$('.identity-camera-container');
            const hasConsent = await page.$('#identity-consent-checkbox');
            console.log(`   Composant caméra: ${hasComponent ? '✅' : '❌'}`);
            console.log(`   Checkbox consent: ${hasConsent ? '✅' : '❌'}`);
        }

        // Test 5: API verification
        console.log('\n[TEST 5] API verification...');
        const apiResponse = await page.goto(`${CONFIG.baseUrl}/api/verification.php?action=status`, {
            waitUntil: 'networkidle2'
        });

        const apiStatus = apiResponse.status();
        await screenshot('api-verification');
        console.log(`   Status HTTP: ${apiStatus}`);

        if (apiStatus === 401) {
            console.log('✅ API répond 401 (auth requise - normal)');
        } else if (apiStatus === 200) {
            const apiContent = await page.content();
            console.log('✅ API accessible');
            console.log(`   Réponse: ${apiContent.substring(0, 100)}...`);
        } else if (apiStatus === 404) {
            console.log('⚠️ API non trouvée (404)');
        } else {
            console.log(`⚠️ Status: ${apiStatus}`);
        }

        // Test 6: Page démo
        console.log('\n[TEST 6] Page démo identity-camera...');
        const demoResponse = await page.goto(`${CONFIG.baseUrl}/demo-identity-camera.html?demoMode=true`, {
            waitUntil: 'networkidle2',
            timeout: 15000
        });

        const demoStatus = demoResponse.status();
        await screenshot('demo-page');

        if (demoStatus === 200) {
            console.log('✅ Page démo accessible');

            // Attendre chargement
            await page.waitForTimeout(2000);
            await screenshot('demo-loaded');

            // Vérifier le composant
            const container = await page.$('.identity-camera-container');
            if (container) {
                console.log('✅ Composant caméra présent');

                // Vérifier textes
                const titleEl = await page.$('.identity-title');
                if (titleEl) {
                    const title = await page.evaluate(el => el.textContent, titleEl);
                    console.log(`   Titre: "${title}"`);

                    if (!title.includes('verification.')) {
                        console.log('✅ i18n OK (pas de clé brute)');
                    } else {
                        console.log('⚠️ Clé i18n non traduite');
                    }
                }

                // Vérifier tips
                const tips = await page.$$('.tip-item');
                console.log(`   Tips: ${tips.length} éléments`);

                await screenshot('demo-component-details');
            } else {
                console.log('⚠️ Composant non trouvé');
            }
        } else {
            console.log(`⚠️ Page démo non accessible (${demoStatus})`);
        }

        // Test 7: Design System
        console.log('\n[TEST 7] Design System...');
        await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle2' });

        const cssVars = await page.evaluate(() => {
            const style = getComputedStyle(document.documentElement);
            return {
                primary: style.getPropertyValue('--color-primary').trim(),
                accent: style.getPropertyValue('--color-accent').trim(),
                surface: style.getPropertyValue('--color-surface').trim()
            };
        });

        console.log(`   --color-primary: ${cssVars.primary || 'non définie'}`);
        console.log(`   --color-accent: ${cssVars.accent || 'non définie'}`);
        console.log(`   --color-surface: ${cssVars.surface || 'non définie'}`);

        await screenshot('design-system');

        // Résumé
        console.log('\n========================================');
        console.log('✅ TESTS PRODUCTION TERMINÉS');
        console.log('========================================');
        console.log('\n📁 Screenshots: ./screenshots/production/');

    } catch (error) {
        console.error('\n❌ ERREUR:', error.message);
        await screenshot('error-state');
    }

    console.log('\nAppuyez sur Entrée pour fermer le navigateur...');
    await new Promise(resolve => {
        process.stdin.once('data', resolve);
    });

    await browser.close();
}

runTest();
