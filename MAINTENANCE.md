# Notes de maintenance

Ce projet est une application legere HTML/CSS/JS avec une petite API PHP. Le fichier
principal reste `app.js`; il contient encore la majorite de l'etat, du rendu et des
actions utilisateur. Cette note sert de carte rapide pour eviter de devoir redecouvrir
les memes flux a chaque modification.

## Carte des fichiers

- `index.php` gere l'entree protegee par mot de passe et renvoie vers `index.html`
  avec un jeton de session.
- `index.html` contient la structure statique de l'application. Les versions `?v=...`
  sur `styles.css` et `app.js` doivent etre augmentees apres une modification visible.
- `app.js` gere encore l'etat client et l'orchestration principale.
- `modules/` isole les helpers purs: donnees, rendu, admin, stats, graphes,
  annonces, exports et libelles affiches.
- `styles.css` contient tout le theme sombre et les composants visuels.
- `site-auth.php` centralise les sessions, mots de passe et protections serveur.
- `api/genealogy.php` lit et sauvegarde les donnees genealogiques.
- `api/admin.php` gere la connexion admin et les mots de passe regionaux.
- `api/doleances.php` gere les doleances anonymes.
- `api/auth.php` verifie si la session visiteur est encore valide.
- `data/.htaccess` interdit l'acces direct aux fichiers de donnees.

## Flux de donnees

1. Le visiteur arrive sur `index.php` et doit saisir le mot de passe du site.
2. `index.php` cree un jeton d'acces court et ouvre `index.html`.
3. `index.html` appelle `api/auth.php` avant d'afficher le contenu.
4. `app.js` charge les donnees locales, puis essaye de charger `api/genealogy.php`.
5. Les visiteurs peuvent ajouter des fiches et modifier les fiches creees pendant la
   session courante. Apres rechargement, ces droits temporaires disparaissent.
6. Les admins passent par `api/admin.php`; le serveur limite les tentatives de connexion.
7. Les sauvegardes serveur passent par `api/genealogy.php`, qui fusionne les donnees au
   lieu de remplacer brutalement tout le fichier.

## Points de vigilance

- Ne pas exposer les fichiers du dossier `data`.
- Garder les mots de passe cote serveur, jamais dans `app.js`.
- Ne pas remettre de mot de passe ou hash de secours dans le code source; utiliser
  `FALUCHE_SITE_PASSWORD_HASH`, `FALUCHE_GENERAL_ADMIN_PASSWORD_HASH` ou `data/auth.json`.
- Les acces admin regionaux doivent etre crees explicitement par l'admin general.
- Conserver la protection du formulaire pendant les synchros automatiques; sinon une
  sauvegarde distante peut ecraser une fiche en cours d'edition.
- Sur mobile, le graph doit rester une fenetre scrollable bornee; eviter de remettre
  `overscroll-behavior: contain` ou un drag tactile global qui bloque la sortie du graph.
- Les vues nationale, regionale et famille ne filtrent pas les memes statistiques.
- Les roles definissables viennent des regions, puis sont dedoublonnes au national.
- Les annonces d'evenements sont filtrees par region et restent visibles jusqu'au
  lendemain de la date annoncee.

## Controle rapide

- `node --check app.js` verifie la syntaxe JavaScript.
- `node tests/data-normalisation.test.mjs` verifie les helpers de normalisation client.
- `php tests/genealogy-server.test.php` verifie la normalisation et la fusion serveur
  quand PHP est disponible.
- Garder les accolades CSS equilibrees apres les gros blocs responsive.
- Si le serveur PHP local est disponible, lancer un lint sur les fichiers `api/*.php`
  et `site-auth.php` avant de publier.

## Dette technique prioritaire

- Ajouter un format de schema versionne pour les donnees sauvegardees.
- Continuer a deplacer progressivement les gros blocs de rendu depuis `app.js` vers
  les modules existants.
