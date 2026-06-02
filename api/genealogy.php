<?php
declare(strict_types=1);

require __DIR__ . '/../site-auth.php';
require __DIR__ . '/helpers.php';
if (!defined('FALUCHE_GENEALOGY_LIBRARY_ONLY')) {
    require_site_auth();
}

require __DIR__ . '/config.php';
require_once __DIR__ . '/upcoming_sql.php';
require_once __DIR__ . '/genealogy_sql.php';
require_once __DIR__ . '/cache.php';

const PUBLIC_EDITABLE_PEOPLE_SESSION_KEY = 'faluche_public_editable_people';
const PUBLIC_CREATED_PEOPLE_SESSION_KEY = 'faluche_public_created_people';
const PUBLIC_SESSION_ACTIONS_SESSION_KEY = 'faluche_public_session_actions';
const MAX_JSON_BODY_BYTES = 8388608;
const MAX_GENEALOGIES = 300;
const MAX_PEOPLE_PER_GENEALOGY = 5000;
const MAX_UPCOMING_EVENTS = 1000;
const MAX_IMAGE_DATA_BYTES = 2097152;
const CURRENT_GENEALOGY_SCHEMA_VERSION = 1;
const MAIN_GENEALOGY_ID = 'faluche-nationale';
const DEFAULT_REGIONAL_GENEALOGY_ID = 'faluche-alsacienne';
const DEFAULT_GENEALOGY_NAME = 'Faluche Nationale';
const DEFAULT_REGIONAL_GENEALOGY_NAME = 'La faluche alsacienne';

if (!defined('FALUCHE_GENEALOGY_LIBRARY_ONLY')) {
    site_security_headers();
    header('Content-Type: application/json; charset=utf-8');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $fastEtag = genealogy_fast_response_etag();
        if ($fastEtag !== '') {
            clear_public_session_permissions();
            api_respond_not_modified_if_etag_matches($fastEtag);
        }

        // Cache APCu: évite requêtes SQL répétées
        $cachedPayload = genealogy_cache_get('payload');
        if ($cachedPayload !== null) {
            clear_public_session_permissions();
            api_respond_with_etag($cachedPayload + ['people' => []], 'genealogy', 200, $fastEtag ?: null);
        }
        
        if (!is_file(GENEALOGY_DATA_FILE) && !database_genealogy_read_enabled()) {
            clear_public_session_permissions();
            api_respond_with_etag(empty_genealogy_payload(), 'genealogy', 200, $fastEtag ?: null);
        }

        [$payload, $sourceData] = genealogy_payload_for_read();

        // Écrire uniquement si :
        // 1. Les données viennent de JSON (pas SQL)
        // 2. Une migration était nécessaire (payload différent des données brutes)
        // 3. L'écriture JSON est activée
        $cameFromJson = !database_genealogy_read_enabled() || empty($sourceData['genealogies']);
        $needsMigration = $payload !== $sourceData;

        if ($cameFromJson && $needsMigration && database_genealogy_json_write_enabled()) {
            write_genealogy_payload($payload);
        }

        // Mettre en cache pour les prochaines requêtes
        genealogy_cache_set('payload', $payload, 30);
        
        clear_public_session_permissions();
        api_respond_with_etag($payload + ['people' => []], 'genealogy', 200, $fastEtag ?: null);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        require_csrf_token();
        $body = api_read_json_body(MAX_JSON_BODY_BYTES);
        if (!is_array($body)) {
            api_respond(['error' => 'Requete invalide.'], 400);
        }

        $action = is_string($body['action'] ?? null) ? (string) $body['action'] : '';
        if ($action === 'undoPublicSessionAction') {
            require_csrf_token();
            $result = undo_public_session_action($body);
            // L'undo modifie la payload en session, invalider le cache pour cohérence
            genealogy_cache_clear();
            api_respond($result);
        }
        if ($action === 'scanPersonDuplicates') {
            require_general_admin_auth();
            api_respond(['groups' => find_duplicate_person_groups(current_genealogy_payload())]);
        }
        if ($action === 'mergePersonDuplicates') {
            require_general_admin_auth();
            $currentBeforeWrite = current_genealogy_payload();
            $mergeResult = merge_duplicate_people_payload($currentBeforeWrite, $body);
            if (!write_genealogy_payload($mergeResult)) {
                api_respond(['error' => 'Impossible de sauvegarder la genealogie.'], 500);
            }
            // Invalider le cache après fusion
            genealogy_cache_clear();
            auth_record_admin_audit_event([
                'summary' => 'Fusion de fiches doublons',
                'actorLabel' => 'Admin general',
                'scopeRegionIds' => genealogy_audit_region_ids($mergeResult),
            ]);
            api_respond([
                'ok' => true,
                'state' => $mergeResult,
                'groups' => find_duplicate_person_groups($mergeResult),
            ]);
        }

        $hasGenealogies = isset($body['genealogies']) && is_array($body['genealogies']);
        $hasPeople = isset($body['people']) && is_array($body['people']);
        if (!$hasGenealogies && !$hasPeople) {
            api_respond(['error' => 'Genealogie invalide.'], 400);
        }

        $directory = dirname(GENEALOGY_DATA_FILE);
        if (!is_dir($directory) && !mkdir($directory, 0755, true)) {
            api_respond(['error' => 'Impossible de creer le dossier de donnees.'], 500);
        }
        auth_protect_data_directory($directory);

        $currentBeforeWrite = current_genealogy_payload();
        $adminSession = admin_auth_session();
        if (admin_auth_requires_password_change($adminSession)) {
            api_respond(['error' => 'Change le mot de passe administrateur regional avant de modifier les donnees.'], 403);
        }
        $payload = $hasGenealogies
            ? genealogy_payload_for_write($body, $adminSession)
            : people_payload_for_write($body['people'], $adminSession);
        $payload = strip_duplicate_creation_flags_from_payload($payload);

        if (!write_genealogy_payload($payload)) {
            api_respond(['error' => 'Impossible de sauvegarder la genealogie.'], 500);
        }
        
        // Invalider le cache après modification
        genealogy_cache_clear();

        genealogy_record_audit_event($currentBeforeWrite, $payload, $body, $adminSession);
        if ($adminSession === null) {
            record_public_session_action($currentBeforeWrite, $payload, $body);
        }

        api_respond([
            'ok' => true,
            'count' => $hasGenealogies ? count($body['genealogies']) : count($body['people']),
            'state' => is_array($payload) && isset($payload['genealogies']) ? $payload : null,
            'sessionActions' => public_session_actions_for_response(),
        ]);
    }

    api_respond(['error' => 'Methode non autorisee.'], 405);
}


function write_genealogy_payload($payload): bool
{
    if (!is_array($payload)) {
        return false;
    }

    // Préserver les événements existants si le payload n'en contient pas
    // (évite que l'autosave écrase les événements quand SQL ne les fournit pas)
    $incomingEvents = is_array($payload['upcomingBaptisms'] ?? null) ? $payload['upcomingBaptisms'] : [];
    if (empty($incomingEvents) && is_file(GENEALOGY_DATA_FILE)) {
        $existingRaw = file_get_contents(GENEALOGY_DATA_FILE);
        $existingData = json_decode($existingRaw ?: '{}', true);
        if (is_array($existingData) && !empty($existingData['upcomingBaptisms'])) {
            $payload['upcomingBaptisms'] = $existingData['upcomingBaptisms'];
        }
    }

    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return false;
    }

    $sqlWriteEnabled = database_genealogy_write_enabled();
    $jsonWriteEnabled = database_genealogy_json_write_enabled();
    $sqlWritten = false;
    if ($sqlWriteEnabled) {
        $sqlWritten = genealogy_sql_write_payload($payload);
        if (!$sqlWritten) {
            return false;
        }
    }

    if (!$jsonWriteEnabled) {
        return $sqlWriteEnabled && $sqlWritten;
    }

    $directory = dirname(GENEALOGY_DATA_FILE);
    if (!is_dir($directory) && !mkdir($directory, 0755, true)) {
        return false;
    }
    auth_protect_data_directory($directory);

    return api_atomic_json_write(GENEALOGY_DATA_FILE, $json);
}


function read_genealogy_file(): string
{
    if (!is_file(GENEALOGY_DATA_FILE)) {
        return '';
    }

    $handle = fopen(GENEALOGY_DATA_FILE, 'rb');
    if ($handle === false) {
        return '';
    }

    try {
        if (!flock($handle, LOCK_SH)) {
            return '';
        }
        $contents = stream_get_contents($handle);
        flock($handle, LOCK_UN);
        return $contents === false ? '' : $contents;
    } finally {
        fclose($handle);
    }
}

function genealogy_payload_for_read(): array
{
    // Priorité 1 : Lecture SQL si activée et disponible
    if (database_genealogy_read_enabled()) {
        $sqlPayload = genealogy_sql_read_payload();
        if (is_array($sqlPayload) && !empty($sqlPayload['genealogies'])) {
            // SQL a des données valides, les utiliser
            $payload = migrate_genealogy_payload($sqlPayload);

            // SQL ne stocke pas les événements : récupérer depuis JSON si upcoming SQL n'est pas activé
            if (!database_read_enabled() && is_file(GENEALOGY_DATA_FILE)) {
                $jsonRaw = file_get_contents(GENEALOGY_DATA_FILE);
                $jsonData = json_decode($jsonRaw ?: '{}', true);
                if (is_array($jsonData)) {
                    $rawEvents = is_array($jsonData['upcomingBaptisms'] ?? null) ? $jsonData['upcomingBaptisms'] : [];
                    $refreshedEvents = refresh_recurring_upcoming_events($rawEvents);
                    $payload['upcomingBaptisms'] = public_upcoming_baptisms($refreshedEvents);
                }
            }

            // Conserver les événements depuis SQL ou les ajouter depuis upcoming SQL
            return [genealogy_payload_with_optional_sql_events($payload), $sqlPayload];
        }
        // SQL est activé mais vide ou indisponible → fallback JSON (ne pas échouer)
    }

    // Priorité 2 : Lecture JSON (fallback ou mode JSON-only)
    $raw = read_genealogy_file();
    $data = json_decode($raw ?: '[]', true);
    if (!is_array($data) && trim($raw) !== '') {
        api_respond(['error' => 'Donnees temporairement indisponibles.'], 503);
    }

    $data = is_array($data) ? $data : [];
    $rawEvents = is_array($data['upcomingBaptisms'] ?? null) ? $data['upcomingBaptisms'] : [];
    $refreshedEvents = refresh_recurring_upcoming_events($rawEvents);
    if ($refreshedEvents !== $rawEvents) {
        $data['upcomingBaptisms'] = $refreshedEvents;
    }

    $payload = migrate_genealogy_payload($data);

    return [genealogy_payload_with_optional_sql_events($payload), $data];
}

function role_reset_version_from($data): ?int
{
    if (!is_array($data) || !array_key_exists('roleResetVersion', $data)) {
        return null;
    }

    $value = $data['roleResetVersion'];
    if (is_int($value)) {
        return $value;
    }
    if (is_string($value) && ctype_digit($value)) {
        return (int) $value;
    }

    return null;
}

function schema_version_from($data): int
{
    if (!is_array($data)) {
        return 0;
    }
    $value = $data['schemaVersion'] ?? 0;
    return is_int($value) ? $value : (is_string($value) && ctype_digit($value) ? (int) $value : 0);
}

function empty_genealogy_payload(): array
{
    return [
        'schemaVersion' => CURRENT_GENEALOGY_SCHEMA_VERSION,
        'roleResetVersion' => null,
        'activeGenealogyId' => '',
        'genealogies' => [],
        'upcomingBaptisms' => [],
    ];
}

