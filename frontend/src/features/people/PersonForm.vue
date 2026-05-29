<template>
  <section class="person-form">
    <div class="form-head">
      <h2>Fiche faluchard</h2>
      <div class="help-row">
        <button class="help-icon help-icon--inline" type="button" aria-label="Aide pour créer une fiche" @click="$emit('help', 'faluchard_create')">
          ?
        </button>
        <button class="text-button" type="button" @click="$emit('new')">Nouveau</button>
      </div>
    </div>

    <p v-if="!person" class="empty">Sélectionne une personne à modifier.</p>

    <form v-else @submit.prevent="submit" @input="$emit('editing')" @change="$emit('editing')">
      <section
        v-if="duplicateConfirmation"
        class="duplicate-confirmation"
        role="alertdialog"
        aria-labelledby="duplicate-confirmation-title"
        aria-describedby="duplicate-confirmation-message"
      >
        <div>
          <strong id="duplicate-confirmation-title">Fiche similaire détectée</strong>
          <p id="duplicate-confirmation-message">
            Une fiche similaire existe déjà. Voulez-vous quand même créer cette nouvelle fiche ?
          </p>
          <small v-if="duplicateConfirmation.label">
            Fiche existante : {{ duplicateConfirmation.label }}
          </small>
        </div>
        <div class="duplicate-confirmation__actions">
          <button
            type="button"
            class="text-button"
            :disabled="duplicateConfirmation.loading"
            @click="$emit('cancel-duplicate')"
          >
            Annuler
          </button>
          <button
            type="button"
            class="primary"
            :disabled="duplicateConfirmation.loading"
            @click="$emit('confirm-duplicate')"
          >
            Créer quand même
          </button>
        </div>
      </section>

      <div class="form-step-tabs" aria-label="Étapes de la fiche">
        <button class="text-button" type="button" :class="{ 'is-active': activeSection === 'identity' }" @click="activateSection('identity')">
          Identité
        </button>
        <button class="text-button" type="button" :class="{ 'is-active': activeSection === 'baptism' }" @click="activateSection('baptism')">
          Baptême
        </button>
        <button class="text-button" type="button" :class="{ 'is-active': activeSection === 'sponsorship' }" @click="activateSection('sponsorship')">
          Famille
        </button>
        <button class="text-button" type="button" :class="{ 'is-active': activeSection === 'roles' }" @click="activateSection('roles')">
          Rôles
        </button>
      </div>

      <section ref="identityAnchor" class="form-identity">
        <div class="quick-fields">
          <label class="name-field">
            Nom
            <span class="field-tooltip-wrap">
              <input v-model="draft.name" placeholder="Facultatif" />
              <span class="field-tooltip">Remplis ce champ uniquement si la personne est consentante.</span>
            </span>
          </label>
          <label>Surnom <input v-model="draft.nickname" /></label>
          <label>
            Filière
            <select v-model="draft.filiere">
              <option value="">Non renseignée</option>
              <option v-for="option in filiereOptions" :key="option.id" :value="option.id">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label>
            2e filière (optionnel)
            <select v-model="draft.filiere2">
              <option value="">Aucune</option>
              <option v-for="option in filiereOptions" :key="option.id" :value="option.id">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label v-if="canSelectGenealogy && genealogyOptions.length">
            Arbre d'ajout
            <select :value="selectedGenealogyId" @change="$emit('change-genealogy', $event.target.value)">
              <option v-for="option in genealogyOptions" :key="option.id" :value="option.id">
                {{ genealogyOptionLabel(option) }}
              </option>
            </select>
          </label>
        </div>

        <details ref="advancedSection" class="form-section">
          <summary>Infos avancées</summary>
          <div class="form-section-body">
            <label>Ancien ou second surnom <input v-model="draft.nickname2" /></label>
            <label>Autre surnom <input v-model="draft.nickname3" /></label>
            <label>Paillarde <textarea v-model="draft.song" rows="3"></textarea></label>
          </div>
        </details>
      </section>

      <details ref="baptismSection" class="form-section">
        <summary>Infos de baptême</summary>
        <div class="form-section-body">
          <label>Date de baptême <input v-model="draft.baptismDate" type="date" /></label>
          <label>Ville de baptême <input v-model="draft.baptismCity" /></label>
          <label>
            Si aucune date n'est précisée
            <select v-model="draft.baptismStatus">
              <option value="unknown">Date inconnue</option>
              <option value="unbaptized">Pas encore baptisé</option>
            </select>
          </label>
          <div class="cross-baptism-fields">
            <div class="section-heading section-heading--compact">
              <div>
                <h3>Baptême croisé</h3>
                <p>Renseigne le même identifiant pour toutes les fiches du groupe croisé.</p>
              </div>
            </div>
            <div class="quick-fields">
              <label>
                Identifiant du groupe croisé
                <input v-model="draft.crossGroupId" placeholder="ex : promo-2026-tours" />
              </label>
              <label>
                Nombre de personnes dans le groupe
                <input v-model.number="draft.crossGroupSize" type="number" min="0" max="10" />
              </label>
            </div>
            <button
              v-if="draft.crossGroupId || draft.crossGroupSize"
              class="text-button danger-text"
              type="button"
              @click="clearCrossBaptism"
            >
              Supprimer le baptême croisé
            </button>
          </div>
          <CeremonyEventEditor
            v-if="!isCreating"
            :person="person"
            :people="people"
            :can-delete="canManageCeremonyEvents"
            @update="$emit('save', $event)"
          />
          <p v-else class="field-hint">
            Les adoptions, confirmations et liens avancés seront disponibles après l'enregistrement de la fiche.
          </p>
        </div>
      </details>

      <details ref="sponsorshipSection" class="form-section">
        <summary>Famille</summary>
        <div class="form-section-body relation-editors">
          <template v-if="!isCreating">
            <SponsorEditor
              title="Parrains / Marraines"
              field="sponsorIds"
              :person="person"
              :people="people"
              @update="$emit('save', $event)"
            />
            <SponsorEditor
              title="Parrains / Marraines de cœur"
              field="heartSponsorIds"
              :person="person"
              :people="people"
              @update="$emit('save', $event)"
            />
            <SponsorEditor
              title="Fillots"
              field="fillotIds"
              :person="person"
              :people="people"
              @update="$emit('save', $event)"
            />
          </template>
          <p v-else class="field-hint">
            Enregistre d'abord la fiche pour créer des liens parent/fillot sans fiche fantôme.
          </p>
        </div>
      </details>

      <details ref="rolesSection" class="form-section">
        <summary>Rôles et statuts</summary>
        <div class="form-section-body">
          <p v-if="roleOptions.length === 0" class="empty">Aucun rôle disponible pour cette généalogie.</p>
          <div v-else class="role-pill-list">
            <button
              v-for="role in roleOptions"
              :key="role.id"
              class="role-pill"
              type="button"
              :class="{ 'is-selected': draft.roles.includes(role.id) }"
              @click="toggleRole(role.id)"
            >
              {{ role.label }}
            </button>
          </div>
        </div>
      </details>

      <div class="form-actions">
        <button class="primary" type="submit">Enregistrer</button>
        <button v-if="isCreating" class="text-button" type="button" @click="$emit('cancel')">Annuler</button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue'
