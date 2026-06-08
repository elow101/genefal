<template>
  <section class="person-details">
    <h2>Détails</h2>

    <p v-if="!person" class="empty">Sélectionne une personne pour afficher sa fiche.</p>

    <template v-else>
      <details class="details-menu" open>
        <summary>
          <span>{{ person.name }}</span>
          <small>{{ person.nickname || 'Sans surnom' }}</small>
        </summary>
        <div class="details-body info-grid">
          <div>
            <strong>Filière</strong>
            <span>{{ filiereLabel(person.filiere, person.filiereCustom) || 'Non renseignée' }}</span>
          </div>
          <div v-if="person.filiere2">
            <strong>2e filière</strong>
            <span>{{ filiereLabel(person.filiere2, person.filiere2Custom) }}</span>
          </div>
          <div>
            <strong>Date de baptême</strong>
            <span>{{ person.baptismDate || 'Non renseignée' }}</span>
          </div>
          <div>
            <strong>Ville de baptême</strong>
            <span>{{ person.baptismCity || 'Non renseignée' }}</span>
          </div>
          <div>
            <strong>Paillarde</strong>
            <span>{{ person.song || 'Non renseignée' }}</span>
          </div>
        </div>
      </details>

      <details class="details-menu">
        <summary>
          <span>Adoptions / confirmations</span>
          <small>{{ person.ceremonyEvents?.length || 0 }}</small>
        </summary>
        <div class="details-body info-grid">
          <div v-for="event in person.ceremonyEvents || []" :key="event.id">
            <strong>{{ eventLabel(event.type) }}</strong>
            <span>{{ event.city || 'Ville non renseignée' }}</span>
            <span v-if="event.nickname">{{ event.nickname }}</span>
          </div>
          <span v-if="!person.ceremonyEvents?.length" class="empty">Aucune cérémonie secondaire.</span>
        </div>
      </details>

      <details class="details-menu">
        <summary>
          <span>Rôles et statuts</span>
          <small>{{ roleChips.length + cooptageRows.length }}</small>
        </summary>
        <div class="details-body">
          <div class="chip-list">
            <span v-for="role in roleChips" :key="role.id" class="chip">{{ role.label }}</span>
            <span v-if="!roleChips.length && !cooptageRows.length" class="empty">Aucun rôle.</span>
          </div>
          <div v-for="event in cooptageRows" :key="event.id" class="cooptage-info-line">
            <strong>Cooptage / Intronisation</strong>
            <span>{{ event.line }}</span>
            <small v-if="event.nickname">Surnom : {{ event.nickname }}</small>
            <small v-if="event.pmNames">PM d'intro : {{ event.pmNames }}</small>
          </div>
        </div>
      </details>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { filiereLabel } from '../../domain/filiere.js'

const props = defineProps({
  person: {
    type: Object,
    default: null,
  },
  people: {
    type: Array,
    default: () => [],
  },
  roleOptions: {
    type: Array,
    default: () => [],
  },
  pastCooptageEvents: {
    type: Array,
    default: () => [],
  },
})

const roleChips = computed(() =>
  (props.person?.roles || []).map((roleId) => ({
    id: roleId,
    label: props.roleOptions.find((role) => role.id === roleId)?.label || roleId,
  })),
)
const cooptageRows = computed(() =>
  props.pastCooptageEvents.map((event) => ({
    id: event.id,
    line: [
      event.cooptageDateKnown === false ? '' : formatCooptageEventDate(event.dateTime),
      event.title || '',
    ].filter(Boolean).join(' — '),
    nickname: event.cooptageNickname || '',
    pmNames: personNames(event.sponsorIds || []),
  })),
)

function eventLabel(type) {
  if (type === 'confirmation') return 'Confirmation'
  return 'Adoption'
}

function formatCooptageEventDate(value) {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return ''
  return `Intronisé / coopté le ${new Intl.DateTimeFormat('fr-FR').format(date)}`
}

function personNames(ids) {
  return ids
    .map((id) => props.people.find((person) => person.id === id)?.name || '')
    .filter(Boolean)
    .join(', ')
}
</script>
