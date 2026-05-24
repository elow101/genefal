<template>
  <button
    class="app-button"
    :class="[`app-button--${variant}`, { 'app-button--block': block }]"
    :type="type"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup>
defineEmits(['click'])

defineProps({
  type: { type: String, default: 'button' },
  variant: { type: String, default: 'secondary' },
  block: { type: Boolean, default: false },
})
</script>
