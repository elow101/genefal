<template>
  <section class="people-list">
    <h2>Personnes</h2>

    <p v-if="people.length === 0">Aucune personne pour le moment.</p>

    <ul v-else>
      <li v-for="person in people" :key="person.id">
        <strong>{{ person.name }}</strong>
        <span v-if="person.genealogyName"> — {{ person.genealogyName }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup>
defineProps({
  people: {
    type: Array,
    required: true,
  },
})
</script>

<style scoped>
.people-list {
  margin-top: 24px;
}

ul {
  padding-left: 20px;
}

li {
  margin-bottom: 8px;
}

span {
  color: #666;
}
</style>
