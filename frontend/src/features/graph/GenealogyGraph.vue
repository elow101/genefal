<template>
  <section ref="panelRef" class="graph-panel">
    <div v-if="graph.legend" class="graph-legend">
      <span><i class="legend-line"></i>Parrain / marraine</span>
      <span><i class="legend-line heart"></i>Parrain / marraine de cœur</span>
      <span><i class="legend-line adoption"></i>Adoption</span>
      <span><i class="legend-line adoption-heart"></i>Adoption de cœur</span>
      <span><i class="legend-line confirmation"></i>Confirmation</span>
      <span><i class="legend-line confirmation-heart"></i>Confirmation de cœur</span>
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
              <strong>{{ networkMainName(person) }}</strong>
              <small>{{ networkNickname(person) }}</small>
              <span class="node-info">
                <span class="node-info__line node-info__line--strong">{{ filiereLabel(person.filiere) || 'Filière non renseignée' }}</span>
                <span v-if="person.roles?.length" class="node-info__pills">
                  <span
                    v-for="role in networkRolePills(person)"
                    :key="`${person.id}-tree-role-${role.id}`"
                    class="node-info__pill"
                    :style="{ '--role-pill-color': role.color }"
                  >
                    {{ shortText(role.label, 18) }}
                  </span>
                </span>
                <span v-for="line in hoverInfoLines(person)" :key="line" class="node-info__line">{{ line }}</span>
              </span>
            </button>
          </div>
        </section>
        <i v-if="index < graph.rows.length - 1" class="tree-connector"></i>
      </template>
    </div>

    <svg
      v-else
      ref="svgRef"
      :viewBox="viewBox"
      :width="graphWidth * zoom"
      :height="graphHeight * zoom"
      role="img"
      aria-label="Réseau généalogique"
    >
      <defs>
        <marker id="arrow-sponsor" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#1e98a3" />
        </marker>
        <marker id="arrow-heart" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#ff4f87" />
        </marker>
        <marker id="arrow-adoption" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#f59e0b" />
        </marker>
        <marker id="arrow-confirmation" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#8b5cf6" />
        </marker>
      </defs>
      <line
        v-for="edge in graph.edges"
        :key="`${edge.from}-${edge.to}-${edge.kind || 'sponsor'}-${edge.eventId || ''}`"
        :class="edge.kind || 'sponsor'"
        :x1="node(edge.from)?.x"
        :y1="edgeStartY(edge.from)"
        :x2="node(edge.to)?.x"
        :y2="edgeEndY(edge.to)"
        :marker-end="arrowMarker(edge.kind)"
      />
      <g
        v-for="entry in graph.nodes"
        :key="entry.id"
        class="graph-node graph-node--network"
        :class="{ selected: entry.id === selectedPersonId }"
        tabindex="0"
        @mouseenter="hoveredNetworkNodeId = entry.id"
        @mouseleave="hoveredNetworkNodeId = ''"
        @focus="hoveredNetworkNodeId = entry.id"
        @blur="hoveredNetworkNodeId = ''"
        @click="$emit('select', entry.id)"
      >
        <rect class="network-card-base" :x="entry.x - 82" :y="entry.y - 34" width="164" :height="networkBaseCardHeight(entry)" rx="10" />
        <rect
          class="network-filiere-strip"
          :x="entry.x - 82"
          :y="entry.y - 34"
          width="7"
          :height="networkBaseCardHeight(entry)"
          rx="4"
          :style="filiereStripStyle(entry)"
        />
        <text class="network-name" :x="entry.x" :y="networkNameStartY(entry)">
          <tspan
            v-for="(line, lineIndex) in networkNameLines(entry)"
            :key="`${entry.id}-name-${lineIndex}`"
            :x="entry.x"
            :dy="lineIndex === 0 ? 0 : 16"
          >
            {{ line }}
          </tspan>
        </text>
        <text v-if="networkNicknameLines(entry).length" class="network-meta" :x="entry.x" :y="networkNicknameStartY(entry)">
          <tspan
            v-for="(line, lineIndex) in networkNicknameLines(entry)"
            :key="`${entry.id}-nickname-${lineIndex}`"
            :x="entry.x"
            :dy="lineIndex === 0 ? 0 : 15"
          >
            {{ line }}
          </tspan>
        </text>

      </g>
      <g v-if="hoveredNetworkNode" class="network-hover-card">
        <rect
          class="network-card-expanded"
          :x="hoveredNetworkNode.x - 110"
          :y="hoveredNetworkNode.y + 62"
          width="220"
          :height="networkCardHeight(hoveredNetworkNode)"
          rx="10"
        />
        <rect
          class="network-filiere-strip network-filiere-strip--expanded"
          :x="hoveredNetworkNode.x - 110"
          :y="hoveredNetworkNode.y + 62"
          width="7"
          :height="networkCardHeight(hoveredNetworkNode)"
          rx="4"
          :style="filiereStripStyle(hoveredNetworkNode)"
        />
        <text
          v-for="(line, lineIndex) in networkHoverLines(hoveredNetworkNode)"
          :key="`${hoveredNetworkNode.id}-hover-info-${lineIndex}`"
          class="network-extra-line"
          :class="{ 'network-extra-line--strong': lineIndex === 0 }"
          :x="networkHoverTextX(hoveredNetworkNode)"
          :y="networkHoverLineY(hoveredNetworkNode, lineIndex)"
        >
          {{ line }}
        </text>
      </g>
    </svg>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { filiereAccent, filiereLabel, filiereStyle } from '../../domain/filiere.js'