function migrate_genealogy_payload($data): array
{
    if (!is_array($data)) {
        return empty_genealogy_payload();
    }

    if (isset($data['genealogies']) && is_array($data['genealogies'])) {
        $rawGenealogies = $data['genealogies'];
        if (should_migrate_legacy_genealogies($rawGenealogies)) {
            $rawGenealogies = migrate_legacy_genealogies($rawGenealogies);
        }
        $genealogies = ensure_main_genealogy(public_genealogies($rawGenealogies));
    } else {
        $genealogies = legacy_people_to_genealogies(is_array($data) ? $data : []);
    }
    $activeGenealogyId = api_safe_id($data['activeGenealogyId'] ?? '', 100);
    if ($activeGenealogyId === '' && count($genealogies) > 0) {
        $activeGenealogyId = (string) ($genealogies[0]['id'] ?? '');
    }
    if ($activeGenealogyId !== '' && !genealogy_id_exists($genealogies, $activeGenealogyId)) {
        $activeGenealogyId = (string) ($genealogies[0]['id'] ?? '');
    }

    return [
        'schemaVersion' => CURRENT_GENEALOGY_SCHEMA_VERSION,
        'roleResetVersion' => role_reset_version_from($data),
        'activeGenealogyId' => $activeGenealogyId,
        'genealogies' => $genealogies,
        'upcomingBaptisms' => public_upcoming_baptisms(is_array($data['upcomingBaptisms'] ?? null) ? $data['upcomingBaptisms'] : []),
    ];
}

function legacy_people_to_genealogies(array $people): array
{
    if (isset($people['genealogies'])) {
        return [];
    }
    $normalisedPeople = strip_person_photos($people);
    if (count($normalisedPeople) === 0) {
        return [];
    }
    return [[
        'id' => MAIN_GENEALOGY_ID,
        'name' => DEFAULT_GENEALOGY_NAME,
        'type' => 'national',
        'parentId' => '',
        'photoData' => '',
        'people' => $normalisedPeople,
        'customRoles' => [],
        'cooptageRoleId' => '',
    ]];
}

function should_migrate_legacy_genealogies(array $genealogies): bool
{
    if (count($genealogies) === 0) {
        return false;
    }
    foreach ($genealogies as $genealogy) {
        if (!is_array($genealogy)) {
            continue;
        }
        if (
            array_key_exists('type', $genealogy)
            || array_key_exists('level', $genealogy)
            || array_key_exists('scope', $genealogy)
            || array_key_exists('parentId', $genealogy)
            || array_key_exists('regionId', $genealogy)
        ) {
            return false;
        }
    }
    foreach ($genealogies as $genealogy) {
        if (is_array($genealogy) && is_main_genealogy_raw($genealogy)) {
            return true;
        }
    }
    return count($genealogies) > 1;
}

function migrate_legacy_genealogies(array $genealogies): array
{
    $legacyMain = null;
    foreach ($genealogies as $genealogy) {
        if (is_array($genealogy) && is_main_genealogy_raw($genealogy)) {
            $legacyMain = $genealogy;
            break;
        }
    }
    if ($legacyMain === null) {
        $legacyMain = is_array($genealogies[0] ?? null) ? $genealogies[0] : [];
    }

    $migrated = [[
        'id' => MAIN_GENEALOGY_ID,
        'name' => DEFAULT_GENEALOGY_NAME,
        'type' => 'national',
        'parentId' => '',
        'photoData' => '',
        'people' => [],
        'customRoles' => [],
        'cooptageRoleId' => '',
    ]];

    $region = $legacyMain;
    $region['id'] = DEFAULT_REGIONAL_GENEALOGY_ID;
    $region['name'] = DEFAULT_REGIONAL_GENEALOGY_NAME;
    $region['type'] = 'region';
    $region['parentId'] = MAIN_GENEALOGY_ID;
    $migrated[] = $region;

    foreach ($genealogies as $genealogy) {
        if (!is_array($genealogy) || $genealogy === $legacyMain) {
            continue;
        }
        $family = $genealogy;
        $family['type'] = 'family';
        $family['parentId'] = DEFAULT_REGIONAL_GENEALOGY_ID;
        $migrated[] = $family;
    }

    return $migrated;
}

function ensure_main_genealogy(array $genealogies): array
{
    $national = null;
    $regions = [];
    $families = [];

    foreach ($genealogies as $genealogy) {
        $type = (string) ($genealogy['type'] ?? '');
        if ($type === 'national') {
            if ($national === null) {
                $national = array_merge($genealogy, [
                    'id' => MAIN_GENEALOGY_ID,
                    'name' => DEFAULT_GENEALOGY_NAME,
                    'type' => 'national',
                    'parentId' => '',
                    'customRoles' => [],
                    'cooptageRoleId' => '',
                ]);
            }
            continue;
        }
        if ($type === 'region') {
            $genealogy['parentId'] = MAIN_GENEALOGY_ID;
            $regions[] = $genealogy;
            continue;
        }
        $genealogy['type'] = 'family';
        $families[] = $genealogy;
    }

    if ($national === null) {
        $national = [
            'id' => MAIN_GENEALOGY_ID,
            'name' => DEFAULT_GENEALOGY_NAME,
            'type' => 'national',
            'parentId' => '',
            'photoData' => '',
            'people' => [],
            'customRoles' => [],
            'cooptageRoleId' => '',
        ];
    }

    if (count($regions) === 0 && count($families) > 0) {
        $regions[] = [
            'id' => DEFAULT_REGIONAL_GENEALOGY_ID,
            'name' => DEFAULT_REGIONAL_GENEALOGY_NAME,
            'type' => 'region',
            'parentId' => MAIN_GENEALOGY_ID,
            'photoData' => '',
            'people' => [],
            'customRoles' => [],
            'cooptageRoleId' => 'tva',
        ];
    }

    $regionIds = [];
    foreach ($regions as $region) {
        $regionIds[(string) ($region['id'] ?? '')] = true;
    }
    $fallbackRegionId = (string) ($regions[0]['id'] ?? '');
    $families = array_map(static function (array $family) use ($regionIds, $fallbackRegionId): array {
        $parentId = (string) ($family['parentId'] ?? '');
        $family['parentId'] = isset($regionIds[$parentId]) ? $parentId : $fallbackRegionId;
        return $family;
    }, $families);

    return array_values(array_filter(array_merge([$national], $regions, $families), static function ($item): bool {
        return is_array($item);
    }));
}

function genealogy_id_exists(array $genealogies, string $id): bool
{
    foreach ($genealogies as $genealogy) {
        if (($genealogy['id'] ?? '') === $id) {
            return true;
        }
    }
    return false;
}

function is_main_genealogy_raw(array $genealogy): bool
{
    $id = api_safe_id($genealogy['id'] ?? '', 100);
    $name = normalise_text($genealogy['name'] ?? '');
    $aliases = [
        'faluche nationale',
        'la faluche nationale',
        'faluche alsacienne',
        'la faluche alsacienne',
        'faluche alscacienne',
        'la faluche alscacienne',
        'descendance de la k fetteria',
    ];
    return $id === MAIN_GENEALOGY_ID || $id === 'kfetteria' || in_array($name, $aliases, true);
}

function public_genealogies(array $genealogies): array
{
    $normalised = [];
    $seen = [];
    foreach (array_slice($genealogies, 0, MAX_GENEALOGIES) as $index => $genealogy) {
        if (!is_array($genealogy)) {
            continue;
        }
        $hasIdentity = api_safe_id($genealogy['id'] ?? '', 100) !== '' || api_safe_text($genealogy['name'] ?? '', 140) !== '';
        if (!$hasIdentity) {
            continue;
        }
        $item = normalise_genealogy_for_storage($genealogy, $index + 1);
        if ($item['id'] === '' || isset($seen[$item['id']])) {
            continue;
        }
        $seen[$item['id']] = true;
        $normalised[] = $item;
    }
    return $normalised;
}

function strip_person_photos(array $people): array
{
    return normalise_people_for_storage($people);
}

function normalise_genealogy_for_storage($genealogy, int $fallbackIndex = 1): array
{
    $genealogy = is_array($genealogy) ? $genealogy : [];
    $rawName = api_safe_text($genealogy['name'] ?? '', 140);
    $name = $rawName !== '' ? $rawName : 'Genealogie ' . $fallbackIndex;
    $id = api_safe_id($genealogy['id'] ?? $name, 100);
    $type = normalise_genealogy_type($genealogy['type'] ?? ($genealogy['level'] ?? ($genealogy['scope'] ?? '')), $id, $name);

    return [
        'id' => $id,
        'name' => $name,
        'type' => $type,
        'parentId' => $type === 'national' ? '' : api_safe_id($genealogy['parentId'] ?? ($genealogy['regionId'] ?? ''), 100),
        'photoData' => normalise_image_data($genealogy['photoData'] ?? ''),
        'people' => normalise_people_for_storage(is_array($genealogy['people'] ?? null) ? $genealogy['people'] : []),
        'customRoles' => normalise_role_options($genealogy['customRoles'] ?? ($genealogy['roleOptions'] ?? [])),
        'cooptageRoleId' => $type === 'region' ? normalise_role_id($genealogy['cooptageRoleId'] ?? 'tva') : '',
    ];
}

function normalise_people_for_storage(array $people): array
{
    $normalised = [];
    $seen = [];
    foreach (array_slice($people, 0, MAX_PEOPLE_PER_GENEALOGY) as $person) {
        $item = normalise_person_for_storage($person);
        if ($item['id'] === '' || isset($seen[$item['id']])) {
            continue;
        }
        $seen[$item['id']] = true;
        $normalised[] = $item;
    }
    return $normalised;
}

function strip_duplicate_creation_flags_from_payload($payload): array
{
    $payload = is_array($payload) ? $payload : [];
    if (!is_array($payload['genealogies'] ?? null)) {
        return array_map(static function ($person): array {
            $person = is_array($person) ? $person : [];
            unset($person['_forceDuplicateCreation'], $person['_allowDuplicate']);
            return $person;
        }, $payload);
    }

    $payload['genealogies'] = array_map(static function ($genealogy): array {
        $genealogy = is_array($genealogy) ? $genealogy : [];
        if (!is_array($genealogy['people'] ?? null)) {
            return $genealogy;
        }
        $genealogy['people'] = array_map(static function ($person): array {
            $person = is_array($person) ? $person : [];
            unset($person['_forceDuplicateCreation'], $person['_allowDuplicate']);
            return $person;
        }, $genealogy['people']);
        return $genealogy;
    }, $payload['genealogies']);

    return $payload;
}

function person_duplicate_key(array $person): string
{
    return implode('|', [
        normalise_text($person['name'] ?? ''),
        normalise_text($person['nickname'] ?? (($person['nicknames'][0] ?? '') ?: '')),
    ]);
}

function find_duplicate_person_groups(array $payload): array
{
    $groups = [];
    foreach (is_array($payload['genealogies'] ?? null) ? $payload['genealogies'] : [] as $genealogy) {
        if (!is_array($genealogy) || !is_array($genealogy['people'] ?? null)) {
            continue;
        }
        foreach ($genealogy['people'] as $person) {
            if (!is_array($person)) {
                continue;
            }
            $key = person_duplicate_key($person);
            $id = api_safe_id($person['id'] ?? '', 100);
            if ($key === '|' || $id === '') {
                continue;
            }
            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'key' => $key,
                    'label' => duplicate_person_label($person),
                    'peopleById' => [],
                ];
            }
            if (!isset($groups[$key]['peopleById'][$id])) {
                $groups[$key]['peopleById'][$id] = duplicate_person_summary($person);
            }
            $groups[$key]['peopleById'][$id]['genealogies'][] = api_safe_text($genealogy['name'] ?? $genealogy['id'] ?? '', 140);
        }
    }

    $duplicates = [];
    foreach ($groups as $group) {
        if (count($group['peopleById']) < 2) {
            continue;
        }
        $people = array_values(array_map(static function (array $person): array {
            $person['genealogies'] = array_values(array_unique($person['genealogies']));
            return $person;
        }, $group['peopleById']));
        $duplicates[] = [
            'key' => $group['key'],
            'label' => $group['label'],
            'people' => add_duplicate_differences($people),
        ];
    }

    return $duplicates;
}

function duplicate_person_label(array $person): string
{
    $name = api_safe_text($person['name'] ?? '', 140);
    $nickname = api_safe_text($person['nickname'] ?? (($person['nicknames'][0] ?? '') ?: ''), 120);
    return trim($name . ($nickname !== '' ? ' / ' . $nickname : ''));
}

