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

// Déterminer si c'est un dry run
$isDryRun = false;
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $isDryRun = ($_GET['dryRun'] ?? 'false') === 'true';
} else {
    require_csrf_token();
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    $isDryRun = ($body['dryRun'] ?? false) === true;
}

// Vérifier que SQL est activé
if (!database_enabled()) {
    http_response_code(400);
    echo json_encode(['error' => 'SQL_ENABLED n\'est pas actif. Configurez d\'abord le .env.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Vérifier la connexion PDO
$pdo = database_pdo();
if (!$pdo) {
    http_response_code(500);
    echo json_encode(['error' => 'Connexion PDO échouée. Vérifiez DB_HOST, DB_NAME, DB_USER, DB_PASSWORD.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Vérifier que genealogy.json existe
if (!is_file(GENEALOGY_DATA_FILE)) {
    http_response_code(404);
    echo json_encode(['error' => 'data/genealogy.json introuvable.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Charger genealogy.php comme librairie (sans exécuter l'endpoint)
define('FALUCHE_GENEALOGY_LIBRARY_ONLY', true);
require __DIR__ . '/genealogy.php';

// Lire le fichier JSON
$raw = file_get_contents(GENEALOGY_DATA_FILE);
$data = json_decode($raw ?: '[]', true);
if (!is_array($data)) {
    http_response_code(500);
    echo json_encode(['error' => 'Impossible de parser genealogy.json.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Appliquer la migration/normalisation du payload
$payload = migrate_genealogy_payload($data);

// Compter les données
$genealogies = $payload['genealogies'] ?? [];
$peopleCount = 0;
foreach ($genealogies as $genealogy) {
    if (is_array($genealogy) && is_array($genealogy['people'] ?? null)) {
        $peopleCount += count($genealogy['people']);
    }
}

// Mode dry run : on s'arrête ici
if ($isDryRun) {
    echo json_encode([
        'ok' => true,
        'dry_run' => true,
        'genealogies_count' => count($genealogies),
        'people_count' => $peopleCount,
        'message' => 'Mode simulation (dryRun). Aucune donnée n\'a été écrite en SQL.',
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// Mode réel : écriture en SQL
if (!database_genealogy_write_enabled()) {
    http_response_code(400);
    echo json_encode([
        'error' => 'SQL_WRITE_GENEALOGY n\'est pas activé. Activez-le dans .env pour permettre l\'écriture SQL.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Écrire en SQL
$sqlWritten = genealogy_sql_write_payload($payload);

if (!$sqlWritten) {
    http_response_code(500);
    echo json_encode(['error' => 'Échec de l\'écriture SQL. Consultez les logs serveur.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Récupérer les compteurs après écriture
$tablesAfter = [];
try {
    foreach (['genealogies', 'people', 'genealogy_people'] as $table) {
        $tablesAfter[$table] = (int) $pdo->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn();
    }
} catch (Throwable $e) {
    // Ignorer les erreurs de comptage
}

echo json_encode([
    'ok' => true,
    'genealogies_count' => count($genealogies),
    'people_count' => $peopleCount,
    'tables_after' => $tablesAfter,
    'message' => 'Migration réussie. Les données ont été écrites en SQL. Le fichier genealogy.json original est conservé.',
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
