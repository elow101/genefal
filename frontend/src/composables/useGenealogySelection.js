import { computed, ref } from 'vue'
import {
  getAllPeople,
  getPeopleForGenealogy,
  getSelectedGenealogy,
  getSelectedPerson,
} from '../domain/genealogy.js'

export function useGenealogySelection(data) {
  const selectedGenealogyId = ref('')
  const selectedPersonId = ref('')

  const genealogies = computed(() => data.value?.genealogies || [])
  const selectedGenealogy = computed(() => getSelectedGenealogy(data.value, selectedGenealogyId.value))
  const people = computed(() => getPeopleForGenealogy(selectedGenealogy.value, genealogies.value))
  const selectedPerson = computed(() => getSelectedPerson(people.value, selectedPersonId.value))

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
    people,
    initialiseSelection,
    selectGenealogy,
    selectPerson,
  }
}

function mostConnectedPersonId(people) {
  if (!people.length) return ''
  const scores = connectionScores(people)
  return people.reduce((best, person) => {
    if (!best) return person
    const score = scores.get(person.id) || 0
    const bestScore = scores.get(best.id) || 0
    if (score !== bestScore) return score > bestScore ? person : best
    return (person.name || '').localeCompare(best.name || '', 'fr') < 0 ? person : best
  }, null)?.id || ''
}

function connectionScores(people) {
  const scores = new Map()
  const crossGroupCounts = new Map()

  for (const person of people) {
    if (!person?.id) continue
    scores.set(person.id, 0)
    if (person.crossGroupId) {
      crossGroupCounts.set(person.crossGroupId, (crossGroupCounts.get(person.crossGroupId) || 0) + 1)
    }
  }

  for (const person of people) {
    if (!person?.id) continue
    const linkedSponsorIds = personSponsorIds(person)
    scores.set(person.id, (scores.get(person.id) || 0) + linkedSponsorIds.length)

    for (const sponsorId of linkedSponsorIds) {
      if (scores.has(sponsorId)) {
        scores.set(sponsorId, (scores.get(sponsorId) || 0) + 1)
      }
    }
  }

  for (const person of people) {
    if (!person?.id || !person.crossGroupId) continue
    scores.set(person.id, (scores.get(person.id) || 0) + Math.max(0, (crossGroupCounts.get(person.crossGroupId) || 0) - 1))
  }

  return scores
}

function personSponsorIds(person) {
  const ids = [
    ...(person.sponsorIds || []),
    ...(person.heartSponsorIds || []),
  ]
  for (const event of person.ceremonyEvents || []) {
    ids.push(...(event.sponsorIds || []), ...(event.heartSponsorIds || []))
  }
  return ids
}
