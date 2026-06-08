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
                <small>{{ genealogyPeopleCount(nationalGenealogy) }} fiche(s)</small>
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
                    <small>{{ genealogyPeopleCount(group.region) }} fiche(s)</small>
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
                      <small>{{ genealogyPeopleCount(family) }} fiche(s)</small>
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
      <button class="toolbar-help toolbar-icon-action" type="button" aria-label="Ouvrir l’aide" title="Ouvrir l’aide" @click="$emit('open-help')">
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.6 2.6 0 1 1 4.2 2.1c-.9.6-1.7 1.2-1.7 2.4" /><path d="M12 17h.01" /></svg>
        <span>Aide</span>
      </button>
      <AppButton class="toolbar-icon-action" @click="$emit('export')">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
        <span>Exporter</span>
      </AppButton>
      <AppButton class="toolbar-icon-action" @click="$emit('open-doleances')">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4h16v13H7l-3 3V4Z" /><path d="M8 8h8M8 12h5" /></svg>
        <span>Doléances</span>
      </AppButton>
      <AppButton class="toolbar-icon-action" @click="$emit('open-admin')">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></svg>
        <span>Admin</span>
      </AppButton>
      <button
        class="home-shortcut toolbar-icon-action"
        :class="`home-shortcut--${homeStatusKind}`"
        type="button"
        :aria-label="homeStatusLabel"
        :title="homeStatusLabel"
        @click="$emit('go-home')"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>
        <small>{{ statusLabel }}</small>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AppButton from '../../components/ui/AppButton.vue'
import brandMark from '../../assets/fetterama-320.jpg'

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
const homeStatusKind = computed(() => {
  if (props.error) return 'error'
  const status = props.statusLabel.toLowerCase()
  if (status.includes('synchronisation') || status.includes('sauvegarde') || status.includes('chargement')) return 'saving'
  return 'online'
})
const homeStatusLabel = computed(() => {
  if (homeStatusKind.value === 'error') return `Accueil — erreur de sauvegarde : ${props.statusLabel}`
  if (homeStatusKind.value === 'saving') return `Accueil — ${props.statusLabel}`
  return `Accueil — ${props.statusLabel}`
})
const nationalGenealogy = computed(() => props.genealogies.find((genealogy) => genealogy.type === 'national') || null)
const regionGroups = computed(() => {
  const regions = props.genealogies.filter((genealogy) => genealogy.type === 'region')
  const families = props.genealogies.filter((genealogy) => genealogy.type === 'family')
  return regions.map((region) => ({
    region,
    families: families.filter((family) => family.parentId === region.id),
  }))
})

function genealogyPeopleCount(genealogy) {
  return genealogy?.peopleCount ?? genealogy?.people?.length ?? 0
}

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
