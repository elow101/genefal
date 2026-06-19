-- GeneFaluche 1.1.0 - Boite a idees communautaire

CREATE TABLE IF NOT EXISTS idea_box_proposals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(160) NOT NULL UNIQUE,
    title VARCHAR(120) NOT NULL,
    summary VARCHAR(500) NOT NULL,
    description TEXT NULL,
    problem_statement TEXT NULL,
    expected_benefit TEXT NULL,
    category VARCHAR(50) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'under_review',
    difficulty VARCHAR(20) NULL,
    technical_priority VARCHAR(20) NULL,
    target_version VARCHAR(30) NULL,
    public_comment TEXT NULL,
    voting_open TINYINT(1) NOT NULL DEFAULT 1,
    featured TINYINT(1) NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    published_at DATETIME NULL,
    released_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_idea_box_status (status),
    INDEX idx_idea_box_category (category),
    INDEX idx_idea_box_featured (featured),
    INDEX idx_idea_box_created_at (created_at),
    CONSTRAINT chk_idea_box_status CHECK (status IN ('under_review', 'planned', 'in_development', 'in_testing', 'published', 'rejected', 'archived')),
    CONSTRAINT chk_idea_box_difficulty CHECK (difficulty IS NULL OR difficulty IN ('low', 'medium', 'high', 'very_high')),
    CONSTRAINT chk_idea_box_priority CHECK (technical_priority IS NULL OR technical_priority IN ('low', 'normal', 'high', 'critical'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS idea_box_votes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    proposal_id BIGINT UNSIGNED NOT NULL,
    voter_token_hash CHAR(64) NOT NULL,
    vote_value TINYINT NOT NULL,
    reason_code VARCHAR(50) NULL,
    reason_text VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_idea_box_vote (proposal_id, voter_token_hash),
    INDEX idx_idea_box_vote_proposal (proposal_id),
    INDEX idx_idea_box_vote_value (vote_value),
    CONSTRAINT fk_idea_box_vote_proposal FOREIGN KEY (proposal_id) REFERENCES idea_box_proposals(id) ON DELETE CASCADE,
    CONSTRAINT chk_idea_box_vote_value CHECK (vote_value IN (1, -1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS idea_box_suggestions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    suggested_solution TEXT NULL,
    category VARCHAR(50) NOT NULL,
    contact_email VARCHAR(254) NULL,
    consent_contact TINYINT(1) NOT NULL DEFAULT 0,
    moderation_status VARCHAR(40) NOT NULL DEFAULT 'pending_review',
    linked_proposal_id BIGINT UNSIGNED NULL,
    admin_note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_idea_box_suggestion_status (moderation_status),
    INDEX idx_idea_box_suggestion_category (category),
    CONSTRAINT fk_idea_box_suggestion_proposal FOREIGN KEY (linked_proposal_id) REFERENCES idea_box_proposals(id) ON DELETE SET NULL,
    CONSTRAINT chk_idea_box_suggestion_status CHECK (moderation_status IN ('pending_review', 'accepted', 'converted', 'duplicate', 'rejected', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO idea_box_proposals
    (slug, title, summary, description, problem_statement, expected_benefit, category, status, difficulty, display_order)
VALUES
    ('comptes-utilisateurs-facultatifs', 'Comptes utilisateurs facultatifs', 'Permettre de retrouver ses événements, ses demandes de participation et ses préférences.', 'Des comptes facultatifs pourraient aider les visiteurs réguliers sans rendre l inscription obligatoire.', 'Les visiteurs ne peuvent pas retrouver facilement leurs préférences ou demandes depuis un autre navigateur.', 'Retrouver ses actions plus simplement tout en gardant un usage public sans compte.', 'Administration', 'under_review', 'very_high', 10),
    ('vue-calendrier-des-evenements', 'Vue calendrier des événements', 'Afficher les événements à venir dans un calendrier mensuel en complément de la vue liste.', 'Une vue mensuelle donnerait une lecture rapide des dates importantes.', 'La liste chronologique est efficace mais moins visuelle pour planifier un mois.', 'Mieux anticiper les rassemblements et les chevauchements de dates.', 'Événements', 'under_review', 'medium', 20),
    ('tableau-de-bord-gestion-evenements', 'Tableau de bord de gestion des événements', 'Centraliser la modification d un événement, les demandes de participation et les actions importantes.', 'Regrouper dans une seule interface les actions de gestion des événements.', 'Les actions administratives sont dispersées entre plusieurs vues.', 'Gagner du temps et réduire les erreurs lors du suivi des événements.', 'Événements', 'under_review', 'high', 30),
    ('liste-attente-evenements', 'Liste d attente pour les événements', 'Permettre de gérer les demandes lorsque la capacité maximale d un événement est atteinte.', 'Ajouter une file d attente lorsque les places sont limitées.', 'Les organisateurs doivent gérer manuellement les demandes excédentaires.', 'Clarifier les priorités et les relances en cas de désistement.', 'Événements', 'under_review', 'medium', 40),
    ('amelioration-export-pdf', 'Amélioration de l export PDF', 'Produire des exports plus lisibles, mieux dimensionnés et adaptés à l impression.', 'Améliorer le rendu PDF pour les grands réseaux et les impressions.', 'Certains exports sont difficiles à lire lorsque l arbre est dense.', 'Partager des documents plus propres et plus faciles à imprimer.', 'Export', 'under_review', 'high', 50),
    ('optimisation-performances-graphe', 'Optimisation des performances du graphe', 'Réduire la consommation de mémoire et améliorer la fluidité des grands arbres sur mobile et desktop.', 'Optimiser le calcul et le rendu du graphe généalogique.', 'Les grands arbres peuvent devenir lourds sur certains appareils.', 'Conserver une navigation fluide même avec beaucoup de fiches.', 'Performance', 'under_review', 'very_high', 60)
ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    summary = VALUES(summary),
    category = VALUES(category),
    status = VALUES(status),
    difficulty = VALUES(difficulty),
    display_order = VALUES(display_order);
