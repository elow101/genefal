export function buildGraphModel(
  people,
  { focusId = '', mode = 'tree', ancestorDepth = 20, descendantDepth = 20, includeAllNetwork = false } = {},
) {
  const byId = new Map(people.map((person) => [person.id, person]))
  const focus = byId.get(focusId) || null

  if (mode === 'network' && includeAllNetwork) {
    return buildGlobalNetworkModel(people, focusId)
  }

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
  const ancestorGroups = groupsByDepth(focus.id, ancestorDepth, (id) => directSponsors(byId.get(id), byId))
  const descendantGroups = groupsByDepth(focus.id, descendantDepth, (id) => directFillots(people, id))

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
    edges: relationshipEdges(rows.flatMap((row) => row.people)),
    rows,
    legend: true,
  }
}

function buildNetworkModel(people, focus, ancestorDepth, descendantDepth) {
  const visiblePeople = visiblePeopleAroundFocus(people, focus.id, ancestorDepth, descendantDepth)
  return buildFocusedNetworkModel(visiblePeople, focus.id)
}

function buildGlobalNetworkModel(people, focusId) {
  return buildLayeredNetworkModel(people, focusId, { includeDisconnected: true })
}

const GLOBAL_NETWORK_LAYOUT = { minWidth: 960, columnGap: 240, rowGap: 176, nodeMargin: 116 }
const FOCUSED_NETWORK_LAYOUT = { minWidth: 980, columnGap: 250, rowGap: 178, nodeMargin: 120 }

function buildLayeredNetworkModel(people, focusId, { includeDisconnected = false } = {}) {
  const sorted = sortPeople(people)
  const edges = relationshipEdges(sorted)
  const rows = networkRowsByLineage(sorted, lineageEdges(edges), focusId, includeDisconnected)
  return networkGraphFromRows(rows, edges, focusId, GLOBAL_NETWORK_LAYOUT)
}

function buildFocusedNetworkModel(people, focusId) {
  const sorted = sortPeople(people)
  const edges = relationshipEdges(sorted)
  const rows = focusedRowsByDistance(sorted, lineageEdges(edges), focusId)
  return networkGraphFromRows(rows, edges, focusId, FOCUSED_NETWORK_LAYOUT)
}

function lineageEdges(edges) {
  return edges.filter((edge) => edge.kind !== 'cross')
}

function networkGraphFromRows(rows, edges, focusId, layout) {
  const maxRowSize = Math.max(1, ...rows.map((row) => row.length))
  const width = Math.max(layout.minWidth, layout.nodeMargin * 2 + (maxRowSize - 1) * layout.columnGap + 164)
  const nodes = rows.flatMap((row, rowIndex) => {
    const rowWidth = (row.length - 1) * layout.columnGap
    const startX = Math.max(layout.nodeMargin, (width - rowWidth) / 2)
    return row.map((person, index) =>
      networkNode(person, startX + index * layout.columnGap, 104 + rowIndex * layout.rowGap, rowIndex),
    )
  })

  return {
    nodes,
    rows: [],
    edges,
    legend: true,
    focusId,
    width,
    height: Math.max(620, rows.length * layout.rowGap + 220),
  }
}

function networkNode(person, x, y, generation) {
  return {
    ...person,
    id: person.id,
    label: person.name,
    nickname: displayNicknames(person),
    filiere: person.filiere || '',
    baptismDate: person.baptismDate || '',
    genealogyName: person.genealogyName || '',
    generation,
    x,
    y,
  }
}

function networkRowsByLineage(people, edges, focusId, includeDisconnected) {
  const byId = new Map(people.map((person) => [person.id, person]))
  const { parentsById, childrenById } = relationMaps(people, edges)

  const focusComponent = connectedComponent(focusId, parentsById, childrenById)
  const depthCache = new Map()
  const depthFor = (id, stack = new Set()) => {
    if (depthCache.has(id)) return depthCache.get(id)
    if (stack.has(id)) return 0
    stack.add(id)
    const parentDepths = parentsById.get(id).map((parentId) => depthFor(parentId, stack))
    stack.delete(id)
    const depth = parentDepths.length ? Math.max(...parentDepths) + 1 : 0
    depthCache.set(id, Math.min(depth, 80))
    return depthCache.get(id)
  }

  people.forEach((person) => depthFor(person.id))
  const minDepth = Math.min(0, ...depthCache.values())
  const rowsByDepth = new Map()
  people.forEach((person) => {
    const depth = depthCache.get(person.id) - minDepth
    if (!rowsByDepth.has(depth)) rowsByDepth.set(depth, [])
    rowsByDepth.get(depth).push(person)
  })

  const orderById = new Map()
  const rows = [...rowsByDepth.entries()]
    .sort(([left], [right]) => left - right)
    .map(([depth, row]) => {
      const ordered = sortNetworkRow(row, parentsById, orderById, focusId, focusComponent, includeDisconnected)
      ordered.forEach((person, index) => orderById.set(person.id, index))
      return ordered.map((person) => ({ ...byId.get(person.id), networkDepth: depth }))
    })

  return rows.length ? rows : []
}

