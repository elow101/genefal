<?php
declare(strict_types=1);

define('FALUCHE_GENEALOGY_LIBRARY_ONLY', true);
require __DIR__ . '/../api/genealogy.php';

if (PHP_SAPI !== 'cli') {
    header('Content-Type: text/plain; charset=utf-8');
}

if (!function_exists('migration_output')) {
    function migration_output(string $message): void
    {
        echo $message;
    }
}

if (!function_exists('migration_error')) {
    function migration_error(string $message): void
    {
        if (PHP_SAPI === 'cli' && defined('STDERR')) {
            fwrite(STDERR, $message);
            return;
        }
        echo $message;
    }
}

$payload = genealogy_sql_read_payload();
if (!is_array($payload)) {
    migration_error("Backup impossible: genealogie SQL indisponible ou vide.\n");
    exit(1);
}

$payload = migrate_genealogy_payload($payload);
if (database_read_enabled() && upcoming_sql_available()) {
    $payload['upcomingBaptisms'] = upcoming_sql_events();
}

$scriptArgs = PHP_SAPI === 'cli' && isset($argv) && is_array($argv) ? $argv : [];
$target = is_string($scriptArgs[1] ?? null) && trim((string) $scriptArgs[1]) !== ''
    ? (string) $scriptArgs[1]
    : __DIR__ . '/../data/genealogy-backup-' . gmdate('Ymd-His') . '.json';

$directory = dirname($target);
if (!is_dir($directory) && !mkdir($directory, 0755, true)) {
    migration_error("Backup impossible: dossier cible introuvable.\n");
    exit(1);
}
auth_protect_data_directory($directory);

$json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
if (!is_string($json) || !api_atomic_json_write($target, $json)) {
    migration_error("Backup impossible: ecriture JSON echouee.\n");
    exit(1);
}

$genealogyCount = count($payload['genealogies'] ?? []);
$personCount = 0;
foreach (is_array($payload['genealogies'] ?? null) ? $payload['genealogies'] : [] as $genealogy) {
    $personCount += count(is_array($genealogy['people'] ?? null) ? $genealogy['people'] : []);
}

migration_output("Backup genealogie SQL vers JSON termine.\n");
migration_output("- fichier: {$target}\n");
migration_output("- arbres: {$genealogyCount}\n");
migration_output("- fiches: {$personCount}\n");
