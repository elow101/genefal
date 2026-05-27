# Rapport d'audit — Nettoyage code post-refonte UI/UX

> Date : 2026-05-27  
> Portée : frontend/src + api/  
> Méthode : analyse statique (ESLint, grep manuel, recherche de références)  
> Contrainte : aucune modification du code dans ce rapport — uniquement diagnostic et plan.

---

## 1. Résumé exécutif

| Catégorie | Nombre d'éléments | Risque max |
|-----------|-------------------|------------|
| Variables inutilisées | 3 | Faible |
| Export non consommé | 1 | Faible |
| Règles CSS mortes | ~6 classes | Faible |
| Imports potentiellement superflus | 0 confirmé | — |
| Composants orphelins | 0 | — |
| Doublons de logique | 0 majeur | — |

**Verdict global** : le codebase est globalement propre. Les restes identifiés sont mineurs (variables de destructuration, un export interne exposé, et quelques classes CSS d'une ancienne UI graphique jamais nettoyées). Aucun impact fonctionnel n'est attendu.

---

## 2. Détail par catégorie

### 2.1 Variables assignées mais jamais utilisées — SUPPRESSION SÛRE

**Fichier** : `frontend/src/domain/genealogy.js:234`

```js
function stripGenealogyContext(person) {
  const { genealogyId: _genealogyId, genealogyName: _genealogyName, genealogyType: _genealogyType, ...clean } = person
  return clean
}
```

**Problème** : `_genealogyId`, `_genealogyName`, `_genealogyType` sont déstructurés puis immédiatement ignorés. ESLint les signale comme *assigned a value but never used*.

**Justification** : ces préfixes underscore indiquent intentionnellement l'omission, mais le linter moderne les considère comme inutilisés. La logique est correcte (on veut retirer ces 3 champs du clone), mais le code peut être réécrit pour ne plus les nommer.

**Action recommandée** : réécrire la destructuration sans nommer les variables omises, ou utiliser une approche par `Object.fromEntries` / boucle.

---

### 2.2 Export public jamais importé ailleurs — RÉFACTOR POSSIBLE

**Fichier** : `frontend/src/domain/graph.js:434`

```js
export function displayNicknames(person) {
  return (person.nicknames || [person.nickname]).filter(Boolean).join(' / ')
}
```

**Problème** : `displayNicknames` est exportée mais **jamais importée par un autre module**. Elle n'est consommée que par `displayName`, située dans le **même fichier**.

**Références**
- `displayName` (même fichier, l.429) : `const nicknames = displayNicknames(person)`
- Aucun `import { displayNicknames }` trouvé dans `frontend/src/`

**Action recommandée** : retirer le mot-clé `export` pour en faire une fonction purement interne au module.

---

### 2.3 CSS mort — classes définies mais jamais utilisées dans les templates — ❌ ANNULÉ

Recherche initiale : `grep -r "class=\"...\""` dans tous les `.vue` et `.js` de `frontend/src/` pour chaque classe candidate.

| Classe CSS | Fichier CSS | Lignes | Utilisée dans un template ? |
|------------|-------------|--------|---------------------------|
| `.graph-layout-controls` | `main.css` | ~967-980, ~5180-5185 | ✅ Oui (`App.vue:89`) |
| `.graph-layout-controls > span` | `main.css` | ~978-980 | ✅ Oui (enfant de `.graph-layout-controls`) |
| `.network-halo-controls` | `main.css` | ~1015-1026, ~5220-5226 | ✅ Oui (`App.vue:186`) |
| `.network-halo-controls__header` | `main.css` | ~1028-1032 | ✅ Oui (enfant de `.network-halo-controls`) |
| `.network-halo-controls__header strong` | `main.css` | ~1034-1037 | ✅ Oui (enfant de `.network-halo-controls__header`) |
| `.network-halo-controls__header span` | `main.css` | ~1039-1043 | ✅ Oui (enfant de `.network-halo-controls__header`) |
| `.network-halo-controls__groups` | `main.css` | ~1046-1049, ~5234-5236 | ✅ Oui (`App.vue:188`) |
| `.graph-legend--below` | `main.css` | ~4516-4562 | ✅ Oui (`App.vue:145`) |

**Conclusion** : la première passe de grep n'a pas détecté ces occurrences (pattern trop restrictif). Toutes ces classes sont actuellement référencées dans `App.vue`. Aucune suppression CSS n'est donc justifiée. **Étape annulée.**

---

### 2.4 Vérifications négatives (éléments suspectés mais finalement OK)

| Élément soupçonné | Investigation | Conclusion |
|-------------------|---------------|------------|
| `components/ui/AppButton.vue` | Importé et utilisé dans `features/layout/AppHeader.vue` | ✅ OK — conservé |
| `components/ui/AppField.vue` | Importé et utilisé dans `features/search/PersonSearch.vue` | ✅ OK — conservé |
| `.upcoming-panel`, `.upcoming-form` | Utilisées dans `features/upcoming/UpcomingComposer.vue` | ✅ OK — conservé |
| `.upcoming-form-head` | Utilisée dans `features/upcoming/UpcomingComposer.vue` | ✅ OK — conservé |
| `displayName` (domain/graph.js) | Importée et utilisée dans `features/overview/OverviewPanel.vue` | ✅ OK — conservé |
| `ceremonySummaries` (domain/graph.js) | Importée et utilisée dans `features/graph/GenealogyGraph.vue` | ✅ OK — conservé |
| Tous les composants asynchrones (`AdminPanel`, `GenealogyAdmin`, etc.) | Référencés dans `App.vue` via `defineAsyncComponent` | ✅ OK — conservés |

---

## 3. Doublons / redondances de logique

**Constat** : aucun doublon majeur identifié entre modules. Les fonctions de normalisation (`normaliseUpcomingEventType`, `normaliseUpcomingScope`, etc.) sont spécialisées et non dupliquées. Les helpers de `domain/genealogy.js` et `domain/stats.js` ont des portées distinctes.

**Petite observation** (non bloquante) :
- `normaliseNames` dans `domain/upcoming.js` et `normalizeSearchText` dans `domain/search.js` font des opérations textuelles similaires (nettoyage, découpage) mais avec des objectifs différents. Pas de fusion pertinente.

---

## 4. Tests

| Suite | Résultat |
|-------|----------|
| `frontend/src/features/upcoming/UpcomingComposer.test.js` | ✅ 4/4 passed |
| `frontend/src/features/upcoming/UpcomingView.test.js` | ✅ 4/4 passed |
| `frontend/src/App.integration.test.js` | ❌ 6/42 failed (pré-existant, lié à `find(...).trigger` sur un bouton absent) |

**Note** : les 6 échecs de l'intégration ne sont pas liés à la refonte events ; ils semblent être un problème de sélecteur de test existant (`button.text() === 'Explorer l\'arbre'` retourne `undefined`).

---

## 5. Plan de nettoyage progressif — APPLIQUÉ

### Étape 1 — Corrections sûres (risque : aucun)
- [x] **A** — `frontend/src/domain/genealogy.js:234` : réécriture de `stripGenealogyContext` sans variables underscore.  
  *Commité. ESLint ne signale plus d'erreur. Build OK.*
- [x] **B** — `frontend/src/domain/graph.js:434` : retrait de `export` devant `displayNicknames`.  
  *Commité. ESLint ne signale plus d'export inutilisé. Build OK.*
- [ ] **C** — `frontend/src/assets/main.css` : suppression des blocs `.graph-layout-controls`, `.network-halo-controls*` et `.graph-legend--below`.  
  *❌ Annulé — toutes ces classes sont référencées dans `App.vue` (erreur de grep initial corrigée).*

### Étape 2 — Vérification post-nettoyage
- [x] Relancer `npm run build` → ✅ OK (exit 0).
- [x] Relancer ESLint (`frontend/node_modules/.bin/eslint frontend/src`) → ✅ OK (exit 0, 0 errors).
- [x] Relancer tests upcoming → ✅ OK (8/8 passed).

### Étape 3 — Amélioration de la qualité (optionnel)
- [ ] Configurer ESLint avec `no-unused-vars` pour catcher ce type de reste automatiquement à l'avenir.
- [ ] Ajouter une règle `vue/no-unused-components` si les composants deviennent nombreux.

---

## 6. Ce qui a été volontairement exclu de l'audit

Conformément à la consigne initiale, les zones suivantes n'ont pas été modifiées ni approfondies :
- `site-auth.php` (auth)
- `api/admin*.php` (admin / permissions)
- Logique de sauvegarde/synchronisation SQL
- Tous les endpoints API et handlers PHP
- Fichiers de sécurité (CSRF, session, mots de passe)
