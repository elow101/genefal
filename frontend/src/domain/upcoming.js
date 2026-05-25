function fallbackId(prefix = 'event') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function normaliseUpcomingEventType(value) {
  const type = String(value || '').trim().toLowerCase()
  return ['bapteme', 'adoption', 'confirmation', 'cooptage'].includes(type) ? type : 'autre'
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

export function formatUpcomingDateParts(value) {
  if (!value) return { day: '--', month: 'Date', time: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: '--', month: value, time: '' }

  return {
    day: new Intl.DateTimeFormat('fr-FR', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date).replace('.', ''),
    time: new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date),
  }
}

export function eventTypeLabel(value) {
  switch (normaliseUpcomingEventType(value)) {
    case 'bapteme':
      return 'Baptême'
    case 'adoption':
      return 'Adoption'
    case 'confirmation':
      return 'Confirmation'
    case 'cooptage':
      return 'Cooptage'
    default:
      return 'Autre'
  }
}

export function normaliseUpcomingVisibility(value) {
  const visibility = String(value || '').trim().toLowerCase()
  return ['public', 'private', 'family'].includes(visibility) ? visibility : 'public'
}

export function visibilityLabel(value) {
  switch (normaliseUpcomingVisibility(value)) {
    case 'private':
      return 'Privé'
    case 'family':
      return 'Fillots/famille'
    default:
      return 'Public régional'
  }
}

export function eventRequiresParticipation(value) {
  return ['bapteme', 'adoption', 'confirmation'].includes(normaliseUpcomingEventType(value))
}

export function eventBadges(event) {
  const badges = [{ label: eventTypeLabel(event?.eventType), tone: 'type' }]
  const visibility = normaliseUpcomingVisibility(event?.visibility)
  badges.push({ label: visibilityLabel(visibility), tone: visibility === 'public' ? 'public' : 'private' })

  if (canRequestParticipation(event)) badges.push({ label: 'Participation ouverte', tone: 'success' })
  if (isTonight(event?.dateTime)) badges.push({ label: 'Ce soir', tone: 'time' })
  if (isNewUpcomingEvent(event)) badges.push({ label: 'Nouveau', tone: 'new' })

  return badges
}

export function isTonight(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return date.toDateString() === now.toDateString() && date.getHours() >= 18
}

export function isThisWeek(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  const weekEnd = new Date(now)
  weekEnd.setDate(now.getDate() + 7)
  weekEnd.setHours(23, 59, 59, 999)
  return date >= now && date <= weekEnd
}

export function isNewUpcomingEvent(event) {
  const created = new Date(event?.createdAt || '')
  if (Number.isNaN(created.getTime())) return false
  return Date.now() - created.getTime() < 1000 * 60 * 60 * 48
}

export function canRequestParticipation(event) {
  const type = normaliseUpcomingEventType(event?.eventType)
  return eventRequiresParticipation(type) || (type === 'autre' && event?.allowParticipation === true)
}

export function requestStatusLabel(value) {
  if (value === 'accepted') return 'Accepté'
  if (value === 'rejected') return 'Refusé'
  return 'En attente'
}

export function createUpcomingEvent({
  regionId,
  eventType,
  title = '',
  sponsorIds,
  fillotIds = [],
  baptizedNames = [],
  dateTime,
  place = '',
  message = '',
  creatorName = '',
  visibility = 'public',
  allowParticipation = false,
}) {
  const normalisedEventType = normaliseUpcomingEventType(eventType)
  return {
    id: fallbackId(normalisedEventType),
    regionId,
    title: String(title || '').trim(),
    eventType: normalisedEventType,
    allowParticipation: normalisedEventType === 'autre' && allowParticipation === true,
    sponsorIds: [...new Set(sponsorIds || [])],
    fillotIds: [...new Set(fillotIds)],
    baptizedNames: [...new Set(baptizedNames)],
    dateTime: normaliseDateTimeLocal(dateTime),
    place: String(place || '').trim(),
    message: String(message || '').trim(),
    creatorName: String(creatorName || '').trim(),
    visibility: normaliseUpcomingVisibility(visibility),
    createdAt: new Date().toISOString(),
    requests: [],
  }
}

export function getUpcomingEventsForRegion(state, regionId) {
  return (state?.upcomingBaptisms || [])
    .filter((event) => event.regionId === regionId)
    .slice()
    .sort((a, b) => String(a.dateTime).localeCompare(String(b.dateTime)) || String(a.title).localeCompare(String(b.title)))
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
      const alreadyExists = requests.some((candidate) => candidate.email === request.email)

      return alreadyExists
        ? event
        : {
            ...event,
            requests: [
              ...requests,
              {
                id: fallbackId('demande'),
                ...request,
                status: 'pending',
                createdAt: new Date().toISOString(),
              },
            ],
          }
    }),
  }
}
