<?php
declare(strict_types=1);

require_once __DIR__ . '/database.php';

function genealogy_sql_available(): bool
{
    return database_pdo() instanceof PDO;
}

function genealogy_sql_read_payload(): ?array
{
    $pdo = database_pdo();
    if (!$pdo) {
        return null;
    }

    try {
        $genealogyRows = $pdo
            ->query("SELECT * FROM genealogies ORDER BY CASE type WHEN 'national' THEN 0 WHEN 'region' THEN 1 ELSE 2 END, name ASC")
            ->fetchAll();
        if (!is_array($genealogyRows) || count($genealogyRows) === 0) {
            return null;
        }

        $peopleRows = $pdo
            ->query('SELECT * FROM genealogy_people ORDER BY genealogy_id ASC, created_at ASC, person_id ASC')
            ->fetchAll();
        $peopleByGenealogy = [];
        foreach (is_array($peopleRows) ? $peopleRows : [] as $row) {
            $genealogyId = (string) ($row['genealogy_id'] ?? '');
            if ($genealogyId === '') {
                continue;
            }
            $person = genealogy_sql_decode_object($row['person_json'] ?? null);
            if ($person) {
                $person['id'] = (string) ($row['person_id'] ?? ($person['id'] ?? ''));
                genealogy_sql_apply_filiere_columns($person, $row);
                $peopleByGenealogy[$genealogyId][] = $person;
            }
        }

        $genealogies = [];
        foreach ($genealogyRows as $row) {
            $genealogy = genealogy_sql_genealogy_from_row($row);
            $genealogy['people'] = $peopleByGenealogy[$genealogy['id']] ?? [];
            $genealogies[] = $genealogy;
        }

        return [
            'schemaVersion' => 1,
            'roleResetVersion' => genealogy_sql_setting_int('roleResetVersion'),
            'activeGenealogyId' => genealogy_sql_setting('activeGenealogyId'),
            'genealogies' => $genealogies,
            'upcomingBaptisms' => [],
        ];
    } catch (Throwable $exception) {
        error_log('Genealogy SQL read error: ' . $exception->getMessage());
        return null;
    }
}

function genealogy_sql_read_summary_payload(): ?array
{
    if (!genealogy_sql_available()) {
        return null;
    }

    try {
        $pdo = database_connection();
        $genealogyRows = $pdo
            ->query("SELECT * FROM genealogies ORDER BY CASE type WHEN 'national' THEN 0 WHEN 'region' THEN 1 ELSE 2 END, name ASC")
            ->fetchAll();
        if (!is_array($genealogyRows) || count($genealogyRows) === 0) {
            return null;
        }

        $countRows = $pdo
            ->query('SELECT genealogy_id, COUNT(*) AS people_count FROM genealogy_people GROUP BY genealogy_id')
            ->fetchAll();
        $peopleCounts = [];
        foreach (is_array($countRows) ? $countRows : [] as $row) {
            $peopleCounts[(string) ($row['genealogy_id'] ?? '')] = (int) ($row['people_count'] ?? 0);
        }

        $genealogies = [];
        foreach ($genealogyRows as $row) {
            $genealogy = genealogy_sql_genealogy_from_row($row);
            $genealogy['people'] = [];
            $genealogy['peopleCount'] = $peopleCounts[$genealogy['id']] ?? 0;
            $genealogies[] = $genealogy;
        }

        return [
            'schemaVersion' => 1,
            'roleResetVersion' => genealogy_sql_setting_int('roleResetVersion'),
            'activeGenealogyId' => genealogy_sql_setting('activeGenealogyId'),
            'genealogies' => $genealogies,
            'upcomingBaptisms' => [],
            'summary' => true,
        ];
    } catch (Throwable $error) {
        error_log('Genealogy SQL summary read failed: ' . $error->getMessage());
        return null;
    }
}

