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

$pdo = database_pdo();
if (!$pdo) {
    migration_error("Base SQL indisponible. Verifie SQL_ENABLED=1 et les variables DB_* dans .env.\n");
    exit(1);
}

try {
    database_execute_file($pdo, __DIR__ . '/../database/schema.sql');
    database_ensure_genealogy_sql_schema($pdo);
} catch (Throwable $exception) {
    migration_error("Erreur SQL pendant la preparation: " . $exception->getMessage() . "\n");
    exit(1);
}

$raw = read_genealogy_file();
$data = json_decode($raw ?: '[]', true);
$payload = migrate_genealogy_payload(is_array($data) ? $data : []);

if (!genealogy_sql_write_payload($payload)) {
    migration_error("Migration genealogie impossible. Consulte les logs PHP pour le detail SQL.\n");
    exit(1);
}

$genealogyCount = count($payload['genealogies'] ?? []);
$personCount = 0;
foreach (is_array($payload['genealogies'] ?? null) ? $payload['genealogies'] : [] as $genealogy) {
    $personCount += count(is_array($genealogy['people'] ?? null) ? $genealogy['people'] : []);
}

migration_output("Migration genealogie JSON vers SQL terminee.\n");
migration_output("- arbres: {$genealogyCount}\n");
migration_output("- fiches: {$personCount}\n");
migration_output("- source JSON conservee: data/genealogy.json\n");
