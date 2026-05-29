<?php
declare(strict_types=1);

define('FALUCHE_GENEALOGY_LIBRARY_ONLY', true);
require __DIR__ . '/../api/genealogy.php';

function assert_same($expected, $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, $label . PHP_EOL);
        fwrite(STDERR, 'Expected: ' . var_export($expected, true) . PHP_EOL);
        fwrite(STDERR, 'Actual:   ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
}

function genealogy_by_id(array $payload, string $id): array
{
    foreach ($payload['genealogies'] as $genealogy) {
        if (($genealogy['id'] ?? '') === $id) {
            return $genealogy;
        }
    }
    return [];
}

function event_by_id(array $payload, string $id): array
{
    foreach ($payload['upcomingBaptisms'] as $event) {
        if (($event['id'] ?? '') === $id) {
            return $event;
        }
    }
    return [];
}

function duplicate_group_count(array $genealogies): int
{
    return count(find_duplicate_person_groups(['genealogies' => $genealogies]));
}

$legacyMigrated = migrate_genealogy_payload([
    ['id' => 'legacy-a', 'name' => 'Legacy A'],
]);
assert_same(CURRENT_GENEALOGY_SCHEMA_VERSION, $legacyMigrated['schemaVersion'], 'legacy payload is migrated to current schema');
assert_same('faluche-nationale', $legacyMigrated['activeGenealogyId'], 'legacy payload gets a national active genealogy');
assert_same('legacy-a', $legacyMigrated['genealogies'][0]['people'][0]['id'], 'legacy people are preserved during migration');

$legacyTreesMigrated = migrate_genealogy_payload([
    'activeGenealogyId' => 'kfetteria',
    'genealogies' => [
        [
            'id' => 'kfetteria',
            'name' => "Descendance de la K'fetteria",
            'people' => [['id' => 'regional-person', 'name' => 'Regional Person', 'filiere' => 'carab']],
        ],
        [
            'id' => 'family-a',
            'name' => 'Famille A',
            'people' => [['id' => 'family-person', 'name' => 'Family Person', 'filiere' => 'dentaire']],
        ],
    ],
]);
assert_same(['national', 'region', 'family'], array_map(static function (array $genealogy): string {
    return (string) ($genealogy['type'] ?? '');
}, $legacyTreesMigrated['genealogies']), 'legacy multi-tree payload gets national, region and family levels');
assert_same('regional-person', $legacyTreesMigrated['genealogies'][1]['people'][0]['id'], 'legacy regional people are preserved');
assert_same('family-person', $legacyTreesMigrated['genealogies'][2]['people'][0]['id'], 'legacy family people are preserved');
assert_same('medecine', $legacyTreesMigrated['genealogies'][1]['people'][0]['filiere'], 'legacy filiere aliases are mapped during migration');
assert_same('chirurgie-dentaire', $legacyTreesMigrated['genealogies'][2]['people'][0]['filiere'], 'legacy dentaire alias is mapped during migration');

$public = public_genealogies([
    [
        'id' => 'region-a',
        'name' => 'Region A',
        'type' => 'region',
        'adminPassword' => 'secret',
        'cooptageRoleId' => 'tva',
        'people' => [
            [
                'id' => 'person-a',
                'name' => 'Alice',
                'nickname' => "Ali\nAli;A",
                'roles' => ['TVA', 'TVA'],
                'photoData' => 'data:image/png;base64,AAAA',
                'baptismDate' => '2026-05-13',
                'crossGroupSize' => 20,
                'ceremonyEvents' => [
                    ['id' => 'adoption-a', 'type' => 'adoption', 'city' => 'Amiens', 'nickname' => 'Adoptee'],
                ],
            ],
        ],
    ],
    ['id' => 'region-a', 'name' => 'Duplicate', 'type' => 'region'],
    ['id' => '', 'name' => '', 'people' => []],
]);

assert_same(1, count($public), 'public_genealogies deduplicates and removes empty rows');
assert_same(false, array_key_exists('adminPassword', $public[0]), 'public_genealogies strips admin password');
assert_same('tva', $public[0]['cooptageRoleId'], 'public_genealogies keeps regional cooptage role');
assert_same(false, array_key_exists('photoData', $public[0]['people'][0]), 'public_genealogies strips person photos');
assert_same(['tva'], $public[0]['people'][0]['roles'], 'public_genealogies normalises duplicate roles');
assert_same(0, $public[0]['people'][0]['crossGroupSize'], 'public_genealogies rejects invalid cross-group size');
assert_same('Adoptee', $public[0]['people'][0]['ceremonyEvents'][0]['nickname'], 'public_genealogies keeps adoption nickname');

