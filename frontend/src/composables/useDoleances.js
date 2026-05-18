import { ref } from 'vue'
import {
  createDoleance,
  fetchDoleancesState,
  saveDoleancesState,
} from '../api/doleancesApi.js'

export function useDoleances(csrfToken) {
  const loading = ref(false)
  const error = ref('')
  const items = ref([])

  async function loadAdminDoleances() {
    loading.value = true
    error.value = ''
    try {
      const result = await fetchDoleancesState()
      items.value = result.doleances || []
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function submitPublicDoleance(payload) {
    await createDoleance(payload, csrfToken.value)
  }

  async function setResolved(id, resolved) {
    items.value = items.value.map((item) =>
      item.id === id ? { ...item, status: resolved ? 'resolved' : 'pending' } : item,
    )
    await saveDoleancesState(items.value, csrfToken.value)
  }

  async function removeResolved() {
    const nextItems = items.value.filter((item) => item.status !== 'resolved')
    if (nextItems.length === items.value.length) return
    items.value = nextItems
    await saveDoleancesState(items.value, csrfToken.value)
  }

  return {
    loading,
    error,
    items,
    loadAdminDoleances,
    submitPublicDoleance,
    setResolved,
    removeResolved,
  }
}
