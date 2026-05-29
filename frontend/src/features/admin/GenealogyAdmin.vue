<template>
  <section class="panel genealogy-admin">
    <div class="section-heading">
      <div>
        <h2>Gestion des généalogies</h2>
        <p>Création, photos et rôles régionaux.</p>
      </div>
    </div>

    <form class="stack-form genealogy-create-form" @submit.prevent="submit">
      <label>
        Nom
        <input v-model="draft.name" required />
      </label>
      <label>
        Type
        <select v-model="draft.type">
          <option v-if="isGeneralAdmin" value="region">Région</option>
          <option value="family">Famille</option>
        </select>
      </label>
      <label v-if="draft.type === 'family'">
        Région parente
        <select v-model="draft.parentId" required>
          <option value="">Choisir une région</option>
          <option v-for="region in manageableRegions" :key="region.id" :value="region.id">
            {{ region.name }}
          </option>
        </select>
      </label>
      <p v-else class="field-hint">Les nouvelles régions sont toujours rattachées à Faluche Nationale.</p>
      <button type="submit" :disabled="draft.type === 'family' && !draft.parentId">Créer</button>
    </form>

    <div class="genealogy-admin-list">
      <article v-for="genealogy in manageableGenealogies" :key="genealogy.id" class="genealogy-admin-row">
        <div class="genealogy-admin-main">
          <img :src="genealogy.photoData || brandMark" :alt="`Visuel de ${genealogy.name}`" loading="lazy" />
          <div>
            <strong>{{ genealogy.name }}</strong>
            <small>{{ typeLabel(genealogy) }}</small>
          </div>
        </div>
        <div class="genealogy-admin-actions">
          <label class="photo-upload">
            Photo
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="uploadPhoto(genealogy.id, $event)" />
          </label>
          <button
            type="button"
            :disabled="!canDelete(genealogy)"
            @click="$emit('delete', genealogy.id)"
          >
            Supprimer
          </button>
        </div>
      </article>
    </div>

    <section v-if="manageableRegions.length" class="admin-role-tools">
      <h3>Rôles régionaux</h3>
      <label>
        Région
        <select v-model="roleRegionId">
          <option v-for="region in manageableRegions" :key="region.id" :value="region.id">
            {{ region.name }}
          </option>
        </select>
      </label>

      <template v-if="roleRegion">
        <label class="admin-role-setting">
          Rôle de cooptage
          <select :value="roleRegion.cooptageRoleId || 'tva'" @change="setCooptageRole($event.target.value)">
            <option value="tva">TVA</option>
            <option v-for="role in roleRegion.customRoles || []" :key="role.id" :value="role.id">
              {{ role.label }}
            </option>
          </select>
        </label>

        <form class="admin-role-add" @submit.prevent="addRole">
          <input v-model="newRoleLabel" placeholder="Nouveau rôle régional" />
          <button type="submit" :disabled="!newRoleLabel.trim()">Ajouter</button>
        </form>

        <div class="admin-role-list">
          <div v-for="role in roleRegion.customRoles || []" :key="role.id" class="admin-role-row">
            <span>{{ role.label }}</span>
            <button type="button" @click="removeRole(role.id)">Supprimer</button>
          </div>
          <p v-if="!(roleRegion.customRoles || []).length" class="empty">Aucun rôle régional ajouté.</p>
        </div>
      </template>
    </section>

    <section v-if="isGeneralAdmin" class="admin-duplicate-tools">
      <div class="section-heading compact-heading">
        <div>
          <h3>Doublons de fiches</h3>
          <p>Analyse les fiches avec le même nom et surnom après normalisation.</p>
        </div>
        <button type="button" :disabled="duplicateLoading" @click="scanDuplicates">
          {{ duplicateLoading ? 'Vérification...' : 'Vérifier les doublons' }}
        </button>
      </div>

      <p v-if="duplicateMessage" class="success-message">{{ duplicateMessage }}</p>
      <p v-if="duplicateError" class="form-error">{{ duplicateError }}</p>

      <div v-if="duplicateGroups.length" class="duplicate-group-list">
        <article v-for="group in duplicateGroups" :key="group.key" class="duplicate-group">
          <div class="duplicate-group__header">
            <div>
              <strong>{{ group.people.length }} fiches similaires</strong>
              <small>{{ group.label }}</small>
            </div>
            <button type="button" :disabled="duplicateLoading" @click="mergeGroup(group)">
              Fusionner
            </button>
          </div>

          <fieldset class="duplicate-keep-choice">
            <legend>Fiche principale à conserver</legend>
            <label v-for="person in group.people" :key="person.id">
              <input v-model="selectedKeepByGroup[group.key]" type="radio" :value="person.id" />
              <span>{{ person.name || 'Sans nom' }} <small v-if="person.nickname">({{ person.nickname }})</small></span>
            </label>
          </fieldset>

          <div class="duplicate-card-list">
            <div v-for="person in group.people" :key="person.id" class="duplicate-card">
              <strong>{{ person.name || 'Sans nom' }}</strong>
              <span v-if="person.nickname">{{ person.nickname }}</span>
              <small>ID : {{ person.id }}</small>
              <small v-if="person.genealogies?.length">Arbre(s) : {{ person.genealogies.join(', ') }}</small>
              <small v-if="person.baptismDate">Baptême : {{ person.baptismDate }}</small>
              <small v-if="person.differences?.length">Différences : {{ person.differences.join(', ') }}</small>
            </div>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { mergePersonDuplicates, scanPersonDuplicates } from '../../api/genealogyApi.js'
