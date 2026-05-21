<template>
  <section class="stats-page">
    <header class="stats-section-head">
      <h2>Statistiques</h2>
      <p>
        {{ stats.peopleCount }} fiche(s) sur {{ stats.genealogyCount }} arbre(s),
        {{ stats.baptizedCount }} baptisé(s), {{ stats.unbaptizedCount }} non baptisé(s).
      </p>
    </header>

    <section class="stats-evolution stat-card">
      <div class="stats-section-head">
        <h3>Évolution des baptêmes</h3>
        <p>{{ stats.datedBaptisms.length }} baptême(s) daté(s).</p>
      </div>

      <div class="timeline-controls">
        <button :class="{ 'is-active': period === 'month' }" type="button" @click="period = 'month'">
          Mois
        </button>
        <button :class="{ 'is-active': period === 'year' }" type="button" @click="period = 'year'">
          Années
        </button>
        <select v-if="period === 'month' && stats.timelineMonths.length" v-model="selectedMonth">
          <option v-for="month in stats.timelineMonths" :key="month.key" :value="month.key">
            {{ month.label }}
          </option>
        </select>
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
        <line x1="44" y1="214" x2="724" y2="214" />
        <line x1="44" y1="24" x2="44" y2="214" />
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

      <div class="timeline-summary">
        <div><span>Total affiché</span><strong>{{ displayedTotal }}</strong></div>
        <div><span>Total enregistré</span><strong>{{ stats.datedBaptisms.length }}</strong></div>
        <div><span>Période la plus dense</span><strong>{{ busiestLabel }}</strong></div>
      </div>
    </section>

    <div class="metric-grid">
      <article><strong>{{ stats.genealogyCount }}</strong><span>généalogies</span></article>
      <article><strong>{{ stats.peopleCount }}</strong><span>personnes</span></article>
      <article><strong>{{ stats.sponsorLinkCount }}</strong><span>liens de parrainage</span></article>
      <article><strong>{{ stats.crossGroupCount }}</strong><span>groupes croisés</span></article>
    </div>

    <div class="stats-grid">
      <article class="stat-card">
        <h3>Paillarde dominante</h3>
        <p>{{ stats.topSong ? `${stats.topSong[0]} (${stats.topSong[1]})` : 'Aucune' }}</p>
      </article>
      <article class="stat-card">
        <h3>Plus grande descendance</h3>
        <p>{{ stats.largestDescendance ? `${stats.largestDescendance.person.name} (${stats.largestDescendance.count})` : 'Aucune' }}</p>
      </article>
      <article class="stat-card">
        <h3>Surnom le plus long</h3>
        <p>{{ stats.longestNickname ? `${stats.longestNickname.nickname} (${stats.longestNickname.length})` : 'Aucun' }}</p>
      </article>
      <article class="stat-card stat-card--wide">
        <h3>Filières</h3>
        <div class="chip-list">
          <span v-for="[label, count] in Object.entries(stats.filieres)" :key="label" class="chip">{{ label }} · {{ count }}</span>
        </div>
      </article>
      <article class="stat-card stat-card--wide">
        <h3>Rôles</h3>
        <div class="chip-list">
          <button
            v-for="[label, count] in Object.entries(stats.roles)"
            :key="label"
            class="chip chip-button"
            type="button"
            :class="{ 'is-active': selectedRole === label }"
            @click="selectedRole = selectedRole === label ? '' : label"
          >
            {{ label }} ? {{ count }}
          </button>
          <span v-if="Object.keys(stats.roles).length === 0" class="empty">Aucun rôle.</span>
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
import { buildTimeline } from '../../domain/stats.js'

const props = defineProps({ stats: { type: Object, required: true } })
defineEmits(['select'])
const period = ref('month')
const selectedMonth = ref('')
const selectedRole = ref('')
const hoveredPointKey = ref('')

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
const points = computed(() => {
  const max = Math.max(1, ...timeline.value.map((item) => item.count))
  return timeline.value.map((item, index) => ({
    ...item,
    x: 44 + (timeline.value.length === 1 ? 340 : (index * 680) / (timeline.value.length - 1)),
    y: 214 - (item.count / max) * 170,
  }))
})
const polylinePoints = computed(() => points.value.map((point) => `${point.x},${point.y}`).join(' '))

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
</script>
