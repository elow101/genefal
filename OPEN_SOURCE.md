# Publier ce projet sur GitHub

Ce guide prepare une publication publique sans exposer les donnees privees de l'instance.

## Ce qui a ete securise dans le depot

- `data/*` est ignore par Git, sauf `data/.htaccess` et `data/.gitkeep`.
- Les hashes et mots de passe de repli ont ete retires du code source.
- Les mots de passe regionaux par defaut sont desactives.
- Les mots de passe initiaux doivent venir de variables d'environnement ou de `data/auth.json`.
- Un script local permet de generer des hashes PHP sans stocker les mots de passe dans le depot.

## Verification avant publication

Lancer:

```powershell
node --check app.js
node tests/data-normalisation.test.mjs
php tests/genealogy-server.test.php
php -l site-auth.php
php -l api/admin.php
php -l api/genealogy.php
php -l api/doleances.php
php -l api/auth.php
php -l api/diagnostic.php
php -l api/helpers.php
php -l scripts/hash-password.php
```

Verifier aussi:

```powershell
rg -n "password|secret|token|api[_-]?key|BEGIN " .
```

Les resultats doivent correspondre a du code d'authentification normal, pas a des secrets reels.

## Creer le depot GitHub

Depuis GitHub:

1. Creer un nouveau repository.
2. Choisir `Public`.
3. Ne pas ajouter de README, `.gitignore` ou licence depuis GitHub si ces fichiers existent deja localement.
4. Copier l'URL du depot, par exemple `https://github.com/ton-compte/faluche-nationale.git`.

Depuis le dossier du projet:

```powershell
git init
git branch -M main
git add .
git status
git commit -m "Initial open source release"
git remote add origin https://github.com/ton-compte/faluche-nationale.git
git push -u origin main
```

Important: si `git status` montre `data/auth.json`, `data/genealogy.json` ou `data/doleances.json`, arrete-toi. Ces fichiers ne doivent pas etre publies.

## Configurer une instance de production

Generer les hashes:

```powershell
php scripts/hash-password.php "mot-de-passe-site"
php scripts/hash-password.php "mot-de-passe-admin-general"
```

Configurer ensuite sur le serveur:

```text
FALUCHE_SITE_PASSWORD_HASH=hash_genere_pour_le_site
FALUCHE_GENERAL_ADMIN_PASSWORD_HASH=hash_genere_pour_l_admin
```

Le premier login reussi cree ou complete `data/auth.json`. Les mots de passe regionaux doivent ensuite etre crees par l'admin general depuis l'interface.

## Si un secret a deja ete pousse

1. Changer immediatement le mot de passe concerne.
2. Supprimer le secret du code.
3. Nettoyer l'historique Git avec un outil dedie comme `git filter-repo` ou BFG.
4. Forcer le push uniquement si tu comprends l'impact sur les clones existants.

Supprimer un secret du dernier commit ne suffit pas si l'ancien commit reste dans l'historique public.
