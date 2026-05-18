export function buildGraphModel(
  people,
  { focusId = '', mode = 'tree', ancestorDepth = 20, descendantDepth = 20 } = {},
) {
  const byId = new Map(people.map((person) => [person.id, person]))
  const focus = byId.get(focusId) || null

  if (!focus) {
    return mode === 'network'
      ? { nodes: [], edges: [], rows: [], legend: true }
      : { nodes: [], edges: [], rows: [], legend: false }
  }

  return mode === 'network'
    ? buildNetworkModel(people, focus, ancestorDepth, descendantDepth)
    : buildFocusedTreeModel(people, focus, ancestorDepth, descendantDepth)
}

function buildFocusedTreeModel(people, focus, ancestorDepth, descendantDepth) {
  const byId = new Map(people.map((person) => [person.id, person]))
  const ancestorGroups = groupsByDepth(focus.id, ancestorDepth, (id) =>
    (byId.get(id)?.sponsorIds || []).map((sponsorId) => byId.get(sponsorId)).filter(Boolean),
  )
  const descendantGroups = groupsByDepth(focus.id, descendantDepth, (id) =>
    people.filter((person) => (person.sponsorIds || []).includes(id)),
  )

  const ancestorRows = ancestorGroups.length
    ? ancestorGroups
        .map((members, index) => ({
          label: ancestorLabel(index + 1),
          people: members,
          relation: 'ancestor',
          emptyText: '',
        }))
        .reverse()
    : [{ label: 'Parrains', people: [], relation: 'ancestor', emptyText: 'Aucun parrain direct' }]
  const descendantRows = descendantGroups.length
    ? descendantGroups.map((members, index) => ({
        label: descendantLabel(index + 1),
        people: members,
        relation: 'descendant',
        emptyText: '',
      }))
    : [{ label: 'Fillots', people: [], relation: 'descendant', emptyText: 'Aucun fillot direct' }]

  const rows = [
    ...ancestorRows,
    {
      label: focusLabel(focus),
      people: [focus, ...crossGroupMembers(people, focus)],
      relation: 'focus',
      emptyText: '',
    },
    ...descendantRows,
  ]

  return {
    nodes: rows.flatMap((row, generation) =>
      row.people.map((person) => ({
        ...person,
        generation,
        y: 80 + generation * 150,
      })),
    ),
    edges: [],
    rows,
    legend: false,
  }
}

function buildNetworkModel(people, focus, ancestorDepth, descendantDepth) {
  const visiblePeople = visiblePeopleAroundFocus(people, focus.id, ancestorDepth, descendantDepth)
  const byId = new Map(visiblePeople.map((person) => [person.id, person]))
  const rings = networkRings(visiblePeople, focus.id, ancestorDepth, descendantDepth)
  const width = Math.max(720, ...rings.map((ring) => ring.length * 190))
  const nodes = rings.flatMap((ring, ringIndex) =>
    ring.map((person, index) => ({
      id: person.id,
      label: person.name,
      nickname: displayNicknames(person),
      filiere: person.filiere || '',
      baptismDate: person.baptismDate || '',
      generation: ringIndex,
      x: (width / (ring.length + 1)) * (index + 1),
      y: 80 + ringIndex * 150,
    })),
  )
  const nodeIds = new Set(nodes.map((node) => node.id))

  return {
    nodes,
    rows: [],
    edges: [
      ...visiblePeople.flatMap((person) => {
        const sponsorEdges = (person.sponsorIds || [])
          .filter((sponsorId) => byId.has(sponsorId))
          .map((sponsorId) => ({ from: sponsorId, to: person.id, kind: 'sponsor' }))
        const heartEdges = (person.heartSponsorIds || [])
          .filter((sponsorId) => byId.has(sponsorId))
          .map((sponsorId) => ({ from: sponsorId, to: person.id, kind: 'heart' }))
        return [...sponsorEdges, ...heartEdges]
      }),
      ...crossGroupEdges(visiblePeople, nodeIds),
    ],
    legend: true,
  }
}

function groupsByDepth(rootId, maxDepth, nextPeople) {
  const groups = []
  const seen = new Set([rootId])
  let frontier = [rootId]

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const next = frontier
      .flatMap((id) => nextPeople(id))
      .filter((person) => person && !seen.has(person.id))
    next.forEach((person) => seen.add(person.id))
    if (!next.length) break
    groups.push(sortPeople(next))
    frontier = next.map((person) => person.id)
  }

  return groups
}

function visiblePeopleAroundFocus(people, focusId, ancestorDepth, descendantDepth) {
  const byId = new Map(people.map((person) => [person.id, person]))
  const ids = new Set([focusId])
  groupsByDepth(focusId, ancestorDepth, (id) =>
    (byId.get(id)?.sponsorIds || []).map((sponsorId) => byId.get(sponsorId)).filter(Boolean),
  )
    .flat()
    .forEach((person) => ids.add(person.id))
  groupsByDepth(focusId, descendantDepth, (id) =>
    people.filter((person) => (person.sponsorIds || []).includes(id)),
  )
    .flat()
    .forEach((person) => ids.add(person.id))

  const focus = byId.get(focusId)
  crossGroupMembers(people, focus).forEach((person) => ids.add(person.id))
  return people.filter((person) => ids.has(person.id))
}

function networkRings(people, focusId, ancestorDepth, descendantDepth) {
  const byId = new Map(people.map((person) => [person.id, person]))
  const focus = byId.get(focusId)
  if (!focus) return []
  const ancestorGroups = groupsByDepth(focusId, ancestorDepth, (id) =>
    (byId.get(id)?.sponsorIds || []).map((sponsorId) => byId.get(sponsorId)).filter(Boolean),
  )
  const descendantGroups = groupsByDepth(focusId, descendantDepth, (id) =>
    people.filter((person) => (person.sponsorIds || []).includes(id)),
  )
  return [...ancestorGroups.reverse(), [focus], ...descendantGroups].filter((ring) => ring.length)
}

function crossGroupMembers(people, focus) {
  if (!focus?.crossGroupId) return []
  return sortPeople(
    people.filter((person) => person.id !== focus.id && person.crossGroupId === focus.crossGroupId),
  )
}

function crossGroupEdges(people, nodeIds) {
  const groups = new Map()
  people.forEach((person) => {
    if (!person.crossGroupId || !nodeIds.has(person.id)) return
    if (!groups.has(person.crossGroupId)) groups.set(person.crossGroupId, [])
    groups.get(person.crossGroupId).push(person.id)
  })
  return [...groups.values()].flatMap((ids) =>
    ids.flatMap((from, index) =>
      ids.slice(index + 1).map((to) => ({ from, to, kind: 'cross' })),
    ),
  )
}

export function displayName(person) {
  const nicknames = displayNicknames(person)
  return nicknames ? `${person.name} dit ${nicknames}` : person.name
}

export function displayNicknames(person) {
  return (person.nicknames || [person.nickname]).filter(Boolean).join(' / ')
}

function focusLabel(person) {
  return person.crossGroupId ? 'Faluchards croisés' : 'Faluchard recherché'
}

function ancestorLabel(depth) {
  if (depth === 1) return 'Parrains'
  if (depth === 2) return 'Grands-parrains'
  return `Ascendance niveau ${depth}`
}

function descendantLabel(depth) {
  if (depth === 1) return 'Fillots'
  if (depth === 2) return 'Petits-fillots'
  return `Descendance niveau ${depth}`
}

function sortPeople(people) {
  return [...people].sort((a, b) => displayName(a).localeCompare(displayName(b), 'fr'))
}
