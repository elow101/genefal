<template>
  <section class="upcoming">
    <h2>Événements à venir</h2>

    <p v-if="events.length === 0">Aucun événement à venir pour le moment.</p>

    <ul v-else>
      <li v-for="event in events" :key="event.id">
        <strong>{{ eventLabel(event) }}</strong>
        <span>{{ event.dateTime || 'Date à définir' }}</span>
        <PeopleList :people="people" />
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
  if (event.eventType === 'cooptage') {
    return 'Cooptage à venir'
  }

  return 'Baptême à venir'
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
  color: #666;
}
</style>
