/**
 * TripSalama - Exécuteur de tous les tests Puppeteer
 */

const { spawn } = require('child_process');
const path = require('path');

const tests = [
    { name: 'Authentication', file: 'test-auth.js' },
    { name: 'Booking Flow', file: 'test-booking-flow.js' },
    { name: 'Driver Dashboard', file: 'test-driver-dashboard.js' },
    { name: 'Ride Tracking', file: 'test-ride-tracking.js' },
    { name: 'Safety Features', file: 'test-safety-features.js' },
    { name: 'Encoding & i18n', file: 'test-encoding-i18n.js' }
];

async function runTest(testFile) {
    return new Promise((resolve) => {
        const testPath = path.join(__dirname, testFile);
        const process = spawn('node', [testPath], {
            stdio: 'inherit',
            shell: true
        });

        process.on('close', (code) => {
            resolve(code === 0);
        });

        process.on('error', (err) => {
            console.error(`Error running ${testFile}:`, err);
            resolve(false);
        });
    });
}

async function runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 TripSalama - Suite de Tests E2E Complète');
    console.log('='.repeat(60) + '\n');

    const startTime = Date.now();
    const results = [];

    for (const test of tests) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`▶ ${test.name}`);
        console.log('─'.repeat(60));

        const passed = await runTest(test.file);
        results.push({ name: test.name, passed });

        if (!passed) {
            console.log(`\n⚠ ${test.name} - ÉCHEC`);
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ FINAL');
    console.log('='.repeat(60));

    results.forEach(r => {
        const icon = r.passed ? '✅' : '❌';
        console.log(`${icon} ${r.name}`);
    });

    console.log('\n' + '─'.repeat(60));
    console.log(`Total: ${tests.length} suites`);
    console.log(`\x1b[32mRéussi: ${passedCount}\x1b[0m`);
    if (failedCount > 0) {
        console.log(`\x1b[31mÉchoué: ${failedCount}\x1b[0m`);
    }
    console.log(`Durée: ${totalTime}s`);
    console.log('='.repeat(60) + '\n');

    process.exit(failedCount > 0 ? 1 : 0);
}

// Mode interactif
const args = process.argv.slice(2);

if (args.includes('--help')) {
    console.log(`
TripSalama - Tests Puppeteer E2E

Usage:
  node run-all.js            Executer tous les tests
  node run-all.js --auth     Tests authentification
  node run-all.js --booking  Tests booking flow
  node run-all.js --driver   Tests driver dashboard
  node run-all.js --tracking Tests ride tracking
  node run-all.js --safety   Tests securite (SOS, checklist, PIN)
  node run-all.js --encoding Tests encoding et i18n
  node run-all.js --prod     Tests production complets
  node run-all.js --help     Afficher cette aide
`);
    process.exit(0);
}

if (args.includes('--auth')) {
    runTest('test-auth.js').then(success => process.exit(success ? 0 : 1));
} else if (args.includes('--booking')) {
    runTest('test-booking-flow.js').then(success => process.exit(success ? 0 : 1));
} else if (args.includes('--driver')) {
    runTest('test-driver-dashboard.js').then(success => process.exit(success ? 0 : 1));
} else if (args.includes('--tracking')) {
    runTest('test-ride-tracking.js').then(success => process.exit(success ? 0 : 1));
} else if (args.includes('--safety')) {
    runTest('test-safety-features.js').then(success => process.exit(success ? 0 : 1));
} else if (args.includes('--encoding')) {
    runTest('test-encoding-i18n.js').then(success => process.exit(success ? 0 : 1));
} else if (args.includes('--prod')) {
    runTest('test-complete-prod.js').then(success => process.exit(success ? 0 : 1));
} else {
    runAllTests();
}
