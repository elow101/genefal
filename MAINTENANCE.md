# Notes de maintenance

Le projet est centré sur un frontend Vue 3 / Vite unique et une API PHP.  
Le cap de maintenance est double : préserver les garanties serveur et conserver l’expérience utilisateur historique du site.

## Carte rapide

- `index.php` gère l’entrée protégée et sert `frontend/dist/index.html`.
- `frontend/src/api/` contient les appels HTTP.
- `frontend/src/domain/` contient les règles métier pures.
- `frontend/src/composables/` orchestre l’état réactif et les flux.
- `frontend/src/features/` contient les blocs visibles de l’interface.
- `frontend/src/assets/main.css` porte le langage visuel commun.
- `site-auth.php` centralise sessions, mots de passe, CSRF, rate limits et audit.
- `api/genealogy.php`, `api/admin.php`, `api/doleances.php`, `api/auth.php` portent le backend.

## Flux de données

1. Le visiteur arrive sur `index.php` et s’authentifie.
2. Le frontend Vue charge `api/auth.php`, puis `api/genealogy.php`.
3. Les mutations locales passent par les composables.
4. Les sauvegardes structurelles sont déclenchées ponctuellement ; les fiches restent validées par leur bouton `Enregistrer`.
5. Les actions admin et les doléances passent par leurs endpoints dédiés.

## Contrats fonctionnels à préserver

### Navigation et fiche

- Les onglets principaux restent sur une seule ligne.
- La fiche faluchard reste ouverte dans toutes les vues sauf `Statistiques` et `Event à venir`.
- À l’ouverture d’une fiche, seule la section `Identité` est ouverte.
- Les boutons `Identité`, `Baptême`, `Parrainage`, `Rôles` ouvrent leur section cible et referment les autres.
- Les parrains / marraines, parrains / marraines de cœur et fillots se gèrent dans la section `Parrainage`, fermée par défaut et ouverte via son bouton.
- Les zones de paillarde ne doivent pas être redimensionnables.
- Hors mode admin, une fiche déjà existante ne peut être modifiée que si elle a été créée dans la même session publique.

### Recherche et sauvegarde

- Le bouton `Recherche` donne immédiatement le focus au champ.
- Cliquer hors de la recherche la referme.
- Ne pas réintroduire de bouton de sauvegarde global dans l’interface principale.
- Toute sauvegarde automatique doit éviter d’interrompre un utilisateur en train de saisir.

### Généalogies

- Une région a toujours l’arbre national pour parent.
- Une famille a toujours une région pour parent.
- L’arbre national ne peut pas être choisi comme parent direct d’une famille.
- Les branches doivent conserver leur photo modifiable par l’admin autorisé.
- Le menu des généalogies conserve la hiérarchie visuelle national → région → famille.

### Rôles et filières

- Les rôles visibles dans les fiches restent des pastilles sélectionnables.
- Les rôles régionaux sont ajoutés depuis l’administration.
- `TVA` reste le rôle de cooptage par défaut ; une région peut sélectionner un autre rôle local.
- Les filières autorisées et leurs couleurs sont définies dans `frontend/src/domain/filiere.js`.
- Toute modification de la palette doit être répercutée dans `api/genealogy.php`, fonction `normalise_filiere_id()`.

### Événements à venir

- Un cooptage sélectionne les personnes tenant le rôle de cooptage régional via une recherche multi-sélection.
- Les faluchards concernés par un cooptage sont cherchés parmi les personnes ne portant pas ce rôle.
- Les annonces restent lisibles sous forme de cartes, avec l’action de sélection alignée à droite.

### Administration et doléances

- Les doléances publiques ne doivent pas être proposées dans l’interface admin.
- Les doléances lues / résolues sont marquées par un bouton dédié.
- Les doléances résolues sont purgées au départ d’une session admin générale.
- Un admin régional ne gère que sa région et ses familles.
- L’admin général conserve la vue complète.

## Schéma versionné

- `schemaVersion` est le contrat de persistance principal.
- La version courante est `1`.
- Les anciennes sauvegardes plates sont converties vers une généalogie nationale lors du chargement.
- Toute évolution future du format doit ajouter une migration explicite :
  - côté frontend dans `frontend/src/domain/schema.js` ;
  - côté backend dans `api/genealogy.php`.

## Règles d’architecture

- Une règle métier réutilisable va dans `domain/`.
- Une orchestration d’état ou de réseau va dans `composables/`.
- Un composant visible va dans `features/`.
- Les composants restent fins : ils affichent plus qu’ils ne décident.
- Toute nouvelle évolution fonctionnelle se fait dans `frontend/`.
- Quand une règle existe côté frontend et côté backend, les deux côtés doivent évoluer ensemble.

## Points de vigilance

- Ne jamais exposer les fichiers de `data/`.
- Garder les mots de passe côté serveur.
- Ne pas réintroduire de hash de secours dans le code.
- Préserver le filtrage des droits admin côté serveur.
- Vérifier les impacts mobiles sur les vues denses : graphe, statistiques, formulaires, événements.
- Après toute modification visuelle, contrôler l’expérience en arbre, réseau, vue d’ensemble, statistiques et événements à venir.
- Après toute modification d’authentification, vérifier les parcours visiteur, admin régional et admin général.

## Contrôle avant publication

```powershell
npm test
npm run frontend:build
npm run frontend:lint
php tests/genealogy-server.test.php
```

Puis vérifier manuellement :

1. connexion visiteur ;
2. recherche ;
3. création d’une fiche puis modification dans la même session ;
4. refus de modification d’une fiche existante hors admin ;
5. connexion / déconnexion admin ;
6. création d’une région, d’une famille et modification d’une photo ;
7. création d’un rôle régional et usage en cooptage ;
8. création d’un événement et demande de venue ;
9. résolution puis purge d’une doléance ;
10. persistance après rechargement.

## Dette technique restante

- Continuer à étendre les tests d’intégration frontend.
- Faire une passe visuelle réelle après les grosses évolutions d’interface.
- Garder la logique de droits lisible côté serveur, même si l’interface masque déjà certaines actions.
