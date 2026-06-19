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

    <p v-if="loading" class="notice app-loading-notice">Chargement des données...</p>
    <div v-if="!loading && error" class="notice notice--error">
      <p>{{ error }}</p>
      <a :href="loginUrl">Ouvrir la connexion PHP</a>
    </div>

    <template v-if="!error">
      <div v-if="showFiliereRecoveryNotice" class="recovery-notice-backdrop">
        <section class="recovery-notice" role="dialog" aria-modal="true" aria-labelledby="recovery-notice-title">
          <div>
            <strong id="recovery-notice-title">Information importante</strong>
            <p>
              Suite à une mise à jour, certaines fiches n'ont plus leur filière identifiée. La
              modification de la filière est temporairement ouverte pour les fiches concernées.
            </p>
          </div>
          <button class="primary" type="button" @click="dismissFiliereRecoveryNotice">
            J'ai compris
          </button>
        </section>
      </div>

      <section class="options-bar" aria-label="Options d'affichage">
        <PersonSearch v-model="searchQuery" :results="searchResults" @select="selectSearchResult" />

        <button class="add-sheet-button" type="button" @click="beginPersonCreation">
          Fiche d'ajout
        </button>
      </section>

      <section
        v-if="sessionActions.length && !adminSession"
        class="session-actions panel"
        aria-label="Modifications récentes"
      >
        <div>
          <h2>Actions de cette session</h2>
          <p>
            Ces annulations restent disponibles tant que les données n'ont pas été modifiées
            ailleurs.
          </p>
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
              <button
                type="button"
                class="text-button danger-text"
                :disabled="saving"
                @click="undoRecentAction(action)"
              >
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
              <h2>{{ loading ? 'Accueil' : focusTitle }}</h2>
              <div v-if="activeView === 'stats' && stats" class="stats-title-pills" aria-label="Résumé statistiques">
                <span class="stats-title-pill stats-title-pill--cyan">
                  <i aria-hidden="true"></i>{{ stats.peopleCount }} fiches
                </span>
                <span class="stats-title-pill stats-title-pill--green">
                  <i aria-hidden="true"></i>{{ stats.baptizedCount }} baptisés
                </span>
                <span class="stats-title-pill stats-title-pill--muted">
                  <i aria-hidden="true"></i>{{ stats.unbaptizedCount }} non baptisés
                </span>
              </div>
              <p v-else>{{ focusSubtitle }}</p>
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
            <section
              v-if="activeView === 'tree'"
              class="graph-layout-controls"
              aria-label="Mode d'affichage de l'arbre"
            >
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
              <div
                class="graph-layout-options"
                role="group"
                aria-label="Mode d'affichage de l'arbre"
              >
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
                class="graph-canvas-tools"
                aria-label="Outils du canevas"
                @pointerdown.stop
                @wheel.stop
                @click.stop
              >
                <div class="zoom-controls graph-stage-zoom" aria-label="Zoom de l'arbre">
                  <button
                    type="button"
                    title="Zoom arrière"
                    aria-label="Zoom arrière"
                    @click="adjustZoom(-0.1)"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    title="Réinitialiser le zoom"
                    aria-label="Réinitialiser le zoom"
                    @click="resetZoom"
                  >
                    {{ Math.round(graphZoom * 100) }}%
                  </button>
                  <button
                    type="button"
                    title="Zoom avant"
                    aria-label="Zoom avant"
                    @click="adjustZoom(0.1)"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    class="zoom-controls__selected"
                    title="Recentrer au profil sélectionné"
                    aria-label="Recentrer au profil sélectionné"
                    :disabled="!selectedPersonId"
                    @click="centerSelectedPerson"
                  >
                    Recentrer
                  </button>
                </div>
                <details v-if="graph.legend" class="graph-legend-popover">
                  <summary aria-label="Afficher la légende des liens">
                    <span aria-hidden="true">i</span>
                    <strong>Légende</strong>
                  </summary>
                  <div class="graph-legend" aria-label="Légende des liens">
                    <span><i class="legend-line"></i>Parrain / marraine</span>
                    <span><i class="legend-line heart"></i>Parrain / marraine de cœur</span>
                    <span><i class="legend-line adoption"></i>Adoption</span>
                    <span><i class="legend-line confirmation"></i>Confirmation</span>
                    <span><i class="legend-line cross"></i>Baptême croisé</span>
                  </div>
                </details>
              </div>
              <div
                ref="graphPanContent"
                class="graph-pan-content"
                :class="{ 'is-recentering': graphRecentering }"
                :style="graphPanStyle"
              >
                <GenealogyGraph
                  v-if="!graphLoading"
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
                <p v-else class="notice graph-loading-notice" aria-live="polite">
                  Préparation de l'arbre...
                </p>
              </div>
            </div>
            <section
              v-if="activeView === 'tree' && graphLayoutMode === 'network'"
              class="network-halo-controls"
              aria-label="Portée du halo généalogique"
            >
              <div class="network-halo-controls__header">
                <strong>Portée du halo</strong>
                <span>{{
                  graphFocusPersonId ? 'Appliquée au profil sélectionné' : 'Sélectionne une fiche'
                }}</span>
                <button
                  type="button"
                  class="help-icon help-icon--inline"
                  aria-label="Aide sur le halo et la compréhension des croisements"
                  @click="openTutorialById('crossed_baptism')"
                >
                  ?
                </button>
              </div>
              <div class="network-depth-slider">
                <div class="network-depth-slider__label">
                  <span>Profondeur</span>
                  <strong>{{ haloDepthLabel(networkHaloDepthValue) }}</strong>
                </div>
                <input
                  v-model.number="networkHaloDepthValue"
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  aria-label="Profondeur du halo généalogique"
                />
                <div class="network-depth-slider__scale" aria-hidden="true">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>Toutes</span>
                </div>
              </div>
            </section>
            <p v-if="activeView === 'tree'" class="graph-help">
              Glisse dans une zone vide pour déplacer le graphe. Touche une fiche pour éclairer sa
              branche selon la portée choisie.
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
            <section v-if="loading" class="home-panel home-panel--loading" aria-busy="true">
              <div class="home-actions" aria-hidden="true">
                <div class="home-action-card home-action-card--main home-skeleton-card"></div>
                <div class="home-action-card home-skeleton-card"></div>
                <div class="home-action-card home-skeleton-card"></div>
              </div>
              <div class="home-summary" aria-hidden="true">
                <article class="home-skeleton-card"></article>
                <article class="home-skeleton-card"></article>
                <article class="home-skeleton-card"></article>
              </div>
            </section>
            <OverviewPanel
              v-else-if="activeView === 'overview'"
              :people="people"
              :filiere-filter-label="overviewFiliereFilter"
              @clear-filiere-filter="overviewFiliereFilter = ''"
              @select="handlePersonFocus"
            />
            <StatsDashboard
              v-else-if="activeView === 'stats' && stats"
              :stats="stats"
              :people="people"
              @select="handlePersonFocus"
              @filter-filiere="handleFiliereFilter"
            />
            <p v-else-if="activeView === 'stats'" class="notice">Calcul des statistiques...</p>
            <template v-else-if="activeView === 'home'">
              <section class="home-panel">
                <div class="home-actions" aria-label="Actions principales">
                  <button
                    type="button"
                    class="home-action-card home-action-card--main"
                    @click="openMainTreeView"
                  >
                    <span class="home-action-icon home-action-icon--tree" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 5v14M6 9h12M8 15h8" />
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="6" cy="9" r="2" />
                        <circle cx="18" cy="9" r="2" />
                        <circle cx="8" cy="15" r="2" />
                        <circle cx="16" cy="15" r="2" />
                      </svg>
                    </span>
                    <span class="home-action-copy">
                      <strong>Explorer l'arbre</strong>
                      <small
                        >Visualise les filiations, les promos et les liens entre faluchards.</small
                      >
                    </span>
                    <span class="home-action-badge">Action principale</span>
                  </button>
                  <button
                    type="button"
                    class="home-action-card"
                    @click="openTreeAndBeginPersonCreation"
                  >
                    <span class="home-action-icon home-action-icon--person" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M19 8v6M22 11h-6" />
                      </svg>
                    </span>
                    <span class="home-action-copy">
                      <strong>Ajouter une fiche</strong>
                      <small>Crée une nouvelle personne et relie-la à un arbre existant.</small>
                    </span>
                  </button>
                  <button type="button" class="home-action-card" @click="openUpcomingView">
                    <span class="home-action-icon home-action-icon--events" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M8 2v4M16 2v4M3 10h18" />
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
                      </svg>
                    </span>
                    <span class="home-action-copy">
                      <strong>Voir les prochains events</strong>
                      <small>Congrès, intronisations, rassemblements régionaux à venir.</small>
                    </span>
                  </button>
                </div>
                <TutorialToggle
                  v-model:enabled="tutorialEnabled"
                  :tutorial-count="TUTORIAL_COUNT"
                  @update:enabled="handleTutorialToggle"
                  @open-guides="openTutorial"
                />
                <section class="home-stats" aria-label="Statistiques">
                  <header class="home-stats-head">
                    <h3>Statistiques</h3>
                    <button type="button" @click="openStatsView">Vue globale</button>
                  </header>
                  <div class="home-summary" aria-label="Résumé">
                    <article>
                      <span class="home-stat-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </span>
                      <strong>{{ homePeopleCount }}</strong>
                      <span>Fiches</span>
                      <small>Total actuel</small>
                    </article>
                    <article>
                      <span class="home-stat-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M12 5v14M6 9h12M8 15h8" />
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="6" cy="9" r="2" />
                          <circle cx="18" cy="9" r="2" />
                        </svg>
                      </span>
                      <strong>{{ genealogies.length }}</strong>
                      <span>Arbres</span>
                      <small>Total actuel</small>
                    </article>
                    <article>
                      <span class="home-stat-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="m3 11 18-5v12L3 14v-3Z" />
                          <path d="M11.6 16.8A3 3 0 1 1 8 14" />
                        </svg>
                      </span>
                      <strong>{{ homeUpcomingCount }}</strong>
                      <span>Annonces</span>
                      <small>{{ homeUpcomingCount ? 'En cours' : 'Aucune en cours' }}</small>
                    </article>
                  </div>
                </section>
              </section>
            </template>
            <template v-else-if="activeView === 'upcoming'">
              <div class="upcoming-create-bar">
                <button type="button" class="app-button app-button--primary" @click="openUpcomingComposer">
                  + Créer
                </button>
              </div>
              <UpcomingView
                :events="upcomingEvents"
                :people="people"
                :region="upcomingRegion"
                :cooptage-role-label="cooptageRole.label"
                :cooptage-role-id="cooptageRole.id"
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
              <div
                v-if="showUpcomingComposer"
                class="upcoming-composer-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="upcoming-composer-title"
                @click.self="showUpcomingComposer = false"
              >
                <section class="upcoming-composer-drawer">
                  <div class="upcoming-composer-drawer__head">
                    <h3 id="upcoming-composer-title">Créer un événement</h3>
                    <button
                      type="button"
                      class="overlay-close"
                      aria-label="Fermer le formulaire de création"
                      @click="showUpcomingComposer = false"
                    >
                      Fermer
                    </button>
                  </div>
                  <UpcomingComposer
                    :people="people"
                    :enabled="showUpcomingComposer"
                    :selected-genealogy="selectedGenealogy"
                    :cooptage-role="cooptageRole"
                    @create="handleUpcomingCreateFromComposer"
                    @help="openTutorialById"
                  />
                </section>
              </div>
              <section v-if="upcomingCreatorPassword" class="notice upcoming-secret">
                <strong>Mot de passe créateur</strong>
                <p>Note-le maintenant, il ne sera plus affiché ensuite.</p>
                <code>{{ upcomingCreatorPassword }}</code>
                <button type="button" class="text-button" @click="copyUpcomingPassword">
                  Copier
                </button>
              </section>
            </template>
            <IdeaBoxView
              v-else-if="activeView === 'idea-box'"
              :admin-session="adminSession"
              :csrf-token="csrfToken"
              @feedback="({ message, kind }) => showFeedback(message, kind)"
              @admin-logout="handleAdminLogout"
            />
          </div>
        </section>

        <aside
          v-if="editorVisible"
          ref="editorPanel"
          class="panel editor"
          aria-label="Fiche faluchard"
        >
          <PersonForm
            :person="personFormPerson"
            :people="people"
            :genealogy-options="personCreationGenealogyOptions"
            :selected-genealogy-id="personFormGenealogyId"
            :can-select-genealogy="isCreatingPerson"
            :role-options="personFormRoleOptions"
            :past-cooptage-events="selectedPersonPastCooptageEvents"
            :can-manage-ceremony-events="Boolean(adminSession)"
            :is-creating="isCreatingPerson"
            :saving="saving"
            :duplicate-confirmation="duplicateCreationConfirmation"
            @save="handlePersonFormSave"
            @create-cooptage="handlePersonCooptageCreate"
            @new="beginPersonCreation"
            @help="openTutorialById"
            @cancel="cancelPersonCreation"
            @confirm-duplicate="confirmDuplicateCreation"
            @cancel-duplicate="cancelDuplicateCreation"
            @change-genealogy="handleNewPersonGenealogyChange"
            @editing="markEditing"
          />
          <PersonDetails
            v-if="!isCreatingPerson"
            :person="selectedPerson"
            :people="people"
            :role-options="personFormRoleOptions"
            :past-cooptage-events="selectedPersonPastCooptageEvents"
          />
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
            <button class="primary" type="button" @click="moveSelectedPerson">Déplacer</button>
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
        <button ref="overlayClose" class="overlay-close" type="button" @click="activeOverlay = ''">
          Fermer
        </button>

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
            @change-password="
              ({ regionId, password }) => admin.updateRegionPassword(regionId, password)
            "
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

    <p
      v-if="feedbackMessage"
      class="feedback-toast"
      :class="`feedback-toast--${feedbackKind}`"
      role="status"
    >
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
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { useAdmin } from './composables/useAdmin.js'
import { useDebouncedValue } from './composables/useDebouncedValue.js'
import { useDoleances } from './composables/useDoleances.js'
import { useGenealogyData } from './composables/useGenealogyData.js'
import {
  createEmptyPerson,
  findDuplicatePerson,
  getPersonSourceGenealogy,
  movePersonToGenealogy,
} from './domain/genealogy.js'
import { getPastCooptageEventsForPerson, getUpcomingEventsForContext } from './domain/upcoming.js'
import { cooptageRoleForRegion, roleOptionsForGenealogy } from './domain/roles.js'
import { normalizeSearchText, personMatchesSearch } from './domain/search.js'
import AppHeader from './features/layout/AppHeader.vue'
import ViewSwitcher from './features/layout/ViewSwitcher.vue'
import PersonSearch from './features/search/PersonSearch.vue'
import TutorialToggle from './features/tutorial/TutorialToggle.vue'
const secondaryComponentLoaders = {
  adminPanel: () => import('./features/admin/AdminPanel.vue'),
  genealogyAdmin: () => import('./features/admin/GenealogyAdmin.vue'),
  adminDoleanceList: () => import('./features/doleances/AdminDoleanceList.vue'),
  doleancePanel: () => import('./features/doleances/DoleancePanel.vue'),
  exportPanel: () => import('./features/exports/ExportPanel.vue'),
  genealogyGraph: () => import('./features/graph/GenealogyGraph.vue'),
  overviewPanel: () => import('./features/overview/OverviewPanel.vue'),
  peopleList: () => import('./features/people/PeopleList.vue'),
  personDetails: () => import('./features/people/PersonDetails.vue'),
  personForm: () => import('./features/people/PersonForm.vue'),
  statsDashboard: () => import('./features/stats/StatsDashboard.vue'),
  tutorialCoachmark: () => import('./features/tutorial/TutorialCoachmark.vue'),
  tutorialOverlay: () => import('./features/tutorial/TutorialOverlay.vue'),
  upcomingComposer: () => import('./features/upcoming/UpcomingComposer.vue'),
  upcomingView: () => import('./features/upcoming/UpcomingView.vue'),
  ideaBoxView: () => import('./features/idea-box/IdeaBoxView.vue'),
}
const AdminPanel = defineAsyncComponent(secondaryComponentLoaders.adminPanel)
const GenealogyAdmin = defineAsyncComponent(secondaryComponentLoaders.genealogyAdmin)
const AdminDoleanceList = defineAsyncComponent(secondaryComponentLoaders.adminDoleanceList)
const DoleancePanel = defineAsyncComponent(secondaryComponentLoaders.doleancePanel)
const ExportPanel = defineAsyncComponent(secondaryComponentLoaders.exportPanel)
const GenealogyGraph = defineAsyncComponent(secondaryComponentLoaders.genealogyGraph)
const OverviewPanel = defineAsyncComponent(secondaryComponentLoaders.overviewPanel)
const PeopleList = defineAsyncComponent(secondaryComponentLoaders.peopleList)
const PersonDetails = defineAsyncComponent(secondaryComponentLoaders.personDetails)
const PersonForm = defineAsyncComponent(secondaryComponentLoaders.personForm)
const StatsDashboard = defineAsyncComponent(secondaryComponentLoaders.statsDashboard)
const TutorialCoachmark = defineAsyncComponent(secondaryComponentLoaders.tutorialCoachmark)
const TutorialOverlay = defineAsyncComponent(secondaryComponentLoaders.tutorialOverlay)
const UpcomingComposer = defineAsyncComponent(secondaryComponentLoaders.upcomingComposer)
const UpcomingView = defineAsyncComponent(secondaryComponentLoaders.upcomingView)
const IdeaBoxView = defineAsyncComponent(secondaryComponentLoaders.ideaBoxView)
const EMPTY_GRAPH = Object.freeze({ nodes: [], edges: [], rows: [], legend: false })
const TREE_COMPONENTS = ['genealogyGraph']
const EDITOR_COMPONENTS = ['personForm', 'personDetails', 'peopleList']
const STATS_COMPONENTS = ['statsDashboard']
const UPCOMING_COMPONENTS = ['upcomingView']
const IDEA_BOX_COMPONENTS = ['ideaBoxView']

