<template>
  <section class="idea-box" aria-labelledby="idea-box-title">
    <header class="idea-box__hero">
      <div>
        <h2 id="idea-box-title">Boîte à idées</h2>
        <p>
          Découvrez les fonctionnalités envisagées, votez pour celles que vous aimeriez voir en
          priorité et proposez vos propres idées.
        </p>
        <p>
          Les votes servent à orienter le développement de GeneFaluche, mais ne garantissent pas
          qu'une fonctionnalité sera réalisée.
        </p>
      </div>
      <button type="button" class="app-button app-button--primary" @click="showSuggestionForm = true">
        Proposer une idée
      </button>
    </header>

    <section v-if="isAdmin" class="idea-admin-bar" aria-label="Mode administration Boîte à idées">
      <div>
        <strong>Mode administration actif</strong>
        <p>Gérez directement les idées et les suggestions depuis cette page.</p>
      </div>
      <div class="idea-admin-bar__actions">
        <button type="button" class="app-button app-button--primary" @click="beginProposalCreate">
          Nouvelle idée
        </button>
        <button type="button" class="app-button" @click="openSuggestionsTab">
          Suggestions en attente · {{ pendingSuggestionCount }}
        </button>
        <button type="button" class="app-button" @click="showStatsPanel = true">Statistiques</button>
        <button type="button" class="text-button" @click="$emit('admin-logout')">Se déconnecter</button>
      </div>
    </section>

    <section v-if="selectedProposal" class="idea-detail" aria-live="polite">
      <button type="button" class="text-button" @click="closeDetail">Retour à la Boîte à idées</button>
      <article class="idea-detail__panel">
        <header>
          <span class="idea-badge" :class="`idea-badge--${selectedProposal.status}`">
            {{ statusLabel(selectedProposal.status) }}
          </span>
          <span v-if="selectedProposal.featured" class="idea-badge idea-badge--featured">Mise en avant</span>
          <h3>{{ selectedProposal.title }}</h3>
          <p>{{ selectedProposal.summary }}</p>
        </header>

        <div class="idea-detail__grid">
          <section>
            <h4>Description</h4>
            <p>{{ selectedProposal.description || selectedProposal.summary }}</p>
          </section>
          <section v-if="selectedProposal.problemStatement">
            <h4>Problème traité</h4>
            <p>{{ selectedProposal.problemStatement }}</p>
          </section>
          <section v-if="selectedProposal.expectedBenefit">
            <h4>Bénéfice attendu</h4>
            <p>{{ selectedProposal.expectedBenefit }}</p>
          </section>
          <section v-if="selectedProposal.publicComment">
            <h4>Commentaire public</h4>
            <p>{{ selectedProposal.publicComment }}</p>
          </section>
        </div>

        <dl class="idea-meta">
          <div><dt>Catégorie</dt><dd>{{ categoryLabel(selectedProposal.category) }}</dd></div>
          <div><dt>Difficulté</dt><dd>{{ difficultyLabel(selectedProposal.difficulty) || 'Non définie' }}</dd></div>
          <div><dt>Version cible</dt><dd>{{ selectedProposal.targetVersion || 'Non définie' }}</dd></div>
          <div><dt>Créée le</dt><dd>{{ formatDate(selectedProposal.createdAt) }}</dd></div>
          <div><dt>Mise à jour</dt><dd>{{ formatDate(selectedProposal.updatedAt) }}</dd></div>
          <div v-if="selectedProposal.releasedAt"><dt>Publiée le</dt><dd>{{ formatDate(selectedProposal.releasedAt) }}</dd></div>
        </dl>

        <IdeaVoteControls
          :proposal="selectedProposal"
          :busy="voteBusyId === selectedProposal.id"
          @vote="handleVote"
          @remove="handleVoteRemove"
        />
        <div v-if="isAdmin" class="idea-admin-inline-actions" aria-label="Actions administrateur">
          <button type="button" class="app-button" @click="beginProposalEdit(selectedProposal)">Modifier</button>
          <button type="button" class="app-button" @click="toggleVoting(selectedProposal)">
            {{ selectedProposal.votingOpen ? 'Fermer les votes' : 'Ouvrir les votes' }}
          </button>
          <button type="button" class="app-button" @click="toggleFeatured(selectedProposal)">
            {{ selectedProposal.featured ? 'Retirer de la mise en avant' : 'Mettre en avant' }}
          </button>
          <button type="button" class="text-button danger-text" @click="archiveProposal(selectedProposal)">Archiver</button>
          <button type="button" class="text-button danger-text" @click="deleteProposal(selectedProposal)">Supprimer</button>
        </div>
        <button type="button" class="text-button" @click="copyCurrentLink">Copier le lien de l'idée</button>
      </article>
    </section>

    <template v-else>
      <section class="idea-filters" aria-label="Filtres de la Boîte à idées">
        <div class="idea-tabs" role="tablist" aria-label="Statut">
          <button
            v-for="tab in visibleTabs"
            :key="tab.id"
            type="button"
            :class="{ 'is-active': filters.status === tab.id }"
            :aria-selected="filters.status === tab.id"
            @click="setStatus(tab.id)"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="idea-filter-row">
          <label>
            Catégorie
            <select v-model="filters.category">
              <option value="">Toutes les catégories</option>
              <option v-for="category in ideaBoxCategories" :key="category" :value="category">
                {{ category }}
              </option>
            </select>
          </label>
          <label>
            Tri
            <select v-model="filters.sort">
              <option v-for="sort in ideaBoxSorts" :key="sort.id" :value="sort.id">
                {{ sort.label }}
              </option>
            </select>
          </label>
          <label>
            Recherche
            <input v-model.trim="filters.query" type="search" maxlength="120" placeholder="Titre ou mot-clé" />
          </label>
          <button type="button" class="text-button" @click="resetFilters">
            Réinitialiser <span v-if="activeFilterCount">({{ activeFilterCount }})</span>
          </button>
        </div>
      </section>

      <p v-if="loading" class="notice">Chargement de la Boîte à idées...</p>
      <section v-else-if="error" class="idea-error" role="alert">
        <strong>Impossible de charger la Boîte à idées.</strong>
        <p>{{ error }}</p>
        <button type="button" class="app-button" @click="loadProposals">Réessayer</button>
      </section>
      <section v-else-if="filters.status === 'suggestions'" class="idea-suggestion-list" aria-live="polite">
        <div class="idea-filter-row idea-suggestion-filters">
          <label>
            Statut de modération
            <select v-model="suggestionStatusFilter">
              <option value="">Tous les statuts</option>
              <option value="pending_review">En attente</option>
              <option value="accepted">Acceptée</option>
              <option value="converted">Transformée</option>
              <option value="duplicate">Doublon</option>
              <option value="rejected">Refusée</option>
              <option value="archived">Archivée</option>
            </select>
          </label>
        </div>
        <article v-for="suggestionItem in filteredSuggestions" :key="suggestionItem.id" class="idea-suggestion-card">
          <header>
            <strong>{{ suggestionItem.title }}</strong>
            <span>{{ suggestionStatusLabel(suggestionItem.moderationStatus) }} · {{ categoryLabel(suggestionItem.category) }} · {{ formatDate(suggestionItem.createdAt) }}</span>
          </header>
          <p>{{ suggestionItem.description }}</p>
          <p v-if="suggestionItem.suggestedSolution"><strong>Solution :</strong> {{ suggestionItem.suggestedSolution }}</p>
          <p v-if="suggestionItem.contactEmail"><strong>E-mail :</strong> {{ suggestionItem.contactEmail }} · consentement {{ suggestionItem.consentContact ? 'oui' : 'non' }}</p>
          <div class="idea-admin-inline-actions">
            <button type="button" class="app-button app-button--primary" @click="beginSuggestionConversion(suggestionItem)">Transformer en idée publique</button>
            <button type="button" class="app-button" @click="mergeSuggestion(suggestionItem)">Fusionner avec une idée existante</button>
            <button type="button" class="app-button" @click="updateSuggestionStatus(suggestionItem, 'accepted')">Accepter</button>
            <button type="button" class="app-button" @click="updateSuggestionStatus(suggestionItem, 'duplicate')">Marquer comme doublon</button>
            <button type="button" class="text-button danger-text" @click="updateSuggestionStatus(suggestionItem, 'rejected')">Refuser</button>
            <button type="button" class="text-button" @click="updateSuggestionStatus(suggestionItem, 'archived')">Archiver</button>
            <button type="button" class="text-button danger-text" @click="deleteSuggestion(suggestionItem)">Supprimer</button>
          </div>
        </article>
        <p v-if="!filteredSuggestions.length" class="notice">Aucune suggestion ne correspond à ces filtres.</p>
      </section>
      <section v-else-if="!proposals.length" class="idea-empty">
        <p>Aucune idée ne correspond à ces filtres.</p>
        <button type="button" class="app-button app-button--primary" @click="showSuggestionForm = true">
          Proposer une idée
        </button>
      </section>
      <section v-else class="idea-grid" aria-live="polite">
        <article v-for="proposal in proposals" :key="proposal.id" class="idea-card">
          <header>
            <span class="idea-badge" :class="`idea-badge--${proposal.status}`">
              {{ statusLabel(proposal.status) }}
            </span>
            <span v-if="proposal.featured" class="idea-badge idea-badge--featured">Mise en avant</span>
            <h3>{{ proposal.title }}</h3>
            <details v-if="isAdmin" class="idea-card-admin-menu">
              <summary aria-label="Gérer cette idée">Gérer</summary>
              <div>
                <button type="button" @click="beginProposalEdit(proposal)">Modifier</button>
                <button type="button" @click="quickStatus(proposal)">Changer le statut</button>
                <button type="button" @click="toggleFeatured(proposal)">
                  {{ proposal.featured ? 'Retirer de la mise en avant' : 'Mettre en avant' }}
                </button>
                <button type="button" @click="toggleVoting(proposal)">
                  {{ proposal.votingOpen ? 'Fermer les votes' : 'Ouvrir les votes' }}
                </button>
                <button type="button" @click="duplicateProposal(proposal)">Dupliquer</button>
                <button type="button" @click="archiveProposal(proposal)">Archiver</button>
                <button type="button" class="danger-text" @click="deleteProposal(proposal)">Supprimer</button>
              </div>
            </details>
          </header>
          <p class="idea-card__summary">{{ proposal.summary }}</p>
          <dl class="idea-card__meta">
            <div><dt>Catégorie</dt><dd>{{ categoryLabel(proposal.category) }}</dd></div>
            <div v-if="proposal.difficulty"><dt>Complexité</dt><dd>{{ difficultyLabel(proposal.difficulty) }}</dd></div>
            <div><dt>Date</dt><dd>{{ formatDate(proposal.releasedAt || proposal.createdAt) }}</dd></div>
          </dl>
          <footer class="idea-card__actions">
            <IdeaVoteControls
              :proposal="proposal"
              :busy="voteBusyId === proposal.id"
              compact
              @vote="handleVote"
              @remove="handleVoteRemove"
            />
            <button type="button" class="app-button idea-card__detail" @click="openDetail(proposal.slug)">
              Voir le détail
            </button>
          </footer>
        </article>
      </section>
    </template>

    <section v-if="showProposalEditor" class="idea-modal" role="dialog" aria-modal="true" aria-labelledby="idea-editor-title" @click.self="requestEditorClose">
      <form class="idea-modal__panel idea-editor-form" @submit.prevent="saveProposalDraft">
        <header>
          <h3 id="idea-editor-title">{{ proposalDraft.id ? 'Modifier une idée' : 'Nouvelle idée' }}</h3>
          <button type="button" class="overlay-close" @click="requestEditorClose">Fermer</button>
        </header>
        <div class="idea-editor-form__grid">
          <label>Titre<input v-model.trim="proposalDraft.title" required maxlength="120" @input="markProposalDirty" /></label>
          <label>Slug<input v-model.trim="proposalDraft.slug" required maxlength="160" @input="markProposalDirty" /></label>
          <label>Catégorie
            <select v-model="proposalDraft.category" required @change="markProposalDirty">
              <option v-for="category in ideaBoxCategories" :key="category" :value="category">{{ category }}</option>
            </select>
          </label>
          <label>Statut
            <select v-model="proposalDraft.status" @change="markProposalDirty">
              <option v-for="status in ideaBoxStatuses" :key="status.id" :value="status.id">{{ status.label }}</option>
            </select>
          </label>
          <label>Difficulté
            <select v-model="proposalDraft.difficulty" @change="markProposalDirty">
              <option v-for="difficulty in ideaBoxDifficulties" :key="difficulty.id" :value="difficulty.id">{{ difficulty.label }}</option>
            </select>
          </label>
          <label>Priorité technique
            <select v-model="proposalDraft.technicalPriority" @change="markProposalDirty">
              <option v-for="priority in ideaBoxPriorities" :key="priority.id" :value="priority.id">{{ priority.label }}</option>
            </select>
          </label>
          <label>Version cible<input v-model.trim="proposalDraft.targetVersion" maxlength="30" @input="markProposalDirty" /></label>
          <label>Ordre d'affichage<input v-model.number="proposalDraft.displayOrder" type="number" @input="markProposalDirty" /></label>
          <label>Date de publication<input v-model="proposalDraft.publishedAt" type="datetime-local" @input="markProposalDirty" /></label>
          <label>Date de sortie<input v-model="proposalDraft.releasedAt" type="datetime-local" @input="markProposalDirty" /></label>
        </div>
        <label>Résumé<textarea v-model.trim="proposalDraft.summary" required maxlength="500" @input="markProposalDirty"></textarea></label>
        <label>Description détaillée<textarea v-model.trim="proposalDraft.description" maxlength="5000" @input="markProposalDirty"></textarea></label>
        <label>Problème traité<textarea v-model.trim="proposalDraft.problemStatement" maxlength="3000" @input="markProposalDirty"></textarea></label>
        <label>Bénéfice attendu<textarea v-model.trim="proposalDraft.expectedBenefit" maxlength="3000" @input="markProposalDirty"></textarea></label>
        <label>Commentaire public<textarea v-model.trim="proposalDraft.publicComment" maxlength="3000" @input="markProposalDirty"></textarea></label>
        <div class="admin-idea-checks">
          <label class="idea-check"><input v-model="proposalDraft.votingOpen" type="checkbox" @change="markProposalDirty" /> Votes ouverts</label>
          <label class="idea-check"><input v-model="proposalDraft.featured" type="checkbox" @change="markProposalDirty" /> Mise en avant</label>
        </div>
        <p v-if="proposalEditorError" class="notice notice--error">{{ proposalEditorError }}</p>
        <div class="idea-admin-inline-actions">
          <button type="submit" class="app-button app-button--primary" :disabled="adminBusy">{{ adminBusy ? 'Sauvegarde...' : 'Enregistrer' }}</button>
          <button type="button" class="app-button" @click="requestEditorClose">Annuler</button>
        </div>
      </form>
    </section>

    <section v-if="showStatsPanel" class="idea-modal" role="dialog" aria-modal="true" aria-labelledby="idea-stats-title" @click.self="showStatsPanel = false">
      <section class="idea-modal__panel">
        <header>
          <h3 id="idea-stats-title">Statistiques</h3>
          <button type="button" class="overlay-close" @click="showStatsPanel = false">Fermer</button>
        </header>
        <div v-if="adminStats" class="idea-admin-stats">
          <article><strong>{{ adminStats.totalProposals }}</strong><span>idées</span></article>
          <article><strong>{{ adminStats.openVotes }}</strong><span>ouvertes au vote</span></article>
          <article><strong>{{ adminStats.totalVotes }}</strong><span>votes</span></article>
          <article><strong>{{ adminStats.upVotes }}</strong><span>votes positifs</span></article>
          <article><strong>{{ adminStats.downVotes }}</strong><span>votes négatifs</span></article>
          <article><strong>{{ adminStats.pendingSuggestions }}</strong><span>suggestions en attente</span></article>
        </div>
        <div v-if="adminStats" class="idea-admin-stat-lists">
          <section>
            <h4>Plus populaires</h4>
            <p v-for="item in adminStats.popular || []" :key="`popular-${item.id}`">{{ item.title }} · Pour {{ item.votes.up }}</p>
          </section>
          <section>
            <h4>Plus controversées</h4>
            <p v-for="item in adminStats.controversial || []" :key="`controversial-${item.id}`">{{ item.title }} · {{ item.votes.total }} vote(s)</p>
          </section>
        </div>
      </section>
    </section>

    <section v-if="showSuggestionForm" class="idea-modal" role="dialog" aria-modal="true" aria-labelledby="idea-suggest-title" @click.self="showSuggestionForm = false">
      <form class="idea-modal__panel" @submit.prevent="submitSuggestion">
        <header>
          <h3 id="idea-suggest-title">Proposer une idée</h3>
          <button type="button" class="overlay-close" @click="showSuggestionForm = false">Fermer</button>
        </header>
        <label>
          Titre de l'idée
          <input v-model.trim="suggestion.title" required maxlength="120" />
        </label>
        <label>
          Description du besoin
          <textarea v-model.trim="suggestion.description" required maxlength="2000"></textarea>
        </label>
        <label>
          Solution suggérée
          <textarea v-model.trim="suggestion.suggestedSolution" maxlength="2000"></textarea>
        </label>
        <label>
          Catégorie
          <select v-model="suggestion.category" required>
            <option value="">Choisir</option>
            <option v-for="category in ideaBoxCategories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </label>
        <label>
          E-mail facultatif
          <input v-model.trim="suggestion.contactEmail" type="email" maxlength="254" />
          <small>Facultatif. Cette adresse sera uniquement utilisée pour vous recontacter au sujet de votre idée.</small>
        </label>
        <label v-if="suggestion.contactEmail" class="idea-check">
          <input v-model="suggestion.consentContact" type="checkbox" />
          J'accepte d'être recontacté au sujet de cette idée.
        </label>
        <label class="idea-honeypot" aria-hidden="true">
          Site web
          <input v-model="suggestion.website" tabindex="-1" autocomplete="off" />
        </label>
        <p v-if="suggestionError" class="notice notice--error">{{ suggestionError }}</p>
        <button type="submit" class="app-button app-button--primary" :disabled="suggestionBusy">
          {{ suggestionSubmitLabel }}
        </button>
      </form>
    </section>

    <p class="idea-privacy">
      Un identifiant anonyme est enregistré dans votre navigateur afin de limiter les votes multiples.
    </p>
    <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  createIdeaBoxSuggestion,
  deleteIdeaBoxSuggestion,
  deleteIdeaBoxVote,
  deleteIdeaBoxProposal,
  loadIdeaBoxAdmin,
  getIdeaBoxProposal,
  getOrCreateIdeaBoxVoterId,
  listIdeaBoxProposals,
  saveIdeaBoxProposal,
  updateIdeaBoxSuggestion,
  voteIdeaBoxProposal,
} from '../../api/ideaBoxApi.js'
import {
  ideaBoxCategories,
  ideaBoxDifficulties,
  ideaBoxLabel,
  ideaBoxPriorities,
  ideaBoxPublicTabs,
  ideaBoxSorts,
  ideaBoxStatuses,
} from '../../domain/ideaBox.js'
import IdeaVoteControls from './IdeaVoteControls.vue'

