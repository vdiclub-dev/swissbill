<?php
/**
 * send_mail.php — Envoi d'email avec lien page web + pièce jointe PDF via serveur LWS
 * Brimot Nettoyage — Facturation
 *
 * POST JSON :
 * {
 *   "to":           "client@exemple.ch",
 *   "subject":      "Facture FAC-2026-0001 — Brimot Nettoyage",
 *   "body":         "Bonjour,\n\n...",
 *   "view_url":     "https://brimot.ch/admin/brimot/facture-view.html?id=...",  ← optionnel
 *   "pdf_base64":   "<base64 du PDF>",       ← optionnel
 *   "pdf_filename": "Facture_FAC-2026-0001.pdf"  ← optionnel
 * }
 *
 * Réponse : { "ok": true }  ou  { "ok": false, "error": "..." }
 *
 * ─── Configuration ─────────────────────────────────────────────────────────
 */

// ⚠️ Remplacez par votre adresse email créée dans votre espace LWS
define('MAIL_FROM_NAME',  'Brimot Nettoyage');
define('MAIL_FROM_EMAIL', 'info@brimot.ch');       // ← votre adresse LWS
define('MAIL_REPLY_TO',   'info@brimot.ch');

// Sécurité CORS — mettez votre domaine en production, ex: 'https://brimot.ch'
define('ALLOWED_ORIGIN', '*');

// ─── Fin configuration ───────────────────────────────────────────────────────

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { http_response_code(405); echo json_encode(['ok'=>false,'error'=>'Method Not Allowed']); exit; }

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'JSON invalide']); exit; }

$to      = isset($data['to'])      ? trim($data['to'])      : '';
$subject = isset($data['subject']) ? trim($data['subject']) : 'Message de Brimot Nettoyage';
$body    = isset($data['body'])    ? trim($data['body'])    : '';
$pdfB64    = isset($data['pdf_base64'])   ? $data['pdf_base64']   : '';
$pdfFile   = isset($data['pdf_filename']) ? trim($data['pdf_filename']) : 'facture.pdf';
$viewUrl   = isset($data['view_url'])    ? trim($data['view_url'])    : '';

if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'Adresse email destinataire invalide']);
    exit;
}

// ─── HTML de l'email ──────────────────────────────────────────────────────────
$bodyHtml  = nl2br(htmlspecialchars($body, ENT_QUOTES, 'UTF-8'));
$hasAttach = ($pdfB64 !== '');

// Bouton lien vers la page web de la facture
$viewUrlHtml = '';
if ($viewUrl !== '') {
    $viewUrlSafe = htmlspecialchars($viewUrl, ENT_QUOTES, 'UTF-8');
    $viewUrlHtml = '<div style="margin-top:20px;text-align:center;">' .
        '<a href="' . $viewUrlSafe . '" target="_blank" ' .
        'style="display:inline-block;background:#0ea5e9;color:#fff;padding:13px 28px;' .
        'border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;' .
        'letter-spacing:.3px;box-shadow:0 3px 12px rgba(14,165,233,.35);">'
        . '&#128196; Voir la facture en ligne</a></div>' .
        '<p style="text-align:center;font-size:10px;color:#bbb;margin-top:6px;">Ou copiez ce lien : ' .
        '<a href="' . $viewUrlSafe . '" style="color:#0ea5e9;font-size:10px;word-break:break-all;">' . $viewUrlSafe . '</a></p>';
}

$attachNote = $hasAttach
    ? '<p style="margin-top:12px;padding:8px 12px;background:#f0f9ff;border-left:3px solid #0ea5e9;font-size:11px;color:#0369a1;">&#128206; Le PDF de la facture est joint a cet email.</p>'
    : '';

