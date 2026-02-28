#!/usr/bin/env node
/**
 * TripSalama - Configuration Automatique Appium
 *
 * Configure l'environnement de test APK:
 * - Vérifie Node.js et npm
 * - Installe Appium 2.x et drivers
 * - Vérifie Android SDK
 * - Vérifie émulateur Android
 * - Configure les variables d'environnement
 *
 * Usage: npm run setup:appium
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Couleurs
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.cyan}📱 TripSalama - Configuration Appium${colors.reset}`);
console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

let errors = [];
let warnings = [];

/**
 * Utilitaires
 */
function pass(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function fail(message, details = '') {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
    if (details) console.log(`   ${colors.red}${details}${colors.reset}`);
    errors.push({ message, details });
}

function warn(message, details = '') {
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
    if (details) console.log(`   ${colors.yellow}${details}${colors.reset}`);
    warnings.push({ message, details });
}

function info(message) {
    console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

function section(title) {
    console.log(`\n${colors.cyan}━━━ ${title} ━━━${colors.reset}\n`);
}

function exec(command, options = {}) {
    try {
        return execSync(command, { encoding: 'utf8', ...options });
    } catch (error) {
        return null;
    }
}

/**
 * 1. Vérifier Node.js et npm
 */
section('Vérification Node.js');

const nodeVersion = exec('node --version');
if (nodeVersion) {
    const version = nodeVersion.trim().replace('v', '');
    const major = parseInt(version.split('.')[0]);
    if (major >= 18) {
        pass(`Node.js ${version} (>= 18 requis)`);
    } else {
        fail(`Node.js ${version} trop ancien`, 'Installer Node.js >= 18');
    }
} else {
    fail('Node.js non installé', 'Installer depuis https://nodejs.org');
}

const npmVersion = exec('npm --version');
if (npmVersion) {
    pass(`npm ${npmVersion.trim()}`);
} else {
    fail('npm non installé');
}

/**
 * 2. Installer les dépendances
 */
section('Installation dépendances');

try {
    info('Installation des packages npm...');
    execSync('npm install', { stdio: 'inherit' });
    pass('Packages npm installés');
} catch (e) {
    fail('Installation npm échouée', e.message);
}

/**
 * 3. Vérifier Appium
 */
section('Vérification Appium');

const appiumVersion = exec('npx appium --version');
if (appiumVersion) {
    pass(`Appium ${appiumVersion.trim()}`);
} else {
    warn('Appium non trouvé', 'Installation via npm install en cours...');
}

// Installer UiAutomator2 driver
info('Installation UiAutomator2 driver...');
const driverInstall = exec('npx appium driver install uiautomator2');
if (driverInstall) {
    pass('UiAutomator2 driver installé');
} else {
    warn('Impossible d\'installer UiAutomator2', 'Réessayer manuellement: npx appium driver install uiautomator2');
}

/**
 * 4. Vérifier Android SDK
 */
section('Vérification Android SDK');

const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (androidHome && fs.existsSync(androidHome)) {
    pass(`ANDROID_HOME: ${androidHome}`);

    // Vérifier SDK tools
    const adbPath = path.join(androidHome, 'platform-tools', 'adb.exe');
    if (fs.existsSync(adbPath) || fs.existsSync(adbPath.replace('.exe', ''))) {
        pass('ADB trouvé');

        // Tester ADB
        const devices = exec('adb devices');
        if (devices) {
            const lines = devices.trim().split('\n').filter(l => l && !l.includes('List of devices'));
            if (lines.length > 0) {
                pass(`${lines.length} appareil(s) Android connecté(s)`);
                lines.forEach(line => {
                    info(`   ${line}`);
                });
            } else {
                warn('Aucun appareil Android connecté', 'Démarrer un émulateur avant de lancer les tests');
            }
        }
    } else {
        fail('ADB non trouvé', 'Installer Android SDK Platform Tools');
    }

    // Vérifier emulator
    const emulatorPath = path.join(androidHome, 'emulator', 'emulator.exe');
    if (fs.existsSync(emulatorPath) || fs.existsSync(emulatorPath.replace('.exe', ''))) {
        pass('Emulator trouvé');

        // Lister les AVDs
        const avds = exec('emulator -list-avds');
        if (avds && avds.trim()) {
            const avdList = avds.trim().split('\n');
            pass(`${avdList.length} AVD(s) configuré(s)`);
            avdList.forEach(avd => {
                info(`   ${avd}`);
            });
        } else {
            warn('Aucun AVD configuré', 'Créer un AVD via Android Studio');
        }
    } else {
        warn('Emulator non trouvé', 'Installer via Android Studio');
    }
} else {
    fail('ANDROID_HOME non défini ou invalide', 'Définir ANDROID_HOME dans les variables d\'environnement');
}

/**
 * 5. Vérifier Java
 */
section('Vérification Java');

const javaVersion = exec('java -version 2>&1');
if (javaVersion) {
    const match = javaVersion.match(/version "(\d+)/);
    if (match) {
        const version = parseInt(match[1]);
        if (version >= 11) {
            pass(`Java ${version} (>= 11 requis)`);
        } else {
            fail(`Java ${version} trop ancien`, 'Installer JDK >= 11');
        }
    } else {
        pass('Java installé');
    }
} else {
    fail('Java non installé', 'Installer JDK 11 ou supérieur');
}

/**
 * 6. Créer le script de démarrage Appium
 */
section('Configuration scripts');

const startAppiumScript = `#!/usr/bin/env node
/**
 * Démarre le serveur Appium sur le port 4723
 * Usage: npm run appium:start
 */
const { spawn } = require('child_process');

console.log('🚀 Démarrage serveur Appium...');
console.log('📍 http://127.0.0.1:4723\\n');

const appium = spawn('npx', ['appium'], {
    stdio: 'inherit',
    shell: true
});

appium.on('error', (error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\\n🛑 Arrêt du serveur Appium');
    appium.kill();
    process.exit(0);
});
`;

fs.writeFileSync(path.join(__dirname, 'start-appium.js'), startAppiumScript);
pass('Script start-appium.js créé');

/**
 * Rapport final
 */
console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.cyan}📊 Résumé${colors.reset}`);
console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

if (errors.length === 0 && warnings.length === 0) {
    console.log(`${colors.green}✅ Configuration terminée ! Tout est prêt.${colors.reset}\n`);

    console.log(`${colors.cyan}📋 Prochaines étapes:${colors.reset}`);
    console.log('   1. Démarrer serveur Appium: npm run appium:start');
    console.log('   2. Démarrer émulateur Android (si pas déjà démarré)');
    console.log('   3. Lancer les tests: npm run test:apk\n');

    process.exit(0);
} else {
    if (errors.length > 0) {
        console.log(`${colors.red}━━━ Erreurs bloquantes (${errors.length}) ━━━${colors.reset}\n`);
        errors.forEach((err, i) => {
            console.log(`${i + 1}. ${err.message}`);
            if (err.details) console.log(`   → ${err.details}`);
        });
        console.log('');
    }

    if (warnings.length > 0) {
        console.log(`${colors.yellow}━━━ Avertissements (${warnings.length}) ━━━${colors.reset}\n`);
        warnings.forEach((warn, i) => {
            console.log(`${i + 1}. ${warn.message}`);
            if (warn.details) console.log(`   → ${warn.details}`);
        });
        console.log('');
    }

    console.log(`${colors.yellow}⚠️  Configuration incomplète. Corriger les erreurs ci-dessus.${colors.reset}\n`);

    if (errors.length > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}
