import { computed, ref } from 'vue'
import {
  addAttendanceRequest,
  appendUpcomingEvent,
  createUpcomingEvent,
  getUpcomingEventsForRegion,
  normaliseNames,
  removeUpcomingEvent,
} from '../domain/upcoming.js'

export function useUpcomingEvents({ data, selectedGenealogy }) {
  const selectedEventIds = ref([])

  const regionId = computed(() => resolveUpcomingRegionId(data.value?.genealogies || [], selectedGenealogy.value))
  const region = computed(
    () => (data.value?.genealogies || []).find((genealogy) => genealogy.id === regionId.value) || null,
  )
  const events = computed(() => getUpcomingEventsForRegion(data.value, regionId.value))

  function createEvent(draft) {
    if (!regionId.value) return false
    const event = createUpcomingEvent({
      regionId: regionId.value,
      eventType: draft.eventType,
      sponsorIds: draft.sponsorIds,
      fillotIds: draft.fillotIds,
      baptizedNames: normaliseNames(draft.baptizedNames),
      dateTime: draft.dateTime,
      place: draft.place,
      message: draft.message,
    })

    data.value = appendUpcomingEvent(data.value, event)
    return true
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

  function requestAttendance({ name, nickname }) {
    if (!selectedEventIds.value.length) return false

    data.value = addAttendanceRequest(data.value, selectedEventIds.value, {
      name: String(name || '').trim(),
      nickname: String(nickname || '').trim(),
    })
    selectedEventIds.value = []
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
  }
}

function resolveUpcomingRegionId(genealogies, selectedGenealogy) {
  if (!selectedGenealogy) return ''
  if (selectedGenealogy.type === 'region') return selectedGenealogy.id
  if (selectedGenealogy.type === 'family') return selectedGenealogy.parentId || ''
  return ''
}