$current = [
    'roleResetVersion' => 1,
    'activeGenealogyId' => 'region-b',
    'genealogies' => [
        ['id' => 'faluche-nationale', 'name' => 'National', 'type' => 'national', 'people' => []],
        ['id' => 'region-a', 'name' => 'Region A', 'type' => 'region', 'people' => [['id' => 'a1', 'name' => 'A1']]],
        ['id' => 'family-a', 'name' => 'Famille A', 'type' => 'family', 'parentId' => 'region-a', 'people' => [['id' => 'fa1', 'name' => 'FA1']]],
        ['id' => 'region-b', 'name' => 'Region B', 'type' => 'region', 'people' => [['id' => 'b1', 'name' => 'B1']]],
    ],
    'upcomingBaptisms' => [
        [
            'id' => 'event-a',
            'regionId' => 'region-a',
            'eventType' => 'bapteme',
            'sponsorIds' => ['a1'],
            'baptizedNames' => ['Avant'],
            'dateTime' => '2099-01-01T18:30',
        ],
        [
            'id' => 'event-b',
            'regionId' => 'region-b',
            'eventType' => 'bapteme',
            'sponsorIds' => ['b1'],
            'baptizedNames' => ['B'],
            'dateTime' => '2099-01-02T18:30',
        ],
    ],
];

$incoming = [
    'roleResetVersion' => 2,
    'activeGenealogyId' => 'region-a',
    'genealogies' => [
        ['id' => 'region-a', 'name' => 'Region A modifiee', 'type' => 'region', 'people' => [['id' => 'a2', 'name' => 'A2']]],
        ['id' => 'family-a', 'name' => 'Famille A modifiee', 'type' => 'family', 'parentId' => 'region-a', 'people' => [['id' => 'fa2', 'name' => 'FA2']]],
        ['id' => 'region-b', 'name' => 'Region B piratee', 'type' => 'region', 'people' => [['id' => 'b2', 'name' => 'B2']]],
    ],
    'upcomingBaptisms' => [
        [
            'id' => 'event-a',
            'regionId' => 'region-a',
            'eventType' => 'cooptage',
            'sponsorIds' => ['a2'],
            'baptizedNames' => ['Apres'],
            'dateTime' => '2099-01-03T18:30',
        ],
        [
            'id' => 'event-b',
            'regionId' => 'region-b',
            'eventType' => 'cooptage',
            'sponsorIds' => ['b2'],
            'baptizedNames' => ['B pirate'],
            'dateTime' => '2099-01-04T18:30',
        ],
    ],
];

$merged = merge_regional_admin_genealogy_payload($incoming, $current, 'region-a');

assert_same(CURRENT_GENEALOGY_SCHEMA_VERSION, $merged['schemaVersion'], 'regional merge emits current schema version');
assert_same('Region A modifiee', genealogy_by_id($merged, 'region-a')['name'], 'regional admin can update own region');
assert_same('Famille A modifiee', genealogy_by_id($merged, 'family-a')['name'], 'regional admin can update family under own region');
assert_same('Region B', genealogy_by_id($merged, 'region-b')['name'], 'regional admin cannot update another region');
assert_same('cooptage', event_by_id($merged, 'event-a')['eventType'], 'regional admin can replace own event list');
assert_same('bapteme', event_by_id($merged, 'event-b')['eventType'], 'regional admin cannot replace another region event');
assert_same(1, $merged['roleResetVersion'], 'regional merge keeps current role reset version');

