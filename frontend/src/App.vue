<template>
  <main class="app-shell">
    <AppHeader
      :genealogies="genealogies"
      :selected-genealogy-id="selectedGenealogyId"
      :selected-genealogy-name="selectedGenealogy?.name || 'Faluche Nationale'"
      :status-label="statusLabel"
      :error="error"
      @select-genealogy="selectGenealogy"
      @export="activeOverlay = 'exports'"
      @open-doleances="activeOverlay = 'doleances'"
      @open-admin="openAdmin"
    />

    <p v-if="loading" class="notice">Chargement des données...</p>
    <div v-else-if="error" class="notice notice--error">
      <p>{{ error }}</p>
      <a :href="loginUrl">Ouvrir la connexion PHP</a>
    </div>

    <template v-else>
      <section class="options-bar" aria-label="Options d'affichage">
        <details ref="searchMenu" class="search-menu" @toggle="handleSearchToggle">
          <summary>Recherche</summary>
          <div class="search-popover">
            <label>
              Chercher un faluchard
              <input
                ref="searchInput"
                v-model="searchQuery"
                type="search"
                placeholder="Nom, surnom, paillarde..."
                autocomplete="off"
              />
            </label>
            <button
              v-for="person in searchResults"
              :key="person.id"
              class="search-result"
              type="button"
              @click="selectSearchResult(person.id)"
            >
              {{ person.name }}
            </button>
          </div>
        </details>

        <label>
          Ascendants visibles
          <input v-model.number="ancestorDepth" type="number" min="0" max="20" />
        </label>

        <label>
          Descendants visibles
          <input v-model.number="descendantDepth" type="number" min="0" max="20" />
        </label>
      </section>

      <section class="workspace" :class="{ 'workspace--editor-hidden': editorHidden }">
        <section class="graph-area" aria-label="Visualisation généalogique">
          <div class="graph-header">
            <div class="graph-header-copy">
              <h2>{{ focusTitle }}</h2>
              <p>{{ focusSubtitle }}</p>
            </div>

            <div class="view-toggle" role="tablist" aria-label="Mode d'affichage">
              <button
                v-for="view in views"
                :key="view.id"
                type="button"
                :class="{ 'is-active': activeView === view.id }"
                @click="activeView = view.id"
              >
                {{ view.label }}
              </button>
            </div>
          </div>

          <div class="graph-stage-wrap">
            <div
              v-if="activeView === 'tree' || activeView === 'network'"
              class="zoom-controls graph-stage-zoom"
              aria-label="Zoom de l'arbre"
            >
              <button type="button" title="Zoom arrière" @click="adjustZoom(-0.1)">−</button>
              <button type="button" title="Recentrer" @click="resetZoom">
                {{ Math.round(graphZoom * 100) }}%
              </button>
              <button type="button" title="Zoom avant" @click="adjustZoom(0.1)">+</button>
            </div>
            <GenealogyGraph
              v-if="activeView === 'tree' || activeView === 'network'"
              :graph="graph"
              :selected-person-id="selectedPersonId"
              :zoom="graphZoom"
              :mode="activeView"
              :role-options="roleOptions"
              @select="selectPerson"
            />
            <OverviewPanel
              v-else-if="activeView === 'overview'"
              :people="people"
              @select="handlePersonFocus"
            />
            <NewcomersPanel
              v-else-if="activeView === 'newcomers'"
              :people="people"
              @select="handlePersonFocus"
            />
            <StatsDashboard v-else-if="activeView === 'stats'" :stats="stats" />
            <template v-else>
              <UpcomingComposer
                :people="people"
                :enabled="Boolean(upcomingRegion)"
                :cooptage-role="cooptageRole"
                @create="handleUpcomingCreate"
              />
              <UpcomingView
                :events="upcomingEvents"
                :people="people"
                :selected-event-ids="selectedUpcomingEventIds"
                :region="upcomingRegion"
                :cooptage-role-label="cooptageRole.label"
                :can-delete="Boolean(adminSession)"
                @toggle="upcoming.toggleSelectedEvent"
                @delete="handleUpcomingDelete"
                @request="handleAttendanceRequest"
              />
            </template>
          </div>
        </section>

        <aside v-if="!editorHidden" class="panel editor" aria-label="Fiche faluchard">
          <PersonForm
            :person="selectedPerson"
            :people="people"
            :role-options="roleOptions"
            @save="handlePersonFormSave"
            @new="createPerson"
            @editing="markEditing"
          />
          <PersonDetails :person="selectedPerson" :role-options="roleOptions" />
          <details class="editor-directory">
            <summary>
              <span>Fiches existantes</span>
              <small>{{ people.length }}</small>
            </summary>
            <PeopleList
              :people="people"
              :selected-person-id="selectedPersonId"
              @select="selectPerson"
            />
          </details>
          <button
            v-if="selectedPerson"
            type="button"
            class="text-button danger-text editor-delete"
            @click="deletePerson(selectedPerson.id)"
          >
            Supprimer cette personne
          </button>
        </aside>
      </section>
    </template>

    <section v-if="activeOverlay" class="legacy-overlay" aria-live="polite">
      <div class="legacy-overlay__panel">
        <button class="overlay-close" type="button" @click="activeOverlay = ''">Fermer</button>

        <ExportPanel
          v-if="activeOverlay === 'exports'"
          @export-active="exportActiveGenealogy"
          @export-all="exportAllGenealogies"
        />

        <template v-else-if="activeOverlay === 'doleances'">
          <DoleancePanel v-if="!adminSession" @submit="doleances.submitPublicDoleance" />
          <AdminDoleanceList
            v-if="adminSession"
            :items="doleanceItems"
            :loading="doleanceLoading"
            :error="doleanceError"
            @resolve="doleances.setResolved"
          />
        </template>

        <template v-else-if="activeOverlay === 'admin'">
          <AdminPanel
            :session="adminSession"
            :loading="adminLoading"
            :error="adminError"
            @login="admin.login"
            @logout="handleAdminLogout"
            @change-password="({ regionId, password }) => admin.updateRegionPassword(regionId, password)"
          />
          <GenealogyAdmin
            v-if="adminSession"
            :genealogies="genealogies"
            :session="adminSession"
            @create="handleGenealogyCreate"
            @delete="handleGenealogyDelete"
            @update="handleGenealogyUpdate"
          />
        </template>
      </div>
    </section>

    <p v-if="feedbackMessage" class="feedback-toast" :class="`feedback-toast--${feedbackKind}`" role="status">
      {{ feedbackMessage }}
    </p>

    <footer class="app-footer">
      <a href="./privacy.html">Politique de confidentialité / RGPD</a>
    </footer>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAdmin } from './composables/useAdmin.js'
