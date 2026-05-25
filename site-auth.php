<?php
declare(strict_types=1);

const SITE_AUTH_SESSION_KEY = 'faluche_site_authenticated';
const ADMIN_AUTH_SESSION_KEY = 'faluche_admin_session';
const CSRF_SESSION_KEY = 'faluche_csrf_token';
const SESSION_META_KEY = 'faluche_session_meta';
const AUTH_DATA_FILE = __DIR__ . '/data/auth.json';
const AUTH_GENEALOGY_DATA_FILE = __DIR__ . '/data/genealogy.json';
const AUTH_STORE_VERSION = 1;
const SITE_PASSWORD_VERSION = 2;
const AUTH_ENV_SITE_PASSWORD_HASH = 'FALUCHE_SITE_PASSWORD_HASH';
const AUTH_ENV_GENERAL_ADMIN_PASSWORD_HASH = 'FALUCHE_GENERAL_ADMIN_PASSWORD_HASH';
const SITE_LOGIN_MAX_ATTEMPTS = 8;
const SITE_LOGIN_WINDOW_SECONDS = 600;
const SITE_LOGIN_BLOCK_SECONDS = 900;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_WINDOW_SECONDS = 600;
const ADMIN_LOGIN_BLOCK_SECONDS = 900;
const AUTH_MIN_ADMIN_PASSWORD_LENGTH = 8;
const ADMIN_AUDIT_MAX_ENTRIES = 300;
const ADMIN_AUDIT_RECENT_LIMIT = 8;
const SESSION_IDLE_TIMEOUT_SECONDS = 3600;
const SESSION_ABSOLUTE_TIMEOUT_SECONDS = 21600;
const SESSION_REGENERATE_SECONDS = 900;
const HSTS_MAX_AGE_SECONDS = 31536000;

function site_csp_nonce(): string
{
    static $nonce = '';
    if ($nonce === '') {
        $nonce = base64_encode(random_bytes(16));
    }
    return $nonce;
}

function site_auth_start(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.cookie_httponly', '1');
        ini_set('session.cookie_samesite', 'Strict');
        session_name('FALUCHESESSID');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => site_auth_is_https(),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        session_start();
    }
    site_auth_refresh_session_security();
}

function site_auth_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (is_string($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? null) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
}

function site_auth_refresh_session_security(): void
{
    $now = time();
    $fingerprint = site_auth_session_fingerprint();
    $meta = is_array($_SESSION[SESSION_META_KEY] ?? null) ? $_SESSION[SESSION_META_KEY] : [];

    if (!isset($meta['createdAt'], $meta['lastSeenAt'], $meta['fingerprint'])) {
        $_SESSION[SESSION_META_KEY] = [
            'createdAt' => $now,
            'lastSeenAt' => $now,
            'lastRegeneratedAt' => $now,
            'fingerprint' => $fingerprint,
        ];
        return;
    }

    $createdAt = (int) ($meta['createdAt'] ?? 0);
    $lastSeenAt = (int) ($meta['lastSeenAt'] ?? 0);
    $lastRegeneratedAt = (int) ($meta['lastRegeneratedAt'] ?? 0);
    $hasAuthenticatedState = !empty($_SESSION[SITE_AUTH_SESSION_KEY]) || isset($_SESSION[ADMIN_AUTH_SESSION_KEY]);
    $expired = $hasAuthenticatedState && (
        $createdAt <= 0 ||
        $lastSeenAt <= 0 ||
        $now - $lastSeenAt > SESSION_IDLE_TIMEOUT_SECONDS ||
        $now - $createdAt > SESSION_ABSOLUTE_TIMEOUT_SECONDS ||
        !hash_equals((string) ($meta['fingerprint'] ?? ''), $fingerprint)
    );

    if ($expired) {
        $_SESSION = [SESSION_META_KEY => [
            'createdAt' => $now,
            'lastSeenAt' => $now,
            'lastRegeneratedAt' => $now,
            'fingerprint' => $fingerprint,
        ]];
        session_regenerate_id(true);
        return;
    }

    if ($now - $lastRegeneratedAt > SESSION_REGENERATE_SECONDS) {
        session_regenerate_id(true);
        $lastRegeneratedAt = $now;
    }

    $_SESSION[SESSION_META_KEY] = [
        'createdAt' => $createdAt ?: $now,
        'lastSeenAt' => $now,
        'lastRegeneratedAt' => $lastRegeneratedAt ?: $now,
        'fingerprint' => $fingerprint,
    ];
}

