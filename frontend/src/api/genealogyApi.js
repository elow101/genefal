import { migrateGenealogyState } from '../domain/schema.js'
import { jsonHeaders, requestJson } from './http.js'

const backendLoginUrl = 'http://127.0.0.1:8765/'

export class ApiError extends Error {
  constructor(message, { status = 0, loginUrl = backendLoginUrl } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.loginUrl = loginUrl
  }
}

export async function fetchAuthState() {
  return requestJson('/api/auth.php').catch(() => ({ authenticated: false }))
}

export async function fetchGenealogyState() {
  try {
    return migrateGenealogyState(await requestJson('/api/genealogy.php'))
  } catch (error) {
    throw new ApiError(error.message, { status: error.status || 0 })
  }
}

export function saveGenealogyState(payload, csrfToken) {
  return requestJson('/api/genealogy.php', {
    method: 'POST',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify(migrateGenealogyState(payload)),
  })
}

export function scanPersonDuplicates(csrfToken) {
  return requestJson('/api/genealogy.php', {
    method: 'POST',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify({ action: 'scanPersonDuplicates' }),
  })
}

export function mergePersonDuplicates({ keepPersonId, mergePersonIds }, csrfToken) {
  return requestJson('/api/genealogy.php', {
    method: 'POST',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify({
      action: 'mergePersonDuplicates',
      keepPersonId,
      mergePersonIds,
    }),
  })
}

export function undoPublicSessionAction(actionId, csrfToken) {
  return requestJson('/api/genealogy.php', {
    method: 'POST',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify({
      action: 'undoPublicSessionAction',
      actionId,
    }),
  })
}
