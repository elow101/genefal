const defaultHeaders = {
  Accept: 'application/json',
}

export async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || `Requête impossible. HTTP ${response.status}`)
    error.status = response.status
    throw error
  }

  return payload
}

export function jsonHeaders(csrfToken = '') {
  return {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
  }
}
