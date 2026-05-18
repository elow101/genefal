import { onMounted, ref } from 'vue'
import { fetchAuthState, fetchGenealogyState, saveGenealogyState } from '../api/genealogyApi.js'
import {
  appendGenealogy,
  createGenealogy,
  removeGenealogy,
  updateGenealogy,
} from '../domain/genealogy.js'
import { useGenealogySelection } from './useGenealogySelection.js'
import { usePeopleMutations } from './usePeopleMutations.js'
import { useUpcomingEvents } from './useUpcomingEvents.js'

export function useGenealogyData() {
  const loading = ref(true)
  const error = ref('')
  const loginUrl = ref('http://127.0.0.1:8765/')
  const csrfToken = ref('')
  const saving = ref(false)
  const data = ref(null)
  const selection = useGenealogySelection(data)
  const peopleMutations = usePeopleMutations({
    data,
    selectedGenealogy: selection.selectedGenealogy,
    selectedPersonId: selection.selectedPersonId,
  })
  const upcoming = useUpcomingEvents({
    data,
    selectedGenealogy: selection.selectedGenealogy,
  })

  function addGenealogy({ name, type, parentId }) {
    const genealogy = createGenealogy(name, type, parentId)
    data.value = appendGenealogy(data.value, genealogy)
    selection.selectGenealogy(genealogy.id)
  }

  function deleteGenealogy(genealogyId) {
    data.value = removeGenealogy(data.value, genealogyId)
    selection.initialiseSelection()
  }

  function patchGenealogy(genealogyId, patch) {
    data.value = updateGenealogy(data.value, genealogyId, patch)
  }

  async function save() {
    if (!data.value) return false

    saving.value = true
    error.value = ''

    try {
      const result = await saveGenealogyState(data.value, csrfToken.value)

      if (result.state) {
        data.value = result.state
      }
      return true
    } catch (err) {
      error.value = err.message
      return false
    } finally {
      saving.value = false
    }
  }

  onMounted(async () => {
    try {
      const auth = await fetchAuthState()

      if (!auth.authenticated) {
        throw new Error(
          'Session absente. Ouvre http://127.0.0.1:8765/ pour te connecter, puis recharge http://127.0.0.1:5173/.',
        )
      }
      csrfToken.value = auth.csrfToken || ''

      data.value = await fetchGenealogyState()
      selection.initialiseSelection()
    } catch (err) {
      error.value = err.message
      if (err.loginUrl) loginUrl.value = err.loginUrl
    } finally {
      loading.value = false
    }
  })

  return {
    loading,
    saving,
    error,
    loginUrl,
    csrfToken,
    data,
    ...selection,
    ...peopleMutations,
    upcoming,
    addGenealogy,
    deleteGenealogy,
    patchGenealogy,
    save,
  }
}
