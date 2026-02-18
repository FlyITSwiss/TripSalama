/**
 * TripSalama - Vérification Setup Tests Identité
 *
 * Script de vérification avant exécution des tests de vérification d'identité
 */

const fs = require('fs');
const path = require('path');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(type, message) {
    const prefix = {
        pass: `${colors.green}✓${colors.reset}`,
        fail: `${colors.red}✗${colors.reset}`,
        warn: `${colors.yellow}⚠${colors.reset}`,
        info: `${colors.blue}ℹ${colors.reset}`
    };
    console.log(`${prefix[type]} ${message}`);
}

console.log('\n' + '='.repeat(60));
console.log(`${colors.blue}VÉRIFICATION SETUP - TESTS VÉRIFICATION D'IDENTITÉ${colors.reset}`);
console.log('='.repeat(60) + '\n');

let allOk = true;

// 1. Vérifier l'existence du fichier de test
log('info', 'Vérification fichier de test...');
const testFile = path.join(__dirname, 'test-identity-verification.js');
if (fs.existsSync(testFile)) {
    log('pass', 'test-identity-verification.js trouvé');
} else {
    log('fail', 'test-identity-verification.js MANQUANT');
    allOk = false;
}

// 2. Vérifier config.js
log('info', 'Vérification config.js...');
const configFile = path.join(__dirname, 'config.js');
if (fs.existsSync(configFile)) {
    log('pass', 'config.js trouvé');

    try {
        const config = require('./config');

        // Vérifier baseUrl
        if (config.baseUrl === 'http://127.0.0.1:8080') {
            log('pass', 'baseUrl correct: http://127.0.0.1:8080');
        } else if (config.baseUrl.includes('localhost')) {
            log('fail', `baseUrl utilise localhost (INTERDIT): ${config.baseUrl}`);
            log('warn', 'Doit être: http://127.0.0.1:8080');
            allOk = false;
        } else {
            log('warn', `baseUrl inhabituel: ${config.baseUrl}`);
        }

        // Vérifier mode headless
        if (config.puppeteer.headless === false) {
            log('pass', 'Mode visuel activé (headless: false)');
        } else {
            log('warn', 'Mode headless activé (attendu: false pour dev)');
        }

    } catch (error) {
        log('fail', `Erreur lors du chargement de config.js: ${error.message}`);
        allOk = false;
    }
} else {
    log('fail', 'config.js MANQUANT');
    allOk = false;
}

// 3. Vérifier helpers.js
log('info', 'Vérification helpers.js...');
const helpersFile = path.join(__dirname, 'helpers.js');
if (fs.existsSync(helpersFile)) {
    log('pass', 'helpers.js trouvé');
} else {
    log('fail', 'helpers.js MANQUANT');
    allOk = false;
}

// 4. Vérifier package.json
log('info', 'Vérification package.json...');
const packageFile = path.join(__dirname, 'package.json');
if (fs.existsSync(packageFile)) {
    log('pass', 'package.json trouvé');

    try {
        const pkg = require('./package.json');

        // Vérifier script npm
        if (pkg.scripts && pkg.scripts['test:identity']) {
            log('pass', 'Script npm "test:identity" configuré');
        } else {
            log('warn', 'Script npm "test:identity" non trouvé');
            log('info', 'Ajouter: "test:identity": "node test-identity-verification.js"');
        }

        // Vérifier dépendances
        if (pkg.dependencies && pkg.dependencies.puppeteer) {
            log('pass', `Puppeteer installé: ${pkg.dependencies.puppeteer}`);
        } else {
            log('fail', 'Puppeteer non installé');
            log('info', 'Exécuter: npm install puppeteer');
            allOk = false;
        }

    } catch (error) {
        log('fail', `Erreur lors du chargement de package.json: ${error.message}`);
        allOk = false;
    }
} else {
    log('fail', 'package.json MANQUANT');
    allOk = false;
}

// 5. Vérifier node_modules/puppeteer
log('info', 'Vérification installation Puppeteer...');
const puppeteerPath = path.join(__dirname, 'node_modules', 'puppeteer');
if (fs.existsSync(puppeteerPath)) {
    log('pass', 'Puppeteer installé dans node_modules');
} else {
    log('fail', 'Puppeteer NON installé');
    log('info', 'Exécuter: npm install');
    allOk = false;
}

// 6. Vérifier dossier screenshots
log('info', 'Vérification dossier screenshots...');
const screenshotsDir = path.join(__dirname, 'screenshots');
if (fs.existsSync(screenshotsDir)) {
    log('pass', 'Dossier screenshots/ existe');

    // Vérifier sous-dossier identity-verification
    const identityDir = path.join(screenshotsDir, 'identity-verification');
    if (!fs.existsSync(identityDir)) {
        log('warn', 'Sous-dossier identity-verification/ manquant (sera créé automatiquement)');
    } else {
        log('pass', 'Sous-dossier identity-verification/ existe');
    }
} else {
    log('warn', 'Dossier screenshots/ manquant (sera créé automatiquement)');
}

// 7. Vérifier les flags Chrome nécessaires
log('info', 'Vérification configuration caméra simulée...');
try {
    const testContent = fs.readFileSync(testFile, 'utf8');

    if (testContent.includes('--use-fake-ui-for-media-stream')) {
        log('pass', 'Flag --use-fake-ui-for-media-stream présent');
    } else {
        log('fail', 'Flag --use-fake-ui-for-media-stream MANQUANT');
        allOk = false;
    }

    if (testContent.includes('--use-fake-device-for-media-stream')) {
        log('pass', 'Flag --use-fake-device-for-media-stream présent');
    } else {
        log('fail', 'Flag --use-fake-device-for-media-stream MANQUANT');
        allOk = false;
    }

    if (testContent.includes('overridePermissions')) {
        log('pass', 'Permission caméra configurée');
    } else {
        log('warn', 'overridePermissions non détecté (peut causer des problèmes)');
    }

} catch (error) {
    log('fail', `Impossible de vérifier les flags: ${error.message}`);
}

// 8. Vérifier la documentation
log('info', 'Vérification documentation...');
const readmeFile = path.join(__dirname, 'README-IDENTITY-VERIFICATION.md');
if (fs.existsSync(readmeFile)) {
    log('pass', 'Documentation README-IDENTITY-VERIFICATION.md présente');
} else {
    log('warn', 'Documentation README-IDENTITY-VERIFICATION.md manquante');
}

// Résumé
console.log('\n' + '='.repeat(60));
if (allOk) {
    console.log(`${colors.green}✓ SETUP COMPLET - PRÊT À TESTER${colors.reset}`);
    console.log('\nCommandes disponibles:');
    console.log(`  ${colors.blue}npm run test:identity${colors.reset}    # Exécuter les tests`);
    console.log(`  ${colors.blue}node test-identity-verification.js${colors.reset}    # Exécution directe`);
} else {
    console.log(`${colors.red}✗ SETUP INCOMPLET - CORRIGER LES ERREURS${colors.reset}`);
    console.log('\nActions requises:');
    console.log(`  ${colors.yellow}1. Installer les dépendances: npm install${colors.reset}`);
    console.log(`  ${colors.yellow}2. Vérifier baseUrl dans config.js${colors.reset}`);
    console.log(`  ${colors.yellow}3. Corriger les erreurs ci-dessus${colors.reset}`);
}
console.log('='.repeat(60) + '\n');

process.exit(allOk ? 0 : 1);