const props = defineProps({
  adminSession: { type: Object, default: null },
  csrfToken: { type: String, default: '' },
})
const emit = defineEmits(['feedback', 'admin-logout'])
const proposals = ref([])
const selectedProposal = ref(null)
const loading = ref(false)
const error = ref('')
const voteBusyId = ref(0)
const adminBusy = ref(false)
const liveMessage = ref('')
const showSuggestionForm = ref(false)
const showProposalEditor = ref(false)
const showStatsPanel = ref(false)
const suggestionBusy = ref(false)
const suggestionError = ref('')
const proposalEditorError = ref('')
const voterToken = ref('')
const filters = reactive({ status: 'under_review', category: '', sort: 'popular', query: '', page: 1, limit: 30 })
const adminSuggestions = ref([])
const adminStats = ref(null)
const suggestionStatusFilter = ref('')
const proposalDirty = ref(false)
const convertingSuggestionId = ref(0)
const proposalDraft = reactive(emptyProposalDraft())
const suggestion = reactive({
  title: '',
  description: '',
  suggestedSolution: '',
  category: '',
  contactEmail: '',
  consentContact: false,
  website: '',
})
let loadTimer = 0

const activeFilterCount = computed(
  () => Number(Boolean(filters.category)) + Number(filters.sort !== 'popular') + Number(Boolean(filters.query)),
)
const suggestionSubmitLabel = computed(() => (suggestionBusy.value ? 'Envoi...' : "Envoyer l'idée"))
const isAdmin = computed(() => props.adminSession?.level === 'general')
const visibleTabs = computed(() => [
  ...ideaBoxPublicTabs,
  ...(isAdmin.value ? [{ id: 'suggestions', label: 'Suggestions reçues' }] : []),
])
const pendingSuggestionCount = computed(
  () => adminSuggestions.value.filter((item) => item.moderationStatus === 'pending_review').length,
)
const filteredSuggestions = computed(() => {
  if (!suggestionStatusFilter.value) return adminSuggestions.value
  return adminSuggestions.value.filter((item) => item.moderationStatus === suggestionStatusFilter.value)
})

