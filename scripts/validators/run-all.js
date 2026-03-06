#!/usr/bin/env node
/**
 * @file /scripts/validators/run-all.js
 * @description Orchestrateur des validateurs TripSalama
 *
 * Usage:
 *   node scripts/validators/run-all.js [options]
 *
 * Options:
 *   --pre-commit   Mode pre-commit (rapide)
 *   --pre-push     Mode pre-push (complet avec tests)
 *   --staged       Analyser uniquement les fichiers git staged
 *   --fix          Proposer les corrections
 *   --strict       Bloquer meme sur les warnings
 *
 * @version 1.0.0
 * @date 2026-03
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const VALIDATORS_DIR = __dirname;

// Couleurs console
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
};

// Options CLI
const argv = process.argv.slice(2);
const options = {
    preCommit: argv.includes('--pre-commit'),
    prePush: argv.includes('--pre-push'),
    staged: argv.includes('--staged'),
    fix: argv.includes('--fix'),
    strict: argv.includes('--strict'),
};

/**
 * Log avec couleurs
 */
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Execute un validateur et retourne le resultat
 */
async function runValidator(name, script, args = []) {
    return new Promise((resolve) => {
        if (!fs.existsSync(script)) {
            resolve({
                name,
                success: true,
                skipped: true,
                duration: 0,
            });
            return;
        }

        const startTime = Date.now();

        const child = spawn('node', [script, ...args], {
            cwd: PROJECT_ROOT,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            const duration = Date.now() - startTime;
            resolve({
                name,
                success: code === 0,
                code,
                stdout,
                stderr,
                duration,
                skipped: false,
            });
        });

        child.on('error', (err) => {
            resolve({
                name,
                success: false,
                code: 1,
                stdout: '',
                stderr: err.message,
                duration: Date.now() - startTime,
                skipped: false,
            });
        });
    });
}

/**
 * Validateurs a executer
 */
const VALIDATORS = {
    preCommit: [
        { name: 'i18n-sync', script: 'i18n-sync-validator.js' },
        { name: 'secrets', script: 'secret-scanner.js' },
        { name: 'mvc', script: 'mvc-validator.js' },
        { name: 'paths', script: 'path-validator.js' },
    ],
    prePush: [
        { name: 'playwright-smoke', script: 'playwright-smoke-validator.js' },
    ]
};

/**
 * Main
 */
async function main() {
    const startTime = Date.now();
    const results = [];
    let hasErrors = false;

    log('');
    log('+===================================================================', 'cyan');
    log('|          TRIPSALAMA - VALIDATEURS v1.0                          ', 'cyan');
    log('+===================================================================', 'cyan');
    log('');

    // Determiner quels validateurs executer
    const validatorsToRun = [];

    if (options.preCommit || (!options.preCommit && !options.prePush)) {
        validatorsToRun.push(...VALIDATORS.preCommit);
    }

    if (options.prePush) {
        validatorsToRun.push(...VALIDATORS.prePush);
    }

    // Executer les validateurs
    for (const validator of validatorsToRun) {
        const script = path.join(VALIDATORS_DIR, validator.script);
        const args = options.staged ? ['--staged'] : [];

        log(`  [${validator.name}] `, 'blue');

        const result = await runValidator(validator.name, script, args);
        results.push(result);

        if (result.skipped) {
            log(`    ${colors.dim}skipped (fichier non trouve)${colors.reset}`);
        } else if (result.success) {
            log(`    ${colors.green}OK${colors.reset} (${result.duration}ms)`);
        } else {
            log(`    ${colors.red}ERREUR${colors.reset}`);
            if (result.stderr) {
                console.log(result.stderr);
            }
            hasErrors = true;
        }
    }

    // Resume
    const totalDuration = Date.now() - startTime;
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;

    log('');
    log(`Resultat: ${passed} OK, ${failed} erreurs, ${skipped} skipped (${totalDuration}ms)`, hasErrors ? 'red' : 'green');
    log('');

    if (hasErrors) {
        log('+===================================================================', 'red');
        log('|  VALIDATIONS ECHOUEES                                           ', 'red');
        log('+===================================================================', 'red');
        process.exit(1);
    }

    log('+===================================================================', 'green');
    log('|  TOUTES LES VALIDATIONS PASSENT                                  ', 'green');
    log('+===================================================================', 'green');
    log('');
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
