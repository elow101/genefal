<template>
  <section class="overview-panel">
    <div class="profile-filters" aria-label="Filtres des profils">
      <label>
        Filiere
        <select v-model="filiereFilter">
          <option value="">Toutes</option>
          <option v-for="option in filiereOptions" :key="option.id" :value="option.id">
            {{ option.label }}
          </option>
          <option value="unknown">Non renseignee</option>
        </select>
      </label>
      <label>
        Bapteme
        <select v-model="baptismFilter">
          <option value="">Tous</option>
          <option value="dated">Date renseignee</option>
          <option value="unbaptized">Pas encore baptise</option>
          <option value="unknown">Date inconnue</option>
        </select>
      </label>
    </div>

    <p v-if="groups.length === 0" class="empty">Aucune personne a afficher avec ces filtres.</p>
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
              <span>{{ filiereLabel(person.filiere) || 'Filiere non renseignee' }}</span>
              <span>{{ person.song || 'Informations a completer' }}</span>
            </span>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { filiereLabel, filiereOptions, filiereStyle } from '../../domain/filiere.js'
import { displayName } from '../../domain/graph.js'

const props = defineProps({ people: { type: Array, required: true } })
defineEmits(['select'])

const filiereFilter = ref('')
const baptismFilter = ref('')

const filteredPeople = computed(() =>
  props.people.filter((person) => {
    const matchesFiliere =
      !filiereFilter.value ||
      (filiereFilter.value === 'unknown' ? !person.filiere : person.filiere === filiereFilter.value)
    const matchesBaptism =
      !baptismFilter.value ||
      (baptismFilter.value === 'dated'
        ? Boolean(person.baptismDate)
        : (person.baptismStatus || 'unknown') === baptismFilter.value)
    return matchesFiliere && matchesBaptism
  }),
)

const groups = computed(() => {
  const map = new Map()
  filteredPeople.value.forEach((person) => {
    const label = filiereLabel(person.filiere) || 'Non renseignee'
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(person)
  })
  return [...map.entries()]
    .map(([label, people]) => ({
      label,
      people: [...people].sort((a, b) => displayName(a).localeCompare(displayName(b), 'fr')),
    }))
    .sort((a, b) => (a.label === 'Non renseignee' ? 1 : b.label === 'Non renseignee' ? -1 : a.label.localeCompare(b.label, 'fr')))
})
</script>
