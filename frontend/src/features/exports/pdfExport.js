import { filiereAccent, filiereLabel } from '../../domain/filiere.js'

const PDF_WIDTH = 842
const PDF_HEIGHT = 595
const PDF_MARGIN = 28
const CARD_WIDTH = 172
const CARD_HEIGHT = 90
const CARD_RADIUS = 8
const PAGE_PADDING = 70

export async function downloadNetworkGraphPdf({ person, graph, title = 'GeneFaluche' }) {
  if (!person || !graph?.nodes?.length) return false

  const canvas = renderNetworkGraphCanvas({ graph, title })
  const jpeg = canvas.toDataURL('image/jpeg', 0.9)
  const pdf = createImagePdf(jpeg, canvas.width, canvas.height)
  const url = URL.createObjectURL(pdf)
  const link = document.createElement('a')
  link.href = url
  link.download = `genefaluche-reseau-${safeFilename(person.name)}.pdf`
  link.click()
  URL.revokeObjectURL(url)
  return true
}

function renderNetworkGraphCanvas({ graph, title }) {
  const bounds = networkBounds(graph)
  const rasterScale = Math.min(1.6, 2200 / Math.max(bounds.width, bounds.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(bounds.width * rasterScale)
  canvas.height = Math.ceil(bounds.height * rasterScale)

  const context = canvas.getContext('2d')
  context.scale(rasterScale, rasterScale)
  context.translate(-bounds.minX, -bounds.minY)
  context.fillStyle = '#f8faf8'
  context.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height)

  drawTitle(context, title, bounds)
  drawEdges(context, graph)
  graph.nodes.forEach((entry) => drawCard(context, entry))
  return canvas
}

function networkBounds(graph) {
  const minNodeX = Math.min(...graph.nodes.map((entry) => entry.x - CARD_WIDTH / 2))
  const maxNodeX = Math.max(...graph.nodes.map((entry) => entry.x + CARD_WIDTH / 2))
  const minNodeY = Math.min(...graph.nodes.map((entry) => entry.y - CARD_HEIGHT / 2))
  const maxNodeY = Math.max(...graph.nodes.map((entry) => entry.y + CARD_HEIGHT / 2))
  const minX = Math.min(0, minNodeX) - PAGE_PADDING
  const minY = Math.min(0, minNodeY) - PAGE_PADDING
  const maxX = Math.max(graph.width || 0, maxNodeX) + PAGE_PADDING
  const maxY = Math.max(graph.height || 0, maxNodeY) + PAGE_PADDING
  return {
    minX,
    minY,
    width: Math.max(760, maxX - minX),
    height: Math.max(520, maxY - minY),
  }
}

function drawTitle(context, title, bounds) {
  context.fillStyle = '#17201d'
  context.font = '700 28px Arial'
  context.textAlign = 'left'
  context.fillText(ascii(`${title} - Réseau`), bounds.minX + 34, bounds.minY + 40)
  context.fillStyle = '#4f5b57'
  context.font = '15px Arial'
  context.fillText('Export graphique imprimable des fiches et relations', bounds.minX + 34, bounds.minY + 64)
}

function drawEdges(context, graph) {
  const nodes = new Map(graph.nodes.map((entry) => [entry.id, entry]))
  graph.edges.forEach((edge) => {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (!from || !to) return
    const style = edgeStyle(edge.kind)
    const fromY = from.y + 46
    const toY = to.y - 34
    context.save()
    context.strokeStyle = style.color
    context.fillStyle = style.color
    context.lineWidth = style.width
    context.setLineDash(style.dash)
    context.beginPath()
    context.moveTo(from.x, fromY)
    context.lineTo(to.x, toY)
    context.stroke()
    context.setLineDash([])
    if (edge.kind !== 'cross') drawArrowHead(context, from.x, fromY, to.x, toY, style.color)
    context.restore()
  })
}

function edgeStyle(kind = 'sponsor') {
  if (kind.includes('adoption')) return { color: '#b7791f', width: 1.9, dash: kind.includes('heart') ? [7, 5] : [] }
  if (kind.includes('confirmation')) return { color: '#6d5bd0', width: 1.9, dash: kind.includes('heart') ? [7, 5] : [] }
  if (kind === 'heart') return { color: '#c43f6b', width: 2, dash: [7, 5] }
  if (kind === 'cross') return { color: '#66706c', width: 1.8, dash: [4, 5] }
  return { color: '#0f7f89', width: 1.9, dash: [] }
}

function drawArrowHead(context, fromX, fromY, toX, toY, color) {
  const angle = Math.atan2(toY - fromY, toX - fromX)
  const size = 8
  context.fillStyle = color
  context.beginPath()
  context.moveTo(toX, toY)
  context.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6))
  context.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6))
  context.closePath()
  context.fill()
}

