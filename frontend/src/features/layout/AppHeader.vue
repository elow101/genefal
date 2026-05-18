<template>
  <section class="toolbar" aria-label="Gestion de la généalogie">
    <div class="brand">
      <img class="brand-mark" :src="selectedPhoto" alt="" />

      <div class="brand-copy">
        <details class="genealogy-menu">
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
                @click="$emit('select-genealogy', item.genealogy.id)"
              >
                <span class="genealogy-option-main">
                  <img :src="item.genealogy.photoData || brandMark" alt="" />
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
      <span class="server-status" :class="{ 'is-offline': error, 'is-online': !error }">
        {{ statusLabel }}
      </span>
      <button class="action-button" type="button" @click="$emit('export')">Exporter</button>
      <button class="action-button" type="button" @click="$emit('open-doleances')">Doléances</button>
      <button class="action-button" type="button" @click="$emit('open-admin')">Admin</button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import brandMark from '../../assets/fetterama.png'

const props = defineProps({
  genealogies: { type: Array, required: true },
  selectedGenealogyId: { type: String, required: true },
  selectedGenealogyName: { type: String, required: true },
  statusLabel: { type: String, required: true },
  error: { type: String, default: '' },
})

defineEmits(['select-genealogy', 'export', 'open-doleances', 'open-admin'])

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
</script>
