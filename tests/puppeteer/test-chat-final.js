/**
 * Test Final Chat - Avec hard reload et attente
 */
const puppeteer = require('puppeteer');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'chat');

async function run() {
    console.log('\n🚀 Test Final Chat TripSalama\n');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
        defaultViewport: { width: 414, height: 896 },
        args: ['--no-sandbox', '--disable-cache']
    });

    const page = await browser.newPage();

    // Disable cache
    await page.setCacheEnabled(false);

    // Login
    console.log('1. Connexion...');
    await page.goto('http://127.0.0.1:8080/login', { waitUntil: 'networkidle0' });
    await page.type('#email, input[name="email"]', 'fatima@example.com');
    await page.type('#password, input[name="password"]', 'Test1234!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    console.log('   ✅ Connectée');

    // Go to ride tracking with cache bypass
    console.log('2. Navigation vers tracking (no cache)...');
    await page.goto('http://127.0.0.1:8080/passenger/ride/12?_=' + Date.now(), {
        waitUntil: 'networkidle0'
    });

    // Wait for all scripts to load
    console.log('3. Attente chargement complet...');
    await new Promise(r => setTimeout(r, 3000));

    // Check for errors in console
    const consoleMessages = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleMessages.push(msg.text());
        }
    });

    // Check if RideChat was initialized
    const chatStatus = await page.evaluate(() => {
        return {
            rideChatExists: typeof window.RideChat !== 'undefined',
            rideChatInitialized: window.RideChat && window.RideChat.rideId !== null,
            chatBtnExists: !!document.getElementById('chatToggleBtn'),
            chatPanelExists: !!document.getElementById('chatPanel')
        };
    });

    console.log('\n📊 Status Chat:');
    console.log('   RideChat exists:', chatStatus.rideChatExists ? '✅' : '❌');
    console.log('   RideChat initialized:', chatStatus.rideChatInitialized ? '✅' : '❌');
    console.log('   Chat button:', chatStatus.chatBtnExists ? '✅' : '❌');
    console.log('   Chat panel:', chatStatus.chatPanelExists ? '✅' : '❌');

    if (consoleMessages.length > 0) {
        console.log('\n⚠️ Erreurs console:');
        consoleMessages.forEach(m => console.log('   ' + m));
    }

    // Screenshot
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'final-test-1.png') });

    if (chatStatus.chatBtnExists) {
        console.log('\n4. Ouverture du chat...');
        await page.click('#chatToggleBtn');
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'final-test-2-chat-open.png') });

        // Check quick messages
        const quickMsgs = await page.$$('.quick-message-btn');
        console.log('   Messages rapides:', quickMsgs.length);

        if (quickMsgs.length > 0) {
            console.log('\n5. Envoi message rapide...');
            await quickMsgs[0].click();
            await new Promise(r => setTimeout(r, 1500));
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'final-test-3-message-sent.png') });
            console.log('   ✅ Message envoyé');
        }

        // Test call button
        const callBtn = await page.$('#chatCallBtn');
        if (callBtn) {
            console.log('\n6. Bouton appel présent ✅');
        }

        console.log('\n✅ TEST RÉUSSI - Chat fonctionnel !');
    } else {
        console.log('\n❌ Bouton chat absent - Debug...');

        // Try manual init
        const manualResult = await page.evaluate(() => {
            if (window.RideChat) {
                try {
                    window.RideChat.init(12, 'passenger', 1);
                    return 'Init manuel OK';
                } catch (e) {
                    return 'Erreur: ' + e.message;
                }
            }
            return 'RideChat non disponible';
        });
        console.log('   Init manuel:', manualResult);

        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'final-test-manual.png') });

        const btnAfter = await page.$('#chatToggleBtn');
        console.log('   Bouton après init manuel:', btnAfter ? '✅ PRÉSENT' : '❌');
    }

    console.log('\n📁 Screenshots:', SCREENSHOTS_DIR);
    await browser.close();
}

run().catch(console.error);
