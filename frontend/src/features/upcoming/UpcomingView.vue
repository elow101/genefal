<template>
  <section class="upcoming">
    <div class="section-heading upcoming-region-head">
      <div class="upcoming-region-copy">
        <h2>Événements à venir</h2>
        <p v-if="region">
          {{ filteredEvents.length }} événement(s) visible(s) dans {{ region.name }}.
        </p>

        <p v-else>Ouvre une faluche de région ou une famille pour voir les événements.
        </p>
      </div>

      <div class="upcoming-region-actions">
        <span v-if="canDelete" class="mode-badge"> Mode admin </span>

        <button
          type="button"
          class="help-icon help-icon--inline"
          aria-label="Aide participation événement"
          @click="$emit('help', 'event_participation')"
        >
          ?
        </button>
      </div>
    </div>

    <form v-if="region" class="attendance-form compact-form" @submit.prevent="subscribe">
      <h3>Suivre les événements de ma région</h3>
      <div class="attendance-fields">
        <label>
          Email
          <input v-model="subscriptionEmail" type="email" required />
        </label>
      </div>
      <div class="button-row">
        <button type="submit">Suivre {{ region.name }}</button>
        <button type="button" class="text-button" @click="unsubscribe">Me désabonner</button>
      </div>
    </form>

    <div v-if="region" class="quick-filter-strip" aria-label="Filtres rapides">
      <button
        v-for="filter in quickFilters"
        :key="filter.id"
        type="button"
        class="filter-chip"
        :class="{ 'is-active': activeQuickFilter === filter.id }"
        @click="applyQuickFilter(filter.id)"
      >
        {{ filter.label }}
      </button>
    </div>

    <div v-if="region" class="upcoming-filters">
      <label>
        Type
        <select v-model="typeFilter">
          <option value="">Tous</option>
          <option v-for="type in eventTypes" :key="type" :value="type">
            {{ eventTypeLabel(type) }}
          </option>
        </select>
      </label>
      <label>
        Tri
        <select v-model="sortDirection">
          <option value="asc">Plus proche d'abord</option>
          <option value="desc">Plus récent d'abord</option>
        </select>
      </label>
    </div>

    <p v-if="!region" class="empty">Aucune région active pour les événements à venir.</p>
    <p v-else-if="filteredEvents.length === 0" class="empty">Aucun événement trouvé.</p>

    <div v-else class="upcoming-list">
      <UpcomingCard
        v-for="event in filteredEvents"
        :key="event.id"
        :event="event"
        :people="people"
        :region-name="region.name"
        :cooptage-role-label="cooptageRoleLabel"
        :can-delete="canDelete"
        :participation-status="participationByEvent[event.id] || ''"
        @request="openRequest"
        @manage="openManagement"
        @delete="queueDelete"
      />
    </div>

    <section
      v-if="canDelete && pendingDeleteEventId && !managementEventId"
      class="delete-confirmation"
    >
      <p>Supprimer définitivement cet événement ?</p>
      <div class="button-row">
        <button type="button" class="danger-button" @click="confirmAdminDelete">Confirmer</button>
        <button type="button" class="text-button" @click="pendingDeleteEventId = ''">
          Annuler
        </button>
      </div>
    </section>

    <form v-if="requestEvent" class="attendance-form action-panel" @submit.prevent="submitRequest">
      <div class="form-title-row">
        <div>
          <h3>Demande de participation</h3>
          <p class="field-hint">{{ requestEvent.title }}</p>
        </div>
        <button type="button" class="text-button" @click="requestEventId = ''">Fermer</button>
      </div>
      <div class="attendance-fields">
        <label>
          Nom / pseudo
          <input v-model="attendance.name" required />
        </label>
        <label>
          Email
          <input v-model="attendance.email" type="email" required />
        </label>
      </div>
      <label>
        Message optionnel
        <textarea v-model="attendance.message" rows="2"></textarea>
      </label>
      <div class="button-row">
        <button type="submit">Envoyer la demande</button>
        <button type="button" class="text-button" @click="requestEventId = ''">Annuler</button>
      </div>
    </form>

    <form
      v-if="managementEventId"
      class="attendance-form action-panel"
      @submit.prevent="loadManagement"
    >
      <div class="form-title-row">
        <div>
          <h3>Gestion créateur</h3>
          <p class="field-hint">Modification limitée aux options de l’annonce et aux demandes.</p>
        </div>
        <span v-if="managedEvent" class="mode-badge">Vous êtes créateur</span>
      </div>
      <div class="attendance-fields">
        <label>
          Mot de passe temporaire
          <input v-model="managementPassword" type="password" required />
        </label>
      </div>
      <div class="button-row">
        <button type="submit">Ouvrir la gestion</button>
        <button type="button" class="text-button" @click="closeManagement">Annuler</button>
      </div>

      <div v-if="managedEvent" class="request-list">
        <section class="manager-options">
          <h4>Options visibles</h4>
          <label>
            Visibilité
            <select v-model="managedVisibility">
              <option value="public">Public régional</option>
              <option value="private">Privé</option>
              <option value="family">Visible seulement aux fillots/famille</option>
            </select>
          </label>
          <label v-if="managedEvent.eventType === 'autre'" class="switch-field">
            <span>
              <strong>Autoriser les demandes de participation</strong>
              <small
                >Si activé, les visiteurs pourront demander à participer à cet événement.</small
              >
            </span>
            <input v-model="managedAllowParticipation" type="checkbox" />
            <i aria-hidden="true"></i>
          </label>
          <button type="button" @click="updateManagedEvent">Enregistrer les options</button>
        </section>

        <section v-for="group in requestGroups" :key="group.status" class="request-group">
          <h4>{{ group.title }}</h4>
          <article
            v-for="request in group.items"
            :key="request.id"
            class="request-card"
            :class="`request-card--${group.status}`"
          >
            <div class="request-card-head">
              <div>
                <strong>{{ request.name }}</strong>
                <small v-if="request.createdAt">{{ formatRequestDate(request.createdAt) }}</small>
              </div>
              <span class="request-status">{{ requestStatusLabel(request.status) }}</span>
            </div>
            <p v-if="request.nickname">Surnom : {{ request.nickname }}</p>
            <p v-if="request.message">{{ request.message }}</p>
            <div v-if="group.status === 'pending'" class="button-row">
              <button type="button" @click="setStatus(request.id, 'accepted')">Accepter</button>
              <button
                type="button"
                class="text-button danger-text"
                @click="setStatus(request.id, 'rejected')"
              >
                Refuser
              </button>
            </div>
          </article>
          <p v-if="group.items.length === 0" class="empty">Aucune demande.</p>
        </section>

        <section v-if="pendingDeleteEventId" class="delete-confirmation">
          <p>Supprimer définitivement cet événement ?</p>
          <div class="button-row">
            <button type="button" class="danger-button" @click="confirmQueuedDelete">
              Confirmer
            </button>
            <button type="button" class="text-button" @click="pendingDeleteEventId = ''">
              Annuler
            </button>
          </div>
        </section>
        <button
          v-else
          type="button"
          class="danger-text text-button"
          @click="pendingDeleteEventId = managementEventId"
        >
          Supprimer l'événement
        </button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import {
  canRequestParticipation,
  eventTypeLabel,
  isThisWeek,
  requestStatusLabel,
} from '../../domain/upcoming.js'
import UpcomingCard from './UpcomingCard.vue'

