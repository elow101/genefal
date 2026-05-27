<template>
  <article class="upcoming-card" :id="`event-${event.id}`">
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

      <dl class="event-meta">
        <div v-if="event.place">
          <dt>Lieu</dt>
          <dd>{{ event.place }}</dd>
        </div>
        <div v-if="scopeLabelText">
          <dt>Portée</dt>
          <dd>{{ scopeLabelText }}</dd>
        </div>
        <div v-if="regionName && event.scope !== 'national'">
          <dt>Région</dt>
          <dd>{{ regionName }}</dd>
        </div>
        <div v-if="event.creatorName">
          <dt>Créateur</dt>
          <dd>{{ event.creatorName }}</dd>
        </div>
        <div v-if="sponsorNames">
          <dt>{{ sponsorLabel }}</dt>
          <dd>{{ sponsorNames }}</dd>
        </div>
        <div v-if="concernedNames">
          <dt>Concerné(s)</dt>
          <dd>{{ concernedNames }}</dd>
        </div>
      </dl>

      <p v-if="event.message" class="event-message">{{ event.message }}</p>

      <div v-if="event.eventUrl" class="event-link">
        <a
          :href="event.eventUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="primary-action"
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
        @click="$emit('request', event.id)"
      >
        {{ requestButtonLabel }}
      </button>
      <button type="button" class="text-button" @click="$emit('manage', event.id)">Gestion créateur</button>
      <button
        v-if="canDelete"
        class="text-button danger-text"
        type="button"
        @click="$emit('delete', event.id)"
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
</script>
