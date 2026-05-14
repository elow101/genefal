# Faluche Nationale

Application web legere pour consulter, editer et visualiser des genealogies de faluche.

Le projet n'a pas de framework cote front. Il repose surtout sur:

- `index.php` pour l'entree protegee par mot de passe.
- `index.html` pour la structure HTML de l'application.
- `app.js` pour le cablage DOM, les actions utilisateur restantes et l'orchestration du rendu.
- `src/` pour les modules front extraits progressivement de `app.js`.
- `styles.css` pour toute l'interface.
- `api/*.php` pour la persistance, les sessions, l'administration et les doleances.
- `modules/*.js` pour les helpers extraits progressivement de `app.js`.

## Demarrage rapide

Prerequis utiles:

- PHP pour servir l'application et tester l'API.
- Node.js pour verifier le JavaScript et lancer les tests JS.

Pour une premiere installation, configure les hashes de mots de passe hors du depot:

```powershell
php scripts/hash-password.php "mot-de-passe-site"
php scripts/hash-password.php "mot-de-passe-admin-general"
```

Puis expose ces variables d'environnement sur le serveur:

```text
FALUCHE_SITE_PASSWORD_HASH=...
FALUCHE_GENERAL_ADMIN_PASSWORD_HASH=...
```

Lancer en local:

```powershell
php -S 127.0.0.1:8765 -t .
```

Puis ouvrir:

```text
http://127.0.0.1:8765/
```

Il n'y a pas d'etape de build. Les fichiers servis sont directement ceux du depot.

## Commandes de controle

```powershell
node --check app.js
node --check src/main.js
node tests/data-normalisation.test.mjs
node tests/features.test.mjs
php tests/genealogy-server.test.php
```

Si `npm` est disponible:

```powershell
npm test
```

Ce que les tests couvrent aujourd'hui:

- Normalisation client dans `modules/data.js`.
- Libelles simples dans `modules/labels.js`.
- Helpers extraits dans `src/state.js`, `src/features/*` et `src/ui/*`.
- Normalisation serveur et fusion des sauvegardes dans `api/genealogy.php`.

## Carte des fichiers

| Fichier | Role |
| --- | --- |
| `index.php` | Affiche le formulaire de mot de passe, cree un jeton d'acces court, puis sert `index.html`. |
| `index.html` | Contient le squelette de l'interface, verifie `api/auth.php`, puis charge `src/main.js`. |
| `src/main.js` | Point d'entree front actuel; il charge `app.js` pendant la migration. |
| `app.js` | Orchestrateur client encore principal: rendu, formulaires, graphes, imports/exports, synchro API. |
| `styles.css` | Theme sombre, responsive, composants, graphes, panneaux admin et formulaires. |
| `site-auth.php` | Sessions, CSRF, mots de passe, rate limits, admin general/regional, audit. |
| `api/genealogy.php` | Lecture/ecriture de la genealogie, normalisation, filtrage public, fusion des droits. |
| `api/admin.php` | Connexion admin, deconnexion, changement des mots de passe regionaux. |
| `api/doleances.php` | Creation et moderation des doleances. |
| `api/auth.php` | Statut d'authentification visiteur + jeton CSRF. |
| `api/diagnostic.php` | Diagnostic admin general sur le dossier `data`. |
| `api/helpers.php` | Reponses JSON, lecture JSON limitee, ecriture atomique, nettoyage texte/ID. |
| `api/config.php` | Chemins des fichiers de donnees. |
| `src/` | Nouvelle structure cible pour decouper progressivement le front. |
| `modules/data.js` | Helpers purs de normalisation et generation d'ID. |
| `modules/graph.js` | Geometrie des liens du graphe. |
| `modules/labels.js` | Libelles UI centralises. |
| `modules/announcements.js` | Helpers des annonces d'evenements. |
| `modules/exports.js` | Helpers d'export PDF/texte. |
| `modules/render.js` | Helper HTML minimal. |
| `modules/stats.js` | Tri localise francais. |
| `MAINTENANCE.md` | Notes courtes de maintenance et points de vigilance. |

## Structure front cible

`app.js` reste le point d'entree actuel, mais le nouveau code front doit aller dans `src/` quand c'est possible:

