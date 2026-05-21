<?php
declare(strict_types=1);

require __DIR__ . '/site-auth.php';

const SITE_PAGE_TOKEN_SESSION_KEY = 'faluche_site_page_token';

site_security_headers();

if (isset($_GET['logout'])) {
    $logoutToken = is_string($_GET['csrfToken'] ?? null) ? $_GET['csrfToken'] : '';
    if (csrf_token_is_valid($logoutToken)) {
        site_auth_logout();
    }
    header('Location: ./');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = is_string($_POST['sitePassword'] ?? null) ? $_POST['sitePassword'] : '';
    $csrfToken = is_string($_POST['csrfToken'] ?? null) ? $_POST['csrfToken'] : '';
    $rateLimit = site_auth_rate_limit_status();
    if (!csrf_token_is_valid($csrfToken)) {
        $error = 'Session expiree, recharge la page.';
    } elseif (!empty($rateLimit['blocked'])) {
        $minutes = max(1, (int) ceil(((int) ($rateLimit['retryAfter'] ?? 0)) / 60));
        $error = "Trop d'essais. Reessaie dans {$minutes} minute(s).";
    } elseif (site_auth_login($password)) {
        site_auth_start();
        $token = bin2hex(random_bytes(16));
        $_SESSION[SITE_PAGE_TOKEN_SESSION_KEY] = $token;
        header('Location: ./?access=' . rawurlencode($token));
        exit;
    } else {
        $error = 'Mot de passe incorrect.';
    }
}

$accessToken = is_string($_GET['access'] ?? null) ? $_GET['access'] : '';
$sessionToken = '';
if ($accessToken !== '') {
    site_auth_start();
    $sessionToken = is_string($_SESSION[SITE_PAGE_TOKEN_SESSION_KEY] ?? null) ? $_SESSION[SITE_PAGE_TOKEN_SESSION_KEY] : '';
}
$isAuthenticatedForThisPage = $accessToken !== '' && $sessionToken !== '' && hash_equals($sessionToken, $accessToken);
if ($isAuthenticatedForThisPage) {
    unset($_SESSION[SITE_PAGE_TOKEN_SESSION_KEY]);
}

if (!$isAuthenticatedForThisPage) {
    site_auth_logout();
    $csrfToken = site_csrf_token();
    $styleNonce = site_csp_nonce();
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html>
<html class="theme-dark" lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Acces protege - Faluche Nationale</title>
    <style nonce="' . htmlspecialchars($styleNonce, ENT_QUOTES, 'UTF-8') . '">
      :root { color-scheme: dark; --accent: #1e98a3; }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #171d1b;
        color: #f4f8f7;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      form {
        width: min(100%, 380px);
        display: grid;
        gap: 14px;
        padding: 24px;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 8px;
        background: #202824;
      }
      h1 { margin: 0; font-size: 1.35rem; }
      label { display: grid; gap: 8px; color: #d8e5e2; }
      input, button {
        min-height: 46px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,.18);
        font: inherit;
      }
      input { padding: 0 12px; background: #17201d; color: #fff; }
      button { background: var(--accent); color: #071311; font-weight: 700; cursor: pointer; }
      p { margin: 0; }
      .error { color: #ffb4b4; }
      .hint {
        color: #b8d8d5;
        font-size: .86rem;
        line-height: 1.45;
      }
      .hint strong { color: #f4f8f7; }
      .warning {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        border: 1px solid rgba(180,122,22,.45);
        border-radius: 8px;
        background: rgba(180,122,22,.1);
        color: #f0c46f;
        font-size: .82rem;
        line-height: 1.45;
        padding: 10px 12px;
      }
      .warning::before { content: "⚠️"; flex-shrink: 0; }
    </style>
  </head>
  <body>
    <form method="post" autocomplete="off">
      <h1>Faluche Nationale</h1>
      <p class="warning">Pas toutes les traditions permettent aux imp&eacute;trants de voir leur g&eacute;n&eacute;alogie.<br>Ne montrez pas ce site &agrave; n&rsquo;importe qui.</p>
      <p class="hint"><strong>Indice :</strong> question de rapidit&eacute; et ann&eacute;e de cr&eacute;ation de la coiffe.</p>
      <input name="csrfToken" type="hidden" value="' . htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') . '" />
      <label>Mot de passe
        <input name="sitePassword" type="password" autofocus required />
      </label>' .
      ($error !== '' ? '<p class="error">' . htmlspecialchars($error, ENT_QUOTES, 'UTF-8') . '</p>' : '') .
      '<button type="submit">Entrer</button>
    </form>
  </body>
</html>';
    exit;
}

header('Content-Type: text/html; charset=utf-8');
$vueIndex = __DIR__ . '/frontend/dist/index.html';
if (!is_file($vueIndex)) {
    http_response_code(503);
    echo '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Build requis</title><body><h1>Frontend indisponible</h1><p>Le build Vue est absent. Lance <code>npm run frontend:build</code> avant de publier.</p></body></html>';
    exit;
}
readfile($vueIndex);
