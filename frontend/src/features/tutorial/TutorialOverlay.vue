<template>
  <section class="tutorial-overlay" aria-live="polite">
    <article class="tutorial-card" role="dialog" aria-modal="true" aria-label="Aides et tutoriels">
      <header class="tutorial-header">
        <div>
          <div class="tutorial-kicker">Aide / Tutoriels</div>
          <h2 v-if="activeTutorial">{{ activeTutorial.title }}</h2>
          <h2 v-else>Choisir un tutoriel</h2>
        </div>
        <button type="button" class="text-button" aria-label="Fermer l'aide" @click="$emit('skip')">Fermer</button>
      </header>

      <section v-if="!activeTutorial" class="tutorial-picker" aria-label="Liste des tutoriels">
        <p class="tutorial-intro">
          Choisis un tutoriel court et guidé. Active le mode tutoriel sur l’accueil pour voir des bulles d’aide automatiques.
        </p>
        <div class="tutorial-list">
          <button
            v-for="item in visibleTutorials"
            :key="item.id"
            type="button"
            class="tutorial-list-item"
            @click="selectTutorial(item.id)"
          >
            <strong>{{ item.title }}</strong>
            <span>{{ item.goal }}</span>
          </button>
        </div>
      </section>

      <section v-else aria-label="Pas à pas">
        <div class="tutorial-kicker">Étape {{ activeIndex + 1 }} / {{ activeSteps.length }}</div>
        <h3 class="tutorial-step-title">{{ activeStep.title }}</h3>
        <p class="tutorial-step-text">{{ activeStep.text }}</p>

        <p v-if="activeStep.expected" class="tutorial-expected">
          <strong>Résultat attendu</strong><br />
          {{ activeStep.expected }}
        </p>

        <details v-if="activeTutorial.warnings?.length" class="tutorial-details">
          <summary>Pièges fréquents</summary>
          <ul>
            <li v-for="warning in activeTutorial.warnings" :key="warning">{{ warning }}</li>
          </ul>
        </details>

        <details v-if="activeTutorial.troubleshooting?.length" class="tutorial-details">
          <summary>Dépannage</summary>
          <ul>
            <li v-for="item in activeTutorial.troubleshooting" :key="item.title">
              <strong>{{ item.title }}</strong><br />
              {{ item.text }}
            </li>
          </ul>
        </details>

        <div class="tutorial-progress" aria-hidden="true">
          <span v-for="(step, index) in activeSteps" :key="step.title" :class="{ 'is-active': index === activeIndex }"></span>
        </div>

        <div class="tutorial-actions">
          <button type="button" class="text-button" @click="backToList">Liste</button>
          <button v-if="activeIndex > 0" type="button" @click="activeIndex -= 1">Retour</button>
          <button type="button" class="primary" @click="next">
            {{ activeIndex === activeSteps.length - 1 ? 'Terminer' : 'Suivant' }}
          </button>
        </div>
      </section>
    </article>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
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
const activeStep = computed(() => activeSteps.value[activeIndex.value] || { title: '', text: '', expected: '' })

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
</script>
