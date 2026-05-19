<template>
  <section class="panel export-panel">
    <div class="section-heading">
      <div>
        <h2>Export PDF</h2>
        <p>Export simplifié centré sur une personne du réseau affiché.</p>
      </div>
    </div>

    <p v-if="!props.selectedPerson" class="empty">Sélectionne une fiche avant d'exporter.</p>
    <div v-else class="stack-form">
      <p>
        Fiche centrale : <strong>{{ props.selectedPerson.name }}</strong>
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
      <button type="button" @click="$emit('export-pdf', { ancestorDepth, descendantDepth })">
        Télécharger le PDF simplifié
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  selectedPerson: { type: Object, default: null },
})

defineEmits(['export-pdf'])

const ancestorDepth = ref(2)
const descendantDepth = ref(2)
</script>
