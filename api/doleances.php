<?php
declare(strict_types=1);

require __DIR__ . '/../site-auth.php';
require __DIR__ . '/helpers.php';
require_site_auth();

require __DIR__ . '/config.php';

const DOLEANCE_SESSION_LIMIT = 5;
const DOLEANCE_SESSION_COUNT_KEY = 'faluche_doleance_count';
const MAX_DOLEANCE_BODY_BYTES = 1048576;

site_security_headers();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    require_general_admin_auth();
    api_respond(['doleances' => read_doleances()]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf_token();
    $body = api_read_json_body(MAX_DOLEANCE_BODY_BYTES);
    if (!is_array($body)) {
        api_respond(['error' => 'Requete invalide.'], 400);
    }

    $message = api_safe_text($body['message'] ?? '', 2000);
    if ($message === '') {
        api_respond(['error' => 'Message obligatoire.'], 400);
    }

    $currentCount = doleance_session_count();
    if ($currentCount >= DOLEANCE_SESSION_LIMIT) {
        api_respond([
            'error' => 'Limite de doleances atteinte pour cette session.',
            'limit' => DOLEANCE_SESSION_LIMIT,
            'remaining' => 0,
        ], 429);
    }

    $doleances = read_doleances();
    $doleances[] = normalise_doleance([
        'id' => 'doleance-' . time() . '-' . bin2hex(random_bytes(3)),
        'type' => $body['type'] ?? 'autre',
        'target' => $body['target'] ?? '',
        'message' => $message,
        'status' => 'pending',
        'createdAt' => gmdate('c'),
    ]);
    write_doleances($doleances);
    $newCount = increment_doleance_session_count($currentCount);
    api_respond([
        'ok' => true,
        'limit' => DOLEANCE_SESSION_LIMIT,
        'remaining' => max(0, DOLEANCE_SESSION_LIMIT - $newCount),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    require_csrf_token();
    $body = api_read_json_body(MAX_DOLEANCE_BODY_BYTES);
    if (!is_array($body)) {
        api_respond(['error' => 'Requete invalide.'], 400);
    }

    require_general_admin_auth();
    if (!isset($body['doleances']) || !is_array($body['doleances'])) {
        api_respond(['error' => 'Doleances invalides.'], 400);
    }

    write_doleances(array_map('normalise_doleance', $body['doleances']));
    api_respond(['ok' => true]);
}

api_respond(['error' => 'Methode non autorisee.'], 405);

function doleance_session_count(): int
{
    site_auth_start();
    $count = $_SESSION[DOLEANCE_SESSION_COUNT_KEY] ?? 0;
    if (is_int($count)) {
        return max(0, $count);
    }
    if (is_string($count) && ctype_digit($count)) {
        return (int) $count;
    }
    return 0;
}

function increment_doleance_session_count(int $currentCount): int
{
    site_auth_start();
    $newCount = $currentCount + 1;
    $_SESSION[DOLEANCE_SESSION_COUNT_KEY] = $newCount;
    return $newCount;
}

function read_doleances(): array
{
    if (!is_file(DOLEANCES_DATA_FILE)) {
        return [];
    }

    $raw = file_get_contents(DOLEANCES_DATA_FILE);
    $data = json_decode($raw ?: '[]', true);
    return is_array($data) ? array_values(array_map('normalise_doleance', $data)) : [];
}

function write_doleances(array $doleances): void
{
    $directory = dirname(DOLEANCES_DATA_FILE);
    if (!is_dir($directory) && !mkdir($directory, 0755, true)) {
        api_respond(['error' => 'Impossible de creer le dossier de donnees.'], 500);
    }
    auth_protect_data_directory($directory);

    $json = json_encode(array_values($doleances), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false || api_atomic_json_write(DOLEANCES_DATA_FILE, $json) === false) {
        api_respond(['error' => 'Impossible de sauvegarder les doleances.'], 500);
    }
}

function normalise_doleance($item): array
{
    $item = is_array($item) ? $item : [];
    $type = is_string($item['type'] ?? null) ? $item['type'] : 'autre';
    if (!in_array($type, ['bug', 'retrait', 'modification', 'autre'], true)) {
        $type = 'autre';
    }

    $message = api_safe_text($item['message'] ?? '', 2000);
    $status = ($item['status'] ?? '') === 'resolved' ? 'resolved' : 'pending';
    $createdAt = is_string($item['createdAt'] ?? null) && strtotime($item['createdAt']) !== false
        ? $item['createdAt']
        : gmdate('c');

    return [
        'id' => api_safe_id($item['id'] ?? ('doleance-' . bin2hex(random_bytes(6))), 80),
        'type' => $type,
        'target' => api_safe_text($item['target'] ?? '', 160),
        'message' => $message,
        'status' => $status,
        'createdAt' => $createdAt,
    ];
}
