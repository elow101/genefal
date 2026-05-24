<template>
  <div class="view-switcher">
    <div class="view-toggle" role="tablist" aria-label="Mode d'affichage">
      <button
        v-for="view in desktopViews"
        :key="view.id"
        type="button"
        :class="{ 'is-active': modelValue === view.id }"
        :aria-current="modelValue === view.id ? 'page' : undefined"
        @click="$emit('update:modelValue', view.id)"
      >
        {{ view.label }}
      </button>
    </div>

    <div class="view-select-mobile">
      <button
        ref="mobileTrigger"
        class="view-select-mobile__trigger"
        type="button"
        :aria-expanded="isOpen.toString()"
        aria-haspopup="menu"
        @click="toggleMenu"
      >
        <span>Affichage</span>
        <strong>{{ currentViewLabel }}</strong>
        <span class="view-select-mobile__trigger-icon">⌄</span>
      </button>

      <Teleport to="body" v-if="isOpen">
        <div
          ref="menuRef"
          class="view-select-mobile__menu"
          :style="menuStyle"
          role="menu"
        >
          <button
            v-for="view in views"
            :key="view.id"
            type="button"
            :class="{ 'is-active': modelValue === view.id }"
            :aria-current="modelValue === view.id ? 'page' : undefined"
            @click="selectView(view.id)"
            role="menuitem"
          >
            {{ view.label }}
          </button>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  views: { type: Array, required: true },
  modelValue: { type: String, required: true },
})

const emit = defineEmits(['update:modelValue'])
const mobileTrigger = ref(null)
const menuRef = ref(null)
const isOpen = ref(false)
const menuTop = ref(12)
const menuLeft = ref(12)
const menuWidth = ref(0)
let rafId = null

const currentViewLabel = computed(
  () => props.views.find((view) => view.id === props.modelValue)?.label || 'Choisir une vue',
)
const desktopViews = computed(() => props.views.filter((view) => view.id !== 'home'))

const menuStyle = computed(() => ({
  position: 'fixed',
  top: `${menuTop.value}px`,
  left: `${menuLeft.value}px`,
  width: `${menuWidth.value}px`,
  maxWidth: 'calc(100vw - 24px)',
  zIndex: 120,
  boxSizing: 'border-box',
}))

function viewportWidth() {
  return Math.min(window.innerWidth || 0, document.documentElement.clientWidth || window.innerWidth || 0)
}

function getMenuWidth() {
  const available = Math.max(viewportWidth() - 24, 0)
  return Math.min(280, available)
}

function updateMenuPosition() {
  if (!mobileTrigger.value) return

  const rect = mobileTrigger.value.getBoundingClientRect()
  const width = getMenuWidth()
  const maxLeft = Math.max(viewportWidth() - width - 12, 12)
  const left = Math.min(Math.max(rect.left, 12), maxLeft)

  menuWidth.value = width
  menuTop.value = Math.max(rect.bottom + 8, 12)
  menuLeft.value = left

  requestAnimationFrame(() => {
    const menu = menuRef.value
    if (!menu) return

    const viewport = viewportWidth()
    const menuRect = menu.getBoundingClientRect()
    const overflowRight = menuRect.right - viewport + 12
    const overflowLeft = 12 - menuRect.left

    if (overflowRight > 0) {
      menuLeft.value = Math.max(12, menuLeft.value - overflowRight)
    } else if (overflowLeft > 0) {
      menuLeft.value = Math.min(Math.max(viewport - menuRect.width - 12, 12), menuLeft.value + overflowLeft)
    }
  })
}

function schedulePositionUpdate() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
  }
  rafId = requestAnimationFrame(() => {
    updateMenuPosition()
    rafId = null
  })
}

function openMenu() {
  isOpen.value = true
  nextTick(() => {
    schedulePositionUpdate()
  })
}

function closeMenu() {
  isOpen.value = false
}

function toggleMenu() {
  if (isOpen.value) {
    closeMenu()
    return
  }
  openMenu()
}

function selectView(viewId) {
  emit('update:modelValue', viewId)
  closeMenu()
}

function handleDocumentClick(event) {
  if (!isOpen.value) return
  const target = event.target
  if (
    mobileTrigger.value?.contains(target) ||
    menuRef.value?.contains(target)
  ) {
    return
  }

  closeMenu()
}

function handleEscape(event) {
  if (event.key === 'Escape') {
    closeMenu()
  }
}

watch(isOpen, (open) => {
  if (open) {
    nextTick(() => {
      schedulePositionUpdate()
    })
  }
})

onMounted(() => {
  window.addEventListener('resize', schedulePositionUpdate)
  window.addEventListener('scroll', schedulePositionUpdate, true)
  window.addEventListener('orientationchange', schedulePositionUpdate)
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  window.removeEventListener('resize', schedulePositionUpdate)
  window.removeEventListener('scroll', schedulePositionUpdate, true)
  window.removeEventListener('orientationchange', schedulePositionUpdate)
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleEscape)
})
</script>
