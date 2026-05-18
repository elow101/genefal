<template>
  <section class="sponsor-editor">
    <h2>{{ title }}</h2>

    <p v-if="!person" class="empty">Sélectionne une personne pour gérer cette relation.</p>

    <template v-else>
      <p v-if="selectedPeople.length === 0" class="empty">Aucune personne renseignée.</p>

      <ul v-else>
        <li v-for="selected in selectedPeople" :key="selected.id">
          <span>{{ selected.name }}</span>
          <button type="button" @click="removePerson(selected.id)">Retirer</button>
        </li>
      </ul>

      <div class="sponsor-editor-controls">
        <label>
          Ajouter une personne
          <select v-model="selectedId">
            <option value="">Choisir une personne</option>
            <option v-for="candidate in candidates" :key="candidate.id" :value="candidate.id">
              {{ candidate.name }}
            </option>
          </select>
        </label>

        <button type="button" :disabled="!selectedId" @click="addPerson">Ajouter</button>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: 'Relations',
  },
  field: {
    type: String,
    required: true,
    validator(value) {
      return ['sponsorIds', 'heartSponsorIds', 'fillotIds'].includes(value)
    },
  },
  person: {
    type: Object,
    default: null,
  },
  people: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['update'])
const selectedId = ref('')
const selectedIds = computed(() => {
  if (!props.person) return []
  if (props.field === 'fillotIds') {
    return props.people
      .filter((candidate) => (candidate.sponsorIds || []).includes(props.person.id))
      .map((candidate) => candidate.id)
  }
  return props.person[props.field] || []
})
const selectedPeople = computed(() =>
  selectedIds.value
    .map((id) => props.people.find((person) => person.id === id))
    .filter(Boolean),
)
const candidates = computed(() =>
  props.people.filter((candidate) => {
    if (!props.person) return false
    if (candidate.id === props.person.id) return false
    return !selectedIds.value.includes(candidate.id)
  }),
)

watch(
  () => props.person?.id,
  () => {
    selectedId.value = ''
  },
)

function addPerson() {
  if (!props.person || !selectedId.value) return

  if (props.field === 'fillotIds') {
    const fillot = props.people.find((candidate) => candidate.id === selectedId.value)
    if (!fillot) return
    emit('update', {
      ...fillot,
      sponsorIds: [...new Set([...(fillot.sponsorIds || []), props.person.id])],
    })
    selectedId.value = ''
    return
  }

  const nextSelectedIds = [...selectedIds.value, selectedId.value]
  const nextPerson = {
    ...props.person,
    [props.field]: nextSelectedIds,
  }

  if (props.field === 'heartSponsorIds') {
    nextPerson.sponsorIds = [...new Set([...(props.person.sponsorIds || []), selectedId.value])]
  }

  emit('update', nextPerson)
  selectedId.value = ''
}

function removePerson(personId) {
  if (!props.person) return

  if (props.field === 'fillotIds') {
    const fillot = props.people.find((candidate) => candidate.id === personId)
    if (!fillot) return
    emit('update', {
      ...fillot,
      sponsorIds: (fillot.sponsorIds || []).filter((id) => id !== props.person.id),
      heartSponsorIds: (fillot.heartSponsorIds || []).filter((id) => id !== props.person.id),
    })
    return
  }

  const nextPerson = {
    ...props.person,
    [props.field]: selectedIds.value.filter((id) => id !== personId),
  }

  if (props.field === 'sponsorIds') {
    nextPerson.heartSponsorIds = (props.person.heartSponsorIds || []).filter((id) => id !== personId)
  }

  emit('update', nextPerson)
}
</script>
