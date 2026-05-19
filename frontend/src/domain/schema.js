export const CURRENT_SCHEMA_VERSION = 1

const MAIN_GENEALOGY_ID = 'faluche-nationale'
const DEFAULT_REGIONAL_GENEALOGY_ID = 'faluche-alsacienne'
const DEFAULT_GENEALOGY_NAME = 'Faluche Nationale'
const DEFAULT_REGIONAL_GENEALOGY_NAME = 'La faluche alsacienne'

export function migrateGenealogyState(input) {
  const state = input && typeof input === 'object' ? input : {}
  const rawGenealogies = Array.isArray(state.genealogies) && state.genealogies.length
    ? state.genealogies
    : legacyPeopleToGenealogies(Array.isArray(state) ? state : state.people)
  const genealogies = ensureMainGenealogy(
    shouldMigrateLegacyGenealogies(rawGenealogies)
      ? migrateLegacyGenealogies(rawGenealogies)
      : rawGenealogies,
  )

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    roleResetVersion: state.roleResetVersion ?? null,
    activeGenealogyId: genealogies.some((genealogy) => genealogy.id === state.activeGenealogyId)
      ? state.activeGenealogyId
      : genealogies[0]?.id || '',
    genealogies,
    upcomingBaptisms: Array.isArray(state.upcomingBaptisms) ? state.upcomingBaptisms : [],
  }
}

function legacyPeopleToGenealogies(people) {
  if (!Array.isArray(people) || people.length === 0) return []

  return [
    {
      id: MAIN_GENEALOGY_ID,
      name: DEFAULT_GENEALOGY_NAME,
      type: 'national',
      parentId: '',
      photoData: '',
      people,
      customRoles: [],
      cooptageRoleId: '',
    },
  ]
}

function shouldMigrateLegacyGenealogies(genealogies) {
  if (!Array.isArray(genealogies) || genealogies.length === 0) return false
  const hasHierarchy = genealogies.some(
    (genealogy) =>
      genealogy?.type || genealogy?.level || genealogy?.scope || genealogy?.parentId || genealogy?.regionId,
  )
  if (hasHierarchy) return false
  return genealogies.length > 1 || genealogies.some(isMainGenealogyRaw)
}

function migrateLegacyGenealogies(genealogies) {
  const legacyMain = genealogies.find(isMainGenealogyRaw) || genealogies[0] || {}
  return [
    {
      id: MAIN_GENEALOGY_ID,
      name: DEFAULT_GENEALOGY_NAME,
      type: 'national',
      parentId: '',
      photoData: '',
      people: [],
      customRoles: [],
      cooptageRoleId: '',
    },
    {
      ...legacyMain,
      id: DEFAULT_REGIONAL_GENEALOGY_ID,
      name: DEFAULT_REGIONAL_GENEALOGY_NAME,
      type: 'region',
      parentId: MAIN_GENEALOGY_ID,
    },
    ...genealogies
      .filter((genealogy) => genealogy !== legacyMain)
      .map((genealogy) => ({
        ...genealogy,
        type: 'family',
        parentId: DEFAULT_REGIONAL_GENEALOGY_ID,
      })),
  ]
}

function ensureMainGenealogy(genealogies) {
  if (!Array.isArray(genealogies) || genealogies.length === 0) return []

  const cleaned = genealogies.map((genealogy, index) => {
    const name = String(genealogy?.name || (index === 0 ? DEFAULT_GENEALOGY_NAME : `Généalogie ${index + 1}`)).trim()
    const id = String(genealogy?.id || name || `genealogy-${index + 1}`).trim()
    const type = normaliseGenealogyType(genealogy?.type || genealogy?.level || genealogy?.scope, id, name)
    return {
      ...genealogy,
      id,
      name,
      type,
      parentId: type === 'national' ? '' : String(genealogy?.parentId || genealogy?.regionId || '').trim(),
      people: Array.isArray(genealogy?.people) ? genealogy.people : [],
      customRoles: Array.isArray(genealogy?.customRoles) ? genealogy.customRoles : [],
      cooptageRoleId: type === 'region' ? genealogy?.cooptageRoleId || 'tva' : '',
    }
  })

  const national = cleaned.find((genealogy) => genealogy.type === 'national') || {
    id: MAIN_GENEALOGY_ID,
    name: DEFAULT_GENEALOGY_NAME,
    type: 'national',
    parentId: '',
    photoData: '',
    people: [],
    customRoles: [],
    cooptageRoleId: '',
  }
  const regions = cleaned
    .filter((genealogy) => genealogy.type === 'region')
    .map((genealogy) => ({ ...genealogy, parentId: MAIN_GENEALOGY_ID }))
  let families = cleaned
    .filter((genealogy) => !['national', 'region'].includes(genealogy.type))
    .map((genealogy) => ({ ...genealogy, type: 'family' }))

  if (!regions.length && families.length) {
    regions.push({
      id: DEFAULT_REGIONAL_GENEALOGY_ID,
      name: DEFAULT_REGIONAL_GENEALOGY_NAME,
      type: 'region',
      parentId: MAIN_GENEALOGY_ID,
      photoData: '',
      people: [],
      customRoles: [],
      cooptageRoleId: 'tva',
    })
  }

  const regionIds = new Set(regions.map((region) => region.id))
  const fallbackRegionId = regions[0]?.id || ''
  families = families.map((family) => ({
    ...family,
    parentId: regionIds.has(family.parentId) ? family.parentId : fallbackRegionId,
  }))

  return [
    {
      ...national,
      id: MAIN_GENEALOGY_ID,
      name: DEFAULT_GENEALOGY_NAME,
      type: 'national',
      parentId: '',
      customRoles: [],
      cooptageRoleId: '',
    },
    ...regions,
    ...families,
  ]
}

function normaliseGenealogyType(value, id = '', name = '') {
  const type = normalisedText(value)
  if (['national', 'nation', 'nationale', 'root'].includes(type) || id === MAIN_GENEALOGY_ID) return 'national'
  if (['region', 'regional', 'regionale', 'ville', 'city'].includes(type)) return 'region'
  if (['family', 'famille'].includes(type)) return 'family'
  if (isMainGenealogyRaw({ id, name })) return 'national'
  return 'family'
}

function isMainGenealogyRaw(genealogy) {
  const id = String(genealogy?.id || '').trim()
  const name = normalisedText(genealogy?.name)
  return (
    id === MAIN_GENEALOGY_ID ||
    id === 'kfetteria' ||
    [
      'faluche nationale',
      'la faluche nationale',
      'faluche alsacienne',
      'la faluche alsacienne',
      'faluche alscacienne',
      'la faluche alscacienne',
      'descendance de la k fetteria',
    ].includes(name)
  )
}

function normalisedText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