const props = defineProps({
  events: { type: Array, required: true },
  people: { type: Array, required: true },
  region: { type: Object, default: null },
  cooptageRoleLabel: { type: String, default: 'TVA' },
  canDelete: { type: Boolean, default: false },
})

const emit = defineEmits([
  'delete',
  'request',
  'subscribe',
  'unsubscribe',
  'creator-access',
  'creator-update',
  'request-status',
  'creator-delete',
  'help',
])
const typeFilter = ref('')
const sortDirection = ref('asc')
const activeQuickFilter = ref('all')
const subscriptionEmail = ref('')
const requestEventId = ref('')
const managementEventId = ref('')
const managementPassword = ref('')
const managedEvent = ref(null)
const managedAllowParticipation = ref(false)
const managedVisibility = ref('public')
const pendingDeleteEventId = ref('')
const attendance = reactive({ name: '', email: '', message: '' })
const participationByEvent = reactive({})

const quickFilters = [
  { id: 'all', label: 'Tous' },
  { id: 'bapteme', label: 'Baptêmes' },
  { id: 'adoption', label: 'Adoptions' },
  { id: 'confirmation', label: 'Confirmations' },
  { id: 'cooptage', label: 'Cooptages' },
  { id: 'autre', label: 'Autres' },
  { id: 'week', label: 'Cette semaine' },
  { id: 'open', label: 'Participation ouverte' },
]

