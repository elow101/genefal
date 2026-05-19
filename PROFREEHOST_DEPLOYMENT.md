# D?ploiement sur ProFreeHost

Proc?dure de publication pour l?h?bergement ProFreeHost.

## 1. Pr?parer les mots de passe

Depuis la racine du projet :

```powershell
php scripts/hash-password.php "mot-de-passe-visiteur"
php scripts/hash-password.php "mot-de-passe-admin-general"
```

Les valeurs g?n?r?es commencent par `$2y$`.

Dans `data/auth.json`, renseigner :

```json
{
  "sitePasswordHash": "COLLE_ICI_LE_HASH_VISITEUR",
  "generalAdminPasswordHash": "COLLE_ICI_LE_HASH_ADMIN_GENERAL"
}
```

Le mot de passe visiteur est celui demand? ? l?arriv?e sur le site. Le hash n?est pas le mot de passe : c?est sa version non r?versible.

Les mots de passe r?gionaux ne se r?cup?rent pas : ils se r?initialisent depuis l?administration g?n?rale.

## 2. Construire le frontend

Toujours g?n?rer le build avant upload :

```powershell
npm run frontend:build
```

Le dossier ? envoyer est `frontend/dist/`.

## 3. Contr?ler avant upload

```powershell
npm test
npm run frontend:lint
npm run frontend:build
```

Optionnel :

```powershell
Get-ChildItem -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName }
```

## 4. Fichiers ? envoyer

Envoyer ? la racine du site ProFreeHost :

```text
api/
frontend/dist/
scripts/
data/.htaccess
data/auth.json
data/genealogy.json        si tu veux transf?rer les donn?es locales existantes
.htaccess
.override                  si ProFreeHost le demande / l?a cr??
index.php
site-auth.php
php.ini
robots.txt
privacy.html
```

Si `data/genealogy.json` existe d?j? en production et contient les vraies donn?es, ne l??crase pas sans sauvegarde.

## 5. Fichiers ? ne pas envoyer

```text
.git/
node_modules/
frontend/node_modules/
frontend/src/
frontend/vite.config.js
tests/
*.test.js
README.md
MAINTENANCE.md
PROFREEHOST_DEPLOYMENT.md
```

Ces fichiers ne sont pas n?cessaires ? l?ex?cution du site en production.

## 6. Sauvegarde avant remplacement

Avant de remplacer une version existante :

1. T?l?charger le dossier `data/` actuel depuis FileZilla.
2. Conserver une copie dat?e localement.
3. V?rifier que `auth.json` et `genealogy.json` sont pr?sents dans la sauvegarde.
4. Uploader ensuite les nouveaux fichiers applicatifs.

Important : les donn?es existantes ne doivent pas ?tre recommenc?es ? z?ro. Le nouveau code migre les anciennes structures, mais il faut pr?server `data/genealogy.json`.

## 7. Normaliser les anciennes fili?res

Avant d?importer une ancienne g?n?alogie, v?rifier les fili?res historiques.

Les anciennes valeurs connues sont prises en charge par le code, mais il est pr?f?rable de normaliser le JSON avant mise en production :

```text
carab                       -> medecine
pharma                      -> pharmacie-preparateur-pharmacie
dentaire                    -> chirurgie-dentaire
paramedical-kinesitherapie  -> paramedical
sciences-*                  -> sciences
economie-comptabilite       -> sciences-economiques-gestion-iae
enseignement-2nd-degre      -> meef-2nd-degre
lettres / lea / psychologie -> lettres-langues-sciences-humaines-sociales
```

Toujours garder une copie du fichier original avant normalisation.

## 8. Permissions et `.htaccess`

ProFreeHost peut refuser l??criture de certains `.htaccess` selon l?emplacement ou les permissions.

? v?rifier :

- `data/.htaccess` doit ?tre pr?sent pour bloquer l?acc?s web aux donn?es.
- Si l?upload du `.htaccess` racine ?choue, garder au minimum `data/.htaccess`.
- Tester ensuite l?acc?s direct ? `data/auth.json` : il doit ?tre interdit.

## 9. V?rifications apr?s upload

1. Ouvrir le site.
2. V?rifier que la page de mot de passe visiteur appara?t.
3. Entrer le mot de passe visiteur.
4. V?rifier que Vue se charge correctement.
5. Ouvrir Arbre : cartes lisibles ? 100%.
6. Ouvrir R?seau : vue centr?e sur la fiche s?lectionn?e.
7. V?rifier les couleurs de fili?res.
8. Survoler une fiche r?seau : d?tails et pastilles de r?les visibles.
9. Tester le format t?l?phone : header, options, menu d?arbre, menu d?onglets, zoom, retour haut.
10. Cr?er une fiche de test.
11. Recharger la page : la fiche doit persister.
12. Tester le refus de modification d?une ancienne fiche hors admin.
13. Envoyer une dol?ance.
14. Se connecter en admin g?n?ral.
15. R?soudre une dol?ance.
16. D?placer une fiche entre deux arbres autoris?s.
17. Ajouter puis supprimer une adoption / confirmation.
18. Cr?er un ?v?nement.
19. G?n?rer un export PDF.
20. Tester le lien RGPD en bas de page.
21. Ouvrir directement `/data/auth.json` : acc?s interdit.

## 10. Mise ? jour des donn?es existantes

Pour transf?rer l?ancien site vers le nouveau :

1. Sauvegarder l?ancien `data/genealogy.json`.
2. Normaliser les anciennes fili?res si n?cessaire.
3. Placer ce fichier dans le nouveau dossier `data/`.
4. D?ployer le nouveau code.
5. Ouvrir le site.
6. La migration se fait automatiquement au chargement / sauvegarde.
7. V?rifier le nombre de fiches, r?gions, familles, liens et statistiques avant toute ?dition massive.

Ne supprime pas l?ancien fichier tant que le nouveau site n?a pas ?t? v?rifi?.

## 11. En cas de probl?me

- Si le site affiche une page blanche : v?rifier que `frontend/dist/` a bien ?t? upload? apr?s `npm run frontend:build`.
- Si le mot de passe ne fonctionne pas : r?g?n?rer le hash avec `scripts/hash-password.php`, puis remplacer le hash dans `data/auth.json`.
- Si un mot de passe r?gional est perdu : le r?initialiser depuis l?admin g?n?ral.
- Si les donn?es ne persistent pas : v?rifier les permissions du dossier `data/`.
- Si les donn?es sont visibles publiquement : remettre imm?diatement `data/.htaccess` et changer les mots de passe.
- Si les accents sont cass?s : v?rifier que les fichiers ont ?t? upload?s en UTF-8 et ne pas ?diter les JSON avec un ?diteur qui force un mauvais encodage.
