<template>
  <details ref="searchMenu" class="search-menu" @toggle="handleToggle">
    <summary>Recherche</summary>
    <div class="search-popover">
      <AppField label="Chercher un faluchard">
        <input
          ref="searchInput"
          :value="modelValue"
          type="search"
          placeholder="Nom, surnom, paillarde..."
          autocomplete="off"
          @input="$emit('update:modelValue', $event.target.value)"
        />
      </AppField>

      <p v-if="modelValue.trim() && results.length === 0" class="empty">Aucun résultat trouvé.</p>

      <button
        v-for="person in results"
        :key="person.id"
        class="search-result"
        type="button"
        @click="select(person.id)"
      >
        <strong>{{ person.name }}</strong>
        <span v-if="person.nickname">{{ person.nickname }}</span>
      </button>
    </div>
  </details>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AppField from '../../components/ui/AppField.vue'

defineProps({
  modelValue: { type: String, required: true },
  results: { type: Array, required: true },
})

const emit = defineEmits(['update:modelValue', 'select'])
const searchMenu = ref(null)
const searchInput = ref(null)

async function handleToggle() {
  if (!searchMenu.value?.open) return
  await nextTick()
  searchInput.value?.focus({ preventScroll: true })
}

function select(personId) {
  emit('select', personId)
  emit('update:modelValue', '')
  if (searchMenu.value) searchMenu.value.open = false
}

function closeOnOutsideClick(event) {
  if (!searchMenu.value?.open || searchMenu.value.contains(event.target)) return
  searchMenu.value.open = false
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsideClick)
})
</script>