import { useDoleances } from './composables/useDoleances.js'
import { useGenealogyData } from './composables/useGenealogyData.js'
import { buildGraphModel } from './domain/graph.js'
import { cooptageRoleForRegion, roleOptionsForGenealogy } from './domain/roles.js'
import { computeStats } from './domain/stats.js'
import AdminPanel from './features/admin/AdminPanel.vue'
import GenealogyAdmin from './features/admin/GenealogyAdmin.vue'
import AdminDoleanceList from './features/doleances/AdminDoleanceList.vue'
import DoleancePanel from './features/doleances/DoleancePanel.vue'
import ExportPanel from './features/exports/ExportPanel.vue'
import GenealogyGraph from './features/graph/GenealogyGraph.vue'
import AppHeader from './features/layout/AppHeader.vue'
import OverviewPanel from './features/overview/OverviewPanel.vue'
import NewcomersPanel from './features/people/NewcomersPanel.vue'
import PeopleList from './features/people/PeopleList.vue'
import PersonDetails from './features/people/PersonDetails.vue'
import PersonForm from './features/people/PersonForm.vue'
import StatsDashboard from './features/stats/StatsDashboard.vue'
import UpcomingComposer from './features/upcoming/UpcomingComposer.vue'
import UpcomingView from './features/upcoming/UpcomingView.vue'

const views = [
  { id: 'tree', label: 'Arbre' },
  { id: 'network', label: 'Réseau' },
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'newcomers', label: 'Nouveaux venus' },
  { id: 'stats', label: 'Statistiques' },
  { id: 'upcoming', label: 'Event à venir' },
]

