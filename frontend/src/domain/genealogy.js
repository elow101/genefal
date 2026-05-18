export function getGenealogies(state) {
  return state?.genealogies || []
}

export function getSelectedGenealogy(state, selectedGenealogyId) {
  const genealogies = getGenealogies(state)
  return genealogies.find((genealogy) => genealogy.id === selectedGenealogyId) || genealogies[0] || null
}

export function getPeopleForGenealogy(genealogy) {
  if (!genealogy) return []

  return (genealogy.people || []).map((person) => ({
    ...person,
    genealogyName: genealogy.name,
  }))
}

export function getSelectedPerson(people, selectedPersonId) {
  return people.find((person) => person.id === selectedPersonId) || null
}

export function getUpcomingEvents(state) {
  return state?.upcomingBaptisms || []
}

export function createEmptyPerson(id = `person-${Date.now()}`) {
  return {
    id,
    name: 'Nouvelle personne',
    nickname: '',
    nicknames: [],
    roles: [],
    ceremonyType: 'bapteme',
    baptismDate: '',
    baptismCity: '',
    baptismStatus: 'unknown',
    ceremonyEvents: [],
    song: '',
    filiere: '',
    createdAt: new Date().toISOString(),
    sponsorIds: [],
    heartSponsorIds: [],
    crossGroupId: '',
    crossGroupSize: 0,
  }
}

export function updatePersonInGenealogy(genealogy, updatedPerson) {
  if (!genealogy) return genealogy

  return {
    ...genealogy,
    people: (genealogy.people || []).map((person) =>
      person.id === updatedPerson.id ? updatedPerson : person,
    ),
  }
}

export function appendPersonToGenealogy(genealogy, person) {
  if (!genealogy) return genealogy

  return {
    ...genealogy,
    people: [...(genealogy.people || []), person],
  }
}

export function removePersonFromGenealogy(genealogy, personId) {
  if (!genealogy) return genealogy

  return {
    ...genealogy,
    people: (genealogy.people || [])
      .filter((person) => person.id !== personId)
      .map((person) => ({
        ...person,
        sponsorIds: (person.sponsorIds || []).filter((id) => id !== personId),
        heartSponsorIds: (person.heartSponsorIds || []).filter((id) => id !== personId),
      })),
  }
}

export function replaceGenealogy(state, nextGenealogy) {
  if (!state || !nextGenealogy) return state

  return {
    ...state,
    genealogies: getGenealogies(state).map((genealogy) =>
      genealogy.id === nextGenealogy.id ? nextGenealogy : genealogy,
    ),
  }
}

export function createGenealogy(name, type = 'family', parentId = '') {
  return {
    id: `genealogy-${Date.now()}`,
    name: String(name || 'Nouvelle généalogie').trim(),
    type,
    parentId,
    photoData: '',
    people: [],
    customRoles: [],
    cooptageRoleId: '',
  }
}

export function updateGenealogy(state, genealogyId, patch) {
  if (!state || !genealogyId) return state
  return {
    ...state,
    genealogies: getGenealogies(state).map((genealogy) =>
      genealogy.id === genealogyId ? { ...genealogy, ...patch } : genealogy,
    ),
  }
}

export function appendGenealogy(state, genealogy) {
  return {
    ...state,
    genealogies: [...getGenealogies(state), genealogy],
    activeGenealogyId: genealogy.id,
  }
}

export function removeGenealogy(state, genealogyId) {
  const target = getGenealogies(state).find((genealogy) => genealogy.id === genealogyId)
  if (!target || target.type === 'national' || getGenealogies(state).length <= 1) return state

  const genealogies = getGenealogies(state).filter((genealogy) => genealogy.id !== genealogyId)
  return {
    ...state,
    genealogies,
    activeGenealogyId:
      state.activeGenealogyId === genealogyId ? genealogies[0]?.id || '' : state.activeGenealogyId,
  }
}
