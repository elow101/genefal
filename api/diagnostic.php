<?php
declare(strict_types=1);

require __DIR__ . '/../site-auth.php';
require_site_auth();
require_general_admin_auth();

require __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

site_security_headers();
header('Content-Type: application/json; charset=utf-8');

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['error' => 'Methode non autorisee.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$directory = dirname(GENEALOGY_DATA_FILE);
$writeTest = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf_token();
    $created = is_dir($directory) || mkdir($directory, 0755, true);
    auth_protect_data_directory($directory);
    $testFile = $directory . '/write-test.txt';
    $writeTest = $created && file_put_contents($testFile, 'ok', LOCK_EX) !== false;
    if ($writeTest) {
        @unlink($testFile);
    }
}

$envPath = __DIR__ . '/../.env';
$envFound = is_file($envPath);

$sqlDiagnostic = database_diagnostic();
$safeNextStep = calculate_safe_next_step($sqlDiagnostic, $envFound);

echo json_encode([
    'data_directory_exists' => is_dir($directory),
    'data_directory_writable' => is_writable($directory),
    'write_test' => $writeTest,
    'genealogy_file_exists' => is_file(GENEALOGY_DATA_FILE),
    'genealogy_file_size' => is_file(GENEALOGY_DATA_FILE) ? filesize(GENEALOGY_DATA_FILE) : 0,
    'doleances_file_exists' => is_file(DOLEANCES_DATA_FILE),
    'doleances_file_size' => is_file(DOLEANCES_DATA_FILE) ? filesize(DOLEANCES_DATA_FILE) : 0,
    'env' => [
        'file_found' => $envFound,
        'db_host_set' => database_env('DB_HOST') !== '',
        'db_name_set' => database_env('DB_NAME') !== '',
        'db_user_set' => database_env('DB_USER') !== '',
        'sql_enabled' => database_enabled(),
    ],
    'sql' => $sqlDiagnostic,
    'safe_next_step' => $safeNextStep,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

function calculate_safe_next_step(array $sqlDiag, bool $envFound): string
{
    // Phase A : JSON only - pas de .env ou SQL non configuré
    if (!$envFound || !$sqlDiag['configured']) {
        return 'configure_env';
    }

    // Phase B : SQL connecté mais écriture généalogie désactivée
    if (!$sqlDiag['connected']) {
        return 'configure_env';
    }

    if (!$sqlDiag['write_genealogy_enabled']) {
        return 'enable_sql_write';
    }

    // Vérifier si les tables généalogiques sont remplies
    $genealogiesCount = $sqlDiag['tables']['genealogies'] ?? 0;
    $peopleCount = $sqlDiag['tables']['people'] ?? 0;

    // Phase B/C : SQL_WRITE actif mais tables vides → besoin de migration
    if ($genealogiesCount === 0 || $peopleCount === 0) {
        return 'trigger_json_to_sql_sync';
    }

    // Phase C : Tables remplies mais lecture SQL désactivée
    if (!$sqlDiag['read_genealogy_enabled']) {
        return 'enable_sql_read';
    }

    // Phase D : Tout est actif et rempli → JSON write peut être désactivé (optionnel)
    if ($sqlDiag['write_genealogy_json_enabled']) {
        return 'disable_json_write_optional';
    }

    return 'complete';
}
