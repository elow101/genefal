<template>
  <section class="stats-page">
    <div class="metric-grid stats-kpi-strip" aria-label="Indicateurs principaux">
      <article v-for="metric in metricCards" :key="metric.label" class="stats-kpi-card">
        <span class="stats-kpi-icon" aria-hidden="true">{{ metric.icon }}</span>
        <div>
          <strong :title="String(metric.value)">{{ metric.value }}</strong>
          <span :title="metric.label">{{ metric.label }}</span>
          <small :title="metric.trend">
            <i class="metric-sparkline" aria-hidden="true"></i>
            {{ metric.trend }}
          </small>
        </div>
      </article>
    </div>

    <section class="stats-evolution stat-card stat-card--featured">
      <div class="stats-chart-head">
        <div>
          <h3>Évolution des baptêmes</h3>
          <div class="timeline-summary timeline-summary--inline">
            <div><span>Total affiché</span><strong>{{ displayedTotal }}</strong></div>
            <div><span>Total</span><strong>{{ stats.datedBaptisms.length }}</strong></div>
            <div><span>Période dense</span><strong>{{ busiestLabel }}</strong></div>
          </div>
        </div>

        <div class="timeline-controls" aria-label="Contrôles du graphe">
          <div class="segmented-control" role="group" aria-label="Période">
            <button :class="{ 'is-active': period === 'month' }" type="button" @click="period = 'month'">
              Mois
            </button>
            <button :class="{ 'is-active': period === 'year' }" type="button" @click="period = 'year'">
              Années
            </button>
          </div>
          <select v-if="period === 'month' && stats.timelineMonths.length" v-model="selectedMonth">
            <option v-for="month in stats.timelineMonths" :key="month.key" :value="month.key">
              {{ month.label }}
            </option>
          </select>
          <button
            v-if="period === 'year'"
            type="button"
            class="scale-toggle"
            :class="{ 'is-active': scaleMode === 'log' }"
            @click="scaleMode = scaleMode === 'log' ? 'linear' : 'log'"
          >
            Log
          </button>
        </div>
      </div>

      <p v-if="timeline.length === 0" class="empty">Aucune date de baptême renseignée.</p>
      <svg
        v-else
        class="timeline-chart"
        viewBox="0 0 760 260"
        role="img"
        aria-label="Evolution des baptêmes"
        @mouseleave="hoveredPointKey = ''"
      >
        <g class="timeline-grid">
          <line
            v-for="gridLine in gridLines"
            :key="gridLine.key"
            x1="44"
            :y1="gridLine.y"
            x2="724"
            :y2="gridLine.y"
          />
        </g>
        <line class="timeline-axis" x1="44" y1="214" x2="724" y2="214" />
        <line class="timeline-axis" x1="44" y1="24" x2="44" y2="214" />
        <polyline :points="polylinePoints" />
        <g v-for="point in points" :key="point.key">
          <circle
            :cx="point.x"
            :cy="point.y"
            r="4"
            tabindex="0"
            @focus="hoveredPointKey = point.key"
            @mouseenter="hoveredPointKey = point.key"
          />
          <text :x="point.x" y="238">{{ point.label }}</text>
        </g>
        <g v-if="hoveredPoint" class="timeline-tooltip">
          <rect
            :x="tooltipBox.x"
            :y="tooltipBox.y"
            :width="tooltipBox.width"
            :height="tooltipBox.height"
            rx="8"
          />
          <text :x="tooltipBox.x + 10" :y="tooltipBox.y + 18" class="timeline-tooltip-title">
            {{ hoveredPoint.label }}
          </text>
          <text :x="tooltipBox.x + 10" :y="tooltipBox.y + 38">
            {{ hoveredPoint.count }} personne(s)
          </text>
        </g>
      </svg>
    </section>

    <section class="stat-card stat-card--wide newcomers-panel">
      <div class="stats-section-head">
        <h3>Nouveaux venus</h3>
        <p>Les 10 derniers baptêmes renseignés.</p>
      </div>
      <p v-if="newcomers.length === 0" class="empty">Aucun baptême renseigné pour le moment.</p>
      <div
        v-else
        class="newcomers-grid newcomers-carousel"
        tabindex="0"
        aria-label="Liste horizontale des 10 derniers venus"
      >
        <button
          v-for="person in newcomers"
          :key="person.id"
          type="button"
          class="node-card newcomer-card"
          :style="filiereStyle(person)"
          @click="$emit('select', person.id)"
        >
          <strong>{{ person.name }}</strong>
          <span class="node-info">
            <span>{{ filiereLabel(person.filiere, person.filiereCustom) || 'Filière non renseignée' }}</span>
            <span>{{ formatDate(person.baptismDate) }}</span>
            <span v-if="person.nickname">{{ person.nickname }}</span>
          </span>
        </button>
      </div>
    </section>

    <div class="stats-grid stats-highlights">
      <article v-for="highlight in highlights" :key="highlight.label" class="stat-card stat-highlight-card">
        <span class="highlight-icon" aria-hidden="true">{{ highlight.icon }}</span>
        <div>
          <strong>{{ highlight.value }}</strong>
          <span>{{ highlight.label }}</span>
          <small>{{ highlight.detail }}</small>
        </div>
        <button type="button" :disabled="!highlight.personId" @click="$emit('select', highlight.personId)">
          Voir
        </button>
      </article>
    </div>

    <div class="stats-grid stats-taxonomy-grid">
      <article class="stat-card stat-card--wide stat-distribution-card">
        <div class="distribution-head">
          <h3>Filières</h3>
          <button
            v-if="filiereEntries.length > maxVisibleChips"
            type="button"
            class="text-button"
            @click="showAllFilieres = !showAllFilieres"
          >
            {{ showAllFilieres ? 'Réduire' : 'Voir toutes' }}
          </button>
        </div>
        <div class="chip-list distribution-list">
          <button
            v-for="entry in visibleFiliereEntries"
            :key="entry.label"
            type="button"
            class="chip chip-button distribution-chip"
            :title="entry.label"
            @click="$emit('filter-filiere', entry.label)"
          >
            <span class="distribution-chip-row"><strong>{{ entry.label }}</strong><em>{{ entry.count }}</em></span>
            <i aria-hidden="true"><b :style="{ width: `${entry.percent}%` }"></b></i>
          </button>
          <span v-if="filiereEntries.length === 0" class="empty">Aucune filière.</span>
        </div>
      </article>

      <article class="stat-card stat-card--wide stat-distribution-card">
        <div class="distribution-head">
          <h3>Rôles</h3>
          <button
            v-if="roleEntries.length > maxVisibleChips"
            type="button"
            class="text-button"
            @click="showAllRoles = !showAllRoles"
          >
            {{ showAllRoles ? 'Réduire' : 'Voir tous' }}
          </button>
        </div>
        <div class="chip-list distribution-list">
          <button
            v-for="entry in visibleRoleEntries"
            :key="entry.label"
            class="chip chip-button distribution-chip"
            type="button"
            :class="{ 'is-active': selectedRole === entry.label }"
            :title="entry.label"
            @click="selectedRole = selectedRole === entry.label ? '' : entry.label"
          >
            <span class="distribution-chip-row"><strong>{{ entry.label }}</strong><em>{{ entry.count }}</em></span>
            <i aria-hidden="true"><b :style="{ width: `${entry.percent}%` }"></b></i>
          </button>
          <span v-if="roleEntries.length === 0" class="empty">Aucun rôle.</span>
        </div>
        <div v-if="selectedRole" class="role-people-list">
          <strong>{{ selectedRole }}</strong>
          <button
            v-for="person in stats.rolePeople[selectedRole] || []"
            :key="person.id"
            type="button"
            @click="$emit('select', person.id)"
          >
            {{ person.name }}
            <small v-if="person.nickname">dit {{ person.nickname }}</small>
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { filiereLabel, filiereStyle } from '../../domain/filiere.js'
import { buildTimeline } from '../../domain/stats.js'

