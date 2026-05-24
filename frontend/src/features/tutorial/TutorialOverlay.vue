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
    title: "Explorer l'arbre et le réseau",
    text: "Utilise les onglets Arbre et Réseau pour passer d'une vue familiale simple à une vue relationnelle complète.",
  },
  {
    title: 'Déplacer le graphe',
    text: 'Glisse dans une zone vide pour te déplacer horizontalement ou verticalement. Sur mobile, glisse au doigt.',
  },
  {
    title: 'Zoomer et recentrer',
    text: 'Les boutons +, - et le pourcentage permettent de zoomer, dézoomer et recentrer le graphe.',
  },
  {
    title: 'Ouvrir une fiche',
    text: 'Clique sur une carte pour afficher ses détails, modifier la fiche ou gérer ses relations.',
  },
  {
    title: "Changer d'onglet",
    text: 'Le menu Affichage regroupe les vues utiles : profils, statistiques et prochains events.',
  },
  {
    title: 'Ajouter une fiche',
    text: "Le bouton Fiche d'ajout crée une nouvelle personne dans l'arbre actif.",
  },
  {
    title: 'Suivre les stats et events',
    text: 'Statistiques centralise les indicateurs et nouveaux venus. Events liste les annonces à venir.',
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
