<template>
  <main>
    <h1>Faluche Nationale</h1>
    <p>Migration vers Vue en cours.</p>

    <p v-if="loading">Chargement des données...</p>
    <p v-else-if="error">{{ error }}</p>

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
import { useGenealogyData } from './composables/useGenealogyData.js'
import UpcomingView from './features/upcoming/UpcomingView.vue'
import StatsSummary from './features/stats/StatsSummary.vue'
import PeopleList from './features/people/PeopleList.vue'
import GenealogyList from './features/genealogies/GenealogyList.vue'

const {
  loading,
  error,
  data,
  genealogies,
  selectedGenealogyId,
  upcomingEvents,
  people,
  selectGenealogy,
} = useGenealogyData()
</script>

<style scoped>
main {
  padding: 32px;
  font-family: Arial, sans-serif;
}
</style>