$publicUpcoming = public_upcoming_baptisms([
    [
        'id' => 'autre-open',
        'regionId' => 'region-a',
        'title' => 'Autre ouvert',
        'eventType' => 'autre',
        'allowParticipation' => true,
        'visibility' => 'family',
        'dateTime' => '2099-02-01T18:30',
    ],
    [
        'id' => 'autre-legacy',
        'regionId' => 'region-a',
        'title' => 'Autre historique',
        'eventType' => 'autre',
        'visibility' => 'invalid',
        'dateTime' => '2099-02-02T18:30',
    ],
    [
        'id' => 'cooptage-forced',
        'regionId' => 'region-a',
        'title' => 'Cooptage force',
        'eventType' => 'cooptage',
        'allowParticipation' => true,
        'sponsorIds' => ['a2'],
        'fillotIds' => ['fa2'],
        'dateTime' => '2099-02-03T18:30',
    ],
]);
assert_same(true, event_by_id(['upcomingBaptisms' => $publicUpcoming], 'autre-open')['allowParticipation'], 'custom upcoming event keeps explicit participation opt-in');
assert_same('family', event_by_id(['upcomingBaptisms' => $publicUpcoming], 'autre-open')['visibility'], 'custom upcoming event keeps valid visibility');
assert_same(false, event_by_id(['upcomingBaptisms' => $publicUpcoming], 'autre-legacy')['allowParticipation'], 'legacy custom upcoming event defaults participation opt-in to false');
assert_same('public', event_by_id(['upcomingBaptisms' => $publicUpcoming], 'autre-legacy')['visibility'], 'invalid upcoming visibility defaults to public');
assert_same(false, event_by_id(['upcomingBaptisms' => $publicUpcoming], 'cooptage-forced')['allowParticipation'], 'cooptage cannot force participation opt-in');

$publicAppend = public_person_with_allowed_updates(
    [
        'id' => 'person-a',
        'name' => 'Alice',
        'roles' => ['tva'],
        'sponsorIds' => ['old-sponsor'],
        'heartSponsorIds' => ['heart-sponsor'],
        'ceremonyEvents' => [
            ['id' => 'adoption-1', 'type' => 'adoption', 'city' => 'Amiens', 'nickname' => 'Adoptee', 'sponsorIds' => ['sponsor-a']],
        ],
    ],
    [
        'id' => 'person-a',
        'name' => 'Alice modifiee',
        'roles' => ['admin'],
        'sponsorIds' => ['new-sponsor'],
        'heartSponsorIds' => [],
        'ceremonyEvents' => [
            ['id' => 'adoption-1', 'type' => 'adoption', 'city' => 'Amiens', 'nickname' => 'Adoptee modifiee', 'sponsorIds' => ['sponsor-a']],
            ['id' => 'confirmation-1', 'type' => 'confirmation', 'city' => 'Tours', 'nickname' => 'Confirmee', 'sponsorIds' => ['sponsor-b'], 'heartSponsorIds' => ['heart-b']],
        ],
    ]
);

assert_same('Alice', $publicAppend['name'], 'public append keeps existing person fields');
assert_same(['tva'], $publicAppend['roles'], 'public append does not replace existing roles');
assert_same(['old-sponsor', 'new-sponsor', 'heart-sponsor'], $publicAppend['sponsorIds'], 'public append only adds classic sponsors and preserves existing sponsors');
assert_same(['heart-sponsor'], $publicAppend['heartSponsorIds'], 'public append preserves heart sponsors');
assert_same(2, count($publicAppend['ceremonyEvents']), 'public append adds only new ceremony events');
assert_same('Adoptee', $publicAppend['ceremonyEvents'][0]['nickname'], 'public append does not modify existing ceremony nickname');
assert_same('confirmation', $publicAppend['ceremonyEvents'][1]['type'], 'public append preserves new ceremony type');
assert_same('Confirmee', $publicAppend['ceremonyEvents'][1]['nickname'], 'public append preserves adoption or confirmation nickname');
assert_same(['heart-b'], $publicAppend['ceremonyEvents'][1]['heartSponsorIds'], 'public append preserves ceremony heart sponsors');

assert_same(1, duplicate_group_count([
    [
        'id' => 'region-a',
        'people' => [
            ['id' => 'leo-1', 'name' => 'Léo Dupont', 'nickname' => 'Herbizéeébi'],
            ['id' => 'leo-2', 'name' => '  leo   dupont ', 'nickname' => 'herbizeeebi'],
        ],
    ],
]), 'duplicate people are detected after normalisation');

