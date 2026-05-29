export const filiereOptions = [
  { id: 'chirurgie-dentaire', label: 'Chirurgie dentaire', colorLabel: 'Velours violet', strip: '#6b2fb9' },
  { id: 'etudes-courtes-sante', label: 'Études courtes de santé', colorLabel: 'Velours blanc', strip: '#ffffff' },
  { id: 'medecine', label: 'Médecine', colorLabel: 'Velours rouge', strip: '#e52b50' },
  { id: 'osteopathie', label: 'Ostéopathie', colorLabel: 'Velours bleu roy', strip: '#1747b5' },
  { id: 'paramedical', label: 'Paramédical', colorLabel: 'Velours rose', strip: '#ef86b9' },
  { id: 'pharmacie-preparateur-pharmacie', label: 'Pharmacie, Préparateur en pharmacie', colorLabel: 'Velours vert', strip: '#1f8f48' },
  { id: 'prepas-sante', label: 'Prépas santé', colorLabel: 'Velours marron', strip: '#7b4a2d' },
  { id: 'sage-femme', label: 'Sage-Femme', colorLabel: 'Velours fuchsia', strip: '#d81b60' },
  { id: 'veterinaire', label: 'Vétérinaire', colorLabel: 'Velours bordeaux', strip: '#6d1f32' },
  { id: 'du', label: 'DU', colorLabel: 'Matière et couleur suivant l’UFR de rattachement', strip: 'linear-gradient(180deg, #ffffff 0%, #8f9297 100%)' },
  { id: 'administration-economique-sociale', label: 'Administration Économique et Sociale (AES)', colorLabel: 'Satin vert clair', strip: '#9acd32' },
  { id: 'architecture-arts', label: 'Architecture ; Arts du spectacle ; Arts numériques ; Audiovisuel ; Beaux-arts ; Arts Plastiques', colorLabel: 'Satin bleu', strip: '#2f6fdd' },
  { id: 'classes-preparatoires', label: 'Classes préparatoires', colorLabel: 'Satin marron', strip: '#7b4a2d' },
  { id: 'communication', label: 'Communication', colorLabel: 'Satin suivant l’UFR de rattachement', strip: 'linear-gradient(180deg, #f28c28 0%, #8f9297 100%)' },
  { id: 'droit', label: 'Droit', colorLabel: 'Satin rouge', strip: '#d3272f' },
  { id: 'ecoles-commerce-gestion-communication-journalisme', label: 'Écoles de commerce, gestion, communication et journalisme', colorLabel: 'Satin rouge & vert', strip: 'linear-gradient(180deg, #d3272f 0 50%, #1f8f48 50% 100%)' },
  { id: 'ecoles-ingenieurs', label: 'Écoles d’ingénieurs', colorLabel: 'Satin bleu & noir', strip: 'linear-gradient(180deg, #2f6fdd 0 50%, #111111 50% 100%)' },
  { id: 'ecoles-nationales', label: 'Écoles nationales', colorLabel: 'Satin aux couleurs du drapeau du pays de rattachement', strip: 'linear-gradient(180deg, #0055a4 0 33%, #ffffff 33% 66%, #ef4135 66% 100%)' },
  { id: 'meef-1er-degre', label: 'MEEF 1er degré', colorLabel: 'Satin gris', strip: '#8f9297' },
  { id: 'meef-2nd-degre', label: 'MEEF 2nd degré', colorLabel: 'Satin gris', strip: '#8f9297' },
  { id: 'filieres-sportives', label: 'Filières sportives', colorLabel: 'Satin vert foncé', strip: '#165c32' },
  { id: 'but-dut-bts-bachelor', label: 'BUT, DUT, BTS, Bachelor', colorLabel: 'Satin blanc', strip: '#ffffff' },
  { id: 'iufp', label: 'IUFP', colorLabel: 'Satin aux couleurs de la discipline étudiée', strip: 'linear-gradient(180deg, #2f6fdd 0%, #d3272f 50%, #1f8f48 100%)' },
  { id: 'lettres-langues-sciences-humaines-sociales', label: 'Lettres, Langues, Sciences humaines et sociales', colorLabel: 'Satin jaune', strip: '#f3d33b' },
  { id: 'musique-musicologie', label: 'Musique, Musicologie', colorLabel: 'Satin argenté', strip: '#c0c0c0' },
  { id: 'oenologie', label: 'Œnologie', colorLabel: 'Satin saumon', strip: '#fa8072' },
  { id: 'sciences', label: 'Sciences', colorLabel: 'Satin violet', strip: '#6b2fb9' },
  { id: 'sciences-economiques-gestion-iae', label: 'Sciences économiques, Gestion, IAE', colorLabel: 'Satin orange', strip: '#f28c28' },
  { id: 'sciences-politiques', label: 'Sciences politiques', colorLabel: 'Satin bleu & rouge', strip: 'linear-gradient(180deg, #2f6fdd 0 50%, #d3272f 50% 100%)' },
]

const filiereById = new Map(filiereOptions.map((option) => [option.id, option]))
const legacyAliases = new Map([
  ['dentaire', 'chirurgie-dentaire'],
  ['carab', 'medecine'],
  ['pharma', 'pharmacie-preparateur-pharmacie'],
  ['aes', 'administration-economique-sociale'],
  ['arts-spectacle-cinema-audiovisuel', 'architecture-arts'],
  ['arts-visuels', 'architecture-arts'],
  ['bts', 'but-dut-bts-bachelor'],
  ['cpge-hypokhagne-khagne', 'classes-preparatoires'],
  ['cpge-scientifique', 'classes-preparatoires'],
  ['sciences-general', 'sciences'],
  ['paramedical-kinesitherapie', 'paramedical'],
  ['economie-comptabilite', 'sciences-economiques-gestion-iae'],
  ['enseignement-2nd-degre', 'meef-2nd-degre'],
  ['enseignement-1er-degre', 'meef-1er-degre'],
  ['lettres', 'lettres-langues-sciences-humaines-sociales'],
  ['lea', 'lettres-langues-sciences-humaines-sociales'],
  ['psychologie', 'lettres-langues-sciences-humaines-sociales'],
])

export function normaliseFiliereId(id = '') {
  return legacyAliases.get(id) || (filiereById.has(id) ? id : '')
}

function filiereOption(id = '') {
  return filiereById.get(normaliseFiliereId(id)) || null
}

export function filiereLabel(id = '') {
  return filiereOption(id)?.label || ''
}

export function filiereStyle(person) {
  const strip = filiereOption(person?.filiere)?.strip || ''
  return strip ? { '--filiere-strip': strip } : {}
}

export function filiereAccent(id = '') {
  const strip = filiereOption(id)?.strip || ''
  const hex = strip.match(/#[0-9a-f]{3,8}/i)?.[0]
  return hex || ''
}
