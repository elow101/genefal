# Security Policy

## Donnees et secrets

Ne publie jamais les fichiers generes dans `data/`.

Ces fichiers peuvent contenir:

- des hashes de mots de passe;
- des donnees genealogiques personnelles;
- des doleances;
- des journaux d'audit admin;
- des traces de limitation de connexion.

Le depot ignore `data/*` par defaut et ne conserve que `data/.htaccess` et `data/.gitkeep`.

## Configuration des mots de passe

Pour un deploiement neuf, genere des hashes PHP:

```powershell
php scripts/hash-password.php "mot-de-passe-site"
php scripts/hash-password.php "mot-de-passe-admin-general"
```

Puis configure ces variables d'environnement sur le serveur:

```text
FALUCHE_SITE_PASSWORD_HASH=...
FALUCHE_GENERAL_ADMIN_PASSWORD_HASH=...
```

Au premier login reussi, l'application enregistre un hash local dans `data/auth.json`.
Ce fichier reste prive et ne doit pas etre pousse sur GitHub.

## Signalement

Si une faille est trouvee, ouvre une issue GitHub sans publier de secret ni de donnees personnelles.
Pour une faille exploitable sur une instance en production, contacte le mainteneur en prive avant de publier les details.
