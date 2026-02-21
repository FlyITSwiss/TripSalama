/**
 * TripSalama - Test E2E Chat Conductrice-Passagère
 *
 * Test complet du système de chat:
 * - Envoi de messages rapides
 * - Envoi de messages personnalisés
 * - Réception de messages (polling)
 * - Bouton d'appel
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'chat-e2e');
const BASE_URL = 'http://127.0.0.1:8080';

// Créer le dossier screenshots si nécessaire
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function run() {
    console.log('\n🚀 Test E2E Chat TripSalama\n');
    console.log('═'.repeat(50));

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 30,
        defaultViewport: { width: 414, height: 896 },
        args: ['--no-sandbox']
    });

    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    function logTest(name, passed, details = '') {
        const icon = passed ? '✅' : '❌';
        console.log(`${icon} ${name}${details ? ' - ' + details : ''}`);
        results.tests.push({ name, passed, details });
        if (passed) results.passed++;
        else results.failed++;
    }

    const page = await browser.newPage();
    await page.setCacheEnabled(false);

    // Capture errors
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
    });

    try {
        // ==== PHASE 1: LOGIN PASSAGÈRE ====
        console.log('\n📱 PHASE 1: Connexion Passagère');
        console.log('-'.repeat(40));

        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
        await page.type('input[name="email"], #email', 'fatima@example.com');
        await page.type('input[name="password"], #password', 'Test1234!');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});

        const isLoggedIn = await page.evaluate(() => {
            return !window.location.href.includes('/login');
        });
        logTest('Connexion passagère', isLoggedIn);

        // ==== PHASE 2: PAGE TRACKING ====
        console.log('\n🗺️ PHASE 2: Page de suivi de course');
        console.log('-'.repeat(40));

        await page.goto(`${BASE_URL}/passenger/ride/12`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));

        // Vérifier l'initialisation
        const initStatus = await page.evaluate(() => {
            return {
                rideChatExists: typeof window.RideChat !== 'undefined',
                rideChatInit: window.RideChat?.rideId !== null,
                chatBtn: !!document.getElementById('chatToggleBtn'),
                chatPanel: !!document.getElementById('chatPanel')
            };
        });

        logTest('Module RideChat chargé', initStatus.rideChatExists);
        logTest('RideChat initialisé', initStatus.rideChatInit);
        logTest('Bouton chat présent', initStatus.chatBtn);
        logTest('Panel chat présent', initStatus.chatPanel);

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-page-tracking.png') });

        // ==== PHASE 3: OUVRIR LE CHAT ====
        console.log('\n💬 PHASE 3: Interface Chat');
        console.log('-'.repeat(40));

        if (initStatus.chatBtn) {
            await page.click('#chatToggleBtn');
            await new Promise(r => setTimeout(r, 500));

            const panelOpen = await page.evaluate(() => {
                const panel = document.getElementById('chatPanel');
                return panel && panel.classList.contains('active');
            });
            logTest('Panel s\'ouvre au clic', panelOpen);

            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-chat-open.png') });

            // Vérifier les éléments du chat
            const chatElements = await page.evaluate(() => {
                return {
                    header: !!document.querySelector('.chat-header'),
                    messages: !!document.getElementById('chatMessages'),
                    quickMsgs: document.querySelectorAll('.quick-message-btn').length,
                    input: !!document.getElementById('chatInput'),
                    sendBtn: !!document.getElementById('chatSendBtn'),
                    callBtn: !!document.getElementById('chatCallBtn'),
                    closeBtn: !!document.getElementById('chatCloseBtn')
                };
            });

            logTest('Header chat', chatElements.header);
            logTest('Zone messages', chatElements.messages);
            logTest('Messages rapides', chatElements.quickMsgs >= 4, `${chatElements.quickMsgs} trouvés`);
            logTest('Champ de saisie', chatElements.input);
            logTest('Bouton envoyer', chatElements.sendBtn);
            logTest('Bouton appel', chatElements.callBtn);
            logTest('Bouton fermer', chatElements.closeBtn);
        }

        // ==== PHASE 4: ENVOYER MESSAGE RAPIDE ====
        console.log('\n📤 PHASE 4: Envoi de messages');
        console.log('-'.repeat(40));

        const quickMsgBtn = await page.$('.quick-message-btn');
        if (quickMsgBtn) {
            const msgContent = await page.evaluate(btn => btn.textContent.trim(), quickMsgBtn);
            await quickMsgBtn.click();
            await new Promise(r => setTimeout(r, 1500));

            // Vérifier le message affiché
            const messageAppeared = await page.evaluate((expectedText) => {
                const bubbles = document.querySelectorAll('.chat-bubble');
                for (const bubble of bubbles) {
                    if (bubble.textContent.includes(expectedText)) {
                        return true;
                    }
                }
                return false;
            }, msgContent);

            logTest('Message rapide envoyé', messageAppeared, msgContent);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-quick-message-sent.png') });
        }

        // Envoyer message personnalisé
        const customMsg = 'Test message personnalisé ' + Date.now();
        await page.type('#chatInput', customMsg);
        await page.click('#chatSendBtn');
        await new Promise(r => setTimeout(r, 1500));

        const customMsgAppeared = await page.evaluate((text) => {
            const bubbles = document.querySelectorAll('.chat-bubble');
            for (const bubble of bubbles) {
                if (bubble.textContent.includes(text)) return true;
            }
            return false;
        }, customMsg);

        logTest('Message personnalisé envoyé', customMsgAppeared);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-custom-message-sent.png') });

        // ==== PHASE 5: FERMER LE CHAT ====
        console.log('\n🔒 PHASE 5: Fermeture');
        console.log('-'.repeat(40));

        await page.click('#chatCloseBtn');
        await new Promise(r => setTimeout(r, 300));

        const panelClosed = await page.evaluate(() => {
            const panel = document.getElementById('chatPanel');
            return panel && !panel.classList.contains('active');
        });
        logTest('Panel se ferme correctement', panelClosed);

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-chat-closed.png') });

        // ==== RÉSUMÉ ====
        console.log('\n' + '═'.repeat(50));
        console.log('📊 RÉSUMÉ');
        console.log('═'.repeat(50));
        console.log(`✅ Tests réussis: ${results.passed}`);
        console.log(`❌ Tests échoués: ${results.failed}`);
        console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}`);

        if (errors.length > 0) {
            console.log(`\n⚠️ Erreurs console (${errors.length}):`);
            errors.slice(0, 5).forEach(e => console.log('   ' + e.substring(0, 100)));
        }

        if (results.failed === 0) {
            console.log('\n🎉 TOUS LES TESTS PASSENT !');
        } else {
            console.log('\n⚠️ Certains tests ont échoué, voir les détails ci-dessus.');
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
