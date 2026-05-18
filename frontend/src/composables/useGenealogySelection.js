import { computed, ref } from 'vue'
import {
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
  const people = computed(() => getPeopleForGenealogy(selectedGenealogy.value))
  const selectedPerson = computed(() => getSelectedPerson(people.value, selectedPersonId.value))
  const upcomingEvents = computed(() => getUpcomingEvents(data.value))

  function initialiseSelection() {
    selectedGenealogyId.value =
      data.value?.activeGenealogyId || genealogies.value[0]?.id || ''
    selectedPersonId.value = ''
  }

  function selectGenealogy(id) {
    selectedGenealogyId.value = id
    selectedPersonId.value = ''
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
