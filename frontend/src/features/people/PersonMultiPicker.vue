<template>
  <section class="person-picker">
    <label>
      {{ label }}
      <input
        v-model="query"
        type="search"
        :placeholder="placeholder"
        autocomplete="off"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.enter.prevent="selectActive"
      />
    </label>

    <div v-if="selectedPeople.length" class="chip-list">
      <button
        v-for="person in selectedPeople"
        :key="person.id"
        class="chip chip-button"
        type="button"
        :aria-label="`Retirer ${person.name}`"
        @click="remove(person.id)"
      >
        {{ person.name }} x
      </button>
    </div>

    <p v-if="loading" class="field-hint">Chargement des fiches...</p>
    <p v-else-if="query.trim() && blockedMatches.length" class="field-error">{{ blockedMessage }}</p>
    <p v-else-if="query.trim() && results.length === 0" class="empty">Aucun résultat trouvé.</p>

    <div v-if="results.length" class="picker-results" role="listbox">
      <button
        v-for="(person, index) in results"
        :key="person.id"
        type="button"
        :class="{ 'is-active': index === activeIndex }"
        role="option"
        @click="add(person.id)"
      >
        <strong>{{ person.name }}</strong>
        <span v-if="displayNickname(person)">{{ displayNickname(person) }}</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { personMatchesSearch } from '../../domain/search.js'

const props = defineProps({
  label: { type: String, required: true },
  people: { type: Array, required: true },
  modelValue: { type: Array, required: true },
  placeholder: { type: String, default: 'Rechercher une personne' },
  blockedIds: { type: Array, default: () => [] },
  blockedMessage: { type: String, default: 'Cette relation est incoherente.' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const query = ref('')
const activeIndex = ref(0)

const selectedPeople = computed(() =>
  props.modelValue.map((id) => props.people.find((person) => person.id === id)).filter(Boolean),
)
const results = computed(() => {
  const search = query.value.trim()
  if (!search) return []
  return props.people
    .filter((person) => !props.modelValue.includes(person.id))
    .filter((person) => !props.blockedIds.includes(person.id))
    .filter((person) => personMatchesSearch(person, search))
    .slice(0, 8)
})
const blockedMatches = computed(() => {
  const search = query.value.trim()
  if (!search) return []
  return props.people
    .filter((person) => props.blockedIds.includes(person.id))
    .filter((person) => personMatchesSearch(person, search))
})

watch(results, () => {
  activeIndex.value = 0
})

function add(personId) {
  if (props.modelValue.includes(personId) || props.blockedIds.includes(personId)) return
  emit('update:modelValue', [...props.modelValue, personId])
  query.value = ''
}

function remove(personId) {
  emit(
    'update:modelValue',
    props.modelValue.filter((id) => id !== personId),
  )
}

function moveActive(direction) {
  if (!results.value.length) return
  activeIndex.value = (activeIndex.value + direction + results.value.length) % results.value.length
}

function selectActive() {
  const person = results.value[activeIndex.value]
  if (person) add(person.id)
}

function displayNickname(person) {
  return (person.nicknames || [person.nickname]).filter(Boolean).join(' / ')
}
</script>
