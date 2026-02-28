/**
 * TripSalama - Test APK Login Rapide
 *
 * Teste uniquement le login passagère + conductrice
 * Version rapide pour CI/CD
 *
 * Usage: npm run test:apk:login
 */

const { remote } = require('webdriverio');
const path = require('path');
const fs = require('fs');

// Configuration
const APK_PATH = path.join(__dirname, '../../android/app/build/outputs/apk/release/app-release.apk');

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

let passed = 0;
let failed = 0;

function pass(msg) {
    console.log(`✅ ${msg}`);
    passed++;
}

function fail(msg, error) {
    console.log(`❌ ${msg}: ${error}`);
    failed++;
}

async function runTests() {
    console.log('\n🧪 TripSalama - Test Login APK\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (!fs.existsSync(APK_PATH)) {
        console.error(`❌ APK non trouvé: ${APK_PATH}`);
        console.error('   Lancer: npm run build:apk\n');
        process.exit(1);
    }

    let driver;

    try {
        console.log('🔌 Connexion à Appium...');
        driver = await remote({
            protocol: 'http',
            hostname: '127.0.0.1',
            port: 4723,
            path: '/',
            capabilities
        });
        console.log('✅ Connecté\n');

        // Test 1: App démarre
        console.log('━━━ Test 1: Démarrage ━━━\n');
        try {
            await driver.pause(3000);
            pass('App démarre sans crash');
        } catch (e) {
            fail('App démarre sans crash', e.message);
            throw e;
        }

        // Test 2: Login passagère
        console.log('\n━━━ Test 2: Login passagère ━━━\n');
        try {
            const emailField = await driver.$('~email-input');
            await emailField.waitForDisplayed({ timeout: 5000 });

            const passwordField = await driver.$('~password-input');
            const loginButton = await driver.$('~login-button');

            await emailField.setValue(TEST_CREDENTIALS.passenger.email);
            await passwordField.setValue(TEST_CREDENTIALS.passenger.password);
            await loginButton.click();
            await driver.pause(3000);

            const dashboardIndicator = await driver.$('~dashboard');
            if (await dashboardIndicator.isDisplayed()) {
                pass('Login passagère réussit');
            } else {
                fail('Login passagère réussit', 'Pas de redirection vers dashboard');
            }
        } catch (e) {
            fail('Login passagère réussit', e.message);
        }

        // Test 3: Logout
        console.log('\n━━━ Test 3: Logout ━━━\n');
        try {
            const logoutButton = await driver.$('~logout-button');
            await logoutButton.click();
            await driver.pause(2000);

            const emailField = await driver.$('~email-input');
            if (await emailField.isDisplayed()) {
                pass('Logout fonctionne');
            } else {
                fail('Logout fonctionne', 'Pas de retour au login');
            }
        } catch (e) {
            fail('Logout fonctionne', e.message);
        }

        // Test 4: Login conductrice
        console.log('\n━━━ Test 4: Login conductrice ━━━\n');
        try {
            const emailField = await driver.$('~email-input');
            const passwordField = await driver.$('~password-input');
            const loginButton = await driver.$('~login-button');

            await emailField.setValue(TEST_CREDENTIALS.driver.email);
            await passwordField.setValue(TEST_CREDENTIALS.driver.password);
            await loginButton.click();
            await driver.pause(3000);

            const dashboardIndicator = await driver.$('~dashboard');
            if (await dashboardIndicator.isDisplayed()) {
                pass('Login conductrice réussit');
            } else {
                fail('Login conductrice réussit', 'Pas de dashboard');
            }
        } catch (e) {
            fail('Login conductrice réussit', e.message);
        }

    } catch (error) {
        console.error(`\n❌ Erreur fatale: ${error.message}\n`);
        process.exit(1);
    } finally {
        if (driver) {
            await driver.deleteSession();
        }
    }

    // Rapport
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Passés  : ${passed}`);
    console.log(`❌ Échoués : ${failed}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
});
