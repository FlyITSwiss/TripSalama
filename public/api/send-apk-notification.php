<?php
/**
 * API endpoint pour envoyer notification APK
 */

header('Content-Type: application/json');

$token = $_GET['token'] ?? '';
if ($token !== 'tripsalama-apk-notify-2026') {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}

$to = 'tarik.gilani@stabilis-it.ch';
$subject = 'TripSalama APK - ' . date('j M Y');
$version = $_GET['version'] ?? 'v1.0.0';
$size = $_GET['size'] ?? '47 MB';
$url = 'https://github.com/FlyITSwiss/TripSalama/releases/tag/v1.0.0-debug';

$message = '<html><body style="font-family:Arial,sans-serif;padding:20px;">';
$message .= '<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">';
$message .= '<div style="background:#1B4D3E;color:#fff;padding:30px;text-align:center;">';
$message .= '<h1 style="margin:0;">TripSalama</h1>';
$message .= '<p style="margin:10px 0 0 0;">Nouvelle APK disponible</p>';
$message .= '</div>';
$message .= '<div style="padding:30px;">';
$message .= '<p><strong>Version:</strong> ' . htmlspecialchars($version) . '</p>';
$message .= '<p><strong>Taille:</strong> ' . htmlspecialchars($size) . '</p>';
$message .= '<p><strong>Date:</strong> ' . date('d/m/Y H:i') . '</p>';
$message .= '<p style="text-align:center;margin:30px 0;">';
$message .= '<a href="' . $url . '" style="background:#C9A962;color:#1B4D3E;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Telecharger APK</a>';
$message .= '</p>';
$message .= '</div></div>';
$message .= '</body></html>';

$headers = "MIME-Version: 1.0\r\n";
$headers .= "Content-type: text/html; charset=UTF-8\r\n";
$headers .= "From: TripSalama <noreply@stabilis-it.ch>\r\n";

$result = @mail($to, $subject, $message, $headers);

echo json_encode([
    'success' => $result,
    'to' => $to,
    'message' => $result ? 'Email sent' : 'Failed to send'
]);
