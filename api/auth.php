<?php
declare(strict_types=1);

require __DIR__ . '/../site-auth.php';

site_security_headers();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Methode non autorisee.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$authenticated = site_auth_is_authenticated();
http_response_code($authenticated ? 200 : 401);
echo json_encode([
    'authenticated' => $authenticated,
    'csrfToken' => $authenticated ? site_csrf_token() : '',
], JSON_UNESCAPED_UNICODE);
