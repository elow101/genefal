<template>
  <main ref="pageTop" class="app-shell">
    <AppHeader
      :genealogies="genealogies"
      :selected-genealogy-id="selectedGenealogyId"
      :selected-genealogy-name="selectedGenealogy?.name || 'Faluche Nationale'"
      :status-label="statusLabel"
      :error="error"
      @select-genealogy="handleGenealogySelect"
      @go-home="activeView = 'home'"
      @open-help="openHelpCenter"
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

        <button class="add-sheet-button" type="button" @click="beginPersonCreation">
          Fiche d'ajout
        </button>
      </section>

      <section v-if="sessionActions.length && !adminSession" class="session-actions panel" aria-label="Modifications récentes">
        <div>
          <h2>Actions de cette session</h2>
          <p>Ces annulations restent disponibles tant que les données n'ont pas été modifiées ailleurs.</p>
        </div>
        <div class="session-action-list">
          <article v-for="action in sessionActions" :key="action.id" class="session-action">
            <span>{{ action.label }}</span>
            <div>
              <button
                v-if="action.canEdit"
                type="button"
                class="text-button"
                @click="selectSessionPerson(action.personId)"
              >
                Modifier
              </button>
              <button type="button" class="text-button danger-text" :disabled="saving" @click="undoRecentAction(action)">
                Annuler
              </button>
            </div>
          </article>
        </div>
      </section>

      <section
        class="workspace"
        :class="{
          'workspace--editor-hidden': !editorVisible,
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
            <section v-if="activeView === 'tree'" class="graph-layout-controls" aria-label="Mode d'affichage de l'arbre">
              <div class="help-row">
                <span>Mode d'affichage</span>
                <button
                  type="button"
                  class="help-icon"
                  aria-label="Aide sur la lecture des liens et des croisements"
                  @click="openTutorialById('crossed_baptism')"
                >
                  ?
                </button>
              </div>
              <div class="graph-layout-options" role="group" aria-label="Mode d'affichage de l'arbre">
                <button
                  type="button"
                  :class="{ 'is-active': graphLayoutMode === 'network' }"
                  @click="setGraphLayoutMode('network')"
                >
                  Mode Réseau
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': graphLayoutMode === 'tree' }"
                  @click="setGraphLayoutMode('tree')"
                >
                  Mode Hiérarchie
                </button>
              </div>
            </section>
            <div
              v-if="activeView === 'tree'"
              class="zoom-controls graph-stage-zoom"
              aria-label="Zoom de l'arbre"
            >
              <button type="button" title="Zoom arrière" aria-label="Zoom arrière" @click="adjustZoom(-0.1)">−</button>
              <button type="button" title="Réinitialiser le zoom" aria-label="Réinitialiser le zoom" @click="resetZoom">
                {{ Math.round(graphZoom * 100) }}%
              </button>
              <button type="button" title="Zoom avant" aria-label="Zoom avant" @click="adjustZoom(0.1)">+</button>
              <button
                type="button"
                class="zoom-controls__selected"
                title="Recentrer au profil sélectionné"
                aria-label="Recentrer au profil sélectionné"
                :disabled="!selectedPersonId"
                @click="centerSelectedPerson"
              >
                Recentrer au profil sélectionné
              </button>
            </div>
            <div
              v-if="activeView === 'tree'"
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
              <div
                ref="graphPanContent"
                class="graph-pan-content"
                :class="{ 'is-recentering': graphRecentering }"
                :style="graphPanStyle"
              >
                <GenealogyGraph
                  :graph="graph"
                  :selected-person-id="graphFocusPersonId"
                  :zoom="graphRenderZoom"
                  :mode="graphLayoutMode"
                  :role-options="roleOptions"
                  :show-legend="false"
                  :halo-ancestor-depth="networkHaloAncestorDepth"
                  :halo-descendant-depth="networkHaloDescendantDepth"
                  @select="handleGraphSelect"
                />
              </div>
            </div>
            <section
              v-if="activeView === 'tree' && graphLayoutMode === 'network'"
              class="network-halo-controls"
              aria-label="Portée du halo généalogique"
            >
              <div class="network-halo-controls__header">
                <strong>Portée du halo</strong>
                <span>{{ graphFocusPersonId ? 'Appliquée au profil sélectionné' : 'Sélectionne une fiche' }}</span>
                <button
                  type="button"
                  class="help-icon help-icon--inline"
                  aria-label="Aide sur le halo et la compréhension des croisements"
                  @click="openTutorialById('crossed_baptism')"
                >
                  ?
                </button>
              </div>
              <div class="network-halo-controls__groups">
                <div class="network-halo-group" role="group" aria-label="Générations ascendantes surlignées">
                  <span>Ascendance</span>
                  <div class="network-halo-options">
                    <button
                      v-for="option in haloDepthOptions"
                      :key="`ancestor-${option.value}`"
                      type="button"
                      :class="{ 'is-active': networkHaloAncestorDepth === option.value }"
                      @click="setNetworkHaloDepth('ancestor', option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </div>
                <div class="network-halo-group" role="group" aria-label="Générations descendantes surlignées">
                  <span>Descendance</span>
                  <div class="network-halo-options">
                    <button
                      v-for="option in haloDepthOptions"
                      :key="`descendant-${option.value}`"
                      type="button"
                      :class="{ 'is-active': networkHaloDescendantDepth === option.value }"
                      @click="setNetworkHaloDepth('descendant', option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </div>
              </div>
            </section>
            <div
              v-if="activeView === 'tree' && graph.legend"
              class="graph-legend graph-legend--below"
              aria-label="Légende des liens"
            >
              <span><i class="legend-line"></i>Parrain / marraine</span>
              <span><i class="legend-line heart"></i>Parrain / marraine de cœur</span>
              <span><i class="legend-line adoption"></i>Adoption</span>
              <span><i class="legend-line adoption-heart"></i>Adoption de cœur</span>
              <span><i class="legend-line confirmation"></i>Confirmation</span>
              <span><i class="legend-line confirmation-heart"></i>Confirmation de cœur</span>
              <span><i class="legend-line cross"></i>Baptême croisé</span>
            </div>
            <p v-if="activeView === 'tree'" class="graph-help">
              Glisse dans une zone vide pour déplacer le graphe. Touche une fiche pour éclairer sa branche selon la portée choisie.
            </p>
            <button
              v-if="activeView === 'tree'"
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
                  <button type="button" class="home-action-card home-action-card--main" @click="openMainTreeView">
                    <span class="home-action-icon home-action-icon--tree" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M12 5v14M6 9h12M8 15h8" /><circle cx="12" cy="5" r="2" /><circle cx="6" cy="9" r="2" /><circle cx="18" cy="9" r="2" /><circle cx="8" cy="15" r="2" /><circle cx="16" cy="15" r="2" /></svg>
                    </span>
                    <span class="home-action-copy">
                      <strong>Explorer l'arbre</strong>
                      <small>Visualise les filiations, les promos et les liens entre faluchards.</small>
                    </span>
                    <span class="home-action-badge">Action principale</span>
                  </button>
                  <button type="button" class="home-action-card" @click="openTreeAndBeginPersonCreation">
                    <span class="home-action-icon home-action-icon--person" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>
                    </span>
                    <span class="home-action-copy">
                      <strong>Ajouter une fiche</strong>
                      <small>Crée une nouvelle personne et relie-la à un arbre existant.</small>
                    </span>
                  </button>
                  <button type="button" class="home-action-card" @click="activeView = 'upcoming'">
                    <span class="home-action-icon home-action-icon--events" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></svg>
                    </span>
                    <span class="home-action-copy">
                      <strong>Voir les prochains events</strong>
                      <small>Congrès, intronisations, rassemblements régionaux à venir.</small>
                    </span>
                  </button>
                </div>
                <TutorialToggle
                  v-model:enabled="tutorialEnabled"
                  :tutorial-count="tutorialOrderFr.length"
                  @update:enabled="handleTutorialToggle"
                  @open-guides="openTutorial"
                />
                <section class="home-stats" aria-label="Statistiques">
                  <header class="home-stats-head">
                    <h3>Statistiques</h3>
                    <button type="button" @click="activeView = 'stats'">Vue globale</button>
                  </header>
                  <div class="home-summary" aria-label="Résumé">
                    <article>
                      <span class="home-stat-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                      </span>
                      <strong>{{ people.length }}</strong>
                      <span>Fiches</span>
                      <small>Total actuel</small>
                    </article>
                    <article>
                      <span class="home-stat-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M12 5v14M6 9h12M8 15h8" /><circle cx="12" cy="5" r="2" /><circle cx="6" cy="9" r="2" /><circle cx="18" cy="9" r="2" /></svg>
                      </span>
                      <strong>{{ genealogies.length }}</strong>
                      <span>Arbres</span>
                      <small>Total actuel</small>
                    </article>
                    <article>
                      <span class="home-stat-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M11.6 16.8A3 3 0 1 1 8 14" /></svg>
                      </span>
                      <strong>{{ upcomingEvents.length }}</strong>
                      <span>Annonces</span>
                      <small>{{ upcomingEvents.length ? 'En cours' : 'Aucune en cours' }}</small>
                    </article>
                  </div>
                </section>
              </section>
              <template v-else>
                <UpcomingComposer
                  :people="people"
                  :enabled="Boolean(upcomingRegion)"
                  :cooptage-role="cooptageRole"
                  @create="handleUpcomingCreate"
                  @help="openTutorialById"
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
                  @creator-update="handleUpcomingCreatorUpdate"
                  @request-status="handleUpcomingRequestStatus"
                  @creator-delete="handleUpcomingCreatorDelete"
                  @help="openTutorialById"
                />
              </template>
            </template>
          </div>
        </section>

        <aside v-if="editorVisible" ref="editorPanel" class="panel editor" aria-label="Fiche faluchard">
          <PersonForm
            :person="personFormPerson"
            :people="people"
            :genealogy-options="personCreationGenealogyOptions"
            :selected-genealogy-id="personFormGenealogyId"
            :can-select-genealogy="isCreatingPerson"
            :role-options="roleOptions"
            :can-manage-ceremony-events="Boolean(adminSession)"
            :is-creating="isCreatingPerson"
            @save="handlePersonFormSave"
            @new="beginPersonCreation"
            @help="openTutorialById"
            @cancel="cancelPersonCreation"
            @change-genealogy="handleNewPersonGenealogyChange"
            @editing="markEditing"
          />
          <PersonDetails v-if="!isCreatingPerson" :person="selectedPerson" :role-options="roleOptions" />
          <section v-if="!isCreatingPerson && canMoveSelectedPerson" class="person-move">
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
            v-if="selectedPerson && adminSession && !isCreatingPerson"
            type="button"
            class="text-button danger-text editor-delete"
            @click="handlePersonDelete(selectedPerson.id)"
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
            :csrf-token="csrfToken"
            @create="handleGenealogyCreate"
            @delete="handleGenealogyDelete"
            @update="handleGenealogyUpdate"
            @duplicates-merged="handleDuplicateMerge"
          />
        </template>
      </div>
    </section>

    <p v-if="feedbackMessage" class="feedback-toast" :class="`feedback-toast--${feedbackKind}`" role="status">
      {{ feedbackMessage }}
    </p>

    <TutorialOverlay
      v-if="tutorialOpen"
      :initial-tutorial-id="tutorialInitialId"
      :allow-admin-tutorial="activeOverlay === 'admin'"
      @finish="completeTutorial"
      @skip="completeTutorial"
    />

    <TutorialCoachmark
      v-if="tutorialEnabled && activeHint && !tutorialOpen"
      :title="activeHint.title"
      :text="activeHint.text"
      :show-open="Boolean(activeHint.suggestedTutorialId)"
      @open="openTutorialFromHint"
      @dismiss="dismissActiveHint"
    />

    <footer class="app-footer">
      <a href="./privacy.html">Politique de confidentialité / RGPD</a>
    </footer>
  </main>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAdmin } from './composables/useAdmin.js'
