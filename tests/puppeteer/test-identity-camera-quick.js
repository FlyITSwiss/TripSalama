/**
 * TripSalama - Test Quick pour Identity Camera
 * Version simplifiée pour vérification rapide
 */

const puppeteer = require('puppeteer');

const CONFIG = {
    baseUrl: 'http://127.0.0.1:8080',
    headless: false,
    slowMo: 100
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function quickTest() {
    console.log('🚀 Démarrage du test quick...\n');

    const browser = await puppeteer.launch({
        headless: CONFIG.headless,
        slowMo: CONFIG.slowMo,
        defaultViewport: { width: 420, height: 900 },
        args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--no-sandbox'
        ]
    });

    const page = await browser.newPage();

    // Log console
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('Error') || text.includes('error')) {
            console.log('❌', text);
        } else if (text.includes('[TripSalama]')) {
            console.log('📝', text);
        }
    });

    try {
        console.log('✅ Chargement de la page...');
        await page.goto(`${CONFIG.baseUrl}/demo-identity-camera.html`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await wait(3000);

        console.log('✅ Vérification du composant...');
        const container = await page.$('.identity-camera-container');
        if (!container) throw new Error('Composant non trouvé');

        console.log('✅ Vérification i18n...');
        const title = await page.$eval('.identity-title', el => el.textContent);
        console.log(`   Titre: "${title}"`);
        if (title.includes('verification.')) throw new Error('i18n non chargé');

        console.log('✅ Activation consentement...');
        await page.click('#identity-consent-checkbox');
        await wait(500);

        console.log('✅ Clic continuer...');
        await page.click('.identity-btn-continue');
        console.log('   ⏳ Chargement face-api.js (5-10s)...');
        await wait(8000);

        console.log('✅ Attente vue caméra...');
        await page.waitForSelector('.identity-camera-view:not(.hidden)', { timeout: 10000 });

        console.log('✅ Vérification flux vidéo...');
        const videoReady = await page.$eval('.identity-video', v => v.readyState >= 2);
        if (!videoReady) throw new Error('Vidéo non prête');

        console.log('✅ Capture photo...');
        await wait(2000);
        await page.click('.identity-btn-capture');
        await wait(1000);

        console.log('✅ Vérification preview...');
        await page.waitForSelector('.identity-preview:not(.hidden)', { timeout: 5000 });
        const imgSrc = await page.$eval('.preview-image', img => img.src);
        if (!imgSrc.startsWith('data:image/jpeg')) throw new Error('Image invalide');

        console.log('✅ Soumission...');
        await page.click('.identity-btn-submit');
        await wait(1000);

        console.log('✅ Attente résultat...');
        await page.waitForSelector('.identity-result:not(.hidden)', { timeout: 15000 });

        const resultTitle = await page.$eval('.identity-result-title', el => el.textContent);
        console.log(`   Résultat: "${resultTitle}"`);

        console.log('\n✅✅✅ TOUS LES TESTS SONT PASSÉS ! ✅✅✅\n');

        // Screenshot final
        await page.screenshot({ path: './screenshots/identity-camera/success.png', fullPage: true });

        console.log('Appuyez sur Entrée pour fermer...');
        await new Promise(resolve => process.stdin.once('data', resolve));

    } catch (err) {
        console.error('\n❌❌❌ ÉCHEC:', err.message, '\n');
        await page.screenshot({ path: './screenshots/identity-camera/error.png', fullPage: true });
        process.exit(1);
    } finally {
        await browser.close();
    }
}

quickTest();
