<?php
declare(strict_types=1);

require __DIR__ . '/../site-auth.php';
require __DIR__ . '/helpers.php';
require __DIR__ . '/database.php';

require_site_auth();
site_security_headers();
header('Content-Type: application/json; charset=utf-8');

header('X-Idea-Box-Debug: 2026-06-19-a');

const IDEA_BOX_MAX_BODY_BYTES = 12000;
const IDEA_BOX_PUBLIC_LIMIT = 50;
const IDEA_BOX_VOTE_SESSION_LIMIT = 80;
const IDEA_BOX_SUGGEST_SESSION_LIMIT = 5;
const IDEA_BOX_VOTE_COUNT_KEY = 'genefaluche_idea_box_vote_count';
const IDEA_BOX_SUGGEST_COUNT_KEY = 'genefaluche_idea_box_suggest_count';

$pdo = database_pdo();
if (!$pdo) {
    api_respond(['error' => 'Base SQL indisponible pour la Boite a idees.'], 503);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = api_safe_id($_GET['action'] ?? '', 60);

try {
    if ($method === 'GET' && $action === 'list') {
        idea_box_public_list($pdo);
    }
    if ($method === 'GET' && $action === 'detail') {
        idea_box_public_detail($pdo);
    }
    if ($method === 'POST' && $action === 'vote') {
        idea_box_vote($pdo);
    }
    if ($method === 'DELETE' && $action === 'vote') {
        idea_box_delete_vote($pdo);
    }
    if ($method === 'POST' && $action === 'suggest') {
        idea_box_suggest($pdo);
    }
    if ($method === 'GET' && $action === 'admin') {
        require_general_admin_auth();
        idea_box_admin_payload($pdo);
    }
    if ($method === 'POST' && $action === 'admin') {
        require_general_admin_auth();
        require_csrf_token();
        idea_box_admin_action($pdo);
    }

} catch (Throwable $exception) {
    error_log(
        'Idea box API error: '
        . $exception->getMessage()
        . ' in '
        . $exception->getFile()
        . ':'
        . $exception->getLine()
    );

    api_respond([
        'error' => 'Requete Boite a idees impossible.',
    ], 500);
}

api_respond(['error' => 'Action inconnue.'], 404);

function idea_box_public_list(PDO $pdo): void
{
    $filters = idea_box_public_filters();
    [$where, $params] = idea_box_public_where($filters, false);
    $order = idea_box_order_sql($filters['sort'], $filters['status']);
    $limit = $filters['limit'];
    $offset = ($filters['page'] - 1) * $limit;
    $tokenHash = idea_box_token_hash($_GET['voterToken'] ?? '');

    $countStatement = $pdo->prepare("SELECT COUNT(*) FROM idea_box_proposals p {$where}");
    $countStatement->execute($params);
    $total = (int) $countStatement->fetchColumn();

    $sql = idea_box_select_sql($tokenHash !== '') . " {$where} {$order} LIMIT :limit OFFSET :offset";
    $statement = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $statement->bindValue($key, $value);
    }
    if ($tokenHash !== '') {
        $statement->bindValue(':token_hash', $tokenHash);
    }
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    api_respond([
        'proposals' => array_map('idea_box_public_row', $statement->fetchAll()),
        'pagination' => [
            'page' => $filters['page'],
            'limit' => $limit,
            'total' => $total,
            'pages' => (int) ceil($total / max(1, $limit)),
        ],
    ]);
}

function idea_box_public_detail(PDO $pdo): void
{
    $slug = api_safe_id($_GET['slug'] ?? '', 160);
    if ($slug === '') {
        api_respond(['error' => 'Idee introuvable.'], 404);
    }
    $tokenHash = idea_box_token_hash($_GET['voterToken'] ?? '');
    $sql = idea_box_select_sql($tokenHash !== '') . ' WHERE p.slug = :slug LIMIT 1';
    $statement = $pdo->prepare($sql);
    $statement->bindValue(':slug', $slug);
    if ($tokenHash !== '') {
        $statement->bindValue(':token_hash', $tokenHash);
    }
    $statement->execute();
    $row = $statement->fetch();
    if (!$row || in_array($row['status'], ['archived', 'rejected'], true)) {
        api_respond(['error' => 'Idee introuvable.'], 404);
    }
    api_respond(['proposal' => idea_box_public_row($row)]);
}

