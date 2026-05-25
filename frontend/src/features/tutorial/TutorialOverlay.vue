<template>
  <section class="tutorial-overlay" aria-live="polite">
    <article class="tutorial-card" role="dialog" aria-modal="false" aria-label="Tutoriel d'utilisation">
      <div class="tutorial-kicker">Tuto {{ activeIndex + 1 }} / {{ steps.length }}</div>
      <h2>{{ activeStep.title }}</h2>
      <p>{{ activeStep.text }}</p>
      <div class="tutorial-progress" aria-hidden="true">
        <span
          v-for="(step, index) in steps"
          :key="step.title"
          :class="{ 'is-active': index === activeIndex }"
        ></span>
      </div>
      <div class="tutorial-actions">
        <button type="button" class="text-button" @click="$emit('skip')">Passer</button>
        <button v-if="activeIndex > 0" type="button" @click="activeIndex -= 1">Retour</button>
        <button type="button" class="primary" @click="next">
          {{ activeIndex === steps.length - 1 ? 'Terminer' : 'Suivant' }}
        </button>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const emit = defineEmits(['finish', 'skip'])

const steps = [
  {
    title: "Explorer l'arbre",
    text: "Utilise l'onglet Arbre puis choisis le mode Réseau ou Hiérarchie selon l'exploration voulue.",
  },
  {
    title: 'Se repérer dans le graphe',
    text: 'Touche une fiche pour la mettre en avant : ses liens directs restent plus visibles et le reste de la généalogie reste accessible.',
  },
  {
    title: 'Zoomer et recentrer',
    text: 'Les boutons +, -, Recentrer et Retour au profil permettent de garder une lecture confortable sur mobile.',
  },
  {
    title: 'Créer une fiche',
    text: "Le bouton Fiche d'ajout crée une personne dans l'arbre actif. Vérifie d'abord qu'elle n'existe pas déjà pour éviter les doublons.",
  },
  {
    title: 'Relier parent et fillot',
    text: "Ouvre une fiche pour ajouter un parent, un fillot ou une relation. Le bon lien évite les branches isolées et les corrections manuelles.",
  },
  {
    title: 'Envoyer une modification',
    text: "En mode admin, la fiche est modifiée directement. Sinon, envoie une doléance claire pour qu'une validation puisse être faite.",
  },
  {
    title: 'Naviguer sans perdre le contexte',
    text: 'Glisse dans une zone vide pour te déplacer. Le menu Affichage regroupe les profils, statistiques et prochains events.',
  },
]

const activeIndex = ref(0)
const activeStep = computed(() => steps[activeIndex.value])

function next() {
  if (activeIndex.value === steps.length - 1) {
    emit('finish')
    return
  }
  activeIndex.value += 1
}
</script>
