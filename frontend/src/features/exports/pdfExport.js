import { displayName } from '../../domain/graph.js'

export function downloadPersonNetworkPdf({ person, people, ancestorDepth = 2, descendantDepth = 2 }) {
  if (!person) return false
  const lines = buildNetworkLines(person, people, ancestorDepth, descendantDepth)
  const pdf = createTextPdf(lines)
  const blob = new Blob([pdf], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `genefaluche-${safeFilename(person.name)}.pdf`
  link.click()
  URL.revokeObjectURL(url)
  return true
}

function buildNetworkLines(person, people, ancestorDepth, descendantDepth) {
  const byId = new Map(people.map((entry) => [entry.id, entry]))
  return [
    'GeneFaluche - Export simplifie',
    `Fiche centrale : ${displayName(person)}`,
    person.genealogyName ? `Arbre : ${person.genealogyName}` : '',
    '',
    ...sectionLines('Ascendance', groupedAncestors(person.id, people, byId, ancestorDepth)),
    '',
    ...sectionLines('Descendance / fillots', groupedDescendants(person.id, people, descendantDepth)),
  ].filter((line) => line !== null)
}

function sectionLines(title, groups) {
  if (!groups.length) return [title, '  Aucun lien renseigne.']
  return [
    title,
    ...groups.flatMap((group, index) => [
      `  Generation ${index + 1}`,
      ...group.map((person) => `    - ${displayName(person)}${person.genealogyName ? ` (${person.genealogyName})` : ''}`),
    ]),
  ]
}

function groupedAncestors(rootId, people, byId, maxDepth) {
  return groupsByDepth(rootId, maxDepth, (id) => directSponsors(byId.get(id), byId))
}

function groupedDescendants(rootId, people, maxDepth) {
  return groupsByDepth(rootId, maxDepth, (id) =>
    people.filter((person) => personIsLinkedToSponsor(person, id)),
  )
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
    groups.push(next.sort((a, b) => displayName(a).localeCompare(displayName(b), 'fr')))
    frontier = next.map((person) => person.id)
  }
  return groups
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

function personIsLinkedToSponsor(person, sponsorId) {
  return (
    (person.sponsorIds || []).includes(sponsorId) ||
    (person.heartSponsorIds || []).includes(sponsorId) ||
    (person.ceremonyEvents || []).some((event) =>
      [...(event.sponsorIds || []), ...(event.heartSponsorIds || [])].includes(sponsorId),
    )
  )
}

function createTextPdf(rawLines) {
  const lines = rawLines.flatMap((line) => wrapText(ascii(line || ''), 88))
  const pages = chunk(lines, 42)
  const objects = []
  const pageRefs = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push('')

  pages.forEach((pageLines, index) => {
    const pageObjectNumber = 3 + index * 2
    const contentObjectNumber = pageObjectNumber + 1
    pageRefs.push(`${pageObjectNumber} 0 R`)
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`)
    const content = pageContent(pageLines)
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })

  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  return assemblePdf(objects)
}

function pageContent(lines) {
  return [
    'BT',
    '/F1 11 Tf',
    '50 790 Td',
    '14 TL',
    ...lines.map((line) => `(${pdfEscape(line)}) Tj T*`),
    'ET',
  ].join('\n')
}

function assemblePdf(objects) {
  const parts = ['%PDF-1.4\n']
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(parts.join('').length)
    parts.push(`${index + 1} 0 obj\n${object}\nendobj\n`)
  })
  const xrefOffset = parts.join('').length
  parts.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`)
  offsets.slice(1).forEach((offset) => {
    parts.push(`${String(offset).padStart(10, '0')} 00000 n \n`)
  })
  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)
  return parts.join('')
}

function wrapText(text, length) {
  if (text.length <= length) return [text]
  const words = text.split(' ')
  const lines = []
  let current = ''
  words.forEach((word) => {
    if (`${current} ${word}`.trim().length > length) {
      lines.push(current)
      current = word
      return
    }
    current = `${current} ${word}`.trim()
  })
  if (current) lines.push(current)
  return lines
}

function chunk(items, size) {
  const pages = []
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size))
  }
  return pages.length ? pages : [[]]
}

function pdfEscape(value) {
  return String(value).replace(/[()]/g, '$&')
}

function ascii(value) {
  return String(value)
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'OE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
}

function safeFilename(value) {
  return ascii(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'reseau'
}
