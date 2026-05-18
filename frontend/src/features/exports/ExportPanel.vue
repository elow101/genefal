<template>
  <section class="panel">
    <div class="section-heading">
      <div>
        <h2>Exports</h2>
        <p>Les téléchargements JSON passent désormais par Vue.</p>
      </div>
    </div>

    <div class="button-row">
      <button type="button" @click="$emit('export-active')">Exporter la généalogie active</button>
      <button type="button" @click="$emit('export-all')">Exporter toutes les données</button>
    </div>
  </section>
</template>

<script setup>
defineEmits(['export-active', 'export-all'])
</script>
