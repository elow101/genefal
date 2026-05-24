<template>
  <article class="upcoming-card" :id="`event-${event.id}`">
    <div class="upcoming-card-main">
      <div class="upcoming-card-title">
        <strong>{{ title }}</strong>
        <span>{{ eventTypeLabel(event.eventType) }}</span>
      </div>
      <p>{{ formatUpcomingDateTime(event.dateTime) }}<template v-if="event.place"> - {{ event.place }}</template></p>
      <p v-if="regionName">Region : {{ regionName }}</p>
      <p v-if="event.creatorName">Createur : {{ event.creatorName }}</p>
      <p v-if="sponsorNames">{{ sponsorLabel }} : {{ sponsorNames }}</p>
      <p v-if="concernedNames">Concerne(s) : {{ concernedNames }}</p>
      <p v-if="event.message">{{ event.message }}</p>
      <small v-if="eventRequiresParticipation(event.eventType)">
        {{ event.requests?.length || 0 }} demande(s)
      </small>
    </div>

    <div class="upcoming-card-actions">
      <button
        v-if="eventRequiresParticipation(event.eventType)"
        type="button"
        :disabled="Boolean(participationStatus)"
        @click="$emit('request', event.id)"
      >
        {{ requestButtonLabel }}
      </button>
      <button type="button" class="text-button" @click="$emit('manage', event.id)">Gestion createur</button>
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
import { eventRequiresParticipation, eventTypeLabel, formatUpcomingDateTime, requestStatusLabel } from '../../domain/upcoming.js'

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

const title = computed(() => props.event.title || props.event.baptizedNames?.join(', ') || concernedNames.value || 'Evenement')

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
    : 'Demander a participer',
)
</script>
