<?php

declare(strict_types=1);

/**
 * TripSalama - API User (Profil)
 *
 * Endpoints:
 * - POST ?action=upload-avatar : Upload photo de profil
 * - GET ?action=profile : Obtenir le profil
 */

require_once '_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = getAction();

try {
    // Authentification requise pour toutes les actions
    requireAuth();

    switch ($action) {
        case 'upload-avatar':
            if ($method !== 'POST') {
                errorResponse(__('error.generic'), 405);
            }
            requireCsrf();
            handleAvatarUpload();
            break;

        case 'profile':
            if ($method !== 'GET') {
                errorResponse(__('error.generic'), 405);
            }
            handleGetProfile();
            break;

        default:
            errorResponse(__('error.not_found'), 404);
    }
} catch (Throwable $e) {
    error_log('API User error: ' . $e->getMessage());
    errorResponse(__('error.generic'), 500);
}

/**
 * Upload de photo de profil
 */
function handleAvatarUpload(): never
{
    $user = current_user();
    $userId = (int) $user['id'];

    // Vérifier qu'un fichier a été uploadé
    if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
        $errorCode = $_FILES['avatar']['error'] ?? UPLOAD_ERR_NO_FILE;
        $errorMsg = match ($errorCode) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => __('validation.file_too_large'),
            UPLOAD_ERR_NO_FILE => __('validation.required_field'),
            default => __('error.generic'),
        };
        errorResponse($errorMsg, 400);
    }

    $file = $_FILES['avatar'];

    // Valider le type MIME
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, $allowedTypes, true)) {
        errorResponse(__('validation.invalid_file_type'), 400);
    }

    // Valider la taille (max 5 Mo)
    $maxSize = 5 * 1024 * 1024;
    if ($file['size'] > $maxSize) {
        errorResponse(__('validation.file_too_large'), 400);
    }

    // Créer le répertoire d'upload si nécessaire
    $uploadDir = dirname(__DIR__) . '/uploads/avatars';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Générer un nom de fichier unique
    $extension = match ($mimeType) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        default => 'jpg',
    };
    $filename = "avatar_{$userId}_" . time() . ".{$extension}";
    $filepath = $uploadDir . '/' . $filename;

    // Déplacer le fichier uploadé
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        errorResponse(__('error.generic'), 500);
    }

    // Redimensionner l'image si trop grande
    resizeImage($filepath, 400, 400);

    // Chemin relatif pour la base de données
    $avatarPath = '/uploads/avatars/' . $filename;

    // Supprimer l'ancienne photo si elle existe
    $db = app()->get('db');
    $stmt = $db->prepare('SELECT avatar_path FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $oldAvatar = $stmt->fetchColumn();

    if ($oldAvatar && strpos($oldAvatar, '/uploads/avatars/') === 0) {
        $oldPath = dirname(__DIR__) . $oldAvatar;
        if (file_exists($oldPath) && $oldPath !== $filepath) {
            @unlink($oldPath);
        }
    }

    // Mettre à jour la base de données
    $stmt = $db->prepare('UPDATE users SET avatar_path = ?, updated_at = NOW() WHERE id = ?');
    $stmt->execute([$avatarPath, $userId]);

    // Mettre à jour la session
    $_SESSION['user']['avatar_path'] = $avatarPath;

    successResponse([
        'avatar_path' => $avatarPath,
        'avatar_url' => base_url(ltrim($avatarPath, '/')),
    ], __('profile.avatar_updated'));
}

/**
 * Obtenir le profil de l'utilisateur connecté
 */
function handleGetProfile(): never
{
    $user = current_user();
    $userId = (int) $user['id'];

    $db = app()->get('db');
    $stmt = $db->prepare('
        SELECT id, email, first_name, last_name, phone, role, avatar_path,
               is_verified, created_at
        FROM users WHERE id = ?
    ');
    $stmt->execute([$userId]);
    $userData = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$userData) {
        errorResponse(__('error.not_found'), 404);
    }

    // Ajouter l'URL complète de l'avatar
    if (!empty($userData['avatar_path'])) {
        $userData['avatar_url'] = base_url(ltrim($userData['avatar_path'], '/'));
    }

    successResponse($userData);
}

/**
 * Redimensionner une image
 */
function resizeImage(string $filepath, int $maxWidth, int $maxHeight): void
{
    $imageInfo = getimagesize($filepath);
    if ($imageInfo === false) {
        return;
    }

    [$width, $height, $type] = $imageInfo;

    // Pas besoin de redimensionner si déjà assez petit
    if ($width <= $maxWidth && $height <= $maxHeight) {
        return;
    }

    // Calculer les nouvelles dimensions
    $ratio = min($maxWidth / $width, $maxHeight / $height);
    $newWidth = (int) round($width * $ratio);
    $newHeight = (int) round($height * $ratio);

    // Créer l'image source
    $source = match ($type) {
        IMAGETYPE_JPEG => imagecreatefromjpeg($filepath),
        IMAGETYPE_PNG => imagecreatefrompng($filepath),
        IMAGETYPE_GIF => imagecreatefromgif($filepath),
        IMAGETYPE_WEBP => imagecreatefromwebp($filepath),
        default => null,
    };

    if ($source === null) {
        return;
    }

    // Créer l'image destination
    $destination = imagecreatetruecolor($newWidth, $newHeight);

    // Préserver la transparence pour PNG et GIF
    if ($type === IMAGETYPE_PNG || $type === IMAGETYPE_GIF) {
        imagealphablending($destination, false);
        imagesavealpha($destination, true);
        $transparent = imagecolorallocatealpha($destination, 0, 0, 0, 127);
        imagefill($destination, 0, 0, $transparent);
    }

    // Redimensionner
    imagecopyresampled(
        $destination, $source,
        0, 0, 0, 0,
        $newWidth, $newHeight, $width, $height
    );

    // Sauvegarder
    match ($type) {
        IMAGETYPE_JPEG => imagejpeg($destination, $filepath, 85),
        IMAGETYPE_PNG => imagepng($destination, $filepath, 8),
        IMAGETYPE_GIF => imagegif($destination, $filepath),
        IMAGETYPE_WEBP => imagewebp($destination, $filepath, 85),
        default => null,
    };

    imagedestroy($source);
    imagedestroy($destination);
}
