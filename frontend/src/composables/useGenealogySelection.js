import { computed, ref } from 'vue'
import {
  getAllPeople,
  getPeopleForGenealogy,
  getSelectedGenealogy,
  getSelectedPerson,
  getUpcomingEvents,
} from '../domain/genealogy.js'

export function useGenealogySelection(data) {
  const selectedGenealogyId = ref('')
  const selectedPersonId = ref('')

  const genealogies = computed(() => data.value?.genealogies || [])
  const selectedGenealogy = computed(() => getSelectedGenealogy(data.value, selectedGenealogyId.value))
  const people = computed(() => getPeopleForGenealogy(selectedGenealogy.value, genealogies.value))
  const selectedPerson = computed(() => getSelectedPerson(people.value, selectedPersonId.value))
  const upcomingEvents = computed(() => getUpcomingEvents(data.value))

  function initialiseSelection() {
    const national = genealogies.value.find((genealogy) => genealogy.type === 'national')
    selectedGenealogyId.value = national?.id || genealogies.value[0]?.id || ''
    selectedPersonId.value = mostConnectedPersonId(getAllPeople(data.value))
  }

  function selectGenealogy(id) {
    selectedGenealogyId.value = id
    const selected = getSelectedGenealogy(data.value, id)
    selectedPersonId.value = mostConnectedPersonId(getPeopleForGenealogy(selected, genealogies.value))
  }

  function selectPerson(id) {
    selectedPersonId.value = id
  }

  return {
    genealogies,
    selectedGenealogyId,
    selectedGenealogy,
    selectedPersonId,
    selectedPerson,
    upcomingEvents,
    people,
    initialiseSelection,
    selectGenealogy,
    selectPerson,
  }
}

function mostConnectedPersonId(people) {
  if (!people.length) return ''
  return [...people]
    .sort((left, right) => connectionScore(right, people) - connectionScore(left, people) || left.name.localeCompare(right.name, 'fr'))[0]
    ?.id || ''
}

function connectionScore(person, people) {
  const sponsorCount = (person.sponsorIds || []).length + (person.heartSponsorIds || []).length
  const ceremonySponsorCount = (person.ceremonyEvents || []).reduce(
    (total, event) => total + (event.sponsorIds?.length || 0) + (event.heartSponsorIds?.length || 0),
    0,
  )
  const descendantCount = people.filter((candidate) => personIsLinkedToSponsor(candidate, person.id)).length
  const crossCount = person.crossGroupId
    ? people.filter((candidate) => candidate.id !== person.id && candidate.crossGroupId === person.crossGroupId).length
    : 0
  return sponsorCount + ceremonySponsorCount + descendantCount + crossCount
}

function personIsLinkedToSponsor(person, sponsorId) {
  return (
    (person.sponsorIds || []).includes(sponsorId) ||
    (person.heartSponsorIds || []).includes(sponsorId) ||
    (person.ceremonyEvents || []).some((event) =>
      [...(event.sponsorIds || []), ...(event.heartSponsorIds || [])].includes(sponsorId),
    )
  )
}