function idea_box_vote(PDO $pdo): void
{
    idea_box_increment_session_count(IDEA_BOX_VOTE_COUNT_KEY, IDEA_BOX_VOTE_SESSION_LIMIT);
    $body = api_read_json_body(IDEA_BOX_MAX_BODY_BYTES);
    if (!is_array($body)) {
        api_respond(['error' => 'Requete invalide.'], 400);
    }

    $proposalId = (int) ($body['proposalId'] ?? 0);
    $voteValue = (int) ($body['voteValue'] ?? 0);
    if (!in_array($voteValue, [1, -1], true)) {
        api_respond(['error' => 'Valeur de vote invalide.'], 400);
    }
    $tokenHash = idea_box_token_hash($body['voterToken'] ?? '');
    if ($tokenHash === '') {
        api_respond(['error' => 'Identifiant de vote absent.'], 400);
    }
    $reasonCode = idea_box_reason_code($body['reasonCode'] ?? '', $voteValue);
    $reasonText = api_safe_text($body['reasonText'] ?? '', 500);

    $proposal = idea_box_proposal_for_vote($pdo, $proposalId);
    if (!$proposal['voting_open']) {
        api_respond(['error' => 'Les votes sont actuellement fermes pour cette idee.'], 409);
    }

    $statement = $pdo->prepare(
        'INSERT INTO idea_box_votes (proposal_id, voter_token_hash, vote_value, reason_code, reason_text)
         VALUES (:proposal_id, :token_hash, :vote_value, :reason_code, :reason_text)
         ON DUPLICATE KEY UPDATE vote_value = VALUES(vote_value), reason_code = VALUES(reason_code), reason_text = VALUES(reason_text)'
    );
    $statement->execute([
        ':proposal_id' => $proposalId,
        ':token_hash' => $tokenHash,
        ':vote_value' => $voteValue,
        ':reason_code' => $reasonCode ?: null,
        ':reason_text' => $reasonText ?: null,
    ]);

    api_respond([
        'ok' => true,
        'vote' => $voteValue,
        'counts' => idea_box_vote_counts($pdo, $proposalId),
    ]);
}

function idea_box_delete_vote(PDO $pdo): void
{
    $proposalId = (int) ($_GET['proposalId'] ?? 0);
    $tokenHash = idea_box_token_hash($_GET['voterToken'] ?? '');
    if ($proposalId <= 0 || $tokenHash === '') {
        api_respond(['error' => 'Vote introuvable.'], 400);
    }
    idea_box_proposal_for_vote($pdo, $proposalId);
    $statement = $pdo->prepare('DELETE FROM idea_box_votes WHERE proposal_id = :proposal_id AND voter_token_hash = :token_hash');
    $statement->execute([':proposal_id' => $proposalId, ':token_hash' => $tokenHash]);
    api_respond(['ok' => true, 'vote' => null, 'counts' => idea_box_vote_counts($pdo, $proposalId)]);
}