const props = defineProps({
  stats: { type: Object, required: true },
  people: { type: Array, required: true },
})
defineEmits(['select', 'filter-filiere'])

const maxVisibleChips = 12
const period = ref('month')
const selectedMonth = ref('')
const selectedRole = ref('')
const hoveredPointKey = ref('')
const scaleMode = ref('linear')
const showAllFilieres = ref(false)
const showAllRoles = ref(false)

watch(
  () => props.stats.timelineMonths,
  (months) => {
    if (!selectedMonth.value) selectedMonth.value = months.at(-1)?.key || ''
  },
  { immediate: true },
)

const timeline = computed(() => buildTimeline(props.stats.datedBaptisms, period.value, selectedMonth.value))
const displayedTotal = computed(() => timeline.value.reduce((total, item) => total + item.count, 0))
const busiest = computed(() => [...timeline.value].sort((a, b) => b.count - a.count)[0])
const busiestLabel = computed(() => busiest.value?.count ? `${busiest.value.label} (${busiest.value.count})` : 'Aucune')
const currentMonthCount = computed(() => {
  const now = new Date()
  return props.stats.datedBaptisms.filter(
    (entry) => entry.date.getFullYear() === now.getFullYear() && entry.date.getMonth() === now.getMonth(),
  ).length
})
const metricCards = computed(() => [
  {
    icon: '◇',
    value: props.stats.peopleCount,
    label: 'personnes',
    trend: `${props.stats.genealogyCount} arbre(s)`,
  },
  {
    icon: '●',
    value: props.stats.baptizedCount,
    label: 'baptisés',
    trend: `+${currentMonthCount.value} ce mois`,
  },
  {
    icon: '○',
    value: props.stats.unbaptizedCount,
    label: 'non baptisés',
    trend: 'statut à suivre',
  },
  {
    icon: '⌁',
    value: props.stats.sponsorLinkCount,
    label: 'parrainages',
    trend: 'liens actifs',
  },
  {
    icon: '✦',
    value: props.stats.crossGroupCount,
    label: 'groupes croisés',
    trend: 'baptêmes croisés',
  },
])

