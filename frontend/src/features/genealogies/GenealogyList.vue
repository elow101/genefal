<template>
  <section class="genealogy-list">
    <h2>Généalogies</h2>

    <p v-if="genealogies.length === 0">Aucune généalogie pour le moment.</p>

    <ul v-else>
      <li v-for="genealogy in genealogies" :key="genealogy.id">
        <button
          type="button"
          :class="{ selected: genealogy.id === selectedGenealogyId }"
          @click="$emit('select', genealogy.id)"
        >
          <strong>{{ genealogy.name }}</strong>
          <span>{{ genealogy.people?.length || 0 }} personne(s)</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup>
defineProps({
  genealogies: {
    type: Array,
    required: true,
  },
  selectedGenealogyId: {
    type: String,
    required: true,
  },
})

defineEmits(['select'])
</script>

<style scoped>
.genealogy-list {
  margin-top: 24px;
}

ul {
  padding-left: 0;
  list-style: none;
}

li {
  margin-bottom: 8px;
}

button {
  width: 100%;
  text-align: left;
  border: 1px solid #ddd;
  background: white;
  padding: 12px;
  cursor: pointer;
}

button:hover {
  background: #f7f7f7;
}

button.selected {
  border-color: #111;
  background: #f0f0f0;
}

span {
  margin-left: 8px;
  color: #666;
}
</style>