function idea_box_suggest(PDO $pdo): void
{
    idea_box_increment_session_count(IDEA_BOX_SUGGEST_COUNT_KEY, IDEA_BOX_SUGGEST_SESSION_LIMIT);
    $body = api_read_json_body(IDEA_BOX_MAX_BODY_BYTES);
    if (!is_array($body)) {
        api_respond(['error' => 'Requete invalide.'], 400);
    }
    if (api_safe_text($body['website'] ?? '', 100) !== '') {
        api_respond(['ok' => true]);
    }

    $title = api_safe_text($body['title'] ?? '', 120);
    $description = api_safe_text($body['description'] ?? '', 2000);
    $solution = api_safe_text($body['suggestedSolution'] ?? '', 2000);
    $category = idea_box_category($body['category'] ?? '');
    $email = trim((string) ($body['contactEmail'] ?? ''));
    $email = $email === '' ? '' : (filter_var($email, FILTER_VALIDATE_EMAIL) ?: '');
    $consent = !empty($body['consentContact']);

    if ($title === '' || $description === '' || $category === '') {
        api_respond(['error' => 'Titre, description et categorie sont obligatoires.'], 400);
    }
    if (($body['contactEmail'] ?? '') !== '' && ($email === '' || !$consent)) {
        api_respond(['error' => 'Email invalide ou consentement manquant.'], 400);
    }

    $statement = $pdo->prepare(
        'INSERT INTO idea_box_suggestions (title, description, suggested_solution, category, contact_email, consent_contact)
         VALUES (:title, :description, :solution, :category, :email, :consent)'
    );
    $statement->execute([
        ':title' => $title,
        ':description' => $description,
        ':solution' => $solution ?: null,
        ':category' => $category,
        ':email' => $email ?: null,
        ':consent' => $email !== '' && $consent ? 1 : 0,
    ]);
    api_respond(['ok' => true]);
}

function idea_box_admin_payload(PDO $pdo): void
{
    $proposals = $pdo->query(idea_box_select_sql(false) . ' ORDER BY p.display_order ASC, p.updated_at DESC')->fetchAll();
    $suggestions = $pdo->query('SELECT * FROM idea_box_suggestions ORDER BY created_at DESC LIMIT 200')->fetchAll();
    api_respond([
        'proposals' => array_map('idea_box_public_row', $proposals),
        'suggestions' => array_map('idea_box_suggestion_row', $suggestions),
        'stats' => idea_box_admin_stats($pdo),
    ]);
}

function idea_box_admin_action(PDO $pdo): void
{
    $body = api_read_json_body(IDEA_BOX_MAX_BODY_BYTES * 2);
    if (!is_array($body)) {
        api_respond(['error' => 'Requete invalide.'], 400);
    }
    $adminAction = api_safe_id($body['adminAction'] ?? '', 80);
    if ($adminAction === 'save_proposal') {
        api_respond(['proposal' => idea_box_admin_save_proposal($pdo, $body['proposal'] ?? [])]);
    }
    if ($adminAction === 'delete_proposal') {
        $id = (int) ($body['proposalId'] ?? 0);
        $confirm = api_safe_text($body['confirm'] ?? '', 80);
        if ($id <= 0 || $confirm !== 'SUPPRIMER') {
            api_respond(['error' => 'Confirmation de suppression requise.'], 400);
        }
        $statement = $pdo->prepare('DELETE FROM idea_box_proposals WHERE id = :id');
        $statement->execute([':id' => $id]);
        api_respond(['ok' => true]);
    }
    if ($adminAction === 'update_suggestion') {
        idea_box_admin_update_suggestion($pdo, $body);
    }
    if ($adminAction === 'delete_suggestion') {
        $id = (int) ($body['suggestionId'] ?? 0);
        $confirm = api_safe_text($body['confirm'] ?? '', 80);
        if ($id <= 0 || $confirm !== 'SUPPRIMER') {
            api_respond(['error' => 'Confirmation de suppression requise.'], 400);
        }
        $statement = $pdo->prepare('DELETE FROM idea_box_suggestions WHERE id = :id');
        $statement->execute([':id' => $id]);
        api_respond(['ok' => true]);
    }
    if ($adminAction === 'convert_suggestion') {
        idea_box_admin_convert_suggestion($pdo, (int) ($body['suggestionId'] ?? 0));
    }
    api_respond(['error' => 'Action admin inconnue.'], 400);
}

