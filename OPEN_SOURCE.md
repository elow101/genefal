# Publier ce projet sur GitHub

Ce guide prépare une publication publique sans exposer les données privées de l’instance.

## Ce qui est déjà sécurisé

- `data/*` est ignoré par Git, sauf `data/.htaccess` et `data/.gitkeep`.
- Les hashes et mots de passe de repli ne sont pas stockés dans le code.
- Les mots de passe initiaux viennent des variables d’environnement ou de `data/auth.json`.
- Le frontend principal est buildé dans `frontend/dist/`.

## Vérification avant publication

```powershell
npm test
npm run frontend:build
npm run frontend:lint
php tests/genealogy-server.test.php
php -l index.php
php -l site-auth.php
php -l api/admin.php
php -l api/genealogy.php
php -l api/doleances.php
php -l api/auth.php
php -l api/diagnostic.php
php -l api/helpers.php
php -l scripts/hash-password.php
```

Vérifier aussi :

```powershell
rg -n "password|secret|token|api[_-]?key|BEGIN " .
```

Les résultats doivent correspondre à du code d’authentification normal, pas à des secrets réels.

## Publier

```powershell
git init
git branch -M main
git add .
git status
git commit -m "Initial open source release"
git remote add origin https://github.com/ton-compte/faluche-nationale.git
git push -u origin main
```

Si `git status` montre `data/auth.json`, `data/genealogy.json` ou `data/doleances.json`, arrêter immédiatement : ces fichiers ne doivent pas être publiés.

## Configurer une instance

```powershell
php scripts/hash-password.php "mot-de-passe-site"
php scripts/hash-password.php "mot-de-passe-admin-general"
```

Puis configurer :

```text
FALUCHE_SITE_PASSWORD_HASH=...
FALUCHE_GENERAL_ADMIN_PASSWORD_HASH=...
```

## Si un secret a déjà été poussé

1. Le changer immédiatement.
2. Le retirer du code.
3. Nettoyer l’historique Git avec un outil dédié.
4. Forcer le push seulement si l’impact est maîtrisé.
