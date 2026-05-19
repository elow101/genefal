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
            <span>{{ filiereLabel(person.filiere) || 'Non renseignée' }}</span>
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
            <strong>{{ event.type === 'confirmation' ? 'Confirmation' : 'Adoption' }}</strong>
            <span>{{ event.city || 'Ville non renseignée' }}</span>
            <span v-if="event.nickname">{{ event.nickname }}</span>
          </div>
          <span v-if="!person.ceremonyEvents?.length" class="empty">Aucune cérémonie secondaire.</span>
        </div>
      </details>

      <details class="details-menu">
        <summary>
          <span>Rôles</span>
          <small>{{ person.roles?.length || 0 }}</small>
        </summary>
        <div class="details-body chip-list">
          <span v-for="role in roleChips" :key="role.id" class="chip">{{ role.label }}</span>
          <span v-if="!person.roles?.length" class="empty">Aucun rôle.</span>
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
  roleOptions: {
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
</script>