function duplicate_person_summary(array $person): array
{
    return [
        'id' => api_safe_id($person['id'] ?? '', 100),
        'name' => api_safe_text($person['name'] ?? '', 140),
        'nickname' => api_safe_text($person['nickname'] ?? (($person['nicknames'][0] ?? '') ?: ''), 120),
        'baptismDate' => normalise_date($person['baptismDate'] ?? ''),
        'baptismCity' => api_safe_text($person['baptismCity'] ?? '', 120),
        'filiere' => normalise_filiere_id($person['filiere'] ?? ''),
        'roles' => role_id_array($person['roles'] ?? []),
        'genealogies' => [],
    ];
}

function add_duplicate_differences(array $people): array
{
    $fields = [
        'baptismDate' => 'date de baptême',
        'baptismCity' => 'ville de baptême',
        'filiere' => 'filière',
        'roles' => 'rôles',
    ];
    $differing = [];
    foreach ($fields as $field => $label) {
        $values = array_map(static fn(array $person) => json_encode($person[$field] ?? null), $people);
        if (count(array_unique($values)) > 1) {
            $differing[] = $label;
        }
    }

    return array_map(static function (array $person) use ($differing): array {
        $person['differences'] = $differing;
        return $person;
    }, $people);
}

function merge_duplicate_people_payload(array $payload, array $body): array
{
    $keepPersonId = api_safe_id($body['keepPersonId'] ?? '', 100);
    $mergePersonIds = array_values(array_unique(array_filter(
        array_map(static fn($id): string => api_safe_id($id, 100), is_array($body['mergePersonIds'] ?? null) ? $body['mergePersonIds'] : []),
        static fn(string $id): bool => $id !== ''
    )));
    if ($keepPersonId === '' || count($mergePersonIds) === 0 || in_array($keepPersonId, $mergePersonIds, true)) {
        api_respond(['error' => 'Fusion de doublons invalide.'], 400);
    }

    $allMergeIds = array_values(array_unique(array_merge([$keepPersonId], $mergePersonIds)));
    $peopleToMerge = duplicate_merge_people_by_id($payload, $allMergeIds);
    if (!isset($peopleToMerge[$keepPersonId]) || count($peopleToMerge) < 2) {
        api_respond(['error' => 'Fiches doublons introuvables.'], 404);
    }

    $keys = array_values(array_unique(array_map(static fn(array $person): string => person_duplicate_key($person), $peopleToMerge)));
    if (count($keys) !== 1 || ($keys[0] ?? '|') === '|') {
        api_respond(['error' => 'Ces fiches ne correspondent pas au même doublon.'], 400);
    }

    $mergedPerson = replace_person_references(
        merge_duplicate_person_records($peopleToMerge[$keepPersonId], $peopleToMerge),
        $keepPersonId,
        $mergePersonIds
    );
    $affectedGenealogyIds = duplicate_merge_affected_genealogy_ids($payload, $allMergeIds);
    $payload['genealogies'] = array_map(
        static fn($genealogy) => merge_duplicate_people_in_genealogy($genealogy, $mergedPerson, $keepPersonId, $mergePersonIds, $affectedGenealogyIds),
        is_array($payload['genealogies'] ?? null) ? $payload['genealogies'] : []
    );

    return $payload;
}

function duplicate_merge_people_by_id(array $payload, array $ids): array
{
    $wanted = array_flip($ids);
    $people = [];
    foreach (is_array($payload['genealogies'] ?? null) ? $payload['genealogies'] : [] as $genealogy) {
        if (!is_array($genealogy) || !is_array($genealogy['people'] ?? null)) {
            continue;
        }
        foreach ($genealogy['people'] as $person) {
            if (!is_array($person)) {
                continue;
            }
            $id = api_safe_id($person['id'] ?? '', 100);
            if ($id !== '' && isset($wanted[$id]) && !isset($people[$id])) {
                $people[$id] = $person;
            }
        }
    }
    return $people;
}

function duplicate_merge_affected_genealogy_ids(array $payload, array $ids): array
{
    $wanted = array_flip($ids);
    $affected = [];
    foreach (is_array($payload['genealogies'] ?? null) ? $payload['genealogies'] : [] as $genealogy) {
        if (!is_array($genealogy) || !is_array($genealogy['people'] ?? null)) {
            continue;
        }
        foreach ($genealogy['people'] as $person) {
            $id = is_array($person) ? api_safe_id($person['id'] ?? '', 100) : '';
            if ($id !== '' && isset($wanted[$id])) {
                $affected[] = api_safe_id($genealogy['id'] ?? '', 100);
                break;
            }
        }
    }
    return array_values(array_unique($affected));
}

function merge_duplicate_people_in_genealogy($genealogy, array $mergedPerson, string $keepPersonId, array $mergePersonIds, array $affectedGenealogyIds)
{
    if (!is_array($genealogy) || !is_array($genealogy['people'] ?? null)) {
        return $genealogy;
    }

    $genealogyId = api_safe_id($genealogy['id'] ?? '', 100);
    $removeIds = array_flip($mergePersonIds);
    $allMergeIds = array_flip(array_merge([$keepPersonId], $mergePersonIds));
    $people = [];
    foreach ($genealogy['people'] as $person) {
        if (!is_array($person)) {
            continue;
        }
        $person = replace_person_references($person, $keepPersonId, $mergePersonIds);
        $id = api_safe_id($person['id'] ?? '', 100);
        if (isset($allMergeIds[$id])) {
            continue;
        }
        $people[] = $person;
    }

    if (in_array($genealogyId, $affectedGenealogyIds, true)) {
        $people[] = $mergedPerson;
    }

    $genealogy['people'] = $people;
    return $genealogy;
}

function replace_person_references(array $person, string $keepPersonId, array $mergePersonIds): array
{
    $person['sponsorIds'] = replace_id_list($person['sponsorIds'] ?? [], $keepPersonId, $mergePersonIds);
    $person['heartSponsorIds'] = replace_id_list($person['heartSponsorIds'] ?? [], $keepPersonId, $mergePersonIds);
    $person['ceremonyEvents'] = array_map(
        static function ($event) use ($keepPersonId, $mergePersonIds) {
            if (!is_array($event)) {
                return $event;
            }
            $event['sponsorIds'] = replace_id_list($event['sponsorIds'] ?? [], $keepPersonId, $mergePersonIds);
            $event['heartSponsorIds'] = replace_id_list($event['heartSponsorIds'] ?? [], $keepPersonId, $mergePersonIds);
            return $event;
        },
        is_array($person['ceremonyEvents'] ?? null) ? $person['ceremonyEvents'] : []
    );
    return $person;
}

function replace_id_list($ids, string $keepPersonId, array $mergePersonIds): array
{
    $remove = array_flip($mergePersonIds);
    $next = [];
    foreach (id_array($ids) as $id) {
        $next[] = isset($remove[$id]) ? $keepPersonId : $id;
    }
    return array_values(array_unique(array_filter($next, static fn(string $id): bool => $id !== '')));
}

function merge_duplicate_person_records(array $keepPerson, array $peopleById): array
{
    $merged = $keepPerson;
    foreach ($peopleById as $person) {
        foreach (['name', 'nickname', 'baptismDate', 'baptismCity', 'baptismStatus', 'song', 'filiere', 'createdAt', 'crossGroupId'] as $field) {
            if (($merged[$field] ?? '') === '' && ($person[$field] ?? '') !== '') {
                $merged[$field] = $person[$field];
            }
        }
        if ((int) ($merged['crossGroupSize'] ?? 0) === 0 && (int) ($person['crossGroupSize'] ?? 0) > 0) {
            $merged['crossGroupSize'] = (int) $person['crossGroupSize'];
        }
        $merged['nicknames'] = normalise_text_list(
            array_merge(
                [$merged['nickname'] ?? ''],
                is_array($merged['nicknames'] ?? null) ? $merged['nicknames'] : [],
                [$person['nickname'] ?? ''],
                is_array($person['nicknames'] ?? null) ? $person['nicknames'] : []
            ),
            120,
            3
        );
        $merged['roles'] = merge_id_lists($merged['roles'] ?? [], $person['roles'] ?? []);
        $merged['sponsorIds'] = merge_id_lists($merged['sponsorIds'] ?? [], $person['sponsorIds'] ?? []);
        $merged['heartSponsorIds'] = merge_id_lists($merged['heartSponsorIds'] ?? [], $person['heartSponsorIds'] ?? []);
        $merged['ceremonyEvents'] = merge_ceremony_event_lists($merged['ceremonyEvents'] ?? [], $person['ceremonyEvents'] ?? []);
    }
    return normalise_person_for_storage($merged);
}

function merge_id_lists($left, $right): array
{
    return array_values(array_unique(array_merge(id_array($left), id_array($right))));
}

function merge_ceremony_event_lists($left, $right): array
{
    $events = [];
    foreach (array_merge(is_array($left) ? $left : [], is_array($right) ? $right : []) as $event) {
        if (!is_array($event)) {
            continue;
        }
        $normalised = normalise_ceremony_events([$event])[0] ?? null;
        if (!is_array($normalised)) {
            continue;
        }
        $key = hash('sha256', json_encode($normalised, JSON_UNESCAPED_UNICODE) ?: '');
        $events[$key] = $normalised;
    }
    return array_values($events);
}

function normalise_person_for_storage($person): array
{
    $person = is_array($person) ? $person : [];
    $nicknames = normalise_text_list($person['nicknames'] ?? ($person['nickname'] ?? []), 120, 3);
    $ceremonyType = normalise_text($person['ceremonyType'] ?? '');
    if (!in_array($ceremonyType, ['bapteme', 'adoption', 'confirmation'], true)) {
        $ceremonyType = 'bapteme';
    }
    $baptismStatus = ($person['baptismStatus'] ?? '') === 'unbaptized' ? 'unbaptized' : 'unknown';

    $normalised = [
        'id' => api_safe_id($person['id'] ?? '', 100),
        'name' => api_safe_text($person['name'] ?? '', 140),
        'nickname' => $nicknames[0] ?? '',
        'nicknames' => array_slice($nicknames, 0, 3),
        'roles' => role_id_array($person['roles'] ?? []),
        'ceremonyType' => $ceremonyType,
        'baptismDate' => normalise_date($person['baptismDate'] ?? ''),
        'baptismCity' => api_safe_text($person['baptismCity'] ?? ($person['ceremonyCity'] ?? ''), 120),
        'baptismStatus' => $baptismStatus,
        'ceremonyEvents' => normalise_ceremony_events($person['ceremonyEvents'] ?? []),
        'song' => api_safe_text($person['song'] ?? '', 500),
        'filiere' => normalise_filiere_id($person['filiere'] ?? ''),
        'filiereCustom' => '',
        'filiere2' => normalise_filiere_id($person['filiere2'] ?? ''),
        'filiere2Custom' => '',
        'createdAt' => normalise_created_at($person['createdAt'] ?? ($person['addedAt'] ?? '')),
        'sponsorIds' => id_array($person['sponsorIds'] ?? []),
        'heartSponsorIds' => id_array($person['heartSponsorIds'] ?? []),
        'crossGroupId' => api_safe_id($person['crossGroupId'] ?? '', 100),
        'crossGroupSize' => normalise_cross_group_size($person['crossGroupSize'] ?? 0),
    ];
    if ($normalised['filiere'] === 'autre') {
        $normalised['filiereCustom'] = api_safe_text($person['filiereCustom'] ?? '', 120);
    }
    if ($normalised['filiere2'] === 'autre') {
        $normalised['filiere2Custom'] = api_safe_text($person['filiere2Custom'] ?? '', 120);
    }
    if (!empty($person['_forceDuplicateCreation']) || !empty($person['_allowDuplicate'])) {
        $normalised['_forceDuplicateCreation'] = true;
    }
    return $normalised;
}