function focusedRowsByDistance(people, edges, focusId) {
  const byId = new Map(people.map((person) => [person.id, person]))
  const { parentsById, childrenById } = relationMaps(people, edges)

  const depthById = new Map([[focusId, 0]])
  walkDepth([focusId], -1, parentsById, depthById)
  walkDepth([focusId], 1, childrenById, depthById)

  const focus = byId.get(focusId)
  if (focus?.crossGroupId) {
    people
      .filter((person) => person.crossGroupId === focus.crossGroupId)
      .forEach((person) => {
        if (!depthById.has(person.id)) depthById.set(person.id, 0)
      })
  }

  people.forEach((person) => {
    if (!depthById.has(person.id)) depthById.set(person.id, 0)
  })

  const rowsByDepth = new Map()
  people.forEach((person) => {
    const depth = depthById.get(person.id) || 0
    if (!rowsByDepth.has(depth)) rowsByDepth.set(depth, [])
    rowsByDepth.get(depth).push(person)
  })

  const orderById = new Map()
  return [...rowsByDepth.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, row]) => {
      const ordered = sortPeople(row).sort((left, right) => {
        const leftScore = focusedOrderScore(left, parentsById, childrenById, orderById, focusId)
        const rightScore = focusedOrderScore(right, parentsById, childrenById, orderById, focusId)
        return leftScore - rightScore || displayName(left).localeCompare(displayName(right), 'fr')
      })
      ordered.forEach((person, index) => orderById.set(person.id, index))
      return ordered
    })
}

function walkDepth(frontier, direction, relationMap, depthById) {
  const seen = new Set(frontier)
  let current = frontier
  let depth = direction
  while (current.length) {
    const next = []
    current.forEach((id) => {
      ;(relationMap.get(id) || []).forEach((linkedId) => {
        if (seen.has(linkedId)) return
        seen.add(linkedId)
        if (!depthById.has(linkedId) || Math.abs(depth) < Math.abs(depthById.get(linkedId))) {
          depthById.set(linkedId, depth)
        }
        next.push(linkedId)
      })
    })
    current = next
    depth += direction
  }
}

function focusedOrderScore(person, parentsById, childrenById, orderById, focusId) {
  if (person.id === focusId) return -0.5
  const relatedOrders = [...(parentsById.get(person.id) || []), ...(childrenById.get(person.id) || [])]
    .map((id) => orderById.get(id))
    .filter((value) => Number.isFinite(value))
  return relatedOrders.length
    ? relatedOrders.reduce((total, value) => total + value, 0) / relatedOrders.length
    : 0
}

function relationMaps(people, edges) {
  const ids = new Set(people.map((person) => person.id))
  const parentsById = mapRelations(ids)
  const childrenById = mapRelations(ids)

  edges.forEach((edge) => {
    if (!ids.has(edge.from) || !ids.has(edge.to)) return
    parentsById.get(edge.to).push(edge.from)
    childrenById.get(edge.from).push(edge.to)
  })

  return { parentsById, childrenById }
}

function mapRelations(ids) {
  return new Map([...ids].map((id) => [id, []]))
}

function connectedComponent(focusId, parentsById, childrenById) {
  if (!focusId || !parentsById.has(focusId)) return new Set()
  const seen = new Set([focusId])
  const queue = [focusId]
  while (queue.length) {
    const id = queue.shift()
    for (const nextId of [...parentsById.get(id), ...childrenById.get(id)]) {
      if (seen.has(nextId)) continue
      seen.add(nextId)
      queue.push(nextId)
    }
  }
  return seen
}

function sortNetworkRow(row, parentsById, orderById, focusId, focusComponent, includeDisconnected) {
  return sortPeople(row).sort((left, right) => {
    const leftScore = networkOrderScore(left, parentsById, orderById, focusId, focusComponent, includeDisconnected)
    const rightScore = networkOrderScore(right, parentsById, orderById, focusId, focusComponent, includeDisconnected)
    return leftScore - rightScore || displayName(left).localeCompare(displayName(right), 'fr')
  })
}

