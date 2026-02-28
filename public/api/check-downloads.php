<?php
/**
 * TripSalama - Diagnostic Downloads
 * Vérifie si les fichiers APK existent et sont accessibles
 */

header('Content-Type: application/json');

$downloadsDir = __DIR__ . '/../downloads';
$result = [
    'downloads_dir' => $downloadsDir,
    'exists' => file_exists($downloadsDir),
    'is_dir' => is_dir($downloadsDir),
    'is_readable' => is_readable($downloadsDir),
    'permissions' => file_exists($downloadsDir) ? substr(sprintf('%o', fileperms($downloadsDir)), -4) : 'N/A',
    'files' => []
];

if (is_dir($downloadsDir)) {
    $files = scandir($downloadsDir);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;

        $filepath = $downloadsDir . '/' . $file;
        $result['files'][$file] = [
            'size' => filesize($filepath),
            'size_mb' => round(filesize($filepath) / 1024 / 1024, 2),
            'permissions' => substr(sprintf('%o', fileperms($filepath)), -4),
            'is_readable' => is_readable($filepath),
            'modified' => date('Y-m-d H:i:s', filemtime($filepath))
        ];
    }
}

echo json_encode($result, JSON_PRETTY_PRINT);