function genealogy_sql_payload_version(): ?string
{
    $pdo = database_pdo();
    if (!$pdo) {
        return null;
    }

    $tables = ['genealogies', 'genealogy_people', 'people', 'app_settings'];
    $includeUpcomingSql = database_read_enabled()
        && function_exists('upcoming_sql_available')
        && upcoming_sql_available();
    if ($includeUpcomingSql) {
        $tables[] = 'events';
        $tables[] = 'event_participation_requests';
    }

    $parts = [
        'schema:' . (defined('CURRENT_GENEALOGY_SCHEMA_VERSION') ? (string) CURRENT_GENEALOGY_SCHEMA_VERSION : '1'),
        'upcoming-sql:' . ($includeUpcomingSql ? '1' : '0'),
    ];

    try {
        foreach ($tables as $table) {
            $statement = $pdo->query(
                "SELECT COUNT(*) AS row_count, COALESCE(MAX(updated_at), '') AS last_updated FROM {$table}"
            );
            $row = $statement ? $statement->fetch() : false;
            if (!is_array($row)) {
                return null;
            }
            $parts[] = $table . ':' . (string) ($row['row_count'] ?? '0') . ':' . (string) ($row['last_updated'] ?? '');
        }
    } catch (Throwable $exception) {
        error_log('Genealogy SQL version error: ' . $exception->getMessage());
        return null;
    }

    return implode('|', $parts);
}

function genealogy_sql_write_payload(array $payload): bool
{
    $pdo = database_pdo();
    if (!$pdo) {
        return false;
    }

    try {
        database_ensure_genealogy_sql_schema($pdo);
        $pdo->beginTransaction();
        genealogy_sql_upsert_setting('activeGenealogyId', (string) ($payload['activeGenealogyId'] ?? ''));
        genealogy_sql_upsert_setting('roleResetVersion', (string) ($payload['roleResetVersion'] ?? ''));

        $genealogies = is_array($payload['genealogies'] ?? null) ? $payload['genealogies'] : [];
        $genealogyIds = [];
        $personIds = [];
        foreach ($genealogies as $genealogy) {
            if (!is_array($genealogy)) {
                continue;
            }
            $genealogyId = (string) ($genealogy['id'] ?? '');
            if ($genealogyId === '') {
                continue;
            }
            $genealogyIds[] = $genealogyId;
            genealogy_sql_upsert_genealogy($genealogy);

            foreach (is_array($genealogy['people'] ?? null) ? $genealogy['people'] : [] as $person) {
                if (!is_array($person)) {
                    continue;
                }
                $personId = (string) ($person['id'] ?? '');
                if ($personId === '') {
                    continue;
                }
                $personIds[] = $personId;
                genealogy_sql_upsert_genealogy_person($genealogyId, $person);
                genealogy_sql_upsert_person($genealogyId, $person);
            }
        }

        genealogy_sql_delete_missing_genealogy_people($genealogies);
        genealogy_sql_delete_missing_people($personIds);
        genealogy_sql_delete_missing_genealogies($genealogyIds);
        $pdo->commit();
        return true;
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        // Log détaillé dans fichier
        $errorMsg = date('c') . ' - Genealogy SQL write error: ' . $exception->getMessage() . "\n";
        $errorMsg .= 'Stack trace: ' . $exception->getTraceAsString() . "\n";
        file_put_contents(__DIR__ . '/../data/sql-error.log', $errorMsg, FILE_APPEND | LOCK_EX);
        error_log('Genealogy SQL write error: ' . $exception->getMessage());
        return false;
    }
}