function normalise_text_list($value, int $maxLength, int $limit): array
{
    $source = is_array($value) ? $value : (is_scalar($value) ? preg_split('/[\n,;]+/', (string) $value) : []);
    $items = [];
    $seen = [];
    foreach ($source ?: [] as $item) {
        $text = api_safe_text($item, $maxLength);
        $key = normalise_text($text);
        if ($text === '' || isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $items[] = $text;
        if (count($items) >= $limit) {
            break;
        }
    }
    return $items;
}

function normalise_role_options($roles): array
{
    if (!is_array($roles)) {
        return [];
    }
    $normalised = [];
    $seen = [];
    foreach (array_slice($roles, 0, 300) as $role) {
        if (!is_array($role)) {
            continue;
        }
        $id = normalise_role_id($role['id'] ?? '');
        $label = api_safe_text($role['label'] ?? '', 100);
        if ($id === '' || $label === '' || isset($seen[$id])) {
            continue;
        }
        $seen[$id] = true;
        $aliases = role_id_array($role['aliases'] ?? []);
        $item = ['id' => $id, 'label' => $label];
        if (count($aliases) > 1) {
            $item['aliases'] = array_slice($aliases, 0, 20);
        }
        $normalised[] = $item;
    }
    return $normalised;
}

function normalise_ceremony_events($events): array
{
    if (!is_array($events)) {
        return [];
    }
    $normalised = [];
    foreach (array_slice($events, 0, 20) as $event) {
        if (!is_array($event)) {
            continue;
        }
        $type = normalise_text($event['type'] ?? '');
        if (!in_array($type, ['adoption', 'confirmation'], true)) {
            continue;
        }
        $city = api_safe_text($event['city'] ?? '', 120);
        if ($city === '') {
            continue;
        }
        $normalised[] = [
            'id' => api_safe_id($event['id'] ?? ($type . '-' . bin2hex(random_bytes(4))), 100),
            'type' => $type,
            'city' => $city,
            'nickname' => api_safe_text($event['nickname'] ?? ($event['adoptionNickname'] ?? ($event['confirmationNickname'] ?? '')), 90),
            'sponsorIds' => id_array($event['sponsorIds'] ?? []),
            'heartSponsorIds' => id_array($event['heartSponsorIds'] ?? []),
        ];
    }
    return $normalised;
}

function normalise_genealogy_type($value, string $id = '', string $name = ''): string
{
    $type = normalise_text($value);
    if (in_array($type, ['national', 'nation', 'nationale', 'root'], true) || $id === MAIN_GENEALOGY_ID) {
        return 'national';
    }
    if (in_array($type, ['region', 'regional', 'regionale', 'ville', 'city'], true)) {
        return 'region';
    }
    if (in_array($type, ['family', 'famille'], true)) {
        return 'family';
    }
    if (is_main_genealogy_raw(['id' => $id, 'name' => $name])) {
        return 'national';
    }
    return 'family';
}



function normalise_date($value): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $date = trim((string) $value);
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ? $date : '';
}

function normalise_created_at($value): string
{
    if (!is_scalar($value)) {
        return gmdate('c');
    }
    $createdAt = trim((string) $value);
    return $createdAt !== '' && strtotime($createdAt) !== false ? substr($createdAt, 0, 80) : gmdate('c');
}

function normalise_cross_group_size($value): int
{
    if (!is_scalar($value)) {
        return 0;
    }
    $size = is_int($value) ? $value : (int) $value;
    return $size >= 2 && $size <= 10 ? $size : 0;
}

function normalise_filiere_id($value): string
{
    $id = api_safe_id($value ?? '', 100);
    $aliases = [
        'dentaire' => 'chirurgie-dentaire',
        'carab' => 'medecine',
        'pharma' => 'pharmacie-preparateur-pharmacie',
        'aes' => 'administration-economique-sociale',
        'arts-spectacle-cinema-audiovisuel' => 'architecture-arts',
        'arts-visuels' => 'architecture-arts',
        'bts' => 'but-dut-bts-bachelor',
        'cpge-hypokhagne-khagne' => 'classes-preparatoires',
        'cpge-scientifique' => 'classes-preparatoires',
        'sciences-general' => 'sciences',
        'paramedical-kinesitherapie' => 'paramedical',
        'economie-comptabilite' => 'sciences-economiques-gestion-iae',
        'enseignement-2nd-degre' => 'meef-2nd-degre',
        'enseignement-1er-degre' => 'meef-1er-degre',
        'lettres' => 'lettres-langues-sciences-humaines-sociales',
        'lea' => 'lettres-langues-sciences-humaines-sociales',
        'psychologie' => 'lettres-langues-sciences-humaines-sociales',
    ];
    $allowed = [
        'chirurgie-dentaire',
        'etudes-courtes-sante',
        'medecine',
        'osteopathie',
        'paramedical',
        'pharmacie-preparateur-pharmacie',
        'prepas-sante',
        'sage-femme',
        'veterinaire',
        'du',
        'administration-economique-sociale',
        'architecture-arts',
        'classes-preparatoires',
        'communication',
        'droit',
        'ecoles-commerce-gestion-communication-journalisme',
        'ecoles-ingenieurs',
        'ecoles-nationales',
        'meef-1er-degre',
        'meef-2nd-degre',
        'filieres-sportives',
        'but-dut-bts-bachelor',
        'iufp',
        'lettres-langues-sciences-humaines-sociales',
        'musique-musicologie',
        'oenologie',
        'sciences',
        'sciences-economiques-gestion-iae',
        'sciences-politiques',
        'autre',
    ];
    $id = $aliases[$id] ?? $id;
    return in_array($id, $allowed, true) ? $id : '';
}

function normalise_image_data($value): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $imageData = trim((string) $value);
    if ($imageData === '') {
        return '';
    }
    if (!preg_match('/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+\/=\r\n]+)$/', $imageData, $matches)) {
        return '';
    }
    $binary = base64_decode($matches[2], true);
    if ($binary === false || strlen($binary) > MAX_IMAGE_DATA_BYTES) {
        return '';
    }
    return 'data:image/' . $matches[1] . ';base64,' . base64_encode($binary);
}

function public_upcoming_baptisms(array $events): array
{
    $seen = [];
    $normalised = [];
    foreach (array_slice($events, 0, MAX_UPCOMING_EVENTS) as $event) {
        if (!is_array($event)) {
            continue;
        }
        $id = api_safe_id($event['id'] ?? '', 100);
        $regionId = api_safe_id($event['regionId'] ?? '', 100);
        $familyId = api_safe_id($event['familyId'] ?? '', 100);
        $rawScope = $event['scope'] ?? '';
        if ($rawScope === '') {
            if ($familyId !== '') {
                $scope = 'family';
            } elseif ($regionId !== '') {
                $scope = 'region';
            } else {
                $scope = 'national';
            }
        } else {
            $scope = upcoming_normalise_scope($rawScope);
        }
        $dateTime = normalise_datetime_local($event['dateTime'] ?? ($event['date'] ?? ''));
        $eventType = normalise_upcoming_event_type($event['eventType'] ?? ($event['type'] ?? ''));
        $title = api_safe_text($event['title'] ?? '', 140);
        $sponsorIds = id_array($event['sponsorIds'] ?? (isset($event['sponsorId']) ? [$event['sponsorId']] : []));
        $fillotIds = id_array($event['fillotIds'] ?? (isset($event['fillotId']) ? [$event['fillotId']] : []));
        $baptizedNames = name_array($event['baptizedNames'] ?? ($event['baptisedNames'] ?? ($event['fillotNames'] ?? [])));
        $requiresCeremonyPeople = in_array($eventType, ['bapteme', 'adoption', 'confirmation'], true);
        $requiresCooptagePeople = $eventType === 'cooptage';
        $hasCeremonyPeople = $sponsorIds && ($fillotIds || $baptizedNames);
        $hasRegion = $regionId !== '' || $scope === 'national';
        if (
            $id === ''
            || !$hasRegion
            || $dateTime === ''
            || isset($seen[$id])
            || ($requiresCeremonyPeople && !$hasCeremonyPeople)
            || ($requiresCooptagePeople && !$hasCeremonyPeople)
            || (!$requiresCeremonyPeople && !$requiresCooptagePeople && $title === '')
        ) {
            continue;
        }
        if (upcoming_baptism_expired($dateTime)) {
            continue;
        }
        $seen[$id] = true;
        $normalised[] = [
            'id' => $id,
            'regionId' => $regionId,
            'title' => $title,
            'eventType' => $eventType,
            'allowParticipation' => $eventType === 'autre' && ($event['allowParticipation'] ?? false) === true,
            'sponsorIds' => $sponsorIds,
            'fillotIds' => $fillotIds,
            'baptizedNames' => $baptizedNames,
            'dateTime' => $dateTime,
            'place' => api_safe_text($event['place'] ?? '', 160),
            'message' => api_safe_text($event['message'] ?? ($event['description'] ?? ''), 1200),
            'creatorName' => api_safe_text($event['creatorName'] ?? ($event['creator'] ?? ''), 120),
            'visibility' => normalise_upcoming_visibility($event['visibility'] ?? 'public'),
            'scope' => $scope,
            'eventUrl' => upcoming_safe_url($event['eventUrl'] ?? ''),
            'familyId' => $familyId,
            'recurrence' => upcoming_normalise_recurrence($event['recurrence'] ?? 'none'),
            'createdAt' => normalise_created_at($event['createdAt'] ?? gmdate('c')),
            'requests' => public_upcoming_requests(is_array($event['requests'] ?? null) ? $event['requests'] : (is_array($event['responses'] ?? null) ? $event['responses'] : [])),
        ];
    }
    usort($normalised, static function (array $a, array $b): int {
        return strcmp($a['dateTime'], $b['dateTime']) ?: strcmp($a['createdAt'], $b['createdAt']) ?: strcmp($a['id'], $b['id']);
    });
    return $normalised;
}

function public_upcoming_requests(array $requests): array
{
    $byName = [];
    foreach (array_slice($requests, 0, 200) as $request) {
        if (!is_array($request)) {
            continue;
        }
        $name = api_safe_text($request['name'] ?? '', 90);
        $nickname = api_safe_text($request['nickname'] ?? '', 90);
        if ($name === '') {
            continue;
        }
        $key = api_safe_id($request['id'] ?? '', 100) ?: normalise_text($name . ' ' . $nickname);
        $byName[$key] = [
            'id' => api_safe_id($request['id'] ?? ('demande-' . bin2hex(random_bytes(4))), 100),
            'name' => $name,
            'nickname' => $nickname,
            'message' => api_safe_text($request['message'] ?? '', 600),
            'status' => normalise_request_status($request['status'] ?? 'pending'),
            'createdAt' => normalise_created_at($request['createdAt'] ?? gmdate('c')),
        ];
    }
    $values = array_values($byName);
    usort($values, static function (array $a, array $b): int {
        return strcmp($a['name'], $b['name']);
    });
    return $values;
}

function merge_upcoming_baptisms(array $currentEvents, array $incomingEvents, bool $isAdmin): array
{
    if ($isAdmin) {
        return public_upcoming_baptisms($incomingEvents);
    }

    $byId = [];
    foreach (public_upcoming_baptisms($currentEvents) as $event) {
        $byId[$event['id']] = $event;
    }

    foreach (public_upcoming_baptisms($incomingEvents) as $incoming) {
        if (!isset($byId[$incoming['id']])) {
            $byId[$incoming['id']] = $incoming;
            continue;
        }
        $byId[$incoming['id']]['requests'] = public_upcoming_requests(array_merge(
            $byId[$incoming['id']]['requests'],
            $incoming['requests']
        ));
    }

    return public_upcoming_baptisms(array_values($byId));
}

function id_array($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $ids = [];
    foreach ($value as $item) {
        $id = api_safe_id($item, 100);
        if ($id !== '' && !in_array($id, $ids, true)) {
            $ids[] = $id;
        }
    }
    return $ids;
}

function role_id_array($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $ids = [];
    foreach ($value as $item) {
        $id = normalise_role_id($item);
        if ($id !== '' && !in_array($id, $ids, true)) {
            $ids[] = $id;
        }
    }
    return $ids;
}