import { filiereOptions, normaliseFiliereId } from '../../domain/filiere.js'
import CeremonyEventEditor from './CeremonyEventEditor.vue'
import SponsorEditor from './SponsorEditor.vue'

const props = defineProps({
  person: { type: Object, default: null },
  people: { type: Array, required: true },
  genealogyOptions: { type: Array, default: () => [] },
  selectedGenealogyId: { type: String, default: '' },
  canSelectGenealogy: { type: Boolean, default: false },
  roleOptions: { type: Array, default: () => [] },
  canManageCeremonyEvents: { type: Boolean, default: false },
  isCreating: { type: Boolean, default: false },
  duplicateConfirmation: { type: Object, default: null },
})

const emit = defineEmits([
  'save',
  'new',
  'help',
  'editing',
  'change-genealogy',
  'cancel',
  'confirm-duplicate',
  'cancel-duplicate',
])
const activeSection = ref('identity')
const identityAnchor = ref(null)
const advancedSection = ref(null)
const baptismSection = ref(null)
const sponsorshipSection = ref(null)
const rolesSection = ref(null)
const draft = reactive({
  name: '',
  nickname: '',
  nickname2: '',
  nickname3: '',
  filiere: '',
  filiere2: '',
  baptismCity: '',
  baptismDate: '',
  baptismStatus: 'unknown',
  crossGroupId: '',
  crossGroupSize: 0,
  song: '',
  roles: [],
  ceremonyEvents: [],
})

