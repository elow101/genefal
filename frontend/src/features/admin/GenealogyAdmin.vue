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
          <option value="region">Région</option>
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
          <img :src="genealogy.photoData || brandMark" alt="" />
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
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { uniqueRoleId } from '../../domain/roles.js'
import brandMark from '../../assets/fetterama.png'

const props = defineProps({
  genealogies: { type: Array, required: true },
  session: { type: Object, required: true },
})

const emit = defineEmits(['create', 'delete', 'update'])
const draft = reactive({ name: '', type: 'family', parentId: '' })
const roleRegionId = ref('')
const newRoleLabel = ref('')

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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
</script>