const points = computed(() => {
  const max = Math.max(1, ...timeline.value.map((item) => item.count))
  const scale = (value) => {
    if (period.value === 'year' && scaleMode.value === 'log') {
      return Math.log1p(value) / Math.log1p(max)
    }
    return value / max
  }
  return timeline.value.map((item, index) => ({
    ...item,
    x: 44 + (timeline.value.length === 1 ? 340 : (index * 680) / (timeline.value.length - 1)),
    y: 214 - scale(item.count) * 170,
  }))
})
const polylinePoints = computed(() => points.value.map((point) => `${point.x},${point.y}`).join(' '))
const gridLines = computed(() =>
  [0.25, 0.5, 0.75, 1].map((ratio) => ({ key: ratio, y: 214 - ratio * 170 })),
)

const hoveredPoint = computed(() => points.value.find((point) => point.key === hoveredPointKey.value) || null)
const tooltipBox = computed(() => {
  const point = hoveredPoint.value
  if (!point) return { x: 0, y: 0, width: 0, height: 0 }
  const width = 138
  const height = 48
  return {
    x: Math.min(760 - width - 8, Math.max(8, point.x - width / 2)),
    y: Math.max(8, point.y - height - 12),
    width,
    height,
  }
})

const newcomers = computed(() =>
  [...props.people]
    .filter((person) => person.baptismDate)
    .sort((a, b) => String(a.baptismDate).localeCompare(String(b.baptismDate)))
    .slice(-10)
    .reverse(),
)

const topSongPerson = computed(() => {
  const song = props.stats.topSong?.[0]
  return song ? props.people.find((person) => person.song === song) || null : null
})
const highlights = computed(() => [
  {
    icon: '🎵',
    value: props.stats.topSong?.[0] || 'Aucune',
    label: 'Paillarde dominante',
    detail: props.stats.topSong ? `${props.stats.topSong[1]} occurrence(s)` : 'Aucune donnée',
    personId: topSongPerson.value?.id || '',
  },
  {
    icon: '🌳',
    value: props.stats.largestDescendance?.person.name || 'Aucune',
    label: 'Plus grande descendance',
    detail: props.stats.largestDescendance ? `${props.stats.largestDescendance.count} descendant(s)` : 'Aucune donnée',
    personId: props.stats.largestDescendance?.person.id || '',
  },
  {
    icon: '✍️',
    value: props.stats.longestNickname?.nickname || 'Aucun',
    label: 'Surnom le plus long',
    detail: props.stats.longestNickname ? `${props.stats.longestNickname.length} caractères` : 'Aucune donnée',
    personId: props.stats.longestNickname?.person.id || '',
  },
])

const filiereEntries = computed(() => toDistributionEntries(props.stats.filieres))
const roleEntries = computed(() => toDistributionEntries(props.stats.roles))
const visibleFiliereEntries = computed(() =>
  showAllFilieres.value ? filiereEntries.value : filiereEntries.value.slice(0, maxVisibleChips),
)
const visibleRoleEntries = computed(() =>
  showAllRoles.value ? roleEntries.value : roleEntries.value.slice(0, maxVisibleChips),
)

function toDistributionEntries(record) {
  const entries = Object.entries(record || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
  const max = Math.max(1, ...entries.map(([, count]) => count))
  return entries.map(([label, count]) => ({ label, count, percent: Math.max(4, Math.round((count / max) * 100)) }))
}

function formatDate(value) {
  if (!value) return 'Date inconnue'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date)
}
</script>
