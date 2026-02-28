/**
 * TripSalama - Tests APK Complets (Appium)
 *
 * Teste l'APK RÉEL sur émulateur Android
 * Vérifie TOUTES les features critiques pour le Play Store
 *
 * Usage: npm run test:apk
 */

const { remote } = require('webdriverio');
const path = require('path');
const fs = require('fs');

// Configuration
const APK_PATH = path.join(__dirname, '../../android/app/build/outputs/apk/release/app-release.apk');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Identifiants de test
const TEST_CREDENTIALS = {
    passenger: {
        email: 'passenger@tripsalama.ch',
        password: 'TripSalama2025!'
    },
    driver: {
        email: 'driver@tripsalama.ch',
        password: 'TripSalama2025!'
    }
};

// Résultats des tests
let testsResults = {
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * Configuration Appium
 */
const capabilities = {
    platformName: 'Android',
    'appium:deviceName': 'Android Emulator',
    'appium:automationName': 'UiAutomator2',
    'appium:app': APK_PATH,
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 300,
    'appium:noReset': false,
    'appium:fullReset': true
};

/**
 * Utilitaires
 */
function pass(testName) {
    console.log(`✅ ${testName}`);
    testsResults.passed++;
}

function fail(testName, error) {
    console.log(`❌ ${testName}: ${error}`);
    testsResults.failed++;
    testsResults.errors.push({ test: testName, error });
}

async function takeScreenshot(driver, name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);

    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    await driver.saveScreenshot(filepath);
    console.log(`📸 Screenshot: ${filename}`);
}

/**
 * Tests
 */