assert_same(0, duplicate_group_count([
    [
        'id' => 'region-a',
        'people' => [
            ['id' => 'leo-1', 'name' => 'Léo Dupont', 'nickname' => 'Herbizéeébi'],
            ['id' => 'leo-2', 'name' => 'Leo Dupont', 'nickname' => 'autre surnom'],
        ],
    ],
]), 'same name with different nickname is allowed');

assert_same(0, duplicate_group_count([
    [
        'id' => 'region-a',
        'people' => [
            ['id' => 'leo-1', 'name' => 'Léo Dupont', 'nickname' => 'Herbizéeébi'],
        ],
    ],
    [
        'id' => 'family-a',
        'people' => [
            ['id' => 'leo-1', 'name' => '  leo   dupont ', 'nickname' => 'herbizeeebi'],
        ],
    ],
]), 'same person copied across genealogies is allowed');

$duplicatePayload = [
    'activeGenealogyId' => 'region-a',
    'genealogies' => [
        [
            'id' => 'region-a',
            'name' => 'Region A',
            'type' => 'region',
            'people' => [
                ['id' => 'mentor-a', 'name' => 'Mentor A', 'nickname' => 'A', 'sponsorIds' => ['leo-2']],
                ['id' => 'leo-1', 'name' => 'Leo Dupont', 'nickname' => 'Herbizeeebi', 'sponsorIds' => ['mentor-a'], 'roles' => ['tva']],
                ['id' => 'leo-2', 'name' => '  leo   dupont ', 'nickname' => 'herbizeeebi', 'heartSponsorIds' => ['mentor-a'], 'roles' => ['vp']],
            ],
        ],
    ],
    'upcomingBaptisms' => [],
];
$duplicateGroups = find_duplicate_person_groups($duplicatePayload);
assert_same(1, count($duplicateGroups), 'admin duplicate scan returns one duplicate group');
assert_same(2, count($duplicateGroups[0]['people']), 'admin duplicate scan groups both people');

$mergedPayload = merge_duplicate_people_payload($duplicatePayload, [
    'keepPersonId' => 'leo-1',
    'mergePersonIds' => ['leo-2'],
]);
$mergedPeople = $mergedPayload['genealogies'][0]['people'];
assert_same(2, count($mergedPeople), 'merge removes one duplicate person');
$mergedLeo = null;
$mentor = null;
foreach ($mergedPeople as $person) {
    if (($person['id'] ?? '') === 'leo-1') {
        $mergedLeo = $person;
    }
    if (($person['id'] ?? '') === 'mentor-a') {
        $mentor = $person;
    }
}
assert_same(['mentor-a'], $mergedLeo['sponsorIds'] ?? [], 'merge preserves sponsor ids');
assert_same(['mentor-a'], $mergedLeo['heartSponsorIds'] ?? [], 'merge preserves heart sponsor ids');
assert_same(['tva', 'vp'], $mergedLeo['roles'] ?? [], 'merge combines roles');
assert_same(['leo-1'], $mentor['sponsorIds'] ?? [], 'merge rewrites references to removed person');
assert_same([], find_duplicate_person_groups($mergedPayload), 'merge clears the duplicate group');

$undoBefore = [
    'activeGenealogyId' => 'region-a',
    'genealogies' => [
        [
            'id' => 'region-a',
            'name' => 'Region A',
            'type' => 'region',
            'people' => [
                ['id' => 'mentor-a', 'name' => 'Mentor A', 'sponsorIds' => []],
                ['id' => 'fillot-a', 'name' => 'Fillot A', 'sponsorIds' => []],
                ['id' => 'other-a', 'name' => 'Other A', 'song' => 'Ancien chant'],
            ],
        ],
    ],
    'upcomingBaptisms' => [],
];
$undoAfter = $undoBefore;
$undoAfter['genealogies'][0]['people'][1]['sponsorIds'] = ['mentor-a'];
$undoAction = public_session_action_from_payload($undoBefore, $undoAfter, []);
$currentWithUnrelatedChange = $undoAfter;
$currentWithUnrelatedChange['genealogies'][0]['people'][2]['song'] = 'Nouveau chant sans rapport';
$undone = undo_public_action_on_payload($currentWithUnrelatedChange, $undoAction);
assert_same([], $undone['genealogies'][0]['people'][1]['sponsorIds'], 'granular undo removes only the added relation');
assert_same('Nouveau chant sans rapport', $undone['genealogies'][0]['people'][2]['song'], 'granular undo preserves unrelated changes');

