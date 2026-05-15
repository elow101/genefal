<template>
  <main class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Migration Vue</p>
        <h1>Faluche Nationale</h1>
        <p class="lede">Base front-end isolée en Vue 3/Vite, branchée sur l'API PHP existante.</p>
      </div>

      <span class="status" :class="{ 'status--error': error }">
        {{ statusLabel }}
      </span>
    </header>

    <p v-if="loading" class="notice">Chargement des données...</p>
    <p v-else-if="error" class="notice notice--error">{{ error }}</p>

    <template v-else>
      <StatsSummary :data="data" />

      <GenealogyList
        :genealogies="genealogies"
        :selected-genealogy-id="selectedGenealogyId"
        @select="selectGenealogy"
      />

      <UpcomingView :events="upcomingEvents" />
      <PeopleList :people="people" />
    </template>
  </main>
</template>

<script setup>
import { computed } from 'vue'
import { useGenealogyData } from './composables/useGenealogyData.js'
import UpcomingView from './features/upcoming/UpcomingView.vue'
import StatsSummary from './features/stats/StatsSummary.vue'
import PeopleList from './features/people/PeopleList.vue'
import GenealogyList from './features/genealogies/GenealogyList.vue'

const { loading, error, data, genealogies, selectedGenealogyId, upcomingEvents, people, selectGenealogy } =
  useGenealogyData()

const statusLabel = computed(() => {
  if (loading.value) return 'Synchronisation'
  if (error.value) return 'API indisponible'
  return `${genealogies.value.length} généalogie(s)`
})
</script>
