<template>
  <article
    class="upcoming-card"
    :class="[eventAccentClass, { 'upcoming-card--clickable': Boolean(event.eventUrl) }]"
    :id="`event-${event.id}`"
    :tabindex="event.eventUrl ? 0 : undefined"
    @click="openEvent"
    @keydown.enter="openEvent"
  >
    <div class="upcoming-card-date" aria-hidden="true">
      <strong>{{ dateParts.day }}</strong>
      <span>{{ dateParts.month }}</span>
      <small>{{ dateParts.time }}</small>
    </div>

    <div class="upcoming-card-main">
      <div class="upcoming-card-title">
        <div>
          <strong>{{ title }}</strong>
          <p>{{ formatUpcomingDateTime(event.dateTime) }}</p>
        </div>
        <span v-if="isSoon" class="soon-badge">BIENTÔT</span>
        <button
          type="button"
          class="creator-action"
          aria-label="Gestion créateur"
          title="Gestion créateur"
          @click.stop="$emit('manage', event.id)"
        >
          <span aria-hidden="true">⚙</span>
          <span class="sr-only">Gestion créateur</span>
        </button>
      </div>

      <div class="badge-row" aria-label="Informations événement">
        <span
          v-for="badge in badges"
          :key="badge.label"
          class="event-badge"
          :class="`event-badge--${badge.tone}`"
        >
          {{ badge.label }}
        </span>
      </div>

      <div class="event-meta" aria-label="Détails événement">
        <p v-if="event.place || regionName || scopeLabelText" class="event-meta-line">
          <span class="event-meta-icon" aria-hidden="true">⌖</span>
          <span>{{ locationLine }}</span>
        </p>
        <p v-if="event.creatorName || event.message" class="event-meta-line">
          <span class="event-meta-icon" aria-hidden="true">◎</span>
          <span>{{ creatorLine }}</span>
        </p>
        <p v-if="sponsorNames || concernedNames" class="event-meta-line event-meta-line--people">
          <span class="event-meta-icon" aria-hidden="true">◇</span>
          <span>{{ peopleLine }}</span>
        </p>
      </div>

      <div v-if="event.eventUrl" class="event-link">
        <a
          :href="event.eventUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="primary-action"
          @click.stop
        >
          Voir l'événement
        </a>
      </div>

      <div v-if="canRequestParticipation(event)" class="event-request-summary">
        <strong>{{ event.requests?.length || 0 }}</strong>
        <span>demande(s)</span>
      </div>
    </div>

    <div class="upcoming-card-actions">
      <button
        v-if="canRequestParticipation(event)"
        type="button"
        class="primary-action"
        :disabled="Boolean(participationStatus)"
        @click.stop="$emit('request', event.id)"
      >
        {{ requestButtonLabel }}
      </button>
      <button
        v-if="canDelete"
        class="text-button danger-text"
        type="button"
        @click.stop="$emit('delete', event.id)"
      >
        Supprimer
      </button>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import {
  canRequestParticipation,
  eventBadges,
  formatUpcomingDateParts,
  formatUpcomingDateTime,
  requestStatusLabel,
  scopeLabel,
} from '../../domain/upcoming.js'

const props = defineProps({
  event: {
    type: Object,
    required: true,
  },
  people: {
    type: Array,
    required: true,
  },
  regionName: {
    type: String,
    default: '',
  },
  cooptageRoleLabel: {
    type: String,
    default: 'TVA',
  },
  canDelete: {
    type: Boolean,
    default: false,
  },
  participationStatus: {
    type: String,
    default: '',
  },
})

defineEmits(['request', 'manage', 'delete'])

const title = computed(() => props.event.title || props.event.baptizedNames?.join(', ') || concernedNames.value || 'Événement')
const dateParts = computed(() => formatUpcomingDateParts(props.event.dateTime))
const badges = computed(() => eventBadges(props.event))
const scopeLabelText = computed(() => scopeLabel(props.event.scope))
const eventAccentClass = computed(() => `upcoming-card--${normaliseEventType(props.event.eventType)}`)
const isSoon = computed(() => {
  const date = new Date(props.event.dateTime || '')
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  const soonLimit = new Date(now)
  soonLimit.setDate(now.getDate() + 3)
  return date >= now && date <= soonLimit
})

const sponsorNames = computed(() =>
  (props.event.sponsorIds || [])
    .map((id) => props.people.find((person) => person.id === id)?.name)
    .filter(Boolean)
    .join(', '),
)
const concernedNames = computed(() => {
  if (props.event.baptizedNames?.length) return props.event.baptizedNames.join(', ')
  return (props.event.fillotIds || [])
    .map((id) => props.people.find((person) => person.id === id)?.name)
    .filter(Boolean)
    .join(', ')
})
const sponsorLabel = computed(() =>
  props.event.eventType === 'cooptage' ? props.cooptageRoleLabel : 'Parrain(s) / marraine(s)',
)
const requestButtonLabel = computed(() =>
  props.participationStatus
    ? `Demande ${requestStatusLabel(props.participationStatus).toLowerCase()}`
    : 'Demander à participer',
)
const locationLine = computed(() =>
  [
    props.event.place,
    props.regionName && props.event.scope !== 'national' ? props.regionName : scopeLabelText.value,
  ]
    .filter(Boolean)
    .join(' · '),
)
const creatorLine = computed(() =>
  [props.event.creatorName ? `Créateur : ${props.event.creatorName}` : '', props.event.message]
    .filter(Boolean)
    .join(' · '),
)
const peopleLine = computed(() =>
  [
    sponsorNames.value ? `${sponsorLabel.value} : ${sponsorNames.value}` : '',
    concernedNames.value ? `Concerné(s) : ${concernedNames.value}` : '',
  ]
    .filter(Boolean)
    .join(' · '),
)

function normaliseEventType(value) {
  const type = String(value || '').trim().toLowerCase()
  return ['bapteme', 'adoption', 'confirmation', 'cooptage'].includes(type) ? type : 'autre'
}

function openEvent(event) {
  if (!props.event.eventUrl) return
  if (event?.target?.closest?.('a, button')) return
  window.open(props.event.eventUrl, '_blank', 'noopener,noreferrer')
}
</script>
