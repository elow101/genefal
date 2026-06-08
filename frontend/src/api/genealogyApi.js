import { migrateGenealogyState } from '../domain/schema.js'
import { jsonHeaders, requestJson } from './http.js'

const backendLoginUrl = 'http://127.0.0.1:8765/'

class ApiError extends Error {
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

export async function fetchGenealogySummary() {
  try {
    return migrateGenealogyState(await requestJson('/api/genealogy.php?summary=1'))
  } catch (error) {
    throw new ApiError(error.message, { status: error.status || 0 })
  }
}

export function saveGenealogyState(payload, csrfToken) {
  const migrated = migrateGenealogyState(payload)
  restoreDuplicateCreationFlags(migrated, payload)
  return requestJson('/api/genealogy.php', {
    method: 'POST',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify(migrated),
  })
}

function restoreDuplicateCreationFlags(migrated, original) {
  const forcedIds = new Set()
  for (const genealogy of original?.genealogies || []) {
    for (const person of genealogy?.people || []) {
      if (person?._forceDuplicateCreation && person.id) {
        forcedIds.add(person.id)
      }
    }
  }
  if (!forcedIds.size) return

  for (const genealogy of migrated?.genealogies || []) {
    for (const person of genealogy?.people || []) {
      if (forcedIds.has(person.id)) {
        person._forceDuplicateCreation = true
      }
    }
  }
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
