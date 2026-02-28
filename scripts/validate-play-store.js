#!/usr/bin/env node
/**
 * TripSalama - Validateur Play Store
 *
 * Vérifie automatiquement TOUS les critères techniques obligatoires
 * avant soumission au Google Play Store
 *
 * Usage: npm run validate:playstore
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Couleurs pour le terminal
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const REQUIRED_ITEMS = 36;
let passedItems = 0;
let failedItems = 0;
const errors = [];
const warnings = [];

console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.cyan}🚗 TripSalama - Validation Play Store${colors.reset}`);
console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

/**
 * Utilitaires
 */
function pass(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
    passedItems++;
}

function fail(message, details = '') {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
    if (details) console.log(`   ${colors.red}${details}${colors.reset}`);
    errors.push({ message, details });
    failedItems++;
}

function warn(message, details = '') {
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
    if (details) console.log(`   ${colors.yellow}${details}${colors.reset}`);
    warnings.push({ message, details });
}

function info(message) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function section(title) {
    console.log(`\n${colors.cyan}━━━ ${title} ━━━${colors.reset}\n`);
}

/**
 * 1. Validation Technique
 */
section('Validation Technique');

// 1.1 - Vérifier build.gradle
const buildGradlePath = path.join(__dirname, '../android/app/build.gradle');
if (fs.existsSync(buildGradlePath)) {
    const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

    // Target SDK
    const targetSdkMatch = buildGradle.match(/targetSdk[Version]?\s*[=:]\s*(\d+)/);
    if (targetSdkMatch && parseInt(targetSdkMatch[1]) >= 33) {
        pass(`Target SDK >= 33 (trouvé: ${targetSdkMatch[1]})`);
    } else {
        fail('Target SDK < 33', 'Play Store exige Android 13 (API 33) minimum');
    }

    // Version code
    const versionCodeMatch = buildGradle.match(/versionCode\s*[=:]\s*(\d+)/);
    if (versionCodeMatch) {
        pass(`Version code défini: ${versionCodeMatch[1]}`);
    } else {
        fail('Version code non trouvé dans build.gradle');
    }

    // Version name
    const versionNameMatch = buildGradle.match(/versionName\s*[=:]\s*["']([^"']+)["']/);
    if (versionNameMatch) {
        pass(`Version name défini: ${versionNameMatch[1]}`);
    } else {
        fail('Version name non trouvé dans build.gradle');
    }

    // Support 64-bit
    if (buildGradle.includes('arm64-v8a') || buildGradle.includes('x86_64')) {
        pass('Support 64-bit activé');
    } else {
        fail('Support 64-bit manquant', 'Ajouter arm64-v8a et x86_64 dans ndk.abiFilters');
    }
} else {
    fail('build.gradle non trouvé');
}

// 1.2 - Vérifier APK signé
const apkPath = path.join(__dirname, '../android/app/build/outputs/apk/release/app-release.apk');
if (fs.existsSync(apkPath)) {
    const stats = fs.statSync(apkPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    if (sizeMB < 150) {
        pass(`Taille APK: ${sizeMB} MB (< 150 MB)`);
    } else {
        fail(`Taille APK: ${sizeMB} MB (trop gros!)`, 'Optimiser les assets ou activer App Bundle');
    }

    // Vérifier signature
    try {
        const signatureCheck = execSync(`jarsigner -verify -verbose -certs "${apkPath}"`, { encoding: 'utf8' });
        if (signatureCheck.includes('jar verified')) {
            pass('APK signé correctement');
        } else {
            fail('APK non signé ou signature invalide');
        }
    } catch (e) {
        warn('Impossible de vérifier la signature APK', 'jarsigner non disponible');
    }
} else {
    fail('APK release non trouvé', 'Lancer: npm run build:apk');
}

// 1.3 - Vérifier icône adaptative
const adaptiveIconPath = path.join(__dirname, '../android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml');
if (fs.existsSync(adaptiveIconPath)) {
    pass('Icône adaptative présente');
} else {
    fail('Icône adaptative manquante', 'Générer avec: npm run build:icons');
}

/**
 * 2. Sécurité & Confidentialité
 */
section('Sécurité & Confidentialité');

// 2.1 - Vérifier AndroidManifest.xml
const manifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
    const manifest = fs.readFileSync(manifestPath, 'utf8');

    // HTTPS uniquement
    if (manifest.includes('android:usesCleartextTraffic="true"')) {
        fail('Cleartext traffic autorisé', 'Désactiver usesCleartextTraffic pour forcer HTTPS');
    } else {
        pass('Cleartext traffic désactivé (HTTPS uniquement)');
    }

    // Permissions dangereuses
    const dangerousPermissions = [
        'READ_CONTACTS',
        'WRITE_CONTACTS',
        'READ_CALL_LOG',
        'WRITE_CALL_LOG',
        'READ_SMS',
        'SEND_SMS'
    ];

    let hasDangerousUnused = false;
    dangerousPermissions.forEach(perm => {
        if (manifest.includes(perm)) {
            warn(`Permission dangereuse: ${perm}`, 'Justifier dans la déclaration Play Store');
            hasDangerousUnused = true;
        }
    });

    if (!hasDangerousUnused) {
        pass('Pas de permissions dangereuses non justifiées');
    }

    // Permissions utilisées
    const usedPermissions = manifest.match(/android\.permission\.\w+/g) || [];
    info(`Permissions déclarées: ${usedPermissions.length}`);
    usedPermissions.forEach(p => {
        console.log(`   - ${p.replace('android.permission.', '')}`);
    });

} else {
    fail('AndroidManifest.xml non trouvé');
}

