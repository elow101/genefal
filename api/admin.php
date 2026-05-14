<?php
declare(strict_types=1);

require __DIR__ . '/../site-auth.php';
require __DIR__ . '/helpers.php';
require_site_auth();

const MAX_ADMIN_BODY_BYTES = 65536;

site_security_headers();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    api_respond(['admin' => admin_auth_payload()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_respond(['error' => 'Methode non autorisee.'], 405);
}

require_csrf_token();

$body = api_read_json_body(MAX_ADMIN_BODY_BYTES);
if (!is_array($body)) {
    api_respond(['error' => 'Requete invalide.'], 400);
}

$action = is_string($body['action'] ?? null) ? $body['action'] : '';

if ($action === 'login') {
    $rateLimit = admin_auth_rate_limit_status();
    if (!empty($rateLimit['blocked'])) {
        $retryAfter = (int) ($rateLimit['retryAfter'] ?? 0);
        $minutes = max(1, (int) ceil($retryAfter / 60));
        api_respond([
            'error' => "Trop d'essais administrateur. Reessaie dans {$minutes} minute(s).",
            'retryAfter' => $retryAfter,
        ], 429);
    }

    $password = is_string($body['password'] ?? null) ? $body['password'] : '';
    $admin = admin_auth_login($password);
    admin_auth_record_login_result($admin !== null);
    if ($admin === null) {
        api_respond(['error' => 'Mot de passe administrateur incorrect.'], 403);
    }
    api_respond(['admin' => $admin]);
}

if ($action === 'logout') {
    admin_auth_logout();
    api_respond(['ok' => true, 'admin' => admin_auth_payload()]);
}

if ($action === 'change-region-password') {
    $regionId = is_string($body['regionId'] ?? null) ? trim($body['regionId']) : '';
    $password = is_string($body['password'] ?? null) ? trim($body['password']) : '';
    if ($regionId === '') {
        api_respond(['error' => 'Region invalide.'], 400);
    }
    $region = auth_region_by_id($regionId);
    if ($region === null) {
        api_respond(['error' => 'Region invalide.'], 400);
    }
    $adminSession = admin_auth_session();
    if (($adminSession['level'] ?? '') === 'region' && ($adminSession['regionId'] ?? '') === $regionId && $password === '') {
        api_respond(['error' => 'Choisis un nouveau mot de passe regional.'], 400);
    }
    if ($password !== '' && admin_auth_password_matches_general($password)) {
        api_respond(['error' => 'Ce mot de passe est reserve a l admin general.'], 400);
    }
    if ($password !== '' && strlen($password) < AUTH_MIN_ADMIN_PASSWORD_LENGTH) {
        api_respond(['error' => 'Le mot de passe regional doit contenir au moins ' . AUTH_MIN_ADMIN_PASSWORD_LENGTH . ' caracteres.'], 400);
    }
    if (!admin_auth_change_regional_password($regionId, $password)) {
        api_respond(['error' => 'Impossible de modifier ce mot de passe regional.'], 403);
    }
    api_respond(['ok' => true, 'admin' => admin_auth_payload()]);
}

api_respond(['error' => 'Action inconnue.'], 400);