```text
src/
  main.js
  state.js
  api/
    authApi.js
    genealogyApi.js
    adminApi.js
    doleancesApi.js
  features/
    admin/
    graph/
    people/
    stats/
    upcoming/
    doleances/
  ui/
    modal.js
    toast.js
    renderHelpers.js
```

Extractions deja faites:

- `src/api/`: URLs et wrappers HTTP pour auth, admin, genealogie et doleances.
- `src/state.js`: clefs de stockage, creation de l'etat, helpers `localStorage` et index de genealogies.
- `src/ui/modal.js`, `src/ui/toast.js`, `src/ui/renderHelpers.js`: modales, toasts et helpers HTML.
- `src/features/doleances/index.js`: normalisation et rendu des doleances.
- `src/features/admin/index.js`: normalisation de session admin et rendu des outils admin.
- `src/features/*/actions.js`: mutations d'etat par domaine pour admin, graph, people et upcoming.
- `src/features/upcoming/index.js`: normalisation, tri et rendu des annonces a venir.
- `src/features/people/index.js`: normalisation des fiches, index people, evenements de ceremonie, groupes croises, helpers d'affichage, rendu du formulaire, details de fiche et sauvegarde de fiche.
- `src/features/graph/index.js`: dispatcher de rendu du graphe, sous-rendus tree/network/overview/newcomers, helpers DOM de noeuds/generations/legende, parcours par profondeur, aplatissement des groupes et anneaux de graphe.
- `src/features/stats/index.js`: rendu stats, cartes de statistiques, helpers de statistiques, identite des fiches et timeline.

Regle de migration: ne pas reecrire toute l'application d'un coup. Extraire une zone autonome, la brancher depuis `app.js`, verifier, puis passer a la suivante.

## Ordre conseille pour reviser le code

1. Lire `README.md`, puis `MAINTENANCE.md`.
2. Lire `index.php` pour comprendre le premier verrou d'acces.
3. Lire le debut de `index.html` pour comprendre pourquoi l'application redirige vers `index.php` si la session est absente.
4. Lire le haut de `app.js`: imports, constantes, clefs `localStorage`, URL d'API et `state`.
5. Dans `app.js`, chercher `function render()` pour comprendre comment l'UI est reconstruite.
6. Dans `app.js`, chercher `addEventListener` pour suivre les actions utilisateur.
7. Lire `api/genealogy.php`, surtout `genealogy_payload_for_write`, `merge_public_genealogy_additions` et `merge_regional_admin_genealogy_payload`.
8. Lire `site-auth.php` pour les sessions, CSRF, mots de passe et droits admin.
9. Lire les tests dans `tests/` pour voir les invariants qui doivent rester vrais.

Recherche utile:

```powershell
rg "function render|addEventListener|genealogy_payload_for_write|admin_auth_login" .
```

## Flux principal

1. Le visiteur arrive sur `index.php`.
2. `index.php` verifie le mot de passe du site et cree un jeton court en session.
3. `index.php` sert `index.html`.
4. `index.html` appelle `api/auth.php`.
5. `app.js` charge l'etat local, puis tente de charger `api/genealogy.php`.
6. Les modifications sont sauvegardees localement, puis envoyees a `api/genealogy.php` si l'API est disponible.
7. Les admins utilisent `api/admin.php`; les sauvegardes admin ont plus de droits que les sauvegardes publiques.

## Modele de donnees

La sauvegarde principale est un JSON dans `data/genealogy.json` quand l'application a deja enregistre des donnees.

Forme generale:

```json
{
  "roleResetVersion": 1,
  "activeGenealogyId": "faluche-nationale",
  "genealogies": [],
  "upcomingBaptisms": []
}
```

Une genealogie contient principalement:

```json
{
  "id": "faluche-alsacienne",
  "name": "La faluche alsacienne",
  "type": "region",
  "parentId": "",
  "photoData": "",
  "people": [],
  "customRoles": [],
  "cooptageRoleId": "tva"
}
```

Types de genealogie:

- `national`: vue nationale.
- `region`: arbre regional administrable par un admin regional.
- `family`: famille rattachee a une region via `parentId`.

Une personne contient notamment:

