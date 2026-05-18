<template>
  <section class="person-picker">
    <label>
      {{ label }}
      <input
        v-model="query"
        type="search"
        :placeholder="placeholder"
        autocomplete="off"
      />
    </label>

    <div v-if="selectedPeople.length" class="chip-list">
      <button
        v-for="person in selectedPeople"
        :key="person.id"
        class="chip chip-button"
        type="button"
        @click="remove(person.id)"
      >
        {{ person.name }} ×
      </button>
    </div>

    <div v-if="results.length" class="picker-results">
      <button
        v-for="person in results"
        :key="person.id"
        type="button"
        @click="add(person.id)"
      >
        <strong>{{ person.name }}</strong>
        <span v-if="person.nickname">{{ person.nickname }}</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  people: { type: Array, required: true },
  modelValue: { type: Array, required: true },
  placeholder: { type: String, default: 'Rechercher une personne' },
})

const emit = defineEmits(['update:modelValue'])
const query = ref('')

const selectedPeople = computed(() =>
  props.modelValue.map((id) => props.people.find((person) => person.id === id)).filter(Boolean),
)
const results = computed(() => {
  const search = query.value.trim().toLowerCase()
  if (!search) return []
  return props.people
    .filter((person) => !props.modelValue.includes(person.id))
    .filter((person) =>
      [person.name, person.nickname]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search)),
    )
    .slice(0, 8)
})

function add(personId) {
  emit('update:modelValue', [...props.modelValue, personId])
  query.value = ''
}

function remove(personId) {
  emit(
    'update:modelValue',
    props.modelValue.filter((id) => id !== personId),
  )
}
</script>
