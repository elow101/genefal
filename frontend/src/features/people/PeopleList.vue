<template>
  <section class="people-list">
    <h2>Personnes</h2>

    <p v-if="people.length === 0" class="empty">Aucune personne pour le moment.</p>

    <ul v-else>
      <li v-for="person in visiblePeople" :key="person.id">
        <button
          type="button"
          :class="{ selected: person.id === selectedPersonId }"
          @click="$emit('select', person.id)"
        >
          <strong>{{ person.name }}</strong>
          <span v-if="person.genealogyName"> — {{ person.genealogyName }}</span>
        </button>
      </li>
    </ul>
    <button v-if="visiblePeople.length < people.length" class="load-more" type="button" @click="limit += 30">
      Afficher plus de fiches
    </button>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  people: {
    type: Array,
    required: true,
  },
  selectedPersonId: {
    type: String,
    default: '',
  },
})

defineEmits(['select'])

const limit = ref(60)
const visiblePeople = computed(() => props.people.slice(0, limit.value))
</script>

<style scoped>
.people-list {
  margin-top: 24px;
}

ul {
  padding-left: 0;
  list-style: none;
}

li {
  margin-bottom: 8px;
}

button {
  width: 100%;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel);
  color: var(--text);
  padding: 14px 16px;
  cursor: pointer;
}

button:hover,
button.selected {
  border-color: var(--accent);
  background: var(--panel-strong);
}

span {
  color: var(--muted);
}

.load-more {
  margin-top: 8px;
  border-color: var(--accent);
}
</style>
