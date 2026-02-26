/**
 * TripSalama - Android Icon Generator
 * Generates all required Android icons from the source icon
 *
 * Usage: node scripts/generate-android-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Source icon
const SOURCE_ICON = path.join(__dirname, '../public/assets/images/icons/icon-512x512.png');

// Android icon sizes (standard launcher icons)
const ANDROID_ICONS = {
    'mipmap-mdpi': { size: 48, round: 48 },
    'mipmap-hdpi': { size: 72, round: 72 },
    'mipmap-xhdpi': { size: 96, round: 96 },
    'mipmap-xxhdpi': { size: 144, round: 144 },
    'mipmap-xxxhdpi': { size: 192, round: 192 },
};

// Adaptive icon foreground sizes (with padding for safe zone)
const ADAPTIVE_ICONS = {
    'mipmap-mdpi': 108,
    'mipmap-hdpi': 162,
    'mipmap-xhdpi': 216,
    'mipmap-xxhdpi': 324,
    'mipmap-xxxhdpi': 432,
};

const ANDROID_RES_DIR = path.join(__dirname, '../android/app/src/main/res');

async function generateIcons() {
    console.log('🎨 TripSalama - Generating Android Icons...\n');

    // Check if source icon exists
    if (!fs.existsSync(SOURCE_ICON)) {
        console.error('❌ Source icon not found:', SOURCE_ICON);
        process.exit(1);
    }

    // Generate standard launcher icons
    for (const [folder, config] of Object.entries(ANDROID_ICONS)) {
        const outputDir = path.join(ANDROID_RES_DIR, folder);

        // Create directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate ic_launcher.png (square with rounded corners)
        await sharp(SOURCE_ICON)
            .resize(config.size, config.size)
            .png()
            .toFile(path.join(outputDir, 'ic_launcher.png'));

        console.log(`✅ ${folder}/ic_launcher.png (${config.size}x${config.size})`);

        // Generate ic_launcher_round.png (circular)
        const roundBuffer = await sharp(SOURCE_ICON)
            .resize(config.round, config.round)
            .png()
            .toBuffer();

        // Create circular mask
        const circleMask = Buffer.from(
            `<svg width="${config.round}" height="${config.round}">
                <circle cx="${config.round/2}" cy="${config.round/2}" r="${config.round/2}" fill="white"/>
            </svg>`
        );

        await sharp(roundBuffer)
            .composite([{
                input: circleMask,
                blend: 'dest-in'
            }])
            .png()
            .toFile(path.join(outputDir, 'ic_launcher_round.png'));

        console.log(`✅ ${folder}/ic_launcher_round.png (${config.round}x${config.round})`);
    }

    // Generate adaptive icon foreground
    console.log('\n📱 Generating adaptive icon foreground...\n');

    for (const [folder, size] of Object.entries(ADAPTIVE_ICONS)) {
        const outputDir = path.join(ANDROID_RES_DIR, folder);

        // Create directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Foreground with padding (icon should be 66% of total size for safe zone)
        const iconSize = Math.round(size * 0.66);
        const padding = Math.round((size - iconSize) / 2);

        // Create canvas with padding
        await sharp({
            create: {
                width: size,
                height: size,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        })
        .composite([{
            input: await sharp(SOURCE_ICON)
                .resize(iconSize, iconSize)
                .png()
                .toBuffer(),
            left: padding,
            top: padding
        }])
        .png()
        .toFile(path.join(outputDir, 'ic_launcher_foreground.png'));

        console.log(`✅ ${folder}/ic_launcher_foreground.png (${size}x${size})`);
    }

    // Create adaptive icon XML files
    console.log('\n📄 Creating adaptive icon XML files...\n');

    const drawableDir = path.join(ANDROID_RES_DIR, 'drawable');
    const valuesDir = path.join(ANDROID_RES_DIR, 'values');
    const drawableV24Dir = path.join(ANDROID_RES_DIR, 'drawable-v24');

    // Create directories
    [drawableDir, valuesDir, drawableV24Dir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // ic_launcher_background.xml (solid color)
    const backgroundXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="#2D5A4A"/>
</shape>`;

    fs.writeFileSync(path.join(drawableDir, 'ic_launcher_background.xml'), backgroundXml);
    console.log('✅ drawable/ic_launcher_background.xml');

    // ic_launcher.xml (adaptive icon)
    const launcherXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;

    fs.writeFileSync(path.join(drawableV24Dir, 'ic_launcher.xml'), launcherXml);
    fs.writeFileSync(path.join(drawableV24Dir, 'ic_launcher_round.xml'), launcherXml);
    console.log('✅ drawable-v24/ic_launcher.xml');
    console.log('✅ drawable-v24/ic_launcher_round.xml');

    // colors.xml for background
    const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#2D5A4A</color>
</resources>`;

    const colorsPath = path.join(valuesDir, 'colors.xml');
    if (!fs.existsSync(colorsPath)) {
        fs.writeFileSync(colorsPath, colorsXml);
        console.log('✅ values/colors.xml');
    }

    console.log('\n🎉 Android icons generated successfully!\n');
    console.log('Next steps:');
    console.log('1. Run: npx cap sync android');
    console.log('2. Open Android Studio: npx cap open android');
    console.log('3. Build & test on device/emulator');
}

generateIcons().catch(console.error);
