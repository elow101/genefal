# Migration progressive JSON vers SQL

Ce document prepare une migration progressive du stockage JSON vers MySQL/MariaDB, sans supprimer les fichiers JSON existants.

## Audit des fichiers JSON

Fichiers detectes ou references :

- `data/genealogy.json` : donnees principales, arbres, personnes, relations embarquees et `upcomingBaptisms`.
- `data/upcoming-secrets.json` : hash des mots de passe createur, emails createur, emails des demandes de participation.
- `data/upcoming-subscriptions.json` : abonnements email par region.
- `data/auth.json` : configuration d'authentification, hashs admin et sessions regionales.
- `data/doleances.json` : demandes/doleances admin.

Autre stockage detecte :

- `data/auth-rate-limit.sqlite` : stockage SQLite de rate limiting auth.

## Endpoints et fonctions concernes

- `api/genealogy.php`
  - lit/ecrit `data/genealogy.json`.
  - normalise `genealogies`, `people`, relations et `upcomingBaptisms`.
  - expose l'etat public au frontend.
- `api/upcoming.php`
  - cree, modifie et supprime les evenements.
  - lit/ecrit `upcomingBaptisms` dans `genealogy.json`.
  - lit/ecrit `upcoming-secrets.json` et `upcoming-subscriptions.json`.
- `api/doleances.php`
  - lit/ecrit `data/doleances.json`.
- `site-auth.php`
  - lit/ecrit `data/auth.json`.
  - lit `data/genealogy.json` pour les droits regionaux.
- `api/diagnostic.php`
  - verifie la presence et la taille des fichiers JSON.

## Choix SQL

Le schema cible est MySQL/MariaDB, compatible avec un hebergement mutualise de type ProFreeHost.

La connexion est optionnelle et controlee par `.env` :

```env
SQL_ENABLED=0
SQL_READ_UPCOMING=0
DB_HOST=
DB_PORT=3306
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_CHARSET=utf8mb4
```

Pendant la transition :

- `SQL_ENABLED=0` garde le fonctionnement JSON actuel.
- `SQL_ENABLED=1` active le miroir SQL pour les evenements.
- `SQL_READ_UPCOMING=1` permet de lire les evenements depuis SQL si la base est disponible.
- En cas d'erreur SQL, le code loggue l'erreur et conserve le fallback JSON.

## Schema SQL propose

Le fichier [database/schema.sql](database/schema.sql) cree :

- `genealogies`
- `people`
- `person_relations`
- `events`
- `event_participation_requests`
- `event_region_subscriptions`
- `event_creator_secrets`
- `admin_accounts`

Pour l'etape 1 de migration, seules les tables `events`, `event_participation_requests`, `event_region_subscriptions` et `event_creator_secrets` sont utilisees par le code.

## Migration progressive

1. Installer la base MySQL/MariaDB et renseigner `.env`.
2. Laisser `SQL_READ_UPCOMING=0`.
3. Initialiser le schema :

```bash
php scripts/init_sql_schema.php
```

4. Migrer les donnees JSON existantes :

```bash
php scripts/migrate_upcoming_json_to_sql.php
```

5. Verifier le resume de migration.
6. Verifier `api/diagnostic.php` en admin general : la cle `sql.connected` doit etre `true` et les compteurs de tables doivent etre visibles.
7. Tester les creations/modifications d'evenements avec `SQL_ENABLED=1`.
8. Quand les donnees SQL sont validees, activer `SQL_READ_UPCOMING=1`.
9. Garder les JSON en sauvegarde tant que toute la genealogie n'est pas migree.

## Compatibilite temporaire

Le code garde une strategie JSON-first :

- les ecritures evenements continuent de mettre a jour `genealogy.json`, `upcoming-secrets.json` et `upcoming-subscriptions.json`;
- si `SQL_ENABLED=1`, ces memes ecritures sont aussi miroir en SQL;
- les notifications region lisent les abonnes JSON et SQL, dedoublonnes par hash email;
- les mots de passe createur sont verifies depuis JSON, puis depuis SQL si le secret JSON n'est pas disponible;
- la lecture publique des evenements ne passe a SQL que si `SQL_READ_UPCOMING=1`.

## Securite

- Les mots de passe createur restent stockes uniquement sous forme de hash.
- Les emails ne sont jamais renvoyes publiquement par l'API publique.
- Les requetes SQL utilisent PDO et des requetes preparees.
- `.env` ne doit jamais etre commite.
- `.env.example` ne contient aucun secret.

## Risques principaux

- Divergence temporaire entre JSON et SQL si une ecriture SQL echoue apres l'ecriture JSON.
- Donnees anciennes sans email de demande : ces demandes sont ignorees par le script SQL car l'email n'est pas public dans `genealogy.json`.
- Activation prematuree de `SQL_READ_UPCOMING=1` avant migration complete.
- Differents formats historiques de `dateTime` pouvant necessiter une correction manuelle.

## Tests a realiser

- Migration depuis JSON sur une copie des donnees.
- Lecture des evenements avec `SQL_READ_UPCOMING=1`.
- Creation d'evenement.
- Demande de participation.
- Double demande impossible seulement pour le meme evenement.
- Acceptation/refus par createur.
- Suppression createur.
- Abonnement/desabonnement region.
- Envoi mail apres creation d'evenement.
- Fallback JSON lorsque SQL est coupe ou mal configure.
