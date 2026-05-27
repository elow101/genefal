import { jsonHeaders, requestJson } from './http.js'

export function createUpcomingEvent(payload, csrfToken) {
  return upcomingRequest({ action: 'create_event', ...payload }, csrfToken)
}

export function requestUpcomingParticipation(payload, csrfToken) {
  return upcomingRequest({ action: 'request_participation', ...payload }, csrfToken)
}

export function accessUpcomingCreator(payload, csrfToken) {
  return upcomingRequest({ action: 'creator_access', ...payload }, csrfToken)
}

export function manageUpcomingRequest(payload, csrfToken) {
  return upcomingRequest({ action: 'manage_request', ...payload }, csrfToken)
}

export function updateUpcomingEvent(payload, csrfToken) {
  return upcomingRequest({ action: 'update_event', ...payload }, csrfToken)
}

export function deleteUpcomingEvent(payload, csrfToken) {
  return upcomingRequest({ action: 'delete_event', ...payload }, csrfToken)
}

export function subscribeUpcomingRegion(payload, csrfToken) {
  return upcomingRequest({ action: 'subscribe_region', ...payload }, csrfToken)
}

export function unsubscribeUpcomingRegion(payload, csrfToken) {
  return upcomingRequest({ action: 'unsubscribe_region', ...payload }, csrfToken)
}

function upcomingRequest(payload, csrfToken) {
  if (payload.action === 'create_event' || payload.action === 'update_event') {
    console.log('Payload événement envoyé à upcoming.php:', payload)
  }
  return requestJson('/api/upcoming.php', {
    method: 'POST',
    headers: jsonHeaders(csrfToken),
    body: JSON.stringify(payload),
  })
}
