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

echo json_encode([
    'data_directory_exists' => is_dir($directory),
    'data_directory_writable' => is_writable($directory),
    'write_test' => $writeTest,
    'genealogy_file_exists' => is_file(GENEALOGY_DATA_FILE),
    'genealogy_file_size' => is_file(GENEALOGY_DATA_FILE) ? filesize(GENEALOGY_DATA_FILE) : 0,
    'doleances_file_exists' => is_file(DOLEANCES_DATA_FILE),
    'doleances_file_size' => is_file(DOLEANCES_DATA_FILE) ? filesize(DOLEANCES_DATA_FILE) : 0,
    'sql' => database_diagnostic(),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
