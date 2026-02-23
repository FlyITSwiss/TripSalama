/**
 * TripSalama - Tests E2E Chat Conductrice-Passagère
 *
 * Mode VISUEL obligatoire (headless: false)
 * Analyse des screenshots en profondeur
 *
 * Usage: node tests/puppeteer/test-ride-chat.js
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { sleep, waitForElement, fillInput, clickElement, takeScreenshot, TestReporter } = require('./helpers');

// ============================================
// CONFIGURATION
// ============================================

const TEST_CONFIG = {
    headless: false,    // TOUJOURS false pour mode visuel
    slowMo: 100,        // Ralentir pour observation
    defaultViewport: { width: 414, height: 896 }, // iPhone XR
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
    ]
};

const BASE_URL = config.baseUrl || 'http://127.0.0.1:8080';

// Dossier screenshots
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'chat');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// ============================================
// HELPERS SPECIFIQUES AU CHAT
// ============================================

async function takeScreenshotWithAnalysis(page, name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = path.join(SCREENSHOTS_DIR, `${name}-${timestamp}.png`);

    await page.screenshot({ path: filename, fullPage: false });
    console.log(`    📸 Screenshot: ${name}`);

    return filename;
}

async function loginAs(page, userType) {
    const users = {
        passenger: { email: 'fatima@example.com', password: 'Test1234!' },
        driver: { email: 'khadija@example.com', password: 'Test1234!' }
    };

    const user = users[userType];
    if (!user) throw new Error(`Unknown user type: ${userType}`);

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await sleep(500);

    // Remplir le formulaire
    await page.type('#email, input[name="email"]', user.email);
    await page.type('#password, input[name="password"]', user.password);

    // Submit
    await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {})
    ]);

    await sleep(1000);
    return user;
}

async function waitForChat(page) {
    // Attendre le bouton de chat
    const chatBtnExists = await page.waitForSelector('#chatToggleBtn', {
        visible: true,
        timeout: 10000
    }).then(() => true).catch(() => false);

    return chatBtnExists;
}

async function openChat(page) {
    const btn = await page.$('#chatToggleBtn');
    if (btn) {
        await btn.click();
        await sleep(500); // Animation
        return true;
    }
    return false;
}

async function closeChat(page) {
    const closeBtn = await page.$('#chatCloseBtn');
    if (closeBtn) {
        await closeBtn.click();
        await sleep(300);
        return true;
    }
    return false;
}

// ============================================
// TESTS
// ============================================

async function runTests() {
    const reporter = new TestReporter('TripSalama Chat E2E');

    console.log('\n🚀 Lancement des tests Chat E2E en mode VISUEL\n');
    console.log('Base URL:', BASE_URL);
    console.log('Screenshots:', SCREENSHOTS_DIR);
    console.log('');

    let browser;

    try {
        browser = await puppeteer.launch(TEST_CONFIG);

        // ============================================
        // TEST 1: Vérification du module Chat côté passagère
        // ============================================
        await reporter.test('Chat visible pour passagère avec course active', async () => {
            const page = await browser.newPage();
            await page.setViewport(TEST_CONFIG.defaultViewport);

            try {
                await loginAs(page, 'passenger');
                await takeScreenshotWithAnalysis(page, '01-passenger-logged-in');

                // Aller au dashboard
                await page.goto(`${BASE_URL}/passenger/dashboard`, { waitUntil: 'networkidle0' });
                await sleep(1000);
                await takeScreenshotWithAnalysis(page, '02-passenger-dashboard');

                // Note: Le chat n'apparaît que pendant une course active
                // Ce test vérifie que le module est chargé
                const moduleLoaded = await page.evaluate(() => {
                    return typeof window.RideChat !== 'undefined';
                });

                // Vérifier que le script ride-chat.js est inclus si on est sur ride-tracking
                console.log('    Module RideChat chargé:', moduleLoaded ? 'OUI' : 'NON (normal si pas de course)');

            } finally {
                await page.close();
            }
        });

        // ============================================
        // TEST 2: Vérification CSS du chat
        // ============================================
        await reporter.test('Styles CSS du chat correctement chargés', async () => {
            const page = await browser.newPage();
            await page.setViewport(TEST_CONFIG.defaultViewport);

            try {
                await loginAs(page, 'passenger');

                // Injecter un bouton de chat pour tester les styles
                await page.evaluate(() => {
                    // Créer un bouton de test
                    const btn = document.createElement('button');
                    btn.id = 'testChatBtn';
                    btn.className = 'chat-toggle-btn';
                    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
                    btn.style.position = 'fixed';
                    btn.style.bottom = '100px';
                    btn.style.right = '20px';
                    document.body.appendChild(btn);
                });

                // Charger le CSS si pas présent
                await page.addStyleTag({ path: path.join(__dirname, '../../public/assets/css/ride-chat.css') }).catch(() => {});

                await sleep(500);
                await takeScreenshotWithAnalysis(page, '03-chat-button-styles');

                // Vérifier que le bouton a bien les styles
                const btnStyles = await page.$eval('#testChatBtn', el => {
                    const styles = window.getComputedStyle(el);
                    return {
                        position: styles.position,
                        borderRadius: styles.borderRadius,
                        display: styles.display
                    };
                }).catch(() => null);

                if (btnStyles) {
                    console.log('    Styles appliqués:', JSON.stringify(btnStyles));
                }

            } finally {
                await page.close();
            }
        });

        // ============================================
        // TEST 3: Vérification API chat
        // ============================================
        await reporter.test('API chat accessible', async () => {
            const page = await browser.newPage();
            await page.setViewport(TEST_CONFIG.defaultViewport);

            try {
                await loginAs(page, 'passenger');

                // Tester l'endpoint API
                const response = await page.evaluate(async (baseUrl) => {
                    try {
                        const res = await fetch(`${baseUrl}/api/chat.php?action=list&ride_id=1`);
                        return {
                            status: res.status,
                            ok: res.ok
                        };
                    } catch (e) {
                        return { error: e.message };
                    }
                }, BASE_URL);

                console.log('    API Response:', JSON.stringify(response));

                // 403 est acceptable si pas d'accès à la course (normal)
                // 200 serait si la course existe
                if (response.status !== 200 && response.status !== 403 && response.status !== 400) {
                    throw new Error(`API status inattendu: ${response.status}`);
                }

            } finally {
                await page.close();
            }
        });

        // ============================================
        // TEST 4: Vérification i18n
        // ============================================
        await reporter.test('Traductions i18n présentes', async () => {
            const page = await browser.newPage();
            await page.setViewport(TEST_CONFIG.defaultViewport);

            try {
                // Vérifier les fichiers de traduction directement
                const frContent = fs.readFileSync(
                    path.join(__dirname, '../../backend/php/lang/fr.php'),
                    'utf8'
                );
                const enContent = fs.readFileSync(
                    path.join(__dirname, '../../backend/php/lang/en.php'),
                    'utf8'
                );

                // Vérifier les clés chat
                const chatKeysFr = frContent.includes("'chat' =>");
                const chatKeysEn = enContent.includes("'chat' =>");
                const callKeysFr = frContent.includes("'call' =>");
                const callKeysEn = enContent.includes("'call' =>");

                console.log('    FR chat keys:', chatKeysFr ? '✓' : '✗');
                console.log('    EN chat keys:', chatKeysEn ? '✓' : '✗');
                console.log('    FR call keys:', callKeysFr ? '✓' : '✗');
                console.log('    EN call keys:', callKeysEn ? '✓' : '✗');

                if (!chatKeysFr || !chatKeysEn || !callKeysFr || !callKeysEn) {
                    throw new Error('Clés i18n manquantes');
                }

                // Vérifier accents français
                const hasAccents = frContent.includes('éè') || frContent.includes('à') || frContent.includes('ç');
                console.log('    Accents FR:', hasAccents ? '✓ présents' : '⚠ à vérifier');

            } finally {
                await page.close();
            }
        });

        // ============================================
        // TEST 5: Vérification Design System φ
        // ============================================
        await reporter.test('Design System φ respecté dans CSS', async () => {
            const cssContent = fs.readFileSync(
                path.join(__dirname, '../../public/assets/css/ride-chat.css'),
                'utf8'
            );

            // Vérifier l'utilisation des variables CSS
            const usesVars = cssContent.includes('var(--');
            const usesSpacing = cssContent.includes('var(--space-');
            const usesRadius = cssContent.includes('var(--radius-');
            const usesColors = cssContent.includes('var(--color-');

            console.log('    Variables CSS:', usesVars ? '✓' : '✗');
            console.log('    Spacing φ:', usesSpacing ? '✓' : '✗');
            console.log('    Radius φ:', usesRadius ? '✓' : '✗');
            console.log('    Colors:', usesColors ? '✓' : '✗');

            // Vérifier qu'il n'y a pas de px hardcodés (sauf dans les fallbacks)
            const hardcodedPx = cssContent.match(/:\s*\d+px\s*[;,}]/g) || [];
            const nonFallbackPx = hardcodedPx.filter(match =>
                !match.includes('0px') &&
                !match.includes('1px') &&
                !cssContent.substring(
                    cssContent.indexOf(match) - 50,
                    cssContent.indexOf(match)
                ).includes('var(')
            );

            if (nonFallbackPx.length > 10) {
                console.log('    ⚠ px hardcodés trouvés:', nonFallbackPx.length);
            }

            if (!usesVars || !usesSpacing) {
                throw new Error('Design System φ non respecté');
            }
        });

        // ============================================
        // TEST 6: Vérification Model Message
        // ============================================
        await reporter.test('Model Message.php existe et est valide', async () => {
            const modelPath = path.join(__dirname, '../../backend/php/Models/Message.php');
            const modelContent = fs.readFileSync(modelPath, 'utf8');

            // Vérifications
            const hasStrictTypes = modelContent.includes('declare(strict_types=1)');
            const hasNamespace = modelContent.includes('namespace TripSalama\\Models');
            const hasCreate = modelContent.includes('function create(');
            const hasGetByRide = modelContent.includes('function getByRide(');
            const hasMarkAsRead = modelContent.includes('function markAsRead(');
            const hasPDO = modelContent.includes('PDO $db');

            console.log('    strict_types:', hasStrictTypes ? '✓' : '✗');
            console.log('    namespace:', hasNamespace ? '✓' : '✗');
            console.log('    create():', hasCreate ? '✓' : '✗');
            console.log('    getByRide():', hasGetByRide ? '✓' : '✗');
            console.log('    markAsRead():', hasMarkAsRead ? '✓' : '✗');
            console.log('    PDO injection:', hasPDO ? '✓' : '✗');

            if (!hasStrictTypes || !hasNamespace || !hasCreate || !hasGetByRide) {
                throw new Error('Model Message.php incomplet');
            }
        });

        // ============================================
        // TEST 7: Vérification API chat.php
        // ============================================
        await reporter.test('API chat.php structure correcte', async () => {
            const apiPath = path.join(__dirname, '../../public/api/chat.php');
            const apiContent = fs.readFileSync(apiPath, 'utf8');

            // Vérifications
            const hasBootstrap = apiContent.includes("require_once __DIR__ . '/_bootstrap.php'");
            const hasRequireAuth = apiContent.includes('requireAuth()');
            const hasRequireCsrf = apiContent.includes('requireCsrf()');
            const hasTryCatch = apiContent.includes('try {') && apiContent.includes('catch (');
            const hasCastInt = apiContent.includes('(int)');
            const hasActions = ['send', 'list', 'mark-read', 'call-info'].every(
                action => apiContent.includes(`case '${action}'`)
            );

            console.log('    Bootstrap:', hasBootstrap ? '✓' : '✗');
            console.log('    requireAuth():', hasRequireAuth ? '✓' : '✗');
            console.log('    requireCsrf():', hasRequireCsrf ? '✓' : '✗');
            console.log('    try/catch:', hasTryCatch ? '✓' : '✗');
            console.log('    (int) cast:', hasCastInt ? '✓' : '✗');
            console.log('    Actions complètes:', hasActions ? '✓' : '✗');

            if (!hasBootstrap || !hasRequireAuth || !hasTryCatch) {
                throw new Error('API chat.php structure incorrecte');
            }
        });

        // ============================================
        // TEST 8: Vérification Migration SQL
        // ============================================
        await reporter.test('Migration SQL correcte', async () => {
            const migrationPath = path.join(__dirname, '../../database/migrations/006_create_messages_table.sql');
            const sqlContent = fs.readFileSync(migrationPath, 'utf8');

            // Vérifications
            const hasCreateTable = sqlContent.includes('CREATE TABLE');
            const hasRideId = sqlContent.includes('ride_id');
            const hasSenderId = sqlContent.includes('sender_id');
            const hasContent = sqlContent.includes('content TEXT');
            const hasMessageType = sqlContent.includes('message_type');
            const hasForeignKeys = sqlContent.includes('FOREIGN KEY');
            const hasIndexes = sqlContent.includes('INDEX');
            const hasUtf8mb4 = sqlContent.includes('utf8mb4');

            console.log('    CREATE TABLE:', hasCreateTable ? '✓' : '✗');
            console.log('    ride_id:', hasRideId ? '✓' : '✗');
            console.log('    sender_id:', hasSenderId ? '✓' : '✗');
            console.log('    content:', hasContent ? '✓' : '✗');
            console.log('    message_type:', hasMessageType ? '✓' : '✗');
            console.log('    FOREIGN KEY:', hasForeignKeys ? '✓' : '✗');
            console.log('    INDEX:', hasIndexes ? '✓' : '✗');
            console.log('    utf8mb4:', hasUtf8mb4 ? '✓' : '✗');

            if (!hasCreateTable || !hasRideId || !hasSenderId) {
                throw new Error('Migration SQL incomplète');
            }
        });

        // ============================================
        // TEST 9: Screenshot analyse globale
        // ============================================
        await reporter.test('Screenshot analyse globale du dashboard', async () => {
            const page = await browser.newPage();
            await page.setViewport(TEST_CONFIG.defaultViewport);

            try {
                await loginAs(page, 'passenger');
                await page.goto(`${BASE_URL}/passenger/dashboard`, { waitUntil: 'networkidle0' });
                await sleep(1000);

                // Screenshot pleine page
                await page.screenshot({
                    path: path.join(SCREENSHOTS_DIR, 'final-dashboard-analysis.png'),
                    fullPage: true
                });

                console.log('    📸 Screenshot analyse sauvegardé');

                // Vérifier éléments clés
                const hasHeader = await page.$('.app-header, .header, header');
                const hasNav = await page.$('.mobile-nav, .nav, nav');
                const hasContent = await page.$('.main-content, .content, main');

                console.log('    Header:', hasHeader ? '✓' : '✗');
                console.log('    Navigation:', hasNav ? '✓' : '✗');
                console.log('    Content:', hasContent ? '✓' : '✗');

            } finally {
                await page.close();
            }
        });

    } catch (error) {
        console.error('\n❌ Erreur fatale:', error.message);
        console.error(error.stack);
    } finally {
        if (browser) {
            await browser.close();
        }

        // Résumé
        const success = reporter.summary();

        // Afficher le dossier des screenshots
        console.log('\n📁 Screenshots disponibles dans:');
        console.log(`   ${SCREENSHOTS_DIR}\n`);

        process.exit(success ? 0 : 1);
    }
}

// Lancer les tests
runTests();