function idea_box_admin_save_proposal(PDO $pdo, $raw): array
{
    $proposal = is_array($raw) ? $raw : [];
    $id = (int) ($proposal['id'] ?? 0);
    $title = api_safe_text($proposal['title'] ?? '', 120);
    $slug = api_safe_id($proposal['slug'] ?? idea_box_slug($title), 160);
    $summary = api_safe_text($proposal['summary'] ?? '', 500);
    if ($title === '' || $slug === '' || $summary === '') {
        api_respond(['error' => 'Titre, slug et resume sont obligatoires.'], 400);
    }
    $fields = [
        'title' => $title,
        'slug' => $slug,
        'summary' => $summary,
        'description' => api_safe_text($proposal['description'] ?? '', 5000) ?: null,
        'problem_statement' => api_safe_text($proposal['problemStatement'] ?? '', 3000) ?: null,
        'expected_benefit' => api_safe_text($proposal['expectedBenefit'] ?? '', 3000) ?: null,
        'category' => idea_box_category($proposal['category'] ?? '') ?: 'Autre',
        'status' => idea_box_status($proposal['status'] ?? 'under_review'),
        'difficulty' => idea_box_difficulty($proposal['difficulty'] ?? '') ?: null,
        'technical_priority' => idea_box_priority($proposal['technicalPriority'] ?? '') ?: null,
        'target_version' => api_safe_text($proposal['targetVersion'] ?? '', 30) ?: null,
        'public_comment' => api_safe_text($proposal['publicComment'] ?? '', 3000) ?: null,
        'voting_open' => !empty($proposal['votingOpen']) ? 1 : 0,
        'featured' => !empty($proposal['featured']) ? 1 : 0,
        'display_order' => (int) ($proposal['displayOrder'] ?? 0),
        'published_at' => idea_box_datetime($proposal['publishedAt'] ?? ''),
        'released_at' => idea_box_datetime($proposal['releasedAt'] ?? ''),
    ];

    if ($id > 0) {
        $sets = [];
        foreach ($fields as $field => $_) {
            $sets[] = $field . ' = :' . $field;
        }
        $statement = $pdo->prepare('UPDATE idea_box_proposals SET ' . implode(', ', $sets) . ' WHERE id = :id');
        $fields['id'] = $id;
        $statement->execute(idea_box_bind_fields($fields));
    } else {
        $columns = implode(', ', array_keys($fields));
        $placeholders = ':' . implode(', :', array_keys($fields));
        $statement = $pdo->prepare("INSERT INTO idea_box_proposals ({$columns}) VALUES ({$placeholders})");
        $statement->execute(idea_box_bind_fields($fields));
        $id = (int) $pdo->lastInsertId();
    }

    $statement = $pdo->prepare(idea_box_select_sql(false) . ' WHERE p.id = :id LIMIT 1');
    $statement->execute([':id' => $id]);
    return idea_box_public_row($statement->fetch() ?: []);
}

function idea_box_admin_update_suggestion(PDO $pdo, array $body): void
{
    $id = (int) ($body['suggestionId'] ?? 0);
    $status = idea_box_suggestion_status($body['status'] ?? '');
    if ($id <= 0 || $status === '') {
        api_respond(['error' => 'Suggestion invalide.'], 400);
    }
    $linkedProposalId = (int) ($body['linkedProposalId'] ?? 0);
    $statement = $pdo->prepare(
        'UPDATE idea_box_suggestions
         SET moderation_status = :status,
             admin_note = :note,
             linked_proposal_id = CASE WHEN :linked_proposal_id_check > 0 THEN :linked_proposal_id ELSE linked_proposal_id END
         WHERE id = :id'
    );
    $statement->execute([
        ':id' => $id,
        ':status' => $status,
        ':note' => api_safe_text($body['adminNote'] ?? '', 2000) ?: null,
        ':linked_proposal_id_check' => $linkedProposalId,
        ':linked_proposal_id' => $linkedProposalId,
    ]);
    api_respond(['ok' => true]);
}

