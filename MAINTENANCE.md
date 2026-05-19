# Maintenance ? Faluche Nationale / GeneFaluche

Ce projet est organis? autour d?un frontend Vue 3 / Vite et d?une API PHP compatible h?bergement mutualis?.

Objectif de maintenance : garder une exp?rience proche de l?ancien site tout en conservant un code d?coup?, testable et d?ployable simplement.

## Structure ? respecter

```text
frontend/src/api/          HTTP et endpoints
frontend/src/composables/  ?tat Vue, orchestration, sauvegardes
frontend/src/domain/       r?gles m?tier pures, migrations, graphes, stats
frontend/src/features/     composants UI par domaine
frontend/src/assets/       styles globaux
api/                       endpoints PHP
site-auth.php              auth, sessions, CSRF, limites, audit
```

Ne pas remettre de logique applicative dans l?ancien `app.js`. Le frontend officiel est Vue.

## Contrats fonctionnels ? pr?server

### Navigation

- Onglets principaux : Arbre, R?seau, Vue d?ensemble, Nouveaux venus, Statistiques, Event ? venir.
- Sur desktop, les onglets restent des boutons horizontaux.
- Sur mobile, les onglets passent par un menu d?roulant uniquement.
- La fiche lat?rale est visible sauf dans Statistiques et Event ? venir.
- Les contr?les de zoom restent fix?s au viewport dans Arbre et R?seau.
- Le bouton retour haut reste fix? en bas ? droite du viewport.
- L?onglet R?seau se centre sur la fiche s?lectionn?e.

### Arbre, r?seau et mobile

- Les parrains / marraines directs doivent ?tre lisibles au m?me niveau.
- Les fl?ches restent fines et diff?rencient les types de lien.
- Les couleurs de fili?re restent visibles sur les cartes.
- Les cartes r?seau affichent seulement nom + surnom ; les d?tails apparaissent au survol.
- La fiche de survol r?seau doit reprendre l?esprit des fiches de l?onglet Arbre.
- Les r?les dans le survol r?seau sont affich?s sous forme de pastilles color?es.
- Les l?gendes doivent couvrir tous les liens : parrainage, c?ur, adoption, adoption de c?ur, confirmation, confirmation de c?ur, bapt?me crois?.
- Le format mobile doit rester lisible : header compact, options en carte, menu d?arbre contenu dans la largeur ?cran, bouton `Fiche d?ajout`, retour haut accessible.
- Sur desktop, la molette verticale au-dessus du graphe doit faire d?filer la page ; le d?placement horizontal du graphe doit rester possible avec trackpad horizontal ou `Shift + molette`.

### Fiches

- ? l?ouverture d?une fiche, seule Identit? est ouverte.
- Bapt?me, Famille, R?les et statuts restent ferm?s par d?faut.
- Les boutons de section ouvrent leur section cible et referment les autres.
- La section Famille contient parrains / marraines, parrains / marraines de c?ur et fillots.
- La section Bapt?me contient les adoptions et confirmations.
- Les admins peuvent supprimer une adoption ou confirmation.
- Les zones de paillarde ne doivent pas ?tre redimensionnables.
- Hors admin, une fiche ancienne n?est pas modifiable directement ; afficher un retour demandant une dol?ance.

### Donn?es et migrations

- `schemaVersion` est la base du contrat de persistance.
- Toute ?volution de sch?ma doit ?tre migr?e dans :
  - `frontend/src/domain/schema.js` ;
  - `api/genealogy.php`.
- Les anciennes donn?es doivent continuer ? ?tre reprises sans repartir de z?ro.
- Le national agr?ge les r?gions / familles sans dupliquer visuellement ou statistiquement les m?mes personnes.
- La priorit? de source reste : famille > r?gion > national.
- Les anciennes fili?res doivent ?tre normalis?es vers la palette actuelle ; toutes les sous-cat?gories `sciences-*` doivent devenir `sciences`.

### Fili?res et r?les