const views = [
  { id: 'home', label: 'Accueil', icon: 'home' },
  { id: 'tree', label: 'Arbre', icon: 'tree' },
  { id: 'overview', label: "Vue d'ensemble", icon: 'person' },
  { id: 'stats', label: 'Statistiques', icon: 'chart' },
  { id: 'upcoming', label: 'Event à venir', icon: 'calendar' },
  { id: 'idea-box', label: 'Boîte à idées', icon: 'idea' },
]
const TUTORIAL_ENABLED_KEY = 'fetterama:tutorials-enabled'
const GRAPH_LAYOUT_MODE_KEY = 'fetterama:graph-layout-mode'
const NETWORK_HALO_ANCESTOR_KEY = 'fetterama:network-halo-ancestor-depth'
const NETWORK_HALO_DESCENDANT_KEY = 'fetterama:network-halo-descendant-depth'
const GRAPH_RENDER_SCALE = 0.7
const GRAPH_ZOOM_MIN = 0.7
const GRAPH_ZOOM_MAX = 2.6
const FILIERE_RECOVERY_NOTICE_ENABLED = true
const FILIERE_RECOVERY_NOTICE_KEY = 'fetterama:filiere-recovery-notice-dismissed'
const TUTORIAL_COUNT = 5
const activeView = ref('home')
const activeOverlay = ref('')
const graphLayoutMode = ref(readGraphLayoutModePreference())
const searchQuery = ref('')
const overviewFiliereFilter = ref('')
const ancestorDepth = ref(20)
const descendantDepth = ref(20)
const networkHaloAncestorDepth = ref(readHaloDepthPreference(NETWORK_HALO_ANCESTOR_KEY))
const networkHaloDescendantDepth = ref(readHaloDepthPreference(NETWORK_HALO_DESCENDANT_KEY))
const graphZoom = ref(1)
const upcomingCreatorPassword = ref('')
const showUpcomingComposer = ref(false)
const moveTargetGenealogyId = ref('')
const pageTop = ref(null)
const editorPanel = ref(null)
const overlayPanel = ref(null)
const overlayClose = ref(null)
const graphViewport = ref(null)
const graphPanContent = ref(null)
const feedbackMessage = ref('')
const feedbackKind = ref('success')
const showFiliereRecoveryNotice = ref(
  FILIERE_RECOVERY_NOTICE_ENABLED && !readDismissedFlag(FILIERE_RECOVERY_NOTICE_KEY),
)
const tutorialEnabled = ref(readTutorialPreference())
const tutorialOpen = ref(false)
const tutorialInitialId = ref('')
const contextualHints = ref({})
const dismissedHintKeys = ref(new Set())
const creationDraftPerson = ref(null)
const creationDraftGenealogyId = ref('')
const pendingDuplicateCreation = ref(null)
const forcingDuplicateCreation = ref(false)
let feedbackTimeout = 0
let autosaveTimeout = 0
let editingTimeout = 0
let statsLoadRequest = 0
let graphLoadRequest = 0
let graphModelModule = null
const graphLayoutCache = new Map()
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
const graphViewportSize = ref({ width: 0, height: 0 })
const graphRecentering = ref(false)
const graphFocusPersonId = ref('')
const networkHaloDepthValue = computed({
  get() {
    return Math.max(
      haloDepthToSliderValue(networkHaloAncestorDepth.value),
      haloDepthToSliderValue(networkHaloDescendantDepth.value),
    )
  },
  set(value) {
    const depth = sliderValueToHaloDepth(value)
    setNetworkHaloDepth('ancestor', depth)
    setNetworkHaloDepth('descendant', depth)
  },
})
let graphPanFrame = 0
let graphViewportMeasureFrame = 0
let graphRecenteringTimeout = 0
let pendingGraphPanX = 0
let pendingGraphPanY = 0
let suppressGraphClickUntil = 0

