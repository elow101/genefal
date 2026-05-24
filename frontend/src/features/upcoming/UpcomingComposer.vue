<template>
  <section class="upcoming-panel">
    <p v-if="!enabled" class="empty">
      Ouvre une faluche de région ou une famille pour créer une annonce à venir.
    </p>

    <form v-else class="upcoming-form" @submit.prevent="submit">
      <div class="section-heading">
        <div>
          <h3>Créer un événement</h3>
          <p>Événement libre ou cérémonie avec demandes de participation.</p>
        </div>
      </div>

      <div class="upcoming-fields">
        <label>
          Titre
          <input v-model="draft.title" required placeholder="Soirée, baptême, repas..." />
        </label>
        <label>
          Type
          <select v-model="draft.eventType">
            <option value="bapteme">Baptême</option>
            <option value="adoption">Adoption</option>
            <option value="confirmation">Confirmation</option>
            <option value="cooptage">Cooptage</option>
            <option value="autre">Autre</option>
          </select>
        </label>
      </div>

      <div class="upcoming-fields">
        <label>
          Date
          <input v-model="draft.eventDate" type="date" required />
        </label>
        <label>
          Heure
          <input v-model="draft.eventTime" type="time" required />
        </label>
        <label>
          Lieu
          <input v-model="draft.place" />
        </label>
      </div>

      <div class="upcoming-fields">
        <label>
          Créateur
          <input v-model="draft.creatorName" placeholder="Nom ou pseudo" />
        </label>
        <label>
          Email créateur
          <input v-model="draft.creatorEmail" type="email" placeholder="pour recevoir le mot de passe" />
        </label>
      </div>

      <template v-if="isCeremony">
        <PersonMultiPicker
          v-model="draft.sponsorIds"
          label="Parrain(s) / marraine(s)"
          :people="people"
          placeholder="Rechercher un parrain ou une marraine"
        />
        <label>
          Baptisé(s) concerné(s)
          <textarea v-model="draft.baptizedNames" rows="3" required placeholder="Un nom par ligne"></textarea>
        </label>
      </template>

      <template v-else-if="draft.eventType === 'cooptage'">
        <PersonMultiPicker
          v-model="draft.sponsorIds"
          :label="cooptageRole.label"
          :people="availableSponsors"
          :placeholder="`Rechercher ${cooptageRole.label}`"
        />
        <PersonMultiPicker
          v-model="draft.fillotIds"
          label="Faluchard(s) concerné(s)"
          :people="availableConcernedPeople"
          placeholder="Rechercher un faluchard sans ce rôle"
        />
      </template>

      <label class="upcoming-form__wide">
        Description
        <textarea v-model="draft.message" rows="3"></textarea>
      </label>

      <button type="submit" :disabled="submitDisabled">Créer l'événement</button>
    </form>
  </section>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { eventRequiresParticipation } from '../../domain/upcoming.js'
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
const draft = reactive({
  title: '',
  eventType: 'autre',
  sponsorIds: [],
  fillotIds: [],
  baptizedNames: '',
  eventDate: '',
  eventTime: '',
  place: '',
  message: '',
  creatorName: '',
  creatorEmail: '',
  visibility: 'public',
})

const isCeremony = computed(() => eventRequiresParticipation(draft.eventType))
const cooptagePeople = computed(() =>
  props.people.filter((person) => (person.roles || []).includes(props.cooptageRole.id)),
)
const nonCooptagePeople = computed(() =>
  props.people.filter((person) => !(person.roles || []).includes(props.cooptageRole.id)),
)
const availableSponsors = computed(() =>
  draft.eventType === 'cooptage' ? cooptagePeople.value : props.people,
)
const availableConcernedPeople = computed(() =>
  nonCooptagePeople.value.filter((person) => !draft.sponsorIds.includes(person.id)),
)
const submitDisabled = computed(() => {
  if (!draft.title.trim() || !draft.eventDate || !draft.eventTime) return true
  if (isCeremony.value) return draft.sponsorIds.length === 0 || !draft.baptizedNames.trim()
  if (draft.eventType === 'cooptage') return draft.sponsorIds.length === 0 || draft.fillotIds.length === 0
  return false
})

function composeDateTime() {
  return `${draft.eventDate}T${draft.eventTime}`
}

function submit() {
  if (submitDisabled.value) return
  emit('create', {
    title: draft.title,
    eventType: draft.eventType,
    dateTime: composeDateTime(),
    sponsorIds: [...draft.sponsorIds],
    fillotIds: [...draft.fillotIds],
    baptizedNames: draft.baptizedNames,
    place: draft.place,
    message: draft.message,
    creatorName: draft.creatorName,
    creatorEmail: draft.creatorEmail,
    visibility: draft.visibility,
  })
  draft.title = ''
  draft.eventType = 'autre'
  draft.sponsorIds = []
  draft.fillotIds = []
  draft.baptizedNames = ''
  draft.eventDate = ''
  draft.eventTime = ''
  draft.place = ''
  draft.message = ''
  draft.creatorName = ''
  draft.creatorEmail = ''
}
</script>