$htmlEmail = <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body{font-family:Arial,sans-serif;font-size:14px;color:#222;background:#f4f4f4;margin:0;padding:0;}
    .wrap{max-width:600px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);}
    .hd{background:#0ea5e9;padding:22px 30px;}
    .hd h1{color:#fff;font-size:20px;margin:0;letter-spacing:-0.5px;}
    .hd p{color:rgba(255,255,255,.75);font-size:12px;margin:4px 0 0;}
    .ct{padding:28px 30px;line-height:1.65;}
    .ft{background:#f8f8f8;padding:14px 30px;font-size:11px;color:#999;border-top:1px solid #eee;}
    .ft a{color:#0ea5e9;text-decoration:none;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hd"><h1>Brimot Nettoyage</h1><p>Impasse des Griottes 3 · 1462 Yvonand</p></div>
    <div class="ct">{$bodyHtml}{$viewUrlHtml}{$attachNote}</div>
    <div class="ft">
      Brimot Nettoyage · Impasse des Griottes 3, 1462 Yvonand<br>
      <a href="mailto:info@brimot.ch">info@brimot.ch</a> · Ce message a ete genere automatiquement.
    </div>
  </div>
</body>
</html>
HTML;

// ─── Construction MIME ────────────────────────────────────────────────────────
$boundary    = '==_BRIMOT_' . md5(uniqid(mt_rand(), true));
$fromEncoded = '=?UTF-8?B?' . base64_encode(MAIL_FROM_NAME) . '?=';
$subjEncoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$headers  = "MIME-Version: 1.0\r\n";
$headers .= "From: {$fromEncoded} <" . MAIL_FROM_EMAIL . ">\r\n";
$headers .= "Reply-To: " . MAIL_REPLY_TO . "\r\n";
$headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
$headers .= "X-Priority: 3\r\n";

if ($hasAttach) {
    // Multipart/mixed → pièce jointe
    $headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n";

    $innerBoundary = '==_BODY_' . md5(uniqid(mt_rand(), true));

    $mailBody  = "--{$boundary}\r\n";
    $mailBody .= "Content-Type: multipart/alternative; boundary=\"{$innerBoundary}\"\r\n\r\n";

    // Texte brut
    $mailBody .= "--{$innerBoundary}\r\n";
    $mailBody .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $mailBody .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
    $mailBody .= quoted_printable_encode($body) . "\r\n\r\n";

    // HTML
    $mailBody .= "--{$innerBoundary}\r\n";
    $mailBody .= "Content-Type: text/html; charset=UTF-8\r\n";
    $mailBody .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
    $mailBody .= quoted_printable_encode($htmlEmail) . "\r\n\r\n";
    $mailBody .= "--{$innerBoundary}--\r\n\r\n";

    // PDF en pièce jointe
    // Nettoyer la base64 (supprimer éventuels sauts de ligne)
    $pdfData = base64_decode(str_replace(["\r", "\n", " "], '', $pdfB64));
    $pdfB64Clean = chunk_split(base64_encode($pdfData));

    $mailBody .= "--{$boundary}\r\n";
    $mailBody .= "Content-Type: application/pdf; name=\"{$pdfFile}\"\r\n";
    $mailBody .= "Content-Disposition: attachment; filename=\"{$pdfFile}\"\r\n";
    $mailBody .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $mailBody .= $pdfB64Clean . "\r\n";
    $mailBody .= "--{$boundary}--";

} else {
    // Pas de pièce jointe → multipart/alternative simple
    $headers .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";

    $mailBody  = "--{$boundary}\r\n";
    $mailBody .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $mailBody .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
    $mailBody .= quoted_printable_encode($body) . "\r\n\r\n";

    $mailBody .= "--{$boundary}\r\n";
    $mailBody .= "Content-Type: text/html; charset=UTF-8\r\n";
    $mailBody .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
    $mailBody .= quoted_printable_encode($htmlEmail) . "\r\n\r\n";
    $mailBody .= "--{$boundary}--";
}

// ─── Envoi ────────────────────────────────────────────────────────────────────
$sent = @mail($to, $subjEncoded, $mailBody, $headers);

if ($sent) {
    echo json_encode(['ok' => true, 'message' => 'Email envoyé à ' . $to]);
} else {
    $err = error_get_last();
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'mail() échoué : ' . ($err['message'] ?? 'erreur inconnue')]);
}
