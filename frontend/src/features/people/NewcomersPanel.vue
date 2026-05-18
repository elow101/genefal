<template>
  <section class="newcomers-panel">
    <p v-if="newcomers.length === 0" class="empty">Aucun baptême renseigné pour le moment.</p>
    <div v-else class="newcomers-grid">
      <button
        v-for="person in newcomers"
        :key="person.id"
        type="button"
        class="node-card newcomer-card"
        :style="filiereStyle(person)"
        @click="$emit('select', person.id)"
      >
        <strong>{{ person.name }}</strong>
        <span class="node-info">
          <span>{{ filiereLabel(person.filiere) || 'Filière non renseignée' }}</span>
          <span>{{ formatDate(person.baptismDate) }}</span>
          <span v-if="person.nickname">{{ person.nickname }}</span>
        </span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { filiereLabel, filiereStyle } from '../../domain/filiere.js'

const props = defineProps({ people: { type: Array, required: true } })
defineEmits(['select'])

const newcomers = computed(() =>
  [...props.people]
    .filter((person) => person.baptismDate)
    .sort((a, b) => String(a.baptismDate).localeCompare(String(b.baptismDate)))
    .slice(-10),
)

function formatDate(value) {
  if (!value) return 'Date inconnue'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date)
}
</script>
