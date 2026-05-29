<script setup>
defineProps({
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  showOpen: { type: Boolean, default: true },
})

defineEmits(['open', 'dismiss'])
</script>

<template>
  <div class="tut-glass-strong tut-glow-cyan tut-coachmark" role="status">
    <div class="tut-coach__row">
      <div class="tut-coach__icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l1.9 4.6L18.5 9l-3.6 3 1.1 4.7L12 14.8 8 16.7 9.1 12 5.5 9l4.6-1.4z"/>
        </svg>
      </div>
      <div class="tut-coach__main">
        <p class="tut-coach__title">{{ title }}</p>
        <p class="tut-coach__desc">{{ text }}</p>
        <div class="tut-coach__actions">
          <button v-if="showOpen" type="button" class="tut-btn tut-btn-primary tut-coach__primary" @click="$emit('open')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
            Voir le pas-à-pas
          </button>
          <button type="button" class="tut-btn tut-coach__secondary" @click="$emit('dismiss')">
            Compris
          </button>
        </div>
      </div>
      <button type="button" class="tut-btn-ghost tut-coach__close" aria-label="Fermer" @click="$emit('dismiss')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tut-coach__row { display: flex; align-items: flex-start; gap: .75rem; }
.tut-coach__icon {
  display: grid; place-items: center;
  width: 2.25rem; height: 2.25rem; border-radius: .85rem;
  background: color-mix(in oklab, var(--tut-primary) 15%, transparent);
  color: var(--tut-primary); flex-shrink: 0;
}
.tut-coach__main { flex: 1; min-width: 0; }
.tut-coach__title { margin: 0; font-size: .875rem; font-weight: 600; }
.tut-coach__desc  { margin: .15rem 0 0; font-size: .75rem; color: var(--tut-muted-fg); }
.tut-coach__actions { margin-top: .75rem; display: flex; gap: .5rem; }
.tut-coach__primary { flex: 1; height: 2.25rem; font-size: .75rem; padding: 0 .75rem; }
.tut-coach__secondary { height: 2.25rem; font-size: .75rem; padding: 0 .75rem; }
.tut-coach__close { width: 1.75rem; height: 1.75rem; flex-shrink: 0; }
</style>
