<template>
  <section class="panel">
    <div class="section-heading">
      <div>
        <h2>Doléances reçues</h2>
        <p>{{ items.length }} message(s)</p>
      </div>
    </div>

    <p v-if="loading" class="empty">Chargement…</p>
    <p v-else-if="error" class="empty">{{ error }}</p>
    <p v-else-if="items.length === 0" class="empty">Aucune doléance.</p>

    <article v-for="item in items" :key="item.id" class="doleance-row">
      <div>
        <strong>{{ item.type }}</strong>
        <small>{{ item.target || 'Sans cible' }}</small>
        <p>{{ item.message }}</p>
      </div>
      <button
        class="doleance-action"
        type="button"
        :class="{ 'is-resolved': item.status === 'resolved' }"
        @click="$emit('resolve', item.id, item.status !== 'resolved')"
      >
        {{ item.status === 'resolved' ? 'Lu / résolu' : 'Marquer comme lu' }}
      </button>
    </article>
  </section>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true },
  loading: { type: Boolean, required: true },
  error: { type: String, default: '' },
})

defineEmits(['resolve'])
</script>
