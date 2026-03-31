<?php
/**
 * send_mail.php — Envoi d'email via le serveur LWS (mail PHP natif)
 * Brimot Nettoyage — Facturation
 *
 * Appel : POST JSON  { "to":"...", "subject":"...", "body":"...", "facture_id":"..." }
 * Réponse : JSON     { "ok": true }  ou  { "ok": false, "error": "..." }
 *
 * ─── Configuration ─────────────────────────────────────────────────────────
 * Modifiez les constantes ci-dessous selon votre hébergement LWS.
 */

// Expéditeur affiché dans l'email
define('MAIL_FROM_NAME',  'Brimot Nettoyage');
define('MAIL_FROM_EMAIL', 'info@brimotnettoyage.ch');   // ← votre adresse email LWS

// Adresse de réponse (Reply-To) — peut être identique à FROM
define('MAIL_REPLY_TO',   'info@brimotnettoyage.ch');

// ─── Sécurité CORS ──────────────────────────────────────────────────────────
// Autorise uniquement les requêtes provenant de votre domaine
// Remplacez par votre vrai domaine, ex: 'https://brimotnettoyage.ch'
define('ALLOWED_ORIGIN', '*');   // '*' = tous (pratique pour dev), restreignez en prod

// ─── Fin configuration ───────────────────────────────────────────────────────

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Pré-flight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Uniquement POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Lire le corps JSON
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON invalide']);
    exit;
}

// Validation des champs obligatoires
$to      = isset($data['to'])      ? trim($data['to'])      : '';
$subject = isset($data['subject']) ? trim($data['subject']) : '';
$body    = isset($data['body'])    ? trim($data['body'])    : '';

if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Adresse email destinataire invalide']);
    exit;
}

if (!$subject) {
    $subject = 'Message de Brimot Nettoyage';
}

// ─── Construction de l'email HTML ────────────────────────────────────────────
$bodyHtml = nl2br(htmlspecialchars($body, ENT_QUOTES, 'UTF-8'));
$htmlEmail = <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>{$subject}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; color: #222; background: #f4f4f4; margin:0; padding:0; }
    .wrap { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #0ea5e9; padding: 22px 30px; }
    .header h1 { color: #fff; font-size: 20px; margin: 0; }
    .header p  { color: rgba(255,255,255,0.75); font-size: 12px; margin: 4px 0 0; }
    .content { padding: 28px 30px; line-height: 1.65; white-space: pre-wrap; word-wrap: break-word; }
    .footer { background: #f8f8f8; padding: 14px 30px; font-size: 11px; color: #999; border-top: 1px solid #eee; }
    .footer a { color: #0ea5e9; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>🧹 Brimot Nettoyage</h1>
      <p>Impasse des Griottes 3 · 1462 Yvonand</p>
    </div>
    <div class="content">{$bodyHtml}</div>
    <div class="footer">
      Brimot Nettoyage · Impasse des Griottes 3, 1462 Yvonand<br>
      <a href="mailto:info@brimotnettoyage.ch">info@brimotnettoyage.ch</a>
      &nbsp;·&nbsp; Ce message a été généré automatiquement.
    </div>
  </div>
</body>
</html>
HTML;

// ─── En-têtes MIME ────────────────────────────────────────────────────────────
$fromEncoded  = '=?UTF-8?B?' . base64_encode(MAIL_FROM_NAME) . '?=';
$boundary     = md5(uniqid(time()));

$headers  = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";
$headers .= "From: {$fromEncoded} <" . MAIL_FROM_EMAIL . ">\r\n";
$headers .= "Reply-To: " . MAIL_REPLY_TO . "\r\n";
$headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
$headers .= "X-Priority: 3\r\n";

// Corps multipart : texte brut + HTML
$mailBody  = "--{$boundary}\r\n";
$mailBody .= "Content-Type: text/plain; charset=UTF-8\r\n";
$mailBody .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
$mailBody .= quoted_printable_encode($body) . "\r\n\r\n";
$mailBody .= "--{$boundary}\r\n";
$mailBody .= "Content-Type: text/html; charset=UTF-8\r\n";
$mailBody .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
$mailBody .= quoted_printable_encode($htmlEmail) . "\r\n\r\n";
$mailBody .= "--{$boundary}--";

// ─── Envoi ─────────────────────────────────────────────────────────────────────
$subjectEncoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$sent = mail($to, $subjectEncoded, $mailBody, $headers);

if ($sent) {
    echo json_encode(['ok' => true, 'message' => 'Email envoyé à ' . $to]);
} else {
    // Récupérer l'erreur PHP si disponible
    $lastError = error_get_last();
    $errMsg    = isset($lastError['message']) ? $lastError['message'] : 'Erreur inconnue';
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'mail() a échoué : ' . $errMsg]);
}
