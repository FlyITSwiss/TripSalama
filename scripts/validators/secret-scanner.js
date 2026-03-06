#!/usr/bin/env node
/**
 * @file /scripts/validators/secret-scanner.js
 * @description Detecte les secrets/credentials potentiellement commites
 *
 * BLOQUANT si detecte:
 * - Mots de passe hardcodes
 * - Cles API en clair
 * - Tokens d'authentification
 * - Fichiers .env (sauf .env.example)
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Couleurs
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Patterns de secrets a detecter
const SECRET_PATTERNS = [
    { name: 'Password hardcode', regex: /password\s*[:=]\s*['"][^'"]{8,}['"]/gi },
    { name: 'API Key', regex: /api_?key\s*[:=]\s*['"][a-zA-Z0-9_-]{16,}['"]/gi },
    { name: 'Secret Key', regex: /secret_?key?\s*[:=]\s*['"][^'"]+['"]/gi },
    { name: 'Auth Token', regex: /auth_?token\s*[:=]\s*['"][^'"]+['"]/gi },
    { name: 'Twilio SID', regex: /TWILIO_ACCOUNT_SID\s*[:=]\s*['"]AC[a-zA-Z0-9]+['"]/gi },
    { name: 'Twilio Token', regex: /TWILIO_AUTH_TOKEN\s*[:=]\s*['"][a-zA-Z0-9]+['"]/gi },
    { name: 'Stripe Key', regex: /sk_(live|test)_[a-zA-Z0-9]+/gi },
    { name: 'Private Key', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/gi },
    { name: 'AWS Key', regex: /AKIA[0-9A-Z]{16}/g },
    { name: 'JWT Secret', regex: /jwt_?secret\s*[:=]\s*['"][^'"]+['"]/gi },
];

// Fichiers/patterns a ignorer
const IGNORE_PATTERNS = [
    /\.env\.example$/,
    /\.env\.sample$/,
    /tests?\//,
    /node_modules\//,
    /vendor\//,
    /\.md$/,
    /README/,
    /CHANGELOG/,
];

let errors = 0;
let warnings = 0;

/**
 * Obtenir les fichiers staged
 */
function getStagedFiles() {
    try {
        const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
            cwd: PROJECT_ROOT,
            encoding: 'utf8'
        });
        return output.trim().split('\n').filter(f => f.length > 0);
    } catch (e) {
        return [];
    }
}

/**
 * Verifie si un fichier doit etre ignore
 */
function shouldIgnore(filepath) {
    return IGNORE_PATTERNS.some(pattern => pattern.test(filepath));
}

/**
 * Scan un fichier pour les secrets
 */
function scanFile(filepath) {
    const fullPath = path.join(PROJECT_ROOT, filepath);

    if (!fs.existsSync(fullPath)) {
        return;
    }

    // Ignorer les fichiers binaires
    const ext = path.extname(filepath).toLowerCase();
    const textExtensions = ['.php', '.phtml', '.js', '.ts', '.json', '.yml', '.yaml', '.sh', '.env', '.conf', '.ini'];
    if (!textExtensions.includes(ext) && ext !== '') {
        return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    // Verifier chaque pattern
    SECRET_PATTERNS.forEach(({ name, regex }) => {
        const matches = content.match(regex);
        if (matches && matches.length > 0) {
            // Ignorer si c'est une reference a variable d'environnement
            const filtered = matches.filter(m => {
                return !m.includes('process.env') &&
                       !m.includes('$_ENV') &&
                       !m.includes('getenv(') &&
                       !m.includes('config(') &&
                       !m.includes('env(');
            });

            if (filtered.length > 0) {
                console.log(`${RED}  ERREUR: ${filepath}${RESET}`);
                console.log(`    ${name} detecte: ${filtered[0].substring(0, 50)}...`);
                errors++;
            }
        }
    });
}

/**
 * Verifie les fichiers .env
 */
function checkEnvFiles(files) {
    const envFiles = files.filter(f => f.match(/^\.env$/) || f.match(/\.env\.[^e]/));

    envFiles.forEach(file => {
        if (!file.includes('.example') && !file.includes('.sample')) {
            console.log(`${RED}  ERREUR: ${file} ne doit JAMAIS etre commite!${RESET}`);
            console.log('    Ajouter au .gitignore');
            errors++;
        }
    });
}

/**
 * Main
 */
function main() {
    console.log('\nSecret Scanner');
    console.log('==============\n');

    const stagedFiles = getStagedFiles();

    if (stagedFiles.length === 0) {
        console.log('  Aucun fichier staged');
        process.exit(0);
    }

    console.log(`  Scan de ${stagedFiles.length} fichier(s)...\n`);

    // Verifier les fichiers .env
    checkEnvFiles(stagedFiles);

    // Scanner chaque fichier
    stagedFiles.forEach(file => {
        if (!shouldIgnore(file)) {
            scanFile(file);
        }
    });

    console.log('');

    if (errors > 0) {
        console.log(`${RED}SECRETS DETECTES: ${errors}${RESET}`);
        console.log(`${YELLOW}Utiliser des variables d'environnement a la place${RESET}`);
        process.exit(1);
    }

    console.log(`${GREEN}Aucun secret detecte${RESET}`);
    process.exit(0);
}

main();
