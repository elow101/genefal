<template>
  <section class="idea-vote" :class="{ 'idea-vote--compact': compact }" aria-label="Vote">
    <div v-if="proposal.votingOpen" class="idea-vote__actions">
      <button
        type="button"
        :disabled="busy"
        :aria-pressed="proposal.currentVote === 1"
        :aria-label="proposal.currentVote === 1 ? 'Retirer mon vote positif' : 'Voter pour cette idée'"
        :class="{ 'is-active': proposal.currentVote === 1 }"
        @click="submitVote(1)"
      >
        Pour {{ proposal.votes.up }}
      </button>
      <button
        type="button"
        :disabled="busy"
        :aria-pressed="proposal.currentVote === -1"
        :aria-label="proposal.currentVote === -1 ? 'Retirer mon vote négatif' : 'Voter contre cette idée'"
        :class="{ 'is-active': proposal.currentVote === -1 }"
        @click="submitVote(-1)"
      >
        Contre {{ proposal.votes.down }}
      </button>
    </div>
    <p v-else class="notice">Les votes sont actuellement fermés pour cette idée.</p>

    <div v-if="proposal.votingOpen && !compact" class="idea-vote__reason">
      <label>
        Motif facultatif
        <select v-model="reasonCode">
          <option value="">Aucun motif</option>
          <option v-for="reason in reasons" :key="reason.id" :value="reason.id">
            {{ reason.label }}
          </option>
        </select>
      </label>
      <label v-if="reasonCode === 'autre'">
        Texte facultatif
        <textarea v-model.trim="reasonText" maxlength="500"></textarea>
      </label>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { negativeReasons, positiveReasons } from '../../domain/ideaBox.js'

const props = defineProps({
  proposal: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['vote', 'remove'])
const reasonCode = ref('')
const reasonText = ref('')

const reasons = computed(() => (props.proposal.currentVote === -1 ? negativeReasons : positiveReasons))

function submitVote(voteValue) {
  if (props.proposal.currentVote === voteValue) {
    emit('remove', props.proposal)
    return
  }
  emit('vote', {
    proposal: props.proposal,
    voteValue,
    reasonCode: reasonCode.value,
    reasonText: reasonText.value,
  })
}
</script>
