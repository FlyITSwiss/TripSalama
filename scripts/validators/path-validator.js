#!/usr/bin/env node
/**
 * @file /scripts/validators/path-validator.js
 * @description Detecte les chemins hardcodes dans le code
 *
 * BLOQUANT si detecte:
 * - Chemins absolus hardcodes (/var/www/, C:\, etc.)
 * - URLs hardcodees sans base_url()
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

// Patterns de chemins hardcodes
const HARDCODED_PATHS = [
    { pattern: /\/var\/www\/tripsalama/gi, fix: 'PathHelper::getRootPath()' },
    { pattern: /\/home\/.*?\/tripsalama/gi, fix: 'PathHelper::getRootPath()' },
    { pattern: /C:\\\\.*?TripSalama/gi, fix: 'PathHelper::getRootPath()' },
    { pattern: /\/srv\/.*?tripsalama/gi, fix: 'PathHelper::getRootPath()' },
];

// Patterns d'URLs hardcodees
const HARDCODED_URLS = [
    { pattern: /href=["']\/(?!#)[a-z]/gi, fix: 'href="<?= base_url(...) ?>"' },
    { pattern: /action=["']\/[a-z]/gi, fix: 'action="<?= base_url(...) ?>"' },
    { pattern: /fetch\(["']\/api/gi, fix: 'fetch(AppConfig.apiUrl(...))' },
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
 * Obtenir le diff d'un fichier
 */
function getFileDiff(filepath) {
    try {
        const output = execSync(`git diff --cached "${filepath}"`, {
            cwd: PROJECT_ROOT,
            encoding: 'utf8'
        });
        return output.split('\n')
            .filter(line => line.startsWith('+') && !line.startsWith('+++'))
            .join('\n');
    } catch (e) {
        return '';
    }
}

/**
 * Fichiers a ignorer
 */
function shouldIgnore(filepath) {
    const ignorePatterns = [
        /config\//,
        /Helpers\//,
        /tests\//,
        /\.md$/,
        /package\.json$/,
        /composer\.json$/,
    ];

    return ignorePatterns.some(p => p.test(filepath));
}

/**
 * Main
 */
function main() {
    console.log('\nPath Validator');
    console.log('==============\n');

    const stagedFiles = getStagedFiles();
    const codeFiles = stagedFiles.filter(f =>
        (f.endsWith('.php') || f.endsWith('.phtml') || f.endsWith('.js')) &&
        !shouldIgnore(f)
    );

    if (codeFiles.length === 0) {
        console.log('  Aucun fichier de code staged');
        process.exit(0);
    }

    console.log(`  Analyse de ${codeFiles.length} fichier(s)...\n`);

    codeFiles.forEach(file => {
        const diff = getFileDiff(file);

        if (diff.length === 0) {
            return;
        }

        // Verifier chemins hardcodes
        HARDCODED_PATHS.forEach(({ pattern, fix }) => {
            if (pattern.test(diff)) {
                console.log(`${RED}  ERREUR: ${file}${RESET}`);
                console.log(`    Chemin hardcode - utiliser ${fix}`);
                errors++;
            }
        });

        // Verifier URLs hardcodees (warning seulement)
        HARDCODED_URLS.forEach(({ pattern, fix }) => {
            if (pattern.test(diff)) {
                console.log(`${YELLOW}  WARNING: ${file}${RESET}`);
                console.log(`    URL hardcodee - utiliser ${fix}`);
                warnings++;
            }
        });
    });

    console.log('');

    if (errors > 0) {
        console.log(`${RED}CHEMINS HARDCODES: ${errors}${RESET}`);
        process.exit(1);
    }

    if (warnings > 0) {
        console.log(`${YELLOW}WARNINGS: ${warnings}${RESET}`);
    }

    console.log(`${GREEN}Paths OK${RESET}`);
    process.exit(0);
}

main();