function normalise_role_id($value): string
{
    $id = strtolower(api_safe_id($value, 100));
    $id = preg_replace('/[^a-z0-9]+/', '-', $id);
    return trim((string) $id, '-');
}

function name_array($value): array
{
    $source = is_array($value) ? $value : (is_scalar($value) ? preg_split('/[\n,;]+/', (string) $value) : []);
    $byName = [];
    foreach ($source ?: [] as $item) {
        $name = api_safe_text($item, 120);
        if ($name === '') {
            continue;
        }
        $byName[normalise_text($name)] = $name;
    }
    $values = array_values($byName);
    usort($values, static function (string $a, string $b): int {
        return strcmp($a, $b);
    });
    return $values;
}

function normalise_datetime_local($value): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $raw = trim((string) $value);
    if ($raw === '') {
        return '';
    }
    if (preg_match('/^(\d{4}-\d{2}-\d{2})(?:T|\s)(\d{2}:\d{2})/', $raw, $matches)) {
        return $matches[1] . 'T' . $matches[2];
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
        return $raw . 'T00:00';
    }
    return '';
}

function normalise_upcoming_event_type($value): string
{
    $type = normalise_text($value);
    if ($type === 'bapteme' || $type === 'baptême') {
        return 'bapteme';
    }
    if ($type === 'cooptage') {
        return 'cooptage';
    }
    if ($type === 'adoption') {
        return 'adoption';
    }
    if ($type === 'confirmation') {
        return 'confirmation';
    }
    return 'autre';
}

function normalise_upcoming_visibility($value): string
{
    $visibility = api_safe_id($value ?? 'public', 40);
    return in_array($visibility, ['public', 'private', 'family'], true) ? $visibility : 'public';
}

function normalise_request_status($value): string
{
    $status = normalise_text($value);
    if ($status === 'accepted' || $status === 'accepte') {
        return 'accepted';
    }
    if ($status === 'rejected' || $status === 'refuse') {
        return 'rejected';
    }
    return 'pending';
}

function upcoming_baptism_expired(string $dateTime): bool
{
    $timestamp = strtotime($dateTime);
    if ($timestamp === false) {
        return false;
    }
    $expiresAt = strtotime(date('Y-m-d 23:59:59', $timestamp));
    return $expiresAt !== false && time() > $expiresAt;
}

function upcoming_next_recurrence_datetime(string $dateTime, string $recurrence): string
{
    if ($recurrence === 'none') {
        return '';
    }
    $timestamp = strtotime($dateTime);
    if ($timestamp === false) {
        return '';
    }

    $interval = match ($recurrence) {
        'weekly' => '+1 week',
        'monthly' => '+1 month',
        'yearly' => '+1 year',
        default => '',
    };
    if ($interval === '') {
        return '';
    }

    $next = strtotime(date('Y-m-d H:i:s', $timestamp) . ' ' . $interval);
    if ($next === false) {
        return '';
    }

    // Advance until the date is not expired (future relative to now)
    $now = time();
    $maxIterations = 120; // ~10 years for monthly, safety guard
    $iterations = 0;
    while ($next !== false && $next <= $now && $iterations < $maxIterations) {
        $next = strtotime(date('Y-m-d H:i:s', $next) . ' ' . $interval);
        $iterations++;
    }

    return $next !== false && $next > $now ? date('c', $next) : '';
}

function upcoming_event_fingerprint(array $event): string
{
    $title = api_safe_text($event['title'] ?? '', 140);
    $recurrence = upcoming_normalise_recurrence($event['recurrence'] ?? 'none');
    $scope = upcoming_normalise_scope($event['scope'] ?? 'region');
    $regionId = api_safe_id($event['regionId'] ?? '', 100);
    $familyId = api_safe_id($event['familyId'] ?? '', 100);
    $dateTime = normalise_datetime_local($event['dateTime'] ?? '');
    return hash('sha256', implode('|', [$title, $recurrence, $scope, $regionId, $familyId, $dateTime]));
}

function upcoming_spawn_recurring_event(array $event, string $nextDateTime): array
{
    $oldId = api_safe_id($event['id'] ?? '', 100);
    $newId = api_safe_id('recurrence-' . $oldId . '-' . date('YmdHi', strtotime($nextDateTime)) . '-' . bin2hex(random_bytes(4)), 100);

    $spawned = $event;
    $spawned['id'] = $newId;
    $spawned['dateTime'] = normalise_datetime_local($nextDateTime);
    $spawned['createdAt'] = gmdate('c');
    $spawned['requests'] = [];

    return $spawned;
}

function refresh_recurring_upcoming_events(array $events): array
{
    $changed = false;
    $fingerprints = [];
    $now = time();

    // Index existing fingerprints for deduplication
    foreach ($events as $event) {
        if (!is_array($event)) {
            continue;
        }
        $fingerprints[upcoming_event_fingerprint($event)] = true;
    }

    $newEvents = [];
    foreach ($events as $event) {
        if (!is_array($event)) {
            continue;
        }
        $dateTime = normalise_datetime_local($event['dateTime'] ?? '');
        $recurrence = upcoming_normalise_recurrence($event['recurrence'] ?? 'none');
        if ($dateTime === '' || $recurrence === 'none' || !upcoming_baptism_expired($dateTime)) {
            continue;
        }

        $nextDateTime = upcoming_next_recurrence_datetime($dateTime, $recurrence);
        if ($nextDateTime === '') {
            continue;
        }

        $spawned = upcoming_spawn_recurring_event($event, $nextDateTime);
        $fp = upcoming_event_fingerprint($spawned);
        if (isset($fingerprints[$fp])) {
            continue; // Already exists, do not duplicate
        }

        $fingerprints[$fp] = true;
        $newEvents[] = $spawned;
        $changed = true;
    }

    if (!$changed) {
        return $events;
    }

    // Copy creator secrets from old events to new spawned events
    $secrets = upcoming_read_json(UPCOMING_SECRETS_FILE);
    $sqlMirrorSecrets = [];
    foreach ($newEvents as $spawned) {
        $oldId = '';
        // The old id is embedded in the new id prefix: recurrence-{oldId}-{date}-{random}
        $parts = explode('-', $spawned['id'] ?? '', 3);
        if (count($parts) >= 3 && $parts[0] === 'recurrence') {
            // Reconstruct possible old id (may contain dashes)
            $possibleOldId = substr($spawned['id'], strlen('recurrence-'));
            $possibleOldId = preg_replace('/-\d{10,12}-[a-f0-9]+$/', '', $possibleOldId);
            if ($possibleOldId !== '' && isset($secrets['events'][$possibleOldId])) {
                $oldId = $possibleOldId;
            }
        }

        if ($oldId !== '' && isset($secrets['events'][$oldId])) {
            $secrets['events'][$spawned['id']] = [
                'passwordHash' => $secrets['events'][$oldId]['passwordHash'] ?? '',
                'creatorEmail' => $secrets['events'][$oldId]['creatorEmail'] ?? '',
                'requestEmails' => [],
                'createdAt' => gmdate('c'),
            ];
            $sqlMirrorSecrets[$spawned['id']] = $secrets['events'][$spawned['id']];
        }
        // If no old secret exists, do not create a new password automatically;
        // the event will simply have no creator access unless handled elsewhere.
    }

    upcoming_write_json(UPCOMING_SECRETS_FILE, $secrets);

    $merged = array_merge($events, $newEvents);

    // SQL mirror for new events and their secrets
    if (upcoming_sql_available()) {
        foreach ($newEvents as $event) {
            upcoming_sql_upsert_event($event);
        }
        foreach ($sqlMirrorSecrets as $eventId => $secret) {
            upcoming_sql_upsert_creator_secret($eventId, $secret);
        }
    }

    return $merged;
}

function normalise_text($value): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $value = (string) $value;
    $value = strtr($value, [
        'À' => 'A',
        'Á' => 'A',
        'Â' => 'A',
        'Ã' => 'A',
        'Ä' => 'A',
        'Å' => 'A',
        'Æ' => 'AE',
        'Ç' => 'C',
        'È' => 'E',
        'É' => 'E',
        'Ê' => 'E',
        'Ë' => 'E',
        'Ì' => 'I',
        'Í' => 'I',
        'Î' => 'I',
        'Ï' => 'I',
        'Ñ' => 'N',
        'Ò' => 'O',
        'Ó' => 'O',
        'Ô' => 'O',
        'Õ' => 'O',
        'Ö' => 'O',
        'Œ' => 'OE',
        'Ù' => 'U',
        'Ú' => 'U',
        'Û' => 'U',
        'Ü' => 'U',
        'Ý' => 'Y',
        'Ÿ' => 'Y',
        'à' => 'a',
        'á' => 'a',
        'â' => 'a',
        'ã' => 'a',
        'ä' => 'a',
        'å' => 'a',
        'æ' => 'ae',
        'ç' => 'c',
        'è' => 'e',
        'é' => 'e',
        'ê' => 'e',
        'ë' => 'e',
        'ì' => 'i',
        'í' => 'i',
        'î' => 'i',
        'ï' => 'i',
        'ñ' => 'n',
        'ò' => 'o',
        'ó' => 'o',
        'ô' => 'o',
        'õ' => 'o',
        'ö' => 'o',
        'œ' => 'oe',
        'ù' => 'u',
        'ú' => 'u',
        'û' => 'u',
        'ü' => 'u',
        'ý' => 'y',
        'ÿ' => 'y',
    ]);
    $value = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value);
    $value = preg_replace('/[^a-z0-9]+/', ' ', $value);
    return trim((string) preg_replace('/\s+/', ' ', $value));
}

function genealogy_payload_for_write(array $body, ?array $adminSession): array
{
    $current = current_genealogy_payload();
    $incoming = [
        'schemaVersion' => CURRENT_GENEALOGY_SCHEMA_VERSION,
        'roleResetVersion' => role_reset_version_from($body),
        'activeGenealogyId' => api_safe_id($body['activeGenealogyId'] ?? '', 100),
        'genealogies' => ensure_main_genealogy(public_genealogies($body['genealogies'])),
        'upcomingBaptisms' => public_upcoming_baptisms(is_array($body['upcomingBaptisms'] ?? null) ? $body['upcomingBaptisms'] : []),
    ];
    if ($incoming['activeGenealogyId'] === '' || !genealogy_id_exists($incoming['genealogies'], $incoming['activeGenealogyId'])) {
        $incoming['activeGenealogyId'] = (string) ($incoming['genealogies'][0]['id'] ?? '');
    }

    if (($adminSession['level'] ?? '') === 'general') {
        return $incoming;
    }
    if (($adminSession['level'] ?? '') === 'region') {
        return merge_regional_admin_genealogy_payload($incoming, $current, (string) $adminSession['regionId']);
    }

    $merged = merge_public_genealogy_additions($incoming, $current);
    $merged['upcomingBaptisms'] = merge_upcoming_baptisms(
        public_upcoming_baptisms(is_array($current['upcomingBaptisms'] ?? null) ? $current['upcomingBaptisms'] : []),
        $incoming['upcomingBaptisms'],
        false
    );
    return $merged;
}