function site_auth_session_fingerprint(): string
{
    $agent = is_string($_SERVER['HTTP_USER_AGENT'] ?? null) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 200) : '';
    return hash('sha256', $agent);
}

function site_security_headers(bool $noStore = true): void
{
    $styleNonce = site_csp_nonce();

    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
    header(
        "Content-Security-Policy: default-src 'none'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' data:; script-src 'self'; script-src-attr 'none'; style-src 'self' 'nonce-{$styleNonce}'; style-src-elem 'self' 'nonce-{$styleNonce}'; style-src-attr 'unsafe-inline'; upgrade-insecure-requests"
    );
    if (site_auth_is_https()) {
        header('Strict-Transport-Security: max-age=' . HSTS_MAX_AGE_SECONDS . '; includeSubDomains');
    }
    if ($noStore) {
        header('Cache-Control: no-store');
    }
}

function site_csrf_token(): string
{
    site_auth_start();
    $token = is_string($_SESSION[CSRF_SESSION_KEY] ?? null) ? $_SESSION[CSRF_SESSION_KEY] : '';
    if ($token === '') {
        $token = bin2hex(random_bytes(32));
        $_SESSION[CSRF_SESSION_KEY] = $token;
    }
    return $token;
}

function site_auth_rotate_csrf_token(): string
{
    $token = bin2hex(random_bytes(32));
    $_SESSION[CSRF_SESSION_KEY] = $token;
    return $token;
}

function require_csrf_token(): void
{
    site_auth_start();
    if (!csrf_request_origin_is_valid()) {
        respond_auth_error('Origine de requete invalide.', 403);
    }
    $provided = is_string($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null) ? $_SERVER['HTTP_X_CSRF_TOKEN'] : '';
    if ($provided === '' && isset($_POST['csrfToken']) && is_string($_POST['csrfToken'])) {
        $provided = $_POST['csrfToken'];
    }
    if (!csrf_token_is_valid($provided)) {
        respond_auth_error('Jeton CSRF invalide.', 403);
    }
}

function csrf_request_origin_is_valid(): bool
{
    $expectedHost = strtolower(is_string($_SERVER['HTTP_HOST'] ?? null) ? (string) $_SERVER['HTTP_HOST'] : '');
    if ($expectedHost === '') {
        return true;
    }

    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $headerName) {
        $value = is_string($_SERVER[$headerName] ?? null) ? trim((string) $_SERVER[$headerName]) : '';
        if ($value === '') {
            continue;
        }
        $parts = parse_url($value);
        if (!is_array($parts) || !is_string($parts['host'] ?? null)) {
            return false;
        }
        $actualHost = strtolower((string) $parts['host']);
        if (isset($parts['port'])) {
            $actualHost .= ':' . (int) $parts['port'];
        }
        return hash_equals($expectedHost, $actualHost);
    }

    return true;
}

function csrf_token_is_valid(string $provided): bool
{
    site_auth_start();
    $expected = is_string($_SESSION[CSRF_SESSION_KEY] ?? null) ? $_SESSION[CSRF_SESSION_KEY] : '';
    return $expected !== '' && $provided !== '' && hash_equals($expected, $provided);
}

function site_auth_is_authenticated(): bool
{
    site_auth_start();
    return !empty($_SESSION[SITE_AUTH_SESSION_KEY]);
}

function site_auth_login(string $password): bool
{
    site_auth_start();
    if (site_auth_rate_limit_status()['blocked']) {
        return false;
    }

    $store = auth_store_read();
    $storedVersion = is_int($store['sitePasswordVersion'] ?? null) ? $store['sitePasswordVersion'] : 0;
    $storedHash = $storedVersion === SITE_PASSWORD_VERSION && is_string($store['sitePasswordHash'] ?? null)
        ? $store['sitePasswordHash']
        : '';

    $passwordHash = $storedHash !== '' ? $storedHash : auth_configured_site_password_hash();
    $matches = auth_verify_password($password, $passwordHash);
    site_auth_record_login_result($matches);
    if (!$matches) {
        return false;
    }

    if ($storedHash === '') {
        $store['sitePasswordHash'] = password_hash($password, PASSWORD_DEFAULT);
        $store['sitePasswordVersion'] = SITE_PASSWORD_VERSION;
        auth_store_write($store);
    }

    session_regenerate_id(true);
    site_auth_rotate_csrf_token();
    $_SESSION[SITE_AUTH_SESSION_KEY] = true;
    return true;
}

