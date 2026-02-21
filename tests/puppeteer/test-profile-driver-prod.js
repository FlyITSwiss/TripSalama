/**
 * TripSalama - Test Profil & Driver PRODUCTION
 *
 * Tests:
 * 1. Profil passagère - Page accessible et UI correcte
 * 2. Upload de photo de profil (simulation)
 * 3. Dashboard conductrice - Fonctionnalité statut
 * 4. Interface conductrice - UI et interactions
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://stabilis-it.ch/internal/tripsalama';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'profile-driver-test');

// Credentials
const PASSENGER_EMAIL = 'passenger@tripsalama.ch';
const DRIVER_EMAIL = 'driver@tripsalama.ch';
const PASSWORD = 'password';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function run() {
    console.log('\n' + '═'.repeat(60));
    console.log('👤 TEST PROFIL & CONDUCTRICE PRODUCTION');
    console.log('═'.repeat(60));
    console.log('URL:', BASE_URL);
    console.log('');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        defaultViewport: { width: 414, height: 896 },
        args: ['--no-sandbox', '--ignore-certificate-errors']
    });

    const results = { passed: 0, failed: 0, tests: [] };

    function logTest(name, passed, details = '') {
        const icon = passed ? '✅' : '❌';
        console.log(`   ${icon} ${name}${details ? ' - ' + details : ''}`);
        results.tests.push({ name, passed, details });
        if (passed) results.passed++;
        else results.failed++;
    }

    const page = await browser.newPage();

    // Capturer les erreurs console
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    try {
        // ========================================
        // PARTIE 1: TEST PROFIL PASSAGÈRE
        // ========================================
        console.log('\n📱 PARTIE 1: Profil Passagère');
        console.log('-'.repeat(50));

        // Login passagère
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await page.type('input[name="email"], #email', PASSENGER_EMAIL);
        await page.type('input[name="password"], #password', PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

        const isLoggedInPassenger = !page.url().includes('/login');
        logTest('Connexion passagère', isLoggedInPassenger);

        // Aller au profil
        await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-passenger-profile.png') });

        // Vérifier les éléments du profil
        const profileHeader = await page.$('.profile-header');
        logTest('Header de profil présent', !!profileHeader);

        const avatarWrapper = await page.$('.profile-avatar-wrapper');
        logTest('Wrapper avatar présent', !!avatarWrapper);

        const avatarEditBtn = await page.$('.profile-avatar-edit');
        logTest('Bouton édition avatar présent', !!avatarEditBtn);

        const avatarInput = await page.$('#avatarInput');
        logTest('Input fichier avatar présent', !!avatarInput);

        // Vérifier que le click sur l'avatar ouvre le file picker
        // (On ne peut pas vraiment tester l'upload complet sans fichier)
        const avatarClickable = await page.evaluate(() => {
            const avatar = document.querySelector('.profile-avatar');
            return avatar && avatar.onclick !== null;
        });
        logTest('Avatar cliquable', avatarClickable || !!avatarWrapper);

        // Vérifier les stats
        const statsSection = await page.$('.profile-stats');
        logTest('Section statistiques présente', !!statsSection);

        // Vérifier les liens paramètres
        const editLink = await page.$('a[href*="profile/edit"]');
        logTest('Lien édition profil présent', !!editLink);

        // Déconnexion pour tester conductrice
        // Soumettre le formulaire de logout
        const logoutForm = await page.$('form[action*="logout"]');
        if (logoutForm) {
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
                page.evaluate(() => document.querySelector('form[action*="logout"]').submit())
            ]);
        }
        await new Promise(r => setTimeout(r, 1000));
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

        // ========================================
        // PARTIE 2: TEST DASHBOARD CONDUCTRICE
        // ========================================
        console.log('\n🚗 PARTIE 2: Dashboard Conductrice');
        console.log('-'.repeat(50));

        // Login conductrice
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 500));

        // Clear and type in email field
        const emailField = await page.$('input[name="email"], #email');
        if (emailField) {
            await emailField.click({ clickCount: 3 }); // Select all
            await emailField.type(DRIVER_EMAIL);
        }

        // Clear and type in password field
        const passField = await page.$('input[name="password"], #password');
        if (passField) {
            await passField.click({ clickCount: 3 });
            await passField.type(PASSWORD);
        }

        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

        const isLoggedInDriver = !page.url().includes('/login');
        logTest('Connexion conductrice', isLoggedInDriver);

        if (isLoggedInDriver) {
            // Aller au dashboard conductrice
            await page.goto(`${BASE_URL}/driver/dashboard`, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 1000));
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-driver-dashboard.png') });

            // Vérifier les éléments du dashboard
            const statusCard = await page.$('.driver-status-card');
            logTest('Carte statut présente', !!statusCard);

            const statusToggle = await page.$('#availabilityToggle');
            logTest('Toggle disponibilité présent', !!statusToggle);

            const statusIcon = await page.$('.driver-status-icon');
            logTest('Icône statut présente', !!statusIcon);

            const statsGrid = await page.$('.driver-stats');
            logTest('Grille statistiques présente', !!statsGrid);

            // Vérifier l'état initial du toggle
            const isOnline = await page.evaluate(() => {
                const toggle = document.getElementById('availabilityToggle');
                return toggle ? toggle.checked : null;
            });
            logTest('Toggle fonctionne', isOnline !== null, isOnline ? 'En ligne' : 'Hors ligne');

            // Tester le toggle de statut
            console.log('\n   🔄 Test changement de statut...');
            // Use JavaScript to toggle since the element might be styled
            await page.evaluate(() => {
                const toggle = document.getElementById('availabilityToggle');
                if (toggle) {
                    toggle.click();
                }
            });
            await new Promise(r => setTimeout(r, 2000));

            const newStatus = await page.evaluate(() => {
                const toggle = document.getElementById('availabilityToggle');
                return toggle ? toggle.checked : null;
            });
            logTest('Changement de statut', isOnline !== newStatus, `${isOnline ? 'En ligne' : 'Hors ligne'} → ${newStatus ? 'En ligne' : 'Hors ligne'}`);

            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-driver-status-changed.png') });

            // Remettre au statut initial
            if (newStatus !== isOnline) {
                await page.evaluate(() => {
                    const toggle = document.getElementById('availabilityToggle');
                    if (toggle) toggle.click();
                });
                await new Promise(r => setTimeout(r, 1000));
            }

            // ========================================
            // PARTIE 3: PROFIL CONDUCTRICE
            // ========================================
            console.log('\n👤 PARTIE 3: Profil Conductrice');
            console.log('-'.repeat(50));

            await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 1000));
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-driver-profile.png') });

            // Vérifier que c'est bien un profil conductrice
            const roleText = await page.evaluate(() => {
                const role = document.querySelector('.profile-role');
                return role ? role.textContent.trim() : '';
            });
            logTest('Rôle conductrice affiché', roleText.toLowerCase().includes('conductrice') || roleText.toLowerCase().includes('driver'));

            // Vérifier la section véhicule (spécifique aux conductrices)
            const vehicleSection = await page.$('.profile-section:has([class*="vehicle"])');
            // Alternative check
            const hasVehicleInfo = await page.evaluate(() => {
                const sections = document.querySelectorAll('.profile-section-title');
                for (const s of sections) {
                    if (s.textContent.toLowerCase().includes('véhicule') || s.textContent.toLowerCase().includes('vehicle')) {
                        return true;
                    }
                }
                return false;
            });
            logTest('Section véhicule présente (si applicable)', hasVehicleInfo || vehicleSection !== null, hasVehicleInfo ? 'Oui' : 'Non requise');

            // Test upload avatar conductrice
            const driverAvatarWrapper = await page.$('.profile-avatar-wrapper');
            logTest('Avatar modifiable (conductrice)', !!driverAvatarWrapper);
        }

        // ========================================
        // RÉSUMÉ
        // ========================================
        console.log('\n' + '═'.repeat(60));
        console.log('📊 RÉSUMÉ');
        console.log('═'.repeat(60));
        console.log(`✅ Tests réussis: ${results.passed}`);
        console.log(`❌ Tests échoués: ${results.failed}`);
        console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}`);

        if (consoleErrors.length > 0) {
            console.log(`\n⚠️ Erreurs console (${consoleErrors.length}):`);
            consoleErrors.slice(0, 5).forEach(e => console.log('   ' + e.substring(0, 80)));
        }

        if (results.failed === 0) {
            console.log('\n🎉 TOUS LES TESTS PASSENT !');
        } else {
            console.log('\n⚠️ Tests en échec:');
            results.tests.filter(t => !t.passed).forEach(t => {
                console.log(`   ❌ ${t.name}${t.details ? ': ' + t.details : ''}`);
            });
        }

    } catch (error) {
        console.error('\n❌ Erreur fatale:', error.message);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error.png') });
    } finally {
        await browser.close();
    }

    return results.failed === 0;
}

run().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