function merge_regional_admin_genealogy_payload(array $incoming, array $current, string $regionId): array
{
    $regionId = api_safe_id($regionId, 100);
    if ($regionId === '') {
        return merge_public_genealogy_additions($incoming, $current);
    }

    $currentGenealogies = public_genealogies(is_array($current['genealogies'] ?? null) ? $current['genealogies'] : []);
    $incomingGenealogies = public_genealogies(is_array($incoming['genealogies'] ?? null) ? $incoming['genealogies'] : []);
    $incomingById = [];
    foreach ($incomingGenealogies as $genealogy) {
        if (regional_admin_can_manage_genealogy($genealogy, $regionId)) {
            $incomingById[$genealogy['id']] = $genealogy;
        }
    }

    $mergedGenealogies = [];
    $seen = [];
    foreach ($currentGenealogies as $genealogy) {
        $id = (string) ($genealogy['id'] ?? '');
        if ($id === '') {
            continue;
        }
        $merged = regional_admin_can_manage_genealogy($genealogy, $regionId) && isset($incomingById[$id])
            ? $incomingById[$id]
            : $genealogy;
        $mergedGenealogies[] = $merged;
        $seen[$id] = true;
    }

    foreach ($incomingById as $id => $genealogy) {
        if (!isset($seen[$id])) {
            $mergedGenealogies[] = $genealogy;
            $seen[$id] = true;
        }
    }

    $activeGenealogyId = api_safe_id($current['activeGenealogyId'] ?? '', 100);
    if ($activeGenealogyId === '' || !isset($seen[$activeGenealogyId])) {
        $incomingActiveId = api_safe_id($incoming['activeGenealogyId'] ?? '', 100);
        $activeGenealogyId = isset($seen[$incomingActiveId]) ? $incomingActiveId : ($mergedGenealogies[0]['id'] ?? '');
    }

    return [
        'schemaVersion' => CURRENT_GENEALOGY_SCHEMA_VERSION,
        'roleResetVersion' => role_reset_version_from($current) ?? role_reset_version_from($incoming),
        'activeGenealogyId' => $activeGenealogyId,
        'genealogies' => $mergedGenealogies,
        'upcomingBaptisms' => merge_regional_admin_upcoming_baptisms(
            public_upcoming_baptisms(is_array($current['upcomingBaptisms'] ?? null) ? $current['upcomingBaptisms'] : []),
            public_upcoming_baptisms(is_array($incoming['upcomingBaptisms'] ?? null) ? $incoming['upcomingBaptisms'] : []),
            $regionId
        ),
    ];
}

function regional_admin_can_manage_genealogy(array $genealogy, string $regionId): bool
{
    $id = api_safe_id($genealogy['id'] ?? '', 100);
    $parentId = api_safe_id($genealogy['parentId'] ?? ($genealogy['regionId'] ?? ''), 100);
    return $id === $regionId || $parentId === $regionId;
}

function merge_regional_admin_upcoming_baptisms(array $currentEvents, array $incomingEvents, string $regionId): array
{
    $merged = array_values(array_filter($currentEvents, static function (array $event) use ($regionId): bool {
        $eventRegionId = api_safe_id($event['regionId'] ?? '', 100);
        $scope = upcoming_normalise_scope($event['scope'] ?? 'region');
        return $eventRegionId !== $regionId || $scope === 'national';
    }));
    foreach ($incomingEvents as $event) {
        $eventRegionId = api_safe_id($event['regionId'] ?? '', 100);
        $scope = upcoming_normalise_scope($event['scope'] ?? 'region');
        if ($eventRegionId === $regionId && $scope !== 'national') {
            $merged[] = $event;
        }
    }
    return public_upcoming_baptisms($merged);
}

function people_payload_for_write(array $people, ?array $adminSession)
{
    $people = strip_person_photos($people);
    if (($adminSession['level'] ?? '') === 'general') {
        return $people;
    }

    $current = current_genealogy_payload();
    if (isset($current['genealogies']) && is_array($current['genealogies']) && count($current['genealogies']) > 0) {
        $incoming = [
            'roleResetVersion' => null,
            'activeGenealogyId' => api_safe_id($current['activeGenealogyId'] ?? '', 100),
            'genealogies' => [
                [
                    'id' => 'faluche-nationale',
                    'people' => $people,
                ],
            ],
        ];
        return merge_public_genealogy_additions($incoming, $current);
    }

    return merge_public_people_for_session('legacy', is_array($current) ? $current : [], $people);
}

function current_genealogy_payload()
{
    return genealogy_payload_for_read()[0];
}

function genealogy_fast_response_etag(): string
{
    if (!database_genealogy_read_enabled() || !genealogy_sql_available()) {
        return '';
    }

    $version = genealogy_sql_payload_version();
    if (!is_string($version) || $version === '') {
        return '';
    }

    if (!database_read_enabled() && is_file(GENEALOGY_DATA_FILE)) {
        $version .= '|json-events:' . (string) filesize(GENEALOGY_DATA_FILE) . ':' . (string) filemtime(GENEALOGY_DATA_FILE);
    }

    return api_etag_from_version('genealogy-sql', $version);
}

function genealogy_payload_with_optional_sql_events(array $payload): array
{
    if (!database_read_enabled() || !upcoming_sql_available()) {
        return $payload;
    }

    try {
        $payload['upcomingBaptisms'] = upcoming_sql_events();
    } catch (Throwable $exception) {
        error_log('Upcoming SQL read fallback: ' . $exception->getMessage());
    }
    return $payload;
}

function genealogy_record_audit_event($before, $after, array $body, ?array $adminSession): void
{
    if (!is_array($before) || !is_array($after)) {
        return;
    }
    if (genealogy_audit_hash($before) === genealogy_audit_hash($after)) {
        return;
    }

    $scopeRegionIds = genealogy_audit_scope_region_ids($before, $after, $body, $adminSession);
    $summary = genealogy_audit_summary($before, $after, $scopeRegionIds);
    auth_record_admin_audit_event([
        'summary' => $summary,
        'actorLabel' => genealogy_audit_actor_label($adminSession),
        'scopeRegionIds' => $scopeRegionIds,
    ]);
}

function genealogy_audit_actor_label(?array $adminSession): string
{
    if (($adminSession['level'] ?? '') === 'general') {
        return 'Admin general';
    }
    if (($adminSession['level'] ?? '') === 'region') {
        return 'Admin regional';
    }
    return 'Modification publique';
}

function genealogy_audit_scope_region_ids(array $before, array $after, array $body, ?array $adminSession): array
{
    if (($adminSession['level'] ?? '') === 'region') {
        $regionId = api_safe_id($adminSession['regionId'] ?? '', 100);
        return $regionId !== '' ? [$regionId] : [];
    }

    $changedRegionIds = genealogy_audit_changed_region_ids($before, $after);
    if ($changedRegionIds) {
        return $changedRegionIds;
    }

    $activeGenealogyId = api_safe_id($body['activeGenealogyId'] ?? '', 100);
    $fallbackRegionId = genealogy_audit_region_id_for_genealogy($after, $activeGenealogyId)
        ?? genealogy_audit_region_id_for_genealogy($before, $activeGenealogyId);
    return $fallbackRegionId ? [$fallbackRegionId] : [];
}

function genealogy_audit_changed_region_ids(array $before, array $after): array
{
    $regionIds = array_values(array_unique(array_merge(
        genealogy_audit_region_ids($before),
        genealogy_audit_region_ids($after)
    )));
    return array_values(array_filter($regionIds, static function (string $regionId) use ($before, $after): bool {
        return genealogy_audit_region_hash($before, $regionId) !== genealogy_audit_region_hash($after, $regionId);
    }));
}

function genealogy_audit_region_ids(array $payload): array
{
    return array_values(array_filter(array_map(static function (array $genealogy): string {
        return ($genealogy['type'] ?? '') === 'region' ? (string) ($genealogy['id'] ?? '') : '';
    }, genealogy_audit_genealogies($payload))));
}

function genealogy_audit_region_id_for_genealogy(array $payload, string $genealogyId): ?string
{
    if ($genealogyId === '') {
        return null;
    }
    foreach (genealogy_audit_genealogies($payload) as $genealogy) {
        if (($genealogy['id'] ?? '') !== $genealogyId) {
            continue;
        }
        if (($genealogy['type'] ?? '') === 'region') {
            return (string) $genealogy['id'];
        }
        $parentId = api_safe_id($genealogy['parentId'] ?? '', 100);
        return $parentId !== '' ? $parentId : null;
    }
    return null;
}

function genealogy_audit_genealogies(array $payload): array
{
    return isset($payload['genealogies']) && is_array($payload['genealogies'])
        ? public_genealogies($payload['genealogies'])
        : [];
}

function genealogy_audit_region_hash(array $payload, string $regionId): string
{
    $genealogies = array_values(array_filter(genealogy_audit_genealogies($payload), static function (array $genealogy) use ($regionId): bool {
        return ($genealogy['id'] ?? '') === $regionId || ($genealogy['parentId'] ?? '') === $regionId;
    }));
    $events = array_values(array_filter(
        public_upcoming_baptisms(is_array($payload['upcomingBaptisms'] ?? null) ? $payload['upcomingBaptisms'] : []),
        static function (array $event) use ($regionId): bool {
            $eventRegionId = api_safe_id($event['regionId'] ?? '', 100);
            $scope = upcoming_normalise_scope($event['scope'] ?? 'region');
            return $eventRegionId === $regionId || $scope === 'national';
        }
    ));
    return hash('sha256', json_encode(['genealogies' => $genealogies, 'upcomingBaptisms' => $events], JSON_UNESCAPED_UNICODE) ?: '');
}

function genealogy_audit_hash(array $payload): string
{
    return hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE) ?: '');
}

function genealogy_audit_summary(array $before, array $after, array $scopeRegionIds): string
{
    $beforeStats = genealogy_audit_stats($before, $scopeRegionIds);
    $afterStats = genealogy_audit_stats($after, $scopeRegionIds);
    $parts = [];
    $personDelta = $afterStats['people'] - $beforeStats['people'];
    $treeDelta = $afterStats['genealogies'] - $beforeStats['genealogies'];
    $eventDelta = $afterStats['events'] - $beforeStats['events'];
    if ($personDelta !== 0) {
        $parts[] = ($personDelta > 0 ? '+' : '') . $personDelta . ' fiche(s)';
    }
    if ($treeDelta !== 0) {
        $parts[] = ($treeDelta > 0 ? '+' : '') . $treeDelta . ' arbre(s)';
    }
    if ($eventDelta !== 0) {
        $parts[] = ($eventDelta > 0 ? '+' : '') . $eventDelta . ' annonce(s)';
    }
    if (!$parts) {
        $parts[] = 'contenu mis a jour';
    }
    $scopeText = count($scopeRegionIds) > 1 ? count($scopeRegionIds) . ' regions' : (count($scopeRegionIds) === 1 ? '1 region' : 'arbre national');
    return 'Mise a jour ' . $scopeText . ' : ' . implode(', ', $parts);
}

function genealogy_audit_stats(array $payload, array $scopeRegionIds): array
{
    $genealogies = genealogy_audit_genealogies($payload);
    if ($scopeRegionIds) {
        $scope = array_flip($scopeRegionIds);
        $genealogies = array_values(array_filter($genealogies, static function (array $genealogy) use ($scope): bool {
            return isset($scope[(string) ($genealogy['id'] ?? '')]) || isset($scope[(string) ($genealogy['parentId'] ?? '')]);
        }));
    }
    $events = public_upcoming_baptisms(is_array($payload['upcomingBaptisms'] ?? null) ? $payload['upcomingBaptisms'] : []);
    if ($scopeRegionIds) {
        $scope = array_flip($scopeRegionIds);
        $events = array_values(array_filter($events, static function (array $event) use ($scope): bool {
            $eventRegionId = api_safe_id($event['regionId'] ?? '', 100);
            $scopeValue = upcoming_normalise_scope($event['scope'] ?? 'region');
            return isset($scope[$eventRegionId]) || $scopeValue === 'national';
        }));
    }
    return [
        'genealogies' => count($genealogies),
        'people' => array_sum(array_map(static fn(array $genealogy): int => count($genealogy['people'] ?? []), $genealogies)),
        'events' => count($events),
    ];
}

