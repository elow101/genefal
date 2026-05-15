<template>
  <section class="upcoming">
    <h2>Événements à venir</h2>

    <p v-if="events.length === 0" class="empty">Aucun événement à venir pour le moment.</p>

    <ul v-else>
      <li v-for="event in events" :key="event.id">
        <strong>{{ eventLabel(event) }}</strong>
        <span>{{ formatDateTime(event.dateTime) }}</span>
        <small v-if="event.place">{{ event.place }}</small>
      </li>
    </ul>
  </section>
</template>

<script setup>
defineProps({
  events: {
    type: Array,
    required: true,
  },
})

function eventLabel(event) {
  if (event.eventType === 'cooptage') return 'Cooptage à venir'
  if (event.eventType === 'adoption') return 'Adoption à venir'
  if (event.eventType === 'confirmation') return 'Confirmation à venir'

  return 'Baptême à venir'
}

function formatDateTime(value) {
  if (!value) return 'Date à définir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
</script>

<style scoped>
.upcoming {
  margin-top: 24px;
}

ul {
  padding-left: 20px;
}

li {
  margin-bottom: 8px;
}

span {
  margin-left: 8px;
  color: var(--muted);
}

small {
  display: block;
  color: var(--muted);
}
</style>