async function runTests() {
    console.log('\n🧪 TripSalama - Tests APK Complets\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Vérifier que l'APK existe
    if (!fs.existsSync(APK_PATH)) {
        console.error(`❌ APK non trouvé: ${APK_PATH}`);
        console.error('   Lancer: npm run build:apk\n');
        process.exit(1);
    }

    console.log(`📱 APK: ${APK_PATH}`);
    console.log(`📏 Taille: ${(fs.statSync(APK_PATH).size / 1024 / 1024).toFixed(2)} MB\n`);

    let driver;

    try {
        // Connexion à Appium
        console.log('🔌 Connexion à Appium...');
        driver = await remote({
            protocol: 'http',
            hostname: '127.0.0.1',
            port: 4723,
            path: '/',
            capabilities
        });
        console.log('✅ Connecté à Appium\n');

        // Test 1: Démarrage de l'app
        console.log('━━━ Test 1: Démarrage ━━━\n');
        try {
            await driver.pause(3000); // Attendre le splash screen
            await takeScreenshot(driver, '01-splash');
            pass('App démarre sans crash');
        } catch (e) {
            fail('App démarre sans crash', e.message);
            throw e;
        }

        // Test 2: Écran de login s'affiche
        console.log('\n━━━ Test 2: Écran de login ━━━\n');
        try {
            const emailField = await driver.$('~email-input');
            await emailField.waitForDisplayed({ timeout: 5000 });
            await takeScreenshot(driver, '02-login-screen');
            pass('Écran de login s\'affiche');
        } catch (e) {
            fail('Écran de login s\'affiche', e.message);
            await takeScreenshot(driver, '02-login-ERROR');
        }

        // Test 3: Logo TripSalama visible
        console.log('\n━━━ Test 3: Logo ━━━\n');
        try {
            // Chercher l'image du logo (peut être un élément image ou un conteneur)
            const logoElements = await driver.$$('android.widget.Image');
            if (logoElements.length > 0) {
                pass('Logo TripSalama visible');
            } else {
                fail('Logo TripSalama visible', 'Aucune image trouvée');
            }
        } catch (e) {
            fail('Logo TripSalama visible', e.message);
        }

        // Test 4: Login passagère
        console.log('\n━━━ Test 4: Login passagère ━━━\n');
        try {
            const emailField = await driver.$('~email-input');
            const passwordField = await driver.$('~password-input');
            const loginButton = await driver.$('~login-button');

            await emailField.setValue(TEST_CREDENTIALS.passenger.email);
            await passwordField.setValue(TEST_CREDENTIALS.passenger.password);
            await takeScreenshot(driver, '03-login-filled');

            await loginButton.click();
            await driver.pause(3000); // Attendre la réponse API

            await takeScreenshot(driver, '04-after-login');

            // Vérifier qu'on est sur le dashboard
            const dashboardIndicator = await driver.$('~dashboard');
            if (await dashboardIndicator.isDisplayed()) {
                pass('Login passagère réussit');
                pass('Dashboard passagère s\'affiche');
            } else {
                fail('Login passagère réussit', 'Pas de redirection vers dashboard');
            }
        } catch (e) {
            fail('Login passagère réussit', e.message);
            await takeScreenshot(driver, '04-login-ERROR');
        }

        // Test 5: Map se charge
        console.log('\n━━━ Test 5: Map ━━━\n');
        try {
            await driver.pause(2000);
            // Chercher l'élément map (WebView)
            const contexts = await driver.getContexts();
            console.log(`   Contexts disponibles: ${contexts.join(', ')}`);

            if (contexts.includes('WEBVIEW_com.tripsalama.app')) {
                pass('Map (WebView) se charge');
            } else {
                fail('Map (WebView) se charge', 'WebView non trouvée');
            }
        } catch (e) {
            fail('Map (WebView) se charge', e.message);
        }

        // Test 6: Logout
        console.log('\n━━━ Test 6: Logout ━━━\n');
        try {
            const logoutButton = await driver.$('~logout-button');
            await logoutButton.click();
            await driver.pause(2000);

            await takeScreenshot(driver, '05-after-logout');

            const emailField = await driver.$('~email-input');
            if (await emailField.isDisplayed()) {
                pass('Logout fonctionne');
            } else {
                fail('Logout fonctionne', 'Pas de retour au login');
            }
        } catch (e) {
            fail('Logout fonctionne', e.message);
        }

        // Test 7: Login conductrice
        console.log('\n━━━ Test 7: Login conductrice ━━━\n');
        try {
            const emailField = await driver.$('~email-input');
            const passwordField = await driver.$('~password-input');
            const loginButton = await driver.$('~login-button');

            await emailField.setValue(TEST_CREDENTIALS.driver.email);
            await passwordField.setValue(TEST_CREDENTIALS.driver.password);
            await loginButton.click();
            await driver.pause(3000);

            await takeScreenshot(driver, '06-driver-dashboard');

            const dashboardIndicator = await driver.$('~dashboard');
            if (await dashboardIndicator.isDisplayed()) {
                pass('Login conductrice réussit');
                pass('Dashboard conductrice s\'affiche');
            } else {
                fail('Login conductrice réussit', 'Pas de dashboard');
            }
        } catch (e) {
            fail('Login conductrice réussit', e.message);
        }

        // Test 8: Rotation écran
        console.log('\n━━━ Test 8: Rotation ━━━\n');
        try {
            await driver.setOrientation('LANDSCAPE');
            await driver.pause(1000);
            await takeScreenshot(driver, '07-landscape');

            await driver.setOrientation('PORTRAIT');
            await driver.pause(1000);
            pass('Rotation écran supportée');
        } catch (e) {
            fail('Rotation écran supportée', e.message);
        }

        // Test 9: Back button
        console.log('\n━━━ Test 9: Back button ━━━\n');
        try {
            await driver.back();
            await driver.pause(1000);
            pass('Back button fonctionne');
        } catch (e) {
            fail('Back button fonctionne', e.message);
        }

        // Test 10: Redémarrage app (test crash)
        console.log('\n━━━ Test 10: Redémarrage ━━━\n');
        try {
            await driver.terminateApp('com.tripsalama.app');
            await driver.pause(1000);
            await driver.activateApp('com.tripsalama.app');
            await driver.pause(3000);
            pass('App redémarre sans crash');
        } catch (e) {
            fail('App redémarre sans crash', e.message);
        }

    } catch (error) {
        console.error(`\n❌ Erreur fatale: ${error.message}\n`);
        process.exit(1);
    } finally {
        if (driver) {
            await driver.deleteSession();
        }
    }

    // Rapport final
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 Résultats\n');
    console.log(`✅ Passés  : ${testsResults.passed}`);
    console.log(`❌ Échoués : ${testsResults.failed}`);
    console.log(`📸 Screenshots: ${SCREENSHOTS_DIR}\n`);

    if (testsResults.failed > 0) {
        console.log('━━━ Erreurs ━━━\n');
        testsResults.errors.forEach((err, i) => {
            console.log(`${i + 1}. ${err.test}`);
            console.log(`   → ${err.error}\n`);
        });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (testsResults.failed === 0) {
        console.log('✅ Tous les tests sont passés ! L\'APK est prêt.\n');
        process.exit(0);
    } else {
        console.log('❌ Des tests ont échoué. Corriger avant soumission Play Store.\n');
        process.exit(1);
    }
}

// Lancer les tests
runTests().catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
});
