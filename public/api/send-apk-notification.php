<?php
/**
 * API endpoint pour envoyer notification APK
 * Sécurisé par token
 */

header('Content-Type: application/json');

// Token de sécurité
$validToken = 'tripsalama-apk-notify-2026';
$providedToken = $_GET['token'] ?? $_POST['token'] ?? '';

if ($providedToken !== $validToken) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid token']);
    exit;
}

$to = 'tarik.gilani@stabilis-it.ch';
$subject = '🚀 TripSalama APK - ' . date('j M Y');

$releaseUrl = $_GET['url'] ?? 'https://github.com/FlyITSwiss/TripSalama/releases/tag/v1.0.0-debug';
$version = $_GET['version'] ?? 'v1.0.0-debug';
$size = $_GET['size'] ?? '47.24 MB';

$message = <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #1B4D3E 0%, #2D5A4A 100%); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">🚗 TripSalama</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Nouvelle APK disponible</p>
    </div>
    <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333;">Une nouvelle version de l'application est prête :</p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1B4D3E;">
            <p style="margin: 0 0 10px 0;"><strong>📦 Version:</strong> {$version}</p>
            <p style="margin: 0 0 10px 0;"><strong>💾 Taille:</strong> {$size}</p>
            <p style="margin: 0;"><strong>📅 Date:</strong> {$_SERVER['REQUEST_TIME'] ? date('d/m/Y H:i') : date('d/m/Y H:i')}</p>
        </div>

        <p style="text-align: center; margin: 30px 0;">
            <a href="{$releaseUrl}" style="background: #C9A962; color: #1B4D3E; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                📥 Télécharger l'APK
            </a>
        </p>

        <p style="font-size: 14px; color: #666; text-align: center;">
            Cliquez sur le bouton ci-dessus pour accéder à la page de téléchargement GitHub.
        </p>
    </div>
    <div style="background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #999;">
        TripSalama - Voyagez en toute sérénité
    </div>
</div>
</body>
</html>
HTML;

$headers = [
    'MIME-Version: 1.0',
    'Content-type: text/html; charset=UTF-8',
    'From: TripSalama <noreply@stabilis-it.ch>',
    'Reply-To: support@stabilis-it.ch'
];

$result = mail($to, $subject, $message, implode("\r\n", $headers));

echo json_encode([
    'success' => $result,
    'to' => $to,
    'subject' => $subject,
    'timestamp' => date('c')
]);