```json
{
  "id": "personne-id",
  "name": "Nom",
  "nickname": "Surnom principal",
  "nicknames": ["Surnom principal"],
  "roles": [],
  "ceremonyType": "bapteme",
  "baptismDate": "2026-05-13",
  "baptismCity": "Ville",
  "baptismStatus": "unknown",
  "ceremonyEvents": [],
  "song": "",
  "filiere": "",
  "createdAt": "2026-05-13T00:00:00+00:00",
  "sponsorIds": [],
  "heartSponsorIds": [],
  "crossGroupId": "",
  "crossGroupSize": 0
}
```

## Droits et securite

Points importants a garder en tete:

- `data/*` est ignore par Git parce que ce dossier contient les donnees et secrets locaux.
- `index.html` ne doit pas etre servi directement par Apache; `.htaccess` force l'entree par `index.php`.
- `data/*.json`, `*.ini`, logs et fichiers temporaires ne doivent pas etre exposes.
- Les mots de passe sont traites cote serveur dans `site-auth.php`, jamais dans `app.js`.
- Les requetes d'ecriture passent par un jeton CSRF.
- Les visiteurs publics peuvent ajouter des fiches et modifier seulement les fiches creees pendant leur session.
- Un admin regional ne peut se connecter que si l'admin general lui a defini un mot de passe.
- Un admin regional ne doit pouvoir modifier que sa region et ses familles.
- Un admin general peut administrer toutes les regions et lire les doleances.
- Les images en base64 sont limitees et normalisees cote client et cote serveur.

Pour publier le code en public, lire aussi `OPEN_SOURCE.md` et `SECURITY.md`.

## Ou modifier selon le besoin

Ajouter un champ a une fiche:

1. Ajouter le champ dans le formulaire de `index.html`.
2. Ajouter l'element correspondant dans l'objet `els` de `app.js`.
3. Lire, valider et sauvegarder le champ dans les fonctions de formulaire de `app.js`.
4. Normaliser le champ cote client si besoin dans `modules/data.js` ou `app.js`.
5. Normaliser le champ cote serveur dans `api/genealogy.php`.
6. Afficher le champ dans `renderDetails`, `nodeInfoHtml` ou la vue concernee.
7. Ajouter ou ajuster un test si le champ touche la normalisation ou les droits.

Ajouter une action API:

1. Choisir l'API concernee dans `api/`.
2. Verifier `require_site_auth`, `require_general_admin_auth` ou `require_csrf_token`.
3. Lire le corps avec `api_read_json_body`.
4. Nettoyer les entrees avec `api_safe_id` et `api_safe_text`.
5. Ecrire avec `api_atomic_json_write` si un fichier de donnees est modifie.
6. Appeler l'API depuis `app.js` via `csrfFetch` si l'action modifie des donnees.

Modifier une vue:

1. Chercher le bouton ou le conteneur dans `index.html`.
2. Chercher son `id` dans `app.js`.
3. Lire la fonction `render...` associee.
4. Modifier le HTML genere dans `app.js`.
5. Modifier le style dans `styles.css`.
6. Verifier le responsive, surtout mobile et graphes scrollables.

## Points de vigilance

- `app.js` est encore gros: eviter d'y ajouter une nouvelle logique pure si elle peut aller dans `modules/`.
- La vue nationale agrege des donnees; ne pas la traiter comme une region normale.
- Les statistiques ne filtrent pas toutes les vues de la meme maniere.
- Les sauvegardes serveur fusionnent les donnees selon le niveau de droit; ne pas remplacer brutalement le fichier complet pour un visiteur public ou un admin regional.
- Proteger le formulaire en cours d'edition contre les rafraichissements distants.
- Apres une modification visible, mettre a jour le parametre `?v=...` de `styles.css` ou `src/main.js` dans `index.html`.

## Checklist avant publication

- L'application demarre avec `php -S 127.0.0.1:8765 -t .`.
- `node --check app.js` passe.
- `node tests/data-normalisation.test.mjs` passe.
- `node tests/features.test.mjs` passe.
- `php tests/genealogy-server.test.php` passe si PHP est disponible.
- Les fichiers du dossier `data` ne sont pas servis directement.
- Les modifications d'ecriture API exigent bien un CSRF.
- Les changements visuels sont verifies sur desktop et mobile.
