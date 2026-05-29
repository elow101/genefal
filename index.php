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
      :root {
        color-scheme: dark;
        --background: oklch(0.16 0.02 240);
        --foreground: oklch(0.97 0.01 240);
        --card: oklch(0.21 0.02 240 / 0.68);
        --card-strong: oklch(0.21 0.02 240 / 0.86);
        --muted-foreground: oklch(0.68 0.02 240);
        --border: oklch(1 0 0 / 0.10);
        --primary: oklch(0.78 0.15 195);
        --primary-foreground: oklch(0.15 0.02 240);
        --accent: oklch(0.78 0.16 160);
        --warning: oklch(0.75 0.17 60);
        --destructive: oklch(0.65 0.22 25);
        --radius-xl: 1.25rem;
        --radius-2xl: 1.5rem;
        --radius-pill: 9999px;
        --cyan-glow: oklch(0.78 0.15 195);
      }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(ellipse at 20% 0%, color-mix(in oklab, var(--primary) 20%, transparent), transparent 44%),
          radial-gradient(ellipse at 90% 15%, color-mix(in oklab, var(--accent) 14%, transparent), transparent 48%),
          radial-gradient(ellipse at 85% 100%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 52%),
          var(--background);
        color: var(--foreground);
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.014) 1px, transparent 1px);
        background-size: 64px 64px;
        mask-image: linear-gradient(to bottom, rgba(0,0,0,.65), transparent 72%);
      }
      form {
        width: min(100%, 460px);
        display: grid;
        gap: 16px;
        padding: clamp(22px, 5vw, 32px);
        border: 1px solid var(--border);
        border-radius: var(--radius-2xl);
        background:
          radial-gradient(ellipse at top right, color-mix(in oklab, var(--primary) 15%, transparent), transparent 52%),
          color-mix(in oklab, var(--card-strong) 88%, transparent);
        box-shadow: 0 24px 70px rgba(0,0,0,.38);
        backdrop-filter: blur(24px) saturate(160%);
        -webkit-backdrop-filter: blur(24px) saturate(160%);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .brand-mark {
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border: 1px solid color-mix(in oklab, var(--primary) 38%, transparent);
        border-radius: 50%;
        background: color-mix(in oklab, var(--primary) 18%, transparent);
        color: var(--primary);
        font-weight: 900;
        box-shadow:
          0 0 0 6px color-mix(in oklab, var(--primary) 10%, transparent),
          0 0 26px color-mix(in oklab, var(--cyan-glow) 28%, transparent);
      }
      .brand-copy {
        min-width: 0;
      }
      h1 {
        margin: 2px 0 0;
        font-size: clamp(1.25rem, 4vw, 1.65rem);
        line-height: 1.1;
        text-shadow: 0 0 22px color-mix(in oklab, var(--cyan-glow) 30%, transparent);
      }
      label {
        display: grid;
        gap: 8px;
        color: var(--muted-foreground);
        font-size: .78rem;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      input, button {
        min-height: 46px;
        border-radius: var(--radius-xl);
        border: 1px solid var(--border);
        font: inherit;
      }
      input {
        padding: 0 14px;
        background: color-mix(in oklab, white 8%, transparent);
        color: var(--foreground);
        outline: none;
      }
      input:focus {
        border-color: color-mix(in oklab, var(--primary) 52%, transparent);
        box-shadow:
          0 0 0 1px color-mix(in oklab, var(--primary) 28%, transparent),
          0 10px 32px -18px color-mix(in oklab, var(--cyan-glow) 70%, transparent);
      }
      button {
        border-color: color-mix(in oklab, var(--primary) 52%, transparent);
        border-radius: var(--radius-pill);
        background: var(--primary);
        color: var(--primary-foreground);
        font-weight: 900;
        cursor: pointer;
        box-shadow:
          0 0 0 1px color-mix(in oklab, var(--cyan-glow) 35%, transparent),
          0 12px 34px -14px color-mix(in oklab, var(--cyan-glow) 72%, transparent);
      }
      button:hover, button:focus-visible {
        filter: brightness(1.06);
      }
      p { margin: 0; }
      .error {
        border: 1px solid color-mix(in oklab, var(--destructive) 38%, transparent);
        border-radius: var(--radius-xl);
        background: color-mix(in oklab, var(--destructive) 12%, transparent);
        color: color-mix(in oklab, var(--destructive) 78%, white);
        padding: 10px 12px;
      }
      .hint {
        color: var(--muted-foreground);
        font-size: .86rem;
        line-height: 1.45;
      }
      .hint strong { color: var(--foreground); }
      .warning {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        border: 1px solid color-mix(in oklab, var(--warning) 42%, transparent);
        border-radius: var(--radius-xl);
        background: color-mix(in oklab, var(--warning) 12%, transparent);
        color: var(--warning);
        font-size: .82rem;
        line-height: 1.45;
        padding: 10px 12px;
      }
      .warning::before { content: "!"; flex-shrink: 0; font-weight: 900; }
      .beta-warning {
        border: 1px solid color-mix(in oklab, var(--primary) 38%, transparent);
        border-radius: var(--radius-xl);
        background: color-mix(in oklab, var(--primary) 12%, transparent);
        color: color-mix(in oklab, var(--foreground) 88%, var(--primary));
        font-size: .9rem;
        line-height: 1.5;
        padding: 12px 14px;
      }
      .beta-warning strong {
        display: block;
        color: var(--foreground);
        margin-bottom: 4px;
      }
    </style>
  </head>
  <body>
    <form method="post" autocomplete="off">
      <div class="brand">
        <span class="brand-mark">F</span>
        <div class="brand-copy">
          <h1>Genefaluche</h1>
        </div>
      </div>
      <p class="beta-warning"><strong>Version bêta : le site est encore en cours d’amélioration.</strong>Si vous avez une proposition d’amélioration, une modification à suggérer ou un bug à signaler, merci de l’envoyer via l’espace doléance après connexion.</p>
      <p class="warning">Pas toutes les traditions permettent aux imp&eacute;trants de voir leur g&eacute;n&eacute;alogie.<br>Ne montrez pas ce site &agrave; n&rsquo;importe qui.</p>
      <p class="hint"><strong>Indice :</strong> question de rapidit&eacute; et ann&eacute;e de cr&eacute;ation de la coiffe.</p>
      <input name="csrfToken" type="hidden" value="' . htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') . '" />
      <label>Mot de passe
        <input name="sitePassword" type="password" autofocus required />
      </label>' .
      ($error !== '' ? '<p class="error">' . htmlspecialchars($error, ENT_QUOTES, 'UTF-8') . '</p>' : '') .
      '<button type="submit">Entrer</button>
      <p class="warning accent-hint" style="display:none">Il y a un accent, gogol.</p>
    </form>
    <script nonce="' . htmlspecialchars($styleNonce, ENT_QUOTES, 'UTF-8') . '">
    (function(){
      var input = document.querySelector("input[name=sitePassword]");
      var hint = document.querySelector(".accent-hint");
      var form = document.querySelector("form");
      form.addEventListener("submit", function(e){
        var val = input.value;
        if(val && !/[àâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/.test(val)){
          e.preventDefault();
          hint.style.display = "";
        } else {
          hint.style.display = "none";
        }
      });
      input.addEventListener("input", function(){ hint.style.display = "none"; });
    })();
    </script>
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
