import { ref } from 'vue'
import {
  changeRegionPassword,
  fetchAdminState,
  loginAdmin,
  logoutAdmin,
} from '../api/adminApi.js'
import { fetchAuthState } from '../api/genealogyApi.js'

export function useAdmin(csrfToken) {
  const loading = ref(false)
  const error = ref('')
  const session = ref(null)

  async function refresh() {
    loading.value = true
    error.value = ''
    try {
      const result = await fetchAdminState()
      session.value = result.admin?.authenticated ? result.admin : null
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function login(password) {
    loading.value = true
    error.value = ''
    try {
      const result = await loginAdmin(password, csrfToken.value)
      session.value = result.admin
      await refreshCsrfToken()
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    const result = await logoutAdmin(csrfToken.value)
    session.value = result.admin?.authenticated ? result.admin : null
    await refreshCsrfToken()
  }

  async function updateRegionPassword(regionId, password) {
    loading.value = true
    error.value = ''
    try {
      const result = await changeRegionPassword(regionId, password, csrfToken.value)
      session.value = result.admin
      await refreshCsrfToken()
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function refreshCsrfToken() {
    const auth = await fetchAuthState()
    csrfToken.value = auth.csrfToken || csrfToken.value
  }

  return {
    loading,
    error,
    session,
    refresh,
    login,
    logout,
    updateRegionPassword,
  }
}
