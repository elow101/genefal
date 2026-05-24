<template>
  <main ref="pageTop" class="app-shell">
    <AppHeader
      :genealogies="genealogies"
      :selected-genealogy-id="selectedGenealogyId"
      :selected-genealogy-name="selectedGenealogy?.name || 'Faluche Nationale'"
      :status-label="statusLabel"
      :error="error"
      @select-genealogy="selectGenealogy"
      @go-home="activeView = 'home'"
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
        <PersonSearch
          v-model="searchQuery"
          :results="searchResults"
          @select="selectSearchResult"
        />

        <AppField label="Ascendants visibles">
          <input v-model.number="ancestorDepth" type="number" min="0" max="20" />
        </AppField>

        <AppField label="Descendants visibles">
          <input v-model.number="descendantDepth" type="number" min="0" max="20" />
        </AppField>

        <button class="add-sheet-button" type="button" @click="beginPersonCreation">
          Fiche d'ajout
        </button>
      </section>

      <section
        class="workspace"
        :class="{
          'workspace--editor-hidden': editorHidden,
          'workspace--document-flow': !graphIsPannable,
        }"
      >
        <section
          class="graph-area"
          :class="{ 'graph-area--document-flow': !graphIsPannable }"
          aria-label="Visualisation généalogique"
        >
          <div class="graph-header">
            <div class="graph-header-copy">
              <h2>{{ focusTitle }}</h2>
              <p>{{ focusSubtitle }}</p>
            </div>

            <ViewSwitcher v-model="activeView" :views="views" />
          </div>

          <div
            class="graph-stage-wrap"
            :class="{
              'graph-stage-wrap--pannable': graphIsPannable,
              'graph-stage-wrap--document-flow': !graphIsPannable,
            }"
          >
            <div
              v-if="activeView === 'tree' || activeView === 'network'"
              class="zoom-controls graph-stage-zoom"
              aria-label="Zoom de l'arbre"
            >
              <button type="button" title="Zoom arrière" aria-label="Zoom arrière" @click="adjustZoom(-0.1)">−</button>
              <button type="button" title="Recentrer le graphe" aria-label="Recentrer le graphe" @click="resetZoom">
                {{ Math.round(graphZoom * 100) }}%
              </button>
              <button type="button" title="Zoom avant" aria-label="Zoom avant" @click="adjustZoom(0.1)">+</button>
            </div>
            <div
              v-if="activeView === 'tree' || activeView === 'network'"
              ref="graphViewport"
              class="graph-viewport"
              :class="{ 'is-touch-panning': graphPan.active }"
              @pointerdown="startGraphPan"
              @pointermove="moveGraphPan"
              @pointerup="endGraphPan"
              @pointercancel="endGraphPan"
              @lostpointercapture="endGraphPan"
              @wheel="handleGraphWheel"
              @click.capture="cancelClickAfterGraphPan"
            >
              <div v-if="graph.legend" class="graph-legend graph-legend--viewport" aria-label="Légende des liens">
                <span><i class="legend-line"></i>Parrain / marraine</span>
                <span><i class="legend-line heart"></i>Parrain / marraine de cœur</span>
                <span><i class="legend-line adoption"></i>Adoption</span>
                <span><i class="legend-line adoption-heart"></i>Adoption de cœur</span>
                <span><i class="legend-line confirmation"></i>Confirmation</span>
                <span><i class="legend-line confirmation-heart"></i>Confirmation de cœur</span>
                <span><i class="legend-line cross"></i>Baptême croisé</span>
              </div>
              <div class="graph-pan-content" :style="graphPanStyle">
                <GenealogyGraph
                  :graph="graph"
                  :selected-person-id="selectedPersonId"
                  :zoom="graphZoom"
                  :mode="activeView"
                  :role-options="roleOptions"
                  :show-legend="false"
                  @select="selectPerson"
                />
              </div>
            </div>
            <p v-if="activeView === 'tree' || activeView === 'network'" class="graph-help">
              Glisse dans une zone vide pour déplacer le graphe. Clique une fiche pour ses détails. Sur mobile, pince pour zoomer.
            </p>
            <button
              v-if="activeView === 'tree' || activeView === 'network'"
              class="graph-scroll-top"
              type="button"
              aria-label="Remonter en haut de la page"
              @click="scrollToTop"
            >
              ↑
            </button>
            <OverviewPanel
              v-else-if="activeView === 'overview'"
              :people="people"
              @select="handlePersonFocus"
            />
            <StatsDashboard v-else-if="activeView === 'stats'" :stats="stats" :people="people" @select="handlePersonFocus" />
            <template v-else>
              <section v-if="activeView === 'home'" class="home-panel">
                <div class="home-actions" aria-label="Actions principales">
                  <button type="button" class="primary" @click="activeView = 'tree'">Explorer l'arbre</button>
                  <button type="button" @click="activeView = 'upcoming'">Voir les prochains events</button>
                  <button type="button" @click="beginPersonCreation">Ajouter une fiche</button>
                  <button type="button" class="tutorial-launch" @click="openTutorial">Tuto</button>
                </div>
                <div class="home-summary" aria-label="Résumé">
                  <article>
                    <strong>{{ people.length }}</strong>
                    <span>fiche(s)</span>
                  </article>
                  <article>
                    <strong>{{ genealogies.length }}</strong>
                    <span>arbre(s)</span>
                  </article>
                  <article>
                    <strong>{{ upcomingEvents.length }}</strong>
                    <span>annonce(s)</span>
                  </article>
                </div>
              </section>
              <template v-else>
                <UpcomingComposer
                  :people="people"
                  :enabled="Boolean(upcomingRegion)"
                  :cooptage-role="cooptageRole"
                  @create="handleUpcomingCreate"
                />
                <section v-if="upcomingCreatorPassword" class="notice upcoming-secret">
                  <strong>Mot de passe créateur</strong>
                  <p>Note-le maintenant, il ne sera plus affiché ensuite.</p>
                  <code>{{ upcomingCreatorPassword }}</code>
                  <button type="button" class="text-button" @click="copyUpcomingPassword">Copier</button>
                </section>
                <UpcomingView
                  :events="upcomingEvents"
                  :people="people"
                  :region="upcomingRegion"
                  :cooptage-role-label="cooptageRole.label"
                  :can-delete="Boolean(adminSession)"
                  @delete="handleUpcomingDelete"
                  @request="handleAttendanceRequest"
                  @subscribe="handleUpcomingSubscribe"
                  @unsubscribe="handleUpcomingUnsubscribe"
                  @creator-access="handleUpcomingCreatorAccess"
                  @request-status="handleUpcomingRequestStatus"
                  @creator-delete="handleUpcomingCreatorDelete"
                />
              </template>
            </template>
          </div>
        </section>

        <aside v-if="!editorHidden" ref="editorPanel" class="panel editor" aria-label="Fiche faluchard">
          <PersonForm
            :person="selectedPerson"
            :people="people"
            :genealogy-options="personCreationGenealogyOptions"
            :selected-genealogy-id="selectedPersonSourceGenealogy?.id || selectedGenealogyId"
            :can-select-genealogy="selectedPersonId === newPersonId"
            :role-options="roleOptions"
            :can-manage-ceremony-events="Boolean(adminSession)"
            @save="handlePersonFormSave"
            @new="beginPersonCreation"
            @change-genealogy="handleNewPersonGenealogyChange"
            @editing="markEditing"
          />
          <PersonDetails :person="selectedPerson" :role-options="roleOptions" />
          <section v-if="canMoveSelectedPerson" class="person-move">
            <h3>Déplacer la fiche</h3>
            <p>
              Arbre actuel :
              <strong>{{ selectedPersonSourceGenealogy?.name }}</strong>
            </p>
            <label>
              Nouvel arbre
              <select v-model="moveTargetGenealogyId">
                <option
                  v-for="genealogy in movableGenealogyOptions"
                  :key="genealogy.id"
                  :value="genealogy.id"
                >
                  {{ genealogy.name }}
                </option>
              </select>
            </label>
            <button class="primary" type="button" @click="moveSelectedPerson">
              Déplacer
            </button>
          </section>
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

    <section
      v-if="activeOverlay"
      class="legacy-overlay"
      aria-live="polite"
      role="dialog"
      aria-modal="true"
      @keydown="handleOverlayKeydown"
    >
      <div ref="overlayPanel" class="legacy-overlay__panel" tabindex="-1">
        <button ref="overlayClose" class="overlay-close" type="button" @click="activeOverlay = ''">Fermer</button>

        <template v-if="activeOverlay === 'doleances'">
          <DoleancePanel v-if="!adminSession" @submit="handleDoleanceSubmit" />
          <AdminDoleanceList
            v-if="adminSession"
            :items="doleanceItems"
            :loading="doleanceLoading"
            :error="doleanceError"
            @resolve="doleances.setResolved"
          />
        </template>

        <ExportPanel
          v-else-if="activeOverlay === 'exports'"
          :selected-person="selectedPerson"
          @cancel="activeOverlay = ''"
          @export-pdf="exportSelectedPersonPdf"
        />

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

    <TutorialOverlay
      v-if="tutorialOpen"
      @finish="completeTutorial"
      @skip="completeTutorial"
    />

    <footer class="app-footer">
      <a href="./privacy.html">Politique de confidentialité / RGPD</a>
    </footer>
  </main>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppField from './components/ui/AppField.vue'
