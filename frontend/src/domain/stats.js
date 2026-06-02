import { filiereLabel } from './filiere.js'
import { getAllPeople } from './genealogy.js'
import { roleLabel } from './roles.js'

export function computeStats(genealogies) {
  const people = getAllPeople({ genealogies })
  const songs = countValues(people.map((person) => person.song).filter(Boolean))
  const filieres = countValues(people.map((person) => filiereLabel(person.filiere, person.filiereCustom) || 'Non renseign?e'))
  const roleEntries = people.flatMap((person) =>
    (person.roles || []).map((roleId) => ({
      roleId,
      label: roleLabel(roleId, genealogies, { type: 'national' }),
      person,
    })),
  )
  const roles = countValues(roleEntries.map((entry) => entry.label))
  const rolePeople = groupRolePeople(roleEntries)
  const nicknameEntries = people
    .flatMap((person) => (person.nicknames?.length ? person.nicknames : [person.nickname || '']).map((nickname) => ({
      person,
      nickname,
      length: nickname.length,
    })))
    .filter((entry) => entry.length > 0)
    .sort((a, b) => b.length - a.length || a.nickname.localeCompare(b.nickname, 'fr'))
  const descendants = people
    .map((person) => ({ person, count: countDescendants(people, person.id) }))
    .sort((a, b) => b.count - a.count || a.person.name.localeCompare(b.person.name, 'fr'))
  const crossGroups = countValues(people.map((person) => person.crossGroupId).filter(Boolean))
  const baptized = people.filter((person) => person.baptismDate)
  const datedBaptisms = baptized
    .map((person) => ({ person, date: parseDate(person.baptismDate) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date - b.date)

  return {
    genealogyCount: genealogies.length,
    peopleCount: people.length,
    sponsorLinkCount: people.reduce((total, person) => total + (person.sponsorIds?.length || 0), 0),
    topSong: topEntry(songs),
    filieres,
    roles,
    rolePeople,
    longestNickname: nicknameEntries[0] || null,
    largestDescendance: descendants[0]?.count ? descendants[0] : null,
    crossGroupCount: Object.keys(crossGroups).length,
    baptizedCount: baptized.length,
    unbaptizedCount: people.length - baptized.length,
    datedBaptisms,
    timelineMonths: monthOptions(datedBaptisms),
  }
}

export function buildTimeline(entries, period = 'month', selectedMonth = '') {
  if (!entries.length) return []
  if (period === 'year') {
    const firstYear = entries[0].date.getFullYear()
    const lastYear = entries.at(-1).date.getFullYear()
    const span = lastYear - firstYear + 1
    const step = span <= 15 ? 1 : Math.ceil(span / 15)
    const bucketCount = Math.ceil(span / step)
    return Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = firstYear + index * step
      const bucketEnd = Math.min(bucketStart + step - 1, lastYear)
      const people = entries.filter((entry) => {
        const y = entry.date.getFullYear()
        return y >= bucketStart && y <= bucketEnd
      })
      const label = step === 1 ? String(bucketStart) : `${bucketStart}-${String(bucketEnd).slice(-2)}`
      return { key: String(bucketStart), label, count: people.length, entries: people }
    })
  }

  const monthKey = selectedMonth || monthKeyFor(entries.at(-1).date)
  const [year, month] = monthKey.split('-').map(Number)
  const days = new Date(year, month, 0).getDate()
  return Array.from({ length: days }, (_, index) => {
    const day = index + 1
    const people = entries.filter(
      (entry) =>
        entry.date.getFullYear() === year &&
        entry.date.getMonth() + 1 === month &&
        entry.date.getDate() === day,
    )
    return { key: `${monthKey}-${String(day).padStart(2, '0')}`, label: String(day), count: people.length, entries: people }
  })
}


function groupRolePeople(entries) {
  const byLabel = new Map()
  for (const entry of entries) {
    if (!byLabel.has(entry.label)) byLabel.set(entry.label, new Map())
    byLabel.get(entry.label).set(entry.person.id, entry.person)
  }
  return Object.fromEntries(
    [...byLabel.entries()].map(([label, peopleById]) => [
      label,
      [...peopleById.values()].sort((left, right) => left.name.localeCompare(right.name, 'fr')),
    ]),
  )
}

function countValues(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1
    return counts
  }, {})
}

function topEntry(record) {
  return Object.entries(record).sort((a, b) => b[1] - a[1])[0] || null
}

function countDescendants(people, personId, visited = new Set()) {
  if (visited.has(personId)) return 0
  visited.add(personId)
  const children = people.filter((person) => (person.sponsorIds || []).includes(personId))
  return children.reduce((total, child) => total + 1 + countDescendants(people, child.id, visited), 0)
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function monthKeyFor(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthOptions(entries) {
  const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
  return [...new Map(entries.map((entry) => [monthKeyFor(entry.date), formatter.format(entry.date)])).entries()].map(
    ([key, label]) => ({ key, label }),
  )
}