watch(
  () => props.person,
  (person) => {
    draft.name = person?.name || ''
    draft.nickname = person?.nickname || ''
    draft.nickname2 = person?.nicknames?.[1] || ''
    draft.nickname3 = person?.nicknames?.[2] || ''
    draft.filiere = normaliseFiliereId(person?.filiere || '')
    draft.filiere2 = normaliseFiliereId(person?.filiere2 || '')
    draft.baptismCity = person?.baptismCity || ''
    draft.baptismDate = person?.baptismDate || ''
    draft.baptismStatus = person?.baptismStatus || 'unknown'
    draft.crossGroupId = person?.crossGroupId || ''
    draft.crossGroupSize = person?.crossGroupSize || 0
    draft.song = person?.song || ''
    draft.roles = [...(person?.roles || [])]
    draft.ceremonyEvents = [...(person?.ceremonyEvents || [])]
    activeSection.value = 'identity'
    closeSections()
  },
  { immediate: true },
)

function submit() {
  if (!props.person) return
  const nicknames = [draft.nickname, draft.nickname2, draft.nickname3].filter(Boolean)
  emit('save', {
    ...props.person,
    name: draft.name,
    nickname: draft.nickname,
    nicknames,
    filiere: draft.filiere,
    filiere2: draft.filiere2,
    baptismCity: draft.baptismCity,
    baptismDate: draft.baptismDate,
    baptismStatus: draft.baptismStatus,
    crossGroupId: draft.crossGroupId,
    crossGroupSize: Number(draft.crossGroupSize) || 0,
    song: draft.song,
    roles: [...draft.roles],
    ceremonyEvents: [...draft.ceremonyEvents],
  })
}

async function activateSection(section) {
  activeSection.value = section
  closeSections()
  await nextTick()
  if (section === 'baptism') {
    openAndScroll(baptismSection.value)
    return
  }
  if (section === 'sponsorship') {
    openAndScroll(sponsorshipSection.value)
    return
  }
  if (section === 'roles') {
    openAndScroll(rolesSection.value)
    return
  }
  identityAnchor.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function openAndScroll(section) {
  if (!section) return
  section.open = true
  section.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function closeSections() {
  ;[advancedSection.value, baptismSection.value, sponsorshipSection.value, rolesSection.value]
    .filter(Boolean)
    .forEach((section) => {
      section.open = false
    })
}

function toggleRole(roleId) {
  draft.roles = draft.roles.includes(roleId)
    ? draft.roles.filter((id) => id !== roleId)
    : [...draft.roles, roleId]
  emit('editing')
}

function clearCrossBaptism() {
  draft.crossGroupId = ''
  draft.crossGroupSize = 0
  emit('editing')
}

function genealogyOptionLabel(option) {
  if (!option?.parentName || option.parentName === option.name) return option?.name || ''
  return `${option.parentName} / ${option.name}`
}
</script>