import { useAdmin } from './composables/useAdmin.js'
import { useDebouncedValue } from './composables/useDebouncedValue.js'
import { useDoleances } from './composables/useDoleances.js'
import { useGenealogyData } from './composables/useGenealogyData.js'
import { getPersonSourceGenealogy, movePersonToGenealogy } from './domain/genealogy.js'
import { buildGraphModel } from './domain/graph.js'
import { cooptageRoleForRegion, roleOptionsForGenealogy } from './domain/roles.js'
import { normalizeSearchText, personMatchesSearch } from './domain/search.js'
import { computeStats } from './domain/stats.js'
import GenealogyGraph from './features/graph/GenealogyGraph.vue'
import AppHeader from './features/layout/AppHeader.vue'
import ViewSwitcher from './features/layout/ViewSwitcher.vue'
import OverviewPanel from './features/overview/OverviewPanel.vue'
import PeopleList from './features/people/PeopleList.vue'
import PersonDetails from './features/people/PersonDetails.vue'
import PersonForm from './features/people/PersonForm.vue'
import PersonSearch from './features/search/PersonSearch.vue'
import TutorialOverlay from './features/tutorial/TutorialOverlay.vue'

const AdminPanel = defineAsyncComponent(() => import('./features/admin/AdminPanel.vue'))
const GenealogyAdmin = defineAsyncComponent(() => import('./features/admin/GenealogyAdmin.vue'))
const AdminDoleanceList = defineAsyncComponent(() => import('./features/doleances/AdminDoleanceList.vue'))
const DoleancePanel = defineAsyncComponent(() => import('./features/doleances/DoleancePanel.vue'))
const ExportPanel = defineAsyncComponent(() => import('./features/exports/ExportPanel.vue'))
const StatsDashboard = defineAsyncComponent(() => import('./features/stats/StatsDashboard.vue'))
const UpcomingComposer = defineAsyncComponent(() => import('./features/upcoming/UpcomingComposer.vue'))
const UpcomingView = defineAsyncComponent(() => import('./features/upcoming/UpcomingView.vue'))

