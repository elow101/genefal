<template>
  <section
    class="graph-panel"
    :class="[`graph-panel--${mode}`, { 'has-relation-focus': hasRelationFocus }]"
  >
    <div v-if="showLegend && graph.legend" class="graph-legend">
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
        <section
          class="tree-generation"
          :class="[
            `tree-generation--${row.relation}`,
            { 'tree-generation--raised': row.people.some((person) => person.id === hoveredTreeNodeId) },
          ]"
        >
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
              :class="personRelationClass(person.id)"
              :data-person-id="person.id"
              :style="filiereStyle(person)"
              @mouseenter="hoveredTreeNodeId = person.id"
              @mouseleave="hoveredTreeNodeId = ''"
              @focus="hoveredTreeNodeId = person.id"
              @blur="hoveredTreeNodeId = ''"
              @pointerdown.stop
              @click.stop="$emit('select', person.id)"
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
        :class="[edge.kind || 'sponsor', edgeRelationClass(edge)]"
        :x1="node(edge.from)?.x"
        :y1="edgeStartY(edge.from)"
        :x2="node(edge.to)?.x"
        :y2="edgeEndY(edge.to)"
        :marker-end="arrowMarker(edge.kind)"
      />
      <g
        v-for="entry in networkNodes"
        :key="entry.id"
        class="graph-node graph-node--network"
        :class="personRelationClass(entry.id)"
        :data-person-id="entry.id"
        tabindex="0"
        @mouseenter="hoveredNetworkNodeId = entry.id"
        @mouseleave="hoveredNetworkNodeId = ''"
        @focus="hoveredNetworkNodeId = entry.id"
        @blur="hoveredNetworkNodeId = ''"
        @pointerdown.stop
        @click.stop="$emit('select', entry.id)"
      >
        <rect class="network-card-base" :x="entry.x - 82" :y="entry.y - 34" width="164" :height="networkBaseCardHeight(entry)" rx="10" />
        <g v-if="generationBadge(entry.id)" class="network-generation-badge" :class="generationBadgeClass(entry.id)">
          <rect :x="entry.x + 48" :y="entry.y - 48" width="42" height="22" rx="11" />
          <text :x="entry.x + 69" :y="entry.y - 33">{{ generationBadge(entry.id) }}</text>
        </g>
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
        <g v-if="networkRolePills(hoveredNetworkNode).length" class="network-role-pills">
          <g
            v-for="(role, roleIndex) in networkRolePills(hoveredNetworkNode)"
            :key="`${hoveredNetworkNode.id}-net-role-${role.id}`"
          >
            <rect
              :x="hoveredNetworkNode.x - 100 + roleIndex * 52"
              :y="networkRolePillsY(hoveredNetworkNode)"
              :width="Math.min(50, 8 + role.label.length * 5.5)"
              height="18"
              rx="9"
              :fill="role.color"
            />
            <text
              class="network-role-pill-text"
              :x="hoveredNetworkNode.x - 100 + roleIndex * 52 + Math.min(50, 8 + role.label.length * 5.5) / 2"
              :y="networkRolePillsY(hoveredNetworkNode) + 13"
            >
              {{ shortText(role.label, 8) }}
            </text>
          </g>
        </g>
      </g>
    </svg>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { filiereAccent, filiereLabel, filiereStyle } from '../../domain/filiere.js'
import { ceremonySummaries } from '../../domain/graph.js'

const props = defineProps({
  graph: { type: Object, required: true },
  selectedPersonId: { type: String, default: '' },
  zoom: { type: Number, default: 1 },
  mode: { type: String, default: 'tree' },
  roleOptions: { type: Array, default: () => [] },
  showLegend: { type: Boolean, default: true },
  haloAncestorDepth: { type: [Number, String], default: 1 },
  haloDescendantDepth: { type: [Number, String], default: 1 },
})

defineEmits(['select'])

const hoveredNetworkNodeId = ref('')
const hoveredTreeNodeId = ref('')