function site_auth_logout(): void
{
    site_auth_start();
    $_SESSION = [];
    if (session_id() !== '') {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'] ?? '/',
            'domain' => $params['domain'] ?? '',
            'secure' => (bool) ($params['secure'] ?? false),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        session_destroy();
    }
}

function require_site_auth(): void
{
    if (site_auth_is_authenticated()) {
        return;
    }

    respond_auth_error('Mot de passe du site requis.', 401);
}

function admin_auth_login(string $password): ?array
{
    site_auth_start();
    if (!site_auth_is_authenticated()) {
        return null;
    }

    $store = auth_store_read();
    $storedGeneralHash = is_string($store['generalAdminPasswordHash'] ?? null) ? $store['generalAdminPasswordHash'] : '';
    $generalHash = $storedGeneralHash !== '' ? $storedGeneralHash : auth_configured_general_admin_password_hash();
    if (auth_verify_password($password, $generalHash)) {
        if ($storedGeneralHash === '') {
            $store['generalAdminPasswordHash'] = password_hash($password, PASSWORD_DEFAULT);
            auth_store_write($store);
        }
        session_regenerate_id(true);
        site_auth_rotate_csrf_token();
        $session = ['level' => 'general', 'regionId' => '', 'requiresPasswordChange' => false];
        $_SESSION[ADMIN_AUTH_SESSION_KEY] = $session;
        return admin_auth_login_payload($session);
    }

    foreach (auth_regional_regions() as $region) {
        $regionId = is_scalar($region['id'] ?? null) ? (string) ($region['id'] ?? '') : '';
        $entry = is_array($store['regionalPasswords'][$regionId] ?? null) ? $store['regionalPasswords'][$regionId] : [];
        $hash = is_string($entry['passwordHash'] ?? null) ? $entry['passwordHash'] : '';
        if ($hash === '') {
            continue;
        }
        $matches = auth_verify_password($password, $hash);
        if (!$matches) {
            continue;
        }

        session_regenerate_id(true);
        site_auth_rotate_csrf_token();
        $session = ['level' => 'region', 'regionId' => $regionId, 'requiresPasswordChange' => false];
        $_SESSION[ADMIN_AUTH_SESSION_KEY] = $session;
        return admin_auth_login_payload($session);
    }

    return null;
}

function site_auth_rate_limit_status(): array
{
    return auth_rate_limit_status('siteLoginAttempts', site_auth_rate_limit_key());
}

function site_auth_record_login_result(bool $success): void
{
    auth_record_login_result(
        'siteLoginAttempts',
        site_auth_rate_limit_key(),
        $success,
        SITE_LOGIN_MAX_ATTEMPTS,
        SITE_LOGIN_WINDOW_SECONDS,
        SITE_LOGIN_BLOCK_SECONDS
    );
}

function site_auth_rate_limit_key(): string
{
    $ip = is_string($_SERVER['REMOTE_ADDR'] ?? null) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    $agent = substr(is_string($_SERVER['HTTP_USER_AGENT'] ?? null) ? $_SERVER['HTTP_USER_AGENT'] : '', 0, 160);
    return hash('sha256', 'site|' . $ip . '|' . $agent);
}

function admin_auth_rate_limit_status(): array
{
    return auth_rate_limit_status('adminLoginAttempts', admin_auth_rate_limit_key());
}

function admin_auth_record_login_result(bool $success): void
{
    auth_record_login_result(
        'adminLoginAttempts',
        admin_auth_rate_limit_key(),
        $success,
        ADMIN_LOGIN_MAX_ATTEMPTS,
        ADMIN_LOGIN_WINDOW_SECONDS,
        ADMIN_LOGIN_BLOCK_SECONDS
    );
}

function auth_rate_limit_status(string $storeKey, string $attemptKey): array
{
    $store = auth_store_read();
    $attempts = is_array($store[$storeKey] ?? null) ? $store[$storeKey] : [];
    $entry = is_array($attempts[$attemptKey] ?? null) ? $attempts[$attemptKey] : [];
    $blockedUntil = is_int($entry['blockedUntil'] ?? null) ? $entry['blockedUntil'] : (int) ($entry['blockedUntil'] ?? 0);
    $retryAfter = max(0, $blockedUntil - time());
    return [
        'blocked' => $retryAfter > 0,
        'retryAfter' => $retryAfter,
    ];
}

