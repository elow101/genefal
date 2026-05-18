export const CURRENT_SCHEMA_VERSION = 1

export function migrateGenealogyState(input) {
  const state = input && typeof input === 'object' ? input : {}
  const genealogies =
    Array.isArray(state.genealogies) && state.genealogies.length
      ? state.genealogies
      : legacyPeopleToGenealogies(state.people)

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    roleResetVersion: state.roleResetVersion ?? null,
    activeGenealogyId: state.activeGenealogyId || genealogies[0]?.id || '',
    genealogies,
    upcomingBaptisms: Array.isArray(state.upcomingBaptisms) ? state.upcomingBaptisms : [],
  }
}

function legacyPeopleToGenealogies(people) {
  if (!Array.isArray(people) || people.length === 0) return []

  return [
    {
      id: 'faluche-nationale',
      name: 'Faluche Nationale',
      type: 'national',
      parentId: '',
      photoData: '',
      people,
      customRoles: [],
      cooptageRoleId: '',
    },
  ]
}