import { useDebouncedValue } from './composables/useDebouncedValue.js'
import { useDoleances } from './composables/useDoleances.js'
import { useGenealogyData } from './composables/useGenealogyData.js'
import { createEmptyPerson, getPersonSourceGenealogy, movePersonToGenealogy } from './domain/genealogy.js'
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
import TutorialCoachmark from './features/tutorial/TutorialCoachmark.vue'
import TutorialToggle from './features/tutorial/TutorialToggle.vue'
import { contextualHintsFr, tutorialOrderFr } from './features/tutorial/tutorials.fr.js'

const secondaryComponentLoaders = {
  adminPanel: () => import('./features/admin/AdminPanel.vue'),
  genealogyAdmin: () => import('./features/admin/GenealogyAdmin.vue'),
  adminDoleanceList: () => import('./features/doleances/AdminDoleanceList.vue'),
  doleancePanel: () => import('./features/doleances/DoleancePanel.vue'),
  exportPanel: () => import('./features/exports/ExportPanel.vue'),
  statsDashboard: () => import('./features/stats/StatsDashboard.vue'),
  upcomingComposer: () => import('./features/upcoming/UpcomingComposer.vue'),
  upcomingView: () => import('./features/upcoming/UpcomingView.vue'),
}
const AdminPanel = defineAsyncComponent(secondaryComponentLoaders.adminPanel)
const GenealogyAdmin = defineAsyncComponent(secondaryComponentLoaders.genealogyAdmin)
const AdminDoleanceList = defineAsyncComponent(secondaryComponentLoaders.adminDoleanceList)
const DoleancePanel = defineAsyncComponent(secondaryComponentLoaders.doleancePanel)
const ExportPanel = defineAsyncComponent(secondaryComponentLoaders.exportPanel)
const StatsDashboard = defineAsyncComponent(secondaryComponentLoaders.statsDashboard)
const UpcomingComposer = defineAsyncComponent(secondaryComponentLoaders.upcomingComposer)
const UpcomingView = defineAsyncComponent(secondaryComponentLoaders.upcomingView)