const activeView = ref('tree')
const activeOverlay = ref('')
const searchQuery = ref('')
const ancestorDepth = ref(20)
const descendantDepth = ref(20)
const graphZoom = ref(1)
const searchMenu = ref(null)
const searchInput = ref(null)
const feedbackMessage = ref('')
const feedbackKind = ref('success')
let feedbackTimeout = 0
let autosaveTimeout = 0
let editingTimeout = 0
const editing = ref(false)

const {
  loading,
  saving,
  error,
  loginUrl,
  csrfToken,
  data,
  genealogies,
  selectedGenealogyId,
  selectedGenealogy,
  selectedPersonId,
  selectedPerson,
  people,
  selectGenealogy,
  selectPerson,
  updatePerson,
  createPerson,
  deletePerson,
  upcoming,
  addGenealogy,
  deleteGenealogy,
  patchGenealogy,
  save,
} = useGenealogyData()

const doleances = useDoleances(csrfToken)
const admin = useAdmin(csrfToken)
const adminSession = computed(() => admin.session.value)
const adminLoading = computed(() => admin.loading.value)
const adminError = computed(() => admin.error.value)
const doleanceItems = computed(() => doleances.items.value)
const doleanceLoading = computed(() => doleances.loading.value)
const doleanceError = computed(() => doleances.error.value)
const stats = computed(() => computeStats(genealogies.value))
const graph = computed(() =>
  buildGraphModel(people.value, {
    focusId: selectedPersonId.value,
    mode: activeView.value,
    ancestorDepth: ancestorDepth.value,
    descendantDepth: descendantDepth.value,
  }),
)
const upcomingEvents = computed(() => upcoming.events.value)
const selectedUpcomingEventIds = computed(() => upcoming.selectedEventIds.value)
const upcomingRegion = computed(() => upcoming.region.value)
const editorHidden = computed(() => ['stats', 'upcoming'].includes(activeView.value))
const roleOptions = computed(() => roleOptionsForGenealogy(genealogies.value, selectedGenealogy.value))
const cooptageRole = computed(() => cooptageRoleForRegion(upcomingRegion.value))

const statusLabel = computed(() => {
  if (loading.value) return 'Synchronisation'
  if (error.value) return 'Hors ligne'
  if (saving.value) return 'Sauvegarde…'
  return 'En ligne'
})

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []
  return people.value
    .filter((person) => {
      return [person.name, person.nickname, person.song]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    })
    .slice(0, 6)
})

const focusTitle = computed(() => {
  if (activeView.value === 'overview') return "Vue d'ensemble"
  if (activeView.value === 'newcomers') return 'Nouveaux venus'
  if (activeView.value === 'stats') return 'Statistiques'
  if (activeView.value === 'upcoming') return 'Événements à venir'
  return selectedPerson.value?.name || 'Aucun faluchard sélectionné'
})
const focusSubtitle = computed(() => {
  if (activeView.value === 'overview') return `${people.value.length} faluchard(s), triés par filière`
  if (activeView.value === 'newcomers') return 'Les derniers baptêmes renseignés, du plus ancien au plus récent'
  if (activeView.value === 'stats') {
    return `${stats.value.peopleCount} fiche(s), ${stats.value.baptizedCount} baptisé(s), ${stats.value.unbaptizedCount} non baptisé(s)`
  }
  if (activeView.value === 'upcoming') {
    return upcomingRegion.value
      ? `${upcomingEvents.value.length} annonce(s) visible(s) dans ${upcomingRegion.value.name}`
      : 'Ouvre une faluche de région ou une famille pour voir les annonces.'
  }
  if (!selectedPerson.value) return 'Ajoute une personne pour commencer.'
  const nickname = selectedPerson.value.nickname ? ` — ${selectedPerson.value.nickname}` : ''
  return `${selectedGenealogy.value?.name || 'Généalogie active'}${nickname}`
})

async function openAdmin() {
  activeOverlay.value = 'admin'
  await admin.refresh()
}

async function handleAdminLogout() {
  if (adminSession.value?.level === 'general') {
    await doleances.removeResolved()
  }
  await admin.logout()
}