function auth_record_login_result(string $storeKey, string $attemptKey, bool $success, int $maxAttempts, int $windowSeconds, int $blockSeconds): void
{
    $store = auth_store_read();
    $store[$storeKey] = is_array($store[$storeKey] ?? null) ? $store[$storeKey] : [];
    auth_prune_login_attempts($store[$storeKey]);

    if ($success) {
        unset($store[$storeKey][$attemptKey]);
        auth_store_write($store);
        return;
    }

    $now = time();
    $entry = is_array($store[$storeKey][$attemptKey] ?? null) ? $store[$storeKey][$attemptKey] : [];
    $firstAttemptAt = is_int($entry['firstAttemptAt'] ?? null) ? $entry['firstAttemptAt'] : (int) ($entry['firstAttemptAt'] ?? 0);
    $count = is_int($entry['count'] ?? null) ? $entry['count'] : (int) ($entry['count'] ?? 0);
    if ($firstAttemptAt <= 0 || $now - $firstAttemptAt > $windowSeconds) {
        $firstAttemptAt = $now;
        $count = 0;
    }

    $count += 1;
    $store[$storeKey][$attemptKey] = [
        'count' => $count,
        'firstAttemptAt' => $firstAttemptAt,
        'lastAttemptAt' => $now,
        'blockedUntil' => $count >= $maxAttempts ? $now + $blockSeconds : 0,
    ];
    auth_store_write($store);
}

function admin_auth_rate_limit_key(): string
{
    $ip = is_string($_SERVER['REMOTE_ADDR'] ?? null) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    $agent = substr(is_string($_SERVER['HTTP_USER_AGENT'] ?? null) ? $_SERVER['HTTP_USER_AGENT'] : '', 0, 160);
    return hash('sha256', $ip . '|' . $agent);
}

function auth_prune_login_attempts(array &$attempts): void
{
    $now = time();
    foreach ($attempts as $key => $entry) {
        if (!is_array($entry)) {
            unset($attempts[$key]);
            continue;
        }
        $lastAttemptAt = is_int($entry['lastAttemptAt'] ?? null) ? $entry['lastAttemptAt'] : (int) ($entry['lastAttemptAt'] ?? 0);
        $blockedUntil = is_int($entry['blockedUntil'] ?? null) ? $entry['blockedUntil'] : (int) ($entry['blockedUntil'] ?? 0);
        if ($lastAttemptAt <= 0 || ($blockedUntil < $now && $lastAttemptAt < $now - 86400)) {
            unset($attempts[$key]);
        }
    }
}

function admin_auth_logout(): void
{
    site_auth_start();
    unset($_SESSION[ADMIN_AUTH_SESSION_KEY]);
    session_regenerate_id(true);
    site_auth_rotate_csrf_token();
}

function admin_auth_session(): ?array
{
    site_auth_start();
    $session = $_SESSION[ADMIN_AUTH_SESSION_KEY] ?? null;
    if (!is_array($session)) {
        return null;
    }

    $level = is_string($session['level'] ?? null) ? $session['level'] : '';
    $regionId = is_string($session['regionId'] ?? null) ? $session['regionId'] : '';
    if ($level === 'general') {
        return ['level' => 'general', 'regionId' => '', 'requiresPasswordChange' => false];
    }
    if ($level === 'region' && $regionId !== '') {
        return ['level' => 'region', 'regionId' => $regionId, 'requiresPasswordChange' => admin_auth_region_requires_password_change($regionId)];
    }

    return null;
}

function admin_auth_payload(?array $recentChanges = null): array
{
    $session = admin_auth_session();
    if ($session === null) {
        return ['authenticated' => false, 'level' => '', 'regionId' => '', 'requiresPasswordChange' => false, 'regions' => []];
    }

    $payload = [
        'authenticated' => true,
        'level' => $session['level'],
        'regionId' => $session['regionId'],
        'requiresPasswordChange' => !empty($session['requiresPasswordChange']),
        'regions' => admin_auth_region_summaries($session),
    ];
    if ($recentChanges !== null) {
        $payload['recentChanges'] = $recentChanges;
    }
    return $payload;
}