$currentAfterDelete = [
    'activeGenealogyId' => 'region-a',
    'genealogies' => [
        [
            'id' => 'region-a',
            'name' => 'Region A',
            'type' => 'region',
            'people' => [],
        ],
    ],
    'upcomingBaptisms' => [],
];
$incomingWithRecreatedPerson = [
    'activeGenealogyId' => 'region-a',
    'genealogies' => [
        [
            'id' => 'region-a',
            'name' => 'Region A',
            'type' => 'region',
            'people' => [
                ['id' => 'alice-new', 'name' => 'Alice', 'nickname' => 'Test'],
            ],
        ],
    ],
    'upcomingBaptisms' => [],
];
$recreated = merge_public_genealogy_additions($incomingWithRecreatedPerson, $currentAfterDelete);
assert_same(1, count($recreated['genealogies'][0]['people']), 'recreating a deleted identity is allowed when storage no longer contains it');
assert_same(0, duplicate_group_count($recreated['genealogies']), 'deleted people are not considered by duplicate detection after merge');

$publicDuplicateAllowed = genealogy_payload_for_write([
    'activeGenealogyId' => 'region-a',
    'genealogies' => [
        [
            'id' => 'region-a',
            'name' => 'Region A',
            'type' => 'region',
            'people' => [
                ['id' => 'public-1', 'name' => 'Alice', 'nickname' => 'Test'],
                ['id' => 'public-2', 'name' => '  alice ', 'nickname' => 'test'],
            ],
        ],
    ],
    'upcomingBaptisms' => [],
], null);
assert_same(true, is_array($publicDuplicateAllowed), 'public duplicate creation remains allowed');

$_SESSION[PUBLIC_CREATED_PEOPLE_SESSION_KEY] = ['created-a' => time()];
$createdEditableCurrent = [
    'activeGenealogyId' => 'region-a',
    'genealogies' => [
        [
            'id' => 'region-a',
            'name' => 'Region A',
            'type' => 'region',
            'people' => [
                ['id' => 'created-a', 'name' => 'Nouvelle personne', 'nickname' => 'Bleu'],
            ],
        ],
    ],
    'upcomingBaptisms' => [],
];
$createdEditableIncoming = [
    'activeGenealogyId' => 'region-a',
    'genealogies' => [
        [
            'id' => 'region-a',
            'name' => 'Region A',
            'type' => 'region',
            'people' => [
                ['id' => 'created-a', 'name' => 'Nom corrigé', 'nickname' => 'Bleu corrigé', 'song' => 'Chant corrigé'],
            ],
        ],
    ],
    'upcomingBaptisms' => [],
];
$createdEditableMerged = merge_public_genealogy_additions($createdEditableIncoming, $createdEditableCurrent);
$createdEditablePerson = $createdEditableMerged['genealogies'][0]['people'][0];
assert_same('Nom corrigé', $createdEditablePerson['name'], 'public session can freely edit a person created in the session');
assert_same('Chant corrigé', $createdEditablePerson['song'], 'public session can edit created person fields beyond relations');

// Test: merge_public_people_for_session prevents name+nickname duplicates
$publicMergeCurrentPeople = [
    ['id' => 'existing-1', 'name' => 'Alice', 'nickname' => 'Test'],
];
$publicMergeIncomingPeople = [
    ['id' => 'existing-1', 'name' => 'Alice', 'nickname' => 'Test'],
    ['id' => 'new-dup', 'name' => '  alice ', 'nickname' => 'test'],
];
$publicMerged = merge_public_people_for_session('region-a', $publicMergeCurrentPeople, $publicMergeIncomingPeople);
assert_same(1, count($publicMerged), 'merge_public_people_for_session blocks duplicate person by name+nickname');

$publicMergedForced = merge_public_people_for_session('region-a', $publicMergeCurrentPeople, [
    ['id' => 'existing-1', 'name' => 'Alice', 'nickname' => 'Test'],
    ['id' => 'new-forced-dup', 'name' => '  alice ', 'nickname' => 'test', '_forceDuplicateCreation' => true],
]);
assert_same(2, count($publicMergedForced), 'merge_public_people_for_session allows an explicitly confirmed duplicate once');
assert_same(false, array_key_exists('_forceDuplicateCreation', $publicMergedForced[1]), 'duplicate bypass marker is not stored');

