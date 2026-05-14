import { computed, onMounted, ref } from 'vue'
import { fetchGenealogyState } from '../api/genealogyApi.js'

export function useGenealogyData() {
  const loading = ref(true)
  const error = ref('')
  const data = ref(null)
  const selectedGenealogyId = ref('')

  const genealogies = computed(() => data.value?.genealogies || [])

  const selectedGenealogy = computed(() => {
    return (
      genealogies.value.find((genealogy) => genealogy.id === selectedGenealogyId.value) ||
      genealogies.value[0] ||
      null
    )
  })

  const upcomingEvents = computed(() => data.value?.upcomingBaptisms || [])

  const people = computed(() => {
    if (selectedGenealogy.value) {
      return (selectedGenealogy.value.people || []).map((person) => ({
        ...person,
        genealogyName: selectedGenealogy.value.name,
      }))
    }

    return data.value?.people || []
  })

  function selectGenealogy(id) {
    selectedGenealogyId.value = id
  }

  onMounted(async () => {
    try {
      data.value = await fetchGenealogyState()
      selectedGenealogyId.value = data.value.activeGenealogyId || data.value.genealogies?.[0]?.id || ''
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  })

  return {
    loading,
    error,
    data,
    genealogies,
    selectedGenealogyId,
    selectedGenealogy,
    upcomingEvents,
    people,
    selectGenealogy,
  }
}
