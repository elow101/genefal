<template>
  <section class="panel">
    <div class="section-heading">
      <div>
        <h2>Administration</h2>
        <p>Session et mots de passe régionaux gérés dans Vue.</p>
      </div>
    </div>

    <p v-if="loading" class="empty">Chargement…</p>
    <p v-else-if="error" class="empty">{{ error }}</p>

    <form v-if="!session" class="stack-form" @submit.prevent="$emit('login', password)">
      <label>
        Mot de passe admin
        <input v-model="password" type="password" required />
      </label>
      <button type="submit">Se connecter</button>
    </form>

    <template v-else>
      <div class="admin-summary">
        <div>
          <strong>{{ session.level === 'general' ? 'Admin général' : 'Admin régional' }}</strong>
          <span v-if="session.regionId">{{ session.regionId }}</span>
        </div>
        <button type="button" @click="$emit('logout')">Se déconnecter</button>
      </div>

      <form class="stack-form" @submit.prevent="submitPassword">
        <label>
          Région
          <select v-model="regionId">
            <option value="">Choisir</option>
            <option v-for="region in session.regions || []" :key="region.id" :value="region.id">
              {{ region.name }}
            </option>
          </select>
        </label>
        <label>
          Nouveau mot de passe régional
          <input v-model="newPassword" type="password" />
        </label>
        <button type="submit" :disabled="!regionId">Mettre à jour</button>
      </form>
    </template>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  session: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    required: true,
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['login', 'logout', 'change-password'])
const password = ref('')
const regionId = ref('')
const newPassword = ref('')

watch(
  () => props.session,
  (session) => {
    regionId.value = session?.regionId || ''
  },
  { immediate: true },
)

function submitPassword() {
  emit('change-password', {
    regionId: regionId.value,
    password: newPassword.value,
  })
  newPassword.value = ''
}
</script>
