import { jsonHeaders, requestJson } from './http.js'

export function fetchDoleancesState() {
  return requestJson('/api/doleances.php')
}

export function createDoleance(payload, csrfToken) {
  return requestJson('/api/doleances.php', {
    method: 'POST',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify(payload),
  })
}

export function saveDoleancesState(doleances, csrfToken) {
  return requestJson('/api/doleances.php', {
    method: 'PUT',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify({ doleances }),
  })
}