const {
  loading,
  saving,
  fullDataLoading,
  fullDataLoaded,
  error,
  loginUrl,
  csrfToken,
  data,
  sessionActions,
  hasUnsavedChanges,
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
  ensureFullData,
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
const stats = ref(null)
const graph = shallowRef(EMPTY_GRAPH)
const graphLoading = ref(false)
const graphIsPannable = computed(() => activeView.value === 'tree')
const graphPanStyle = computed(() => ({
  transform: `translate(${graphPan.value.x}px, ${graphPan.value.y}px)`,
}))
const graphRenderZoom = computed(() => graphZoom.value * GRAPH_RENDER_SCALE)
const graphContentSize = computed(() => {
  if (graphLayoutMode.value === 'network') {
    return {
      width:
        Math.max(graph.value.width || 0, 960, ...graph.value.nodes.map((entry) => entry.x + 170)) *
        graphRenderZoom.value,
      height:
        Math.max(graph.value.height || 0, 540, ...graph.value.nodes.map((entry) => entry.y + 190)) *
        graphRenderZoom.value,
    }
  }

  const maxCardsPerLine = 5
  const cardWidth = 180
  const cardHeight = 92
  const gap = 18
  const rowGap = 86
  const maxCardsInVisualRow = Math.min(
    maxCardsPerLine,
    Math.max(
      1,
      ...graph.value.rows.map((row) => Math.min(maxCardsPerLine, Math.max(1, row.people.length))),
    ),
  )
  const visualRows = graph.value.rows.reduce(
    (total, row) => total + Math.max(1, Math.ceil(row.people.length / maxCardsPerLine)),
    0,
  )
  return {
    width:
      (maxCardsInVisualRow * cardWidth + (maxCardsInVisualRow - 1) * gap + 80) *
      graphRenderZoom.value,
    height:
      Math.max(540, visualRows * cardHeight + Math.max(0, visualRows - 1) * rowGap + 140) *
      graphRenderZoom.value,
  }
})
const upcomingEvents = computed(() => (activeView.value === 'upcoming' ? upcoming.events.value : []))
const upcomingRegion = computed(() => upcoming.region.value)
const homePeopleCount = computed(() =>
  activeView.value === 'home'
    ? genealogies.value.reduce((total, genealogy) => total + (genealogy.peopleCount ?? genealogy.people?.length ?? 0), 0)
    : people.value.length,
)
const homeUpcomingCount = computed(() =>
  activeView.value === 'home'
    ? getUpcomingEventsForContext(data.value, selectedGenealogy.value).length
    : upcomingEvents.value.length,
)
const editorHidden = computed(() => ['stats', 'upcoming', 'idea-box'].includes(activeView.value))
const editorVisible = computed(() => {
  if (editorHidden.value) return false
  // Sur l’accueil, le panneau d’ajout doit rester fermé par défaut.
  // On l’affiche uniquement quand on crée une nouvelle fiche.
  if (activeView.value === 'home') return Boolean(isCreatingPerson.value)
  return true
})
const roleOptions = computed(() =>
  roleOptionsForGenealogy(genealogies.value, selectedGenealogy.value),
)
const cooptageRole = computed(() => cooptageRoleForRegion(upcomingRegion.value))
const selectedPersonSourceGenealogy = computed(() =>
  selectedPerson.value ? getPersonSourceGenealogy(data.value, selectedPerson.value.id) : null,
)
const selectedPersonPastCooptageEvents = computed(() =>
  getPastCooptageEventsForPerson(data.value, selectedPerson.value?.id),
)
const isCreatingPerson = computed(() => Boolean(creationDraftPerson.value))
const personFormPerson = computed(() => creationDraftPerson.value || selectedPerson.value)
const personFormRoleOptions = computed(() => {
  if (isCreatingPerson.value) {
    const genealogyId = creationDraftGenealogyId.value || selectedGenealogyId.value
    const genealogy = genealogies.value.find((item) => item.id === genealogyId) || selectedGenealogy.value
    return roleOptionsForGenealogy(genealogies.value, genealogy)
  }
  return roleOptionsForGenealogy(genealogies.value, selectedPersonSourceGenealogy.value || selectedGenealogy.value)
})
const duplicateCreationConfirmation = computed(() => {
  if (!pendingDuplicateCreation.value) return null
  return {
    label: pendingDuplicateCreation.value.duplicateLabel,
    loading: forcingDuplicateCreation.value,
  }
})
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
    .filter(
      (genealogy) => genealogy.id === session.regionId || genealogy.parentId === session.regionId,
    )
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
      parentName:
        genealogies.value.find((candidate) => candidate.id === genealogy.parentId)?.name || '',
    }))
    .sort((left, right) => genealogySortLabel(left).localeCompare(genealogySortLabel(right), 'fr')),
)

