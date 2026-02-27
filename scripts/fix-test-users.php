<?php
/**
 * TripSalama - Fix Test Users Script
 * Creates/updates test users with correct passwords
 *
 * Run on VPS: php /var/www/tripsalama/scripts/fix-test-users.php
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/php/bootstrap.php';

echo "=== TripSalama Test Users Setup ===\n\n";

try {
    $db = getDbConnection();

    $testUsers = [
        [
            'email' => 'passenger@tripsalama.ch',
            'password' => 'TripSalama2025!',
            'first_name' => 'Sophie',
            'last_name' => 'Passagère',
            'phone' => '+41791234569',
            'role' => 'passenger',
        ],
        [
            'email' => 'driver@tripsalama.ch',
            'password' => 'TripSalama2025!',
            'first_name' => 'Marie',
            'last_name' => 'Conductrice',
            'phone' => '+41791234568',
            'role' => 'driver',
        ],
        [
            'email' => 'admin@tripsalama.ch',
            'password' => 'TripSalama2025!',
            'first_name' => 'Admin',
            'last_name' => 'TripSalama',
            'phone' => '+41791234567',
            'role' => 'admin',
        ],
    ];

    foreach ($testUsers as $user) {
        $passwordHash = password_hash($user['password'], PASSWORD_DEFAULT);

        // Check if user exists
        $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$user['email']]);
        $existing = $stmt->fetch();

        if ($existing) {
            // Update existing user
            $stmt = $db->prepare('
                UPDATE users SET
                    password_hash = ?,
                    first_name = ?,
                    last_name = ?,
                    phone = ?,
                    is_verified = 1,
                    is_active = 1,
                    identity_verification_status = "verified"
                WHERE email = ?
            ');
            $stmt->execute([
                $passwordHash,
                $user['first_name'],
                $user['last_name'],
                $user['phone'],
                $user['email']
            ]);
            echo "✅ Updated: {$user['email']} ({$user['role']})\n";
        } else {
            // Create new user
            $stmt = $db->prepare('
                INSERT INTO users (
                    email, password_hash, first_name, last_name, phone, role,
                    is_verified, is_active, email_verified_at, identity_verification_status
                ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, NOW(), "verified")
            ');
            $stmt->execute([
                $user['email'],
                $passwordHash,
                $user['first_name'],
                $user['last_name'],
                $user['phone'],
                $user['role']
            ]);
            $userId = $db->lastInsertId();
            echo "✅ Created: {$user['email']} ({$user['role']}) - ID: $userId\n";

            // If driver, create driver_status
            if ($user['role'] === 'driver') {
                $stmt = $db->prepare('
                    INSERT IGNORE INTO driver_status (driver_id, is_available)
                    VALUES (?, 0)
                ');
                $stmt->execute([$userId]);
                echo "   → Driver status created\n";
            }
        }
    }

    echo "\n=== Test Users Ready ===\n";
    echo "Password for all accounts: TripSalama2025!\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
