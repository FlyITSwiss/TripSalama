<?php
/**
 * TripSalama Build Notification Webhook
 * Called by GitHub Actions to send build notification emails via VPS SMTP
 *
 * This endpoint uses the same SMTP configuration as Helios (Office 365)
 */

// Security: Require API key
$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
$expectedKey = 'tripsalama-build-2026'; // Simple key for CI/CD

if ($apiKey !== $expectedKey) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get JSON body
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// Required fields
$status = $input['status'] ?? 'unknown';
$commit = $input['commit'] ?? 'N/A';
$branch = $input['branch'] ?? 'main';
$actor = $input['actor'] ?? 'GitHub';
$runUrl = $input['run_url'] ?? '#';
$message = $input['message'] ?? '';

// SMTP Configuration (same as Helios)
$smtpHost = 'smtp.office365.com';
$smtpPort = 587;
$smtpUser = 'information-contact@stabilis-it.ch';
$smtpPass = 'R$430881294312am';
$fromEmail = 'information-contact@stabilis-it.ch';
$fromName = 'TripSalama CI';
$toEmail = 'tarik.gilani@stabilis-it.ch';

// Build email
$isSuccess = ($status === 'success');
$statusEmoji = $isSuccess ? '✅' : '❌';
$statusText = $isSuccess ? 'Build réussi' : 'Build échoué';
$statusClass = $isSuccess ? 'status-success' : 'status-failure';
$subject = "🚀 TripSalama Android Build - $statusEmoji $statusText";

$htmlBody = <<<HTML
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Inter', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #2D5A4A 0%, #1a3d32 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .header p { margin: 10px 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 30px; }
    .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; }
    .status-success { background: #E6F9EF; color: #06C167; }
    .status-failure { background: #FFEFEC; color: #E11900; }
    .info-box { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #666; font-size: 14px; }
    .info-value { font-weight: 600; color: #333; }
    .btn { display: inline-block; background: #2D5A4A; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 10px 5px; }
    .btn:hover { background: #1a3d32; }
    .btn-secondary { background: #276EF1; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚗 TripSalama</h1>
      <p>Build Android - Notification automatique</p>
    </div>
    <div class="content">
      <p style="text-align: center;">
        <span class="status-badge $statusClass">
          $statusEmoji $statusText
        </span>
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Commit</span>
          <span class="info-value">$commit</span>
        </div>
        <div class="info-row">
          <span class="info-label">Branche</span>
          <span class="info-value">$branch</span>
        </div>
        <div class="info-row">
          <span class="info-label">Auteur</span>
          <span class="info-value">$actor</span>
        </div>
        <div class="info-row">
          <span class="info-label">Message</span>
          <span class="info-value">$message</span>
        </div>
      </div>

      <p style="text-align: center; margin-top: 30px;">
        <a href="https://stabilis-it.ch/internal/tripsalama" class="btn">🌐 Ouvrir TripSalama</a>
        <a href="$runUrl" class="btn btn-secondary">📋 Voir le build</a>
      </p>
    </div>
    <div class="footer">
      <p>TripSalama - VTC sécurisé pour femmes</p>
      <p>© 2026 Stabilis IT - Genève, Suisse</p>
    </div>
  </div>
</body>
</html>
HTML;

// Send via SMTP
$result = sendViaSMTP($toEmail, $subject, $htmlBody, $smtpHost, $smtpPort, $smtpUser, $smtpPass, $fromEmail, $fromName);

header('Content-Type: application/json');
if ($result) {
    echo json_encode(['success' => true, 'message' => 'Email sent']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to send email']);
}

/**
 * Send email via SMTP with STARTTLS (Office 365)
 */
function sendViaSMTP(string $to, string $subject, string $htmlBody,
    string $smtpHost, int $smtpPort, string $smtpUser, string $smtpPass,
    string $fromEmail, string $fromName): bool
{
    $socket = @fsockopen($smtpHost, $smtpPort, $errno, $errstr, 30);
    if (!$socket) {
        error_log("SMTP Connection failed: $errstr ($errno)");
        return false;
    }

    try {
        $response = smtpGetResponse($socket);
        if (strpos($response, '220') !== 0) {
            fclose($socket);
            return false;
        }

        smtpSendCommand($socket, "EHLO localhost");
        smtpGetResponse($socket);

        // STARTTLS
        smtpSendCommand($socket, "STARTTLS");
        $response = smtpGetResponse($socket);
        if (strpos($response, '220') === 0) {
            stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            smtpSendCommand($socket, "EHLO localhost");
            smtpGetResponse($socket);
        }

        // AUTH LOGIN
        smtpSendCommand($socket, "AUTH LOGIN");
        smtpGetResponse($socket);
        smtpSendCommand($socket, base64_encode($smtpUser));
        smtpGetResponse($socket);
        smtpSendCommand($socket, base64_encode($smtpPass));
        $response = smtpGetResponse($socket);

        if (strpos($response, '235') !== 0) {
            error_log("SMTP Auth failed: $response");
            fclose($socket);
            return false;
        }

        smtpSendCommand($socket, "MAIL FROM:<$fromEmail>");
        smtpGetResponse($socket);
        smtpSendCommand($socket, "RCPT TO:<$to>");
        smtpGetResponse($socket);
        smtpSendCommand($socket, "DATA");
        $response = smtpGetResponse($socket);

        if (strpos($response, '354') !== 0) {
            fclose($socket);
            return false;
        }

        // Build message
        $boundary = md5(uniqid(time()));
        $message = "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$fromEmail>\r\n";
        $message .= "To: $to\r\n";
        $message .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
        $message .= "MIME-Version: 1.0\r\n";
        $message .= "Content-Type: text/html; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: base64\r\n";
        $message .= "\r\n";
        $message .= chunk_split(base64_encode($htmlBody)) . "\r\n";
        $message .= ".";

        smtpSendCommand($socket, $message);
        $response = smtpGetResponse($socket);

        smtpSendCommand($socket, "QUIT");
        fclose($socket);

        return strpos($response, '250') === 0;

    } catch (Exception $e) {
        error_log("SMTP Exception: " . $e->getMessage());
        if ($socket) fclose($socket);
        return false;
    }
}

function smtpSendCommand($socket, string $command): void {
    fwrite($socket, $command . "\r\n");
}

function smtpGetResponse($socket): string {
    $response = '';
    while ($line = fgets($socket, 515)) {
        $response .= $line;
        if (isset($line[3]) && $line[3] === ' ') break;
    }
    return trim($response);
}