import { ceremonySummaries } from '../../domain/graph.js'

const props = defineProps({
  graph: { type: Object, required: true },
  selectedPersonId: { type: String, default: '' },
  zoom: { type: Number, default: 1 },
  mode: { type: String, default: 'tree' },
  roleOptions: { type: Array, default: () => [] },
})

defineEmits(['select'])

const panelRef = ref(null)
const svgRef = ref(null)
const hoveredNetworkNodeId = ref('')

const isEmpty = computed(() => (props.mode === 'tree' ? props.graph.rows.length === 0 : props.graph.nodes.length === 0))
const nodeById = computed(() => new Map(props.graph.nodes.map((entry) => [entry.id, entry])))
const hoveredNetworkNode = computed(() => nodeById.value.get(hoveredNetworkNodeId.value) || null)
function node(id) {
  return nodeById.value.get(id)
}
function filiereStripStyle(entry) {
  return { fill: filiereAccent(entry.filiere) || '#4a4f4d' }
}
function edgeStartY(id) {
  const entry = node(id)
  return entry ? entry.y + 48 : 0
}
function edgeEndY(id) {
  const entry = node(id)
  return entry ? entry.y - 34 : 0
}
function ceremonyLabel(person) {
  if (person.baptismStatus === 'unbaptized') return 'Pas encore baptisé'
  if (person.baptismDate) return person.baptismDate
  return 'Date non renseignée'
}
function arrowMarker(kind = 'sponsor') {
  if (kind.includes('adoption')) return 'url(#arrow-adoption)'
  if (kind.includes('confirmation')) return 'url(#arrow-confirmation)'
  if (kind === 'heart') return 'url(#arrow-heart)'
  if (kind === 'cross') return ''
  return 'url(#arrow-sponsor)'
}
function roleOption(roleId) {
  return props.roleOptions.find((role) => role.id === roleId) || null
}
function networkRolePills(entry) {
  const roles = (entry.roles || []).map((roleId) => ({
    id: roleId,
    label: roleOption(roleId)?.label || roleId,
    color: roleColor(roleId),
  }))
  return roles.length > 3
    ? [...roles.slice(0, 3), { id: 'more', label: `+${roles.length - 3}`, color: '#4a4f4d' }]
    : roles
}
function roleColor(roleId) {
  const palette = ['#1e98a3', '#d81b60', '#8b5cf6', '#f59e0b', '#1f8f48', '#2f6fdd', '#ef86b9', '#7b4a2d']
  const hash = String(roleId || '').split('').reduce((total, letter) => total + letter.charCodeAt(0), 0)
  return palette[hash % palette.length]
}
function networkRoleText(entry) {
  return networkRolePills(entry).map((role) => role.label).join(' ? ')
}
function networkHoverRawLines(entry) {
  return [networkFiliereLabel(entry), networkRoleText(entry), ...hoverInfoLines(entry)].filter(Boolean)
}
function networkHoverLines(entry) {
  return networkHoverRawLines(entry).flatMap((line) => wrapSvgText(line, 28))
}
function networkCardHeight(entry) {
  return Math.max(96, 28 + networkHoverLines(entry).length * 17)
}
function networkHoverTextX(entry) {
  return entry.x - 86
}
function networkHoverLineY(entry, lineIndex) {
  return entry.y + 88 + lineIndex * 17
}
function networkNameLines(entry) {
  return wrapSvgText(networkMainName(entry), 18)
}
function networkNicknameLines(entry) {
  return wrapSvgText(networkNickname(entry), 22)
}
function networkBaseCardHeight(entry) {
  return Math.max(82, 34 + networkNameLines(entry).length * 16 + networkNicknameLines(entry).length * 15)
}
function networkNameStartY(entry) {
  const totalTextHeight = networkNameLines(entry).length * 16 + networkNicknameLines(entry).length * 15
  return entry.y - 34 + Math.max(24, (networkBaseCardHeight(entry) - totalTextHeight) / 2 + 10)
}
function networkNicknameStartY(entry) {
  return networkNameStartY(entry) + networkNameLines(entry).length * 16 + 6
}
function networkMainName(entry) {
  return `${entry.name || 'Sans nom'}${networkNickname(entry) ? ' dit' : ''}`
}
function networkNickname(entry) {
  return entry.nickname || ''
}
function networkFiliereLabel(entry) {
  return filiereLabel(entry.filiere) || 'filière non renseignée'
}
function hoverInfoLines(person) {
  return [
    person.genealogyName || '',
    ceremonyLabel(person),
    person.baptismCity ? `Ville : ${person.baptismCity}` : '',
    person.song ? `Paillarde : ${person.song}` : '',
    ...ceremonySummaries(person),
  ].filter(Boolean)
}
function centerSelectedNetworkNode() {
  if (props.mode !== 'network' || !props.selectedPersonId) return
  const selected = node(props.selectedPersonId)
  const svg = svgRef.value
  const scroller = panelRef.value?.closest('.graph-stage-wrap')
  if (!selected || !svg || !scroller) return

  const targetLeft = svg.offsetLeft + selected.x * props.zoom - scroller.clientWidth / 2
  const targetTop = svg.offsetTop + selected.y * props.zoom - scroller.clientHeight / 2
  scroller.scrollTo({
    left: Math.max(0, targetLeft),
    top: Math.max(0, targetTop),
    behavior: 'auto',
  })
}