function genealogy_sql_upsert_genealogy_person(string $genealogyId, array $person): void
{
    $pdo = database_pdo();
    if (!$pdo) {
        return;
    }
    $statement = $pdo->prepare(
        'INSERT INTO genealogy_people
            (genealogy_id, person_id, filiere, filiere_custom, filiere2, filiere2_custom, person_json, updated_at)
         VALUES
            (:genealogy_id, :person_id, :filiere, :filiere_custom, :filiere2, :filiere2_custom, :person_json, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
            filiere = VALUES(filiere),
            filiere_custom = VALUES(filiere_custom),
            filiere2 = VALUES(filiere2),
            filiere2_custom = VALUES(filiere2_custom),
            person_json = VALUES(person_json),
            updated_at = UTC_TIMESTAMP()'
    );
    $statement->execute([
        ':genealogy_id' => $genealogyId,
        ':person_id' => (string) ($person['id'] ?? ''),
        ':filiere' => genealogy_sql_nullable_string($person['filiere'] ?? ''),
        ':filiere_custom' => genealogy_sql_nullable_string($person['filiereCustom'] ?? ''),
        ':filiere2' => genealogy_sql_nullable_string($person['filiere2'] ?? ''),
        ':filiere2_custom' => genealogy_sql_nullable_string($person['filiere2Custom'] ?? ''),
        ':person_json' => genealogy_sql_encode_object($person),
    ]);
}

function genealogy_sql_mirror(array $payload): void
{
    if (!database_genealogy_write_enabled() || !genealogy_sql_available()) {
        return;
    }
    genealogy_sql_write_payload($payload);
}

function genealogy_sql_genealogy_from_row(array $row): array
{
    $stored = genealogy_sql_decode_object($row['genealogy_json'] ?? null);
    $genealogy = $stored ?: [
        'id' => (string) ($row['id'] ?? ''),
        'name' => (string) ($row['name'] ?? ''),
        'type' => (string) ($row['type'] ?? 'family'),
        'parentId' => (string) ($row['parent_id'] ?? ''),
        'photoData' => '',
        'customRoles' => genealogy_sql_decode_array($row['custom_roles_json'] ?? null),
        'cooptageRoleId' => (string) ($row['cooptage_role_id'] ?? ''),
    ];
    $genealogy['id'] = (string) ($row['id'] ?? ($genealogy['id'] ?? ''));
    $genealogy['people'] = [];
    return $genealogy;
}

function genealogy_sql_person_from_row(array $row): array
{
    $stored = genealogy_sql_decode_object($row['person_json'] ?? null);
    if ($stored) {
        $stored['id'] = (string) ($row['id'] ?? ($stored['id'] ?? ''));
        genealogy_sql_apply_filiere_columns($stored, $row);
        return $stored;
    }

    return [
        'id' => (string) ($row['id'] ?? ''),
        'name' => (string) ($row['name'] ?? ''),
        'nickname' => (string) ($row['nickname'] ?? ''),
        'nicknames' => [],
        'roles' => genealogy_sql_decode_array($row['roles_json'] ?? null),
        'ceremonyType' => 'bapteme',
        'baptismDate' => (string) ($row['baptism_date'] ?? ''),
        'baptismCity' => (string) ($row['baptism_city'] ?? ''),
        'baptismStatus' => (string) ($row['baptism_status'] ?? 'unknown'),
        'ceremonyEvents' => [],
        'song' => (string) ($row['song'] ?? ''),
        'filiere' => (string) ($row['filiere'] ?? ''),
        'filiereCustom' => (string) ($row['filiere_custom'] ?? ''),
        'filiere2' => (string) ($row['filiere2'] ?? ''),
        'filiere2Custom' => (string) ($row['filiere2_custom'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'sponsorIds' => [],
        'heartSponsorIds' => [],
        'crossGroupId' => '',
        'crossGroupSize' => 0,
    ];
}

function genealogy_sql_upsert_genealogy(array $genealogy): void
{
    $pdo = database_pdo();
    if (!$pdo) {
        return;
    }
    $statement = $pdo->prepare(
        'INSERT INTO genealogies
            (id, parent_id, name, type, photo_path, cooptage_role_id, custom_roles_json, genealogy_json, updated_at)
         VALUES
            (:id, :parent_id, :name, :type, :photo_path, :cooptage_role_id, :custom_roles_json, :genealogy_json, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
            parent_id = VALUES(parent_id),
            name = VALUES(name),
            type = VALUES(type),
            photo_path = VALUES(photo_path),
            cooptage_role_id = VALUES(cooptage_role_id),
            custom_roles_json = VALUES(custom_roles_json),
            genealogy_json = VALUES(genealogy_json),
            updated_at = UTC_TIMESTAMP()'
    );
    $genealogyWithoutPeople = $genealogy;
    unset($genealogyWithoutPeople['people']);
    $statement->execute([
        ':id' => (string) ($genealogy['id'] ?? ''),
        ':parent_id' => (string) ($genealogy['parentId'] ?? ''),
        ':name' => (string) ($genealogy['name'] ?? ''),
        ':type' => (string) ($genealogy['type'] ?? 'family'),
        ':photo_path' => '',
        ':cooptage_role_id' => (string) ($genealogy['cooptageRoleId'] ?? ''),
        ':custom_roles_json' => genealogy_sql_encode_array($genealogy['customRoles'] ?? []),
        ':genealogy_json' => genealogy_sql_encode_object($genealogyWithoutPeople),
    ]);
}

function genealogy_sql_upsert_person(string $genealogyId, array $person): void
{
    $pdo = database_pdo();
    if (!$pdo) {
        return;
    }
    $statement = $pdo->prepare(
        'INSERT INTO people
            (id, genealogy_id, name, nickname, birth_date, baptism_date, baptism_city, baptism_status, filiere, filiere_custom, filiere2, filiere2_custom, roles_json, song, notes, photo_path, person_json, updated_at)
         VALUES
            (:id, :genealogy_id, :name, :nickname, NULL, :baptism_date, :baptism_city, :baptism_status, :filiere, :filiere_custom, :filiere2, :filiere2_custom, :roles_json, :song, NULL, NULL, :person_json, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
            genealogy_id = VALUES(genealogy_id),
            name = VALUES(name),
            nickname = VALUES(nickname),
            baptism_date = VALUES(baptism_date),
            baptism_city = VALUES(baptism_city),
            baptism_status = VALUES(baptism_status),
            filiere = VALUES(filiere),
            filiere_custom = VALUES(filiere_custom),
            filiere2 = VALUES(filiere2),
            filiere2_custom = VALUES(filiere2_custom),
            roles_json = VALUES(roles_json),
            song = VALUES(song),
            person_json = VALUES(person_json),
            updated_at = UTC_TIMESTAMP()'
    );
    $statement->execute([
        ':id' => (string) ($person['id'] ?? ''),
        ':genealogy_id' => $genealogyId,
        ':name' => (string) ($person['name'] ?? ''),
        ':nickname' => (string) ($person['nickname'] ?? ''),
        ':baptism_date' => genealogy_sql_date((string) ($person['baptismDate'] ?? '')),
        ':baptism_city' => (string) ($person['baptismCity'] ?? ''),
        ':baptism_status' => (string) ($person['baptismStatus'] ?? ''),
        ':filiere' => genealogy_sql_nullable_string($person['filiere'] ?? ''),
        ':filiere_custom' => genealogy_sql_nullable_string($person['filiereCustom'] ?? ''),
        ':filiere2' => genealogy_sql_nullable_string($person['filiere2'] ?? ''),
        ':filiere2_custom' => genealogy_sql_nullable_string($person['filiere2Custom'] ?? ''),
        ':roles_json' => genealogy_sql_encode_array($person['roles'] ?? []),
        ':song' => (string) ($person['song'] ?? ''),
        ':person_json' => genealogy_sql_encode_object($person),
    ]);
}

function genealogy_sql_delete_missing_people(array $personIds): void
{
    $pdo = database_pdo();
    if (!$pdo) {
        return;
    }
    if (!$personIds) {
        $pdo->exec('DELETE FROM people');
        return;
    }
    
    // Filtrer et dédupliquer les IDs
    $uniqueIds = array_values(array_unique(array_filter($personIds, fn($id) => $id !== '')));
    
    if (empty($uniqueIds)) {
        $pdo->exec('DELETE FROM people');
        return;
    }
    
    // MySQL limite à 1000 éléments dans IN(), on fait par batch
    $chunkSize = 900;
    $chunks = array_chunk($uniqueIds, $chunkSize);
    
    // Marquer les personnes à conserver en utilisant une colonne temporaire
    // On utilise une approche simple : mettre à jour updated_at pour les personnes à garder
    $pdo->exec("UPDATE people SET updated_at = updated_at WHERE 1=0"); // No-op pour init
    
    // Supprimer par batch : pour chaque batch, on garde ceux qui sont dans le batch
    // Puis on supprime ceux qui n'ont pas été mis à jour (approche simplifiée)
    
    // Solution alternative : DELETE avec NOT IN par petits batches
    // On récupère tous les IDs existants
    $existingIds = $pdo->query('SELECT id FROM people')->fetchAll(PDO::FETCH_COLUMN);
    $toDelete = array_diff($existingIds, $uniqueIds);
    
    if (empty($toDelete)) {
        return; // Rien à supprimer
    }
    
    // Supprimer par petits batches
    $deleteChunks = array_chunk($toDelete, $chunkSize);
    $deleteStmt = $pdo->prepare("DELETE FROM people WHERE id = :id");
    
    foreach ($deleteChunks as $chunk) {
        foreach ($chunk as $id) {
            $deleteStmt->execute([':id' => $id]);
        }
    }
}

function genealogy_sql_delete_missing_genealogy_people(array $genealogies): void
{
    $pdo = database_pdo();
    if (!$pdo) {
        return;
    }
    $pairs = [];
    foreach ($genealogies as $genealogy) {
        if (!is_array($genealogy)) {
            continue;
        }
        $genealogyId = (string) ($genealogy['id'] ?? '');
        if ($genealogyId === '') {
            continue;
        }
        foreach (is_array($genealogy['people'] ?? null) ? $genealogy['people'] : [] as $person) {
            if (!is_array($person)) {
                continue;
            }
            $personId = (string) ($person['id'] ?? '');
            if ($personId !== '') {
                $pairs[$genealogyId . "\n" . $personId] = true;
            }
        }
    }

    if (!$pairs) {
        $pdo->exec('DELETE FROM genealogy_people');
        return;
    }

    $rows = $pdo->query('SELECT genealogy_id, person_id FROM genealogy_people')->fetchAll();
    $delete = $pdo->prepare('DELETE FROM genealogy_people WHERE genealogy_id = :genealogy_id AND person_id = :person_id');
    foreach (is_array($rows) ? $rows : [] as $row) {
        $key = (string) ($row['genealogy_id'] ?? '') . "\n" . (string) ($row['person_id'] ?? '');
        if (!isset($pairs[$key])) {
            $delete->execute([
                ':genealogy_id' => (string) ($row['genealogy_id'] ?? ''),
                ':person_id' => (string) ($row['person_id'] ?? ''),
            ]);
        }
    }
}

function genealogy_sql_delete_missing_genealogies(array $genealogyIds): void
{
    $pdo = database_pdo();
    if (!$pdo) {
        return;
    }
    if (!$genealogyIds) {
        $pdo->exec('DELETE FROM genealogies');
        return;
    }
    $placeholders = implode(',', array_fill(0, count($genealogyIds), '?'));
    $statement = $pdo->prepare("DELETE FROM genealogies WHERE id NOT IN ({$placeholders})");
    $statement->execute(array_values(array_unique($genealogyIds)));
}

function genealogy_sql_setting(string $key): string
{
    $pdo = database_pdo();
    if (!$pdo) {
        return '';
    }
    try {
        $statement = $pdo->prepare('SELECT setting_value FROM app_settings WHERE setting_key = :setting_key LIMIT 1');
        $statement->execute([':setting_key' => $key]);
        $value = $statement->fetchColumn();
        return is_string($value) ? $value : '';
    } catch (Throwable) {
        return '';
    }
}

function genealogy_sql_setting_int(string $key): ?int
{
    $value = genealogy_sql_setting($key);
    return $value !== '' && ctype_digit($value) ? (int) $value : null;
}

function genealogy_sql_upsert_setting(string $key, string $value): void
{
    $pdo = database_pdo();
    if (!$pdo) {
        return;
    }
    $statement = $pdo->prepare(
        'INSERT INTO app_settings (setting_key, setting_value, updated_at)
         VALUES (:setting_key, :setting_value, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = UTC_TIMESTAMP()'
    );
    $statement->execute([':setting_key' => $key, ':setting_value' => $value]);
}

function genealogy_sql_decode_array($value): array
{
    $decoded = genealogy_sql_decode($value);
    return is_array($decoded) ? array_values($decoded) : [];
}

function genealogy_sql_decode_object($value): array
{
    $decoded = genealogy_sql_decode($value);
    return is_array($decoded) ? $decoded : [];
}

function genealogy_sql_decode($value)
{
    if (!is_string($value) || $value === '') {
        return null;
    }
    return json_decode($value, true);
}

function genealogy_sql_encode_array($value): string
{
    $encoded = json_encode(is_array($value) ? array_values($value) : [], JSON_UNESCAPED_UNICODE);
    return is_string($encoded) ? $encoded : '[]';
}

function genealogy_sql_encode_object(array $value): string
{
    $encoded = json_encode($value, JSON_UNESCAPED_UNICODE);
    return is_string($encoded) ? $encoded : '{}';
}

function genealogy_sql_apply_filiere_columns(array &$person, array $row): void
{
    foreach ([
        'filiere' => 'filiere',
        'filiere_custom' => 'filiereCustom',
        'filiere2' => 'filiere2',
        'filiere2_custom' => 'filiere2Custom',
    ] as $column => $field) {
        if (array_key_exists($column, $row) && $row[$column] !== null) {
            $person[$field] = (string) $row[$column];
        }
    }
}

function genealogy_sql_nullable_string($value): ?string
{
    if (!is_scalar($value)) {
        return null;
    }
    $text = trim((string) $value);
    return $text === '' ? null : $text;
}

function genealogy_sql_date(string $value): ?string
{
    $timestamp = strtotime($value);
    return $timestamp === false ? null : gmdate('Y-m-d', $timestamp);
}