function networkOrderScore(person, parentsById, orderById, focusId, focusComponent, includeDisconnected) {
  const parents = parentsById.get(person.id) || []
  const parentOrders = parents.map((id) => orderById.get(id)).filter((value) => Number.isFinite(value))
  const parentScore = parentOrders.length
    ? parentOrders.reduce((total, value) => total + value, 0) / parentOrders.length
    : 0
  const focusBias = person.id === focusId ? -0.5 : 0
  const componentBias = includeDisconnected && focusComponent.has(person.id) ? -1000 : 0
  return componentBias + parentScore + focusBias
}

function relationshipEdges(people) {
  const byId = new Map(people.map((person) => [person.id, person]))
  const nodeIds = new Set(people.map((person) => person.id))
  return [
    ...people.flatMap((person) => personRelationEdges(person, byId)),
    ...crossGroupEdges(people, nodeIds),
  ].filter((edge, index, edges) =>
    edges.findIndex((candidate) => edgeKey(candidate) === edgeKey(edge)) === index,
  )
}

function personRelationEdges(person, byId) {
  const classic = (person.sponsorIds || [])
    .filter((sponsorId) => byId.has(sponsorId))
    .map((sponsorId) => ({ from: sponsorId, to: person.id, kind: 'sponsor' }))
  const heart = (person.heartSponsorIds || [])
    .filter((sponsorId) => byId.has(sponsorId))
    .map((sponsorId) => ({ from: sponsorId, to: person.id, kind: 'heart' }))
  const ceremony = (person.ceremonyEvents || []).flatMap((event) => {
    const type = ceremonyRelationType(event.type)
    if (!type) return []
    return [
      ...(event.sponsorIds || [])
        .filter((sponsorId) => byId.has(sponsorId))
        .map((sponsorId) => ({ from: sponsorId, to: person.id, kind: type, eventId: event.id || '' })),
      ...(event.heartSponsorIds || [])
        .filter((sponsorId) => byId.has(sponsorId))
        .map((sponsorId) => ({ from: sponsorId, to: person.id, kind: `${type}-heart`, eventId: event.id || '' })),
    ]
  })
  return [...classic, ...heart, ...ceremony]
}

function ceremonyRelationType(type) {
  return ['adoption', 'confirmation'].includes(type) ? type : ''
}

function edgeKey(edge) {
  return `${edge.from}-${edge.to}-${edge.kind || 'sponsor'}-${edge.eventId || ''}`
}

function directSponsors(person, byId) {
  if (!person) return []
  const ids = new Set([
    ...(person.sponsorIds || []),
    ...(person.heartSponsorIds || []),
    ...(person.ceremonyEvents || []).flatMap((event) => [
      ...(event.sponsorIds || []),
      ...(event.heartSponsorIds || []),
    ]),
  ])
  return [...ids].map((id) => byId.get(id)).filter(Boolean)
}

function directFillots(people, sponsorId) {
  return people.filter((person) => personIsLinkedToSponsor(person, sponsorId))
}

function personIsLinkedToSponsor(person, sponsorId) {
  return (
    (person.sponsorIds || []).includes(sponsorId) ||
    (person.heartSponsorIds || []).includes(sponsorId) ||
    (person.ceremonyEvents || []).some((event) =>
      [...(event.sponsorIds || []), ...(event.heartSponsorIds || [])].includes(sponsorId),
    )
  )
}

function groupsByDepth(rootId, maxDepth, nextPeople) {
  const groups = []
  const seen = new Set([rootId])
  let frontier = [rootId]

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const nextById = new Map()
    frontier
      .flatMap((id) => nextPeople(id))
      .forEach((person) => {
        if (!person || seen.has(person.id) || nextById.has(person.id)) return
        nextById.set(person.id, person)
      })
    const next = [...nextById.values()]
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
  groupsByDepth(focusId, ancestorDepth, (id) => directSponsors(byId.get(id), byId))
    .flat()
    .forEach((person) => ids.add(person.id))
  groupsByDepth(focusId, descendantDepth, (id) => directFillots(people, id))
    .flat()
    .forEach((person) => ids.add(person.id))

  const focus = byId.get(focusId)
  crossGroupMembers(people, focus).forEach((person) => ids.add(person.id))
  return people.filter((person) => ids.has(person.id))
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

export function ceremonySummaries(person) {
  return (person.ceremonyEvents || []).map((event) => {
    const label = event.type === 'confirmation' ? 'Confirmation' : 'Adoption'
    const nickname = event.nickname ? ` dite ${event.nickname}` : ''
    return `${label}${nickname}${event.city ? ` · ${event.city}` : ''}`
  })
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
