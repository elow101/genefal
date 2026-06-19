import { jsonHeaders, requestJson } from './http.js'

const BASE_URL = '/api/idea_box.php'

export function listIdeaBoxProposals(filters = {}, voterToken = '') {
  const params = new URLSearchParams({ action: 'list' })
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value)
  })
  if (voterToken) params.set('voterToken', voterToken)
  return requestJson(`${BASE_URL}?${params}`)
}

export function getIdeaBoxProposal(slug, voterToken = '') {
  const params = new URLSearchParams({ action: 'detail', slug })
  if (voterToken) params.set('voterToken', voterToken)
  return requestJson(`${BASE_URL}?${params}`)
}

export function voteIdeaBoxProposal(payload) {
  return requestJson(`${BASE_URL}?action=vote`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  })
}

export function deleteIdeaBoxVote(proposalId, voterToken) {
  const params = new URLSearchParams({ action: 'vote', proposalId, voterToken })
  return requestJson(`${BASE_URL}?${params}`, { method: 'DELETE' })
}

export function createIdeaBoxSuggestion(payload) {
  return requestJson(`${BASE_URL}?action=suggest`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  })
}

export function loadIdeaBoxAdmin() {
  return requestJson(`${BASE_URL}?action=admin`)
}

export function saveIdeaBoxProposal(proposal, csrfToken) {
  return adminRequest({ adminAction: 'save_proposal', proposal }, csrfToken)
}

export function deleteIdeaBoxProposal(proposalId, csrfToken) {
  return adminRequest({ adminAction: 'delete_proposal', proposalId, confirm: 'SUPPRIMER' }, csrfToken)
}

export function updateIdeaBoxSuggestion(payload, csrfToken) {
  return adminRequest({ adminAction: 'update_suggestion', ...payload }, csrfToken)
}

export function deleteIdeaBoxSuggestion(suggestionId, csrfToken) {
  return adminRequest({ adminAction: 'delete_suggestion', suggestionId, confirm: 'SUPPRIMER' }, csrfToken)
}

export function convertIdeaBoxSuggestion(suggestionId, csrfToken) {
  return adminRequest({ adminAction: 'convert_suggestion', suggestionId }, csrfToken)
}

function adminRequest(payload, csrfToken) {
  return requestJson(`${BASE_URL}?action=admin`, {
    method: 'POST',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify(payload),
  })
}

export const IDEA_BOX_VOTER_STORAGE_KEY = 'genefaluche_idea_box_voter_id'

export function getOrCreateIdeaBoxVoterId() {
  try {
    const existing = window.localStorage.getItem(IDEA_BOX_VOTER_STORAGE_KEY)
    if (existing && /^[A-Za-z0-9_-]{32,160}$/.test(existing)) return existing
    const bytes = new Uint8Array(24)
    window.crypto.getRandomValues(bytes)
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    window.localStorage.setItem(IDEA_BOX_VOTER_STORAGE_KEY, token)
    return token
  } catch {
    const fallback = `${Date.now()}-${Math.random()}`.replace(/[^A-Za-z0-9_-]/g, '')
    return fallback.padEnd(32, '0')
  }
}