const views = [
  { id: 'home', label: 'Accueil' },
  { id: 'tree', label: 'Arbre' },
  { id: 'network', label: 'Réseau' },
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'stats', label: 'Statistiques' },
  { id: 'upcoming', label: 'Event à venir' },
]

const activeView = ref('home')
const activeOverlay = ref('')
const searchQuery = ref('')
const ancestorDepth = ref(20)
const descendantDepth = ref(20)
const graphZoom = ref(1)
const upcomingCreatorPassword = ref('')
const moveTargetGenealogyId = ref('')
const pageTop = ref(null)
const editorPanel = ref(null)
const overlayPanel = ref(null)
const overlayClose = ref(null)
const graphViewport = ref(null)
const feedbackMessage = ref('')
const feedbackKind = ref('success')
const tutorialOpen = ref(false)
const newPersonId = ref('')
let feedbackTimeout = 0
let autosaveTimeout = 0
let editingTimeout = 0
const editing = ref(false)
const graphPan = ref({
  active: false,
  moved: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startPanX: 0,
  startPanY: 0,
  x: 0,
  y: 0,
})
let graphPanFrame = 0
let pendingGraphPanX = 0
let pendingGraphPanY = 0
let suppressGraphClickUntil = 0

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
const debouncedSearchQuery = useDebouncedValue(searchQuery, 180)
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
    includeAllNetwork: activeView.value === 'network' && selectedGenealogy.value?.type === 'national',
  }),
)
const graphIsPannable = computed(() => ['tree', 'network'].includes(activeView.value))
const graphPanStyle = computed(() => ({
  transform: `translate3d(${graphPan.value.x}px, ${graphPan.value.y}px, 0)`,
}))
const graphContentSize = computed(() => {
  if (activeView.value === 'network') {
    return {
      width: Math.max(graph.value.width || 0, 960, ...graph.value.nodes.map((entry) => entry.x + 170)) * graphZoom.value,
      height: Math.max(graph.value.height || 0, 540, ...graph.value.nodes.map((entry) => entry.y + 190)) * graphZoom.value,
    }
  }

  const maxCardsPerLine = 5
  const cardWidth = 180
  const cardHeight = 92
  const gap = 18
  const rowGap = 86
  const maxCardsInVisualRow = Math.min(
    maxCardsPerLine,
    Math.max(1, ...graph.value.rows.map((row) => Math.min(maxCardsPerLine, Math.max(1, row.people.length)))),
  )
  const visualRows = graph.value.rows.reduce(
    (total, row) => total + Math.max(1, Math.ceil(row.people.length / maxCardsPerLine)),
    0,
  )
  return {
    width: (maxCardsInVisualRow * cardWidth + (maxCardsInVisualRow - 1) * gap + 80) * graphZoom.value,
    height: Math.max(540, visualRows * cardHeight + Math.max(0, visualRows - 1) * rowGap + 140) * graphZoom.value,
  }
})
const upcomingEvents = computed(() => upcoming.events.value)
const upcomingRegion = computed(() => upcoming.region.value)
const editorHidden = computed(() => ['stats', 'upcoming'].includes(activeView.value))
const roleOptions = computed(() => roleOptionsForGenealogy(genealogies.value, selectedGenealogy.value))
const cooptageRole = computed(() => cooptageRoleForRegion(upcomingRegion.value))
const selectedPersonSourceGenealogy = computed(() =>
  selectedPerson.value ? getPersonSourceGenealogy(data.value, selectedPerson.value.id) : null,
)
const adminManageableGenealogyIds = computed(() => {
  const session = adminSession.value
  if (!session) return []
  if (session.level === 'general') {
    return genealogies.value.map((genealogy) => genealogy.id)
  }
  if (session.level !== 'region' || !session.regionId) return []

  return genealogies.value
    .filter((genealogy) => genealogy.id === session.regionId || genealogy.parentId === session.regionId)
    .map((genealogy) => genealogy.id)
})
const movableGenealogyOptions = computed(() => {
  const session = adminSession.value
  const source = selectedPersonSourceGenealogy.value
  if (!session || !source) return []

  const manageableIds = new Set(adminManageableGenealogyIds.value)
  if (session.level === 'region' && !manageableIds.has(source.id)) return []

  return genealogies.value
    .filter((genealogy) => genealogy.type !== 'national')
    .filter((genealogy) => genealogy.id !== source.id)
    .filter((genealogy) => session.level === 'general' || manageableIds.has(genealogy.id))
    .sort((left, right) => genealogySortLabel(left).localeCompare(genealogySortLabel(right), 'fr'))
})
const canMoveSelectedPerson = computed(() => movableGenealogyOptions.value.length > 0)
const personCreationGenealogyOptions = computed(() =>
  genealogies.value
    .filter((genealogy) => genealogy.type !== 'national')
    .map((genealogy) => ({
      id: genealogy.id,
      name: genealogy.name,
      type: genealogy.type || '',
      parentName: genealogies.value.find((candidate) => candidate.id === genealogy.parentId)?.name || '',
    }))
    .sort((left, right) => genealogySortLabel(left).localeCompare(genealogySortLabel(right), 'fr')),
)

