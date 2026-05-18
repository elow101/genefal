# Frontend Vue/Vite

Le dossier `frontend/` est le framework front moderne de Faluche Nationale. Il consomme l’API PHP existante via le proxy Vite et sépare volontairement les responsabilités :

```text
src/
  api/          appels HTTP vers le backend PHP
  composables/  orchestration réactive Vue
  domain/       règles métier pures et transformations de données
  features/     blocs fonctionnels visibles dans l’interface
  assets/       styles globaux
```

## Lancer en local

Depuis la racine du projet, ouvrir deux terminaux :

```powershell
npm.cmd run backend:dev
```

puis :

```powershell
npm.cmd run frontend:dev
```

Ouvrir ensuite :

```text
http://127.0.0.1:5173/
```

Important : utiliser `127.0.0.1`, pas `localhost`, pour rester cohérent avec les cookies de session du backend PHP sur `127.0.0.1:8765`.

Si le site demande le mot de passe, se connecter d’abord sur :

```text
http://127.0.0.1:8765/
```

Puis revenir sur :

```text
http://127.0.0.1:5173/
```

## Où placer le code

- Nouvelle requête réseau : `src/api/`
- Nouvelle règle métier ou transformation : `src/domain/`
- État partagé, chargement, sauvegarde ou orchestration : `src/composables/`
- Nouvelle section visible de l’application : `src/features/<nom-du-bloc>/`
- Style partagé : `src/assets/main.css`

Cette séparation garde les composants Vue minces : ils affichent, les composables coordonnent, le domaine décide.

## Commandes utiles

```powershell
npm.cmd run frontend:build
npm.cmd run frontend:test
npm.cmd run frontend:lint
```

## Dépannage

L’erreur `ECONNREFUSED 127.0.0.1:8765` signifie que Vite fonctionne, mais que le serveur PHP n’est pas lancé. Le proxy `/api/*` de Vite redirige vers `http://127.0.0.1:8765`.
