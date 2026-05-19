<template>
  <section class="person-form">
    <div class="form-head">
      <h2>Fiche faluchard</h2>
      <button class="text-button" type="button" @click="$emit('new')">Nouveau</button>
    </div>

    <p v-if="!person" class="empty">Sélectionne une personne à modifier.</p>

    <form v-else @submit.prevent="submit" @input="$emit('editing')" @change="$emit('editing')">
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
          <label>Nom <input v-model="draft.name" required /></label>
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
          <CeremonyEventEditor
            :person="person"
            :people="people"
            :can-delete="canManageCeremonyEvents"
            @update="$emit('save', $event)"
          />
        </div>
      </details>

      <details ref="sponsorshipSection" class="form-section">
        <summary>Famille</summary>
        <div class="form-section-body relation-editors">
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
  roleOptions: { type: Array, default: () => [] },
  canManageCeremonyEvents: { type: Boolean, default: false },
})

const emit = defineEmits(['save', 'new', 'editing'])
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
  baptismCity: '',
  baptismDate: '',
  baptismStatus: 'unknown',
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
    draft.baptismCity = person?.baptismCity || ''
    draft.baptismDate = person?.baptismDate || ''
    draft.baptismStatus = person?.baptismStatus || 'unknown'
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
    baptismCity: draft.baptismCity,
    baptismDate: draft.baptismDate,
    baptismStatus: draft.baptismStatus,
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
</script>