const statusLabel = computed(() => {
  if (loading.value) return 'Synchronisation'
  if (fullDataLoading.value) return 'Chargement des fiches'
  if (error.value) return 'Hors ligne'
  if (saving.value) return 'Sauvegarde…'
  return 'En ligne'
})

const searchResults = computed(() => {
  const query = normalizeSearchText(debouncedSearchQuery.value)
  if (!fullDataLoaded.value) return []
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
  if (activeView.value === 'idea-box') return 'Boîte à idées'
  if (isCreatingPerson.value) return 'Nouvelle personne'
  return selectedPerson.value?.name || 'Aucun faluchard sélectionné'
})
const focusSubtitle = computed(() => {
  if (activeView.value === 'home') return 'Choisis une action pour commencer.'
  if (activeView.value === 'overview')
    return `${people.value.length} faluchard(s), triés par filière`
  if (activeView.value === 'stats') {
    const currentStats = stats.value
    if (!currentStats) return 'Calcul des statistiques...'
    return `${currentStats.peopleCount} fiche(s), ${currentStats.baptizedCount} baptisé(s), ${currentStats.unbaptizedCount} non baptisé(s)`
  }
  if (activeView.value === 'upcoming') {
    if (upcomingRegion.value) {
      return `${upcomingEvents.value.length} annonce(s) visible(s) dans ${upcomingRegion.value.name}`
    }
    if (upcomingEvents.value.length) {
      return `${upcomingEvents.value.length} événement(s) national(aux) à venir.`
    }
    return 'Ouvre une faluche de région ou une famille pour voir les annonces.'
  }
  if (activeView.value === 'idea-box') return 'Vote pour les priorités et propose de nouvelles idées.'
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
  if (activeView.value === 'idea-box') return 'Boite a idees communautaire de GeneFaluche.'
  if (activeView.value === 'overview') return 'Vue lisible des faluchards groupes par filiere.'
  return 'Recherche, edition et visualisation mobile-first de genealogies de faluche.'
})