onMounted(() => {
  voterToken.value = getOrCreateIdeaBoxVoterId()
  const slug = slugFromLocation()
  if (slug) {
    openDetail(slug, false)
  } else {
    loadProposals()
  }
  if (isAdmin.value) loadAdminData()
  window.addEventListener('popstate', handlePopState)
})

onBeforeUnmount(() => {
  window.clearTimeout(loadTimer)
  window.removeEventListener('popstate', handlePopState)
})

watch(filters, () => {
  if (filters.status === 'suggestions') return
  window.clearTimeout(loadTimer)
  loadTimer = window.setTimeout(loadProposals, 220)
})

watch(
  () => props.adminSession,
  (session, previous) => {
    if (session?.level === 'general') {
      loadAdminData()
      return
    }
    if (previous?.level === 'general') {
      adminSuggestions.value = []
      adminStats.value = null
      if (filters.status === 'suggestions') setStatus('under_review')
      feedback('La session administrateur a expiré.', 'warning')
    }
  },
)

async function loadProposals() {
  loading.value = true
  error.value = ''
  try {
    const payload = await listIdeaBoxProposals(filters, voterToken.value)
    proposals.value = payload.proposals || []
  } catch (err) {
    error.value = err.message || 'Impossible de charger la Boîte à idées.'
  } finally {
    loading.value = false
  }
}