function admin_auth_login_payload(array $session): array
{
    $recentChanges = admin_auth_recent_changes($session);
    admin_auth_record_login_timestamp($session);
    return admin_auth_payload($recentChanges);
}

function admin_auth_requires_password_change(?array $session = null): bool
{
    $session = $session ?? admin_auth_session();
    return is_array($session)
        && ($session['level'] ?? '') === 'region'
        && !empty($session['requiresPasswordChange']);
}

function admin_auth_region_requires_password_change(string $regionId): bool
{
    $store = auth_store_read();
    $entry = is_array($store['regionalPasswords'][$regionId] ?? null) ? $store['regionalPasswords'][$regionId] : [];
    $hash = is_string($entry['passwordHash'] ?? null) ? $entry['passwordHash'] : '';
    return $hash === '';
}

function admin_auth_login_key(array $session): string
{
    if (($session['level'] ?? '') === 'general') {
        return 'general';
    }
    $regionId = is_string($session['regionId'] ?? null) ? (string) $session['regionId'] : '';
    return $regionId !== '' ? 'region:' . $regionId : 'unknown';
}

function admin_auth_record_login_timestamp(array $session): void
{
    $key = admin_auth_login_key($session);
    if ($key === 'unknown') {
        return;
    }
    $store = auth_store_read();
    $store['adminLastLoginAt'] = is_array($store['adminLastLoginAt'] ?? null) ? $store['adminLastLoginAt'] : [];
    $store['adminLastLoginAt'][$key] = time();
    auth_prune_admin_audit_log($store);
    auth_store_write($store);
}

function admin_auth_recent_changes(array $session): array
{
    $key = admin_auth_login_key($session);
    if ($key === 'unknown') {
        return [];
    }
    $store = auth_store_read();
    $lastLogins = is_array($store['adminLastLoginAt'] ?? null) ? $store['adminLastLoginAt'] : [];
    $lastLoginAt = is_int($lastLogins[$key] ?? null) ? $lastLogins[$key] : (int) ($lastLogins[$key] ?? 0);
    if ($lastLoginAt <= 0) {
        return [];
    }

    $entries = is_array($store['adminAuditLog'] ?? null) ? $store['adminAuditLog'] : [];
    $recent = array_values(array_filter($entries, static function ($entry) use ($session, $lastLoginAt): bool {
        if (!is_array($entry)) {
            return false;
        }
        $createdAtTs = is_int($entry['createdAtTs'] ?? null) ? $entry['createdAtTs'] : (int) ($entry['createdAtTs'] ?? 0);
        return $createdAtTs > $lastLoginAt && admin_auth_audit_entry_matches_session($entry, $session);
    }));
    usort($recent, static function ($a, $b): int {
        return ((int) ($b['createdAtTs'] ?? 0)) <=> ((int) ($a['createdAtTs'] ?? 0));
    });
    return array_slice(array_map('admin_auth_public_audit_entry', $recent), 0, ADMIN_AUDIT_RECENT_LIMIT);
}

function admin_auth_audit_entry_matches_session(array $entry, array $session): bool
{
    if (($session['level'] ?? '') === 'general') {
        return true;
    }
    $regionId = is_string($session['regionId'] ?? null) ? (string) $session['regionId'] : '';
    if ($regionId === '') {
        return false;
    }
    $scopeRegionIds = is_array($entry['scopeRegionIds'] ?? null) ? $entry['scopeRegionIds'] : [];
    return in_array($regionId, $scopeRegionIds, true);
}

function admin_auth_public_audit_entry(array $entry): array
{
    return [
        'createdAt' => is_string($entry['createdAt'] ?? null) ? $entry['createdAt'] : '',
        'summary' => is_string($entry['summary'] ?? null) ? $entry['summary'] : 'Modification des donnees',
        'actorLabel' => is_string($entry['actorLabel'] ?? null) ? $entry['actorLabel'] : 'Utilisateur',
    ];
}

