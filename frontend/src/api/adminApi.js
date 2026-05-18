import { jsonHeaders, requestJson } from './http.js'

export function fetchAdminState() {
  return requestJson('/api/admin.php')
}

export async function loginAdmin(password, csrfToken) {
  return postAdmin({ action: 'login', password }, csrfToken)
}

export async function logoutAdmin(csrfToken) {
  return postAdmin({ action: 'logout' }, csrfToken)
}

export async function changeRegionPassword(regionId, password, csrfToken) {
  return postAdmin({ action: 'change-region-password', regionId, password }, csrfToken)
}

async function postAdmin(payload, csrfToken) {
  return requestJson('/api/admin.php', {
    method: 'POST',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify(payload),
  })
}