function merge_public_genealogy_additions(array $incoming, ?array $current = null): array
{
    $current = $current ?? current_genealogy_payload();
    if (!isset($current['genealogies']) || !is_array($current['genealogies']) || count($current['genealogies']) === 0) {
        mark_public_payload_people_editable($incoming);
        return $incoming;
    }
    $current['genealogies'] = public_genealogies($current['genealogies']);

    $incomingById = [];
    foreach ($incoming['genealogies'] as $genealogy) {
        if (!is_array($genealogy)) {
            continue;
        }
        $id = is_string($genealogy['id'] ?? null) ? $genealogy['id'] : '';
        if ($id !== '') {
            $incomingById[$id] = $genealogy;
        }
    }

    $merged = array_map(static function ($genealogy) use ($incomingById): array {
        $genealogy = is_array($genealogy) ? $genealogy : [];
        unset($genealogy['adminPassword']);
        $id = is_string($genealogy['id'] ?? null) ? $genealogy['id'] : '';
        if ($id === '' || !isset($incomingById[$id]) || !is_array($incomingById[$id]['people'] ?? null)) {
            return $genealogy;
        }
        $genealogy['people'] = merge_public_people_for_session(
            $id,
            is_array($genealogy['people'] ?? null) ? $genealogy['people'] : [],
            $incomingById[$id]['people']
        );
        return $genealogy;
    }, $current['genealogies']);

    return [
        'roleResetVersion' => role_reset_version_from($current) ?? role_reset_version_from($incoming),
        'activeGenealogyId' => api_safe_id($current['activeGenealogyId'] ?? '', 100),
        'genealogies' => $merged,
        'upcomingBaptisms' => public_upcoming_baptisms(is_array($current['upcomingBaptisms'] ?? null) ? $current['upcomingBaptisms'] : []),
    ];
}

function merge_public_people_for_session(string $genealogyId, array $currentPeople, array $incomingPeople): array
{
    $existingIndexes = [];
    $existingDuplicateKeys = [];
    $incomingIds = [];
    foreach ($currentPeople as $index => $person) {
        if (is_array($person) && is_string($person['id'] ?? null) && $person['id'] !== '') {
            $existingIndexes[$person['id']] = $index;
            $existingDuplicateKeys[person_duplicate_key($person)] = $person['id'];
        }
    }

    foreach ($incomingPeople as $person) {
        if (!is_array($person)) {
            continue;
        }
        $id = is_string($person['id'] ?? null) ? $person['id'] : '';
        if ($id === '') {
            continue;
        }
        $incomingIds[$id] = true;
        if (!array_key_exists($id, $existingIndexes)) {
            $dupKey = person_duplicate_key($person);
            $allowDuplicate = !empty($person['_forceDuplicateCreation']) || !empty($person['_allowDuplicate']);
            if (!$allowDuplicate && $dupKey !== '|' && isset($existingDuplicateKeys[$dupKey]) && $existingDuplicateKeys[$dupKey] !== $id) {
                continue;
            }
            unset($person['_forceDuplicateCreation'], $person['_allowDuplicate']);
            $currentPeople[] = $person;
            $existingIndexes[$id] = count($currentPeople) - 1;
            $existingDuplicateKeys[$dupKey] = $id;
            mark_public_person_editable($genealogyId, $id);
            continue;
        }
        unset($person['_forceDuplicateCreation'], $person['_allowDuplicate']);
        if (public_person_is_editable($genealogyId, $id)) {
            $currentPeople[$existingIndexes[$id]] = $person;
            continue;
        }
        $currentPeople[$existingIndexes[$id]] = public_person_with_allowed_updates(
            is_array($currentPeople[$existingIndexes[$id]]) ? $currentPeople[$existingIndexes[$id]] : [],
            $person
        );
    }

    $deletedEditableIds = [];
    foreach ($existingIndexes as $personId => $_index) {
        if (!isset($incomingIds[$personId]) && public_person_is_editable($genealogyId, $personId)) {
            $deletedEditableIds[$personId] = true;
        }
    }

    if ($deletedEditableIds === []) {
        return $currentPeople;
    }

    return array_values(array_map(
        static function (array $person) use ($deletedEditableIds): array {
            $person['sponsorIds'] = array_values(array_filter(
                is_array($person['sponsorIds'] ?? null) ? $person['sponsorIds'] : [],
                static fn($id): bool => is_string($id) && !isset($deletedEditableIds[$id])
            ));
            $person['heartSponsorIds'] = array_values(array_filter(
                is_array($person['heartSponsorIds'] ?? null) ? $person['heartSponsorIds'] : [],
                static fn($id): bool => is_string($id) && !isset($deletedEditableIds[$id])
            ));
            $person['ceremonyEvents'] = array_map(
                static function (array $event) use ($deletedEditableIds): array {
                    $event['sponsorIds'] = array_values(array_filter(
                        is_array($event['sponsorIds'] ?? null) ? $event['sponsorIds'] : [],
                        static fn($id): bool => is_string($id) && !isset($deletedEditableIds[$id])
                    ));
                    $event['heartSponsorIds'] = array_values(array_filter(
                        is_array($event['heartSponsorIds'] ?? null) ? $event['heartSponsorIds'] : [],
                        static fn($id): bool => is_string($id) && !isset($deletedEditableIds[$id])
                    ));
                    return $event;
                },
                is_array($person['ceremonyEvents'] ?? null) ? $person['ceremonyEvents'] : []
            );
            return $person;
        },
        array_filter(
            $currentPeople,
            static function ($person) use ($deletedEditableIds): bool {
                return !is_array($person)
                    || !is_string($person['id'] ?? null)
                    || !isset($deletedEditableIds[$person['id']]);
            }
        )
    ));
}

function public_person_with_allowed_updates(array $currentPerson, array $incomingPerson): array
{
    $nextPerson = $currentPerson;
    $currentEvents = normalise_ceremony_events($currentPerson['ceremonyEvents'] ?? []);
    $incomingEvents = normalise_ceremony_events($incomingPerson['ceremonyEvents'] ?? []);
    $seen = [];
    $seenIds = [];
    foreach ($currentEvents as $event) {
        $seen[ceremony_event_key($event)] = true;
        $eventId = api_safe_id($event['id'] ?? '', 100);
        if ($eventId !== '') {
            $seenIds[$eventId] = true;
        }
    }

    $added = [];
    foreach ($incomingEvents as $event) {
        $key = ceremony_event_key($event);
        $eventId = api_safe_id($event['id'] ?? '', 100);
        if (isset($seen[$key]) || ($eventId !== '' && isset($seenIds[$eventId]))) {
            continue;
        }
        $seen[$key] = true;
        if ($eventId !== '') {
            $seenIds[$eventId] = true;
        }
        $added[] = $event;
    }

    $currentSponsorIds = id_array($currentPerson['sponsorIds'] ?? []);
    $currentHeartSponsorIds = id_array($currentPerson['heartSponsorIds'] ?? []);
    $incomingSponsorIds = id_array($incomingPerson['sponsorIds'] ?? []);
    $incomingHeartSponsorIds = id_array($incomingPerson['heartSponsorIds'] ?? []);
    $nextHeartSponsorIds = id_array(array_merge($currentHeartSponsorIds, $incomingHeartSponsorIds));
    $nextSponsorIds = id_array(array_merge($currentSponsorIds, $incomingSponsorIds, $nextHeartSponsorIds));

    if (person_filiere_is_blank($currentPerson)) {
        $incomingFiliere = normalise_filiere_id($incomingPerson['filiere'] ?? '');
        if ($incomingFiliere !== '') {
            $nextPerson['filiere'] = $incomingFiliere;
            $nextPerson['filiereCustom'] = $incomingFiliere === 'autre'
                ? api_safe_text($incomingPerson['filiereCustom'] ?? '', 120)
                : '';
            $nextPerson['filiere2'] = normalise_filiere_id($incomingPerson['filiere2'] ?? '');
            $nextPerson['filiere2Custom'] = $nextPerson['filiere2'] === 'autre'
                ? api_safe_text($incomingPerson['filiere2Custom'] ?? '', 120)
                : '';
        }
    }

    if ($added || $nextSponsorIds !== $currentSponsorIds || $nextHeartSponsorIds !== $currentHeartSponsorIds) {
        $nextPerson['sponsorIds'] = $nextSponsorIds;
        $nextPerson['heartSponsorIds'] = $nextHeartSponsorIds;
        $nextPerson['ceremonyEvents'] = array_merge($currentEvents, $added);
    }

    return $nextPerson;
}

function person_filiere_is_blank(array $person): bool
{
    return normalise_filiere_id($person['filiere'] ?? '') === ''
        && api_safe_text($person['filiereCustom'] ?? '', 120) === ''
        && normalise_filiere_id($person['filiere2'] ?? '') === ''
        && api_safe_text($person['filiere2Custom'] ?? '', 120) === '';
}

function ceremony_event_key(array $event): string
{
    $sponsorIds = id_array($event['sponsorIds'] ?? []);
    $heartSponsorIds = id_array($event['heartSponsorIds'] ?? []);
    sort($sponsorIds);
    sort($heartSponsorIds);
    return json_encode([
        'id' => api_safe_id($event['id'] ?? '', 100),
        'type' => normalise_text($event['type'] ?? ''),
        'city' => api_safe_text($event['city'] ?? '', 120),
        'nickname' => api_safe_text($event['nickname'] ?? '', 90),
        'sponsorIds' => $sponsorIds,
        'heartSponsorIds' => $heartSponsorIds,
    ], JSON_UNESCAPED_UNICODE) ?: '';
}

function mark_public_payload_people_editable(array $payload): void
{
    if (!is_array($payload['genealogies'] ?? null)) {
        return;
    }
    foreach ($payload['genealogies'] as $genealogy) {
        if (!is_array($genealogy)) {
            continue;
        }
        $genealogyId = is_string($genealogy['id'] ?? null) ? $genealogy['id'] : '';
        if ($genealogyId === '' || !is_array($genealogy['people'] ?? null)) {
            continue;
        }
        foreach ($genealogy['people'] as $person) {
            $personId = is_array($person) && is_string($person['id'] ?? null) ? $person['id'] : '';
            if ($personId !== '') {
                mark_public_person_editable($genealogyId, $personId);
            }
        }
    }
}

function record_public_session_action(array $before, array $after, array $body): void
{
    if (genealogy_audit_hash($before) === genealogy_audit_hash($after)) {
        return;
    }

    $action = public_session_action_from_payload($before, $after, $body);
    if (($action['type'] ?? '') === 'create_person') {
        foreach (is_array($action['createdPersonIds'] ?? null) ? $action['createdPersonIds'] : [] as $personId) {
            mark_public_created_person((string) $personId);
        }
    }
    if (($action['personId'] ?? '') === '' || (($action['type'] ?? '') === 'update_person' && empty($action['changedFields']))) {
        return;
    }

    site_auth_start();
    $actions = is_array($_SESSION[PUBLIC_SESSION_ACTIONS_SESSION_KEY] ?? null)
        ? $_SESSION[PUBLIC_SESSION_ACTIONS_SESSION_KEY]
        : [];
    $actions[] = $action;
    $_SESSION[PUBLIC_SESSION_ACTIONS_SESSION_KEY] = array_slice($actions, -20);
}

function public_session_action_from_payload(array $before, array $after, array $body): array
{
    $beforePeople = public_people_by_id($before);
    $afterPeople = public_people_by_id($after);
    $createdIds = array_values(array_diff(array_keys($afterPeople), array_keys($beforePeople)));
    $changedIds = public_changed_person_ids($before, $after);
    $personId = $createdIds[0] ?? ($changedIds[0] ?? '');
    $type = $createdIds ? 'create_person' : 'update_person';
    $beforePerson = is_array($beforePeople[$personId] ?? null) ? $beforePeople[$personId] : [];
    $afterPerson = is_array($afterPeople[$personId] ?? null) ? $afterPeople[$personId] : [];

    return [
        'id' => bin2hex(random_bytes(12)),
        'type' => $type,
        'personId' => $personId,
        'label' => public_session_action_label($type, $personId, $after),
        'createdAt' => gmdate('c'),
        'beforePerson' => $beforePerson,
        'afterPerson' => $afterPerson,
        'changedFields' => public_person_changed_fields($beforePerson, $afterPerson),
        'createdPersonIds' => $createdIds,
    ];
}

function public_session_action_label(string $type, string $personId, array $payload): string
{
    $person = public_people_by_id($payload)[$personId] ?? null;
    $name = is_array($person) ? api_safe_text($person['name'] ?? '', 140) : '';
    if ($name === '') {
        $name = 'fiche';
    }
    if ($type === 'create_person') {
        return 'Fiche créée : ' . $name;
    }
    return 'Modification de fiche : ' . $name;
}