function idea_box_admin_convert_suggestion(PDO $pdo, int $id): void
{
    $statement = $pdo->prepare('SELECT * FROM idea_box_suggestions WHERE id = :id');
    $statement->execute([':id' => $id]);
    $suggestion = $statement->fetch();
    if (!$suggestion) {
        api_respond(['error' => 'Suggestion introuvable.'], 404);
    }
    $proposal = idea_box_admin_save_proposal($pdo, [
        'title' => $suggestion['title'],
        'summary' => $suggestion['description'],
        'description' => $suggestion['suggested_solution'],
        'category' => $suggestion['category'],
        'status' => 'under_review',
        'difficulty' => '',
        'votingOpen' => true,
    ]);
    $update = $pdo->prepare('UPDATE idea_box_suggestions SET moderation_status = :status, linked_proposal_id = :proposal_id WHERE id = :id');
    $update->execute([':status' => 'converted', ':proposal_id' => $proposal['id'], ':id' => $id]);
    api_respond(['proposal' => $proposal]);
}

function idea_box_select_sql(bool $includeCurrentVote): string
{
    $currentVote = $includeCurrentVote
        ? ', (
                SELECT cv.vote_value
                FROM idea_box_votes cv
                WHERE cv.proposal_id = p.id
                  AND cv.voter_token_hash = :token_hash
                LIMIT 1
            ) AS current_vote'
        : ', NULL AS current_vote';

    return "
        SELECT
            p.*,
            COALESCE(vote_totals.up_votes, 0) AS up_votes,
            COALESCE(vote_totals.down_votes, 0) AS down_votes,
            COALESCE(vote_totals.total_votes, 0) AS total_votes,
            (
                COALESCE(vote_totals.up_votes, 0)
                - COALESCE(vote_totals.down_votes, 0)
            ) AS vote_score
            {$currentVote}

        FROM idea_box_proposals p

        LEFT JOIN (
            SELECT
                proposal_id,

                SUM(
                    CASE
                        WHEN vote_value = 1 THEN 1
                        ELSE 0
                    END
                ) AS up_votes,

                SUM(
                    CASE
                        WHEN vote_value = -1 THEN 1
                        ELSE 0
                    END
                ) AS down_votes,

                COUNT(*) AS total_votes

            FROM idea_box_votes
            GROUP BY proposal_id
        ) vote_totals
            ON vote_totals.proposal_id = p.id
    ";
}

function idea_box_public_where(array $filters, bool $detail): array
{
    $clauses = ["p.status NOT IN ('rejected', 'archived')"];
    $params = [];
    if (!$detail && $filters['status'] !== '') {
        $clauses[] = 'p.status = :status';
        $params[':status'] = $filters['status'];
    }
    if ($filters['category'] !== '') {
        $clauses[] = 'p.category = :category';
        $params[':category'] = $filters['category'];
    }
    if ($filters['query'] !== '') {
        $clauses[] = '(p.title LIKE :query OR p.summary LIKE :query OR p.description LIKE :query)';
        $params[':query'] = '%' . $filters['query'] . '%';
    }
    return ['WHERE ' . implode(' AND ', $clauses), $params];
}

function idea_box_public_filters(): array
{
    $status = idea_box_status($_GET['status'] ?? '');
    if (!in_array($status, ['under_review', 'planned', 'in_development', 'published'], true)) {
        $status = '';
    }
    $limit = min(IDEA_BOX_PUBLIC_LIMIT, max(1, (int) ($_GET['limit'] ?? 20)));
    return [
        'status' => $status,
        'category' => idea_box_category($_GET['category'] ?? ''),
        'sort' => api_safe_id($_GET['sort'] ?? 'popular', 40),
        'query' => api_safe_text($_GET['query'] ?? '', 120),
        'page' => max(1, (int) ($_GET['page'] ?? 1)),
        'limit' => $limit,
    ];
}

function idea_box_order_sql(string $sort, string $status): string
{
    if ($status === 'published') {
        return 'ORDER BY p.released_at DESC, p.published_at DESC, p.updated_at DESC';
    }
    if ($sort === 'recent') {
        return 'ORDER BY p.created_at DESC';
    }
    if ($sort === 'controversial') {
        return 'ORDER BY LEAST(up_votes, down_votes) DESC, (up_votes + down_votes) DESC';
    }
    if ($sort === 'updated') {
        return 'ORDER BY p.updated_at DESC';
    }
    return 'ORDER BY p.featured DESC, (up_votes - down_votes) DESC, up_votes DESC, p.display_order ASC';
}

