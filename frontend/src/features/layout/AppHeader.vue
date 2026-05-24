<template>
  <section class="toolbar" aria-label="Gestion de la généalogie">
    <div class="brand">
      <img class="brand-mark" :src="selectedPhoto" :alt="`Visuel de ${selectedGenealogyName}`" loading="lazy" />

      <div class="brand-copy">
        <details ref="genealogyMenu" class="genealogy-menu">
          <summary>
            <span class="genealogy-trigger">
              <span class="genealogy-trigger-text">
                <span class="genealogy-trigger-label">Familles</span>
                <h1>{{ selectedGenealogyName }}</h1>
              </span>
              <span class="genealogy-trigger-chevron" aria-hidden="true">▾</span>
            </span>
          </summary>

          <div class="genealogy-popover">
            <div class="genealogy-list">
              <button
                v-for="item in genealogyItems"
                :key="item.genealogy.id"
                type="button"
                class="genealogy-option"
                :class="[
                  `genealogy-depth-${item.depth}`,
                  { 'is-active': item.genealogy.id === selectedGenealogyId },
                ]"
                @click="selectGenealogy(item.genealogy.id)"
              >
                <span class="genealogy-option-main">
                  <img :src="item.genealogy.photoData || brandMark" :alt="`Visuel de ${item.genealogy.name}`" loading="lazy" />
                  <span>
                    {{ item.genealogy.name }}
                    <em>{{ genealogyTypeLabel(item.genealogy) }}</em>
                  </span>
                </span>
                <small>{{ item.genealogy.people?.length || 0 }} fiche(s)</small>
              </button>
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
      <AppButton @click="$emit('export')">Exporter</AppButton>
      <AppButton @click="$emit('open-doleances')">Doléances</AppButton>
      <AppButton @click="$emit('open-admin')">Admin</AppButton>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppButton from '../../components/ui/AppButton.vue'
import brandMark from '../../assets/fetterama.png'

const props = defineProps({
  genealogies: { type: Array, required: true },
  selectedGenealogyId: { type: String, required: true },
  selectedGenealogyName: { type: String, required: true },
  statusLabel: { type: String, required: true },
  error: { type: String, default: '' },
})

const emit = defineEmits(['select-genealogy', 'go-home', 'export', 'open-doleances', 'open-admin'])
const genealogyMenu = ref(null)

const selectedPhoto = computed(
  () => props.genealogies.find((genealogy) => genealogy.id === props.selectedGenealogyId)?.photoData || brandMark,
)
const genealogyItems = computed(() => {
  const national = props.genealogies.find((genealogy) => genealogy.type === 'national')
  const regions = props.genealogies.filter((genealogy) => genealogy.type === 'region')
  const families = props.genealogies.filter((genealogy) => genealogy.type === 'family')
  return [
    ...(national ? [{ genealogy: national, depth: 0 }] : []),
    ...regions.flatMap((region) => [
      { genealogy: region, depth: 1 },
      ...families
        .filter((family) => family.parentId === region.id)
        .map((family) => ({ genealogy: family, depth: 2 })),
    ]),
  ]
})

function genealogyTypeLabel(genealogy) {
  if (genealogy.type === 'national') return 'National'
  if (genealogy.type === 'region') return 'Région / ville'
  const parent = props.genealogies.find((item) => item.id === genealogy.parentId)
  return `Famille${parent ? ` · ${parent.name}` : ''}`
}
function selectGenealogy(genealogyId) {
  emit('select-genealogy', genealogyId)
  if (genealogyMenu.value) genealogyMenu.value.open = false
}
</script>