async function scheduleNetworkCenter() {
  await nextTick()
  window.requestAnimationFrame(centerSelectedNetworkNode)
}

watch(
  () => [props.mode, props.selectedPersonId, props.zoom, props.graph.nodes.length, props.graph.width, props.graph.height],
  scheduleNetworkCenter,
)

onMounted(scheduleNetworkCenter)

function wrapSvgText(value, maxLength) {
  const text = String(value || '').trim()
  if (!text) return []
  const words = text.split(/\s+/)
  const lines = []
  let current = ''

  words.forEach((word) => {
    const chunks = word.length > maxLength ? word.match(new RegExp(`.{1,${maxLength}}`, 'g')) : [word]
    chunks.forEach((chunk) => {
      const next = current ? `${current} ${chunk}` : chunk
      if (next.length > maxLength && current) {
        lines.push(current)
        current = chunk
      } else {
        current = next
      }
    })
  })

  if (current) lines.push(current)
  return lines
}

function shortText(value, maxLength) {
  const text = String(value || '')
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}
const graphWidth = computed(() => Math.max(props.graph.width || 0, 960, ...props.graph.nodes.map((entry) => entry.x + 150)))
const graphHeight = computed(() => Math.max(props.graph.height || 0, 540, ...props.graph.nodes.map((entry) => entry.y + 170)))
const viewBox = computed(() => `0 0 ${graphWidth.value} ${graphHeight.value}`)
</script>