async function openAdmin() {
  await ensureFullData()
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
    const remaining = Number.isFinite(result?.remaining)
      ? ` Il reste ${result.remaining} envoi(s) pour cette session.`
      : ''
    showFeedback(`Doléance envoyée.${remaining}`, 'success')
  } catch (error) {
    showFeedback(error.message || 'Impossible d’envoyer la doléance.', 'warning')
  }
}

async function handlePersonFormSave(updatedPerson, options = {}) {
  const personId = updatedPerson?.id || ''
  if (isCreatingPerson.value) {
    if (forcingDuplicateCreation.value && !options.forceDuplicate) return
    const forceDuplicate = Boolean(options.forceDuplicate)
    const duplicate = forceDuplicate
      ? null
      : findDuplicatePerson(people.value, updatedPerson.name, updatedPerson.nickname)
    if (duplicate) {
      pendingDuplicateCreation.value = {
        person: { ...updatedPerson },
        duplicateLabel: personDuplicateLabel(duplicate),
      }
      await nextTick()
      editorPanel.value?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      return
    }
    const targetGenealogyId = creationDraftGenealogyId.value || selectedGenealogyId.value
    const finalPerson = {
      ...updatedPerson,
      id: `person-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...(forceDuplicate ? { _forceDuplicateCreation: true } : {}),
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
    pendingDuplicateCreation.value = null
    selectGenealogy(targetGenealogyId)
    await nextTick()
    selectPerson(finalPerson.id)
    graphFocusPersonId.value = finalPerson.id
    showFeedback('La fiche a bien été créée.', 'success')
    return
  }

  if (personUpdateWasApplied(updatedPerson, selectedPerson.value)) {
    showFeedback('Aucune modification à enregistrer.', 'success')
    return
  }

  const previousState = data.value
  updatePerson(updatedPerson)
  const saved = await save()

  if (!saved) {
    data.value = previousState
    selectPerson(personId)
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

async function handlePersonFocus(personId) {
  await ensureFullData()
  await Promise.all([preloadTreeView(), preloadEditor()])
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

function handleFiliereFilter(label) {
  preloadSecondaryComponents(['overviewPanel'])
  overviewFiliereFilter.value = label
  activeView.value = 'overview'
}

async function openMainTreeView() {
  await ensureFullData()
  await preloadTreeView()
  activeView.value = 'tree'
  setGraphLayoutMode('network')
}

async function openStatsView() {
  await ensureFullData()
  await preloadSecondaryComponents(STATS_COMPONENTS)
  activeView.value = 'stats'
}

function openUpcomingView() {
  preloadSecondaryComponents(UPCOMING_COMPONENTS)
  activeView.value = 'upcoming'
}

function openIdeaBoxView(push = true) {
  preloadSecondaryComponents(IDEA_BOX_COMPONENTS)
  activeView.value = 'idea-box'
  if (push && !window.location.pathname.startsWith('/boite-a-idees')) {
    history.pushState({}, '', '/boite-a-idees')
  }
}

async function openUpcomingComposer() {
  await ensureFullData()
  showUpcomingComposer.value = true
}

function preloadSecondaryComponents(names) {
  return Promise.allSettled(
    names.map((name) => {
      const loader = secondaryComponentLoaders[name]
      return loader ? loader() : Promise.resolve()
    }),
  )
}

function preloadTreeView() {
  return preloadSecondaryComponents(TREE_COMPONENTS)
}

function preloadEditor() {
  return preloadSecondaryComponents(EDITOR_COMPONENTS)
}

function graphLayoutOptions() {
  return {
    focusId: selectedPersonId.value,
    mode: graphLayoutMode.value,
    ancestorDepth: ancestorDepth.value,
    descendantDepth: descendantDepth.value,
    includeAllNetwork:
      graphLayoutMode.value === 'network' && selectedGenealogy.value?.type === 'national',
  }
}

function graphLayoutCacheKey(options) {
  return [
    selectedGenealogyId.value,
    options.focusId,
    options.mode,
    options.ancestorDepth,
    options.descendantDepth,
    options.includeAllNetwork ? 'all' : 'focus',
  ].join('|')
}

async function loadGraphModelBuilder() {
  if (!graphModelModule) {
    graphModelModule = import('./domain/graph.js')
  }
  return (await graphModelModule).buildGraphModel
}

async function refreshGraphModel() {
  const requestId = ++graphLoadRequest
  if (activeView.value !== 'tree') {
    graphLoading.value = false
    graph.value = EMPTY_GRAPH
    return
  }

  const options = graphLayoutOptions()
  const cacheKey = graphLayoutCacheKey(options)
  const cachedGraph = graphLayoutCache.get(cacheKey)
  if (cachedGraph) {
    graph.value = cachedGraph
    graphLoading.value = false
    return
  }

  graphLoading.value = true
  const buildGraphModel = await loadGraphModelBuilder()
  if (requestId !== graphLoadRequest || activeView.value !== 'tree') return

  const nextGraph = buildGraphModel(people.value, options)
  graphLayoutCache.set(cacheKey, nextGraph)
  graph.value = nextGraph
  graphLoading.value = false
  await nextTick()
  scheduleGraphViewportRefresh()
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

async function beginPersonCreation() {
  await ensureFullData()
  await Promise.all([preloadTreeView(), preloadEditor()])
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
  await ensureFullData()
  await Promise.all([preloadTreeView(), preloadEditor()])
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
  pendingDuplicateCreation.value = null
  forcingDuplicateCreation.value = false
  selectPerson('')
  graphFocusPersonId.value = ''
}

function handleNewPersonGenealogyChange(targetGenealogyId) {
  if (isCreatingPerson.value) {
    creationDraftGenealogyId.value = targetGenealogyId
    pendingDuplicateCreation.value = null
    return
  }
}

function cancelPersonCreation() {
  creationDraftPerson.value = null
  creationDraftGenealogyId.value = ''
  pendingDuplicateCreation.value = null
  forcingDuplicateCreation.value = false
  showFeedback('Création abandonnée.', 'success')
}

async function confirmDuplicateCreation() {
  if (!pendingDuplicateCreation.value || forcingDuplicateCreation.value) return
  forcingDuplicateCreation.value = true
  try {
    await handlePersonFormSave(pendingDuplicateCreation.value.person, { forceDuplicate: true })
  } finally {
    forcingDuplicateCreation.value = false
  }
}

function cancelDuplicateCreation() {
  pendingDuplicateCreation.value = null
  showFeedback('Création annulée. La fiche existante est conservée.', 'success')
}

function personDuplicateLabel(person) {
  return `${person.name || 'Sans nom'}${person.nickname ? ` (${person.nickname})` : ''}`
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

  refreshGraphViewportSize()
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
  const movedEnough =
    Math.abs(deltaX) > GRAPH_PAN_CLICK_THRESHOLD || Math.abs(deltaY) > GRAPH_PAN_CLICK_THRESHOLD
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
  refreshGraphViewportSize()
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
  const viewport = graphViewportBounds()
  if (!viewport.width || !viewport.height) return { x, y }
  const content = graphContentSize.value
  const contentWidth = Math.max(1, content.width)
  const contentHeight = Math.max(1, content.height)
  const margin = graphPanMargin(viewport)
  const minX = Math.min(margin.x, viewport.width - contentWidth - margin.x)
  const maxX = margin.x
  const minY = Math.min(margin.y, viewport.height - contentHeight - margin.y)
  const maxY = margin.y
  const next = {
    x: Math.min(maxX, Math.max(minX, Number.isFinite(x) ? x : 0)),
    y: Math.min(maxY, Math.max(minY, Number.isFinite(y) ? y : 0)),
  }
  warnIfGraphCanRenderEmpty('clamp', next, viewport, { width: contentWidth, height: contentHeight })
  return next
}

function graphViewportBounds() {
  const viewport = graphViewport.value
  if (!viewport) return graphViewportSize.value
  const rect = viewport.getBoundingClientRect()
  return {
    width: Math.max(0, viewport.clientWidth || rect.width || graphViewportSize.value.width),
    height: Math.max(0, viewport.clientHeight || rect.height || graphViewportSize.value.height),
  }
}

function graphPanMargin(viewport) {
  const touchViewport = isTouchGraphViewport()
  return {
    x: Math.min(
      Math.max(viewport.width * (touchViewport ? 0.52 : 0.34), touchViewport ? 96 : 72),
      touchViewport ? 220 : 160,
    ),
    y: Math.min(
      Math.max(viewport.height * (touchViewport ? 0.46 : 0.3), touchViewport ? 110 : 72),
      touchViewport ? 240 : 180,
    ),
  }
}

function isTouchGraphViewport() {
  if (typeof window === 'undefined') return false
  return (
    graphViewportSize.value.width <= 760 ||
    window.matchMedia?.('(hover: none), (pointer: coarse)')?.matches
  )
}

function refreshGraphViewportSize() {
  const viewport = graphViewport.value
  if (!viewport) return
  const rect = viewport.getBoundingClientRect()
  const width = Math.max(0, viewport.clientWidth || rect.width)
  const height = Math.max(0, viewport.clientHeight || rect.height)
  if (width === graphViewportSize.value.width && height === graphViewportSize.value.height) return
  graphViewportSize.value = { width, height }
}

function scheduleGraphViewportRefresh() {
  if (graphViewportMeasureFrame) return
  graphViewportMeasureFrame = window.requestAnimationFrame(() => {
    graphViewportMeasureFrame = 0
    refreshGraphViewportSize()
    const next = clampGraphPan(graphPan.value.x, graphPan.value.y)
    graphPan.value = { ...graphPan.value, x: next.x, y: next.y }
  })
}

function warnIfGraphCanRenderEmpty(reason, pan, viewport, content) {
  if (!import.meta.env.DEV || !graph.value.nodes.length) return
  const almostEmpty =
    pan.x > viewport.width - 12 ||
    pan.y > viewport.height - 12 ||
    pan.x + content.width < 12 ||
    pan.y + content.height < 12
  if (!almostEmpty) return
  console.warn('[GeneFaluche graph viewport]', {
    reason,
    totalNodes: graph.value.nodes.length,
    zoom: graphZoom.value,
    translateX: pan.x,
    translateY: pan.y,
    viewport,
    graphBounds: content,
  })
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
    x:
      (nodeRect.left + nodeRect.width / 2 - viewportRect.left - graphPan.value.x) /
      graphRenderZoom.value,
    y:
      (nodeRect.top + nodeRect.height / 2 - viewportRect.top - graphPan.value.y) /
      graphRenderZoom.value,
  }
}

function resetGraphPan() {
  window.cancelAnimationFrame(graphPanFrame)
  graphPanFrame = 0
  window.cancelAnimationFrame(graphViewportMeasureFrame)
  graphViewportMeasureFrame = 0
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

async function handleUpcomingCreateFromComposer(payload, done = () => {}) {
  await handleUpcomingCreate(payload, (ok) => {
    if (ok) showUpcomingComposer.value = false
    done(ok)
  })
}

async function handlePersonCooptageCreate(payload, done = () => {}) {
  const person = selectedPerson.value
  const source = selectedPersonSourceGenealogy.value
  if (!person?.id || !source) {
    showFeedback("Impossible de relier ce cooptage à la fiche sélectionnée.", 'warning')
    done(false)
    return
  }

  const scope = source.type === 'family' ? 'family' : 'region'
  const regionId = source.type === 'family' ? source.parentId || '' : source.id || ''
  const familyId = source.type === 'family' ? source.id || '' : ''
  if (!regionId) {
    showFeedback("Impossible de déterminer la région de ce cooptage.", 'warning')
    done(false)
    return
  }

  await handleUpcomingCreate(
    {
      ...payload,
      eventType: 'cooptage',
      fillotIds: [person.id],
      baptizedNames: [],
      allowParticipation: false,
      scope,
      regionId,
      familyId,
      visibility: 'public',
      recurrence: 'none',
    },
    done,
  )
}

async function handleUpcomingDelete(eventId) {
  try {
    await upcoming.adminDeleteEvent(eventId)
    showFeedback("L'annonce a été supprimée.", 'success')
  } catch (err) {
    showFeedback(err.message || 'Suppression impossible.', 'warning')
  }
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
    showFeedback(
      payload.status === 'accepted' ? 'Demande acceptée.' : 'Demande refusée.',
      'success',
    )
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
  if (
    !window.confirm(
      'Supprimer cette fiche ? Cette action retirera aussi ses références dans les relations.',
    )
  )
    return

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

async function selectSessionPerson(personId) {
  if (!personId) return
  await ensureFullData()
  await preloadTreeView()
  selectPerson(personId)
  activeView.value = 'tree'
  setGraphLayoutMode('network')
}

async function moveSelectedPerson() {
  const personId = selectedPerson.value?.id || ''
  const targetGenealogyId =
    moveTargetGenealogyId.value || movableGenealogyOptions.value[0]?.id || ''
  if (!personId || !targetGenealogyId) return

  const allowedIds =
    adminSession.value?.level === 'region' ? adminManageableGenealogyIds.value : null
  const previousState = data.value
  data.value = movePersonToGenealogy(data.value, personId, targetGenealogyId, allowedIds)

  if (data.value === previousState) {
    showFeedback('Cette fiche ne peut pas être déplacée avec cette session admin.', 'warning')
    return
  }

  selectGenealogy(targetGenealogyId)
  await nextTick()
  selectPerson(personId)
  scheduleAutosave(300)
  showFeedback('La fiche a été déplacée.', 'success')
}

async function exportSelectedPersonPdf({
  ancestorDepth: pdfAncestorDepth,
  descendantDepth: pdfDescendantDepth,
  orientation: pdfOrientation = 'auto',
  exportMode: pdfExportMode = 'readable',
}) {
  await ensureFullData()
  const [{ downloadNetworkGraphPdf }, { buildGraphModel }] = await Promise.all([
    import('./features/exports/pdfExport.js'),
    import('./domain/graph.js'),
  ])
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
    orientation: pdfOrientation,
    exportMode: pdfExportMode,
  })
  activeOverlay.value = ''
  showFeedback(
    exported ? 'Le PDF réseau a été généré.' : "Sélectionne une fiche avant d'exporter.",
    exported ? 'success' : 'warning',
  )
}

function personUpdateWasApplied(expectedPerson, savedPerson) {
  if (!expectedPerson || !savedPerson) return false
  const fields = [
    'name',
    'nickname',
    'filiere',
    'filiereCustom',
    'filiere2',
    'filiere2Custom',
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
    JSON.stringify(savedPerson.ceremonyEvents || []) ===
      JSON.stringify(expectedPerson.ceremonyEvents || [])
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

function dismissFiliereRecoveryNotice() {
  showFiliereRecoveryNotice.value = false
  writeDismissedFlag(FILIERE_RECOVERY_NOTICE_KEY)
}

function readDismissedFlag(key) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeDismissedFlag(key) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
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

async function loadTutorialHints() {
  if (Object.keys(contextualHints.value).length) return
  const module = await import('./features/tutorial/tutorials.fr.js')
  contextualHints.value = module.contextualHintsFr || {}
}

async function handleTutorialToggle() {
  writeTutorialPreference(tutorialEnabled.value)
  if (tutorialEnabled.value) {
    await loadTutorialHints()
  }
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

function haloDepthToSliderValue(value) {
  return value === 'all' ? 4 : Number(value) || 1
}

function sliderValueToHaloDepth(value) {
  const depth = Number(value)
  return depth >= 4 ? 'all' : Math.min(3, Math.max(1, depth || 1))
}

function haloDepthLabel(value) {
  const depth = sliderValueToHaloDepth(value)
  return depth === 'all' ? 'Toutes' : String(depth)
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

async function openTutorial() {
  if (!tutorialEnabled.value || activeView.value !== 'home') return
  await loadTutorialHints()
  tutorialInitialId.value = ''
  tutorialOpen.value = true
}

function completeTutorial() {
  tutorialOpen.value = false
  tutorialInitialId.value = ''
}

async function openHelpCenter() {
  await loadTutorialHints()
  tutorialInitialId.value = ''
  tutorialOpen.value = true
}

async function openTutorialById(id) {
  await loadTutorialHints()
  tutorialInitialId.value = id || ''
  tutorialOpen.value = true
}

async function openTutorialFromHint() {
  const id = activeHint.value?.suggestedTutorialId || ''
  await loadTutorialHints()
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
  return contextualHints.value[key] || null
})

watch(activeHintKey, (key) => {
  if (!key) return
  loadTutorialHints().catch(() => {})
  // Reset dismissed hints when user explicitly re-opens help center.
  // (We keep this lightweight: no storage, session-only.)
})

function markEditing() {
  if (isCreatingPerson.value && pendingDuplicateCreation.value && !forcingDuplicateCreation.value) {
    pendingDuplicateCreation.value = null
  }
  editing.value = true
  window.clearTimeout(editingTimeout)
  editingTimeout = window.setTimeout(() => {
    editing.value = false
  }, 1200)
}

function scheduleAutosave(delay = 1400) {
  if (!hasUnsavedChanges.value) return
  window.clearTimeout(autosaveTimeout)
  autosaveTimeout = window.setTimeout(async () => {
    if (editing.value) {
      scheduleAutosave()
      return
    }
    if (!hasUnsavedChanges.value) return
    await save()
  }, delay)
}

async function selectSearchResult(personId) {
  await ensureFullData()
  await preloadTreeView()
  selectPerson(personId)
  graphFocusPersonId.value = personId
  activeView.value = 'tree'
  setGraphLayoutMode('network')
  searchQuery.value = ''
}

watch(selectedGenealogyId, () => {
  graphFocusPersonId.value = ''
})

watch(activeView, (view) => {
  if (['tree', 'overview', 'stats'].includes(view)) {
    ensureFullData().catch(() => {})
  }
  if (view === 'idea-box') {
    preloadSecondaryComponents(IDEA_BOX_COMPONENTS)
    if (!window.location.pathname.startsWith('/boite-a-idees')) {
      history.pushState({}, '', '/boite-a-idees')
    }
  }
})

watch(data, () => {
  graphLayoutCache.clear()
  if (activeView.value === 'tree') {
    refreshGraphModel()
  }
})

watch(
  [activeView, selectedGenealogyId, selectedPersonId, graphLayoutMode, ancestorDepth, descendantDepth],
  () => {
    refreshGraphModel()
  },
  { immediate: true, flush: 'post' },
)

watch(
  [activeView, genealogies],
  async () => {
    const requestId = ++statsLoadRequest
    if (activeView.value !== 'stats') {
      stats.value = null
      return
    }

    const { computeStats } = await import('./domain/stats.js')
    if (requestId === statsLoadRequest && activeView.value === 'stats') {
      stats.value = computeStats(genealogies.value)
    }
  },
  { immediate: true },
)

watch(adminSession, async (session) => {
  if (session && activeOverlay.value === 'doleances') {
    await doleances.loadAdminDoleances()
  }
})

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

watch([selectedGenealogyId, activeView], () => {
  resetGraphPan()
  nextTick(() => scheduleGraphViewportRefresh())
})

watch(
  [graphContentSize, graphZoom, graphLayoutMode],
  () => {
    if (activeView.value !== 'tree') return
    nextTick(() => scheduleGraphViewportRefresh())
  },
  { flush: 'post' },
)

onMounted(() => {
  if (window.location.pathname.startsWith('/boite-a-idees')) {
    openIdeaBoxView(false)
  }
  window.addEventListener('popstate', handleAppPopState)
  nextTick(() => scheduleGraphViewportRefresh())
  window.addEventListener('resize', scheduleGraphViewportRefresh)
  window.addEventListener('orientationchange', scheduleGraphViewportRefresh)
  window.visualViewport?.addEventListener('resize', scheduleGraphViewportRefresh)
  window.visualViewport?.addEventListener('scroll', scheduleGraphViewportRefresh)
})

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
  window.clearTimeout(graphRecenteringTimeout)
  window.cancelAnimationFrame(graphPanFrame)
  window.cancelAnimationFrame(graphViewportMeasureFrame)
  window.removeEventListener('resize', scheduleGraphViewportRefresh)
  window.removeEventListener('popstate', handleAppPopState)
  window.removeEventListener('orientationchange', scheduleGraphViewportRefresh)
  window.visualViewport?.removeEventListener('resize', scheduleGraphViewportRefresh)
  window.visualViewport?.removeEventListener('scroll', scheduleGraphViewportRefresh)
})

function handleAppPopState() {
  if (window.location.pathname.startsWith('/boite-a-idees')) {
    openIdeaBoxView(false)
  }
}
</script>
