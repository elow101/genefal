<!--
  TutorialToggle.vue
  Carte "Mode tutoriel" sur la homepage (switch + bouton guides).
  Props  : enabled (bool), tutorialCount (number)
  Events : update:enabled, open-guides
-->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  enabled: { type: Boolean, default: false },
  tutorialCount: { type: Number, default: 0 },
})

const emit = defineEmits(['update:enabled', 'open-guides'])

function handleOpenGuides() {
  if (!props.enabled) {
    toggle()
  }

  emit('open-guides')
}

const stateLabel = computed(() => (props.enabled ? 'Activé' : 'Désactivé'))

function toggle() {
  emit('update:enabled', !props.enabled)
}
</script>

<template>
  <div class="tut-glass tut-card" :data-enabled="String(enabled)">
    <div class="tut-card__halo" aria-hidden="true" />

    <div class="tut-card__row">
      <div class="tut-card__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.66 4 3 6 3s6-1.34 6-3v-5"/>
        </svg>
      </div>

      <div class="tut-card__main">
        <div class="tut-card__title-row">
          <h3 class="tut-card__title">Mode tutoriel</h3>
          <span class="tut-state" :data-on="String(enabled)">
            <span class="tut-state__dot" />
            {{ stateLabel }}
          </span>
        </div>
        <p class="tut-card__desc">
          <template v-if="enabled">
            Des bulles d’aide apparaissent sur l’interface. Ouvre les guides pour un pas-à-pas.
          </template>
          <template v-else>
            Active des aides contextuelles et un parcours guidé étape par étape.
          </template>
        </p>

        <div class="tut-card__actions">
          <button type="button" class="tut-pill tut-pill--button" @click="handleOpenGuides">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/>
            </svg>
            Ouvrir les guides
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <span class="tut-card__meta">{{ tutorialCount }} tutoriels disponibles</span>
        </div>
      </div>

      <button
        type="button"
        class="tut-switch"
        role="switch"
        :aria-checked="String(enabled)"
        aria-label="Activer le mode tutoriel"
        @click="toggle"
      >
        <span class="tut-switch__thumb">
          <svg v-if="enabled" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--tut-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tut-card__row {
  position: relative;
  display: flex; flex-direction: column; gap: 1rem;
}
@media (min-width: 640px) {
  .tut-card__row { flex-direction: row; align-items: flex-start; }
}
.tut-card__main { flex: 1; min-width: 0; }
.tut-card__title-row { display: flex; align-items: center; gap: .5rem; }
.tut-card__title { font-size: 1rem; font-weight: 600; margin: 0; }
@media (min-width: 640px) { .tut-card__title { font-size: 1.125rem; } }

.tut-card__desc {
  margin: .25rem 0 0; font-size: .875rem; color: var(--tut-muted-fg); line-height: 1.5;
}
.tut-card__actions {
  margin-top: .75rem; display: flex; flex-wrap: wrap; align-items: center; gap: .5rem;
}
.tut-card__meta { font-size: .75rem; color: var(--tut-muted-fg); }

.tut-pill--button { cursor: pointer; transition: all .2s ease; }
.tut-pill--button:hover { background: color-mix(in oklab, var(--tut-primary) 20%, transparent); gap: .5rem; }

.tut-state {
  display: inline-flex; align-items: center; gap: .35rem;
  border-radius: 999px; padding: .15rem .55rem;
  font-size: .65rem; font-weight: 600;
  letter-spacing: .08em; text-transform: uppercase;
  border: 1px solid var(--tut-border);
  background: color-mix(in oklab, var(--tut-muted) 40%, transparent);
  color: var(--tut-muted-fg);
  transition: all .3s ease;
}
.tut-state[data-on="true"] {
  border-color: color-mix(in oklab, var(--tut-primary) 40%, transparent);
  background: color-mix(in oklab, var(--tut-primary) 15%, transparent);
  color: var(--tut-primary);
}
.tut-state__dot {
  width: .35rem; height: .35rem; border-radius: 999px;
  background: var(--tut-muted-fg);
}
.tut-state[data-on="true"] .tut-state__dot {
  background: var(--tut-primary);
  box-shadow: 0 0 8px var(--tut-cyan-glow);
}
</style>
