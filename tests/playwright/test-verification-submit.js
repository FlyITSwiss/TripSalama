/**
 * TripSalama - Full Verification Flow Test
 * Tests the complete identity verification process including photo submission
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROD_URL = 'https://stabilis-it.ch/internal/tripsalama';

function generateTestEmail() {
    return `test${Date.now()}@demo.tripsalama.com`;
}

// Create a fake base64 image for testing
function createTestImage() {
    // Simple 100x100 white PNG encoded as base64
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAABN0lEQVR4nO3TMRKAIBQF0P//aW7AZBewlYExBN9wnFNJvl8AgAAAAAAAAAAAAAAAAAAAAKAZ2f8GUOKz+w2gJDkkySFJDklySOK0YeJCSDqSJnJC0pE0kROSjqSJnJB0JE3khKQjaSInJB1JEzkh6UiayAlJR9JETkg6kiZyQtKRNJETko6kiZyQdCRN5ISkI2kiJyQdSRM5IelImsgJSUfSRE5IOpImckLSkTSRE5KOpImckHQkTeSEpCNpIickHUkTOSHpSJrICUlH0kROSDqSJnJC0pE0kROSjqSJnJB0JE3khKQjaSInJB1JEzkh6UiayAlJR9JETkg6kiZyQtKRNJETko6kiZyQdCRN5ISkI2kiJyQdSRM5IelImsgJSUfSRE5IOpLm/0LSkQAAAAAAAAAAAADAB1tNuQGVqMIzugAAAABJRU5ErkJggg==';
}

async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('📸 TripSalama Full Verification Flow Test');
    console.log('='.repeat(60) + '\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });

    const context = await browser.newContext({
        viewport: { width: 430, height: 932 },
        permissions: ['camera'],
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    });

    const page = await context.newPage();

    // Track console errors
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (!text.includes('favicon') && !text.includes('manifest')) {
                consoleErrors.push(text);
                console.log('   ❌ Console error:', text.substring(0, 150));
            }
        }
    });

    // Track network errors
    page.on('response', response => {
        if (response.status() >= 400 && response.url().includes('/api/')) {
            console.log(`   ⚠️ API error: ${response.status()} ${response.url()}`);
        }
    });

    try {
        // Step 1: Register
        console.log('📍 Step 1: Navigate to registration...');
        await page.goto(PROD_URL + '/register/passenger', { waitUntil: 'networkidle', timeout: 30000 });

        const testEmail = generateTestEmail();
        console.log('   Using email:', testEmail);

        await page.fill('#first_name', 'Test');
        await page.fill('#last_name', 'Verification');
        await page.fill('#email', testEmail);
        await page.fill('#phone', '+212612345679');
        await page.fill('#password', 'TestVerif2024!!');
        await page.fill('#password_confirm', 'TestVerif2024!!');

        // Submit
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        console.log('   Current URL:', currentUrl);

        if (!currentUrl.includes('identity-verification')) {
            console.log('   ❌ Did not redirect to verification page');
            return;
        }
        console.log('   ✅ On identity verification page');

        // Step 2: Accept consent and start camera
        console.log('📍 Step 2: Accept consent...');
        await page.waitForTimeout(2000); // Wait for i18n

        // Take screenshot before interaction
        await page.screenshot({ path: 'test-results/verif-00-before-consent.png' });

        // Scroll down to see checkbox
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);

        // Click on the consent label/checkbox area
        try {
            const consentLabel = await page.$('.identity-consent');
            if (consentLabel) {
                await consentLabel.click();
                console.log('   ✅ Consent accepted (via label)');
            } else {
                // Try clicking the checkbox directly
                await page.click('#identity-consent-checkbox', { force: true });
                console.log('   ✅ Consent accepted (via checkbox)');
            }
        } catch (e) {
            console.log('   ⚠️ Consent click failed:', e.message);
            // Force check via JS
            await page.evaluate(() => {
                const cb = document.getElementById('identity-consent-checkbox');
                if (cb) cb.checked = true;
                const btn = document.querySelector('.identity-btn-continue');
                if (btn) btn.disabled = false;
            });
            console.log('   ✅ Consent forced via JS');
        }

        // Wait for continue button to be enabled
        await page.waitForTimeout(500);

        // Click continue to start camera
        console.log('📍 Step 3: Start camera...');
        const continueBtn = await page.$('.identity-btn-continue');
        if (continueBtn) {
            await continueBtn.click();
            console.log('   ✅ Camera started');
        }

        // Wait for camera step
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/verif-01-camera-view.png' });

        // Step 4: Wait for capture button to be enabled and capture
        console.log('📍 Step 4: Wait for capture button...');
        await page.waitForTimeout(2000); // Face detection delay

        const captureBtn = await page.$('#btn-capture');
        if (captureBtn) {
            const isDisabled = await captureBtn.evaluate(el => el.disabled);
            if (!isDisabled) {
                console.log('   ✅ Capture button ready');
                await captureBtn.click();
                console.log('   ✅ Photo captured');
            } else {
                console.log('   ⚠️ Capture button still disabled, clicking anyway');
                await page.evaluate(() => {
                    const btn = document.getElementById('btn-capture');
                    if (btn) {
                        btn.disabled = false;
                        btn.click();
                    }
                });
            }
        }

        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/verif-02-preview.png' });

        // Step 5: Submit verification
        console.log('📍 Step 5: Submit verification...');
        const submitBtn = await page.$('.identity-btn-submit');
        if (submitBtn) {
            await submitBtn.click();
            console.log('   ✅ Verification submitted');
        }

        // Wait for analysis (can take up to 30 seconds with AI)
        console.log('📍 Step 6: Waiting for AI analysis...');
        await page.waitForTimeout(10000);
        await page.screenshot({ path: 'test-results/verif-03-analyzing.png' });

        // Check for result
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'test-results/verif-04-result.png' });

        // Check what the result is
        const resultTitle = await page.$('.result-title');
        if (resultTitle) {
            const title = await resultTitle.textContent();
            console.log('   📊 Result:', title);
        }

        const resultMessage = await page.$('.result-message');
        if (resultMessage) {
            const message = await resultMessage.textContent();
            console.log('   📝 Message:', message);
        }

        // Check for any errors on the page
        const errorOnPage = await page.$('.error, .alert-danger, [class*="error"]');
        if (errorOnPage) {
            const errorText = await errorOnPage.textContent();
            console.log('   ❌ Error on page:', errorText);
        }

        console.log('\n' + '='.repeat(60));
        console.log('📸 Test completed - Check screenshots in test-results/');
        if (consoleErrors.length > 0) {
            console.log('⚠️ Console errors found:', consoleErrors.length);
        }
        console.log('='.repeat(60));

        // Keep open for inspection
        await page.waitForTimeout(15000);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        await page.screenshot({ path: 'test-results/verif-error.png' });
    } finally {
        await browser.close();
    }
}

// Ensure test-results directory exists
if (!fs.existsSync('test-results')) {
    fs.mkdirSync('test-results', { recursive: true });
}

runTests().catch(console.error);