async function loadAdminData() {
  if (!isAdmin.value) return
  try {
    const payload = await loadIdeaBoxAdmin()
    adminSuggestions.value = payload.suggestions || []
    adminStats.value = payload.stats || null
  } catch (err) {
    handleAdminError(err, 'Chargement du mode administration impossible.')
  }
}

async function openDetail(slug, push = true) {
  loading.value = true
  error.value = ''
  try {
    const payload = await getIdeaBoxProposal(slug, voterToken.value)
    selectedProposal.value = payload.proposal
    if (push) history.pushState({}, '', `/boite-a-idees/${payload.proposal.slug}`)
  } catch (err) {
    error.value = err.message || 'Idée introuvable.'
    selectedProposal.value = null
  } finally {
    loading.value = false
  }
}

function closeDetail(push = true) {
  selectedProposal.value = null
  if (push) history.pushState({}, '', '/boite-a-idees')
  loadProposals()
}

function handlePopState() {
  const slug = slugFromLocation()
  if (slug) openDetail(slug, false)
  else closeDetail(false)
}

function slugFromLocation() {
  const match = window.location.pathname.match(/^\/boite-a-idees\/([^/]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

function setStatus(status) {
  if (status === 'suggestions') {
    if (!isAdmin.value) return
    filters.status = status
    loadAdminData()
    return
  }
  filters.status = status
  filters.page = 1
}

function resetFilters() {
  filters.category = ''
  filters.sort = 'popular'
  filters.query = ''
}

function openSuggestionsTab() {
  setStatus('suggestions')
}

async function handleVote({ proposal, voteValue, reasonCode, reasonText }) {
  voteBusyId.value = proposal.id
  try {
    const previousVote = proposal.currentVote
    const payload = await voteIdeaBoxProposal({
      proposalId: proposal.id,
      voterToken: voterToken.value,
      voteValue,
      reasonCode,
      reasonText,
    })
    applyVoteResult(proposal.id, payload)
    const message = previousVote && previousVote !== voteValue ? 'Votre vote a été modifié.' : 'Votre vote a été enregistré.'
    feedback(message)
  } catch (err) {
    feedback(err.message || "Impossible d'enregistrer votre vote. Réessayez.", 'warning')
  } finally {
    voteBusyId.value = 0
  }
}

async function handleVoteRemove(proposal) {
  voteBusyId.value = proposal.id
  try {
    const payload = await deleteIdeaBoxVote(proposal.id, voterToken.value)
    applyVoteResult(proposal.id, payload)
    feedback('Votre vote a été retiré.')
  } catch (err) {
    feedback(err.message || "Impossible d'enregistrer votre vote. Réessayez.", 'warning')
  } finally {
    voteBusyId.value = 0
  }
}

function applyVoteResult(proposalId, payload) {
  const update = (proposal) => {
    if (!proposal || proposal.id !== proposalId) return proposal
    proposal.votes = payload.counts
    proposal.currentVote = payload.vote
    return proposal
  }
  proposals.value = proposals.value.map(update)
  selectedProposal.value = update(selectedProposal.value)
  liveMessage.value = `Votes mis à jour : ${payload.counts.up} pour, ${payload.counts.down} contre.`
}

function beginProposalCreate() {
  Object.assign(proposalDraft, emptyProposalDraft())
  proposalDirty.value = false
  proposalEditorError.value = ''
  convertingSuggestionId.value = 0
  showProposalEditor.value = true
}

function beginProposalEdit(proposal) {
  Object.assign(proposalDraft, {
    ...emptyProposalDraft(),
    ...proposal,
    publishedAt: toDatetimeLocal(proposal.publishedAt),
    releasedAt: toDatetimeLocal(proposal.releasedAt),
  })
  proposalDirty.value = false
  proposalEditorError.value = ''
  convertingSuggestionId.value = 0
  showProposalEditor.value = true
}

function beginSuggestionConversion(item) {
  Object.assign(proposalDraft, {
    ...emptyProposalDraft(),
    title: item.title || '',
    slug: slugify(item.title || ''),
    summary: (item.description || '').slice(0, 500),
    description: item.suggestedSolution || item.description || '',
    category: ideaBoxCategories.includes(item.category) ? item.category : categoryLabel(item.category),
  })
  convertingSuggestionId.value = item.id
  proposalDirty.value = true
  proposalEditorError.value = ''
  showProposalEditor.value = true
}

function duplicateProposal(proposal) {
  Object.assign(proposalDraft, {
    ...emptyProposalDraft(),
    ...proposal,
    id: 0,
    title: `${proposal.title} - copie`,
    slug: `${proposal.slug}-copie`,
    publishedAt: '',
    releasedAt: '',
  })
  proposalDirty.value = true
  proposalEditorError.value = ''
  convertingSuggestionId.value = 0
  showProposalEditor.value = true
}

async function saveProposalDraft() {
  if (!isAdmin.value) return handleAdminError({ status: 401 }, 'Accès administrateur requis.')
  proposalEditorError.value = ''
  if (!proposalDraft.title || !proposalDraft.slug || !proposalDraft.summary) {
    proposalEditorError.value = 'Titre, slug et résumé sont obligatoires.'
    return
  }
  adminBusy.value = true
  try {
    const payload = await saveIdeaBoxProposal({ ...proposalDraft }, props.csrfToken)
    mergeProposal(payload.proposal)
    if (convertingSuggestionId.value) {
      await updateIdeaBoxSuggestion(
        { suggestionId: convertingSuggestionId.value, status: 'converted', linkedProposalId: payload.proposal.id },
        props.csrfToken,
      )
      await loadAdminData()
    }
    proposalDirty.value = false
    showProposalEditor.value = false
    feedback("L'idée a été enregistrée.")
  } catch (err) {
    proposalEditorError.value = err.message || 'Enregistrement impossible.'
    handleAdminError(err)
  } finally {
    adminBusy.value = false
  }
}

async function quickSaveProposal(proposal, patch, message = "L'idée a été mise à jour.") {
  if (!isAdmin.value) return
  adminBusy.value = true
  try {
    const payload = await saveIdeaBoxProposal({ ...proposal, ...patch }, props.csrfToken)
    mergeProposal(payload.proposal)
    feedback(message)
  } catch (err) {
    handleAdminError(err, err.message || 'Action administrateur impossible.')
  } finally {
    adminBusy.value = false
  }
}

function toggleFeatured(proposal) {
  quickSaveProposal(
    proposal,
    { featured: !proposal.featured },
    proposal.featured ? 'Mise en avant retirée.' : 'Idée mise en avant.',
  )
}

function toggleVoting(proposal) {
  quickSaveProposal(
    proposal,
    { votingOpen: !proposal.votingOpen },
    proposal.votingOpen ? 'Votes fermés.' : 'Votes ouverts.',
  )
}

function quickStatus(proposal) {
  const order = ['under_review', 'planned', 'in_development', 'in_testing', 'published']
  const index = order.indexOf(proposal.status)
  quickSaveProposal(proposal, { status: order[(index + 1) % order.length] || 'under_review' }, 'Statut mis à jour.')
}

function archiveProposal(proposal) {
  if (!window.confirm('Archiver cette idée ?')) return
  quickSaveProposal(proposal, { status: 'archived' }, "L'idée a été archivée.")
}

async function deleteProposal(proposal) {
  if (!window.confirm('Supprimer définitivement cette idée ?')) return
  adminBusy.value = true
  try {
    await deleteIdeaBoxProposal(proposal.id, props.csrfToken)
    proposals.value = proposals.value.filter((item) => item.id !== proposal.id)
    if (selectedProposal.value?.id === proposal.id) selectedProposal.value = null
    feedback("L'idée a été supprimée.")
  } catch (err) {
    handleAdminError(err, err.message || 'Suppression impossible.')
  } finally {
    adminBusy.value = false
  }
}

async function updateSuggestionStatus(item, status) {
  adminBusy.value = true
  try {
    await updateIdeaBoxSuggestion({ suggestionId: item.id, status }, props.csrfToken)
    item.moderationStatus = status
    feedback('Suggestion mise à jour.')
    await loadAdminData()
  } catch (err) {
    handleAdminError(err, err.message || 'Mise à jour de la suggestion impossible.')
  } finally {
    adminBusy.value = false
  }
}

async function mergeSuggestion(item) {
  const linkedProposalId = Number(window.prompt("ID de l'idée publique à associer à cette suggestion :") || 0)
  if (!linkedProposalId) return
  adminBusy.value = true
  try {
    await updateIdeaBoxSuggestion(
      {
        suggestionId: item.id,
        status: 'duplicate',
        linkedProposalId,
        adminNote: `Fusionnée avec l'idée #${linkedProposalId}.`,
      },
      props.csrfToken,
    )
    item.moderationStatus = 'duplicate'
    item.linkedProposalId = linkedProposalId
    feedback('Suggestion fusionnée avec une idée existante.')
    await loadAdminData()
  } catch (err) {
    handleAdminError(err, 'Fusion impossible.')
  } finally {
    adminBusy.value = false
  }
}

async function deleteSuggestion(item) {
  if (!window.confirm('Supprimer définitivement cette suggestion ?')) return
  adminBusy.value = true
  try {
    await deleteIdeaBoxSuggestion(item.id, props.csrfToken)
    adminSuggestions.value = adminSuggestions.value.filter((suggestionItem) => suggestionItem.id !== item.id)
    feedback('Suggestion supprimée.')
  } catch (err) {
    handleAdminError(err, 'Suppression de la suggestion impossible.')
  } finally {
    adminBusy.value = false
  }
}

function mergeProposal(proposal) {
  if (!proposal?.id) return
  const replace = (item) => (item.id === proposal.id ? proposal : item)
  const exists = proposals.value.some((item) => item.id === proposal.id)
  proposals.value = exists ? proposals.value.map(replace) : [proposal, ...proposals.value]
  if (selectedProposal.value?.id === proposal.id) selectedProposal.value = proposal
}

function markProposalDirty() {
  proposalDirty.value = true
  if (!proposalDraft.slug && proposalDraft.title) {
    proposalDraft.slug = slugify(proposalDraft.title)
  }
}

function requestEditorClose() {
  if (proposalDirty.value && !window.confirm('Fermer sans enregistrer les modifications ?')) return
  showProposalEditor.value = false
  proposalDirty.value = false
  convertingSuggestionId.value = 0
}

function handleAdminError(err, fallback = '') {
  if (err?.status === 401 || err?.status === 403) {
    feedback('La session administrateur a expiré.', 'warning')
    return
  }
  if (fallback) feedback(fallback, 'warning')
}

async function submitSuggestion() {
  suggestionError.value = ''
  if (suggestion.contactEmail && !suggestion.consentContact) {
    suggestionError.value = 'Le consentement est obligatoire si un e-mail est renseigné.'
    return
  }
  suggestionBusy.value = true
  try {
    await createIdeaBoxSuggestion({ ...suggestion })
    Object.assign(suggestion, {
      title: '',
      description: '',
      suggestedSolution: '',
      category: '',
      contactEmail: '',
      consentContact: false,
      website: '',
    })
    showSuggestionForm.value = false
    feedback("Votre idée a bien été transmise. Elle sera examinée avant une éventuelle publication dans la Boîte à idées.")
  } catch (err) {
    suggestionError.value = err.message || "Votre idée n'a pas pu être envoyée."
  } finally {
    suggestionBusy.value = false
  }
}

async function copyCurrentLink() {
  await navigator.clipboard?.writeText(window.location.href)
  feedback("Lien de l'idée copié.")
}

function feedback(message, kind = 'success') {
  emit('feedback', { message, kind })
}

function statusLabel(status) {
  return ideaBoxLabel(ideaBoxStatuses, status)
}

function difficultyLabel(difficulty) {
  return ideaBoxLabel(ideaBoxDifficulties, difficulty)
}

function categoryLabel(category) {
  const normalised = String(category || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[_-]+/g, ' ')
  const aliases = {
    events: 'Événements',
    event: 'Événements',
    evenement: 'Événements',
    evenements: 'Événements',
    arbre: 'Arbre et réseau',
    graph: 'Arbre et réseau',
    network: 'Arbre et réseau',
    tree: 'Arbre et réseau',
    privacy: 'Confidentialité',
    confidentialite: 'Confidentialité',
    performance: 'Performance',
    performances: 'Performance',
    export: 'Export',
    exports: 'Export',
    mobile: 'Mobile',
    administration: 'Administration',
    admin: 'Administration',
    tutorial: 'Tutoriels',
    tutorials: 'Tutoriels',
    tutoriels: 'Tutoriels',
    fiche: 'Fiches',
    fiches: 'Fiches',
    autre: 'Autre',
    other: 'Autre',
  }
  return aliases[normalised] || ideaBoxCategories.find((item) => item === category) || category || 'Autre'
}

function suggestionStatusLabel(status) {
  return {
    pending_review: 'En attente',
    accepted: 'Acceptée',
    converted: 'Transformée',
    duplicate: 'Doublon',
    rejected: 'Refusée',
    archived: 'Archivée',
  }[status] || status
}

function emptyProposalDraft() {
  return {
    id: 0,
    title: '',
    slug: '',
    summary: '',
    description: '',
    problemStatement: '',
    expectedBenefit: '',
    category: 'Autre',
    status: 'under_review',
    difficulty: '',
    technicalPriority: '',
    targetVersion: '',
    publicComment: '',
    votingOpen: true,
    featured: false,
    displayOrder: 0,
    publishedAt: '',
    releasedAt: '',
  }
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160)
}

function toDatetimeLocal(value) {
  if (!value) return ''
  return String(value).replace(' ', 'T').slice(0, 16)
}

function formatDate(value) {
  if (!value) return 'Non définie'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value.replace(' ', 'T')))
}
</script>
