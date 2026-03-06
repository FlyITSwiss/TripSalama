/**
 * TripSalama - Registration + Camera Verification Test
 * Tests the full registration flow including identity camera
 */

const { chromium } = require('playwright');

const PROD_URL = 'https://stabilis-it.ch/internal/tripsalama';

function generateTestEmail() {
    return `test${Date.now()}@demo.tripsalama.com`;
}

async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('📸 TripSalama Registration + Camera Test');
    console.log('='.repeat(60) + '\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 800
    });

    const context = await browser.newContext({
        viewport: { width: 430, height: 932 },
        permissions: ['camera'], // Grant camera permission
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    });

    const page = await context.newPage();

    // Log console messages
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('   ❌ Console error:', msg.text().substring(0, 100));
        }
    });

    try {
        // Step 1: Go to registration
        console.log('📍 Step 1: Navigate to registration...');
        await page.goto(PROD_URL + '/register', { waitUntil: 'networkidle', timeout: 30000 });
        await page.screenshot({ path: 'test-results/cam-01-register-choice.png' });
        console.log('   ✅ Registration page loaded');

        // Step 2: Choose passenger
        console.log('📍 Step 2: Select passenger registration...');
        await page.click('text=Je suis passagère');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/cam-02-passenger-form.png' });
        console.log('   ✅ Passenger form displayed');

        // Step 3: Fill registration form
        console.log('📍 Step 3: Fill registration form...');
        const testEmail = generateTestEmail();
        console.log('   Using email:', testEmail);

        // Wait for form to be ready
        await page.waitForSelector('#first_name', { timeout: 5000 });

        // Fill the form fields using IDs (more reliable)
        await page.fill('#first_name', 'Test');
        await page.fill('#last_name', 'Demo');
        await page.fill('#email', testEmail);
        await page.fill('#phone', '+212612345678');
        await page.fill('#password', 'Demo2024!!');
        await page.fill('#password_confirm', 'Demo2024!!');

        await page.screenshot({ path: 'test-results/cam-03-form-filled.png' });
        console.log('   ✅ Form filled');

        // Step 4: Submit registration
        console.log('📍 Step 4: Submit registration...');
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) {
            await submitBtn.click();
            await page.waitForTimeout(3000);
        }
        await page.screenshot({ path: 'test-results/cam-04-after-submit.png' });

        const currentUrl = page.url();
        console.log('   Current URL:', currentUrl);

        // Step 5: Check if we're on identity verification
        if (currentUrl.includes('identity-verification') || currentUrl.includes('verification')) {
            console.log('   ✅ Redirected to identity verification!');

            // Wait for camera module to load
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'test-results/cam-05-verification-page.png' });

            // Check if camera module is present
            const cameraContainer = await page.$('#identity-camera-container');
            if (cameraContainer) {
                console.log('   ✅ Camera module loaded');

                // Check for camera-related elements
                const cameraElements = await page.$$('[class*="camera"], [class*="Camera"], video');
                console.log('   📷 Camera elements found:', cameraElements.length);

                // Wait for any i18n translations
                await page.waitForTimeout(1000);
                await page.screenshot({ path: 'test-results/cam-06-camera-ready.png' });

                // Check for verification texts (i18n)
                const pageContent = await page.textContent('body');
                const hasVerificationText = pageContent.includes('vérif') ||
                                           pageContent.includes('Vérif') ||
                                           pageContent.includes('photo') ||
                                           pageContent.includes('identité');

                if (hasVerificationText) {
                    console.log('   ✅ i18n verification texts loaded');
                } else {
                    console.log('   ⚠️ i18n texts may not be loaded correctly');
                }
            } else {
                console.log('   ⚠️ Camera container not found');
            }
        } else if (currentUrl.includes('login')) {
            console.log('   ⚠️ Redirected back to login - possible error');
            const errorMsg = await page.$('.error, .alert-danger, [class*="error"]');
            if (errorMsg) {
                const errorText = await errorMsg.textContent();
                console.log('   Error message:', errorText);
            }
        } else {
            console.log('   ⚠️ Unexpected redirect to:', currentUrl);
        }

        console.log('\n' + '='.repeat(60));
        console.log('📸 Test completed - Check screenshots in test-results/');
        console.log('='.repeat(60));

        // Keep browser open for manual inspection
        console.log('\nBrowser will stay open for 30 seconds for inspection...');
        await page.waitForTimeout(30000);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        await page.screenshot({ path: 'test-results/cam-error.png' });
    } finally {
        await browser.close();
    }
}

// Ensure test-results directory exists
const fs = require('fs');
if (!fs.existsSync('test-results')) {
    fs.mkdirSync('test-results', { recursive: true });
}

runTests().catch(console.error);
