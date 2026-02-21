/**
 * TripSalama - Tests Détection de Pays
 * Tests E2E pour la détection automatique du pays et devise
 */

const puppeteer = require('puppeteer');
const config = require('./config');

// Couleurs console
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(type, message) {
    const prefix = {
        pass: `${colors.green}[PASS]${colors.reset}`,
        fail: `${colors.red}[FAIL]${colors.reset}`,
        info: `${colors.blue}[INFO]${colors.reset}`,
        warn: `${colors.yellow}[WARN]${colors.reset}`,
        test: `${colors.cyan}[TEST]${colors.reset}`
    };
    console.log(`${prefix[type] || '[LOG]'} ${message}`);
}

async function runTests() {
    let browser;
    let passed = 0;
    let failed = 0;

    try {
        log('info', 'Lancement de Puppeteer pour tests de détection pays...');
        browser = await puppeteer.launch(config.puppeteer);
        const page = await browser.newPage();

        // Simuler une position GPS (France - Paris)
        const francePosition = { latitude: 48.8566, longitude: 2.3522 };
        // Position Maroc - Casablanca
        const moroccoPosition = { latitude: 33.5731, longitude: -7.5898 };

        // ========================================
        // TEST 1: CountryDetectionService est chargé
        // ========================================
        log('test', 'Test 1: Vérifier que CountryDetectionService est chargé...');
        try {
            // Se connecter d'abord
            await page.goto(config.url('login'), { waitUntil: 'networkidle2' });
            await page.type('input[name="email"]', config.users.passenger.email, { delay: 30 });
            await page.type('input[name="password"]', config.users.passenger.password, { delay: 30 });
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            ]);

            await config.sleep(1000);

            // Vérifier que le service est disponible
            const hasService = await page.evaluate(() => {
                return typeof window.CountryDetectionService !== 'undefined';
            });

            if (hasService) {
                log('pass', 'CountryDetectionService est chargé');
                passed++;
            } else {
                log('fail', 'CountryDetectionService non trouvé');
                failed++;
            }
        } catch (error) {
            log('fail', `Erreur Test 1: ${error.message}`);
            failed++;
        }

        // ========================================
        // TEST 2: Détection de pays France (coordonnées)
        // ========================================
        log('test', 'Test 2: Détection de pays France...');
        try {
            const detectedCountry = await page.evaluate((lat, lng) => {
                if (typeof CountryDetectionService === 'undefined') return null;
                return CountryDetectionService.detectFromCoordinates(lat, lng);
            }, francePosition.latitude, francePosition.longitude);

            if (detectedCountry === 'FR') {
                log('pass', `Pays France détecté correctement: ${detectedCountry}`);
                passed++;
            } else {
                log('fail', `Pays France non détecté: ${detectedCountry}`);
                failed++;
            }
        } catch (error) {
            log('fail', `Erreur Test 2: ${error.message}`);
            failed++;
        }

        // ========================================
        // TEST 3: Devise EUR pour France
        // ========================================
        log('test', 'Test 3: Devise EUR pour France...');
        try {
            const currency = await page.evaluate(() => {
                if (typeof CountryDetectionService === 'undefined') return null;
                return CountryDetectionService.getCurrentCurrency();
            });

            if (currency === 'EUR') {
                log('pass', `Devise correcte pour France: ${currency}`);
                passed++;
            } else {
                log('fail', `Devise incorrecte: ${currency} (attendu: EUR)`);
                failed++;
            }
        } catch (error) {
            log('fail', `Erreur Test 3: ${error.message}`);
            failed++;
        }

        // ========================================
        // TEST 4: Détection de pays Maroc (coordonnées)
        // ========================================
        log('test', 'Test 4: Détection de pays Maroc...');
        try {
            const detectedCountry = await page.evaluate((lat, lng) => {
                if (typeof CountryDetectionService === 'undefined') return null;
                return CountryDetectionService.detectFromCoordinates(lat, lng);
            }, moroccoPosition.latitude, moroccoPosition.longitude);

            if (detectedCountry === 'MA') {
                log('pass', `Pays Maroc détecté correctement: ${detectedCountry}`);
                passed++;
            } else {
                log('fail', `Pays Maroc non détecté: ${detectedCountry}`);
                failed++;
            }
        } catch (error) {
            log('fail', `Erreur Test 4: ${error.message}`);
            failed++;
        }

        // ========================================
        // TEST 5: Devise MAD pour Maroc
        // ========================================
        log('test', 'Test 5: Devise MAD pour Maroc...');
        try {
            const currency = await page.evaluate(() => {
                if (typeof CountryDetectionService === 'undefined') return null;
                return CountryDetectionService.getCurrentCurrency();
            });

            if (currency === 'MAD') {
                log('pass', `Devise correcte pour Maroc: ${currency}`);
                passed++;
            } else {
                log('fail', `Devise incorrecte: ${currency} (attendu: MAD)`);
                failed++;
            }
        } catch (error) {
            log('fail', `Erreur Test 5: ${error.message}`);
            failed++;
        }

        // ========================================
        // TEST 6: Formatage de prix MAD
        // ========================================
        log('test', 'Test 6: Formatage de prix Maroc...');
        try {
            const formattedPrice = await page.evaluate(() => {
                if (typeof CountryDetectionService === 'undefined') return null;
                return CountryDetectionService.formatPrice(25.50);
            });

            if (formattedPrice && formattedPrice.includes('DH')) {
                log('pass', `Prix formaté correctement: ${formattedPrice}`);
                passed++;
            } else {
                log('fail', `Formatage prix incorrect: ${formattedPrice}`);
                failed++;
            }
        } catch (error) {
            log('fail', `Erreur Test 6: ${error.message}`);
            failed++;
        }

        // ========================================
        // TEST 7: Calcul de prix avec tarifs Maroc
        // ========================================
        log('test', 'Test 7: Calcul de prix avec tarifs Maroc...');
        try {
            const estimatedPrice = await page.evaluate(() => {
                if (typeof CountryDetectionService === 'undefined') return null;
                // 10km, 15min
                return CountryDetectionService.calculateEstimatedPrice(10, 15);
            });

            // Prix attendu pour Maroc: base(10) + km(10*5) + min(15*1) = 10 + 50 + 15 = 75 MAD
            if (estimatedPrice >= 60 && estimatedPrice <= 80) {
                log('pass', `Prix estimé correct: ${estimatedPrice} MAD`);
                passed++;
            } else {
                log('fail', `Prix estimé incorrect: ${estimatedPrice} (attendu ~75 MAD)`);
                failed++;
            }
        } catch (error) {
            log('fail', `Erreur Test 7: ${error.message}`);
            failed++;
        }

        // ========================================
        // TEST 8: Changement manuel de pays vers France
        // ========================================
        log('test', 'Test 8: Changement manuel de pays vers France...');
        try {
            const success = await page.evaluate(() => {
                if (typeof CountryDetectionService === 'undefined') return false;
                return CountryDetectionService.setCountry('FR');
            });

            const currentCountry = await page.evaluate(() => {
                return CountryDetectionService.getCurrentCountry();
            });

            if (success && currentCountry === 'FR') {
                log('pass', `Changement de pays réussi: ${currentCountry}`);
                passed++;
            } else {
                log('fail', `Changement de pays échoué`);
                failed++;
            }
        } catch (error) {
            log('fail', `Erreur Test 8: ${error.message}`);
            failed++;
        }

        // ========================================
        // TEST 9: Formatage de prix EUR
        // ========================================
        log('test', 'Test 9: Formatage de prix France (EUR)...');
        try {
            const formattedPrice = await page.evaluate(() => {
                if (typeof CountryDetectionService === 'undefined') return null;
                return CountryDetectionService.formatPrice(12.50);
            });

            if (formattedPrice && (formattedPrice.includes('€') || formattedPrice.includes('EUR'))) {
                log('pass', `Prix formaté correctement: ${formattedPrice}`);
                passed++;
            } else {
                log('fail', `Formatage prix incorrect: ${formattedPrice}`);
                failed++;
            }
        } catch (error) {
            log('fail', `Erreur Test 9: ${error.message}`);
            failed++;
        }

        // ========================================
        // TEST 10: Pays supportés
        // ========================================
        log('test', 'Test 10: Liste des pays supportés...');
        try {
            const countries = await page.evaluate(() => {
                if (typeof CountryDetectionService === 'undefined') return [];
                return CountryDetectionService.getSupportedCountries();
            });

            const hasFrance = countries.some(c => c.code === 'FR');
            const hasMorocco = countries.some(c => c.code === 'MA');

            if (hasFrance && hasMorocco && countries.length >= 2) {
                log('pass', `${countries.length} pays supportés: FR et MA`);
                passed++;
            } else {
                log('fail', `Pays manquants dans la liste`);
                failed++;
            }
        } catch (error) {
            log('fail', `Erreur Test 10: ${error.message}`);
            failed++;
        }

        await config.sleep(2000);

        // ========================================
        // RESULTATS
        // ========================================
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.cyan}RESULTATS DETECTION PAYS${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`${colors.green}PASSES: ${passed}${colors.reset}`);
        console.log(`${colors.red}ECHOUES: ${failed}${colors.reset}`);
        console.log('='.repeat(60) + '\n');

        if (failed === 0) {
            log('pass', 'Tous les tests de détection pays sont passés !');
        } else {
            log('warn', `${failed} test(s) en échec`);
        }

    } catch (error) {
        log('fail', `Erreur fatale: ${error.message}`);
        console.error(error);
    } finally {
        if (browser) {
            log('info', 'Fermeture du navigateur dans 3 secondes...');
            await config.sleep(3000);
            await browser.close();
        }
    }

    return failed === 0;
}

// Executer
runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