import { uniqueRoleId } from '../../domain/roles.js'
import brandMark from '../../assets/fetterama.png'

const props = defineProps({
  genealogies: { type: Array, required: true },
  session: { type: Object, required: true },
  csrfToken: { type: String, required: true },
})

const emit = defineEmits(['create', 'delete', 'update', 'duplicates-merged'])
const draft = reactive({ name: '', type: 'family', parentId: '' })
const roleRegionId = ref('')
const newRoleLabel = ref('')
const duplicateLoading = ref(false)
const duplicateError = ref('')
const duplicateMessage = ref('')
const duplicateGroups = ref([])
const selectedKeepByGroup = reactive({})

const isGeneralAdmin = computed(() => props.session.level === 'general')
const nationalGenealogy = computed(() => props.genealogies.find((genealogy) => genealogy.type === 'national') || null)
const manageableRegions = computed(() =>
  props.genealogies.filter((genealogy) =>
    genealogy.type === 'region' &&
    (props.session.level === 'general' || genealogy.id === props.session.regionId),
  ),
)
const manageableGenealogies = computed(() =>
  props.genealogies.filter((genealogy) => canManage(genealogy)),
)
const roleRegion = computed(() =>
  manageableRegions.value.find((region) => region.id === roleRegionId.value) || manageableRegions.value[0] || null,
)

watch(
  manageableRegions,
  (regions) => {
    if (!regions.some((region) => region.id === roleRegionId.value)) {
      roleRegionId.value = regions[0]?.id || ''
    }
    if (draft.type === 'family' && !regions.some((region) => region.id === draft.parentId)) {
      draft.parentId = regions[0]?.id || ''
    }
  },
  { immediate: true },
)

watch(
  () => draft.type,
  (type) => {
    draft.parentId = type === 'region' ? nationalGenealogy.value?.id || '' : manageableRegions.value[0]?.id || ''
  },
  { immediate: true },
)

function submit() {
  emit('create', {
    name: draft.name,
    type: draft.type,
    parentId: draft.type === 'region' ? nationalGenealogy.value?.id || '' : draft.parentId,
  })
  draft.name = ''
}

function canManage(genealogy) {
  if (props.session.level === 'general') return true
  return genealogy.id === props.session.regionId || genealogy.parentId === props.session.regionId
}

