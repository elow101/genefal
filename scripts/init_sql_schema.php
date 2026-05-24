<?php
declare(strict_types=1);

require __DIR__ . '/../api/database.php';

$pdo = database_pdo();
if (!$pdo) {
    fwrite(STDERR, "Base SQL indisponible. Verifie SQL_ENABLED=1 et les variables DB_* dans .env.\n");
    exit(1);
}

database_execute_file($pdo, __DIR__ . '/../database/schema.sql');

echo "Schema SQL initialise.\n";
foreach (database_diagnostic()['tables'] as $table => $count) {
    $label = $count === null ? 'non disponible' : (string) $count;
    echo "- {$table}: {$label}\n";
}
