export function getGenealogies(state) {
  return state?.genealogies || []
}

export function getSelectedGenealogy(state, selectedGenealogyId) {
  const genealogies = getGenealogies(state)
  return genealogies.find((genealogy) => genealogy.id === selectedGenealogyId) || genealogies[0] || null
}

export function getPeopleForGenealogy(genealogy, allGenealogies = []) {
  if (!genealogy) return []

  if (genealogy.type === 'national' && allGenealogies.length) {
    return deduplicatedPeopleWithGenealogyContext(allGenealogies)
  }

  return peopleWithGenealogyContext(genealogy)
}

export function getAllPeople(state) {
  return deduplicatedPeopleWithGenealogyContext(getGenealogies(state))
}

export function getPersonSourceGenealogy(state, personId) {
  return getGenealogies(state)
    .filter((genealogy) => (genealogy.people || []).some((person) => person.id === personId))
    .sort((left, right) => genealogySourcePriority(left) - genealogySourcePriority(right))[0] || null
}

export function getSelectedPerson(people, selectedPersonId) {
  return people.find((person) => person.id === selectedPersonId) || null
}

export function findDuplicatePerson(allPeople, name, nickname, excludeId = '') {
  const normalize = (text) =>
    (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
  const targetName = normalize(name)
  const targetNickname = normalize(nickname)
  if (!targetName && !targetNickname) return null
  return allPeople.find((person) => {
    if (person.id === excludeId) return false
    const sameName = targetName && normalize(person.name) === targetName
    const sameNickname = targetNickname && normalize(person.nickname) === targetNickname
    return sameName && sameNickname
  }) || null
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
    filiere2: '',
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
      person.id === updatedPerson.id ? stripGenealogyContext(updatedPerson) : person,
    ),
  }
}

export function updatePersonEverywhere(state, updatedPerson) {
  if (!state || !updatedPerson?.id) return state

  return {
    ...state,
    genealogies: getGenealogies(state).map((genealogy) => updatePersonInGenealogy(genealogy, updatedPerson)),
  }
}

export function appendPersonToGenealogy(genealogy, person) {
  if (!genealogy) return genealogy

  return {
    ...genealogy,
    people: [...(genealogy.people || []), stripGenealogyContext(person)],
  }
}

export function removePersonFromGenealogy(genealogy, personId) {
  if (!genealogy) return genealogy

  return {
    ...genealogy,
    people: (genealogy.people || [])
      .filter((person) => person.id !== personId)
      .map((person) => cleanPersonRelations(person, personId)),
  }
}

export function removePersonEverywhere(state, personId) {
  if (!state || !personId) return state

  return {
    ...state,
    genealogies: getGenealogies(state).map((genealogy) => removePersonFromGenealogy(genealogy, personId)),
  }
}

export function movePersonToGenealogy(state, personId, targetGenealogyId, allowedGenealogyIds = null) {
  if (!state || !personId || !targetGenealogyId) return state

  const allowedIds = allowedGenealogyIds ? new Set(allowedGenealogyIds) : null
  const sourceGenealogy = getPersonSourceGenealogy(state, personId)
  const targetGenealogy = getGenealogies(state).find((genealogy) => genealogy.id === targetGenealogyId)

  if (!sourceGenealogy || !targetGenealogy || sourceGenealogy.id === targetGenealogy.id) return state
  if (targetGenealogy.type === 'national') return state
  if (allowedIds && (!allowedIds.has(sourceGenealogy.id) || !allowedIds.has(targetGenealogy.id))) return state

  const movedPerson = (sourceGenealogy.people || []).find((person) => person.id === personId)
  if (!movedPerson) return state

  return {
    ...state,
    activeGenealogyId: targetGenealogy.id,
    genealogies: getGenealogies(state).map((genealogy) => {
      if (genealogy.id === sourceGenealogy.id) {
        return {
          ...genealogy,
          people: (genealogy.people || []).filter((person) => person.id !== personId),
        }
      }

      if (genealogy.id === targetGenealogy.id) {
        const cleanPerson = stripGenealogyContext(movedPerson)
        const people = genealogy.people || []
        const alreadyExists = people.some((person) => person.id === personId)

        return {
          ...genealogy,
          people: alreadyExists
            ? people.map((person) => (person.id === personId ? cleanPerson : person))
            : [...people, cleanPerson],
        }
      }

      return genealogy
    }),
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

function peopleWithGenealogyContext(genealogy) {
  return (genealogy.people || []).map((person) => ({
    ...person,
    genealogyId: genealogy.id,
    genealogyName: genealogy.name,
    genealogyType: genealogy.type || '',
  }))
}

function deduplicatedPeopleWithGenealogyContext(genealogies) {
  const byId = new Map()
  for (const genealogy of genealogies) {
    for (const person of peopleWithGenealogyContext(genealogy)) {
      if (!person.id) continue
      const current = byId.get(person.id)
      if (!current || genealogySourcePriority(person) < genealogySourcePriority(current)) {
        byId.set(person.id, person)
      }
    }
  }
  return [...byId.values()]
}

function genealogySourcePriority(source) {
  if (source?.type === 'family' || source?.genealogyType === 'family') return 0
  if (source?.type === 'region' || source?.genealogyType === 'region') return 1
  if (source?.type === 'national' || source?.genealogyType === 'national') return 2
  return 3
}

function stripGenealogyContext(person) {
  const clean = { ...person }
  delete clean.genealogyId
  delete clean.genealogyName
  delete clean.genealogyType
  return clean
}

function cleanPersonRelations(person, personId) {
  return {
    ...person,
    sponsorIds: (person.sponsorIds || []).filter((id) => id !== personId),
    heartSponsorIds: (person.heartSponsorIds || []).filter((id) => id !== personId),
    ceremonyEvents: (person.ceremonyEvents || []).map((event) => ({
      ...event,
      sponsorIds: (event.sponsorIds || []).filter((id) => id !== personId),
      heartSponsorIds: (event.heartSponsorIds || []).filter((id) => id !== personId),
    })),
  }
}
