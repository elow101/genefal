<template>
  <section class="upcoming">
    <div class="section-heading upcoming-region-head">
      <div>
        <h2>Événements à venir</h2>
        <p v-if="region">{{ events.length }} annonce(s) visible(s) dans {{ region.name }}.</p>
        <p v-else>Ouvre une faluche de région ou une famille pour voir les annonces.</p>
      </div>
    </div>

    <form v-if="region" class="attendance-form" @submit.prevent="submit">
      <h3>Demander à venir</h3>
      <div class="attendance-fields">
        <label>
          Nom
          <input v-model="attendance.name" required />
        </label>
        <label>
          Surnom
          <input v-model="attendance.nickname" />
        </label>
      </div>
      <p class="field-hint">Coche les annonces souhaitées dans la liste, puis envoie ta demande.</p>
      <button type="submit" :disabled="selectedEventIds.length === 0">Est-ce que je peux venir ?</button>
    </form>

    <p v-if="!region" class="empty">Aucune région active pour les événements à venir.</p>
    <p v-else-if="events.length === 0" class="empty">Aucune annonce pour {{ region.name }}.</p>

    <div v-else class="upcoming-list">
      <UpcomingCard
        v-for="event in events"
        :key="event.id"
        :event="event"
        :people="people"
        :selected="selectedEventIds.includes(event.id)"
        :cooptage-role-label="cooptageRoleLabel"
        :can-delete="canDelete"
        @toggle="$emit('toggle', $event)"
        @delete="$emit('delete', $event)"
      />
    </div>
  </section>
</template>

<script setup>
import { reactive } from 'vue'
import UpcomingCard from './UpcomingCard.vue'

defineProps({
  events: { type: Array, required: true },
  people: { type: Array, required: true },
  selectedEventIds: { type: Array, required: true },
  region: { type: Object, default: null },
  cooptageRoleLabel: { type: String, default: 'TVA' },
  canDelete: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle', 'delete', 'request'])
const attendance = reactive({ name: '', nickname: '' })

function submit() {
  emit('request', { ...attendance })
  attendance.name = ''
  attendance.nickname = ''
}
</script>