const statusLabel = computed(() => {
  if (loading.value) return 'Synchronisation'
  if (error.value) return 'Hors ligne'
  if (saving.value) return 'Sauvegarde…'
  return 'En ligne'
})

const searchResults = computed(() => {
  const query = normalizeSearchText(debouncedSearchQuery.value)
  if (!query) return []
  return people.value
    .filter((person) => personMatchesSearch(person, query, ['song', 'baptismCity', 'filiere']))
    .slice(0, 6)
})

const focusTitle = computed(() => {
  if (activeView.value === 'home') return 'Accueil'
  if (activeView.value === 'overview') return "Vue d'ensemble"
  if (activeView.value === 'stats') return 'Statistiques'
  if (activeView.value === 'upcoming') return 'Événements à venir'
  return selectedPerson.value?.name || 'Aucun faluchard sélectionné'
})
const focusSubtitle = computed(() => {
  if (activeView.value === 'home') return 'Choisis une action pour commencer.'
  if (activeView.value === 'overview') return `${people.value.length} faluchard(s), triés par filière`
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
const pageTitle = computed(() => `${focusTitle.value} | Faluche Nationale`)
const pageDescription = computed(() => {
  if (activeView.value === 'stats') return 'Statistiques de la genealogie de faluche active.'
  if (activeView.value === 'upcoming') return 'Evenements a venir et demandes de presence.'
  if (activeView.value === 'overview') return 'Vue lisible des faluchards groupes par filiere.'
  return 'Recherche, edition et visualisation mobile-first de genealogies de faluche.'
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

async function handleDoleanceSubmit(payload) {
  try {
    const result = await doleances.submitPublicDoleance(payload)
    const remaining = Number.isFinite(result?.remaining) ? ` Il reste ${result.remaining} envoi(s) pour cette session.` : ''
    showFeedback(`Doléance envoyée.${remaining}`, 'success')
  } catch (error) {
    showFeedback(error.message || 'Impossible d’envoyer la doléance.', 'warning')
  }
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
    if (newPersonId.value === personId) newPersonId.value = ''
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
  setGraphZoom(graphZoom.value + delta)
}

function setGraphZoom(value) {
  graphZoom.value = Math.min(1.8, Math.max(0.5, Number(value.toFixed(2))))
  const next = clampGraphPan(graphPan.value.x, graphPan.value.y)
  graphPan.value = { ...graphPan.value, x: next.x, y: next.y }
}

function resetZoom() {
  graphZoom.value = 1
  resetGraphPan()
}

function beginPersonCreation() {
  if (editorHidden.value || activeView.value === 'home') activeView.value = 'tree'
  const person = createPerson()
  newPersonId.value = person?.id || ''
  const source = person?.id ? getPersonSourceGenealogy(data.value, person.id) : null
  if (source && source.id !== selectedGenealogyId.value) {
    selectGenealogy(source.id)
    selectPerson(person.id)
  }
  nextTick(() => {
    editorPanel.value?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  })
}

function handleNewPersonGenealogyChange(targetGenealogyId) {
  const personId = selectedPerson.value?.id || ''
  if (!personId || personId !== newPersonId.value || !targetGenealogyId) return

  const previousState = data.value
  data.value = movePersonToGenealogy(data.value, personId, targetGenealogyId)
  if (data.value === previousState) return

  selectGenealogy(targetGenealogyId)
  nextTick(() => {
    selectPerson(personId)
  })
}

function scrollToTop() {
  pageTop.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

function startGraphPan(event) {
  if (!graphIsPannable.value || !event.isPrimary) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (isGraphSelectableTarget(event.target)) return
  const viewport = graphViewport.value
  if (!viewport) return

  graphPan.value = {
    ...graphPan.value,
    active: true,
    moved: false,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startPanX: graphPan.value.x,
    startPanY: graphPan.value.y,
  }
  viewport.setPointerCapture?.(event.pointerId)
}

const GRAPH_PAN_CLICK_THRESHOLD = 5

function moveGraphPan(event) {
  const pan = graphPan.value
  if (!pan.active || event.pointerId !== pan.pointerId) return

  const deltaX = event.clientX - pan.startX
  const deltaY = event.clientY - pan.startY
  const movedEnough = Math.abs(deltaX) > GRAPH_PAN_CLICK_THRESHOLD || Math.abs(deltaY) > GRAPH_PAN_CLICK_THRESHOLD
  if (!movedEnough && !pan.moved) return

  event.preventDefault()
  pendingGraphPanX = pan.startPanX + deltaX
  pendingGraphPanY = pan.startPanY + deltaY
  if (graphPanFrame) return

  graphPanFrame = window.requestAnimationFrame(() => {
    graphPanFrame = 0
    const next = clampGraphPan(pendingGraphPanX, pendingGraphPanY)
    graphPan.value = { ...graphPan.value, moved: true, x: next.x, y: next.y }
  })
}

function endGraphPan(event) {
  const pan = graphPan.value
  if (!pan.active || event.pointerId !== pan.pointerId) return
  if (graphPanFrame) {
    window.cancelAnimationFrame(graphPanFrame)
    graphPanFrame = 0
    const next = clampGraphPan(pendingGraphPanX, pendingGraphPanY)
    graphPan.value = { ...graphPan.value, moved: true, x: next.x, y: next.y }
  }
  try {
    graphViewport.value?.releasePointerCapture?.(event.pointerId)
  } catch {
    // Some browsers release capture before firing lostpointercapture.
  }
  const moved = graphPan.value.moved
  if (moved) suppressGraphClickUntil = Date.now() + 250
  graphPan.value = { ...graphPan.value, active: false, pointerId: null }
}

function cancelClickAfterGraphPan(event) {
  if (Date.now() > suppressGraphClickUntil) return
  event.preventDefault()
  event.stopPropagation()
}

function handleGraphWheel(event) {
  if (!graphIsPannable.value || event.ctrlKey) return
  const deltaX = event.shiftKey ? event.deltaY : event.deltaX
  const deltaY = event.shiftKey ? 0 : event.deltaY
  const next = clampGraphPan(graphPan.value.x - deltaX, graphPan.value.y - deltaY)
  graphPan.value = {
    ...graphPan.value,
    x: next.x,
    y: next.y,
  }
  event.preventDefault()
}

function clampGraphPan(x, y) {
  const viewport = graphViewport.value
  if (!viewport) return { x, y }
  const content = graphContentSize.value
  const horizontalMargin = Math.max(content.width * 1.5, viewport.clientWidth * 8, 2400)
  const verticalMargin = Math.max(content.height, viewport.clientHeight * 5, 1800)
  const mobileVirtualWidth =
    viewport.clientWidth <= 640 ? Math.max(content.width + viewport.clientWidth * 6, viewport.clientWidth * 9) : 0
  const virtualWidth = viewport.clientWidth <= 640 ? Math.max(content.width, mobileVirtualWidth) : content.width
  const minX = Math.min(horizontalMargin, viewport.clientWidth - virtualWidth - horizontalMargin)
  const maxX = horizontalMargin
  const minY = Math.min(verticalMargin, viewport.clientHeight - content.height - verticalMargin)
  const maxY = verticalMargin
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  }
}

function isGraphSelectableTarget(target) {
  return Boolean(target?.closest?.('.graph-node, .node-card'))
}

function resetGraphPan() {
  window.cancelAnimationFrame(graphPanFrame)
  graphPanFrame = 0
  graphPan.value = {
    ...graphPan.value,
    active: false,
    moved: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    x: 0,
    y: 0,
  }
}

async function handleAttendanceRequest(payload, done = () => {}) {
  try {
    if (!(await upcoming.requestAttendance(payload))) {
      done(false)
      return
    }
    done(true)
    showFeedback('Demande envoyée.', 'success')
  } catch (err) {
    done(false)
    showFeedback(err.message || 'Demande impossible.', 'warning')
  }
}

async function handleUpcomingCreate(payload) {
  const result = await upcoming.createEvent(payload)
  if (!result) return
  upcomingCreatorPassword.value = result.temporaryPassword || ''
  scheduleAutosave()
  showFeedback("L'annonce a été créée.", 'success')
}

async function handleUpcomingDelete(eventId) {
  upcoming.deleteEvent(eventId)
  scheduleAutosave()
  showFeedback("L'annonce a été supprimée.", 'success')
}

async function handleUpcomingSubscribe(payload) {
  try {
    await upcoming.subscribeRegion(payload)
    showFeedback('Abonnement aux événements activé.', 'success')
  } catch (err) {
    showFeedback(err.message || 'Abonnement impossible.', 'warning')
  }
}

async function handleUpcomingUnsubscribe(payload) {
  try {
    await upcoming.unsubscribeRegion(payload)
    showFeedback('Désabonnement pris en compte.', 'success')
  } catch (err) {
    showFeedback(err.message || 'Désabonnement impossible.', 'warning')
  }
}

async function handleUpcomingCreatorAccess(payload, done) {
  try {
    const result = await upcoming.creatorAccess(payload)
    done(result.event)
  } catch (err) {
    showFeedback(err.message || 'Accès créateur refusé.', 'warning')
    done(null)
  }
}

async function handleUpcomingRequestStatus(payload, done) {
  try {
    await upcoming.setRequestStatus(payload)
    showFeedback('Statut de demande mis à jour.', 'success')
    done(true)
  } catch (err) {
    showFeedback(err.message || 'Mise à jour impossible.', 'warning')
    done(false)
  }
}

async function handleUpcomingCreatorDelete(payload, done) {
  try {
    await upcoming.deleteEventAsCreator(payload)
    showFeedback("L'événement a été supprimé.", 'success')
    done(true)
  } catch (err) {
    showFeedback(err.message || 'Suppression impossible.', 'warning')
    done(false)
  }
}

async function copyUpcomingPassword() {
  await navigator.clipboard?.writeText(upcomingCreatorPassword.value)
  showFeedback('Mot de passe copié.', 'success')
}

async function handleGenealogyCreate(payload) {
  addGenealogy(payload)
  scheduleAutosave()
  showFeedback("L'arbre a été créé.", 'success')
}

async function handleGenealogyDelete(genealogyId) {
  deleteGenealogy(genealogyId)
  scheduleAutosave()
  showFeedback("L'arbre a été supprimé.", 'success')
}

function handleGenealogyUpdate({ genealogyId, patch }) {
  patchGenealogy(genealogyId, patch)
  scheduleAutosave()
  showFeedback("L'arbre a été mis à jour.", 'success')
}

async function moveSelectedPerson() {
  const personId = selectedPerson.value?.id || ''
  const targetGenealogyId = moveTargetGenealogyId.value || movableGenealogyOptions.value[0]?.id || ''
  if (!personId || !targetGenealogyId) return

  const allowedIds = adminSession.value?.level === 'region' ? adminManageableGenealogyIds.value : null
  const previousState = data.value
  data.value = movePersonToGenealogy(data.value, personId, targetGenealogyId, allowedIds)

  if (data.value === previousState) {
    showFeedback("Cette fiche ne peut pas être déplacée avec cette session admin.", 'warning')
    return
  }

  selectGenealogy(targetGenealogyId)
  await nextTick()
  selectPerson(personId)
  scheduleAutosave(300)
  showFeedback('La fiche a été déplacée.', 'success')
}

async function exportSelectedPersonPdf({ ancestorDepth: pdfAncestorDepth, descendantDepth: pdfDescendantDepth }) {
  const { downloadNetworkGraphPdf } = await import('./features/exports/pdfExport.js')
  const exported = await downloadNetworkGraphPdf({
    person: selectedPerson.value,
    graph: buildGraphModel(people.value, {
      focusId: selectedPersonId.value,
      mode: 'network',
      ancestorDepth: pdfAncestorDepth,
      descendantDepth: pdfDescendantDepth,
      includeAllNetwork: false,
    }),
    title: selectedGenealogy.value?.name || 'GeneFaluche',
  })
  activeOverlay.value = ''
  showFeedback(exported ? 'Le PDF réseau a été généré.' : "Sélectionne une fiche avant d'exporter.", exported ? 'success' : 'warning')
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
    'crossGroupId',
    'song',
  ]
  return (
    fields.every((field) => (savedPerson[field] || '') === (expectedPerson[field] || '')) &&
    (Number(savedPerson.crossGroupSize) || 0) === (Number(expectedPerson.crossGroupSize) || 0) &&
    sameStringArray(savedPerson.nicknames, expectedPerson.nicknames) &&
    sameStringArray(savedPerson.roles, expectedPerson.roles) &&
    sameStringArray(savedPerson.sponsorIds, expectedPerson.sponsorIds) &&
    sameStringArray(savedPerson.heartSponsorIds, expectedPerson.heartSponsorIds) &&
    JSON.stringify(savedPerson.ceremonyEvents || []) === JSON.stringify(expectedPerson.ceremonyEvents || [])
  )
}

function sameStringArray(left = [], right = []) {
  return JSON.stringify(left || []) === JSON.stringify(right || [])
}

function genealogySortLabel(genealogy) {
  const typeRank = { region: '1', family: '2' }[genealogy.type] || '3'
  return `${typeRank}-${genealogy.name || genealogy.id}`
}

function showFeedback(message, kind = 'success') {
  feedbackMessage.value = message
  feedbackKind.value = kind
  window.clearTimeout(feedbackTimeout)
  feedbackTimeout = window.setTimeout(() => {
    feedbackMessage.value = ''
  }, 4200)
}

function openTutorial() {
  tutorialOpen.value = true
}

function completeTutorial() {
  tutorialOpen.value = false
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

function selectSearchResult(personId) {
  selectPerson(personId)
  activeView.value = 'tree'
  searchQuery.value = ''
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
  if (overlay) {
    await nextTick()
    overlayClose.value?.focus?.({ preventScroll: true })
  }
})

function handleOverlayKeydown(event) {
  if (event.key === 'Escape') {
    activeOverlay.value = ''
    return
  }
  if (event.key !== 'Tab') return

  const focusable = overlayPanel.value
    ? Array.from(
        overlayPanel.value.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
    : []
  if (!focusable.length) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  [selectedGenealogyId, activeView],
  () => {
    resetGraphPan()
  },
)

watch(
  [pageTitle, pageDescription],
  ([title, description]) => {
    document.title = title
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', description)
  },
  { immediate: true },
)

watch(
  movableGenealogyOptions,
  (options) => {
    if (options.some((genealogy) => genealogy.id === moveTargetGenealogyId.value)) return
    moveTargetGenealogyId.value = options[0]?.id || ''
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.clearTimeout(feedbackTimeout)
  window.clearTimeout(autosaveTimeout)
  window.clearTimeout(editingTimeout)
})
</script>
