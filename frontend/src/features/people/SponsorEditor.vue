<template>
  <section class="sponsor-editor">
    <h2>{{ title }}</h2>

    <p v-if="!person" class="empty">Sélectionne une personne pour gérer cette relation.</p>

    <template v-else>
      <PersonMultiPicker
        :label="pickerLabel"
        :people="people"
        :model-value="selectedIds"
        :blocked-ids="blockedIds"
        :blocked-message="blockedMessage"
        :placeholder="placeholder"
        @update:model-value="syncSelectedIds"
      />
      <p v-if="relationError" class="field-error">{{ relationError }}</p>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PersonMultiPicker from './PersonMultiPicker.vue'

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
const relationError = ref('')
const selectedIds = computed(() => {
  if (!props.person) return []
  if (props.field === 'fillotIds') {
    return props.people
      .filter((candidate) => personHasSponsor(candidate, props.person.id))
      .map((candidate) => candidate.id)
  }
  return props.person[props.field] || []
})
const blockedIds = computed(() => {
  if (!props.person) return []
  const blocked = new Set([props.person.id])
  if (props.field === 'fillotIds') {
    ;[...(props.person.sponsorIds || []), ...(props.person.heartSponsorIds || [])].forEach((id) => blocked.add(id))
  } else {
    selectedFillotIds.value.forEach((id) => blocked.add(id))
  }
  selectedIds.value.forEach((id) => blocked.add(id))
  return [...blocked]
})
const selectedFillotIds = computed(() => {
  if (!props.person) return []
  return props.people
    .filter((candidate) => personHasSponsor(candidate, props.person.id))
    .map((candidate) => candidate.id)
})
const pickerLabel = computed(() => `Ajouter ${relationLabel.value}`)
const relationLabel = computed(() => {
  if (props.field === 'fillotIds') return 'un fillot ou une fillote'
  if (props.field === 'heartSponsorIds') return 'un parrain ou une marraine de coeur'
  return 'un parrain ou une marraine'
})
const placeholder = computed(() => `Rechercher ${relationLabel.value}`)
const blockedMessage = computed(() => {
  if (props.field === 'fillotIds') {
    return 'Relation impossible : une personne ne peut pas être elle-même ou être à la fois parrain/marraine et fillot/fillote.'
  }
  return 'Relation impossible : une personne ne peut pas être elle-même ou être à la fois fillot/fillote et parrain/marraine.'
})

watch(
  () => props.person?.id,
  () => {
    relationError.value = ''
  },
)

function syncSelectedIds(nextIds) {
  relationError.value = ''
  const current = selectedIds.value
  const addedId = nextIds.find((id) => !current.includes(id))
  const removedId = current.find((id) => !nextIds.includes(id))
  if (addedId) addPerson(addedId)
  if (removedId) removePerson(removedId)
}

function addPerson(personId) {
  if (!props.person || !personId) return
  if (!canLink(personId)) {
    relationError.value = validationMessage(personId)
    return
  }

  if (props.field === 'fillotIds') {
    const fillot = props.people.find((candidate) => candidate.id === personId)
    if (!fillot) return
    emit('update', {
      ...fillot,
      sponsorIds: [...new Set([...(fillot.sponsorIds || []), props.person.id])],
    })
    return
  }

  emit('update', {
    ...props.person,
    [props.field]: [...new Set([...selectedIds.value, personId])],
  })
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

  emit('update', {
    ...props.person,
    [props.field]: selectedIds.value.filter((id) => id !== personId),
  })
}

function canLink(personId) {
  if (!props.person || personId === props.person.id || selectedIds.value.includes(personId)) return false
  if (props.field === 'fillotIds') {
    return ![...(props.person.sponsorIds || []), ...(props.person.heartSponsorIds || [])].includes(personId)
  }
  return !selectedFillotIds.value.includes(personId)
}

function validationMessage(personId) {
  if (personId === props.person?.id) return 'Une personne ne peut pas être liée à elle-même.'
  if (selectedIds.value.includes(personId)) return 'Cette personne est déjà sélectionnée.'
  return blockedMessage.value
}

function personHasSponsor(person, sponsorId) {
  return (person.sponsorIds || []).includes(sponsorId) || (person.heartSponsorIds || []).includes(sponsorId)
}
</script>
