<?php
declare(strict_types=1);

require __DIR__ . '/../site-auth.php';
require_site_auth();
require_general_admin_auth();

require __DIR__ . '/config.php';

site_security_headers();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Methode non autorisee. Utiliser POST.'], JSON_UNESCAPED_UNICODE);
    exit;
}

require_csrf_token();

$sourceFile = GENEALOGY_DATA_FILE;

// Vérifier que le fichier source existe
if (!is_file($sourceFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'Fichier genealogy.json introuvable.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Créer le dossier de backups si absent
$backupDir = dirname($sourceFile) . '/backups';
if (!is_dir($backupDir) && !mkdir($backupDir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['error' => 'Impossible de créer le dossier de backups.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Protéger le dossier backups avec .htaccess
auth_protect_data_directory($backupDir);

// Générer le nom de fichier horodaté
$timestamp = gmdate('Y-m-d-H-i-s');
$backupFile = $backupDir . '/genealogy-' . $timestamp . '.json';

// Obtenir les tailles avant copie
$originalSize = filesize($sourceFile);

// Copier le fichier
if (!copy($sourceFile, $backupFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Échec de la copie du fichier de backup.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Vérifier la taille du backup
$backupSize = filesize($backupFile);

// Réponse de succès
echo json_encode([
    'ok' => true,
    'backup_path' => $backupFile,
    'backup_filename' => 'genealogy-' . $timestamp . '.json',
    'original_size' => $originalSize,
    'backup_size' => $backupSize,
    'created_at' => gmdate('c'),
    'message' => 'Backup créé avec succès. Le fichier original genealogy.json est conservé.',
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
