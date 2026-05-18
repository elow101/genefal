import {
  appendPersonToGenealogy,
  createEmptyPerson,
  removePersonFromGenealogy,
  replaceGenealogy,
  updatePersonInGenealogy,
} from '../domain/genealogy.js'

export function usePeopleMutations({ data, selectedGenealogy, selectedPersonId }) {
  function updatePerson(updatedPerson) {
    const nextGenealogy = updatePersonInGenealogy(selectedGenealogy.value, updatedPerson)
    data.value = replaceGenealogy(data.value, nextGenealogy)
  }

  function createPerson() {
    if (!selectedGenealogy.value) return

    const person = createEmptyPerson()
    const nextGenealogy = appendPersonToGenealogy(selectedGenealogy.value, person)
    data.value = replaceGenealogy(data.value, nextGenealogy)
    selectedPersonId.value = person.id
  }

  function deletePerson(personId) {
    const nextGenealogy = removePersonFromGenealogy(selectedGenealogy.value, personId)
    data.value = replaceGenealogy(data.value, nextGenealogy)

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