const isEmpty = computed(() => (props.mode === 'tree' ? props.graph.rows.length === 0 : props.graph.nodes.length === 0))
const nodeById = computed(() => new Map(props.graph.nodes.map((entry) => [entry.id, entry])))
const hoveredNetworkNode = computed(() => nodeById.value.get(hoveredNetworkNodeId.value) || null)
const networkNodes = computed(() => orderedNodesForStacking(props.graph.nodes, hoveredNetworkNodeId.value, props.selectedPersonId))
const hasRelationFocus = computed(() => Boolean(props.selectedPersonId))
const generationById = computed(() => generationMapForFocus(props.graph.edges, props.selectedPersonId, {
  ancestorDepth: props.haloAncestorDepth,
  descendantDepth: props.haloDescendantDepth,
}))
const selectedDirectIds = computed(() => {
  if (!props.selectedPersonId) return new Set()
  return new Set(generationById.value.keys())
})
function node(id) {
  return nodeById.value.get(id)
}
function personRelationClass(id) {
  const generation = generationById.value.get(id)
  return {
    focus: id === props.selectedPersonId,
    selected: id === props.selectedPersonId,
    'is-related': hasRelationFocus.value && id !== props.selectedPersonId && selectedDirectIds.value.has(id),
    'is-dimmed': hasRelationFocus.value && !selectedDirectIds.value.has(id),
    'is-ancestor': hasRelationFocus.value && generation < 0,
    'is-descendant': hasRelationFocus.value && generation > 0,
  }
}
function edgeRelationClass(edge) {
  if (!props.selectedPersonId) return ''
  return generationById.value.has(edge.from) && generationById.value.has(edge.to) ? 'is-direct' : 'is-dimmed'
}
function orderedNodesForStacking(nodes, hoveredId, selectedId) {
  return [...nodes].sort((left, right) => nodeStackRank(left.id, hoveredId, selectedId) - nodeStackRank(right.id, hoveredId, selectedId))
}
function nodeStackRank(id, hoveredId, selectedId) {
  if (id === hoveredId) return 3
  if (id === selectedId) return 2
  if (selectedDirectIds.value.has(id)) return 1
  return 0
}
function generationMapForFocus(edges, focusId, { ancestorDepth, descendantDepth }) {
  if (!focusId) return new Map()
  const parentsById = new Map()
  const childrenById = new Map()
  edges
    .filter((edge) => edge.kind !== 'cross')
    .forEach((edge) => {
      if (!parentsById.has(edge.to)) parentsById.set(edge.to, [])
      if (!childrenById.has(edge.from)) childrenById.set(edge.from, [])
      parentsById.get(edge.to).push(edge.from)
      childrenById.get(edge.from).push(edge.to)
    })

  const generations = new Map([[focusId, 0]])
  collectGenerations(focusId, parentsById, normalizeHaloDepth(ancestorDepth), -1, generations)
  collectGenerations(focusId, childrenById, normalizeHaloDepth(descendantDepth), 1, generations)
  return generations
}
function collectGenerations(rootId, relationMap, maxDepth, direction, generations) {
  const seen = new Set([rootId])
  let frontier = [rootId]
  let depth = 1

  while (frontier.length && depth <= maxDepth) {
    const next = []
    frontier.forEach((id) => {
      ;(relationMap.get(id) || []).forEach((linkedId) => {
        if (seen.has(linkedId)) return
        seen.add(linkedId)
        setGeneration(generations, linkedId, depth * direction)
        next.push(linkedId)
      })
    })
    frontier = next
    depth += 1
  }
}
function setGeneration(generations, id, generation) {
  const current = generations.get(id)
  if (!Number.isFinite(current) || Math.abs(generation) < Math.abs(current)) {
    generations.set(id, generation)
  }
}
function normalizeHaloDepth(value) {
  if (value === 'all') return Number.POSITIVE_INFINITY
  const depth = Number(value)
  return Number.isFinite(depth) ? Math.max(0, depth) : 1
}
function generationBadge(id) {
  if (props.mode !== 'network' || !hasRelationFocus.value || !generationById.value.has(id)) return ''
  const generation = generationById.value.get(id)
  if (generation === 0) return 'G0'
  return `G${generation > 0 ? '+' : ''}${generation}`
}
function generationBadgeClass(id) {
  const generation = generationById.value.get(id)
  return {
    'network-generation-badge--self': generation === 0,
    'network-generation-badge--ancestor': generation < 0,
    'network-generation-badge--descendant': generation > 0,
  }
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
  const linesHeight = 28 + networkHoverLines(entry).length * 17
  const pillsHeight = networkRolePills(entry).length ? 26 : 0
  return Math.max(96, linesHeight + pillsHeight)
}
function networkRolePillsY(entry) {
  return entry.y + 88 + networkHoverLines(entry).length * 17 + 4
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
