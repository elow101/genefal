function fallbackId(prefix = 'event') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function normaliseUpcomingEventType(value) {
  return ['adoption', 'confirmation', 'cooptage'].includes(value) ? value : 'bapteme'
}

export function normaliseDateTimeLocal(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s)(\d{2}:\d{2})/)
  return match ? `${match[1]}T${match[2]}` : ''
}

export function normaliseNames(value) {
  return [
    ...new Set(
      String(value || '')
        .split(/[\n,;]+/)
        .map((name) => name.trim().replace(/\s+/g, ' '))
        .filter(Boolean),
    ),
  ]
}

export function formatUpcomingDateTime(value) {
  if (!value) return 'Date à définir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function eventTypeLabel(value) {
  switch (normaliseUpcomingEventType(value)) {
    case 'adoption':
      return 'Adoption'
    case 'confirmation':
      return 'Confirmation'
    case 'cooptage':
      return 'Cooptage'
    default:
      return 'Baptême'
  }
}

export function createUpcomingEvent({
  regionId,
  eventType,
  sponsorIds,
  fillotIds = [],
  baptizedNames = [],
  dateTime,
  place = '',
  message = '',
}) {
  return {
    id: fallbackId(normaliseUpcomingEventType(eventType)),
    regionId,
    eventType: normaliseUpcomingEventType(eventType),
    sponsorIds: [...new Set(sponsorIds)],
    fillotIds: [...new Set(fillotIds)],
    baptizedNames: [...new Set(baptizedNames)],
    dateTime: normaliseDateTimeLocal(dateTime),
    place: String(place || '').trim(),
    message: String(message || '').trim(),
    createdAt: new Date().toISOString(),
    requests: [],
  }
}

export function getUpcomingEventsForRegion(state, regionId) {
  return (state?.upcomingBaptisms || [])
    .filter((event) => event.regionId === regionId)
    .slice()
    .sort((a, b) => String(a.dateTime).localeCompare(String(b.dateTime)))
}

export function appendUpcomingEvent(state, event) {
  return {
    ...state,
    upcomingBaptisms: [...(state?.upcomingBaptisms || []), event],
  }
}

export function removeUpcomingEvent(state, eventId) {
  return {
    ...state,
    upcomingBaptisms: (state?.upcomingBaptisms || []).filter((event) => event.id !== eventId),
  }
}

export function addAttendanceRequest(state, eventIds, request) {
  return {
    ...state,
    upcomingBaptisms: (state?.upcomingBaptisms || []).map((event) => {
      if (!eventIds.includes(event.id)) return event
      const requests = event.requests || []
      const alreadyExists = requests.some(
        (candidate) =>
          candidate.name === request.name && candidate.nickname === request.nickname,
      )

      return alreadyExists
        ? event
        : {
            ...event,
            requests: [
              ...requests,
              {
                id: fallbackId('demande'),
                ...request,
                createdAt: new Date().toISOString(),
              },
            ],
          }
    }),
  }
}