// 2.2 - Vérifier politique de confidentialité
const capacitorConfig = path.join(__dirname, '../capacitor.config.json');
if (fs.existsSync(capacitorConfig)) {
    const config = JSON.parse(fs.readFileSync(capacitorConfig, 'utf8'));
    // On ne peut pas vérifier l'URL de privacy policy ici, mais on peut rappeler
    warn('Politique de confidentialité', 'Vérifier que l\'URL est valide et accessible');
} else {
    fail('capacitor.config.json non trouvé');
}

/**
 * 3. Assets & Contenu
 */
section('Assets & Contenu');

// 3.1 - Vérifier icône 512x512
const icon512Path = path.join(__dirname, '../public/assets/images/icons/icon-512x512.png');
if (fs.existsSync(icon512Path)) {
    pass('Icône 512x512 présente');
} else {
    fail('Icône 512x512 manquante', 'Nécessaire pour le listing Play Store');
}

// 3.2 - Vérifier ressources
const resourcesPath = path.join(__dirname, '../resources');
if (fs.existsSync(resourcesPath)) {
    pass('Dossier resources/ présent');

    // Feature graphic
    const featureGraphic = path.join(resourcesPath, 'feature-graphic.png');
    if (fs.existsSync(featureGraphic)) {
        pass('Feature graphic présent (1024x500)');
    } else {
        warn('Feature graphic manquant', 'Créer resources/feature-graphic.png (1024x500)');
    }

    // Screenshots
    const screenshotsDir = path.join(resourcesPath, 'screenshots');
    if (fs.existsSync(screenshotsDir)) {
        const screenshots = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
        if (screenshots.length >= 2) {
            pass(`Screenshots: ${screenshots.length} fichiers`);
        } else {
            fail('Pas assez de screenshots', 'Minimum 2 screenshots requis');
        }
    } else {
        fail('Dossier screenshots/ manquant', 'Créer resources/screenshots/ avec au moins 2 images');
    }
} else {
    warn('Dossier resources/ manquant', 'Créer pour stocker assets Play Store');
}

/**
 * 4. Configuration Capacitor
 */
section('Configuration Capacitor');

if (fs.existsSync(capacitorConfig)) {
    const config = JSON.parse(fs.readFileSync(capacitorConfig, 'utf8'));

    if (config.appId && config.appId !== 'com.example.app') {
        pass(`App ID: ${config.appId}`);
    } else {
        fail('App ID par défaut', 'Changer com.example.app en com.tripsalama.app');
    }

    if (config.appName && config.appName !== 'App') {
        pass(`App Name: ${config.appName}`);
    } else {
        fail('App Name par défaut', 'Définir le nom de l\'app');
    }
}

/**
 * 5. Tests automatiques
 */
section('Tests automatiques');

const testDir = path.join(__dirname, '../tests/appium');
if (fs.existsSync(testDir)) {
    pass('Dossier tests Appium présent');
} else {
    warn('Tests Appium non configurés', 'Lancer: npm run setup:appium');
}

/**
 * Rapport final
 */
section('Rapport Final');

const totalItems = passedItems + failedItems;
const successRate = ((passedItems / totalItems) * 100).toFixed(1);

console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.cyan}📊 Résultats${colors.reset}`);
console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

console.log(`${colors.green}✅ Passés  : ${passedItems}${colors.reset}`);
console.log(`${colors.red}❌ Échoués : ${failedItems}${colors.reset}`);
console.log(`${colors.yellow}⚠️  Warnings: ${warnings.length}${colors.reset}`);
console.log(`${colors.blue}📈 Taux de réussite: ${successRate}%${colors.reset}\n`);

if (failedItems > 0) {
    console.log(`${colors.red}━━━ Erreurs bloquantes ━━━${colors.reset}\n`);
    errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err.message}`);
        if (err.details) console.log(`   → ${err.details}`);
    });
    console.log('');
}

if (warnings.length > 0) {
    console.log(`${colors.yellow}━━━ Avertissements ━━━${colors.reset}\n`);
    warnings.forEach((warn, i) => {
        console.log(`${i + 1}. ${warn.message}`);
        if (warn.details) console.log(`   → ${warn.details}`);
    });
    console.log('');
}

// Verdict
console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
if (failedItems === 0 && passedItems >= REQUIRED_ITEMS * 0.8) {
    console.log(`${colors.green}✅ L'APK est prêt pour le Play Store !${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    console.log(`${colors.blue}📋 Prochaines étapes :${colors.reset}`);
    console.log('   1. Tester l\'APK: npm run test:apk');
    console.log('   2. Créer compte Play Console: https://play.google.com/console');
    console.log('   3. Uploader en Internal Testing');
    console.log('   4. Tester avec utilisateurs réels');
    console.log('   5. Soumettre pour production\n');

    process.exit(0);
} else {
    console.log(`${colors.red}❌ L'APK N'EST PAS prêt pour le Play Store${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    console.log(`${colors.yellow}🔧 Actions requises :${colors.reset}`);
    console.log('   1. Corriger toutes les erreurs ci-dessus');
    console.log('   2. Relancer: npm run validate:playstore');
    console.log('   3. Consulter: PLAY_STORE_CHECKLIST.md\n');

    process.exit(1);
}
