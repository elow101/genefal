<template>
  <section class="upcoming-panel upcoming-panel--composer">
    <p v-if="!enabled" class="empty">
      Ouvre une faluche de région ou une famille pour créer une annonce à venir.
    </p>

    <form v-else class="upcoming-form" @submit.prevent="submit">
      <div class="upcoming-form-head">
        <div>
          <h3>Créer un événement</h3>
          <p>Prépare une annonce claire, adaptée aux écrans mobiles.</p>
        </div>
        <button
          type="button"
          class="help-icon help-icon--inline"
          aria-label="Aide pour créer un événement"
          @click="$emit('help', 'event_create')"
        >
          ?
        </button>
        <span v-if="draftStatus" class="inline-status">{{ draftStatus }}</span>
      </div>


      <section class="upcoming-form-block">
        <h4>Informations</h4>
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
        <p v-if="typeWarning" class="field-hint field-hint--warning">{{ typeWarning }}</p>
      </section>

      <section class="upcoming-form-block">
        <h4>Date et lieu</h4>
        <div class="quick-actions" aria-label="Raccourcis date et heure">
          <button type="button" @click="applyDateShortcut('today')">Aujourd’hui</button>
          <button type="button" @click="applyDateShortcut('tomorrow')">Demain</button>
          <button type="button" @click="applyDateShortcut('tonight')">Ce soir</button>
          <button type="button" @click="applyDateShortcut('weekend')">Ce week-end</button>
        </div>
        <div class="upcoming-fields upcoming-fields--date">
          <label>
            Date
            <input v-model="draft.eventDate" type="date" required />
          </label>
          <label>
            Heure
            <input v-model="draft.eventTime" type="time" required />
          </label>
        </div>
        <label>
          Lieu
          <input v-model="draft.place" placeholder="Salle, ville, adresse courte" />
        </label>
        <p v-if="dateWarning" class="field-hint field-hint--warning">{{ dateWarning }}</p>
      </section>

      <section class="upcoming-form-block">
        <h4>Accès</h4>
        <label>
          Visibilité
          <select v-model="draft.visibility">
            <option value="public">Public régional</option>
            <option value="private">Privé</option>
            <option value="family">Visible seulement aux fillots/famille</option>
          </select>
        </label>
        <label v-if="draft.eventType === 'autre'" class="switch-field upcoming-form__wide">
          <span>
            <strong>Autoriser les demandes de participation</strong>
            <small>Si activé, les visiteurs pourront demander à participer à cet événement.</small>
          </span>
          <input v-model="draft.allowParticipation" type="checkbox" />
          <i aria-hidden="true"></i>
        </label>
      </section>

      <section v-if="isCeremony || draft.eventType === 'cooptage'" class="upcoming-form-block">
        <h4>Personnes concernées</h4>
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

        <template v-else>
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
      </section>

      <section class="upcoming-form-block">
        <h4>Créateur</h4>
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
        <label>
          Description
          <textarea v-model="draft.message" rows="3" placeholder="Informations utiles, horaires, contact..."></textarea>
        </label>
      </section>

      <div class="upcoming-form-actions">
        <button type="submit" :disabled="submitDisabled">Créer l'événement</button>
        <button v-if="hasDraftContent" type="button" class="text-button" @click="clearDraft">Effacer le brouillon</button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { eventRequiresParticipation } from '../../domain/upcoming.js'
import PersonMultiPicker from '../people/PersonMultiPicker.vue'

const DRAFT_KEY = 'genefaluche-upcoming-event-draft'

const props = defineProps({
  people: { type: Array, required: true },
  enabled: { type: Boolean, default: true },
  cooptageRole: {
    type: Object,
    default: () => ({ id: 'tva', label: 'TVA' }),
  },
})

