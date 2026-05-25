import { onMounted, ref } from 'vue'
import { fetchAuthState, fetchGenealogyState, saveGenealogyState, undoPublicSessionAction } from '../api/genealogyApi.js'
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
  const sessionActions = ref([])
  const lastSavedSnapshot = ref('')
  let activeSavePromise = null
  let saveQueuedDuringFlight = false
  const selection = useGenealogySelection(data)
  const peopleMutations = usePeopleMutations({
    data,
    selectedGenealogy: selection.selectedGenealogy,
    selectedPersonId: selection.selectedPersonId,
  })
  const upcoming = useUpcomingEvents({
    data,
    csrfToken,
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

  function replaceState(nextState) {
    data.value = nextState
    markStateAsSaved()
    selection.initialiseSelection()
  }

  function stateSnapshot() {
    return JSON.stringify(data.value || null)
  }

  function markStateAsSaved() {
    lastSavedSnapshot.value = stateSnapshot()
  }

  async function save() {
    if (!data.value) return false

    if (activeSavePromise) {
      saveQueuedDuringFlight = true
      return activeSavePromise
    }

    activeSavePromise = runSaveQueue()
    try {
      return await activeSavePromise
    } finally {
      activeSavePromise = null
    }
  }

  async function runSaveQueue() {
    saving.value = true
    error.value = ''
    let saved = true

    try {
      do {
        saveQueuedDuringFlight = false
        const result = await saveCurrentState()
        saved = saved && result
        if (!result) return false
      } while (saveQueuedDuringFlight && stateSnapshot() !== lastSavedSnapshot.value)

      return saved
    } finally {
      saving.value = false
    }
  }

  async function saveCurrentState() {
    const snapshot = stateSnapshot()
    if (snapshot === lastSavedSnapshot.value) {
      return true
    }

    try {
      const result = await saveGenealogyState(data.value, csrfToken.value)
      const hasLocalChangesSinceRequest = stateSnapshot() !== snapshot

      if (result.state && !hasLocalChangesSinceRequest) {
        data.value = result.state
      }
      lastSavedSnapshot.value = hasLocalChangesSinceRequest ? snapshot : stateSnapshot()
      sessionActions.value = result.sessionActions || []
      return true
    } catch (err) {
      error.value = err.message
      return false
    }
  }

  async function undoSessionAction(actionId) {
    saving.value = true
    error.value = ''

    try {
      const result = await undoPublicSessionAction(actionId, csrfToken.value)
      if (result.state) {
        data.value = result.state
        selection.initialiseSelection()
      }
      markStateAsSaved()
      sessionActions.value = result.sessionActions || []
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
      const [authResult, stateResult] = await Promise.allSettled([fetchAuthState(), fetchGenealogyState()])
      const auth = authResult.status === 'fulfilled' ? authResult.value : { authenticated: false }

      if (!auth.authenticated) {
        throw new Error(
          'Session absente. Ouvre http://127.0.0.1:8765/ pour te connecter, puis recharge http://127.0.0.1:5173/.',
        )
      }
      csrfToken.value = auth.csrfToken || ''

      if (stateResult.status === 'rejected') throw stateResult.reason
      data.value = stateResult.value
      markStateAsSaved()
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
    sessionActions,
    ...selection,
    ...peopleMutations,
    upcoming,
    addGenealogy,
    deleteGenealogy,
    patchGenealogy,
    replaceState,
    save,
    undoSessionAction,
  }
}
