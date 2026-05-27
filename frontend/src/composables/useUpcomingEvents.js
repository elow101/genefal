import { computed, ref } from 'vue'
import {
  accessUpcomingCreator,
  createUpcomingEvent as createUpcomingEventApi,
  deleteUpcomingEvent,
  manageUpcomingRequest,
  requestUpcomingParticipation,
  subscribeUpcomingRegion,
  unsubscribeUpcomingRegion,
  updateUpcomingEvent,
} from '../api/upcomingApi.js'
import {
  appendUpcomingEvent,
  createUpcomingEvent,
  getUpcomingEventsForContext,
  normaliseNames,
  removeUpcomingEvent,
} from '../domain/upcoming.js'

export function useUpcomingEvents({ data, csrfToken, selectedGenealogy }) {
  const selectedEventIds = ref([])

  const regionId = computed(() => resolveUpcomingRegionId(data.value?.genealogies || [], selectedGenealogy.value))
  const region = computed(
    () => (data.value?.genealogies || []).find((genealogy) => genealogy.id === regionId.value) || null,
  )
  const events = computed(() => getUpcomingEventsForContext(data.value, selectedGenealogy.value))

  async function createEvent(draft) {
    const event = createUpcomingEvent({
      regionId: regionId.value,
      eventType: draft.eventType,
      title: draft.title || draft.customType || '',
      sponsorIds: draft.sponsorIds,
      fillotIds: draft.fillotIds,
      baptizedNames: normaliseNames(draft.baptizedNames),
      dateTime: draft.dateTime,
      place: draft.place,
      message: draft.message,
      creatorName: draft.creatorName,
      visibility: draft.visibility,
      allowParticipation: draft.allowParticipation,
      scope: draft.scope,
      eventUrl: draft.eventUrl,
      familyId: draft.familyId || selectedGenealogy.value?.id || '',
      recurrence: draft.recurrence,
    })

    const result = await createUpcomingEventApi({
      ...event,
      creatorEmail: draft.creatorEmail,
    }, csrfToken.value)
    if (result.state) data.value = result.state
    else data.value = appendUpcomingEvent(data.value, result.event || event)
    return result
  }

  function deleteEvent(eventId) {
    data.value = removeUpcomingEvent(data.value, eventId)
    selectedEventIds.value = selectedEventIds.value.filter((id) => id !== eventId)
  }

  function toggleSelectedEvent(eventId) {
    selectedEventIds.value = selectedEventIds.value.includes(eventId)
      ? selectedEventIds.value.filter((id) => id !== eventId)
      : [...selectedEventIds.value, eventId]
  }

  async function requestAttendance(payload) {
    const eventId = payload.eventId || selectedEventIds.value[0]
    if (!eventId) return false
    const result = await requestUpcomingParticipation({ ...payload, eventId }, csrfToken.value)
    if (result.state) data.value = result.state
    selectedEventIds.value = []
    return true
  }

  async function subscribeRegion(payload) {
    if (!regionId.value) return false
    await subscribeUpcomingRegion({ ...payload, regionId: payload.regionId || regionId.value }, csrfToken.value)
    return true
  }

  async function unsubscribeRegion(payload) {
    if (!regionId.value) return false
    await unsubscribeUpcomingRegion({ ...payload, regionId: payload.regionId || regionId.value }, csrfToken.value)
    return true
  }

  async function creatorAccess(payload) {
    return accessUpcomingCreator(payload, csrfToken.value)
  }

  async function setRequestStatus(payload) {
    const result = await manageUpcomingRequest(payload, csrfToken.value)
    if (result.state) data.value = result.state
    return true
  }

  async function updateEvent(payload) {
    const result = await updateUpcomingEvent(payload, csrfToken.value)
    if (result.state) data.value = result.state
    return result.event || true
  }

  async function deleteEventAsCreator(payload) {
    const result = await deleteUpcomingEvent(payload, csrfToken.value)
    if (result.state) data.value = result.state
    selectedEventIds.value = selectedEventIds.value.filter((id) => id !== payload.eventId)
    return true
  }

  return {
    region,
    regionId,
    events,
    selectedEventIds,
    createEvent,
    deleteEvent,
    toggleSelectedEvent,
    requestAttendance,
    subscribeRegion,
    unsubscribeRegion,
    creatorAccess,
    setRequestStatus,
    updateEvent,
    deleteEventAsCreator,
  }
}

function resolveUpcomingRegionId(genealogies, selectedGenealogy) {
  if (!selectedGenealogy) return ''
  if (selectedGenealogy.type === 'region') return selectedGenealogy.id
  if (selectedGenealogy.type === 'family') return selectedGenealogy.parentId || ''
  return ''
}
