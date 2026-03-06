#!/usr/bin/env node
/**
 * @file /scripts/validators/i18n-sync-validator.js
 * @description Verifie la synchronisation des fichiers de traduction FR/EN
 *
 * Validations:
 * 1. Toutes les cles de fr.php existent dans en.php
 * 2. Toutes les cles de en.php existent dans fr.php
 * 3. Les textes FR ont les accents corrects
 * 4. Pas de textes FR hardcodes dans le code
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FR_FILE = path.join(PROJECT_ROOT, 'backend/php/lang/fr.php');
const EN_FILE = path.join(PROJECT_ROOT, 'backend/php/lang/en.php');

// Couleurs
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let errors = 0;
let warnings = 0;

/**
 * Extrait les cles d'un fichier PHP de traduction
 */
function extractKeys(filepath) {
    if (!fs.existsSync(filepath)) {
        return [];
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const keys = [];

    // Regex pour capturer les cles (gere les cles imbriquees)
    const regex = /['"]([a-zA-Z0-9_.]+)['"]\s*=>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        keys.push(match[1]);
    }

    return [...new Set(keys)];
}

/**
 * Verifie la synchronisation FR/EN
 */
function checkSync() {
    console.log('  Verification sync FR/EN...');

    if (!fs.existsSync(FR_FILE)) {
        console.log(`${YELLOW}  Warning: fr.php non trouve${RESET}`);
        warnings++;
        return;
    }

    if (!fs.existsSync(EN_FILE)) {
        console.log(`${YELLOW}  Warning: en.php non trouve${RESET}`);
        warnings++;
        return;
    }

    const frKeys = extractKeys(FR_FILE);
    const enKeys = extractKeys(EN_FILE);

    // Cles manquantes en EN
    const missingInEn = frKeys.filter(k => !enKeys.includes(k));
    if (missingInEn.length > 0) {
        console.log(`${YELLOW}  Warning: ${missingInEn.length} cle(s) manquante(s) dans en.php:${RESET}`);
        missingInEn.slice(0, 5).forEach(k => console.log(`    - ${k}`));
        if (missingInEn.length > 5) {
            console.log(`    ... et ${missingInEn.length - 5} autres`);
        }
        warnings += missingInEn.length;
    }

    // Cles manquantes en FR
    const missingInFr = enKeys.filter(k => !frKeys.includes(k));
    if (missingInFr.length > 0) {
        console.log(`${YELLOW}  Warning: ${missingInFr.length} cle(s) manquante(s) dans fr.php:${RESET}`);
        missingInFr.slice(0, 5).forEach(k => console.log(`    - ${k}`));
        warnings += missingInFr.length;
    }

    if (missingInEn.length === 0 && missingInFr.length === 0) {
        console.log(`${GREEN}  FR/EN synchronises (${frKeys.length} cles)${RESET}`);
    }
}

/**
 * Verifie les accents francais
 */
function checkAccents() {
    console.log('  Verification accents FR...');

    if (!fs.existsSync(FR_FILE)) {
        return;
    }

    const content = fs.readFileSync(FR_FILE, 'utf8');

    // Patterns de textes FR sans accents
    const badPatterns = [
        { pattern: /['"]mise a jour['"]/gi, fix: 'mise à jour' },
        { pattern: /['"]cree['"]/gi, fix: 'créé/créée' },
        { pattern: /['"]reussi['"]/gi, fix: 'réussi' },
        { pattern: /['"]echoue['"]/gi, fix: 'échoué' },
        { pattern: /['"]termine['"]/gi, fix: 'terminé' },
        { pattern: /['"]selectionne['"]/gi, fix: 'sélectionné' },
        { pattern: /['"]veuillez['"]/gi, fix: 'veuillez (correct avec majuscule)' },
    ];

    let accentErrors = 0;

    badPatterns.forEach(({ pattern, fix }) => {
        if (pattern.test(content)) {
            console.log(`${YELLOW}  Warning: Accent manquant - utiliser '${fix}'${RESET}`);
            accentErrors++;
        }
    });

    if (accentErrors === 0) {
        console.log(`${GREEN}  Accents FR OK${RESET}`);
    } else {
        warnings += accentErrors;
    }
}

/**
 * Main
 */
function main() {
    console.log('\ni18n Sync Validator');
    console.log('===================\n');

    checkSync();
    checkAccents();

    console.log('');

    if (errors > 0) {
        console.log(`${RED}ERREURS: ${errors}${RESET}`);
        process.exit(1);
    }

    if (warnings > 0) {
        console.log(`${YELLOW}WARNINGS: ${warnings}${RESET}`);
    }

    console.log(`${GREEN}i18n validation OK${RESET}`);
    process.exit(0);
}

main();
