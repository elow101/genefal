# Faluche Nationale

Application web légère pour consulter, éditer et visualiser des généalogies de faluche.

Le projet repose désormais sur :

- un frontend principal unique en Vue 3 / Vite ;
- une API PHP pour l’authentification, la persistance et l’administration ;
- un rendu volontairement proche de l’ancienne version du site afin de conserver l’expérience utilisateur historique.

## Fonctionnalités principales

- arbre, réseau, vue d’ensemble, nouveaux venus, statistiques et événements à venir ;
- fiches faluchards avec sections identité, baptême, parrainage (parrains, parrains de cœur, fillots) et rôles ;
- recherche rapide avec focus immédiat ;
- sauvegardes ponctuelles sans bouton global de sauvegarde ;
- doléances publiques et modération admin ;
- administration générale et régionale ;
- gestion des régions, familles, photos de branches et rôles régionaux ;
- annonces de baptême, adoption, confirmation et cooptage ;
- palette stricte de filières avec couleurs visibles sur les pastilles ;
- lien discret vers la politique de confidentialité / RGPD.

## Démarrage rapide

### Prérequis

- PHP ;
- Node.js.

### Configurer les mots de passe

Générer les hashes hors du dépôt :

```powershell
php scripts/hash-password.php "mot-de-passe-site"
php scripts/hash-password.php "mot-de-passe-admin-general"
```

Puis exposer :

```text
FALUCHE_SITE_PASSWORD_HASH=...
FALUCHE_GENERAL_ADMIN_PASSWORD_HASH=...
```

### Lancer le site localement

Pour tester exactement ce qui sera servi en production :

```powershell
npm run frontend:build
php -S 127.0.0.1:8765 -t .
```

Puis ouvrir :

```text
http://127.0.0.1:8765/
```

Pour travailler avec le rechargement Vite, ouvrir deux terminaux :

```powershell
npm run backend:dev
npm run frontend:dev
```

Se connecter d’abord sur :

```text
http://127.0.0.1:8765/
```

puis revenir sur :

```text
http://127.0.0.1:5173/
```

## Architecture

```text
frontend/src/
  api/          appels HTTP
  composables/  orchestration Vue et flux applicatifs
  domain/       règles métier pures
  features/     blocs d’interface
  assets/       styles globaux
```

Les grands domaines historiques ont été transférés dans Vue :

| Domaine | État |
| --- | --- |
| Personnes | migré |
| Généalogies | migré |
| Événements | migré |
| Doléances | migré |
| Statistiques | migré |
| Graphe | migré |
| Exports | migré |
| Administration | migré |

## Règles fonctionnelles importantes

- Le frontend Vue est le frontend principal ; l’ancien `app.js` n’est plus la source de vérité.
- Une région a toujours pour parent l’arbre national.
- Une famille a toujours pour parent une région.
- Une session publique ne peut modifier que les fiches qu’elle a créées pendant cette même session ; sinon une doléance doit être envoyée.
- Un admin régional peut gérer sa région, ses familles, leurs photos et leurs rôles régionaux.
- L’admin général peut gérer toutes les régions, toutes les familles et l’ensemble des rôles.
- Le rôle utilisé pour les cooptages est configurable par région ; `TVA` reste la valeur par défaut.
- Les filières autorisées sont centralisées dans `frontend/src/domain/filiere.js` et validées aussi côté PHP.

## Schéma de données

Les sauvegardes utilisent un contrat versionné :

```json
{
  "schemaVersion": 1,
  "roleResetVersion": 1,
  "activeGenealogyId": "faluche-nationale",
  "genealogies": [],
  "upcomingBaptisms": []
}
```

Chaque généalogie peut notamment porter :

```json
{
  "id": "alsace",
  "name": "La faluche alsacienne",
  "type": "region",
  "parentId": "faluche-nationale",
  "photoData": "",
  "people": [],
  "customRoles": [],
  "cooptageRoleId": "tva"
}
```

Les anciennes sauvegardes plates sont migrées automatiquement vers cette forme au chargement, côté frontend comme côté backend.

## Carte des fichiers

| Fichier | Rôle |
| --- | --- |
| `index.php` | Authentifie puis sert le build Vue. |
| `frontend/` | Frontend applicatif principal. |
| `privacy.html` | Politique de confidentialité / RGPD. |
| `site-auth.php` | Sessions, CSRF, mots de passe, rate limits, audit. |
| `api/genealogy.php` | Lecture / écriture de la généalogie. |
| `api/admin.php` | Connexion admin et mots de passe régionaux. |
| `api/doleances.php` | Création et modération des doléances. |
| `api/auth.php` | État d’authentification visiteur. |
| `MAINTENANCE.md` | Règles de maintenance et points de vigilance. |
| `PROFREEHOST_DEPLOYMENT.md` | Procédure de déploiement ProFreeHost. |

## Commandes utiles

```powershell
npm test
npm run frontend:build
npm run frontend:dev
npm run frontend:test
npm run frontend:lint
php tests/genealogy-server.test.php
```

## Déploiement

Pour ProFreeHost, suivre `PROFREEHOST_DEPLOYMENT.md`.

Avant toute mise en ligne :

```powershell
npm test
npm run frontend:build
npm run frontend:lint
php tests/genealogy-server.test.php
```

Vérifier ensuite manuellement :

1. connexion visiteur ;
2. navigation des onglets ;
3. création / modification autorisée d’une fiche ;
4. connexion et déconnexion admin ;
5. création d’un événement ;
6. persistance après rechargement ;
7. refus d’accès direct à `data/auth.json`.

## Contribution open source

1. Lire `README.md`, `MAINTENANCE.md`, `SECURITY.md` et `OPEN_SOURCE.md`.
2. Créer une branche dédiée.
3. Placer chaque nouvelle logique dans son bloc (`api`, `domain`, `composables`, `features`).
4. Lancer les commandes de contrôle avant publication.
5. Ne jamais commiter de secrets ni de vraies données utilisateurs.
