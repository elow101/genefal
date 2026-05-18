<template>
  <article class="upcoming-card">
    <div class="upcoming-card-main">
      <div class="upcoming-card-title">
        <strong>{{ title }}</strong>
        <span>{{ eventTypeLabel(event.eventType) }}</span>
      </div>
      <p>{{ formatUpcomingDateTime(event.dateTime) }}<template v-if="event.place"> · {{ event.place }}</template></p>
      <p>{{ sponsorLabel }} : {{ sponsorNames || 'non renseigné' }}</p>
      <p v-if="event.message">{{ event.message }}</p>
      <small>{{ event.requests?.length || 0 }} demande(s)</small>
    </div>

    <label class="upcoming-card-check">
      <span>Sélectionner</span>
      <input
        type="checkbox"
        :checked="selected"
        @change="$emit('toggle', event.id)"
      />
    </label>

    <button
      v-if="canDelete"
      class="text-button danger-text upcoming-card-delete"
      type="button"
      @click="$emit('delete', event.id)"
    >
      Supprimer
    </button>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { eventTypeLabel, formatUpcomingDateTime } from '../../domain/upcoming.js'

const props = defineProps({
  event: {
    type: Object,
    required: true,
  },
  people: {
    type: Array,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  cooptageRoleLabel: {
    type: String,
    default: 'TVA',
  },
  canDelete: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['toggle', 'delete'])

const title = computed(() => {
  if (props.event.baptizedNames?.length) return props.event.baptizedNames.join(', ')

  const concerned = (props.event.fillotIds || [])
    .map((id) => props.people.find((person) => person.id === id)?.name)
    .filter(Boolean)

  return concerned.join(', ') || 'Personnes à confirmer'
})

const sponsorNames = computed(() =>
  (props.event.sponsorIds || [])
    .map((id) => props.people.find((person) => person.id === id)?.name)
    .filter(Boolean)
    .join(', '),
)
const sponsorLabel = computed(() =>
  props.event.eventType === 'cooptage' ? props.cooptageRoleLabel : 'Parrain(s) / marraine(s)',
)
</script>
