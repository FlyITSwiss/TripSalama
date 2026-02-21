/**
 * TripSalama - PWA Icons Generator
 * Generates all required PWA icons from the SVG source
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/assets/images/icons');
const svgPath = path.join(iconsDir, 'icon.svg');

// All required icon sizes for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Shortcut icons
const shortcutIcons = [
    { name: 'shortcut-book.png', size: 96 },
    { name: 'shortcut-history.png', size: 96 }
];

async function generateIcons() {
    console.log('TripSalama PWA Icons Generator');
    console.log('==============================\n');

    // Check if SVG exists
    if (!fs.existsSync(svgPath)) {
        console.error('Error: SVG source not found at', svgPath);
        process.exit(1);
    }

    const svgBuffer = fs.readFileSync(svgPath);

    // Generate main PWA icons
    console.log('Generating main PWA icons...');
    for (const size of sizes) {
        const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
        try {
            await sharp(svgBuffer)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png({
                    compressionLevel: 9,
                    quality: 100
                })
                .toFile(outputPath);
            console.log(`  ✓ Generated: icon-${size}x${size}.png`);
        } catch (err) {
            console.error(`  ✗ Failed: icon-${size}x${size}.png -`, err.message);
        }
    }

    // Generate shortcut icons (using same base icon for now)
    console.log('\nGenerating shortcut icons...');
    for (const shortcut of shortcutIcons) {
        const outputPath = path.join(iconsDir, shortcut.name);
        try {
            await sharp(svgBuffer)
                .resize(shortcut.size, shortcut.size, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png({
                    compressionLevel: 9,
                    quality: 100
                })
                .toFile(outputPath);
            console.log(`  ✓ Generated: ${shortcut.name}`);
        } catch (err) {
            console.error(`  ✗ Failed: ${shortcut.name} -`, err.message);
        }
    }

    // Generate Apple Touch Icon
    console.log('\nGenerating Apple Touch Icon...');
    const appleTouchPath = path.join(iconsDir, 'apple-touch-icon.png');
    try {
        await sharp(svgBuffer)
            .resize(180, 180, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png({
                compressionLevel: 9,
                quality: 100
            })
            .toFile(appleTouchPath);
        console.log('  ✓ Generated: apple-touch-icon.png (180x180)');
    } catch (err) {
        console.error('  ✗ Failed: apple-touch-icon.png -', err.message);
    }

    // Generate favicon
    console.log('\nGenerating favicon...');
    const faviconPath = path.join(__dirname, '../public/favicon.ico');
    try {
        // Generate a 32x32 PNG first, then we'll note it should be converted
        const favicon32Path = path.join(iconsDir, 'favicon-32x32.png');
        await sharp(svgBuffer)
            .resize(32, 32, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png({
                compressionLevel: 9,
                quality: 100
            })
            .toFile(favicon32Path);
        console.log('  ✓ Generated: favicon-32x32.png');

        const favicon16Path = path.join(iconsDir, 'favicon-16x16.png');
        await sharp(svgBuffer)
            .resize(16, 16, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png({
                compressionLevel: 9,
                quality: 100
            })
            .toFile(favicon16Path);
        console.log('  ✓ Generated: favicon-16x16.png');
    } catch (err) {
        console.error('  ✗ Failed favicon generation -', err.message);
    }

    console.log('\n==============================');
    console.log('PWA icons generation complete!');
    console.log(`Total icons generated: ${sizes.length + shortcutIcons.length + 3}`);
}

generateIcons().catch(console.error);
