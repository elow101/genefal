# Déploiement sur ProFreeHost

## 1. Générer les mots de passe chiffrés

Depuis la racine du projet :

```powershell
php scripts/hash-password.php "mot-de-passe-site"
php scripts/hash-password.php "mot-de-passe-admin"
```

Copier les deux valeurs générées, qui commencent par `$2y$`.

## 2. Préparer `data/auth.json`

1. Ouvrir `data/auth.profreehost.template.json`.
2. Remplacer :
   - `COLLE_ICI_LE_HASH_DU_MOT_DE_PASSE_SITE`
   - `COLLE_ICI_LE_HASH_DU_MOT_DE_PASSE_ADMIN`
3. Enregistrer une copie sous le nom :

```text
data/auth.json
```

## 3. Construire le frontend avant upload

```powershell
npm run frontend:build
```

## 4. Envoyer sur ProFreeHost

Uploader à la racine du site :

- `api/`
- `frontend/dist/`
- `scripts/`
- `data/.htaccess`
- `data/auth.json`
- `.htaccess`
- `index.php`
- `site-auth.php`
- `php.ini`
- `robots.txt`

Ne pas envoyer :

- `.git/`
- `node_modules/`
- `frontend/node_modules/`
- les tests
- les fichiers de travail locaux

## 5. Vérifications juste après upload

1. Ouvrir le site : la page de mot de passe doit apparaître.
2. Entrer le mot de passe visiteur : l’interface Vue doit se charger.
3. Vérifier que les onglets `Personnes`, `Événements`, `Statistiques`, `Graphe`, `Exports`, `Doléances`, `Admin` apparaissent.
4. Se connecter en admin général.
5. Ajouter une fiche de test, sauvegarder, recharger la page et vérifier qu’elle existe encore.
6. Vérifier que l’URL directe vers `data/auth.json` est interdite.

## 6. Vérification sécurité minimale

- `data/auth.json` ne doit jamais être publié sur GitHub.
- `data/.htaccess` doit rester présent.
- Les vrais mots de passe doivent être uniques et longs.
- Si un hash réel a été exposé publiquement, changer immédiatement le mot de passe correspondant.