const emit = defineEmits(['create', 'help'])
const draft = reactive(defaultDraft())
const draftStatus = ref('')
let draftStatusTimeout = 0
let restoringDraft = false

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
const hasDraftContent = computed(() =>
  Boolean(
    draft.title.trim()
      || draft.eventDate
      || draft.eventTime
      || draft.place.trim()
      || draft.message.trim()
      || draft.creatorName.trim()
      || draft.creatorEmail.trim()
      || draft.sponsorIds.length
      || draft.fillotIds.length
      || draft.baptizedNames.trim()
      || draft.allowParticipation,
  ),
)
const submitDisabled = computed(() => {
  if (!draft.title.trim() || !draft.eventDate || !draft.eventTime) return true
  if (isCeremony.value) return draft.sponsorIds.length === 0 || !draft.baptizedNames.trim()
  if (draft.eventType === 'cooptage') return draft.sponsorIds.length === 0 || draft.fillotIds.length === 0
  return false
})
const dateWarning = computed(() => {
  if (!draft.eventDate || !draft.eventTime) return 'Date et heure sont nécessaires pour publier.'
  const value = new Date(composeDateTime())
  if (!Number.isNaN(value.getTime()) && value.getTime() < Date.now()) return 'Cette date est déjà passée.'
  return ''
})
const typeWarning = computed(() =>
  draft.eventType === 'cooptage' && draft.allowParticipation
    ? 'Les demandes de participation sont toujours fermées pour un cooptage.'
    : '',
)

watch(
  () => ({ ...draft, sponsorIds: [...draft.sponsorIds], fillotIds: [...draft.fillotIds] }),
  () => {
    if (restoringDraft || !props.enabled) return
    if (!hasDraftContent.value) {
      window.localStorage?.removeItem(DRAFT_KEY)
      return
    }
    window.localStorage?.setItem(DRAFT_KEY, JSON.stringify(draft))
    setDraftStatus('Brouillon sauvegardé')
  },
  { deep: true },
)

watch(
  () => draft.eventType,
  (eventType, previousType) => {
    if (eventType !== 'autre') draft.allowParticipation = false
    if (previousType === 'autre' && eventType !== 'autre') {
      setDraftStatus('Demandes désactivées pour ce type')
    }
  },
)

onMounted(() => {
  const saved = window.localStorage?.getItem(DRAFT_KEY)
  if (!saved) return
  try {
    restoringDraft = true
    Object.assign(draft, { ...defaultDraft(), ...JSON.parse(saved) })
    draft.sponsorIds = Array.isArray(draft.sponsorIds) ? draft.sponsorIds : []
    draft.fillotIds = Array.isArray(draft.fillotIds) ? draft.fillotIds : []
    setDraftStatus('Brouillon récupéré')
  } catch {
    window.localStorage?.removeItem(DRAFT_KEY)
  } finally {
    window.setTimeout(() => {
      restoringDraft = false
    }, 0)
  }
})

function defaultDraft() {
  return {
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
    allowParticipation: false,
  }
}

function composeDateTime() {
  return `${draft.eventDate}T${draft.eventTime}`
}

function submit() {
  if (submitDisabled.value) {
    setDraftStatus('Complète les champs obligatoires')
    return
  }
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
    allowParticipation: draft.eventType === 'autre' && draft.allowParticipation === true,
  }, (ok) => {
    if (ok) resetDraft()
  })
}

function resetDraft() {
  Object.assign(draft, defaultDraft())
  window.localStorage?.removeItem(DRAFT_KEY)
  setDraftStatus('')
}

function clearDraft() {
  resetDraft()
  setDraftStatus('Brouillon supprimé')
}

function setDraftStatus(message) {
  draftStatus.value = message
  window.clearTimeout(draftStatusTimeout)
  if (!message) return
  draftStatusTimeout = window.setTimeout(() => {
    draftStatus.value = ''
  }, 2200)
}

function applyDateShortcut(shortcut) {
  const date = new Date()
  if (shortcut === 'tomorrow') date.setDate(date.getDate() + 1)
  if (shortcut === 'weekend') {
    const day = date.getDay()
    const daysUntilSaturday = day === 6 ? 0 : (6 - day + 7) % 7
    date.setDate(date.getDate() + daysUntilSaturday)
  }
  draft.eventDate = toDateInputValue(date)
  draft.eventTime = shortcut === 'tonight' || shortcut === 'weekend' ? '20:00' : draft.eventTime || '19:00'
}

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
</script>
