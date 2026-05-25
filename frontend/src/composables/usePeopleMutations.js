import {
  appendPersonToGenealogy,
  removePersonEverywhere,
  replaceGenealogy,
  updatePersonEverywhere,
} from '../domain/genealogy.js'

export function usePeopleMutations({ data, selectedGenealogy, selectedPersonId }) {
  function updatePerson(updatedPerson) {
    data.value = updatePersonEverywhere(data.value, updatedPerson)
  }

  function insertPerson(person, targetGenealogyId = '') {
    if (!person?.id || !data.value) return null

    const genealogy =
      (targetGenealogyId
        ? (data.value.genealogies || []).find((candidate) => candidate.id === targetGenealogyId)
        : null) ||
      (selectedGenealogy.value?.type !== 'national' ? selectedGenealogy.value : null) ||
      (data.value?.genealogies || []).find((candidate) => candidate.type !== 'national')
    if (!genealogy || genealogy.type === 'national') return null

    const nextGenealogy = appendPersonToGenealogy(genealogy, person)
    data.value = replaceGenealogy(data.value, nextGenealogy)
    selectedPersonId.value = person.id
    return person
  }

  function deletePerson(personId) {
    data.value = removePersonEverywhere(data.value, personId)

    if (selectedPersonId.value === personId) {
      selectedPersonId.value = ''
    }
  }

  return {
    updatePerson,
    insertPerson,
    deletePerson,
  }
}
