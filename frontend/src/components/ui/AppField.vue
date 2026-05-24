<template>
  <label class="app-field">
    <span class="app-field__label">{{ label }}</span>
    <slot />
    <span v-if="hint" class="app-field__hint">{{ hint }}</span>
    <span v-if="error" class="app-field__error" role="alert">{{ error }}</span>
  </label>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
})
</script>