- La palette stricte des fili?res est dans `frontend/src/domain/filiere.js`.
- Les alias d?anciennes fili?res doivent continuer ? produire une couleur visible.
- Toute modification de fili?re doit ?tre r?percut?e dans `api/genealogy.php`.
- Les r?les r?gionaux sont administrables par r?gion.
- `TVA` reste la valeur de cooptage par d?faut.
- Dans Statistiques, les r?les sont cliquables et affichent les faluchards concern?s.

### Administration

- Admin g?n?ral : acc?s complet.
- Admin r?gional : actions limit?es ? sa r?gion et aux familles rattach?es.
- D?placement de fiche : autoris? dans le p?rim?tre admin uniquement.
- La fen?tre admin doit rester au-dessus des menus et panneaux de gestion.
- Ne jamais d?pendre uniquement du masquage UI : les droits doivent ?tre pr?serv?s c?t? PHP.

### Dol?ances

- Pas de formulaire de dol?ance en session admin.
- Limiter le nombre de dol?ances par session publique.
- Les dol?ances r?solues sont marqu?es par bouton.
- La purge des dol?ances r?solues se fait ? la sortie de session admin g?n?rale.

### ?v?nements

- Bapt?me, adoption, confirmation et cooptage doivent rester distingu?s.
- Pour cooptage, les responsables sont filtr?s par r?le r?gional configur?.
- Les faluchards concern?s par un cooptage excluent les personnes ayant ce r?le.
- Les demandes de venue doivent rester lisibles et s?lectionnables ? droite de la carte.

### Export

- L?export utilisateur est un PDF simplifi? centr? sur une personne.
- Les profondeurs d?ascendance et de descendance sont configurables.
- Ne pas r?introduire d?export brut complet accessible ? n?importe quel visiteur.

## S?curit?

- Ne jamais exposer `data/auth.json`.
- Ne jamais versionner de vrais mots de passe, hashes priv?s ou donn?es sensibles.
- Garder `data/.htaccess` en place.
- Garder les v?rifications de droits c?t? PHP m?me si l?interface masque d?j? l?action.
- Garder CSRF et rate limits sur les actions sensibles.
- V?rifier les sessions visiteur, admin r?gional et admin g?n?ral apr?s toute modification d?authentification.

## Checklist avant publication

Commandes :

```powershell
npm test
npm run frontend:lint
npm run frontend:build
php tests/genealogy-server.test.php
```

Optionnel mais recommand? :

```powershell
Get-ChildItem -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName }
```

V?rifications manuelles :

1. Connexion visiteur.
2. Arbre lisible ? 100%.
3. R?seau centr? sur la fiche s?lectionn?e.
4. Couleurs de fili?res visibles dans Arbre et R?seau.
5. Survol r?seau lisible avec pastilles de r?les.
6. Cr?ation d?une fiche publique.
7. Modification de la fiche cr??e dans la m?me session.
8. Refus propre de modification d?une fiche ancienne hors admin.
9. D?placement d?une fiche en admin g?n?ral.
10. D?placement limit? au bon p?rim?tre en admin r?gional.
11. Ajout et suppression admin d?une adoption / confirmation.
12. Envoi d?une dol?ance et limite de session.
13. Connexion / d?connexion admin g?n?ral.
14. Connexion / d?connexion admin r?gional.
15. Cr?ation r?gion / famille.
16. Modification photo de branche autoris?e.
17. Cr?ation d?un r?le r?gional et usage en cooptage.
18. Statistiques d?dupliqu?es et pastilles de r?les cliquables.
19. Cr?ation d?un ?v?nement.
20. Export PDF centr? sur une personne.
21. Rechargement page : donn?es persist?es.
22. Mobile : header, options, menu d?arbre, menu d?onglets, zoom et retour haut.
23. Acc?s direct ? `data/auth.json` interdit.
24. Lien RGPD visible en bas de page.

## Dette technique suivie

- ?tendre progressivement les tests d?int?gration frontend.
- Ajouter une v?rification visuelle automatis?e si l?environnement navigateur local devient stable.
- Garder `graph.js` lisible : ne pas m?langer layout, relations et rendu Vue.
- Documenter toute nouvelle migration de donn?es au moment o? elle est ajout?e.
