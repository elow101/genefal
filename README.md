# Faluche Nationale / GeneFaluche

Application web l?g?re pour consulter, ?diter et visualiser des g?n?alogies de faluche.

Le frontend principal est maintenant en **Vue 3 / Vite**. Le backend reste en **PHP**, compatible avec un h?bergement mutualis? de type ProFreeHost.

## Fonctionnalit?s principales

- Authentification visiteur par mot de passe hash?.
- Administration g?n?rale et r?gionale.
- Gestion hi?rarchique des arbres : national ? r?gions ? familles.
- D?placement d?un faluchard d?un arbre ? un autre en mode admin, avec p?rim?tre r?gional pour les admins r?gionaux.
- Fiches faluchards avec identit?, bapt?me, famille, r?les et statuts.
- Relations : parrains / marraines, parrains / marraines de c?ur, fillots, adoptions, confirmations et bapt?mes crois?s.
- Suppression des adoptions / confirmations par les admins autoris?s.
- Onglets : Arbre, R?seau, Vue d?ensemble, Nouveaux venus, Statistiques, Event ? venir.
- Graphe r?seau centr? sur la fiche s?lectionn?e, avec cartes lisibles, couleurs de fili?res, l?gendes et zoom.
- Visualisation mobile d?di?e : header compact, options adapt?es, menu d?roulant d?onglet, bouton de retour haut, contr?les de zoom fix?s au viewport.
- Palette stricte de fili?res, avec alias de compatibilit? pour les anciennes donn?es.
- Normalisation possible des anciennes fili?res, notamment les sous-cat?gories `sciences-*` vers `sciences`.
- R?les r?gionaux sous forme de pastilles, visibles dans les fiches de survol et filtrables dans les statistiques.
- Statistiques d?dupliqu?es entre national, r?gions et familles.
- Dol?ances publiques limit?es par session, mod?ration admin et purge des dol?ances r?solues.
- ?v?nements ? venir : bapt?me, adoption, confirmation, cooptage et demandes de venue.
- Export PDF simplifi? centr? sur une personne, avec profondeur ascendance / descendance configurable.
- Politique de confidentialit? / RGPD accessible depuis le footer.

## Architecture

```text
frontend/src/
  api/          appels HTTP
  composables/  orchestration Vue et ?tat applicatif
  domain/       r?gles m?tier pures et testables
  features/     composants par domaine visible
  assets/       styles globaux

api/
  auth.php       ?tat d?authentification visiteur
  admin.php      sessions admin et mots de passe r?gionaux
  genealogy.php  lecture / ?criture / migration des donn?es
  doleances.php  dol?ances publiques et admin

site-auth.php    sessions, CSRF, mots de passe, rate limits, audit
index.php        entr?e prot?g?e et chargement du build Vue
privacy.html     politique de confidentialit? / RGPD
```

L?ancien `app.js` n?est plus la source de v?rit?. Toute ?volution frontend doit passer par `frontend/src/`.

## D?marrage local

### Pr?requis

- PHP disponible en ligne de commande.
- Node.js compatible Vite.
- D?pendances install?es dans `frontend/`.

### Installer / v?rifier les d?pendances

```powershell
npm --prefix frontend install
```

### G?n?rer les hashes de mots de passe

```powershell
php scripts/hash-password.php "mot-de-passe-visiteur"
php scripts/hash-password.php "mot-de-passe-admin-general"
```

Reporter les hashes dans `data/auth.json` ou dans le template ProFreeHost avant d?ploiement.

### Lancer comme en production locale

```powershell
npm run frontend:build
npm run backend:dev
```

Puis ouvrir :

```text
http://127.0.0.1:8765/
```

### Lancer en mode d?veloppement

Terminal 1 :

```powershell
npm run backend:dev
```

Terminal 2 :

```powershell
npm run frontend:dev
```

Se connecter d?abord sur `http://127.0.0.1:8765/`, puis utiliser le frontend Vite.

## Sch?ma de donn?es

Le fichier principal est `data/genealogy.json`.

Structure simplifi?e :

```json
{
  "schemaVersion": 1,
  "roleResetVersion": 1,
  "activeGenealogyId": "faluche-nationale",
  "genealogies": [],
  "upcomingBaptisms": []
}
```

Chaque g?n?alogie contient notamment :

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

Les anciennes donn?es sont migr?es automatiquement c?t? frontend et c?t? PHP. Les personnes visibles depuis l?arbre national sont d?dupliqu?es avec priorit? aux sources les plus pr?cises : famille, puis r?gion, puis national.

## R?gles m?tier importantes

- Une r?gion a toujours pour parent `Faluche Nationale`.
- Une famille a toujours pour parent une r?gion.
- Une fiche existante hors session publique n?est modifiable qu?en admin ; sinon l?utilisateur doit envoyer une dol?ance.
- L?ajout de fillots reste possible depuis une fiche, y compris si la fiche pr?date la session.
- Un admin r?gional g?re uniquement sa r?gion, ses familles, ses photos, ses r?les, ses mots de passe r?gionaux et les d?placements de fiches dans ce p?rim?tre.
- L?admin g?n?ral g?re l?ensemble du site.
- `TVA` est le r?le de cooptage par d?faut, mais chaque r?gion peut choisir un r?le local.
- Les fili?res autoris?es sont centralis?es dans `frontend/src/domain/filiere.js` et normalis?es aussi dans `api/genealogy.php`.

## Commandes de contr?le

```powershell
npm test
npm run frontend:lint
npm run frontend:build
php tests/genealogy-server.test.php
```

Pour v?rifier la syntaxe PHP :

```powershell
Get-ChildItem -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName }
```

## D?ploiement

Voir `PROFREEHOST_DEPLOYMENT.md`.

Avant mise en ligne, ex?cuter au minimum :

```powershell
npm test
npm run frontend:lint
npm run frontend:build
```

Puis v?rifier manuellement : connexion visiteur, arbre, r?seau, cr?ation fiche, modification autoris?e, d?placement admin, dol?ance, admin, ?v?nement, export PDF, mobile et protection de `data/`.

## Contribution open source

- Ne jamais commiter `data/auth.json` avec de vrais hashes.
- Ne jamais commiter de vraies donn?es priv?es sans consentement.
- Toute r?gle m?tier r?utilisable va dans `frontend/src/domain/`.
- Toute r?gle valid?e c?t? client et c?t? serveur doit ?tre maintenue des deux c?t?s.
- Toute modification d?interface importante doit ?tre test?e sur desktop et mobile, dans Arbre et R?seau.
