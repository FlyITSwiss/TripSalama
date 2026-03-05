#!/usr/bin/env node
/**
 * TripSalama - Asset Build Script
 * Minifies CSS and JavaScript files for production
 *
 * Usage:
 *   npm run build:assets     - Build all assets
 *   npm run build:css        - Build CSS only
 *   npm run build:js         - Build JS only
 *   npm run build:watch      - Watch for changes
 */

const fs = require('fs');
const path = require('path');

// Config
const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'assets');
const CSS_DIR = path.join(PUBLIC_DIR, 'css');
const JS_DIR = path.join(PUBLIC_DIR, 'js');
const DIST_DIR = path.join(PUBLIC_DIR, 'dist');

// Parse args
const args = process.argv.slice(2);
const CSS_ONLY = args.includes('--css-only');
const JS_ONLY = args.includes('--js-only');
const WATCH_MODE = args.includes('--watch');

// Colors
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

function log(msg, color = 'reset') {
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Ensure dist directory exists
function ensureDistDir() {
    if (!fs.existsSync(DIST_DIR)) {
        fs.mkdirSync(DIST_DIR, { recursive: true });
        log('Created dist directory', 'blue');
    }
    const cssDist = path.join(DIST_DIR, 'css');
    const jsDist = path.join(DIST_DIR, 'js');
    if (!fs.existsSync(cssDist)) fs.mkdirSync(cssDist, { recursive: true });
    if (!fs.existsSync(jsDist)) fs.mkdirSync(jsDist, { recursive: true });
}

// Get all files recursively
function getFiles(dir, ext) {
    let results = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            results = results.concat(getFiles(filePath, ext));
        } else if (file.endsWith(ext) && !file.endsWith('.min' + ext)) {
            results.push(filePath);
        }
    }
    return results;
}

// Minify CSS
async function buildCSS() {
    try {
        const CleanCSS = require('clean-css');
        const cssFiles = getFiles(CSS_DIR, '.css');

        log(`\nBuilding ${cssFiles.length} CSS files...`, 'blue');

        const cleanCSS = new CleanCSS({
            level: 2, // Advanced optimizations
            compatibility: 'ie11',
            sourceMap: false
        });

        let totalOriginal = 0;
        let totalMinified = 0;

        for (const file of cssFiles) {
            const content = fs.readFileSync(file, 'utf8');
            const result = cleanCSS.minify(content);

            if (result.errors && result.errors.length > 0) {
                log(`  Error in ${path.basename(file)}: ${result.errors.join(', ')}`, 'red');
                continue;
            }

            const relativePath = path.relative(CSS_DIR, file);
            const minFileName = relativePath.replace('.css', '.min.css');
            const outputPath = path.join(DIST_DIR, 'css', minFileName);

            // Ensure subdirectory exists
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, result.styles);

            const originalSize = Buffer.byteLength(content, 'utf8');
            const minifiedSize = Buffer.byteLength(result.styles, 'utf8');
            const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

            totalOriginal += originalSize;
            totalMinified += minifiedSize;

            log(`  ${relativePath} → ${minFileName} (${savings}% smaller)`, 'green');
        }

        const totalSavings = ((1 - totalMinified / totalOriginal) * 100).toFixed(1);
        log(`\nCSS total: ${formatBytes(totalOriginal)} → ${formatBytes(totalMinified)} (${totalSavings}% smaller)`, 'green');

    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            log('clean-css not installed. Run: npm install clean-css --save-dev', 'red');
        } else {
            log(`CSS build error: ${error.message}`, 'red');
        }
    }
}

// Minify JS
async function buildJS() {
    try {
        const { minify } = require('terser');
        const jsFiles = getFiles(JS_DIR, '.js');

        log(`\nBuilding ${jsFiles.length} JS files...`, 'blue');

        let totalOriginal = 0;
        let totalMinified = 0;

        for (const file of jsFiles) {
            const content = fs.readFileSync(file, 'utf8');

            try {
                const result = await minify(content, {
                    compress: {
                        drop_console: false, // Keep console for debugging
                        drop_debugger: true,
                        passes: 2
                    },
                    mangle: {
                        toplevel: false // Don't mangle top-level names
                    },
                    format: {
                        comments: false
                    }
                });

                if (!result.code) {
                    log(`  Warning: Empty output for ${path.basename(file)}`, 'yellow');
                    continue;
                }

                const relativePath = path.relative(JS_DIR, file);
                const minFileName = relativePath.replace('.js', '.min.js');
                const outputPath = path.join(DIST_DIR, 'js', minFileName);

                // Ensure subdirectory exists
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });
                fs.writeFileSync(outputPath, result.code);

                const originalSize = Buffer.byteLength(content, 'utf8');
                const minifiedSize = Buffer.byteLength(result.code, 'utf8');
                const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

                totalOriginal += originalSize;
                totalMinified += minifiedSize;

                log(`  ${relativePath} → ${minFileName} (${savings}% smaller)`, 'green');

            } catch (parseError) {
                log(`  Error in ${path.basename(file)}: ${parseError.message}`, 'red');
            }
        }

        const totalSavings = ((1 - totalMinified / totalOriginal) * 100).toFixed(1);
        log(`\nJS total: ${formatBytes(totalOriginal)} → ${formatBytes(totalMinified)} (${totalSavings}% smaller)`, 'green');

    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            log('terser not installed. Run: npm install terser --save-dev', 'red');
        } else {
            log(`JS build error: ${error.message}`, 'red');
        }
    }
}

// Format bytes
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Watch mode
async function watchMode() {
    try {
        const chokidar = require('chokidar');

        log('\nWatching for changes...', 'blue');
        log('Press Ctrl+C to stop\n', 'yellow');

        const watcher = chokidar.watch([CSS_DIR, JS_DIR], {
            ignored: /\.min\.(js|css)$/,
            persistent: true,
            ignoreInitial: true
        });

        watcher.on('change', async (filePath) => {
            log(`\nFile changed: ${path.basename(filePath)}`, 'yellow');

            if (filePath.endsWith('.css')) {
                await buildCSS();
            } else if (filePath.endsWith('.js')) {
                await buildJS();
            }
        });

    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            log('chokidar not installed. Run: npm install chokidar --save-dev', 'red');
        } else {
            log(`Watch error: ${error.message}`, 'red');
        }
    }
}

// Main
async function main() {
    log('========================================', 'blue');
    log(' TripSalama Asset Builder', 'blue');
    log('========================================', 'blue');

    ensureDistDir();

    if (WATCH_MODE) {
        await watchMode();
        // Keep process alive
        process.stdin.resume();
    } else {
        if (!JS_ONLY) await buildCSS();
        if (!CSS_ONLY) await buildJS();

        log('\nBuild complete!', 'green');
        log('Output directory: public/assets/dist/', 'blue');
    }
}

main().catch(err => {
    log(`Fatal error: ${err.message}`, 'red');
    process.exit(1);
});