function idea_box_public_row(array $row): array
{
    return [
        'id' => (int) ($row['id'] ?? 0),
        'slug' => (string) ($row['slug'] ?? ''),
        'title' => (string) ($row['title'] ?? ''),
        'summary' => (string) ($row['summary'] ?? ''),
        'description' => (string) ($row['description'] ?? ''),
        'problemStatement' => (string) ($row['problem_statement'] ?? ''),
        'expectedBenefit' => (string) ($row['expected_benefit'] ?? ''),
        'category' => (string) ($row['category'] ?? ''),
        'status' => (string) ($row['status'] ?? ''),
        'difficulty' => (string) ($row['difficulty'] ?? ''),
        'technicalPriority' => (string) ($row['technical_priority'] ?? ''),
        'targetVersion' => (string) ($row['target_version'] ?? ''),
        'publicComment' => (string) ($row['public_comment'] ?? ''),
        'votingOpen' => !empty($row['voting_open']),
        'featured' => !empty($row['featured']),
        'displayOrder' => (int) ($row['display_order'] ?? 0),
        'publishedAt' => (string) ($row['published_at'] ?? ''),
        'releasedAt' => (string) ($row['released_at'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
        'votes' => [
            'up' => (int) ($row['up_votes'] ?? 0),
            'down' => (int) ($row['down_votes'] ?? 0),
            'total' => (int) ($row['up_votes'] ?? 0) + (int) ($row['down_votes'] ?? 0),
        ],
        'currentVote' => isset($row['current_vote']) ? (int) $row['current_vote'] : null,
    ];
}

function idea_box_suggestion_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'title' => (string) $row['title'],
        'description' => (string) $row['description'],
        'suggestedSolution' => (string) ($row['suggested_solution'] ?? ''),
        'category' => (string) $row['category'],
        'contactEmail' => (string) ($row['contact_email'] ?? ''),
        'consentContact' => !empty($row['consent_contact']),
        'moderationStatus' => (string) $row['moderation_status'],
        'linkedProposalId' => isset($row['linked_proposal_id']) ? (int) $row['linked_proposal_id'] : null,
        'adminNote' => (string) ($row['admin_note'] ?? ''),
        'createdAt' => (string) $row['created_at'],
        'updatedAt' => (string) $row['updated_at'],
    ];
}

function idea_box_vote_counts(PDO $pdo, int $proposalId): array
{
    $statement = $pdo->prepare('SELECT SUM(vote_value = 1) AS up_votes, SUM(vote_value = -1) AS down_votes FROM idea_box_votes WHERE proposal_id = :proposal_id');
    $statement->execute([':proposal_id' => $proposalId]);
    $row = $statement->fetch() ?: [];
    $up = (int) ($row['up_votes'] ?? 0);
    $down = (int) ($row['down_votes'] ?? 0);
    return ['up' => $up, 'down' => $down, 'total' => $up + $down];
}

function idea_box_proposal_for_vote(PDO $pdo, int $proposalId): array
{
    $statement = $pdo->prepare('SELECT id, voting_open FROM idea_box_proposals WHERE id = :id AND status NOT IN ("archived", "rejected")');
    $statement->execute([':id' => $proposalId]);
    $proposal = $statement->fetch();
    if (!$proposal) {
        api_respond(['error' => 'Idee introuvable.'], 404);
    }
    return ['id' => (int) $proposal['id'], 'voting_open' => !empty($proposal['voting_open'])];
}

function idea_box_token_hash($token): string
{
    $token = is_string($token) ? trim($token) : '';
    if (!preg_match('/^[A-Za-z0-9_-]{32,160}$/', $token)) {
        return '';
    }
    $secret = database_env('IDEA_BOX_VOTE_SECRET', database_env('AUTH_SECRET', ''));
    return $secret !== '' ? hash_hmac('sha256', $token, $secret) : hash('sha256', $token);
}

