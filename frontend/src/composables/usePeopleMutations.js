import {
  appendPersonToGenealogy,
  createEmptyPerson,
  removePersonEverywhere,
  replaceGenealogy,
  updatePersonEverywhere,
} from '../domain/genealogy.js'

export function usePeopleMutations({ data, selectedGenealogy, selectedPersonId }) {
  function updatePerson(updatedPerson) {
    data.value = updatePersonEverywhere(data.value, updatedPerson)
  }

  function createPerson() {
    if (!selectedGenealogy.value) return

    const person = createEmptyPerson()
    const nextGenealogy = appendPersonToGenealogy(selectedGenealogy.value, person)
    data.value = replaceGenealogy(data.value, nextGenealogy)
    selectedPersonId.value = person.id
  }

  function deletePerson(personId) {
    data.value = removePersonEverywhere(data.value, personId)

    if (selectedPersonId.value === personId) {
      selectedPersonId.value = ''
    }
  }

  return {
    updatePerson,
    createPerson,
    deletePerson,
  }
}
