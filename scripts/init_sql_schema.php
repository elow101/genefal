<?php
declare(strict_types=1);

require __DIR__ . '/../api/database.php';

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

migration_output("Initialisation du schema SQL...\n");
try {
    database_execute_file($pdo, __DIR__ . '/../database/schema.sql');
    database_ensure_genealogy_sql_schema($pdo);
} catch (Throwable $exception) {
    migration_error("Erreur SQL pendant l'initialisation: " . $exception->getMessage() . "\n");
    exit(1);
}

migration_output("Schema SQL initialise.\n");
foreach (database_diagnostic()['tables'] as $table => $count) {
    $label = $count === null ? 'non disponible' : (string) $count;
    migration_output("- {$table}: {$label}\n");
}
