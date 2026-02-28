/**
 * TripSalama Mobile Login Diagnostic Tool
 * Identifies issues with mobile app login (APK simulation)
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'https://stabilis-it.ch/internal/tripsalama';
const LOCAL_URL = 'http://127.0.0.1/internal/tripsalama';

const TEST_EMAIL = 'passenger@tripsalama.ch';
const TEST_PASSWORD = 'TripSalama2025!';

async function diagnoseMobileLogin() {
    console.log('\n🔍 TripSalama Mobile Login Diagnostic\n');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 390, height: 844 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Mobile user agent
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36');

    // Capture all network activity
    const networkLog = [];
    page.on('request', request => {
        if (request.url().includes('/api/')) {
            networkLog.push({
                type: 'request',
                url: request.url(),
                method: request.method(),
                headers: request.headers(),
                postData: request.postData()
            });
        }
    });

    page.on('response', async response => {
        if (response.url().includes('/api/')) {
            let body = '';
            try {
                body = await response.text();
            } catch (e) {
                body = '[Binary data]';
            }
            networkLog.push({
                type: 'response',
                url: response.url(),
                status: response.status(),
                headers: response.headers(),
                body: body
            });
        }
    });

    page.on('requestfailed', request => {
        networkLog.push({
            type: 'failed',
            url: request.url(),
            error: request.failure().errorText
        });
    });

    // Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
        consoleLogs.push({
            type: msg.type(),
            text: msg.text()
        });
    });

    try {
        // Test connection
        console.log('🌐 Testing connection...');
        const isLocal = await testConnection(LOCAL_URL, page);
        const baseUrl = isLocal ? LOCAL_URL : BASE_URL;
        console.log(`   Using: ${baseUrl}\n`);

        // Load mobile app
        console.log('📱 Loading mobile app...');
        await page.goto(`${baseUrl}/mobile/index.html`, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(2000);
        console.log('   ✅ App loaded\n');

        // Wait for login screen
        console.log('🔐 Waiting for login screen...');
        await page.waitForSelector('#login-screen.active', { timeout: 5000 });
        console.log('   ✅ Login screen active\n');

        // Check if API_BASE is correctly set
        console.log('⚙️  Checking API configuration...');
        const apiBase = await page.evaluate(() => window.API_BASE || 'NOT SET');
        console.log(`   API_BASE: ${apiBase}`);

        const expectedApiBase = `${baseUrl}/api`;
        if (apiBase !== expectedApiBase) {
            console.log(`   ⚠️  Warning: Expected ${expectedApiBase}\n`);
        } else {
            console.log('   ✅ API_BASE correct\n');
        }

        // Test CSRF endpoint
        console.log('🔑 Testing CSRF token endpoint...');
        const csrfResponse = await page.evaluate(async () => {
            try {
                const response = await fetch(window.API_BASE + '/auth?action=csrf');
                const data = await response.json();
                return { success: true, data, status: response.status };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        if (csrfResponse.success) {
            console.log(`   ✅ CSRF endpoint working (status ${csrfResponse.status})`);
            console.log(`   Token: ${csrfResponse.data.token ? '[Received]' : '[Missing]'}\n`);
        } else {
            console.log(`   ❌ CSRF endpoint failed: ${csrfResponse.error}\n`);
        }

        // Fill login form
        console.log('📝 Filling login form...');
        await page.type('#login-email', TEST_EMAIL);
        await page.type('#login-password', TEST_PASSWORD);
        console.log('   ✅ Form filled\n');

        // Submit login
        console.log('🚀 Submitting login...');
        await page.click('#login-btn');
        await page.waitForTimeout(5000);

        // Check result
        console.log('📊 Checking login result...\n');

        const errorVisible = await page.evaluate(() => {
            const errorDiv = document.getElementById('login-error');
            return errorDiv ? errorDiv.classList.contains('visible') : false;
        });

        const errorMessage = errorVisible ? await page.$eval('#login-error', el => el.textContent) : null;

        const dashboardActive = await page.evaluate(() => {
            const passenger = document.getElementById('passenger-screen');
            const driver = document.getElementById('driver-screen');
            return (passenger && passenger.classList.contains('active')) ||
                   (driver && driver.classList.contains('active'));
        });

        if (errorVisible) {
            console.log('❌ LOGIN FAILED');
            console.log(`   Error: ${errorMessage}\n`);
        } else if (dashboardActive) {
            console.log('✅ LOGIN SUCCESSFUL');
            console.log('   Dashboard is active\n');
        } else {
            console.log('⚠️  UNCLEAR STATE');
            console.log('   Neither error nor dashboard visible\n');
        }

        // Print network log
        console.log('📡 NETWORK LOG:');
        console.log('═══════════════════════════════════════\n');

        networkLog.forEach((entry, index) => {
            if (entry.type === 'request') {
                console.log(`${index + 1}. REQUEST ${entry.method} ${entry.url}`);
                if (entry.postData) {
                    console.log(`   Body: ${entry.postData.substring(0, 200)}`);
                }
                if (entry.headers.cookie) {
                    console.log(`   Cookie: ${entry.headers.cookie.substring(0, 100)}...`);
                }
            } else if (entry.type === 'response') {
                console.log(`${index + 1}. RESPONSE ${entry.status} ${entry.url}`);
                if (entry.body && entry.body !== '[Binary data]') {
                    console.log(`   Body: ${entry.body.substring(0, 300)}`);
                }
                if (entry.headers['set-cookie']) {
                    console.log(`   Set-Cookie: ${entry.headers['set-cookie']}`);
                }
            } else if (entry.type === 'failed') {
                console.log(`${index + 1}. ❌ FAILED ${entry.url}`);
                console.log(`   Error: ${entry.error}`);
            }
            console.log('');
        });

        // Print console logs
        console.log('\n📋 BROWSER CONSOLE LOGS:');
        console.log('═══════════════════════════════════════\n');

        consoleLogs.forEach((log, index) => {
            console.log(`${index + 1}. [${log.type.toUpperCase()}] ${log.text}`);
        });

        // Check cookies
        console.log('\n🍪 COOKIES:');
        console.log('═══════════════════════════════════════\n');

        const cookies = await page.cookies();
        if (cookies.length === 0) {
            console.log('⚠️  No cookies found - this might be the problem!');
            console.log('   The mobile app may not be storing session cookies.\n');
        } else {
            cookies.forEach(cookie => {
                console.log(`   ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
                console.log(`      Domain: ${cookie.domain}`);
                console.log(`      Secure: ${cookie.secure}`);
                console.log(`      HttpOnly: ${cookie.httpOnly}`);
                console.log('');
            });
        }

        // Diagnosis summary
        console.log('\n🔍 DIAGNOSIS SUMMARY:');
        console.log('═══════════════════════════════════════\n');

        const issues = [];

        if (apiBase !== expectedApiBase) {
            issues.push(`API_BASE mismatch: ${apiBase} vs ${expectedApiBase}`);
        }

        if (!csrfResponse.success) {
            issues.push('CSRF endpoint not working');
        }

        if (cookies.length === 0) {
            issues.push('No cookies stored - session may not persist');
        }

        const loginFailed = networkLog.some(entry =>
            entry.type === 'response' &&
            entry.url.includes('/auth?action=login') &&
            entry.status !== 200
        );

        if (loginFailed) {
            const loginResponse = networkLog.find(entry =>
                entry.type === 'response' &&
                entry.url.includes('/auth?action=login')
            );
            issues.push(`Login API returned ${loginResponse.status}: ${loginResponse.body}`);
        }

        const networkFailed = networkLog.some(entry => entry.type === 'failed');
        if (networkFailed) {
            issues.push('Network request failed - check CORS or connectivity');
        }

        if (issues.length === 0) {
            console.log('✅ No obvious issues detected');
            if (dashboardActive) {
                console.log('   Login appears to be working correctly!\n');
            } else {
                console.log('   But login still failed - check screenshots for UI issues\n');
            }
        } else {
            console.log('❌ Issues detected:');
            issues.forEach(issue => console.log(`   • ${issue}`));
            console.log('');
        }

        console.log('\n⏳ Browser will close in 20 seconds...');
        await page.waitForTimeout(20000);

    } catch (error) {
        console.error('\n❌ Diagnostic error:', error.message);
        console.error(error.stack);
    } finally {
        await browser.close();
    }
}

async function testConnection(url, page) {
    try {
        const response = await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 5000
        });
        return response && response.ok();
    } catch (e) {
        return false;
    }
}

diagnoseMobileLogin();