function public_changed_person_ids(array $before, array $after): array
{
    $beforePeople = public_people_by_id($before);
    $afterPeople = public_people_by_id($after);
    $changed = [];
    foreach ($afterPeople as $id => $person) {
        if (!isset($beforePeople[$id])) {
            continue;
        }
        if (genealogy_audit_hash($beforePeople[$id]) !== genealogy_audit_hash($person)) {
            $changed[] = $id;
        }
    }
    return $changed;
}

function public_person_changed_fields(array $beforePerson, array $afterPerson): array
{
    $fields = array_values(array_unique(array_merge(array_keys($beforePerson), array_keys($afterPerson))));
    return array_values(array_filter($fields, static function (string $field) use ($beforePerson, $afterPerson): bool {
        if (in_array($field, ['genealogyId', 'genealogyName', 'genealogyType'], true)) {
            return false;
        }
        return public_normalised_field_value($beforePerson[$field] ?? null) !== public_normalised_field_value($afterPerson[$field] ?? null);
    }));
}

function public_normalised_field_value($value): string
{
    if (is_array($value)) {
        $normalised = $value;
        if (public_array_is_list($normalised)) {
            $encodedItems = array_map('public_normalised_field_value', $normalised);
            sort($encodedItems);
            return json_encode($encodedItems, JSON_UNESCAPED_UNICODE) ?: '';
        }
        ksort($normalised);
        return json_encode(array_map('public_normalised_field_value', $normalised), JSON_UNESCAPED_UNICODE) ?: '';
    }
    return json_encode($value, JSON_UNESCAPED_UNICODE) ?: '';
}

function public_array_is_list(array $value): bool
{
    return array_keys($value) === range(0, count($value) - 1);
}

function public_people_by_id(array $payload): array
{
    $people = [];
    foreach (is_array($payload['genealogies'] ?? null) ? $payload['genealogies'] : [] as $genealogy) {
        if (!is_array($genealogy) || !is_array($genealogy['people'] ?? null)) {
            continue;
        }
        foreach ($genealogy['people'] as $person) {
            if (!is_array($person)) {
                continue;
            }
            $id = api_safe_id($person['id'] ?? '', 100);
            if ($id !== '' && !isset($people[$id])) {
                $people[$id] = $person;
            }
        }
    }
    return $people;
}

function public_session_actions_for_response(): array
{
    site_auth_start();
    $actions = is_array($_SESSION[PUBLIC_SESSION_ACTIONS_SESSION_KEY] ?? null)
        ? $_SESSION[PUBLIC_SESSION_ACTIONS_SESSION_KEY]
        : [];
    return array_values(array_map(static fn(array $action): array => [
        'id' => is_string($action['id'] ?? null) ? $action['id'] : '',
        'type' => is_string($action['type'] ?? null) ? $action['type'] : '',
        'personId' => is_string($action['personId'] ?? null) ? $action['personId'] : '',
        'label' => is_string($action['label'] ?? null) ? $action['label'] : 'Modification récente',
        'createdAt' => is_string($action['createdAt'] ?? null) ? $action['createdAt'] : '',
        'canEdit' => ($action['type'] ?? '') === 'create_person',
    ], array_filter($actions, static fn($action): bool => is_array($action))));
}

function clear_public_session_permissions(): void
{
    site_auth_start();
    unset($_SESSION[PUBLIC_SESSION_ACTIONS_SESSION_KEY]);
    unset($_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY]);
    unset($_SESSION[PUBLIC_CREATED_PEOPLE_SESSION_KEY]);
}

function undo_public_session_action(array $body): array
{
    $actionId = is_string($body['actionId'] ?? null) ? (string) $body['actionId'] : '';
    if ($actionId === '') {
        api_respond(['error' => 'Action récente invalide.'], 400);
    }

    site_auth_start();
    $actions = is_array($_SESSION[PUBLIC_SESSION_ACTIONS_SESSION_KEY] ?? null)
        ? $_SESSION[PUBLIC_SESSION_ACTIONS_SESSION_KEY]
        : [];
    $index = null;
    foreach ($actions as $candidateIndex => $candidate) {
        if (is_array($candidate) && ($candidate['id'] ?? '') === $actionId) {
            $index = $candidateIndex;
            break;
        }
    }
    if ($index === null || !is_array($actions[$index] ?? null)) {
        api_respond(['error' => 'Action récente introuvable dans cette session.'], 404);
    }

    $action = $actions[$index];
    $current = current_genealogy_payload();
    $next = undo_public_action_on_payload($current, $action);
    if (!write_genealogy_payload($next)) {
        api_respond(['error' => 'Impossible de sauvegarder l’annulation.'], 500);
    }

    foreach (is_array($action['createdPersonIds'] ?? null) ? $action['createdPersonIds'] : [] as $personId) {
        unmark_public_person_editable((string) $personId);
    }
    array_splice($actions, $index);
    $_SESSION[PUBLIC_SESSION_ACTIONS_SESSION_KEY] = array_values($actions);

    return [
        'ok' => true,
        'state' => $next,
        'sessionActions' => public_session_actions_for_response(),
    ];
}

function undo_public_action_on_payload(array $current, array $action): array
{
    $type = is_string($action['type'] ?? null) ? (string) $action['type'] : '';
    if ($type === 'create_person') {
        return undo_public_created_person($current, $action);
    }
    if ($type === 'update_person') {
        return undo_public_person_update($current, $action);
    }
    api_respond(['error' => 'Type d’action non annulable.'], 400);
}

function undo_public_created_person(array $current, array $action): array
{
    $createdIds = array_values(array_filter(
        array_map(static fn($id): string => api_safe_id($id, 100), is_array($action['createdPersonIds'] ?? null) ? $action['createdPersonIds'] : []),
        static fn(string $id): bool => $id !== ''
    ));
    if (!$createdIds) {
        api_respond(['error' => 'Fiche créée introuvable pour cette action.'], 409);
    }

    $remove = array_flip($createdIds);
    $current['genealogies'] = array_map(static function ($genealogy) use ($remove): array {
        $genealogy = is_array($genealogy) ? $genealogy : [];
        $people = is_array($genealogy['people'] ?? null) ? $genealogy['people'] : [];
        $genealogy['people'] = array_values(array_map(
            static function (array $person) use ($remove): array {
                foreach (array_keys($remove) as $removedId) {
                    $person = cleanPersonRelations($person, $removedId);
                }
                return $person;
            },
            array_filter($people, static function ($person) use ($remove): bool {
                $id = is_array($person) ? api_safe_id($person['id'] ?? '', 100) : '';
                return $id === '' || !isset($remove[$id]);
            })
        ));
        return $genealogy;
    }, is_array($current['genealogies'] ?? null) ? $current['genealogies'] : []);

    return $current;
}

function cleanPersonRelations(array $person, string $personId): array
{
    $person['sponsorIds'] = array_values(array_filter(
        id_array($person['sponsorIds'] ?? []),
        static fn(string $id): bool => $id !== $personId
    ));
    $person['heartSponsorIds'] = array_values(array_filter(
        id_array($person['heartSponsorIds'] ?? []),
        static fn(string $id): bool => $id !== $personId
    ));
    $person['ceremonyEvents'] = array_map(
        static function ($event) use ($personId): array {
            $event = is_array($event) ? $event : [];
            $event['sponsorIds'] = array_values(array_filter(
                id_array($event['sponsorIds'] ?? []),
                static fn(string $id): bool => $id !== $personId
            ));
            $event['heartSponsorIds'] = array_values(array_filter(
                id_array($event['heartSponsorIds'] ?? []),
                static fn(string $id): bool => $id !== $personId
            ));
            return $event;
        },
        is_array($person['ceremonyEvents'] ?? null) ? $person['ceremonyEvents'] : []
    );
    return $person;
}

function undo_public_person_update(array $current, array $action): array
{
    $personId = api_safe_id($action['personId'] ?? '', 100);
    $beforePerson = is_array($action['beforePerson'] ?? null) ? $action['beforePerson'] : [];
    $afterPerson = is_array($action['afterPerson'] ?? null) ? $action['afterPerson'] : [];
    $changedFields = array_values(array_filter(
        array_map('strval', is_array($action['changedFields'] ?? null) ? $action['changedFields'] : []),
        static fn(string $field): bool => $field !== ''
    ));
    if ($personId === '' || !$changedFields) {
        api_respond(['error' => 'Modification récente invalide.'], 409);
    }

    $found = false;
    $current['genealogies'] = array_map(
        static function ($genealogy) use ($personId, $beforePerson, $afterPerson, $changedFields, &$found): array {
            $genealogy = is_array($genealogy) ? $genealogy : [];
            $genealogy['people'] = array_map(
                static function ($person) use ($personId, $beforePerson, $afterPerson, $changedFields, &$found) {
                    if (!is_array($person) || api_safe_id($person['id'] ?? '', 100) !== $personId) {
                        return $person;
                    }
                    $found = true;
                    foreach ($changedFields as $field) {
                        $currentValue = public_normalised_field_value($person[$field] ?? null);
                        $expectedValue = public_normalised_field_value($afterPerson[$field] ?? null);
                        if ($currentValue !== $expectedValue) {
                            api_respond(['error' => 'Annulation impossible : la fiche ciblée a été modifiée depuis cette action.'], 409);
                        }
                    }
                    foreach ($changedFields as $field) {
                        if (array_key_exists($field, $beforePerson)) {
                            $person[$field] = $beforePerson[$field];
                        } else {
                            unset($person[$field]);
                        }
                    }
                    return normalise_person_for_storage($person);
                },
                is_array($genealogy['people'] ?? null) ? $genealogy['people'] : []
            );
            return $genealogy;
        },
        is_array($current['genealogies'] ?? null) ? $current['genealogies'] : []
    );
    if (!$found) {
        api_respond(['error' => 'Fiche ciblée introuvable.'], 409);
    }

    return $current;
}

function public_person_is_editable(string $genealogyId, string $personId): bool
{
    if (public_created_person_is_editable($personId)) {
        return true;
    }

    site_auth_start();
    $editable = is_array($_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY] ?? null)
        ? $_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY]
        : [];
    return isset($editable[public_editable_person_key($genealogyId, $personId)]);
}

function public_created_person_is_editable(string $personId): bool
{
    site_auth_start();
    $created = is_array($_SESSION[PUBLIC_CREATED_PEOPLE_SESSION_KEY] ?? null)
        ? $_SESSION[PUBLIC_CREATED_PEOPLE_SESSION_KEY]
        : [];
    return isset($created[$personId]);
}

function mark_public_created_person(string $personId): void
{
    $personId = api_safe_id($personId, 100);
    if ($personId === '') {
        return;
    }
    site_auth_start();
    if (!isset($_SESSION[PUBLIC_CREATED_PEOPLE_SESSION_KEY]) || !is_array($_SESSION[PUBLIC_CREATED_PEOPLE_SESSION_KEY])) {
        $_SESSION[PUBLIC_CREATED_PEOPLE_SESSION_KEY] = [];
    }
    $_SESSION[PUBLIC_CREATED_PEOPLE_SESSION_KEY][$personId] = time();
}

function mark_public_person_editable(string $genealogyId, string $personId): void
{
    site_auth_start();
    if (!isset($_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY]) || !is_array($_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY])) {
        $_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY] = [];
    }
    $_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY][public_editable_person_key($genealogyId, $personId)] = time();
}

function unmark_public_person_editable(string $personId): void
{
    site_auth_start();
    if (is_array($_SESSION[PUBLIC_CREATED_PEOPLE_SESSION_KEY] ?? null)) {
        unset($_SESSION[PUBLIC_CREATED_PEOPLE_SESSION_KEY][$personId]);
    }
    if (!is_array($_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY] ?? null)) {
        return;
    }
    foreach (array_keys($_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY]) as $key) {
        $suffix = ':' . $personId;
        if (substr((string) $key, -strlen($suffix)) === $suffix) {
            unset($_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY][$key]);
        }
    }
}

function public_editable_person_key(string $genealogyId, string $personId): string
{
    return hash('sha256', $genealogyId . ':' . $personId) . ':' . $personId;
}
