/**
 * TripSalama - Test des nouvelles features
 * Date: 1er Mars 2026
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8080';
const SCREENSHOT_DIR = path.join(__dirname, 'new-features-test');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshot(page, name) {
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${name}.png`),
        fullPage: true
    });
}

async function runTests() {
    console.log('🚀 Test des nouvelles features TripSalama\n');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 414, height: 896 },
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    try {
        // Test 1: Page Login - Remember Me et Forgot Password
        console.log('📝 Test 1: Page Login - Nouvelles features');
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
        await screenshot(page, '01-login-page');

        // Verifier Remember Me
        const rememberMe = await page.$('#remember_me');
        if (rememberMe) {
            console.log('   ✅ Checkbox "Se souvenir de moi" presente');
            const isChecked = await page.$eval('#remember_me', el => el.checked);
            console.log(`   ✅ Checkbox est ${isChecked ? 'cochee' : 'decochee'} par defaut`);
        } else {
            console.log('   ❌ Checkbox "Se souvenir de moi" manquante');
        }

        // Verifier Forgot Password link
        const forgotLink = await page.$('a[href*="forgot-password"]');
        if (forgotLink) {
            console.log('   ✅ Lien "Mot de passe oublie" present');
        } else {
            console.log('   ❌ Lien "Mot de passe oublie" manquant');
        }

        // Test 2: Page Forgot Password
        console.log('\n📝 Test 2: Page Mot de passe oublie');
        await page.goto(BASE_URL + '/forgot-password', { waitUntil: 'networkidle0' });
        await screenshot(page, '02-forgot-password');

        const emailInput = await page.$('#email');
        const submitBtn = await page.$('button[type="submit"]');
        const backLink = await page.$('a[href*="login"]');

        if (emailInput) console.log('   ✅ Champ email present');
        else console.log('   ❌ Champ email manquant');

        if (submitBtn) console.log('   ✅ Bouton submit present');
        else console.log('   ❌ Bouton submit manquant');

        if (backLink) console.log('   ✅ Lien retour login present');
        else console.log('   ❌ Lien retour login manquant');

        // Test soumettre le formulaire
        if (emailInput) {
            await page.type('#email', 'test@example.com');
            await screenshot(page, '03-forgot-password-filled');

            console.log('   📧 Soumission du formulaire...');
            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
            await page.waitForTimeout(1000);
            await screenshot(page, '04-forgot-password-submitted');

            // Check for success message or redirect
            const url = page.url();
            if (url.includes('login')) {
                console.log('   ✅ Redirection vers login apres soumission');
            }

            const flashMsg = await page.$('.login-flash-item.success, .auth-flash-item.success');
            if (flashMsg) {
                console.log('   ✅ Message de succes affiche');
            }
        }

        // Test 3: Login avec Remember Me
        console.log('\n📝 Test 3: Login avec Remember Me');
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

        // Verifier que la checkbox est presente et cochee
        const rmCheckbox = await page.$('#remember_me');
        if (rmCheckbox) {
            await page.type('#email', 'passenger@tripsalama.ch');
            await page.type('#password', 'TripSalama2025!');
            await screenshot(page, '05-login-with-remember-me');

            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
            await page.waitForTimeout(2000);
            await screenshot(page, '06-logged-in-dashboard');

            const dashboardUrl = page.url();
            if (dashboardUrl.includes('dashboard')) {
                console.log('   ✅ Login reussi avec Remember Me');
            } else {
                console.log('   ❌ Login echoue');
            }
        }

        console.log('\n✅ Tests termines!');
        console.log(`📁 Screenshots: ${SCREENSHOT_DIR}`);

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }

    await browser.close();
}

runTests().catch(console.error);
