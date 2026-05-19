<template>
  <section class="panel">
    <div class="section-heading">
      <div>
        <h2>Doléances</h2>
        <p>Les signalements anonymes sont limités à 5 envois par session.</p>
      </div>
    </div>

    <form class="stack-form" @submit.prevent="submit">
      <label>
        Type
        <select v-model="draft.type">
          <option value="bug">Bug</option>
          <option value="retrait">Demande de retrait</option>
          <option value="modification">Demande de modification</option>
          <option value="autre">Autre</option>
        </select>
      </label>
      <label>
        Fiche ou arbre concerné
        <input v-model="draft.target" />
      </label>
      <label>
        Message
        <textarea v-model="draft.message" rows="4" required></textarea>
      </label>
      <button type="submit">Envoyer anonymement</button>
    </form>
  </section>
</template>

<script setup>
import { reactive } from 'vue'

const emit = defineEmits(['submit'])

const draft = reactive({
  type: 'bug',
  target: '',
  message: '',
})

async function submit() {
  await emit('submit', { ...draft })
  draft.type = 'bug'
  draft.target = ''
  draft.message = ''
}
</script>