function auth_record_admin_audit_event(array $event): void
{
    $summary = trim(is_string($event['summary'] ?? null) ? (string) $event['summary'] : '');
    if ($summary === '') {
        return;
    }
    $scopeRegionIds = array_values(array_unique(array_filter(
        array_map('strval', is_array($event['scopeRegionIds'] ?? null) ? $event['scopeRegionIds'] : []),
        static fn($id): bool => $id !== ''
    )));
    $now = time();
    $entry = [
        'id' => bin2hex(random_bytes(6)),
        'createdAt' => gmdate('c', $now),
        'createdAtTs' => $now,
        'summary' => substr($summary, 0, 240),
        'actorLabel' => trim(is_string($event['actorLabel'] ?? null) ? (string) $event['actorLabel'] : 'Utilisateur'),
        'scopeRegionIds' => $scopeRegionIds,
    ];

    $store = auth_store_read();
    $store['adminAuditLog'] = is_array($store['adminAuditLog'] ?? null) ? $store['adminAuditLog'] : [];
    $store['adminAuditLog'][] = $entry;
    auth_prune_admin_audit_log($store);
    auth_store_write($store);
}

function auth_prune_admin_audit_log(array &$store): void
{
    $entries = is_array($store['adminAuditLog'] ?? null) ? $store['adminAuditLog'] : [];
    $lastLogins = is_array($store['adminLastLoginAt'] ?? null) ? $store['adminLastLoginAt'] : [];
    $lastLogins = array_filter($lastLogins, static function ($value): bool {
        return (is_int($value) ? $value : (int) $value) > 0;
    });

    if (!$lastLogins) {
        $store['adminAuditLog'] = [];
        return;
    }

    $store['adminAuditLog'] = array_values(array_filter($entries, static function ($entry) use ($lastLogins): bool {
        if (!is_array($entry)) {
            return false;
        }
        $createdAtTs = is_int($entry['createdAtTs'] ?? null) ? $entry['createdAtTs'] : (int) ($entry['createdAtTs'] ?? 0);
        if ($createdAtTs <= 0) {
            return false;
        }

        $generalLastLoginAt = is_int($lastLogins['general'] ?? null) ? $lastLogins['general'] : (int) ($lastLogins['general'] ?? 0);
        if ($generalLastLoginAt > 0 && $createdAtTs > $generalLastLoginAt) {
            return true;
        }

        $scopeRegionIds = is_array($entry['scopeRegionIds'] ?? null) ? $entry['scopeRegionIds'] : [];
        foreach ($scopeRegionIds as $regionId) {
            $regionKey = 'region:' . (string) $regionId;
            $regionLastLoginAt = is_int($lastLogins[$regionKey] ?? null) ? $lastLogins[$regionKey] : (int) ($lastLogins[$regionKey] ?? 0);
            if ($regionLastLoginAt > 0 && $createdAtTs > $regionLastLoginAt) {
                return true;
            }
        }

        return false;
    }));

    if (count($store['adminAuditLog']) > ADMIN_AUDIT_MAX_ENTRIES) {
        $store['adminAuditLog'] = array_slice($store['adminAuditLog'], -ADMIN_AUDIT_MAX_ENTRIES);
    }
}

function admin_auth_is_general(): bool
{
    $session = admin_auth_session();
    return $session !== null && $session['level'] === 'general';
}

function require_general_admin_auth(): void
{
    if (admin_auth_is_general()) {
        return;
    }

    respond_auth_error('Acces administrateur general requis.', 403);
}

function admin_auth_can_manage_region(string $regionId): bool
{
    $session = admin_auth_session();
    if ($session === null) {
        return false;
    }
    return $session['level'] === 'general' || ($session['level'] === 'region' && $session['regionId'] === $regionId);
}

function admin_auth_change_regional_password(string $regionId, string $password): bool
{
    if (!admin_auth_can_manage_region($regionId) || !auth_region_exists($regionId)) {
        return false;
    }

    $store = auth_store_read();
    if (!isset($store['regionalPasswords']) || !is_array($store['regionalPasswords'])) {
        $store['regionalPasswords'] = [];
    }

    $password = trim($password);
    if ($password === '') {
        unset($store['regionalPasswords'][$regionId]);
    } else {
        $store['regionalPasswords'][$regionId] = [
            'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
            'updatedAt' => gmdate('c'),
        ];
    }

    return auth_store_write($store);
}

