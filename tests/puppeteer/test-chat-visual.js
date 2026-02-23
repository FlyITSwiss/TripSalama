/**
 * TripSalama - Test Visuel Chat
 * Vérifie le bouton chat sur la page de suivi
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:8080';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'chat');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function run() {
    console.log('\n🚀 Test Visuel Chat TripSalama\n');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        defaultViewport: { width: 414, height: 896 },
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    try {
        // 1. Login comme Fatima (passagère)
        console.log('1. Connexion comme Fatima...');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
        await page.type('#email, input[name="email"]', 'fatima@example.com');
        await page.type('#password, input[name="password"]', 'Test1234!');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test-01-login.png') });
        console.log('   ✅ Connectée');

        // 2. Aller sur la page de suivi de course active
        console.log('2. Navigation vers suivi de course...');
        // La course ID 12 est active pour Fatima
        await page.goto(`${BASE_URL}/passenger/ride/12`, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test-02-ride-tracking.png') });
        console.log('   📸 Screenshot ride-tracking');

        // 3. Vérifier présence du bouton chat
        console.log('3. Vérification bouton chat...');
        const chatBtn = await page.$('#chatToggleBtn');
        if (chatBtn) {
            console.log('   ✅ Bouton chat PRÉSENT');
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test-03-chat-button-visible.png') });

            // 4. Cliquer pour ouvrir le chat
            console.log('4. Ouverture du chat...');
            await chatBtn.click();
            await new Promise(r => setTimeout(r, 500));
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test-04-chat-open.png') });
            console.log('   ✅ Chat ouvert');

            // 5. Vérifier les éléments du chat
            const chatPanel = await page.$('#chatPanel.active');
            const chatInput = await page.$('#chatInput');
            const quickMessages = await page.$$('.quick-message-btn');
            const callBtn = await page.$('#chatCallBtn');

            console.log('5. Éléments du chat:');
            console.log(`   - Panel actif: ${chatPanel ? '✅' : '❌'}`);
            console.log(`   - Input message: ${chatInput ? '✅' : '❌'}`);
            console.log(`   - Messages rapides: ${quickMessages.length} boutons`);
            console.log(`   - Bouton appel: ${callBtn ? '✅' : '❌'}`);

            // 6. Tester envoi message rapide
            if (quickMessages.length > 0) {
                console.log('6. Test envoi message rapide...');
                await quickMessages[0].click();
                await new Promise(r => setTimeout(r, 1000));
                await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test-05-message-sent.png') });
                console.log('   ✅ Message rapide envoyé');
            }

            // 7. Fermer le chat
            console.log('7. Fermeture du chat...');
            const closeBtn = await page.$('#chatCloseBtn');
            if (closeBtn) {
                await closeBtn.click();
                await new Promise(r => setTimeout(r, 300));
            }
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test-06-chat-closed.png') });

        } else {
            console.log('   ⚠️ Bouton chat NON trouvé');
            console.log('   Vérification du HTML...');
            const bodyHtml = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
            console.log('   ' + bodyHtml.replace(/\n/g, ' ').substring(0, 200) + '...');
        }

        console.log('\n✅ Test terminé');
        console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}\n`);

    } catch (error) {
        console.error('\n❌ Erreur:', error.message);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test-error.png') });
    } finally {
        await browser.close();
    }
}

run();
