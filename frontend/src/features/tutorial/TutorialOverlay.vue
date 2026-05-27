<template>
  <div class="tut-overlay" role="dialog" aria-modal="true" aria-label="Aide / Tutoriels">
    <button
      type="button"
      class="tut-overlay__backdrop"
      aria-label="Fermer le tutoriel"
      @click="emit('skip')"
    />

    <div class="tut-glass-strong tut-overlay__panel">
      <div class="tut-overlay__handle"><span /></div>

      <header class="tut-overlay__head">
        <div class="tut-overlay__head-row">
          <div class="tut-overlay__head-text">
            <div class="tut-eyebrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.66 4 3 6 3s6-1.34 6-3v-5"/>
              </svg>
              Aide / Tutoriels
            </div>
            <h2 class="tut-overlay__title">{{ activeTutorial ? activeTutorial.title : 'Choisir un tutoriel' }}</h2>
          </div>
          <button type="button" class="tut-btn-ghost" aria-label="Fermer" @click="emit('skip')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </header>

      <div class="tut-overlay__body">
        <!-- Picker -->
        <template v-if="!activeTutorial">
          <p class="tut-overlay__intro">
            Choisis un tutoriel court et guidé. Active le mode tutoriel sur l’accueil pour voir
            des bulles d’aide automatiques.
          </p>
          <ul class="tut-picker-list">
            <li v-for="t in visibleTutorials" :key="t.id">
              <button type="button" class="tut-picker-item" @click="selectTutorial(t.id)">
                <div class="tut-picker-item__row">
                  <div class="tut-picker-item__icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                    </svg>
                  </div>
                  <div class="tut-picker-item__main">
                    <div class="tut-picker-item__title-row">
                      <h3 class="tut-picker-item__title">{{ t.title }}</h3>
                      <span class="tut-picker-item__chip">{{ t.steps.length }} étapes</span>
                    </div>
                    <p class="tut-picker-item__desc">{{ t.goal }}</p>
                    <div class="tut-picker-item__cta">
                      Commencer
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          </ul>
        </template>

        <!-- Step -->
        <template v-else>
          <TutorialStepCard :tutorial="activeTutorial" :step-idx="activeIndex" />
        </template>
      </div>

      <footer class="tut-overlay__foot">
        <button v-if="!activeTutorial" type="button" class="tut-btn tut-overlay__close-full" @click="emit('skip')">
          Fermer
        </button>

        <div v-else class="tut-overlay__foot-row">
          <button
            type="button"
            class="tut-btn tut-overlay__icon-btn"
            aria-label="Retour à la liste"
            @click="backToList"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
          <button type="button" class="tut-btn" :disabled="activeIndex === 0" @click="activeIndex -= 1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Retour
          </button>
          <button
            type="button"
            class="tut-btn tut-btn-primary tut-overlay__next"
            @click="next"
          >
            <template v-if="activeIndex === activeSteps.length - 1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Terminer
            </template>
            <template v-else>
              Suivant
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </template>
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TutorialStepCard from './TutorialStepCard.vue'
import { tutorialOrderFr, tutorialsFr } from './tutorials.fr.js'

const props = defineProps({
  initialTutorialId: { type: String, default: '' },
  // Restreint l’accès au tutoriel "Admin" uniquement quand la page admin est active.
  allowAdminTutorial: { type: Boolean, default: false },
})

const emit = defineEmits(['finish', 'skip'])

const activeTutorialId = ref('')
const activeIndex = ref(0)
const orderedTutorials = computed(() =>
  tutorialOrderFr.map((id) => tutorialsFr[id]).filter(Boolean),
)
const visibleTutorials = computed(() => {
  if (props.allowAdminTutorial) return orderedTutorials.value
  return orderedTutorials.value.filter((t) => t.id !== 'admin_features')
})
const activeTutorial = computed(() => (activeTutorialId.value ? tutorialsFr[activeTutorialId.value] : null))
const activeSteps = computed(() => activeTutorial.value?.steps || [])

watch(
  () => props.initialTutorialId,
  (id) => {
    if (!id) return
    if (!tutorialsFr[id]) return
    selectTutorial(id)
  },
  { immediate: true },
)

function selectTutorial(id) {
  if (!tutorialsFr[id]) return
  if (!props.allowAdminTutorial && id === 'admin_features') return
  activeTutorialId.value = id
  activeIndex.value = 0
}

function backToList() {
  activeTutorialId.value = ''
  activeIndex.value = 0
}

watch(
  () => props.allowAdminTutorial,
  (allow) => {
    if (allow) return
    if (activeTutorialId.value === 'admin_features') backToList()
  },
)

function next() {
  if (!activeSteps.value.length) {
    emit('finish')
    return
  }
  if (activeIndex.value === activeSteps.value.length - 1) {
    emit('finish')
    return
  }
  activeIndex.value += 1
}

function onKey(e) {
  if (e.key === 'Escape') emit('skip')
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.tut-overlay__head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; }
.tut-overlay__head-text { min-width: 0; }
.tut-overlay__title {
  margin: .25rem 0 0; font-size: 1.125rem; font-weight: 600; line-height: 1.2;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tut-overlay__intro { margin: 0 0 1rem; font-size: .875rem; color: var(--tut-muted-fg); line-height: 1.5; }

.tut-picker-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .65rem; }
.tut-picker-item__row { display: flex; align-items: flex-start; gap: .75rem; }
.tut-picker-item__main { min-width: 0; flex: 1; }
.tut-picker-item__title-row { display: flex; align-items: center; gap: .5rem; }
.tut-picker-item__title { margin: 0; font-size: .875rem; font-weight: 600; }
.tut-picker-item__chip {
  flex-shrink: 0; border-radius: 999px;
  border: 1px solid var(--tut-border);
  background: color-mix(in oklab, var(--tut-bg) 60%, transparent);
  padding: .1rem .4rem; font-size: .65rem; font-weight: 600; color: var(--tut-muted-fg);
}
.tut-picker-item__desc {
  margin: .25rem 0 0; font-size: .75rem; color: var(--tut-muted-fg); line-height: 1.45;
  display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.tut-picker-item__cta {
  margin-top: .5rem;
  display: inline-flex; align-items: center; gap: .25rem;
  font-size: .7rem; font-weight: 600; color: var(--tut-primary);
}

.tut-overlay__close-full { width: 100%; }
.tut-overlay__foot-row { display: flex; align-items: center; gap: .5rem; }
.tut-overlay__icon-btn { width: 2.75rem; padding: 0; flex-shrink: 0; }
.tut-overlay__next { flex: 1; }
</style>
