<template>
  <section class="toolbar" aria-label="Gestion de la généalogie">
    <div class="brand">
      <img class="brand-mark" :src="selectedPhoto" :alt="`Visuel de ${selectedGenealogyName}`" loading="lazy" />

      <div class="brand-copy">
        <details ref="genealogyMenu" class="genealogy-menu" @toggle="handleMenuToggle">
          <summary>
            <span class="genealogy-trigger">
              <span class="genealogy-trigger-text">
                <span class="genealogy-trigger-label">Familles</span>
                <h1>{{ selectedGenealogyName }}</h1>
              </span>
              <span class="genealogy-trigger-chevron" aria-hidden="true">▾</span>
            </span>
          </summary>

          <div
            ref="genealogyPopover"
            class="genealogy-popover"
            :class="{
              'is-scrollable': isGenealogyListScrollable,
              'is-not-at-bottom': isGenealogyListScrollable && !isGenealogyListAtBottom,
            }"
            @scroll.passive="updateScrollHint"
          >
            <div class="genealogy-list">
              <button
                v-if="nationalGenealogy"
                type="button"
                class="genealogy-option genealogy-option--national"
                :class="{ 'is-active': nationalGenealogy.id === selectedGenealogyId }"
                @click="selectStandaloneGenealogy(nationalGenealogy.id)"
              >
                <span class="genealogy-option-main">
                  <img :src="nationalGenealogy.photoData || brandMark" :alt="`Visuel de ${nationalGenealogy.name}`" loading="lazy" />
                  <span>
                    {{ nationalGenealogy.name }}
                    <em>Branche nationale</em>
                  </span>
                </span>
                <small>{{ nationalGenealogy.people?.length || 0 }} fiche(s)</small>
              </button>

              <section
                v-for="group in regionGroups"
                :key="group.region.id"
                class="genealogy-region-group"
                :class="{ 'is-expanded': expandedRegionId === group.region.id }"
                :data-region-id="group.region.id"
              >
                <button
                  type="button"
                  class="genealogy-option genealogy-option--region"
                  :class="{ 'is-active': group.region.id === selectedGenealogyId }"
                  :aria-expanded="(expandedRegionId === group.region.id).toString()"
                  @click="toggleRegion(group.region)"
                >
                  <span class="genealogy-option-main">
                    <img :src="group.region.photoData || brandMark" :alt="`Visuel de ${group.region.name}`" loading="lazy" />
                    <span>
                      {{ group.region.name }}
                      <em>Région / ville · {{ group.families.length }} famille(s)</em>
                    </span>
                  </span>
                  <span class="genealogy-region-meta">
                    <small>{{ group.region.people?.length || 0 }} fiche(s)</small>
                    <span class="genealogy-region-chevron" aria-hidden="true">▾</span>
                  </span>
                </button>

                <Transition name="genealogy-accordion">
                  <div v-if="expandedRegionId === group.region.id" class="genealogy-family-panel">
                    <button
                      v-for="family in group.families"
                      :key="family.id"
                      type="button"
                      class="genealogy-option genealogy-option--family"
                      :class="{ 'is-active': family.id === selectedGenealogyId }"
                      @click="selectFamily(family.id)"
                    >
                      <span class="genealogy-option-main">
                        <img :src="family.photoData || brandMark" :alt="`Visuel de ${family.name}`" loading="lazy" />
                        <span>
                          {{ family.name }}
                          <em>Famille</em>
                        </span>
                      </span>
                      <small>{{ family.people?.length || 0 }} fiche(s)</small>
                    </button>
                    <p v-if="group.families.length === 0" class="genealogy-family-empty">Aucune famille dans cette région.</p>
                  </div>
                </Transition>
              </section>
            </div>
          </div>
        </details>

        <p>Rechercher, relier et visualiser une famille de faluche.</p>
      </div>
    </div>

    <div class="actions">
      <button class="home-shortcut" type="button" aria-label="Accueil" title="Accueil" @click="$emit('go-home')">⌂</button>
      <span class="server-status" :class="{ 'is-offline': error, 'is-online': !error }">
        {{ statusLabel }}
      </span>
      <AppButton @click="$emit('open-help')">Aide</AppButton>
      <AppButton @click="$emit('export')">Exporter</AppButton>
      <AppButton @click="$emit('open-doleances')">Doléances</AppButton>
      <AppButton @click="$emit('open-admin')">Admin</AppButton>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AppButton from '../../components/ui/AppButton.vue'
