<template>
  <section class="cooptage-event-editor">
    <div class="section-heading section-heading--compact">
      <div>
        <h3>Cooptage / Intronisation</h3>
        <p>Ajoute une intronisation liée à cette fiche.</p>
      </div>
    </div>

    <p v-if="pastEvents.length === 0" class="empty">Aucun cooptage / intronisation lié.</p>
    <ul v-else class="ceremony-event-list">
      <li v-for="event in pastEvents" :key="event.id">
        <div class="ceremony-event-row">
          <div>
            <strong>{{ event.title || 'Cooptage / Intronisation' }}</strong>
            <span>{{ event.cooptageDateKnown === false ? 'Date non renseignée' : formatDate(event.dateTime) }}</span>
            <small v-if="event.cooptageNickname">Surnom : {{ event.cooptageNickname }}</small>
            <small v-if="event.sponsorIds?.length">PM d'intro : {{ names(event.sponsorIds) }}</small>
          </div>
        </div>
      </li>
    </ul>

    <details class="details-menu ceremony-event-add">
      <summary>Ajouter un cooptage / une intronisation</summary>
      <div class="details-body">
        <label>
          Titre
          <select v-model="draft.title">
            <option value="">Sélectionner un rôle</option>
            <option v-for="role in roleOptions" :key="role.id" :value="role.label">
              {{ role.label }}
            </option>
          </select>
        </label>
        <label>
          Date
          <input v-model="draft.eventDate" type="date" />
        </label>
        <label>
          Surnom
          <input v-model="draft.nickname" maxlength="90" placeholder="Surnom d'intronisation" />
        </label>
        <PersonMultiPicker
          v-model="draft.sponsorIds"
          label="PM d'intro"
          :people="availablePeople"
          placeholder="Rechercher un PM d'intro"
        />
        <button type="button" :disabled="!canAdd" @click="addEvent">Ajouter le cooptage / l'intronisation</button>
      </div>
    </details>
  </section>
</template>

<script setup>
import { computed, reactive } from 'vue'
import PersonMultiPicker from './PersonMultiPicker.vue'

const UNKNOWN_DATE_TIME = '2000-01-01T00:00'

const props = defineProps({
  person: { type: Object, default: null },
  people: { type: Array, required: true },
  roleOptions: { type: Array, default: () => [] },
  pastEvents: { type: Array, default: () => [] },
})

const emit = defineEmits(['create'])

const draft = reactive({
  title: '',
  eventDate: '',
  nickname: '',
  sponsorIds: [],
})

const availablePeople = computed(() => props.people.filter((person) => person.id !== props.person?.id))
const canAdd = computed(() => Boolean(props.person?.id && draft.title.trim()))

function addEvent() {
  if (!canAdd.value) return
  const hasDate = Boolean(draft.eventDate)
  emit(
    'create',
    {
      title: draft.title.trim(),
      dateTime: hasDate ? `${draft.eventDate}T00:00` : UNKNOWN_DATE_TIME,
      cooptageDateKnown: hasDate,
      cooptageNickname: draft.nickname.trim(),
      sponsorIds: [...draft.sponsorIds],
    },
    (ok) => {
      if (!ok) return
      draft.title = ''
      draft.eventDate = ''
      draft.nickname = ''
      draft.sponsorIds = []
    },
  )
}

function formatDate(value) {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return 'Date non renseignée'
  return new Intl.DateTimeFormat('fr-FR').format(date)
}

function names(ids) {
  return ids
    .map((id) => props.people.find((person) => person.id === id)?.name || '')
    .filter(Boolean)
    .join(', ')
}
</script>
