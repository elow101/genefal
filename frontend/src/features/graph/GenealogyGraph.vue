<template>
  <section class="graph-panel">
    <div v-if="graph.legend" class="graph-legend">
      <span><i class="legend-line"></i>Parrain</span>
      <span><i class="legend-line heart"></i>Parrain de cœur</span>
      <span><i class="legend-line cross"></i>Baptême croisé</span>
    </div>

    <p v-if="isEmpty" class="empty">Aucune personne à afficher.</p>

    <div
      v-else-if="mode === 'tree'"
      class="tree-view"
      :style="{ transform: `scale(${zoom})`, transformOrigin: 'top center' }"
    >
      <template v-for="(row, index) in graph.rows" :key="`${row.label}-${index}`">
        <section class="tree-generation" :class="`tree-generation--${row.relation}`">
          <h3>{{ row.label }}</h3>
          <div class="tree-generation__people">
            <div v-if="row.people.length === 0" class="node-card node-card--empty">
              <strong>{{ row.emptyText }}</strong>
              <span>Complète la fiche pour enrichir l'arbre</span>
            </div>
            <button
              v-for="person in row.people"
              :key="person.id"
              type="button"
              class="node-card"
              :class="{ focus: person.id === selectedPersonId }"
              :style="filiereStyle(person)"
              @click="$emit('select', person.id)"
            >
              <strong>{{ displayName(person) }}</strong>
              <small>{{ filiereLabel(person.filiere) || 'Filière non renseignée' }}</small>
              <span class="node-info">
                <span v-if="person.roles?.length">{{ roleLabels(person).join(' · ') }}</span>
                <span>{{ person.song || 'Informations à compléter' }}</span>
                <span>{{ ceremonyLabel(person) }}</span>
              </span>
            </button>
          </div>
        </section>
        <i v-if="index < graph.rows.length - 1" class="tree-connector"></i>
      </template>
    </div>

    <svg
      v-else
      :viewBox="viewBox"
      :style="{ transform: `scale(${zoom})`, transformOrigin: 'top left' }"
      role="img"
      aria-label="Réseau généalogique"
    >
      <line
        v-for="edge in graph.edges"
        :key="`${edge.from}-${edge.to}-${edge.kind || 'sponsor'}`"
        :class="edge.kind || 'sponsor'"
        :x1="node(edge.from)?.x"
        :y1="edgeStartY(edge.from)"
        :x2="node(edge.to)?.x"
        :y2="edgeEndY(edge.to)"
      />
      <g
        v-for="entry in graph.nodes"
        :key="entry.id"
        class="graph-node graph-node--network"
        :class="{ selected: entry.id === selectedPersonId }"
        @click="$emit('select', entry.id)"
      >
        <rect :x="entry.x - 76" :y="entry.y - 30" width="152" height="76" rx="10" />
        <rect
          class="network-filiere-strip"
          :x="entry.x - 76"
          :y="entry.y - 30"
          width="7"
          height="76"
          rx="4"
          :fill="filiereAccent(entry.filiere) || '#4a4f4d'"
        />
        <text class="network-name" :x="entry.x" :y="entry.y - 4">{{ entry.label }}</text>
        <text class="network-meta" :x="entry.x" :y="entry.y + 16">
          {{ entry.nickname || 'Sans surnom' }}
        </text>
        <text class="network-meta" :x="entry.x" :y="entry.y + 34">
          {{ filiereLabel(entry.filiere) || 'Filière non renseignée' }}
        </text>
      </g>
    </svg>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { filiereAccent, filiereLabel, filiereStyle } from '../../domain/filiere.js'
import { displayName } from '../../domain/graph.js'

const props = defineProps({
  graph: { type: Object, required: true },
  selectedPersonId: { type: String, default: '' },
  zoom: { type: Number, default: 1 },
  mode: { type: String, default: 'tree' },
  roleOptions: { type: Array, default: () => [] },
})

defineEmits(['select'])

const isEmpty = computed(() => (props.mode === 'tree' ? props.graph.rows.length === 0 : props.graph.nodes.length === 0))
function node(id) {
  return props.graph.nodes.find((entry) => entry.id === id)
}
function edgeStartY(id) {
  const entry = node(id)
  return entry ? entry.y + 46 : 0
}
function edgeEndY(id) {
  const entry = node(id)
  return entry ? entry.y - 30 : 0
}
function ceremonyLabel(person) {
  if (person.baptismStatus === 'unbaptized') return 'Pas encore baptisé'
  if (person.baptismDate) return person.baptismDate
  return 'Date non renseignée'
}
function roleLabels(person) {
  return (person.roles || []).map(
    (roleId) => props.roleOptions.find((role) => role.id === roleId)?.label || roleId,
  )
}
const viewBox = computed(() => {
  const maxX = Math.max(960, ...props.graph.nodes.map((entry) => entry.x + 130))
  const maxY = Math.max(540, ...props.graph.nodes.map((entry) => entry.y + 130))
  return `0 0 ${maxX} ${maxY}`
})
</script>
