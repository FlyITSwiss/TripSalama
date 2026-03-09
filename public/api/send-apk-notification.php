<?php
/**
 * API endpoint pour envoyer notification APK via SMTP
 * Utilise PHPMailer avec config SMTP Infomaniak
 */

header('Content-Type: application/json');

// Token de sécurité
$token = $_GET['token'] ?? '';
if ($token !== 'tripsalama-apk-notify-2026') {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}

// Charger PHPMailer
$phpmailerPath = __DIR__ . '/../../backend/php/Vendor/PHPMailer';
require_once $phpmailerPath . '/Exception.php';
require_once $phpmailerPath . '/PHPMailer.php';
require_once $phpmailerPath . '/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// Paramètres
$to = $_GET['email'] ?? 'tarik.gilani@stabilis-it.ch';
$version = $_GET['version'] ?? 'v1.0.0';
$size = $_GET['size'] ?? '47 MB';
$downloadUrl = 'https://github.com/FlyITSwiss/TripSalama/releases/tag/v1.0.0-debug';

// Config SMTP depuis env ou valeurs par défaut Infomaniak
$smtpHost = getenv('MAIL_HOST') ?: 'mail.infomaniak.com';
$smtpPort = (int)(getenv('MAIL_PORT') ?: 587);
$smtpUser = getenv('SMTP_USERNAME') ?: '';
$smtpPass = getenv('SMTP_PASSWORD') ?: '';
$fromEmail = 'noreply@stabilis-it.ch';
$fromName = 'TripSalama';

// Debug mode pour diagnostic
$debug = isset($_GET['debug']);

try {
    $mail = new PHPMailer(true);

    // Configuration serveur
    if ($debug) {
        $mail->SMTPDebug = SMTP::DEBUG_SERVER;
    }
    $mail->isSMTP();
    $mail->Host = $smtpHost;
    $mail->SMTPAuth = true;
    $mail->Username = $smtpUser;
    $mail->Password = $smtpPass;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = $smtpPort;
    $mail->CharSet = 'UTF-8';

    // Expéditeur et destinataire
    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($to);

    // Contenu HTML
    $mail->isHTML(true);
    $mail->Subject = 'TripSalama APK - ' . date('j M Y');

    $mail->Body = '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1B4D3E 0%, #2D5A4A 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px; background: #f8f9fa; }
        .info { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #1B4D3E; }
        .btn { display: inline-block; background: #C9A962; color: #1B4D3E; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>TripSalama</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Nouvelle APK disponible</p>
        </div>
        <div class="content">
            <div class="info">
                <p><strong>Version:</strong> ' . htmlspecialchars($version) . '</p>
                <p><strong>Taille:</strong> ' . htmlspecialchars($size) . '</p>
                <p><strong>Date:</strong> ' . date('d/m/Y H:i') . '</p>
            </div>
            <p style="text-align: center;">
                <a href="' . $downloadUrl . '" class="btn">Télécharger APK</a>
            </p>
            <p style="font-size: 14px; color: #666;">
                <strong>Instructions:</strong><br>
                1. Cliquez sur le lien ci-dessus<br>
                2. Téléchargez le fichier APK<br>
                3. Installez-le sur votre téléphone Android
            </p>
        </div>
        <div class="footer">
            <p>TripSalama - Service VTC réservé aux femmes</p>
        </div>
    </div>
</body>
</html>';

    // Version texte
    $mail->AltBody = "TripSalama - Nouvelle APK disponible\n\n"
        . "Version: $version\n"
        . "Taille: $size\n"
        . "Date: " . date('d/m/Y H:i') . "\n\n"
        . "Télécharger: $downloadUrl";

    $mail->send();

    echo json_encode([
        'success' => true,
        'to' => $to,
        'message' => 'Email envoyé avec succès'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $mail->ErrorInfo,
        'smtp_host' => $smtpHost,
        'smtp_user' => $smtpUser ? substr($smtpUser, 0, 3) . '***' : '(empty)'
    ]);
}
