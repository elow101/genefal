<?php
declare(strict_types=1);

function api_respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function api_read_json_body(int $maxBytes): ?array
{
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) {
        api_respond(['error' => 'Requete JSON trop volumineuse.'], 413);
    }

    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : null;
}

function upcoming_read_json(string $path): array
{
    if (!is_file($path)) {
        return ['events' => [], 'subscriptions' => []];
    }
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data + ['events' => [], 'subscriptions' => []] : ['events' => [], 'subscriptions' => []];
}

function upcoming_write_json(string $path, array $payload): void
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0755, true)) {
        api_respond(['error' => 'Impossible de creer le dossier de donnees.'], 500);
    }
    auth_protect_data_directory($directory);
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if (!is_string($json) || !api_atomic_json_write($path, $json)) {
        api_respond(['error' => 'Impossible de sauvegarder les donnees evenements.'], 500);
    }
}

function api_atomic_json_write(string $path, string $json): bool
{
    $temporaryPath = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($temporaryPath, $json, LOCK_EX) === false) {
        return false;
    }
    if (!rename($temporaryPath, $path)) {
        @unlink($temporaryPath);
        return false;
    }
    return true;
}

function api_safe_id($value, int $maxLength = 100): string
{
    if (is_array($value) || is_object($value)) {
        return '';
    }
    $id = trim((string) $value);
    $transliterated = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $id);
    if (is_string($transliterated) && $transliterated !== '') {
        $id = $transliterated;
    }
    $id = preg_replace('/[^A-Za-z0-9_.:-]+/', '-', $id);
    $id = trim((string) $id, '-');
    return substr($id, 0, $maxLength);
}

function api_safe_text($value, int $maxLength): string
{
    if (is_array($value) || is_object($value)) {
        return '';
    }
    $text = strip_tags((string) $value);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text);
    $text = preg_replace('/\s+/u', ' ', (string) $text);
    $text = trim((string) $text);
    return function_exists('mb_substr') ? mb_substr($text, 0, $maxLength, 'UTF-8') : substr($text, 0, $maxLength);
}

function upcoming_normalise_scope($value): string
{
    $scope = api_safe_id($value ?? 'region', 40);
    return in_array($scope, ['national', 'region', 'family'], true) ? $scope : 'region';
}

function upcoming_safe_url($value): string
{
    $url = trim((string) $value);
    if ($url === '') {
        return '';
    }
    if (!preg_match('/^https?:\/\//i', $url)) {
        return '';
    }
    $filtered = filter_var($url, FILTER_VALIDATE_URL);
    return is_string($filtered) ? $filtered : '';
}

function upcoming_normalise_recurrence($value): string
{
    $recurrence = api_safe_id($value ?? 'none', 40);
    return in_array($recurrence, ['none', 'weekly', 'monthly', 'yearly'], true) ? $recurrence : 'none';
}
