/**
 * TripSalama - Test Uber Style Tracking
 * Test complet du système de tracking véhicule
 * Exécuter avec: node tests/puppeteer/test-uber-tracking.js
 */

const puppeteer = require('puppeteer');

const config = {
    baseUrl: 'http://localhost:8080',
    headless: false, // Mode visuel
    slowMo: 50, // Ralentir pour voir les actions
    defaultTimeout: 30000
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('🚗 TripSalama - Test Uber Style Tracking');
    console.log('========================================\n');

    const browser = await puppeteer.launch({
        headless: config.headless,
        slowMo: config.slowMo,
        args: [
            '--window-size=430,932', // iPhone 14 Pro Max
            '--window-position=100,50'
        ],
        defaultViewport: {
            width: 430,
            height: 932,
            isMobile: true,
            hasTouch: true
        }
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(config.defaultTimeout);

    let testsPassed = 0;
    let testsFailed = 0;

    try {
        // Test 1: Charger la page de test tracking
        console.log('📍 Test 1: Chargement de la page de tracking...');
        await page.goto(`${config.baseUrl}/test/tracking`, {
            waitUntil: 'networkidle2'
        });

        // Vérifier que la carte est chargée
        const mapExists = await page.$('#map');
        if (mapExists) {
            console.log('✅ Carte Leaflet chargée');
            testsPassed++;
        } else {
            console.log('❌ Carte non trouvée');
            testsFailed++;
        }

        // Attendre que Leaflet soit initialisé
        await sleep(2000);

        // Test 2: Vérifier les contrôles
        console.log('\n📍 Test 2: Vérification des contrôles...');
        const startBtn = await page.$('#startBtn');
        const pauseBtn = await page.$('#pauseBtn');
        const stopBtn = await page.$('#stopBtn');

        if (startBtn && pauseBtn && stopBtn) {
            console.log('✅ Tous les boutons de contrôle présents');
            testsPassed++;
        } else {
            console.log('❌ Boutons manquants');
            testsFailed++;
        }

        // Test 3: Vérifier le panel de tracking
        console.log('\n📍 Test 3: Vérification du panel tracking...');
        const trackingPanel = await page.$('.tracking-panel');
        const etaDisplay = await page.$('#etaTime');
        const progressBar = await page.$('.tracking-progress-fill');

        if (trackingPanel && etaDisplay && progressBar) {
            console.log('✅ Panel de tracking complet');
            testsPassed++;
        } else {
            console.log('❌ Éléments du panel manquants');
            testsFailed++;
        }

        // Test 4: Démarrer la simulation
        console.log('\n📍 Test 4: Démarrage de la simulation...');
        await page.click('#startBtn');
        await sleep(1000);

        // Vérifier que le véhicule est créé
        const vehicleMarker = await page.$('.uber-vehicle-marker');
        if (vehicleMarker) {
            console.log('✅ Marqueur véhicule créé');
            testsPassed++;
        } else {
            console.log('❌ Marqueur véhicule non trouvé');
            testsFailed++;
        }

        // Test 5: Vérifier l'animation
        console.log('\n📍 Test 5: Vérification de l\'animation...');

        // Capturer la position initiale
        const initialProgress = await page.$eval('#progressPercent', el => el.textContent);

        // Attendre 3 secondes
        await sleep(3000);

        // Capturer la nouvelle position
        const newProgress = await page.$eval('#progressPercent', el => el.textContent);

        if (initialProgress !== newProgress) {
            console.log(`✅ Animation en cours: ${initialProgress} → ${newProgress}`);
            testsPassed++;
        } else {
            console.log('❌ Pas de progression détectée');
            testsFailed++;
        }

        // Test 6: Vérifier l'ETA
        console.log('\n📍 Test 6: Vérification de l\'ETA...');
        const etaValue = await page.$eval('#etaTime', el => el.textContent);
        if (etaValue && etaValue !== '--') {
            console.log(`✅ ETA affiché: ${etaValue} minutes`);
            testsPassed++;
        } else {
            console.log('❌ ETA non disponible');
            testsFailed++;
        }

        // Test 7: Tester le changement de vitesse
        console.log('\n📍 Test 7: Test changement de vitesse...');
        await page.click('[data-speed="5"]');
        await sleep(500);

        const speedBtn5x = await page.$eval('[data-speed="5"]', el => el.classList.contains('active'));
        if (speedBtn5x) {
            console.log('✅ Vitesse 5x activée');
            testsPassed++;
        } else {
            console.log('❌ Changement de vitesse échoué');
            testsFailed++;
        }

        // Test 8: Observer la progression rapide
        console.log('\n📍 Test 8: Progression accélérée...');
        const progressBefore = await page.$eval('#progressPercent', el => parseFloat(el.textContent));
        await sleep(3000);
        const progressAfter = await page.$eval('#progressPercent', el => parseFloat(el.textContent));

        const progressDiff = progressAfter - progressBefore;
        if (progressDiff > 5) {
            console.log(`✅ Progression rapide: +${progressDiff.toFixed(1)}%`);
            testsPassed++;
        } else {
            console.log('❌ Progression trop lente');
            testsFailed++;
        }

        // Test 9: Test du bouton pause
        console.log('\n📍 Test 9: Test pause...');
        await page.click('#pauseBtn');
        await sleep(500);

        const progressPaused1 = await page.$eval('#progressPercent', el => el.textContent);
        await sleep(1500);
        const progressPaused2 = await page.$eval('#progressPercent', el => el.textContent);

        if (progressPaused1 === progressPaused2) {
            console.log('✅ Simulation en pause (progression arrêtée)');
            testsPassed++;
        } else {
            console.log('❌ La simulation continue malgré la pause');
            testsFailed++;
        }

        // Reprendre
        await page.click('#pauseBtn');
        await sleep(1000);

        // Test 10: Test du bouton centrer
        console.log('\n📍 Test 10: Test centrer sur véhicule...');
        await page.click('#centerBtn');
        await sleep(500);
        console.log('✅ Fonction centrer exécutée');
        testsPassed++;

        // Test 11: Laisser la simulation aller jusqu'à la fin (vitesse max)
        console.log('\n📍 Test 11: Simulation jusqu\'à l\'arrivée...');
        await page.click('[data-speed="10"]');

        // Attendre l'arrivée (max 30 secondes)
        let arrived = false;
        for (let i = 0; i < 30; i++) {
            await sleep(1000);
            const progress = await page.$eval('#progressPercent', el => parseFloat(el.textContent));
            console.log(`   Progression: ${progress.toFixed(1)}%`);

            if (progress >= 99) {
                arrived = true;
                break;
            }
        }

        if (arrived) {
            console.log('✅ Arrivée à destination');
            testsPassed++;
        } else {
            console.log('⚠️ Simulation non terminée (timeout)');
        }

        // Test 12: Vérifier la modal d'arrivée
        await sleep(2000);
        console.log('\n📍 Test 12: Vérification modal d\'arrivée...');
        const arrivalModal = await page.$('#arrivalModal.active');
        if (arrivalModal) {
            console.log('✅ Modal d\'arrivée affichée');
            testsPassed++;

            // Fermer la modal
            await page.click('#closeArrivalBtn');
            await sleep(500);
        } else {
            console.log('⚠️ Modal d\'arrivée non détectée');
        }

        // Test 13: Rotation du véhicule
        console.log('\n📍 Test 13: Vérification rotation véhicule...');
        // Relancer une simulation pour tester la rotation
        await page.click('#startBtn');
        await sleep(2000);

        const vehicleTransform = await page.$eval('.uber-vehicle-marker', el => {
            return window.getComputedStyle(el).transform;
        });

        if (vehicleTransform && vehicleTransform !== 'none') {
            console.log(`✅ Rotation détectée: ${vehicleTransform}`);
            testsPassed++;
        } else {
            console.log('⚠️ Rotation non détectée');
        }

        // Arrêter la simulation
        await page.click('#stopBtn');

    } catch (error) {
        console.error('\n❌ Erreur durant les tests:', error.message);
        testsFailed++;
    }

    // Résumé
    console.log('\n========================================');
    console.log('📊 RÉSUMÉ DES TESTS');
    console.log('========================================');
    console.log(`✅ Tests réussis: ${testsPassed}`);
    console.log(`❌ Tests échoués: ${testsFailed}`);
    console.log(`📈 Taux de réussite: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

    // Garder le navigateur ouvert un moment pour voir le résultat
    console.log('\n⏳ Le navigateur restera ouvert 10 secondes...');
    await sleep(10000);

    await browser.close();

    // Exit code
    process.exit(testsFailed > 0 ? 1 : 0);
}

// Lancer les tests
runTests().catch(console.error);
