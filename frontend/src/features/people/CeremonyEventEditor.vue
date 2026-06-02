<template>
  <section class="ceremony-event-editor">
    <div class="section-heading section-heading--compact">
      <div>
        <h3>Adoptions et confirmations</h3>
        <p>Ajoute une cérémonie secondaire et ses liens de famille.</p>
      </div>
    </div>

    <p v-if="events.length === 0" class="empty">Aucune adoption ou confirmation renseignée.</p>
    <ul v-else class="ceremony-event-list">
      <li v-for="event in events" :key="event.id">
        <div class="ceremony-event-row">
          <div>
            <strong>{{ eventLabel(event.type) }}</strong>
            <span>{{ event.city }}</span>
            <small v-if="event.nickname">Surnom : {{ event.nickname }}</small>
            <small v-if="event.sponsorIds?.length">Parrains / marraines : {{ names(event.sponsorIds) }}</small>
            <small v-if="event.heartSponsorIds?.length">Cœur : {{ names(event.heartSponsorIds) }}</small>
          </div>
          <button
            v-if="canDelete"
            class="text-button danger-text"
            type="button"
            @click="removeEvent(event.id)"
          >
            Supprimer
          </button>
        </div>
      </li>
    </ul>

    <details class="details-menu ceremony-event-add">
      <summary>Ajouter une adoption ou une confirmation</summary>
      <div class="details-body">
        <label>
          Type
          <select v-model="draft.type">
            <option value="adoption">Adoption</option>
            <option value="confirmation">Confirmation</option>
          </select>
        </label>
        <label>
          Ville
          <input v-model="draft.city" />
        </label>
        <label>
          Surnom d'adoption / confirmation
          <input v-model="draft.nickname" />
        </label>
        <PersonMultiPicker
          v-model="draft.sponsorIds"
          label="Parrains / Marraines d'adoption ou confirmation"
          :people="availablePeople"
          placeholder="Rechercher un parrain ou une marraine"
        />
        <PersonMultiPicker
          v-model="draft.heartSponsorIds"
          label="Parrains / Marraines de cœur"
          :people="availablePeople"
          placeholder="Rechercher un lien de cœur"
        />
        <button type="button" :disabled="!canAdd" @click="addEvent">Ajouter la cérémonie</button>
      </div>
    </details>
  </section>
</template>

<script setup>
import { computed, reactive } from 'vue'
import PersonMultiPicker from './PersonMultiPicker.vue'

const props = defineProps({
  person: { type: Object, default: null },
  people: { type: Array, required: true },
  canDelete: { type: Boolean, default: false },
})

const emit = defineEmits(['update'])

const draft = reactive({
  type: 'adoption',
  city: '',
  nickname: '',
  sponsorIds: [],
  heartSponsorIds: [],
})

const events = computed(() => props.person?.ceremonyEvents || [])
const availablePeople = computed(() => props.people.filter((person) => person.id !== props.person?.id))
const canAdd = computed(() => {
  return Boolean(
    props.person &&
      draft.city.trim() &&
      (draft.sponsorIds.length > 0 || draft.heartSponsorIds.length > 0),
  )
})

function addEvent() {
  if (!canAdd.value) return
  emit('update', {
    ...props.person,
    ceremonyEvents: [
      ...(props.person.ceremonyEvents || []),
      {
        id: `${draft.type}-${Date.now()}`,
        type: draft.type,
        city: draft.city.trim(),
        nickname: draft.nickname.trim(),
        sponsorIds: [...draft.sponsorIds],
        heartSponsorIds: [...draft.heartSponsorIds],
      },
    ],
  })
  draft.type = 'adoption'
  draft.city = ''
  draft.nickname = ''
  draft.sponsorIds = []
  draft.heartSponsorIds = []
}

function removeEvent(eventId) {
  if (!props.person || !props.canDelete) return
  emit('update', {
    ...props.person,
    ceremonyEvents: (props.person.ceremonyEvents || []).filter((event) => event.id !== eventId),
  })
}

function eventLabel(type) {
  if (type === 'confirmation') return 'Confirmation'
  return 'Adoption'
}

function names(ids = []) {
  return ids.map((id) => props.people.find((person) => person.id === id)?.name || id).join(', ')
}
</script>
