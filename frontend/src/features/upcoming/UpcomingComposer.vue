<template>
  <section class="upcoming-panel">
    <p v-if="!enabled" class="empty">
      Ouvre une faluche de région ou une famille pour créer une annonce à venir.
    </p>

    <div class="upcoming-actions">
      <button type="button" :disabled="!enabled" :class="{ 'is-active': openKind === 'ceremony' }" @click="toggle('ceremony')">
        {{ openKind === 'ceremony' ? "Masquer l'annonce" : 'Annoncer un baptême/adoption/confirmation' }}
      </button>
      <button type="button" :disabled="!enabled" :class="{ 'is-active': openKind === 'cooptage' }" @click="toggle('cooptage')">
        {{ openKind === 'cooptage' ? 'Masquer le cooptage' : 'Annoncer un cooptage' }}
      </button>
    </div>

    <form v-if="enabled && openKind" class="upcoming-form" @submit.prevent="submit">
      <label v-if="openKind === 'ceremony'">
        Type d'annonce
        <select v-model="draft.eventType">
          <option value="bapteme">Baptême</option>
          <option value="adoption">Adoption</option>
          <option value="confirmation">Confirmation</option>
        </select>
      </label>

      <PersonMultiPicker
        v-model="draft.sponsorIds"
        :label="openKind === 'cooptage' ? cooptageRole.label : 'Parrain(s) / marraine(s)'"
        :people="availableSponsors"
        :placeholder="sponsorPlaceholder"
      />

      <PersonMultiPicker
        v-if="openKind === 'cooptage'"
        v-model="draft.fillotIds"
        label="Faluchard(s) concerné(s)"
        :people="availableConcernedPeople"
        placeholder="Rechercher un faluchard sans ce rôle"
      />

      <label v-else>
        Baptisé(s) concerné(s)
        <textarea v-model="draft.baptizedNames" rows="3" required placeholder="Un nom par ligne"></textarea>
      </label>

      <div class="upcoming-fields">
        <label>
          Date et heure
          <input v-model="draft.dateTime" type="datetime-local" required />
        </label>
        <label>
          Lieu
          <input v-model="draft.place" />
        </label>
      </div>

      <label class="upcoming-form__wide">
        Message
        <textarea v-model="draft.message" rows="2"></textarea>
      </label>

      <button type="submit" :disabled="submitDisabled">
        {{ openKind === 'cooptage' ? 'Annoncer le cooptage' : "Publier l'annonce" }}
      </button>
    </form>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import PersonMultiPicker from '../people/PersonMultiPicker.vue'

const props = defineProps({
  people: { type: Array, required: true },
  enabled: { type: Boolean, default: true },
  cooptageRole: {
    type: Object,
    default: () => ({ id: 'tva', label: 'TVA' }),
  },
})

const emit = defineEmits(['create'])
const openKind = ref('')
const draft = reactive({
  eventType: 'bapteme',
  sponsorIds: [],
  fillotIds: [],
  baptizedNames: '',
  dateTime: '',
  place: '',
  message: '',
})

const cooptagePeople = computed(() =>
  props.people.filter((person) => (person.roles || []).includes(props.cooptageRole.id)),
)
const nonCooptagePeople = computed(() =>
  props.people.filter((person) => !(person.roles || []).includes(props.cooptageRole.id)),
)
const availableSponsors = computed(() =>
  openKind.value === 'cooptage' ? cooptagePeople.value : props.people,
)
const availableConcernedPeople = computed(() =>
  nonCooptagePeople.value.filter((person) => !draft.sponsorIds.includes(person.id)),
)
const sponsorPlaceholder = computed(() =>
  openKind.value === 'cooptage'
    ? `Rechercher ${props.cooptageRole.label}`
    : 'Rechercher un parrain ou une marraine',
)
const submitDisabled = computed(() => {
  if (!draft.dateTime) return true
  if (openKind.value === 'cooptage') return draft.sponsorIds.length === 0 || draft.fillotIds.length === 0
  return draft.sponsorIds.length === 0 || !draft.baptizedNames.trim()
})

function toggle(kind) {
  if (!props.enabled) return
  openKind.value = openKind.value === kind ? '' : kind
  draft.sponsorIds = []
  draft.fillotIds = []
}

function submit() {
  if (submitDisabled.value) return
  emit('create', {
    ...draft,
    eventType: openKind.value === 'cooptage' ? 'cooptage' : draft.eventType,
    sponsorIds: [...draft.sponsorIds],
    fillotIds: [...draft.fillotIds],
  })
  draft.eventType = 'bapteme'
  draft.sponsorIds = []
  draft.fillotIds = []
  draft.baptizedNames = ''
  draft.dateTime = ''
  draft.place = ''
  draft.message = ''
  openKind.value = ''
}
</script>