function idea_box_increment_session_count(string $key, int $limit): void
{
    site_auth_start();
    $count = (int) ($_SESSION[$key] ?? 0);
    if ($count >= $limit) {
        api_respond(['error' => 'Limite temporaire atteinte. Reessaie plus tard.'], 429);
    }
    $_SESSION[$key] = $count + 1;
}

function idea_box_admin_stats(PDO $pdo): array
{
    $total = (int) $pdo->query('SELECT COUNT(*) FROM idea_box_proposals')->fetchColumn();
    $open = (int) $pdo->query('SELECT COUNT(*) FROM idea_box_proposals WHERE voting_open = 1')->fetchColumn();
    $pending = (int) $pdo->query("SELECT COUNT(*) FROM idea_box_suggestions WHERE moderation_status = 'pending_review'")->fetchColumn();
    $votes = $pdo->query('SELECT SUM(vote_value = 1) AS up_votes, SUM(vote_value = -1) AS down_votes, COUNT(*) AS total_votes FROM idea_box_votes')->fetch() ?: [];
    $popular = $pdo->query(idea_box_select_sql(false) . ' ORDER BY up_votes DESC LIMIT 5')->fetchAll();
    $controversial = $pdo->query(idea_box_select_sql(false) . ' ORDER BY LEAST(up_votes, down_votes) DESC LIMIT 5')->fetchAll();
    return [
        'totalProposals' => $total,
        'openVotes' => $open,
        'pendingSuggestions' => $pending,
        'totalVotes' => (int) ($votes['total_votes'] ?? 0),
        'upVotes' => (int) ($votes['up_votes'] ?? 0),
        'downVotes' => (int) ($votes['down_votes'] ?? 0),
        'popular' => array_map('idea_box_public_row', $popular),
        'controversial' => array_map('idea_box_public_row', $controversial),
    ];
}

function idea_box_category($value): string
{
    $category = api_safe_text($value, 50);
    $allowed = ['Arbre et réseau', 'Fiches', 'Événements', 'Administration', 'Mobile', 'Performance', 'Export', 'Confidentialité', 'Tutoriels', 'Autre'];
    return in_array($category, $allowed, true) ? $category : '';
}

function idea_box_status($value): string
{
    $status = api_safe_id($value, 40);
    $allowed = ['under_review', 'planned', 'in_development', 'in_testing', 'published', 'rejected', 'archived'];
    return in_array($status, $allowed, true) ? $status : 'under_review';
}

function idea_box_suggestion_status($value): string
{
    $status = api_safe_id($value, 40);
    $allowed = ['pending_review', 'accepted', 'converted', 'duplicate', 'rejected', 'archived'];
    return in_array($status, $allowed, true) ? $status : '';
}

function idea_box_difficulty($value): string
{
    $value = api_safe_id($value, 20);
    return in_array($value, ['low', 'medium', 'high', 'very_high'], true) ? $value : '';
}

function idea_box_priority($value): string
{
    $value = api_safe_id($value, 20);
    return in_array($value, ['low', 'normal', 'high', 'critical'], true) ? $value : '';
}

function idea_box_reason_code($value, int $voteValue): string
{
    $value = api_safe_id($value, 50);
    $positive = ['tres_utile', 'utile_occasionnellement', 'prioritaire', 'bonne_idee_pas_urgente', 'autre'];
    $negative = ['peu_utile', 'trop_complexe', 'risque_confidentialite', 'moins_simple', 'autre'];
    return in_array($value, $voteValue === 1 ? $positive : $negative, true) ? $value : '';
}

function idea_box_datetime($value): ?string
{
    $value = api_safe_text($value, 30);
    if ($value === '') {
        return null;
    }
    $timestamp = strtotime($value);
    return $timestamp === false ? null : gmdate('Y-m-d H:i:s', $timestamp);
}

function idea_box_slug(string $title): string
{
    return api_safe_id(strtolower($title), 160);
}

function idea_box_bind_fields(array $fields): array
{
    $bound = [];
    foreach ($fields as $key => $value) {
        $bound[':' . $key] = $value;
    }
    return $bound;
}
