/**
 * TripSalama - iOS Dependencies Patcher
 *
 * Patches the @capacitor-community/background-geolocation Package.swift
 * to be compatible with Capacitor 8.x
 *
 * This script runs automatically via npm postinstall
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_SWIFT_PATH = path.join(
    __dirname,
    '../node_modules/@capacitor-community/background-geolocation/Package.swift'
);

function patchBackgroundGeolocation() {
    console.log('Patching @capacitor-community/background-geolocation for Capacitor 8.x...');

    if (!fs.existsSync(PACKAGE_SWIFT_PATH)) {
        console.log('Package.swift not found, skipping patch (package may not be installed)');
        return;
    }

    let content = fs.readFileSync(PACKAGE_SWIFT_PATH, 'utf8');

    // Check if already patched
    if (content.includes('from: "8.0.0"')) {
        console.log('Package.swift already patched for Capacitor 8.x');
        return;
    }

    // Apply patch: change from "7.0.0" to "8.0.0"
    const originalContent = content;
    content = content.replace(
        /from:\s*"7\.0\.0"/g,
        'from: "8.0.0"'
    );

    if (content === originalContent) {
        console.log('No changes needed in Package.swift');
        return;
    }

    fs.writeFileSync(PACKAGE_SWIFT_PATH, content, 'utf8');
    console.log('Successfully patched Package.swift for Capacitor 8.x compatibility');
}

// Run the patch
patchBackgroundGeolocation();
