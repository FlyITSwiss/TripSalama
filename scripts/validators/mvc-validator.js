#!/usr/bin/env node
/**
 * @file /scripts/validators/mvc-validator.js
 * @description Valide l'architecture MVC stricte
 *
 * BLOQUANT si detecte:
 * - SQL direct dans Controllers (doit etre dans Models)
 * - SQL dans Views
 * - Instanciation de Services dans Views
 * - Logique metier dans Views
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
        // Extraire uniquement les lignes ajoutees
        return output.split('\n')
            .filter(line => line.startsWith('+') && !line.startsWith('+++'))
            .join('\n');
    } catch (e) {
        return '';
    }
}

/**
 * Patterns SQL a detecter
 */
const SQL_PATTERNS = [
    /->query\s*\(/gi,
    /->prepare\s*\(/gi,
    /->execute\s*\(/gi,
    /\bSELECT\s+.+\s+FROM\s+/gi,
    /\bINSERT\s+INTO\s+/gi,
    /\bUPDATE\s+.+\s+SET\s+/gi,
    /\bDELETE\s+FROM\s+/gi,
];

/**
 * Patterns de Services
 */
const SERVICE_PATTERNS = [
    /new\s+\w+Service\s*\(/gi,
    /new\s+\w+Controller\s*\(/gi,
    /\$this->service\s*\(/gi,
];

/**
 * Verifie un Controller
 */
function checkController(filepath, diff) {
    let fileErrors = 0;

    // Detecter SQL direct
    SQL_PATTERNS.forEach(pattern => {
        if (pattern.test(diff)) {
            console.log(`${RED}  MVC VIOLATION: ${filepath}${RESET}`);
            console.log(`    SQL direct dans Controller - utiliser le Model`);
            fileErrors++;
        }
    });

    return fileErrors;
}

/**
 * Verifie une View
 */
function checkView(filepath, diff) {
    let fileErrors = 0;

    // Detecter SQL
    SQL_PATTERNS.forEach(pattern => {
        if (pattern.test(diff)) {
            console.log(`${RED}  MVC VIOLATION: ${filepath}${RESET}`);
            console.log(`    SQL dans View - passer les donnees depuis le Controller`);
            fileErrors++;
        }
    });

    // Detecter instanciation de Services
    SERVICE_PATTERNS.forEach(pattern => {
        if (pattern.test(diff)) {
            console.log(`${RED}  MVC VIOLATION: ${filepath}${RESET}`);
            console.log(`    Service/Controller dans View - passer les donnees depuis le Controller`);
            fileErrors++;
        }
    });

    // Detecter logique metier complexe
    const complexPatterns = [
        /foreach\s*\([^)]+->query/gi,
        /while\s*\([^)]+fetch/gi,
    ];

    complexPatterns.forEach(pattern => {
        if (pattern.test(diff)) {
            console.log(`${YELLOW}  WARNING: ${filepath}${RESET}`);
            console.log(`    Logique metier complexe dans View - deplacer vers Controller/Service`);
            warnings++;
        }
    });

    return fileErrors;
}

/**
 * Main
 */
function main() {
    console.log('\nMVC Validator');
    console.log('=============\n');

    const stagedFiles = getStagedFiles();
    const phpFiles = stagedFiles.filter(f => f.endsWith('.php') || f.endsWith('.phtml'));

    if (phpFiles.length === 0) {
        console.log('  Aucun fichier PHP staged');
        process.exit(0);
    }

    console.log(`  Analyse de ${phpFiles.length} fichier(s) PHP...\n`);

    phpFiles.forEach(file => {
        const diff = getFileDiff(file);

        if (diff.length === 0) {
            return;
        }

        // Classifier le fichier
        if (file.includes('/Controllers/') || file.includes('Controller.php')) {
            errors += checkController(file, diff);
        } else if (file.includes('/Views/') || file.endsWith('.phtml')) {
            errors += checkView(file, diff);
        }
    });

    console.log('');

    if (errors > 0) {
        console.log(`${RED}MVC VIOLATIONS: ${errors}${RESET}`);
        process.exit(1);
    }

    if (warnings > 0) {
        console.log(`${YELLOW}WARNINGS: ${warnings}${RESET}`);
    }

    console.log(`${GREEN}Architecture MVC OK${RESET}`);
    process.exit(0);
}

main();