function auth_store_read(): array
{
    $default = [
        'version' => AUTH_STORE_VERSION,
        'sitePasswordVersion' => 0,
        'sitePasswordHash' => '',
        'generalAdminPasswordHash' => '',
        'regionalPasswords' => [],
        'siteLoginAttempts' => [],
        'adminLoginAttempts' => [],
        'adminLastLoginAt' => [],
        'adminAuditLog' => [],
    ];

    if (!is_file(AUTH_DATA_FILE)) {
        return $default;
    }

    $raw = file_get_contents(AUTH_DATA_FILE);
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data)) {
        return $default;
    }

    $store = array_merge($default, $data);
    if (!is_array($store['regionalPasswords'] ?? null)) {
        $store['regionalPasswords'] = [];
    }
    if (!is_array($store['adminLoginAttempts'] ?? null)) {
        $store['adminLoginAttempts'] = [];
    }
    if (!is_array($store['siteLoginAttempts'] ?? null)) {
        $store['siteLoginAttempts'] = [];
    }
    if (!is_array($store['adminLastLoginAt'] ?? null)) {
        $store['adminLastLoginAt'] = [];
    }
    if (!is_array($store['adminAuditLog'] ?? null)) {
        $store['adminAuditLog'] = [];
    }
    return $store;
}

function auth_store_write(array $store): bool
{
    $store['version'] = AUTH_STORE_VERSION;
    if (!isset($store['regionalPasswords']) || !is_array($store['regionalPasswords'])) {
        $store['regionalPasswords'] = [];
    }
    if (!isset($store['adminLoginAttempts']) || !is_array($store['adminLoginAttempts'])) {
        $store['adminLoginAttempts'] = [];
    }
    if (!isset($store['siteLoginAttempts']) || !is_array($store['siteLoginAttempts'])) {
        $store['siteLoginAttempts'] = [];
    }
    if (!isset($store['adminLastLoginAt']) || !is_array($store['adminLastLoginAt'])) {
        $store['adminLastLoginAt'] = [];
    }
    if (!isset($store['adminAuditLog']) || !is_array($store['adminAuditLog'])) {
        $store['adminAuditLog'] = [];
    }

    $directory = dirname(AUTH_DATA_FILE);
    if (!is_dir($directory) && !mkdir($directory, 0755, true)) {
        return false;
    }
    auth_protect_data_directory($directory);

    $json = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return false;
    }
    $temporaryPath = AUTH_DATA_FILE . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($temporaryPath, $json, LOCK_EX) === false) {
        return false;
    }
    if (!rename($temporaryPath, AUTH_DATA_FILE)) {
        @unlink($temporaryPath);
        return false;
    }
    return true;
}

