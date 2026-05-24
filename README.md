# GeneFaluche

Application web de genealogie de faluche. Le projet combine un frontend Vue 3/Vite et une API PHP compatible hebergement mutualise, avec authentification visiteur, administration, doleances, exports PDF, statistiques, evenements a venir et notifications mail.

## Fonctionnalites

- Connexion visiteur protegee par mot de passe.
- Visualisation des genealogies en arbre et en reseau.
- Vue d'ensemble, statistiques, nouveaux venus integres aux statistiques, et evenements a venir.
- Recherche de faluchards par nom, surnom ou paillarde.
- Creation et edition de fiches, parrains, marraines, fillots, roles et ceremonies.
- Administration generale et regionale avec droits limites cote PHP.
- Doleances publiques avec limite de session et resolution admin.
- Evenements a venir: creation libre, abonnements region par mail, demandes de participation, gestion createur par mot de passe temporaire.
- Notifications mail via PHPMailer + SMTP Gmail.
- Export PDF centre sur une personne.
- Interface mobile-first en cours de stabilisation.

## Structure

```text
api/                       endpoints PHP
data/                      donnees locales ignorees par Git
frontend/src/api/          appels HTTP
frontend/src/components/   composants UI partages
frontend/src/composables/  etat Vue et orchestration
frontend/src/domain/       regles metier pures, migrations, graphes, stats
frontend/src/features/     ecrans et blocs fonctionnels
frontend/src/assets/       styles globaux
vendor/                    dependances Composer, dont PHPMailer
scripts/                   outils de maintenance
tests/                     tests PHP
site-auth.php              auth, sessions, CSRF, rate limits, audit
```

Regle de maintenance: les composants Vue affichent, les composables coordonnent, `domain/` porte les regles metier, et l'API PHP valide les droits.

## Installation Locale

Prerequis:

- PHP disponible en ligne de commande.
- Composer pour installer PHPMailer.
- Node compatible avec `frontend/package.json`.
- Dependencies installees avec `npm install` a la racine et dans `frontend/` si necessaire.

Installer les dependances PHP:

```powershell
composer install
```

Lancer le backend PHP:

```powershell
npm.cmd run backend:dev
```

Lancer le frontend Vite dans un second terminal:

```powershell
npm.cmd run frontend:dev
```

Ouvrir d'abord la connexion PHP:

```text
http://127.0.0.1:8765/
```

Puis ouvrir le frontend:

```text
http://127.0.0.1:5173/
```

Utilise `127.0.0.1` plutot que `localhost` pour garder les cookies de session coherents entre PHP et Vite.

## Commandes Utiles

```powershell
npm.cmd test
npm.cmd run frontend:test
npm.cmd run frontend:lint
npm.cmd run frontend:build
php tests/genealogy-server.test.php
```

Verification PHP optionnelle:

```powershell
Get-ChildItem -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName }
```

Verifier la configuration SMTP:

```powershell
php -l api/mail.php
```