const views = [
  { id: 'home', label: 'Accueil', icon: 'home' },
  { id: 'tree', label: 'Arbre', icon: 'tree' },
  { id: 'overview', label: "Vue d'ensemble", icon: 'person' },
  { id: 'stats', label: 'Statistiques', icon: 'chart' },
  { id: 'upcoming', label: 'Event à venir', icon: 'calendar' },
]
const TUTORIAL_ENABLED_KEY = 'fetterama:tutorials-enabled'
const GRAPH_LAYOUT_MODE_KEY = 'fetterama:graph-layout-mode'
const NETWORK_HALO_ANCESTOR_KEY = 'fetterama:network-halo-ancestor-depth'
const NETWORK_HALO_DESCENDANT_KEY = 'fetterama:network-halo-descendant-depth'
const GRAPH_RENDER_SCALE = 0.7
const GRAPH_ZOOM_MIN = 0.7
const GRAPH_ZOOM_MAX = 2.6
const haloDepthOptions = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 'all', label: 'Toutes' },
]

const activeView = ref('home')
const activeOverlay = ref('')
const graphLayoutMode = ref(readGraphLayoutModePreference())
const searchQuery = ref('')
const ancestorDepth = ref(20)
const descendantDepth = ref(20)
const networkHaloAncestorDepth = ref(readHaloDepthPreference(NETWORK_HALO_ANCESTOR_KEY))
const networkHaloDescendantDepth = ref(readHaloDepthPreference(NETWORK_HALO_DESCENDANT_KEY))
const graphZoom = ref(1)
const upcomingCreatorPassword = ref('')
const moveTargetGenealogyId = ref('')
const pageTop = ref(null)
const editorPanel = ref(null)
const overlayPanel = ref(null)
const overlayClose = ref(null)
const graphViewport = ref(null)
const graphPanContent = ref(null)
const feedbackMessage = ref('')
const feedbackKind = ref('success')
const tutorialEnabled = ref(readTutorialPreference())
const tutorialOpen = ref(false)
const tutorialInitialId = ref('')
const dismissedHintKeys = ref(new Set())
const creationDraftPerson = ref(null)
const creationDraftGenealogyId = ref('')
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
const graphRecentering = ref(false)
const graphFocusPersonId = ref('')
let graphPanFrame = 0
let graphRecenteringTimeout = 0
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
  sessionActions,
  genealogies,
  selectedGenealogyId,
  selectedGenealogy,
  selectedPersonId,
  selectedPerson,
  people,
  selectGenealogy,
  selectPerson,
  updatePerson,
  insertPerson,
  deletePerson,
  upcoming,
  addGenealogy,
  deleteGenealogy,
  patchGenealogy,
  replaceState,
  save,
  undoSessionAction,
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
    mode: graphLayoutMode.value,
    ancestorDepth: ancestorDepth.value,
    descendantDepth: descendantDepth.value,
    includeAllNetwork: activeView.value === 'tree' && graphLayoutMode.value === 'network' && selectedGenealogy.value?.type === 'national',
  }),
)
const graphIsPannable = computed(() => activeView.value === 'tree')
const graphPanStyle = computed(() => ({
  transform: `translate3d(${graphPan.value.x}px, ${graphPan.value.y}px, 0)`,
}))
const graphRenderZoom = computed(() => graphZoom.value * GRAPH_RENDER_SCALE)
const graphContentSize = computed(() => {
  if (graphLayoutMode.value === 'network') {
    return {
      width: Math.max(graph.value.width || 0, 960, ...graph.value.nodes.map((entry) => entry.x + 170)) * graphRenderZoom.value,
      height: Math.max(graph.value.height || 0, 540, ...graph.value.nodes.map((entry) => entry.y + 190)) * graphRenderZoom.value,
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
    width: (maxCardsInVisualRow * cardWidth + (maxCardsInVisualRow - 1) * gap + 80) * graphRenderZoom.value,
    height: Math.max(540, visualRows * cardHeight + Math.max(0, visualRows - 1) * rowGap + 140) * graphRenderZoom.value,
  }
})
const upcomingEvents = computed(() => upcoming.events.value)
const upcomingRegion = computed(() => upcoming.region.value)
const editorHidden = computed(() => ['stats', 'upcoming'].includes(activeView.value))
const editorVisible = computed(() => {
  if (editorHidden.value) return false
  // Sur l’accueil, le panneau d’ajout doit rester fermé par défaut.
  // On l’affiche uniquement quand on crée une nouvelle fiche.
  if (activeView.value === 'home') return Boolean(isCreatingPerson.value)
  return true
})
const roleOptions = computed(() => roleOptionsForGenealogy(genealogies.value, selectedGenealogy.value))
const cooptageRole = computed(() => cooptageRoleForRegion(upcomingRegion.value))
const selectedPersonSourceGenealogy = computed(() =>
  selectedPerson.value ? getPersonSourceGenealogy(data.value, selectedPerson.value.id) : null,
)
const isCreatingPerson = computed(() => Boolean(creationDraftPerson.value))
const personFormPerson = computed(() => creationDraftPerson.value || selectedPerson.value)
const personFormGenealogyId = computed(() =>
  isCreatingPerson.value
    ? creationDraftGenealogyId.value || selectedGenealogyId.value
    : selectedPersonSourceGenealogy.value?.id || selectedGenealogyId.value,
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
  if (isCreatingPerson.value) return 'Nouvelle personne'
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
  if (activeView.value === 'tree') {
    const layout = graphLayoutMode.value === 'network' ? 'Mode Réseau' : 'Mode Hiérarchie'
    if (isCreatingPerson.value) return `${layout} · Brouillon local non enregistré.`
    if (!selectedPerson.value) return `${layout} · Ajoute une personne pour commencer.`
    const nickname = selectedPerson.value.nickname ? ` — ${selectedPerson.value.nickname}` : ''
    return `${layout} · ${selectedGenealogy.value?.name || 'Généalogie active'}${nickname}`
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
  if (isCreatingPerson.value) {
    const targetGenealogyId = creationDraftGenealogyId.value || selectedGenealogyId.value
    const finalPerson = {
      ...updatedPerson,
      id: `person-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    const previousState = data.value
    const inserted = insertPerson(finalPerson, targetGenealogyId)

    if (!inserted) {
      showFeedback("La fiche n'a pas pu être créée dans cet arbre.", 'warning')
      return
    }

    const saved = await save()
    if (!saved) {
      data.value = previousState
      creationDraftPerson.value = updatedPerson
      showFeedback("La fiche n'a pas pu être enregistrée pour le moment.", 'warning')
      return
    }

    creationDraftPerson.value = null
    creationDraftGenealogyId.value = ''
    selectGenealogy(targetGenealogyId)
    await nextTick()
    selectPerson(finalPerson.id)
    graphFocusPersonId.value = finalPerson.id
    showFeedback('La fiche a bien été créée.', 'success')
    return
  }

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
  graphFocusPersonId.value = personId
  activeView.value = 'tree'
  setGraphLayoutMode('network')
  nextTick(() => centerSelectedPerson())
}

function handleGraphSelect(personId) {
  selectPerson(personId)
  graphFocusPersonId.value = personId
  nextTick(() => centerSelectedPerson())
}

function openMainTreeView() {
  activeView.value = 'tree'
  setGraphLayoutMode('network')
}

function setGraphLayoutMode(mode) {
  graphLayoutMode.value = mode === 'tree' ? 'tree' : 'network'
  writeGraphLayoutModePreference(graphLayoutMode.value)
}

function handleGenealogySelect(genealogyId) {
  graphFocusPersonId.value = ''
  selectGenealogy(genealogyId)
}

function adjustZoom(delta) {
  setGraphZoom(graphZoom.value + delta)
}

function setGraphZoom(value) {
  graphZoom.value = Math.min(GRAPH_ZOOM_MAX, Math.max(GRAPH_ZOOM_MIN, Number(value.toFixed(2))))
  const next = clampGraphPan(graphPan.value.x, graphPan.value.y)
  setGraphPanSmooth(next.x, next.y)
}

function resetZoom() {
  graphZoom.value = 1
  const next = clampGraphPan(graphPan.value.x, graphPan.value.y)
  setGraphPanSmooth(next.x, next.y)
}

function beginPersonCreation() {
  // Si l’éditeur n’est pas visible (stats/upcoming) ou si on est sur l’accueil,
  // on bascule en vue arbre pour que le formulaire s’ouvre correctement.
  if (editorHidden.value || activeView.value === 'home') {
    activeView.value = 'tree'
    setGraphLayoutMode('network')
  } else if (activeView.value === 'tree') {
    setGraphLayoutMode('network')
  }
  startPersonCreationDraft()
  nextTick(() => {
    editorPanel.value?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  })
}

async function openTreeAndBeginPersonCreation() {
  activeView.value = 'tree'
  setGraphLayoutMode('network')
  await nextTick()
  startPersonCreationDraft()
  await nextTick()
  editorPanel.value?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
}

function startPersonCreationDraft() {
  const targetGenealogyId =
    (selectedGenealogy.value?.type !== 'national' ? selectedGenealogyId.value : '') ||
    personCreationGenealogyOptions.value[0]?.id ||
    ''
  const draft = createEmptyPerson(`draft-person-${Date.now()}`)
  creationDraftPerson.value = draft
  creationDraftGenealogyId.value = targetGenealogyId
  selectPerson('')
  graphFocusPersonId.value = ''
}

function handleNewPersonGenealogyChange(targetGenealogyId) {
  if (isCreatingPerson.value) {
    creationDraftGenealogyId.value = targetGenealogyId
    return
  }
}

function cancelPersonCreation() {
  creationDraftPerson.value = null
  creationDraftGenealogyId.value = ''
  showFeedback('Création abandonnée.', 'success')
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
  if (!moved) clearGraphFocus()
  graphPan.value = { ...graphPan.value, active: false, pointerId: null }
}

function cancelClickAfterGraphPan(event) {
  if (Date.now() > suppressGraphClickUntil) return
  event.preventDefault()
  event.stopPropagation()
}

function clearGraphFocus() {
  graphFocusPersonId.value = ''
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
  const horizontalMargin = Math.max(content.width, viewport.clientWidth * 2, 720)
  const verticalMargin = Math.max(content.height, viewport.clientHeight * 5, 1800)
  const minX = Math.min(horizontalMargin, viewport.clientWidth - content.width - horizontalMargin)
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

function setGraphPanSmooth(x, y) {
  window.clearTimeout(graphRecenteringTimeout)
  const next = clampGraphPan(x, y)
  graphRecentering.value = true
  graphPan.value = {
    ...graphPan.value,
    active: false,
    pointerId: null,
    x: next.x,
    y: next.y,
  }
  graphRecenteringTimeout = window.setTimeout(() => {
    graphRecentering.value = false
  }, 260)
}

function centerGraphView() {
  setGraphPanSmooth(0, 0)
}

function centerSelectedPerson() {
  if (!selectedPersonId.value) {
    centerGraphView()
    return
  }

  const viewport = graphViewport.value
  const content = graphPanContent.value
  if (!viewport || !content) return

  const selector = `[data-person-id="${cssEscape(selectedPersonId.value)}"]`
  const nodeElement = content.querySelector(selector)
  if (!nodeElement) {
    centerGraphView()
    return
  }

  // Keep the selected profile comfortably centered without filtering the graph.
  const nodeCenter = graphNodeCenter(nodeElement)
  if (!nodeCenter) return
  setGraphPanSmooth(
    viewport.clientWidth / 2 - nodeCenter.x * graphRenderZoom.value,
    viewport.clientHeight / 2 - nodeCenter.y * graphRenderZoom.value,
  )
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value)
  return String(value).replace(/["\\]/g, '\\$&')
}

function graphNodeCenter(nodeElement) {
  if (graphLayoutMode.value === 'network') {
    const transform = nodeElement.getAttribute('transform') || ''
    const match = transform.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/)
    if (match) return { x: Number(match[1]), y: Number(match[2]) }
    const card = nodeElement.querySelector?.('.network-card-base')
    if (card) {
      const x = Number(card.getAttribute('x')) + Number(card.getAttribute('width')) / 2
      const y = Number(card.getAttribute('y')) + Number(card.getAttribute('height')) / 2
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y }
    }
  }

  const viewportRect = graphViewport.value?.getBoundingClientRect()
  const nodeRect = nodeElement.getBoundingClientRect()
  if (!viewportRect) return null
  return {
    x: (nodeRect.left + nodeRect.width / 2 - viewportRect.left - graphPan.value.x) / graphRenderZoom.value,
    y: (nodeRect.top + nodeRect.height / 2 - viewportRect.top - graphPan.value.y) / graphRenderZoom.value,
  }
}

function resetGraphPan() {
  window.cancelAnimationFrame(graphPanFrame)
  graphPanFrame = 0
  window.clearTimeout(graphRecenteringTimeout)
  graphRecentering.value = false
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

async function handleUpcomingCreate(payload, done = () => {}) {
  try {
    const result = await upcoming.createEvent(payload)
    if (!result) {
      done(false)
      return
    }
    upcomingCreatorPassword.value = result.temporaryPassword || ''
    scheduleAutosave()
    showFeedback("L'annonce a été créée.", 'success')
    done(true)
  } catch (err) {
    showFeedback(err.message || 'Création impossible.', 'warning')
    done(false)
  }
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

async function handleUpcomingCreatorUpdate(payload, done) {
  try {
    const event = await upcoming.updateEvent(payload)
    showFeedback("L'événement a été mis à jour.", 'success')
    done(event)
  } catch (err) {
    showFeedback(err.message || 'Mise à jour impossible.', 'warning')
    done(null)
  }
}

async function handleUpcomingRequestStatus(payload, done) {
  try {
    await upcoming.setRequestStatus(payload)
    showFeedback(payload.status === 'accepted' ? 'Demande acceptée.' : 'Demande refusée.', 'success')
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

function handleDuplicateMerge(nextState) {
  replaceState(nextState)
  showFeedback('Les fiches doublons ont été fusionnées.', 'success')
}

async function handlePersonDelete(personId) {
  if (!personId || !adminSession.value) return
  if (!window.confirm('Supprimer cette fiche ? Cette action retirera aussi ses références dans les relations.')) return

  const previousState = data.value
  deletePerson(personId)
  const saved = await save()
  if (!saved) {
    data.value = previousState
    selectPerson(personId)
    showFeedback(error.value || 'Suppression impossible.', 'warning')
    return
  }
  showFeedback('La fiche a été supprimée.', 'success')
}

async function undoRecentAction(action) {
  if (!action?.id) return
  if (!window.confirm(`Annuler cette action ?\n${action.label}`)) return
  const undone = await undoSessionAction(action.id)
  showFeedback(
    undone ? 'La modification a été annulée.' : error.value || 'Annulation impossible.',
    undone ? 'success' : 'warning',
  )
}

function selectSessionPerson(personId) {
  if (!personId) return
  selectPerson(personId)
  activeView.value = 'tree'
  setGraphLayoutMode('network')
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

function readTutorialPreference() {
  try {
    return window.localStorage.getItem(TUTORIAL_ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

function writeTutorialPreference(enabled) {
  try {
    window.localStorage.setItem(TUTORIAL_ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}

function handleTutorialToggle() {
  writeTutorialPreference(tutorialEnabled.value)
  if (!tutorialEnabled.value) tutorialOpen.value = false
}

function readGraphLayoutModePreference() {
  try {
    return window.localStorage.getItem(GRAPH_LAYOUT_MODE_KEY) === 'tree' ? 'tree' : 'network'
  } catch {
    return 'network'
  }
}

function writeGraphLayoutModePreference(mode) {
  try {
    window.localStorage.setItem(GRAPH_LAYOUT_MODE_KEY, mode)
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}

function readHaloDepthPreference(key) {
  try {
    const stored = window.localStorage.getItem(key)
    if (stored === 'all') return 'all'
    const depth = Number(stored)
    return [1, 2, 3].includes(depth) ? depth : 1
  } catch {
    return 1
  }
}

function writeHaloDepthPreference(key, value) {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}

function setNetworkHaloDepth(direction, value) {
  if (direction === 'ancestor') {
    networkHaloAncestorDepth.value = value
    writeHaloDepthPreference(NETWORK_HALO_ANCESTOR_KEY, value)
    return
  }
  networkHaloDescendantDepth.value = value
  writeHaloDepthPreference(NETWORK_HALO_DESCENDANT_KEY, value)
}

function openTutorial() {
  if (!tutorialEnabled.value || activeView.value !== 'home') return
  tutorialInitialId.value = ''
  tutorialOpen.value = true
}

function completeTutorial() {
  tutorialOpen.value = false
  tutorialInitialId.value = ''
}

function openHelpCenter() {
  tutorialInitialId.value = ''
  tutorialOpen.value = true
}

function openTutorialById(id) {
  tutorialInitialId.value = id || ''
  tutorialOpen.value = true
}

function openTutorialFromHint() {
  const id = activeHint.value?.suggestedTutorialId || ''
  tutorialInitialId.value = id
  tutorialOpen.value = true
}

function dismissActiveHint() {
  const key = activeHintKey.value
  if (!key) return
  dismissedHintKeys.value = new Set([...dismissedHintKeys.value, key])
}

const activeHintKey = computed(() => {
  if (!tutorialEnabled.value) return ''
  if (activeOverlay.value === 'admin') return 'admin'
  if (activeView.value === 'upcoming') return 'upcoming'
  if (activeView.value === 'tree' && isCreatingPerson.value) return 'creatingPerson'
  if (activeView.value === 'tree') return 'tree'
  if (activeView.value === 'home') return 'home'
  return ''
})

const activeHint = computed(() => {
  const key = activeHintKey.value
  if (!key) return null
  if (dismissedHintKeys.value.has(key)) return null
  return contextualHintsFr[key] || null
})

watch(activeHintKey, (key) => {
  if (!key) return
  // Reset dismissed hints when user explicitly re-opens help center.
  // (We keep this lightweight: no storage, session-only.)
})

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

function scheduleSecondaryChunkPreload() {
  const preload = () => {
    Object.values(secondaryComponentLoaders).forEach((load) => {
      load().catch(() => {})
    })
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preload, { timeout: 5000 })
    return
  }

  window.setTimeout(preload, 2500)
}

function selectSearchResult(personId) {
  selectPerson(personId)
  graphFocusPersonId.value = personId
  activeView.value = 'tree'
  setGraphLayoutMode('network')
  searchQuery.value = ''
}

watch(selectedGenealogyId, () => {
  graphFocusPersonId.value = ''
})

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

onMounted(() => {
  scheduleSecondaryChunkPreload()
})

onBeforeUnmount(() => {
  window.clearTimeout(feedbackTimeout)
  window.clearTimeout(autosaveTimeout)
  window.clearTimeout(editingTimeout)
  window.clearTimeout(graphRecenteringTimeout)
})
</script>
