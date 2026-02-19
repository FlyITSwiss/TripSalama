/**
 * Test carte sombre TripSalama
 */
const puppeteer = require('puppeteer');

async function testDarkMap() {
    console.log('🗺️ Test de la carte sombre...\n');

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--window-size=430,932', '--window-position=100,50'],
        defaultViewport: { width: 430, height: 932, isMobile: true }
    });

    const page = await browser.newPage();

    // Activer la console du navigateur
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('❌ Console Error:', msg.text());
        }
    });

    page.on('requestfailed', request => {
        console.log('❌ Request failed:', request.url());
    });

    try {
        // Test page /test/tracking
        console.log('📍 Chargement /test/tracking...');
        await page.goto('http://localhost:8080/test/tracking', { waitUntil: 'networkidle2', timeout: 30000 });

        // Attendre que la carte soit chargée
        await page.waitForSelector('#map', { timeout: 10000 });
        console.log('✅ Carte trouvée');

        // Attendre les tuiles
        await new Promise(r => setTimeout(r, 3000));

        // Vérifier si des tuiles sont chargées
        const tilesLoaded = await page.evaluate(() => {
            const tiles = document.querySelectorAll('.leaflet-tile');
            return tiles.length;
        });

        console.log(`📦 Tuiles chargées: ${tilesLoaded}`);

        if (tilesLoaded > 0) {
            console.log('✅ Carte sombre chargée avec succès!');
        } else {
            console.log('⚠️ Aucune tuile détectée');
        }

        // Screenshot
        await page.screenshot({ path: 'tests/puppeteer/screenshot-dark-map.png' });
        console.log('\n📸 Screenshot sauvegardé: tests/puppeteer/screenshot-dark-map.png');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }

    console.log('\n⏳ Le navigateur reste ouvert 30 secondes pour vérification...');
    await new Promise(r => setTimeout(r, 30000));

    await browser.close();
}

testDarkMap().catch(console.error);
