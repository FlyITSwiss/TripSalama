/**
 * Test complet workflow booking avec login
 * TripSalama - Carte sombre style Uber
 */
const puppeteer = require('puppeteer');

const config = {
    baseUrl: 'http://localhost:8080',
    // Le hash bcrypt utilisé correspond à "password"
    email: 'passenger@tripsalama.ch',
    password: 'password'
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBookingWorkflow() {
    console.log('🚗 TripSalama - Test Workflow Booking Complet');
    console.log('=============================================\n');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        args: ['--window-size=430,932', '--window-position=100,50'],
        defaultViewport: { width: 430, height: 932, isMobile: true, hasTouch: true }
    });

    const page = await browser.newPage();

    // Logger les erreurs console
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('❌ Console:', msg.text().substring(0, 100));
        }
    });

    try {
        // 1. Aller sur login
        console.log('📍 Étape 1: Page de connexion...');
        await page.goto(`${config.baseUrl}/login`, { waitUntil: 'networkidle2' });
        await sleep(1000);

        // Vérifier qu'on est sur la page login
        const loginForm = await page.$('form');
        if (loginForm) {
            console.log('✅ Page de connexion chargée');
        } else {
            console.log('⚠️ Formulaire non trouvé, peut-être déjà connecté?');
        }

        // Screenshot login
        await page.screenshot({ path: 'tests/puppeteer/screenshot-1-login.png' });

        // 2. Se connecter
        console.log('\n📍 Étape 2: Connexion...');

        // Remplir email
        const emailInput = await page.$('input[type="email"], input[name="email"]');
        if (emailInput) {
            await emailInput.click({ clickCount: 3 });
            await emailInput.type(config.email);
            console.log('   Email saisi');
        }

        // Remplir password
        const passwordInput = await page.$('input[type="password"], input[name="password"]');
        if (passwordInput) {
            await passwordInput.type(config.password);
            console.log('   Mot de passe saisi');
        }

        // Screenshot avant submit
        await page.screenshot({ path: 'tests/puppeteer/screenshot-2-credentials.png' });

        // Soumettre
        const submitBtn = await page.$('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
            await submitBtn.click();
            console.log('   Formulaire soumis');
        }

        // Attendre la redirection
        await sleep(3000);

        // Screenshot après login
        await page.screenshot({ path: 'tests/puppeteer/screenshot-3-after-login.png' });

        const currentUrl = page.url();
        console.log(`   URL actuelle: ${currentUrl}`);

        // 3. Aller sur /passenger/book
        console.log('\n📍 Étape 3: Page de réservation...');
        await page.goto(`${config.baseUrl}/passenger/book`, { waitUntil: 'networkidle2' });
        await sleep(2000);

        // Screenshot booking
        await page.screenshot({ path: 'tests/puppeteer/screenshot-4-booking.png' });

        // Vérifier la carte
        const mapElement = await page.$('#map');
        if (mapElement) {
            console.log('✅ Carte trouvée');
        } else {
            console.log('❌ Carte non trouvée');
        }

        // Attendre les tuiles
        await sleep(3000);

        // Compter les tuiles
        const tilesCount = await page.evaluate(() => {
            return document.querySelectorAll('.leaflet-tile').length;
        });
        console.log(`📦 Tuiles chargées: ${tilesCount}`);

        // Vérifier si c'est dark mode (vérifier la couleur de fond ou l'URL des tuiles)
        const isDarkMode = await page.evaluate(() => {
            const tiles = document.querySelectorAll('.leaflet-tile');
            if (tiles.length > 0) {
                const src = tiles[0].src || '';
                return src.includes('dark') || src.includes('cartodb');
            }
            return false;
        });

        if (isDarkMode) {
            console.log('✅ Mode sombre activé (CartoDB Dark)');
        } else {
            console.log('⚠️ Mode sombre non détecté');
        }

        // Screenshot final
        await page.screenshot({ path: 'tests/puppeteer/screenshot-5-booking-map.png' });
        console.log('\n📸 Screenshots sauvegardés dans tests/puppeteer/');

        // 4. Tester la géolocalisation
        console.log('\n📍 Étape 4: Test géolocalisation...');

        // Simuler la permission de géolocalisation
        const context = browser.defaultBrowserContext();
        await context.overridePermissions(config.baseUrl, ['geolocation']);

        // Définir une position simulée (Casablanca)
        await page.setGeolocation({ latitude: 33.5731, longitude: -7.5898 });

        // Cliquer sur le bouton de localisation
        const locateBtn = await page.$('#locateMeBtn, #quickLocateBtn, .booking-locate-btn');
        if (locateBtn) {
            await locateBtn.click();
            console.log('   Bouton localisation cliqué');
            await sleep(3000);
        }

        // Screenshot après géoloc
        await page.screenshot({ path: 'tests/puppeteer/screenshot-6-geolocation.png' });

        console.log('\n=============================================');
        console.log('✅ Test workflow terminé !');
        console.log('=============================================');

    } catch (error) {
        console.error('\n❌ Erreur:', error.message);
        await page.screenshot({ path: 'tests/puppeteer/screenshot-error.png' });
    }

    console.log('\n⏳ Navigateur ouvert 30 secondes pour vérification visuelle...');
    await sleep(30000);

    await browser.close();
}

testBookingWorkflow().catch(console.error);