Puis tester depuis le site avec un abonnement ou une creation d'evenement. Le fichier `.env` doit rester sur le serveur et ne doit jamais etre commite. Variables attendues:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=genefaluche@gmail.com
MAIL_FROM=genefaluche@gmail.com
SMTP_PASSWORD=<mot-de-passe-application-gmail>
```

## Donnees Et Secrets

Ne jamais publier les fichiers generes dans `data/`.

Ces fichiers peuvent contenir:

- hashes de mots de passe;
- donnees genealogiques personnelles;
- abonnements email aux evenements par region;
- emails de demandes de participation et hashes de mots de passe createur d'evenement;
- doleances;
- journaux d'audit;
- traces de limitation de connexion.

Le depot ignore `data/*` et ne garde que `data/.htaccess` et `data/.gitkeep`.

Pour generer les hashes de mots de passe:

```powershell
php scripts/hash-password.php "mot-de-passe-visiteur"
php scripts/hash-password.php "mot-de-passe-admin-general"
```

Configurer ensuite les variables d'environnement serveur si possible:

```text
FALUCHE_SITE_PASSWORD_HASH=...
FALUCHE_GENERAL_ADMIN_PASSWORD_HASH=...
```

Sur hebergement mutualise, les hashes peuvent aussi etre places dans `data/auth.json`.

## Configuration Mail

Le projet utilise PHPMailer via Composer et SMTP Gmail.

Fichier `.env` attendu a la racine du site:

```env
MAIL_FROM=genefaluche@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=genefaluche@gmail.com
SMTP_PASSWORD=<mot-de-passe-application-gmail>
```

Important:

- `SMTP_PASSWORD` doit etre un mot de passe d'application Gmail, pas le mot de passe principal du compte.
- `.env` doit etre present sur le serveur, mais ne doit jamais etre commit.
- `.env.example` documente les noms de variables et ne doit contenir aucun vrai secret.
- `api/mail.php` charge `vendor/autoload.php`, PHPMailer, STARTTLS, UTF-8 et journalise les erreurs via `error_log`.

Emplacement attendu sur serveur:

```text
htdocs/.env
htdocs/api/mail.php
htdocs/vendor/autoload.php
```

## Evenements Et Mails

Types d'evenements autorises:

- Baptême (`bapteme`)
- Adoption (`adoption`)
- Confirmation (`confirmation`)
- Cooptage (`cooptage`)
- Autre (`autre`)

Les demandes de participation sont disponibles uniquement pour Baptême, Adoption et Confirmation.

Creation d'evenement:

- un mot de passe createur temporaire est genere;
- le mot de passe est affiche une seule fois dans l'interface;
- seul son hash est stocke dans `data/upcoming-secrets.json`;
- si un email createur est fourni, le mot de passe est aussi envoye par mail.

Abonnement region:

- l'utilisateur renseigne son email pour suivre une region;
- l'email est stocke cote serveur dans `data/upcoming-subscriptions.json`;
- a la creation d'un nouvel evenement dans cette region, un mail detaille est envoye aux abonnes.

Mail nouvel evenement:

- titre;
- type;
- region;
- date;
- heure;
- lieu si disponible;
- createur si disponible;
- description si disponible;
- lien vers la page evenements avec `?view=upcoming&eventId=...#event-...`.

Gestion createur:

- ouverture avec identifiant evenement + mot de passe temporaire;
- acceptation/refus des demandes;
- liste separee des demandes en attente, participants acceptes et demandes refusees;
- suppression de l'evenement avec confirmation;
- suppression des secrets lies a l'evenement supprime.

Fichiers de donnees evenements:

- `data/genealogy.json`: evenements publics et demandes sans email;
- `data/upcoming-subscriptions.json`: emails abonnes par region;
- `data/upcoming-secrets.json`: hashes de mots de passe createur et emails prives des demandes.

Ces fichiers doivent rester proteges par `data/.htaccess`.

## Deploiement

Avant publication:

```powershell
npm.cmd test
npm.cmd run frontend:lint
npm.cmd run frontend:build
composer install --no-dev --optimize-autoloader
```

Si l'hebergement supporte Composer:

- envoyer `composer.json` et `composer.lock`;
- executer `composer install --no-dev --optimize-autoloader` sur le serveur.

Si l'hebergement ne permet pas Composer:

- envoyer le dossier `vendor/`;
- envoyer aussi `composer.json` et `composer.lock`.

Fichiers a envoyer a la racine du site:

```text
api/
composer.json
composer.lock
vendor/        # si Composer n'est pas execute sur le serveur
frontend/dist/
scripts/
data/.htaccess
data/auth.json
data/genealogy.json        seulement si tu veux transferer les donnees locales
.htaccess
index.php
site-auth.php
php.ini
robots.txt
privacy.html
```

Ne pas envoyer dans Git:

```text
.env
.git/
node_modules/
frontend/node_modules/
frontend/src/
tests/
*.test.js
```

Le fichier `.env` doit etre uploade sur le serveur pour SMTP, mais il ne doit jamais etre ajoute a Git ni partage publiquement.

Avant de remplacer une production existante:

1. Telecharger le dossier `data/` actuel.
2. Garder une sauvegarde datee.
3. Verifier que `auth.json` et `genealogy.json` sont presents.
4. Uploader le nouveau code.
5. Ne pas ecraser `data/genealogy.json` sans sauvegarde.

Apres upload, verifier que `/data/auth.json`, `/data/upcoming-secrets.json` et `/data/upcoming-subscriptions.json` sont interdits. Si un fichier devient accessible publiquement, remettre immediatement `data/.htaccess` et changer les secrets concernes.

## Contrats A Preserver

- Onglets: Arbre, Reseau, Vue d'ensemble, Statistiques, Event a venir.
- Sur mobile, les vues passent par un menu deroulant lisible.
- Les fiches restent fermees par sections sauf Identite a l'ouverture.
- Hors admin, une ancienne fiche refusee par le serveur affiche une invitation a envoyer une doleance.
- `schemaVersion` reste le contrat de persistance.
- Toute migration doit etre faite dans `frontend/src/domain/schema.js` et `api/genealogy.php`.
- Le national agrege les regions et familles sans dedupliquer de travers les statistiques.
- La priorite de source reste famille, puis region, puis national.
- Les roles regionaux restent administrables par region.
- `TVA` reste la valeur de cooptage par defaut.
- Les droits ne doivent jamais dependre uniquement du masquage UI.
- Les permissions createur d'evenement doivent toujours etre verifiees cote PHP avec le mot de passe temporaire.
- Les emails des participants ne doivent jamais etre exposes dans le frontend ni dans les reponses publiques.

## Checklist Avant Publication

1. Connexion visiteur.
2. Arbre lisible a 100%.
3. Reseau centre sur la fiche selectionnee.
4. Couleurs de filieres visibles.
5. Recherche personne fonctionnelle.
6. Creation d'une fiche publique.
7. Modification de la fiche creee dans la meme session.
8. Refus propre de modification d'une fiche ancienne hors admin.
9. Connexion et deconnexion admin general.
10. Connexion et deconnexion admin regional.
11. Deplacement de fiche dans le bon perimetre admin.
12. Ajout et suppression admin d'une adoption ou confirmation.
13. Envoi et resolution d'une doleance.
14. Creation region ou famille.
15. Creation d'un role regional et usage en cooptage.
16. Statistiques dedupliquees et roles cliquables.
17. Creation d'un evenement Baptême.
18. Creation d'un evenement Adoption.
19. Creation d'un evenement Confirmation.
20. Creation d'un evenement Cooptage.
21. Creation d'un evenement Autre.
22. Mail createur recu avec mot de passe temporaire.
23. Abonnement region et reception du mail nouvel evenement.
24. Mail nouvel evenement avec titre, type, region, date, lieu, description, createur et lien.
25. Demande de participation avec email obligatoire.
26. Double demande avec le meme email refusee.
27. Gestion createur avec bon mot de passe.
28. Gestion createur refusee avec mauvais mot de passe.
29. Acceptation/refus et reception du mail de statut.
30. Liste des participants acceptes visible au createur sans emails.
31. Suppression createur d'un evenement et nettoyage de `upcoming-secrets.json`.
32. Export PDF centre sur une personne.
33. Rechargement page avec donnees persistees.
34. Mobile: header, recherche, menu d'arbre, menu de vues, zoom, retour haut.
35. Lien RGPD visible.
36. Acces direct a `data/auth.json` interdit.
37. Acces direct a `data/upcoming-secrets.json` interdit.

## Si Un Probleme Arrive

- Page blanche: verifier que `frontend/dist/` existe apres `npm.cmd run frontend:build`.
- Mot de passe refuse: regenerer le hash avec `scripts/hash-password.php`.
- Mot de passe regional perdu: le reinitialiser depuis l'admin general.
- Donnees non persistantes: verifier les permissions du dossier `data/`.
- Donnees visibles publiquement: remettre `data/.htaccess` et changer les mots de passe.
- Accents casses: verifier que les fichiers sont en UTF-8 et eviter les editeurs qui forcent un mauvais encodage.
- SMTP non lu: verifier que `.env` est a la racine du site, que `api/mail.php` passe `php -l`, puis consulter les logs PHP.
- Erreur mail 500: verifier `vendor/autoload.php`, `api/mail.php`, le mot de passe d'application Gmail et les logs PHP.