function drawCard(context, person) {
  const x = person.x - CARD_WIDTH / 2
  const y = person.y - 34
  const accent = filiereAccent(person.filiere) || '#7b8580'
  roundRect(context, x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, '#ffffff', '#c8d0cc')
  context.fillStyle = accent
  context.fillRect(x, y, 6, CARD_HEIGHT)

  context.fillStyle = '#17201d'
  context.font = '700 13px Arial'
  context.textAlign = 'center'
  wrapCenteredText(context, ascii(networkMainName(person)), person.x, y + 22, CARD_WIDTH - 22, 15, 2)

  context.fillStyle = '#4f5b57'
  context.font = '11px Arial'
  const details = [
    person.nickname || '',
    filiereLabel(person.filiere) || 'Filiere non renseignee',
    person.baptismDate ? `Bapteme : ${person.baptismDate}` : '',
  ].filter(Boolean)
  details.slice(0, 3).forEach((line, index) => {
    context.fillText(clipText(context, ascii(line), CARD_WIDTH - 22), person.x, y + 54 + index * 13)
  })
}

function networkMainName(person) {
  return `${person.name || 'Sans nom'}${person.nickname ? ' dit' : ''}`
}

function roundRect(context, x, y, width, height, radius, fill, stroke) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
  context.fillStyle = fill
  context.fill()
  context.strokeStyle = stroke
  context.stroke()
}

function wrapCenteredText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text).split(' ')
  let line = ''
  let lineCount = 0
  words.forEach((word) => {
    if (lineCount >= maxLines) return
    const next = `${line} ${word}`.trim()
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(clipText(context, line, maxWidth), x, y + lineCount * lineHeight)
      line = word
      lineCount += 1
      return
    }
    line = next
  })
  if (line && lineCount < maxLines) context.fillText(clipText(context, line, maxWidth), x, y + lineCount * lineHeight)
}

function clipText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text
  let clipped = text
  while (clipped.length > 1 && context.measureText(`${clipped}...`).width > maxWidth) clipped = clipped.slice(0, -1)
  return `${clipped}...`
}

function createImagePdf(dataUrl, imageWidth, imageHeight) {
  const imageBytes = binaryStringToBytes(atob(dataUrl.split(',')[1]))
  const drawableWidth = PDF_WIDTH - PDF_MARGIN * 2
  const drawableHeight = PDF_HEIGHT - PDF_MARGIN * 2
  const scale = Math.min(drawableWidth / imageWidth, drawableHeight / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  const x = (PDF_WIDTH - width) / 2
  const y = (PDF_HEIGHT - height) / 2
  const content = `q\n${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im1 Do\nQ`
  return assemblePdf([
    textObject('<< /Type /Catalog /Pages 2 0 R >>'),
    textObject('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    textObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>`),
    textObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
    binaryObject(
      `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
      imageBytes,
      '\nendstream',
    ),
  ])
}

function assemblePdf(objects) {
  const parts = [asciiBytes('%PDF-1.4\n')]
  const offsets = [0]
  let byteLength = parts[0].length
  objects.forEach((object, index) => {
    offsets.push(byteLength)
    const prefix = asciiBytes(`${index + 1} 0 obj\n`)
    const suffix = asciiBytes('\nendobj\n')
    parts.push(prefix, ...object.parts, suffix)
    byteLength += prefix.length + object.length + suffix.length
  })
  const xrefOffset = byteLength
  parts.push(asciiBytes(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`))
  offsets.slice(1).forEach((offset) => {
    parts.push(asciiBytes(`${String(offset).padStart(10, '0')} 00000 n \n`))
  })
  parts.push(asciiBytes(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`))
  return new Blob(parts, { type: 'application/pdf' })
}

function textObject(value) {
  const bytes = asciiBytes(value)
  return { parts: [bytes], length: bytes.length }
}

function binaryObject(prefix, bytes, suffix) {
  const prefixBytes = asciiBytes(prefix)
  const suffixBytes = asciiBytes(suffix)
  return { parts: [prefixBytes, bytes, asciiBytes(suffix)], length: prefixBytes.length + bytes.length + suffixBytes.length }
}

function asciiBytes(value) {
  return Uint8Array.from(String(value), (char) => char.charCodeAt(0))
}

function binaryStringToBytes(value) {
  return Uint8Array.from(value, (char) => char.charCodeAt(0))
}

function ascii(value) {
  return String(value || '')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'OE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
}

function safeFilename(value) {
  return ascii(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'reseau'
}
