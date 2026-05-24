CREATE TABLE IF NOT EXISTS genealogies (
  id VARCHAR(100) NOT NULL,
  parent_id VARCHAR(100) NULL,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(40) NOT NULL,
  photo_path VARCHAR(255) NULL,
  cooptage_role_id VARCHAR(80) NULL,
  custom_roles_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_genealogies_parent (parent_id),
  INDEX idx_genealogies_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS people (
  id VARCHAR(100) NOT NULL,
  genealogy_id VARCHAR(100) NOT NULL,
  name VARCHAR(160) NOT NULL,
  nickname VARCHAR(160) NULL,
  birth_date DATE NULL,
  baptism_date DATE NULL,
  filiere VARCHAR(120) NULL,
  roles_json JSON NULL,
  notes TEXT NULL,
  photo_path VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_people_genealogy (genealogy_id),
  INDEX idx_people_name (name),
  FULLTEXT INDEX ft_people_search (name, nickname),
  CONSTRAINT fk_people_genealogy FOREIGN KEY (genealogy_id) REFERENCES genealogies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS person_relations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  genealogy_id VARCHAR(100) NOT NULL,
  source_person_id VARCHAR(100) NOT NULL,
  target_person_id VARCHAR(100) NOT NULL,
  relation_type VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_person_relation (source_person_id, target_person_id, relation_type),
  INDEX idx_relation_genealogy (genealogy_id),
  INDEX idx_relation_source (source_person_id, relation_type),
  INDEX idx_relation_target (target_person_id, relation_type),
  CONSTRAINT fk_relation_genealogy FOREIGN KEY (genealogy_id) REFERENCES genealogies(id) ON DELETE CASCADE,
  CONSTRAINT fk_relation_source FOREIGN KEY (source_person_id) REFERENCES people(id) ON DELETE CASCADE,
  CONSTRAINT fk_relation_target FOREIGN KEY (target_person_id) REFERENCES people(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(100) NOT NULL,
  region_id VARCHAR(100) NOT NULL,
  title VARCHAR(140) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  date_time DATETIME NOT NULL,
  place VARCHAR(160) NULL,
  message TEXT NULL,
  creator_name VARCHAR(120) NULL,
  visibility VARCHAR(40) NOT NULL DEFAULT 'public',
  sponsor_ids JSON NULL,
  fillot_ids JSON NULL,
  baptized_names JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_events_region_date (region_id, date_time),
  INDEX idx_events_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_participation_requests (
  id VARCHAR(100) NOT NULL,
  event_id VARCHAR(100) NOT NULL,
  name VARCHAR(90) NOT NULL,
  nickname VARCHAR(90) NULL,
  message VARCHAR(600) NULL,
  status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  email_hash CHAR(64) NOT NULL,
  email_encrypted VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_event_request_email (event_id, email_hash),
  INDEX idx_event_requests_status (event_id, status),
  CONSTRAINT fk_event_requests_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_region_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  region_id VARCHAR(100) NOT NULL,
  email_hash CHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_region_subscription (region_id, email_hash),
  INDEX idx_region_subscriptions_region (region_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_creator_secrets (
  event_id VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  creator_email VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  CONSTRAINT fk_event_creator_secret_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope VARCHAR(40) NOT NULL,
  genealogy_id VARCHAR(100) NULL,
  password_hash VARCHAR(255) NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_admin_scope_genealogy (scope, genealogy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