const eventTypes = computed(() => [
  ...new Set(props.events.map((event) => event.eventType).filter(Boolean)),
])
const filteredEvents = computed(() =>
  props.events
    .filter((event) => !typeFilter.value || event.eventType === typeFilter.value)
    .filter(matchesQuickFilter)
    .slice()
    .sort((a, b) =>
      sortDirection.value === 'asc'
        ? String(a.dateTime).localeCompare(String(b.dateTime))
        : String(b.dateTime).localeCompare(String(a.dateTime)),
    ),
)
const requestEvent = computed(
  () => props.events.find((event) => event.id === requestEventId.value) || null,
)
const requestGroups = computed(() => {
  const requests = managedEvent.value?.requests || []
  return [
    {
      status: 'pending',
      title: 'Demandes en attente',
      items: requests.filter(
        (request) => request.status !== 'accepted' && request.status !== 'rejected',
      ),
    },
    {
      status: 'accepted',
      title: 'Participants acceptés',
      items: requests.filter((request) => request.status === 'accepted'),
    },
    {
      status: 'rejected',
      title: 'Demandes refusées',
      items: requests.filter((request) => request.status === 'rejected'),
    },
  ]
})

function matchesQuickFilter(event) {
  if (activeQuickFilter.value === 'all') return true
  if (
    ['bapteme', 'adoption', 'confirmation', 'cooptage', 'autre'].includes(activeQuickFilter.value)
  ) {
    return event.eventType === activeQuickFilter.value
  }
  if (activeQuickFilter.value === 'week') return isThisWeek(event.dateTime)
  if (activeQuickFilter.value === 'open') return canRequestParticipation(event)
  return true
}

function applyQuickFilter(filterId) {
  activeQuickFilter.value = filterId
}

function openRequest(eventId) {
  requestEventId.value = eventId
}

function submitRequest() {
  const eventId = requestEventId.value
  emit('request', { ...attendance, eventId }, (ok) => {
    if (!ok) return
    participationByEvent[eventId] = 'pending'
    attendance.name = ''
    attendance.email = ''
    attendance.message = ''
    requestEventId.value = ''
  })
}

function subscribe() {
  emit('subscribe', { email: subscriptionEmail.value })
}

function unsubscribe() {
  emit('unsubscribe', { email: subscriptionEmail.value })
}

function openManagement(eventId) {
  managementEventId.value = eventId
  pendingDeleteEventId.value = ''
  managedEvent.value = null
}

async function loadManagement() {
  managedEvent.value = await emitAsync('creator-access', {
    eventId: managementEventId.value,
    password: managementPassword.value,
  })
  managedAllowParticipation.value = managedEvent.value?.allowParticipation === true
  managedVisibility.value = managedEvent.value?.visibility || 'public'
}

async function updateManagedEvent() {
  const event = await emitAsync('creator-update', {
    eventId: managementEventId.value,
    password: managementPassword.value,
    visibility: managedVisibility.value,
    allowParticipation:
      managedEvent.value?.eventType === 'autre' && managedAllowParticipation.value === true,
  })
  if (event) {
    managedEvent.value = event
    managedAllowParticipation.value = event.allowParticipation === true
    managedVisibility.value = event.visibility || 'public'
  }
}

async function setStatus(requestId, status) {
  await emitAsync('request-status', {
    eventId: managementEventId.value,
    requestId,
    status,
    password: managementPassword.value,
  })
  await loadManagement()
}

function queueDelete(eventId) {
  pendingDeleteEventId.value = eventId
}

function confirmAdminDelete() {
  emit('delete', pendingDeleteEventId.value)
  pendingDeleteEventId.value = ''
}

async function confirmQueuedDelete() {
  if (!pendingDeleteEventId.value) return
  await emitAsync('creator-delete', {
    eventId: pendingDeleteEventId.value,
    password: managementPassword.value,
  })
  closeManagement()
}

function closeManagement() {
  managementEventId.value = ''
  managementPassword.value = ''
  managedEvent.value = null
  managedAllowParticipation.value = false
  managedVisibility.value = 'public'
  pendingDeleteEventId.value = ''
}

function emitAsync(eventName, payload) {
  return new Promise((resolve) => {
    emit(eventName, payload, resolve)
  })
}

function formatRequestDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
</script>
