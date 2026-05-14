<template>
  <section class="stats-summary">
    <h2>Résumé</h2>

    <dl>
      <div>
        <dt>Généalogies</dt>
        <dd>{{ genealogyCount }}</dd>
      </div>

      <div>
        <dt>Personnes</dt>
        <dd>{{ peopleCount }}</dd>
      </div>

      <div>
        <dt>Événements à venir</dt>
        <dd>{{ upcomingCount }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const genealogyCount = computed(() => props.data.genealogies?.length || 0)
const peopleCount = computed(() => props.data.people?.length || 0)
const upcomingCount = computed(() => props.data.upcomingBaptisms?.length || 0)
</script>

<style scoped>
.stats-summary {
  margin-top: 24px;
}

dl {
  display: flex;
  gap: 16px;
}

div {
  border: 1px solid #ddd;
  padding: 12px;
  min-width: 120px;
}

dt {
  color: #666;
  font-size: 14px;
}

dd {
  margin: 4px 0 0;
  font-size: 24px;
  font-weight: bold;
}
</style>
