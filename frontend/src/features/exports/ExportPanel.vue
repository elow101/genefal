<template>
  <section class="panel export-panel">
    <div class="section-heading">
      <div>
        <h2>Export PDF réseau</h2>
        <p>Génère un PDF clair et imprimable autour de la fiche sélectionnée.</p>
      </div>
    </div>

    <p v-if="!selectedPerson" class="empty">Sélectionne une fiche avant d'exporter.</p>
    <form v-else class="stack-form" @submit.prevent="$emit('export-pdf', { ancestorDepth, descendantDepth })">
      <p>
        Fiche centrale : <strong>{{ selectedPerson.name }}</strong>
      </p>
      <div class="export-depth-fields">
        <label>
          Générations ascendantes
          <input v-model.number="ancestorDepth" type="number" min="0" max="20" />
        </label>
        <label>
          Générations descendantes
          <input v-model.number="descendantDepth" type="number" min="0" max="20" />
        </label>
      </div>
      <div class="export-actions">
        <button type="submit">Exporter en PDF</button>
        <button type="button" class="text-button" @click="$emit('cancel')">Annuler</button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  selectedPerson: { type: Object, default: null },
})

defineEmits(['cancel', 'export-pdf'])

const ancestorDepth = ref(2)
const descendantDepth = ref(2)
</script>