import brandMark from '../../assets/fetterama.png'

const props = defineProps({
  genealogies: { type: Array, required: true },
  selectedGenealogyId: { type: String, required: true },
  selectedGenealogyName: { type: String, required: true },
  statusLabel: { type: String, required: true },
  error: { type: String, default: '' },
})

const emit = defineEmits(['select-genealogy', 'go-home', 'open-help', 'export', 'open-doleances', 'open-admin'])
const genealogyMenu = ref(null)
const genealogyPopover = ref(null)
const isGenealogyListScrollable = ref(false)
const isGenealogyListAtBottom = ref(true)
const expandedRegionId = ref('')
let scrollHintRaf = 0

const selectedPhoto = computed(
  () => props.genealogies.find((genealogy) => genealogy.id === props.selectedGenealogyId)?.photoData || brandMark,
)
const nationalGenealogy = computed(() => props.genealogies.find((genealogy) => genealogy.type === 'national') || null)
const regionGroups = computed(() => {
  const regions = props.genealogies.filter((genealogy) => genealogy.type === 'region')
  const families = props.genealogies.filter((genealogy) => genealogy.type === 'family')
  return regions.map((region) => ({
    region,
    families: families.filter((family) => family.parentId === region.id),
  }))
})

function toggleRegion(region) {
  if (expandedRegionId.value === region.id) {
    expandedRegionId.value = ''
    if (genealogyMenu.value) genealogyMenu.value.open = false
    return
  }

  // Regions remain selectable trees, but the menu stays open so the nested
  // family choices become discoverable without an extra explanatory label.
  emit('select-genealogy', region.id)
  expandedRegionId.value = region.id
  navigator.vibrate?.(8)
  nextTick(() => {
    scrollExpandedRegionIntoView(region.id)
    updateScrollHint()
  })
}

function selectFamily(genealogyId) {
  selectStandaloneGenealogy(genealogyId)
}

function selectStandaloneGenealogy(genealogyId) {
  emit('select-genealogy', genealogyId)
  expandedRegionId.value = ''
  if (genealogyMenu.value) genealogyMenu.value.open = false
}

function scrollExpandedRegionIntoView(regionId) {
  const popover = genealogyPopover.value
  const selector = `[data-region-id="${cssEscape(regionId)}"]`
  const region = popover?.querySelector(selector)
  if (!popover || !region) return
  region.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
}

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"')
}

function handleMenuToggle() {
  if (!genealogyMenu.value?.open) return
  expandedRegionId.value = ''
  nextTick(() => {
    updateScrollHint()
  })
}

function updateScrollHint() {
  if (scrollHintRaf) return
  scrollHintRaf = requestAnimationFrame(() => {
    const popover = genealogyPopover.value
    if (!popover) {
      scrollHintRaf = 0
      return
    }

    // Keep the fade hint state in JS so it only appears when there is hidden
    // scrollable content below the current viewport.
    const overflow = popover.scrollHeight - popover.clientHeight
    const nextScrollable = overflow > 4
    const nextAtBottom = overflow <= 4 || popover.scrollTop >= overflow - 6
    if (isGenealogyListScrollable.value !== nextScrollable) isGenealogyListScrollable.value = nextScrollable
    if (isGenealogyListAtBottom.value !== nextAtBottom) isGenealogyListAtBottom.value = nextAtBottom
    scrollHintRaf = 0
  })
}

onMounted(() => {
  window.addEventListener('resize', updateScrollHint, { passive: true })
})

onBeforeUnmount(() => {
  if (scrollHintRaf) cancelAnimationFrame(scrollHintRaf)
  window.removeEventListener('resize', updateScrollHint)
})
</script>
