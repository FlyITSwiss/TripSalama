<?php
/**
 * Diagnostic script for avatar upload
 * DELETE AFTER DEBUGGING
 */

header('Content-Type: application/json');

$results = [];

// 1. Check upload directory
$uploadDir = dirname(__DIR__) . '/uploads/avatars';
$results['upload_dir'] = $uploadDir;
$results['upload_dir_exists'] = is_dir($uploadDir);
$results['upload_dir_writable'] = is_writable($uploadDir);

// 2. Check parent directory
$parentDir = dirname(__DIR__) . '/uploads';
$results['parent_dir'] = $parentDir;
$results['parent_dir_exists'] = is_dir($parentDir);
$results['parent_dir_writable'] = is_writable($parentDir);

// 3. Try to create directory if not exists
if (!is_dir($uploadDir)) {
    $results['mkdir_attempt'] = @mkdir($uploadDir, 0755, true);
    $results['mkdir_error'] = error_get_last();
}

// 4. Check GD library
$results['gd_loaded'] = extension_loaded('gd');
$results['gd_info'] = function_exists('gd_info') ? gd_info() : 'N/A';

// 5. Check PHP settings
$results['upload_max_filesize'] = ini_get('upload_max_filesize');
$results['post_max_size'] = ini_get('post_max_size');
$results['file_uploads'] = ini_get('file_uploads');
$results['upload_tmp_dir'] = ini_get('upload_tmp_dir') ?: sys_get_temp_dir();
$results['tmp_writable'] = is_writable($results['upload_tmp_dir']);

// 6. Check current user
$results['php_user'] = get_current_user();
$results['process_user'] = function_exists('posix_getpwuid') ? posix_getpwuid(posix_geteuid())['name'] : 'N/A';

// 7. List upload directory contents
if (is_dir($uploadDir)) {
    $results['upload_dir_contents'] = scandir($uploadDir);
}

// 8. Check DB connection
try {
    require_once dirname(__DIR__, 2) . '/backend/php/config/bootstrap.php';
    $db = getDbConnection();
    $results['db_connection'] = 'OK';
} catch (Throwable $e) {
    $results['db_connection'] = 'FAILED: ' . $e->getMessage();
}

echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
