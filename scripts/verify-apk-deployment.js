#!/usr/bin/env node
/**
 * TripSalama - Vérification Déploiement APK
 *
 * Vérifie que l'APK est bien accessible après un build
 * À lancer automatiquement après chaque déploiement
 *
 * Usage: node scripts/verify-apk-deployment.js [version]
 */

const https = require('https');

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

const version = process.argv[2] || 'latest';
const apkUrl = `https://stabilis-it.ch/internal/tripsalama/downloads/TripSalama-${version}.apk`;
const diagnosticUrl = 'https://stabilis-it.ch/internal/tripsalama/api/check-downloads.php';

console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.cyan}📦 Vérification Déploiement APK${colors.reset}`);
console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

let errors = [];
let warnings = [];

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

function httpRequest(url, method = 'HEAD') {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { method }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        req.end();
    });
}

async function verifyApkAccess() {
    console.log(`\n${colors.cyan}━━━ Test 1: Accès APK ━━━${colors.reset}\n`);

    info(`URL: ${apkUrl}`);

    try {
        const response = await httpRequest(apkUrl, 'HEAD');

        if (response.statusCode === 200) {
            pass('APK accessible (HTTP 200)');

            // Vérifier MIME type
            const contentType = response.headers['content-type'];
            if (contentType && contentType.includes('application/vnd.android.package-archive')) {
                pass(`MIME type correct: ${contentType}`);
            } else {
                warn(`MIME type incorrect: ${contentType}`, 'Devrait être application/vnd.android.package-archive');
            }

            // Vérifier Content-Disposition
            const disposition = response.headers['content-disposition'];
            if (disposition && disposition.includes('attachment')) {
                pass('Header Content-Disposition: attachment présent');
            } else {
                warn('Content-Disposition manquant', 'L\'APK pourrait ne pas se télécharger correctement');
            }

            // Vérifier taille
            const contentLength = response.headers['content-length'];
            if (contentLength) {
                const sizeMB = (parseInt(contentLength) / 1024 / 1024).toFixed(2);
                if (sizeMB > 0 && sizeMB < 150) {
                    pass(`Taille APK: ${sizeMB} MB (valide)`);
                } else if (sizeMB >= 150) {
                    fail(`Taille APK: ${sizeMB} MB (> 150 MB max Play Store)`);
                } else {
                    fail(`Taille APK invalide: ${sizeMB} MB`);
                }
            } else {
                warn('Content-Length manquant', 'Impossible de vérifier la taille');
            }

        } else if (response.statusCode === 403) {
            fail('APK inaccessible (HTTP 403 Forbidden)', 'Vérifier permissions fichier et config nginx');
        } else if (response.statusCode === 404) {
            fail('APK introuvable (HTTP 404)', 'Le fichier n\'existe pas sur le VPS');
        } else {
            fail(`HTTP ${response.statusCode}`, 'Code de statut inattendu');
        }

    } catch (error) {
        fail('Erreur réseau', error.message);
    }
}

async function verifyDiagnostics() {
    console.log(`\n${colors.cyan}━━━ Test 2: Diagnostics Serveur ━━━${colors.reset}\n`);

    info(`URL: ${diagnosticUrl}`);

    try {
        const response = await httpRequest(diagnosticUrl, 'GET');

        if (response.statusCode === 200 && response.body) {
            const data = JSON.parse(response.body);

            pass('Endpoint diagnostic accessible');

            if (data.exists && data.is_dir) {
                pass(`Dossier downloads existe: ${data.downloads_dir}`);
            } else {
                fail('Dossier downloads inexistant', 'Créer /var/www/tripsalama/public/downloads/');
            }

            if (data.is_readable) {
                pass(`Dossier readable (permissions: ${data.permissions})`);
            } else {
                fail('Dossier non readable', 'Vérifier permissions: sudo chmod 755 downloads/');
            }

            if (data.files && Object.keys(data.files).length > 0) {
                pass(`${Object.keys(data.files).length} fichier(s) APK trouvé(s)`);

                Object.entries(data.files).forEach(([filename, fileInfo]) => {
                    info(`  📱 ${filename}: ${fileInfo.size_mb} MB (${fileInfo.permissions}) - ${fileInfo.modified}`);

                    if (!fileInfo.is_readable) {
                        warn(`  ${filename} non readable`, 'sudo chmod 644 downloads/' + filename);
                    }
                });
            } else {
                warn('Aucun fichier APK trouvé', 'Le dossier est vide');
            }

        } else if (response.statusCode === 404) {
            warn('Endpoint diagnostic non déployé', 'Deployer public/api/check-downloads.php');
        } else {
            warn(`Diagnostic retourne HTTP ${response.statusCode}`);
        }

    } catch (error) {
        warn('Diagnostic inaccessible', error.message);
    }
}

async function verifyNginxConfig() {
    console.log(`\n${colors.cyan}━━━ Test 3: Config Nginx ━━━${colors.reset}\n`);

    // Test que la location /downloads/ est bien prioritaire
    const testUrls = [
        'https://stabilis-it.ch/internal/tripsalama/downloads/',
        'https://stabilis-it.ch/internal/tripsalama/api/check-downloads.php'
    ];

    for (const url of testUrls) {
        try {
            const response = await httpRequest(url, 'HEAD');
            if (response.statusCode === 403) {
                pass(`${url.split('/').pop()} - 403 (normal, autoindex off)`);
            } else if (response.statusCode === 200) {
                pass(`${url.split('/').pop()} - accessible`);
            } else {
                warn(`${url.split('/').pop()} - HTTP ${response.statusCode}`);
            }
        } catch (e) {
            warn(`${url.split('/').pop()} - ${e.message}`);
        }
    }
}

async function run() {
    await verifyApkAccess();
    await verifyDiagnostics();
    await verifyNginxConfig();

    // Rapport final
    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}📊 Résumé${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    if (errors.length > 0) {
        console.log(`${colors.red}❌ ERREURS (${errors.length})${colors.reset}\n`);
        errors.forEach((err, i) => {
            console.log(`${i + 1}. ${err.message}`);
            if (err.details) console.log(`   → ${err.details}`);
        });
        console.log('');
    }

    if (warnings.length > 0) {
        console.log(`${colors.yellow}⚠️  WARNINGS (${warnings.length})${colors.reset}\n`);
        warnings.forEach((warn, i) => {
            console.log(`${i + 1}. ${warn.message}`);
            if (warn.details) console.log(`   → ${warn.details}`);
        });
        console.log('');
    }

    if (errors.length === 0) {
        console.log(`${colors.green}✅ L'APK est correctement déployé et accessible !${colors.reset}\n`);
        console.log(`${colors.cyan}📱 Télécharger: ${apkUrl}${colors.reset}\n`);
        process.exit(0);
    } else {
        console.log(`${colors.red}❌ Le déploiement APK a des problèmes${colors.reset}\n`);
        console.log(`${colors.yellow}🔧 Actions recommandées:${colors.reset}`);
        console.log('   1. Vérifier que le fichier existe sur le VPS');
        console.log('   2. Vérifier permissions: sudo chown www-data:www-data downloads/*.apk');
        console.log('   3. Vérifier nginx: sudo nginx -t && sudo systemctl reload nginx');
        console.log('   4. Consulter les logs: cat /var/log/nginx/tripsalama-apk-error.log\n');
        process.exit(1);
    }
}

run().catch(err => {
    console.error(`\n${colors.red}❌ Erreur fatale: ${err.message}${colors.reset}\n`);
    process.exit(1);
});
