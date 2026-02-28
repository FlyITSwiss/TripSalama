/**
 * TripSalama - Test Smoke APK
 *
 * Teste juste que l'APK démarre sans crash (30 secondes max)
 * Idéal pour CI/CD ultra-rapide
 *
 * Usage: npm run test:apk:smoke
 */

const { remote } = require('webdriverio');
const path = require('path');
const fs = require('fs');

const APK_PATH = path.join(__dirname, '../../android/app/build/outputs/apk/release/app-release.apk');

const capabilities = {
    platformName: 'Android',
    'appium:deviceName': 'Android Emulator',
    'appium:automationName': 'UiAutomator2',
    'appium:app': APK_PATH,
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 60,
    'appium:noReset': false,
    'appium:fullReset': true
};

async function runSmokeTest() {
    console.log('\n🔥 TripSalama - Smoke Test APK\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (!fs.existsSync(APK_PATH)) {
        console.error(`❌ APK non trouvé: ${APK_PATH}`);
        process.exit(1);
    }

    console.log(`📱 APK: ${APK_PATH}`);
    console.log(`📏 Taille: ${(fs.statSync(APK_PATH).size / 1024 / 1024).toFixed(2)} MB\n`);

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
        console.log('✅ Connecté à Appium\n');

        console.log('⏳ Attente splash screen (3s)...');
        await driver.pause(3000);

        console.log('🔍 Vérification écran de login...');
        const emailField = await driver.$('~email-input');
        await emailField.waitForDisplayed({ timeout: 5000 });

        console.log('\n✅ SMOKE TEST PASSÉ\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('L\'APK démarre correctement sans crash.\n');

        process.exit(0);

    } catch (error) {
        console.error(`\n❌ SMOKE TEST ÉCHOUÉ\n`);
        console.error(`   Erreur: ${error.message}\n`);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(1);
    } finally {
        if (driver) {
            await driver.deleteSession();
        }
    }
}

runSmokeTest();