$publicMergeIncomingUnique = [
    ['id' => 'existing-1', 'name' => 'Alice', 'nickname' => 'Test'],
    ['id' => 'new-unique', 'name' => 'Bob', 'nickname' => 'Unique'],
];
$publicMergedUnique = merge_public_people_for_session('region-a', $publicMergeCurrentPeople, $publicMergeIncomingUnique);
assert_same(2, count($publicMergedUnique), 'merge_public_people_for_session allows unique person');

// Tests pour la migration SQL

// Test: payload vide quand SQL est activé mais pas de données SQL
$emptySqlPayload = genealogy_sql_read_payload();
assert_same(null, $emptySqlPayload, 'genealogy_sql_read_payload returns null when SQL unavailable or empty');

// Test: migration dryRun compte correctement
$testMigrationData = [
    'genealogies' => [
        [
            'id' => 'test-region',
            'name' => 'Test Region',
            'type' => 'region',
            'people' => [
                ['id' => 'person-1', 'name' => 'Alice', 'filiere' => 'medecine'],
                ['id' => 'person-2', 'name' => 'Bob', 'filiere' => 'droit'],
            ],
        ],
        [
            'id' => 'test-family',
            'name' => 'Test Family',
            'type' => 'family',
            'parentId' => 'test-region',
            'people' => [
                ['id' => 'person-3', 'name' => 'Charlie', 'filiere' => 'pharmacie-preparateur-pharmacie'],
            ],
        ],
    ],
    'upcomingBaptisms' => [],
];
$migratedTestPayload = migrate_genealogy_payload($testMigrationData);
assert_same(3, count($migratedTestPayload['genealogies']), 'migration preserves all genealogies plus national');
$totalPeople = 0;
foreach ($migratedTestPayload['genealogies'] as $g) {
    $totalPeople += count($g['people'] ?? []);
}
assert_same(3, $totalPeople, 'migration counts all people correctly');

// Test: filiere aliases sont normalisés pendant migration
$testFilierePayload = migrate_genealogy_payload([
    'genealogies' => [
        [
            'id' => 'region-filiere',
            'name' => 'Region',
            'type' => 'region',
            'people' => [
                ['id' => 'f1', 'name' => 'Test', 'filiere' => 'carab'],
                ['id' => 'f2', 'name' => 'Test2', 'filiere' => 'dentaire'],
                ['id' => 'f3', 'name' => 'Test3', 'filiere' => 'pharma'],
            ],
        ],
    ],
]);
$filiereRegion = genealogy_by_id($testFilierePayload, 'region-filiere');
assert_same('medecine', $filiereRegion['people'][0]['filiere'], 'carab alias normalized during migration');
assert_same('chirurgie-dentaire', $filiereRegion['people'][1]['filiere'], 'dentaire alias normalized during migration');
assert_same('pharmacie-preparateur-pharmacie', $filiereRegion['people'][2]['filiere'], 'pharma alias normalized during migration');

// Test: schemaVersion est mis à jour
$legacyNoVersion = migrate_genealogy_payload([
    'genealogies' => [['id' => 'legacy', 'name' => 'Legacy', 'people' => []]],
]);
assert_same(CURRENT_GENEALOGY_SCHEMA_VERSION, $legacyNoVersion['schemaVersion'], 'migration sets current schema version');

// Test: activeGenealogyId fallback
$noActiveGenealogy = migrate_genealogy_payload([
    'genealogies' => [
        ['id' => 'region-x', 'name' => 'X', 'type' => 'region', 'people' => []],
    ],
]);
assert_same('faluche-nationale', $noActiveGenealogy['activeGenealogyId'], 'migration sets national genealogy as active when none specified');

// Test: main genealogy est toujours créée
$noNationalGenealogy = migrate_genealogy_payload([
    'genealogies' => [
        ['id' => 'only-region', 'name' => 'Only Region', 'type' => 'region', 'people' => []],
    ],
]);
assert_same('faluche-nationale', $noNationalGenealogy['genealogies'][0]['id'], 'migration ensures main national genealogy exists');
assert_same(2, count($noNationalGenealogy['genealogies']), 'migration adds national genealogy when missing');

echo "genealogy-server: ok\n";
