<template>
  <aside class="tutorial-hint" role="status" aria-live="polite">
    <div class="tutorial-hint__card">
      <div class="tutorial-hint__main">
        <strong class="tutorial-hint__title">{{ title }}</strong>
        <p class="tutorial-hint__text">{{ text }}</p>
      </div>
      <div class="tutorial-hint__actions">
        <button v-if="showOpen" type="button" class="primary" @click="$emit('open')">Voir le pas-à-pas</button>
        <button type="button" class="text-button" @click="$emit('dismiss')">Compris</button>
      </div>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  showOpen: { type: Boolean, default: true },
})

defineEmits(['open', 'dismiss'])
</script>