function auth_protect_data_directory(string $directory): void
{
    $htaccess = rtrim($directory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . '.htaccess';
    if (!is_file($htaccess)) {
        @file_put_contents($htaccess, "Require all denied\nDeny from all\n", LOCK_EX);
    }
}

function auth_configured_site_password_hash(): string
{
    return auth_env(AUTH_ENV_SITE_PASSWORD_HASH);
}

function auth_configured_general_admin_password_hash(): string
{
    return auth_env(AUTH_ENV_GENERAL_ADMIN_PASSWORD_HASH);
}

function admin_auth_password_matches_general(string $password): bool
{
    $store = auth_store_read();
    $storedHash = is_string($store['generalAdminPasswordHash'] ?? null) ? $store['generalAdminPasswordHash'] : '';
    $hash = $storedHash !== '' ? $storedHash : auth_configured_general_admin_password_hash();
    return auth_verify_password($password, $hash);
}

function auth_env(string $name): string
{
    $value = getenv($name);
    return is_string($value) ? trim($value) : '';
}

function auth_verify_password(string $password, string $storedHash = ''): bool
{
    if ($storedHash !== '' && password_verify($password, $storedHash)) {
        return true;
    }
    return false;
}

function admin_auth_region_summaries(array $session): array
{
    $store = auth_store_read();
    $regions = auth_regional_regions();
    if ($session['level'] === 'region') {
        $regions = array_values(array_filter($regions, static function ($region) use ($session): bool {
            return is_array($region) && ($region['id'] ?? '') === $session['regionId'];
        }));
    }

    return array_values(array_map(static function (array $region) use ($store): array {
        $regionId = is_scalar($region['id'] ?? null) ? (string) ($region['id'] ?? '') : '';
        $entry = is_array($store['regionalPasswords'][$regionId] ?? null) ? $store['regionalPasswords'][$regionId] : [];
        $hasCustomPassword = is_string($entry['passwordHash'] ?? null) && $entry['passwordHash'] !== '';
        return [
            'id' => $regionId,
            'name' => is_scalar($region['name'] ?? null) ? (string) ($region['name'] ?? 'Region') : 'Region',
            'hasCustomPassword' => $hasCustomPassword,
            'requiresPasswordChange' => !$hasCustomPassword,
        ];
    }, $regions));
}

function auth_region_by_id(string $regionId): ?array
{
    foreach (auth_regional_regions() as $region) {
        if (($region['id'] ?? '') === $regionId) {
            return is_array($region) ? $region : null;
        }
    }
    return null;
}

function auth_region_exists(string $regionId): bool
{
    return auth_region_by_id($regionId) !== null;
}

function auth_regional_regions(): array
{
    $sqlRegions = auth_sql_regional_regions();
    if ($sqlRegions) {
        return $sqlRegions;
    }

    if (!is_file(AUTH_GENEALOGY_DATA_FILE)) {
        return [];
    }

    $raw = file_get_contents(AUTH_GENEALOGY_DATA_FILE);
    $data = json_decode($raw ?: '{}', true);
    $genealogies = is_array($data['genealogies'] ?? null) ? $data['genealogies'] : [];
    return array_values(array_filter($genealogies, 'auth_is_regional_genealogy'));
}

function auth_sql_regional_regions(): array
{
    require_once __DIR__ . '/api/database.php';
    if (!database_genealogy_read_enabled()) {
        return [];
    }

    require_once __DIR__ . '/api/genealogy_sql.php';
    $payload = genealogy_sql_read_payload();
    $genealogies = is_array($payload['genealogies'] ?? null) ? $payload['genealogies'] : [];
    return array_values(array_filter($genealogies, 'auth_is_regional_genealogy'));
}

function auth_is_regional_genealogy($genealogy): bool
{
    if (!is_array($genealogy)) {
        return false;
    }
    $rawType = $genealogy['type'] ?? $genealogy['level'] ?? $genealogy['scope'] ?? '';
    $type = auth_normalise_text(is_scalar($rawType) ? (string) $rawType : '');
    return in_array($type, ['region', 'regional', 'regionale', 'ville', 'city'], true);
}

function auth_normalise_text(string $value): string
{
    $value = strtr($value, [
        'À' => 'A',
        'Á' => 'A',
        'Â' => 'A',
        'Ã' => 'A',
        'Ä' => 'A',
        'Å' => 'A',
        'Æ' => 'AE',
        'Ç' => 'C',
        'È' => 'E',
        'É' => 'E',
        'Ê' => 'E',
        'Ë' => 'E',
        'Ì' => 'I',
        'Í' => 'I',
        'Î' => 'I',
        'Ï' => 'I',
        'Ñ' => 'N',
        'Ò' => 'O',
        'Ó' => 'O',
        'Ô' => 'O',
        'Õ' => 'O',
        'Ö' => 'O',
        'Œ' => 'OE',
        'Ù' => 'U',
        'Ú' => 'U',
        'Û' => 'U',
        'Ü' => 'U',
        'Ý' => 'Y',
        'Ÿ' => 'Y',
        'à' => 'a',
        'á' => 'a',
        'â' => 'a',
        'ã' => 'a',
        'ä' => 'a',
        'å' => 'a',
        'æ' => 'ae',
        'ç' => 'c',
        'è' => 'e',
        'é' => 'e',
        'ê' => 'e',
        'ë' => 'e',
        'ì' => 'i',
        'í' => 'i',
        'î' => 'i',
        'ï' => 'i',
        'ñ' => 'n',
        'ò' => 'o',
        'ó' => 'o',
        'ô' => 'o',
        'õ' => 'o',
        'ö' => 'o',
        'œ' => 'oe',
        'ù' => 'u',
        'ú' => 'u',
        'û' => 'u',
        'ü' => 'u',
        'ý' => 'y',
        'ÿ' => 'y',
    ]);
    $transliterated = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    $value = is_string($transliterated) && $transliterated !== '' ? $transliterated : $value;
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', ' ', $value);
    return trim((string) preg_replace('/\s+/', ' ', $value));
}

function auth_title_case(string $value): string
{
    $parts = preg_split('/\s+/', strtolower(trim($value)));
    $parts = array_filter($parts ?: [], static function ($part): bool {
        return $part !== '';
    });
    return implode(' ', array_map(static function ($part): string {
        return ucfirst($part);
    }, $parts));
}

function respond_auth_error(string $message, int $status): void
{
    http_response_code($status);
    site_security_headers();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}
