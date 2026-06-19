export const ideaBoxStatuses = [
  { id: 'under_review', label: "À l'étude" },
  { id: 'planned', label: 'Prévue' },
  { id: 'in_development', label: 'En développement' },
  { id: 'in_testing', label: 'En test' },
  { id: 'published', label: 'Publiée' },
  { id: 'rejected', label: 'Refusée' },
  { id: 'archived', label: 'Archivée' },
]

export const ideaBoxPublicTabs = [
  { id: 'under_review', label: "À l'étude" },
  { id: 'planned', label: 'Prévues' },
  { id: 'in_development', label: 'En développement' },
  { id: 'published', label: 'Publiées' },
]

export const ideaBoxCategories = [
  'Arbre et réseau',
  'Fiches',
  'Événements',
  'Administration',
  'Mobile',
  'Performance',
  'Export',
  'Confidentialité',
  'Tutoriels',
  'Autre',
]

export const ideaBoxDifficulties = [
  { id: '', label: 'Non definie' },
  { id: 'low', label: 'Faible' },
  { id: 'medium', label: 'Moyenne' },
  { id: 'high', label: 'Élevée' },
  { id: 'very_high', label: 'Très élevée' },
]

export const ideaBoxPriorities = [
  { id: '', label: 'Non definie' },
  { id: 'low', label: 'Faible' },
  { id: 'normal', label: 'Normale' },
  { id: 'high', label: 'Haute' },
  { id: 'critical', label: 'Critique' },
]

export const ideaBoxSorts = [
  { id: 'popular', label: 'Plus populaires' },
  { id: 'recent', label: 'Plus récentes' },
  { id: 'controversial', label: 'Plus controversées' },
  { id: 'updated', label: 'Dernièrement mises à jour' },
]

export const positiveReasons = [
  { id: 'tres_utile', label: 'Très utile' },
  { id: 'utile_occasionnellement', label: 'Utile occasionnellement' },
  { id: 'prioritaire', label: 'Prioritaire' },
  { id: 'bonne_idee_pas_urgente', label: 'Bonne idee mais pas urgente' },
  { id: 'autre', label: 'Autre' },
]

export const negativeReasons = [
  { id: 'peu_utile', label: 'Peu utile pour mon usage' },
  { id: 'trop_complexe', label: 'Trop complexe' },
  { id: 'risque_confidentialite', label: 'Risque pour la confidentialité' },
  { id: 'moins_simple', label: 'Risque de rendre le site moins simple' },
  { id: 'autre', label: 'Autre' },
]

export function ideaBoxLabel(options, id) {
  return options.find((option) => option.id === id)?.label || id || ''
}
