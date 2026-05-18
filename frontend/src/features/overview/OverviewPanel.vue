<template>
  <section class="overview-panel">
    <p v-if="groups.length === 0" class="empty">Aucune personne à afficher.</p>
    <div v-else class="overview-groups">
      <section v-for="group in groups" :key="group.label" class="overview-tree">
        <h3>{{ group.label }} <span>{{ group.people.length }}</span></h3>
        <div class="overview-list">
          <button
            v-for="person in group.people"
            :key="person.id"
            type="button"
            class="node-card"
            :style="filiereStyle(person)"
            @click="$emit('select', person.id)"
          >
            <strong>{{ displayName(person) }}</strong>
            <span class="node-info">
              <span>{{ filiereLabel(person.filiere) || 'Filière non renseignée' }}</span>
              <span>{{ person.song || 'Informations à compléter' }}</span>
            </span>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { filiereLabel, filiereStyle } from '../../domain/filiere.js'
import { displayName } from '../../domain/graph.js'

const props = defineProps({ people: { type: Array, required: true } })
defineEmits(['select'])

const groups = computed(() => {
  const map = new Map()
  props.people.forEach((person) => {
    const label = filiereLabel(person.filiere) || 'Non renseignée'
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(person)
  })
  return [...map.entries()]
    .map(([label, people]) => ({
      label,
      people: [...people].sort((a, b) => displayName(a).localeCompare(displayName(b), 'fr')),
    }))
    .sort((a, b) => (a.label === 'Non renseignée' ? 1 : b.label === 'Non renseignée' ? -1 : a.label.localeCompare(b.label, 'fr')))
})
</script>