async function handlePersonFormSave(updatedPerson) {
  const personId = updatedPerson?.id || ''
  updatePerson(updatedPerson)
  const saved = await save()

  if (!saved) {
    showFeedback("La fiche n'a pas pu être enregistrée pour le moment.", 'warning')
    return
  }

  const savedPerson = people.value.find((person) => person.id === personId)
  if (personUpdateWasApplied(updatedPerson, savedPerson)) {
    showFeedback('La fiche a bien été modifiée.', 'success')
    return
  }

  showFeedback(
    "Cette fiche n'est modifiable qu'en mode admin. Pour demander un changement, envoie une doléance.",
    'warning',
  )
}

function handlePersonFocus(personId) {
  selectPerson(personId)
  activeView.value = 'tree'
}

function adjustZoom(delta) {
  graphZoom.value = Math.min(1.8, Math.max(0.5, Number((graphZoom.value + delta).toFixed(2))))
}

function resetZoom() {
  graphZoom.value = 1
}

async function handleAttendanceRequest(payload) {
  if (!upcoming.requestAttendance(payload)) return
  scheduleAutosave()
}

async function handleUpcomingCreate(payload) {
  if (!upcoming.createEvent(payload)) return
  scheduleAutosave()
}

async function handleUpcomingDelete(eventId) {
  upcoming.deleteEvent(eventId)
  scheduleAutosave()
}

async function handleGenealogyCreate(payload) {
  addGenealogy(payload)
  scheduleAutosave()
}

async function handleGenealogyDelete(genealogyId) {
  deleteGenealogy(genealogyId)
  scheduleAutosave()
}

function handleGenealogyUpdate({ genealogyId, patch }) {
  patchGenealogy(genealogyId, patch)
  scheduleAutosave()
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function exportActiveGenealogy() {
  downloadJson(`${selectedGenealogyId.value || 'genealogie'}.json`, selectedGenealogy.value)
}

function exportAllGenealogies() {
  downloadJson('faluche-nationale.json', data.value)
}

function personUpdateWasApplied(expectedPerson, savedPerson) {
  if (!expectedPerson || !savedPerson) return false
  const fields = [
    'name',
    'nickname',
    'filiere',
    'baptismCity',
    'baptismDate',
    'baptismStatus',
    'song',
  ]
  return (
    fields.every((field) => (savedPerson[field] || '') === (expectedPerson[field] || '')) &&
    sameStringArray(savedPerson.nicknames, expectedPerson.nicknames) &&
    sameStringArray(savedPerson.roles, expectedPerson.roles)
  )
}

function sameStringArray(left = [], right = []) {
  return JSON.stringify(left || []) === JSON.stringify(right || [])
}

function showFeedback(message, kind = 'success') {
  feedbackMessage.value = message
  feedbackKind.value = kind
  window.clearTimeout(feedbackTimeout)
  feedbackTimeout = window.setTimeout(() => {
    feedbackMessage.value = ''
  }, 4200)
}

function markEditing() {
  editing.value = true
  window.clearTimeout(editingTimeout)
  editingTimeout = window.setTimeout(() => {
    editing.value = false
  }, 1200)
}

function scheduleAutosave(delay = 1400) {
  window.clearTimeout(autosaveTimeout)
  autosaveTimeout = window.setTimeout(async () => {
    if (editing.value) {
      scheduleAutosave()
      return
    }
    await save()
  }, delay)
}

async function handleSearchToggle() {
  if (!searchMenu.value?.open) return
  await nextTick()
  searchInput.value?.focus({ preventScroll: true })
}

function selectSearchResult(personId) {
  selectPerson(personId)
  searchQuery.value = ''
  if (searchMenu.value) searchMenu.value.open = false
}

function closeSearchOnOutsideClick(event) {
  if (!searchMenu.value?.open || searchMenu.value.contains(event.target)) return
  searchMenu.value.open = false
}

watch(
  adminSession,
  async (session) => {
    if (session && activeOverlay.value === 'doleances') {
      await doleances.loadAdminDoleances()
    }
  },
)

watch(activeOverlay, async (overlay) => {
  if (overlay === 'doleances' && adminSession.value) {
    await doleances.loadAdminDoleances()
  }
})

onMounted(() => {
  document.addEventListener('pointerdown', closeSearchOnOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeSearchOnOutsideClick)
  window.clearTimeout(feedbackTimeout)
  window.clearTimeout(autosaveTimeout)
  window.clearTimeout(editingTimeout)
})
</script>
