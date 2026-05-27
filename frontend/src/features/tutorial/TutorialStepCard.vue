<!--
  TutorialStepCard.vue
  Affiche une étape avec le design glassmorphism.
  Adapté au format de données existant (tutorials.fr.js) :
  - step.text  (pas step.body)
  - warnings[] et troubleshooting[] au niveau du tutoriel
-->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  tutorial: { type: Object, required: true },
  stepIdx: { type: Number, default: 0 },
})

const step = computed(() => props.tutorial.steps[props.stepIdx] || { title: '', text: '', expected: '' })
const total = computed(() => props.tutorial.steps.length)
const progressPct = computed(() => Math.round(((props.stepIdx + 1) / total.value) * 100))

const hasWarnings = computed(() => (props.tutorial.warnings || []).length > 0)
const hasTroubleshooting = computed(() => (props.tutorial.troubleshooting || []).length > 0)

const warningsText = computed(() => (props.tutorial.warnings || []).join('\n'))
const troubleshootText = computed(() =>
  (props.tutorial.troubleshooting || [])
    .map((item) => (item.title ? item.title + ' : ' + item.text : item.text))
    .join('\n'),
)
</script>

<template>
  <div class="tut-step">
    <!-- Progression -->
    <div>
      <div class="tut-step__head">
        <span class="tut-eyebrow">Étape {{ stepIdx + 1 }} / {{ total }}</span>
        <span class="tut-step__pct">{{ progressPct }} %</span>
      </div>
      <div class="tut-progress" aria-hidden="true">
        <span
          v-for="(_, i) in tutorial.steps"
          :key="i"
          :class="{ 'is-done': i < stepIdx, 'is-current': i === stepIdx }"
        />
      </div>
    </div>

    <!-- Titre + corps -->
    <div>
      <h3 class="tut-step__title">{{ step.title }}</h3>
      <p class="tut-step__body">{{ step.text }}</p>
    </div>

    <!-- Blocs détaillés -->
    <div class="tut-step__blocks">
      <details v-if="step.expected" class="tut-detail" data-tone="primary" open>
        <summary>
          <span class="tut-detail__label">
            <span class="tut-detail__icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
              </svg>
            </span>
            Résultat attendu
          </span>
          <svg class="tut-detail__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </summary>
        <p class="tut-detail__body">{{ step.expected }}</p>
      </details>

      <details v-if="hasWarnings" class="tut-detail" data-tone="warn">
        <summary>
          <span class="tut-detail__label">
            <span class="tut-detail__icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </span>
            Pièges fréquents
          </span>
          <svg class="tut-detail__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </summary>
        <p class="tut-detail__body">{{ warningsText }}</p>
      </details>

      <details v-if="hasTroubleshooting" class="tut-detail">
        <summary>
          <span class="tut-detail__label">
            <span class="tut-detail__icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
            </span>
            Dépannage
          </span>
          <svg class="tut-detail__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </summary>
        <p class="tut-detail__body">{{ troubleshootText }}</p>
      </details>
    </div>
  </div>
</template>

<style scoped>
.tut-step { display: flex; flex-direction: column; gap: 1.25rem; }
.tut-step__head { display: flex; align-items: center; justify-content: space-between; font-size: .7rem; color: var(--tut-muted-fg); }
.tut-step__pct { font-weight: 600; }
.tut-step__title { margin: 0; font-size: 1.25rem; font-weight: 600; line-height: 1.25; }
.tut-step__body  { margin: .5rem 0 0; font-size: .875rem; color: var(--tut-muted-fg); line-height: 1.55; }
.tut-step__blocks { display: flex; flex-direction: column; gap: .625rem; }
.tut-detail__label { display: inline-flex; align-items: center; gap: .625rem; }
</style>