function canDelete(genealogy) {
  return props.session.level === 'general' && genealogy.type !== 'national' && props.genealogies.length > 1
}

function typeLabel(genealogy) {
  if (genealogy.type === 'national') return 'National'
  if (genealogy.type === 'region') return 'Région'
  const parent = props.genealogies.find((item) => item.id === genealogy.parentId)
  return `Famille${parent ? ` · ${parent.name}` : ''}`
}

async function uploadPhoto(genealogyId, event) {
  const [file] = event.target.files || []
  if (!file) return
  const photoData = await readFileAsDataUrl(file)
  emit('update', { genealogyId, patch: { photoData } })
  event.target.value = ''
}

function setCooptageRole(cooptageRoleId) {
  if (!roleRegion.value) return
  emit('update', { genealogyId: roleRegion.value.id, patch: { cooptageRoleId } })
}

function addRole() {
  if (!roleRegion.value || !newRoleLabel.value.trim()) return
  const existing = roleRegion.value.customRoles || []
  const nextRole = {
    id: uniqueRoleId(newRoleLabel.value, existing),
    label: newRoleLabel.value.trim(),
  }
  emit('update', {
    genealogyId: roleRegion.value.id,
    patch: { customRoles: [...existing, nextRole] },
  })
  newRoleLabel.value = ''
}

function removeRole(roleId) {
  if (!roleRegion.value) return
  const customRoles = (roleRegion.value.customRoles || []).filter((role) => role.id !== roleId)
  emit('update', {
    genealogyId: roleRegion.value.id,
    patch: {
      customRoles,
      cooptageRoleId: roleRegion.value.cooptageRoleId === roleId ? 'tva' : roleRegion.value.cooptageRoleId,
    },
  })
}

async function scanDuplicates() {
  duplicateLoading.value = true
  duplicateError.value = ''
  duplicateMessage.value = ''

  try {
    const result = await scanPersonDuplicates(props.csrfToken)
    duplicateGroups.value = result.groups || []
    Object.keys(selectedKeepByGroup).forEach((key) => delete selectedKeepByGroup[key])
    duplicateGroups.value.forEach((group) => {
      selectedKeepByGroup[group.key] = group.people?.[0]?.id || ''
    })
    duplicateMessage.value = duplicateGroups.value.length ? '' : 'Aucun doublon détecté.'
  } catch (error) {
    duplicateError.value = error.message || 'Vérification impossible.'
  } finally {
    duplicateLoading.value = false
  }
}

async function mergeGroup(group) {
  const keepPersonId = selectedKeepByGroup[group.key] || group.people?.[0]?.id || ''
  const mergePersonIds = (group.people || []).map((person) => person.id).filter((id) => id && id !== keepPersonId)
  if (!keepPersonId || mergePersonIds.length === 0) return

  const summary = [
    `Fiche conservée : ${labelForDuplicatePerson(group.people.find((person) => person.id === keepPersonId))}`,
    `Fiche(s) fusionnée(s) : ${mergePersonIds.length}`,
    'Les relations seront fusionnées et les anciennes références seront remplacées.',
  ].join('\n')

  if (!window.confirm(`${summary}\n\nConfirmer la fusion ?`)) return

  duplicateLoading.value = true
  duplicateError.value = ''
  duplicateMessage.value = ''
  try {
    const result = await mergePersonDuplicates({ keepPersonId, mergePersonIds }, props.csrfToken)
    duplicateGroups.value = result.groups || []
    emit('duplicates-merged', result.state)
    duplicateMessage.value = 'Fusion effectuée.'
  } catch (error) {
    duplicateError.value = error.message || 'Fusion impossible.'
  } finally {
    duplicateLoading.value = false
  }
}

function labelForDuplicatePerson(person) {
  if (!person) return 'fiche inconnue'
  return `${person.name || 'Sans nom'}${person.nickname ? ` (${person.nickname})` : ''}`
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
</script>
