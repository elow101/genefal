import { filiereAccent, filiereLabel } from '../../domain/filiere.js'

const PAGE_SIZES = {
  portrait: { width: 595, height: 842 },
  landscape: { width: 842, height: 595 },
}
const PDF_MARGIN = 18
const CARD_WIDTH = 196
const CARD_HEIGHT = 108
const CONTENT_PADDING = 34
const PDF_LOGO_SRC = '/favicon-192x192.png'
const PDF_LOGO_SIZE = 38
const AUTO_LANDSCAPE_RATIO = 1.18
const MAX_EXPORT_SCALE = 1.16
const MIN_READABLE_CARD_WIDTH = 116
const MIN_COMPACT_CARD_WIDTH = 70

export async function downloadNetworkGraphPdf({
  person,
  graph,
  title = 'GeneFaluche',
  orientation = 'auto',
  exportMode = 'readable',
}) {
  if (!person || !graph?.nodes?.length) return false

  const plan = planNetworkGraphPdf({ graph, person, orientation, exportMode })
  const logo = await loadPdfLogo()
  const pdf = createVectorPdf({ graph, title, plan, logo })
  const url = URL.createObjectURL(pdf)
  const link = document.createElement('a')
  link.href = url
  link.download = `genefaluche-reseau-${safeFilename(person.name)}.pdf`
  link.click()
  URL.revokeObjectURL(url)
  return true
}

export function planNetworkGraphPdf({ graph, person = null, orientation = 'auto', exportMode = 'readable' }) {
  const focusNode = graph.nodes.find((node) => node.id === person?.id) || graph.nodes[0] || null
  const contentBounds = networkBounds(graph)
  const page = resolvePage(contentBounds, orientation)
  const usableWidth = page.width - PDF_MARGIN * 2
  const usableHeight = page.height - PDF_MARGIN * 2
  const fitBounds = exportMode === 'compact' ? centeredBounds(contentBounds, focusNode, usableWidth / usableHeight) : contentBounds
  const fitScale = Math.min(usableWidth / fitBounds.width, usableHeight / fitBounds.height)
  const minCardWidth = exportMode === 'compact' ? MIN_COMPACT_CARD_WIDTH : MIN_READABLE_CARD_WIDTH
  const minimumReadableScale = minCardWidth / CARD_WIDTH
  const scale =
    exportMode === 'compact'
      ? Math.min(MAX_EXPORT_SCALE, fitScale)
      : Math.min(MAX_EXPORT_SCALE, Math.max(fitScale, minimumReadableScale))

  const tileWidth = usableWidth / scale
  const tileHeight = usableHeight / scale
  const tiles =
    exportMode === 'compact'
      ? [fitBounds]
      : gridTilesAroundFocus(contentBounds, focusNode, tileWidth, tileHeight)

  return {
    bounds: contentBounds,
    page,
    margin: PDF_MARGIN,
    scale,
    fitScale,
    minScale: minimumReadableScale,
    tiles: tiles.map((tile, index) => ({ ...tile, index: index + 1 })),
  }
}

function resolvePage(bounds, orientation) {
  if (orientation === 'portrait' || orientation === 'landscape') return PAGE_SIZES[orientation]
  return bounds.width / bounds.height > AUTO_LANDSCAPE_RATIO ? PAGE_SIZES.landscape : PAGE_SIZES.portrait
}

function gridTilesAroundFocus(bounds, focusNode, tileWidth, tileHeight) {
  if (bounds.width <= tileWidth && bounds.height <= tileHeight) {
    return [centeredTile(bounds, focusNode, tileWidth, tileHeight)]
  }

  const columns = Math.max(1, Math.ceil(bounds.width / tileWidth))
  const rows = Math.max(1, Math.ceil(bounds.height / tileHeight))
  const startX = tileAxisStart(bounds.minX, bounds.width, tileWidth, columns, focusNode?.x)
  const startY = tileAxisStart(bounds.minY, bounds.height, tileHeight, rows, focusNode?.y)
  const tiles = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      tiles.push({
        minX: startX + column * tileWidth,
        minY: startY + row * tileHeight,
        width: tileWidth,
        height: tileHeight,
      })
    }
  }
  return tiles.sort((left, right) => tileDistance(left, focusNode) - tileDistance(right, focusNode))
}

function centeredTile(bounds, focusNode, tileWidth, tileHeight) {
  if (!focusNode) return { ...bounds }
  const width = Math.min(tileWidth, bounds.width)
  const height = Math.min(tileHeight, bounds.height)
  return {
    minX: clamp(focusNode.x - width / 2, bounds.minX, bounds.minX + bounds.width - width),
    minY: clamp(focusNode.y - height / 2, bounds.minY, bounds.minY + bounds.height - height),
    width,
    height,
  }
}

function centeredBounds(bounds, focusNode, pageRatio) {
  if (!focusNode) return bounds
  const centeredWidth = Math.max(
    bounds.width,
    Math.abs(focusNode.x - bounds.minX) * 2,
    Math.abs(bounds.minX + bounds.width - focusNode.x) * 2,
  )
  const centeredHeight = Math.max(
    bounds.height,
    Math.abs(focusNode.y - bounds.minY) * 2,
    Math.abs(bounds.minY + bounds.height - focusNode.y) * 2,
  )
  const width = Math.max(centeredWidth, centeredHeight * pageRatio)
  const height = Math.max(centeredHeight, width / pageRatio)
  return {
    minX: focusNode.x - width / 2,
    minY: focusNode.y - height / 2,
    width,
    height,
  }
}

function tileAxisStart(min, size, tileSize, tileCount, focusPosition) {
  if (!Number.isFinite(focusPosition)) return min
  const totalSize = tileCount * tileSize
  const centeredStart = focusPosition - totalSize / 2
  return clamp(centeredStart, min + size - totalSize, min)
}

function tileDistance(tile, focusNode) {
  if (!focusNode) return 0
  const centerX = tile.minX + tile.width / 2
  const centerY = tile.minY + tile.height / 2
  return Math.hypot(centerX - focusNode.x, centerY - focusNode.y)
}

async function loadPdfLogo() {
  try {
    const image = await loadImage(PDF_LOGO_SRC)
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    context.fillStyle = '#011236'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    return {
      bytes: dataUrlBytes(dataUrl),
      width: canvas.width,
      height: canvas.height,
    }
  } catch {
    return null
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function createVectorPdf({ graph, title, plan, logo = null }) {
  const hasLogo = Boolean(logo)
  const firstPageObjectId = hasLogo ? 6 : 5
  const pageContents = plan.tiles.map((tile) =>
    vectorPageContent({ graph, title, plan, tile, hasLogo }),
  )
  const objects = [
    textObject('<< /Type /Catalog /Pages 2 0 R >>'),
    textObject(`<< /Type /Pages /Kids [${pageContents.map((_, index) => `${firstPageObjectId + index * 2} 0 R`).join(' ')}] /Count ${pageContents.length} >>`),
    textObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    textObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'),
  ]

  if (hasLogo) {
    objects.push(
      binaryObject(
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`,
        logo.bytes,
        '\nendstream',
      ),
    )
  }

  pageContents.forEach((content, index) => {
    const pageObjectId = firstPageObjectId + index * 2
    const contentObjectId = pageObjectId + 1
    const xObjects = hasLogo ? ' /XObject << /Logo 5 0 R >>' : ''
    objects.push(
      textObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${plan.page.width} ${plan.page.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xObjects} >> /Contents ${contentObjectId} 0 R >>`),
      textObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
    )
  })

  return assemblePdf(objects)
}

function vectorPageContent({ graph, title, plan, tile, hasLogo }) {
  const commands = [
    'q',
    '1 1 1 rg',
    `0 0 ${plan.page.width} ${plan.page.height} re f`,
  ]
  const map = pageMapper(plan, tile)
  drawVectorEdges(commands, graph, tile, map)
  graph.nodes.forEach((person) => {
    if (rectIntersectsTile(person.x - CARD_WIDTH / 2, cardY(person), CARD_WIDTH, CARD_HEIGHT, tile)) {
      drawVectorCard(commands, person, map)
    }
  })
  drawVectorHeader(commands, title, tile.index, plan.tiles.length, plan.page, hasLogo)
  commands.push('Q')
  return commands.join('\n')
}

function pageMapper(plan, tile) {
  const xOffset = (plan.page.width - tile.width * plan.scale) / 2
  const yOffset = (plan.page.height - tile.height * plan.scale) / 2
  return {
    x: (value) => xOffset + (value - tile.minX) * plan.scale,
    y: (value) => plan.page.height - yOffset - (value - tile.minY) * plan.scale,
    length: (value) => value * plan.scale,
  }
}

function drawVectorHeader(commands, title, pageNumber, pageCount, page, hasLogo) {
  const logoX = page.width - PDF_LOGO_SIZE - 18
  const logoY = page.height - PDF_LOGO_SIZE - 14
  commands.push(
    '0.96 0.97 0.96 rg',
    '0.72 0.76 0.74 RG',
    `18 ${page.height - 48} 250 30 re B`,
    pdfText(ascii(title), 26, page.height - 29, 12, true, '#15201d'),
    pdfText(pageCount > 1 ? `Page ${pageNumber}/${pageCount}` : 'Export PDF', 26, page.height - 43, 9, false, '#495550'),
  )

  if (hasLogo) {
    commands.push(
      'q',
      `${PDF_LOGO_SIZE} 0 0 ${PDF_LOGO_SIZE} ${logoX} ${logoY} cm`,
      '/Logo Do',
      'Q',
    )
    return
  }

  commands.push(
    '0.01 0.07 0.21 rg',
    `${logoX} ${logoY} ${PDF_LOGO_SIZE} ${PDF_LOGO_SIZE} re f`,
    pdfText('GF', logoX + 9, logoY + 16, 10, true, '#00bef5'),
  )
}

function drawVectorEdges(commands, graph, tile, map) {
  const nodes = new Map(graph.nodes.map((entry) => [entry.id, entry]))
  graph.edges.forEach((edge) => {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (!from || !to) return
    if (!lineIntersectsTile(from.x, cardY(from) + CARD_HEIGHT, to.x, cardY(to), tile)) return
    const style = edgeStyle(edge.kind)
    const color = pdfColor(style.color)
    commands.push(
      `${color} RG`,
      `${Math.max(0.8, style.width * map.length(1)).toFixed(2)} w`,
      style.dash.length ? `[${style.dash.map((value) => map.length(value).toFixed(2)).join(' ')}] 0 d` : '[] 0 d',
      `${map.x(from.x).toFixed(2)} ${map.y(cardY(from) + CARD_HEIGHT).toFixed(2)} m`,
      `${map.x(to.x).toFixed(2)} ${map.y(cardY(to)).toFixed(2)} l S`,
    )
  })
  commands.push('[] 0 d')
}

function drawVectorCard(commands, person, map) {
  const x = person.x - CARD_WIDTH / 2
  const y = cardY(person)
  const px = map.x(x)
  const py = map.y(y + CARD_HEIGHT)
  const width = map.length(CARD_WIDTH)
  const height = map.length(CARD_HEIGHT)
  const accent = pdfColor(filiereAccent(person.filiere) || '#5e6964')
  commands.push(
    '1 1 1 rg',
    '0.55 0.60 0.58 RG',
    '1.2 w',
    `${px.toFixed(2)} ${py.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re B`,
    `${accent} rg`,
    `${px.toFixed(2)} ${py.toFixed(2)} ${map.length(8).toFixed(2)} ${height.toFixed(2)} re f`,
  )

  const centerX = map.x(person.x)
  const topY = map.y(y)
  const nameLines = wrapPdfText(ascii(networkMainName(person)), 22)
  nameLines.slice(0, 2).forEach((line, index) => {
    commands.push(pdfText(line, centerX - estimatedTextWidth(line, 10.8) / 2, topY - map.length(23 + index * 17), 10.8, true, '#101816'))
  })

  const details = [
    person.nickname || '',
    filiereLabel(person.filiere, person.filiereCustom) || 'Filiere non renseignee',
    person.baptismDate ? `Bapteme : ${person.baptismDate}` : '',
    person.genealogyName || '',
  ].filter(Boolean)
  details.slice(0, 4).forEach((line, index) => {
    const clipped = clipPdfText(ascii(line), 28)
    commands.push(pdfText(clipped, centerX - estimatedTextWidth(clipped, 8.8) / 2, topY - map.length(61 + index * 14), 8.8, false, '#25302d'))
  })
}

function pdfText(text, x, y, size, bold = false, color = '#000000') {
  return `${pdfColor(color)} rg\nBT /${bold ? 'F2' : 'F1'} ${size.toFixed(1)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`
}

function pdfColor(value) {
  const hex = String(value || '#000000').match(/^#?([0-9a-f]{6})$/i)?.[1] || '000000'
  const red = parseInt(hex.slice(0, 2), 16) / 255
  const green = parseInt(hex.slice(2, 4), 16) / 255
  const blue = parseInt(hex.slice(4, 6), 16) / 255
  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)}`
}

function escapePdfText(value) {
  return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapPdfText(value, maxChars) {
  const words = String(value).split(' ')
  const lines = []
  let line = ''
  words.forEach((word) => {
    const next = `${line} ${word}`.trim()
    if (next.length > maxChars && line) {
      lines.push(line)
      line = word
      return
    }
    line = next
  })
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function clipPdfText(value, maxChars) {
  const text = String(value)
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 3))}...`
}

function estimatedTextWidth(value, size) {
  return String(value).length * size * 0.48
}

function rectIntersectsTile(x, y, width, height, tile) {
  return x + width >= tile.minX && x <= tile.minX + tile.width && y + height >= tile.minY && y <= tile.minY + tile.height
}

function lineIntersectsTile(fromX, fromY, toX, toY, tile) {
  const minX = Math.min(fromX, toX)
  const maxX = Math.max(fromX, toX)
  const minY = Math.min(fromY, toY)
  const maxY = Math.max(fromY, toY)
  return rectIntersectsTile(minX, minY, maxX - minX, maxY - minY, tile)
}

function networkBounds(graph) {
  const minNodeX = Math.min(...graph.nodes.map((entry) => entry.x - CARD_WIDTH / 2))
  const maxNodeX = Math.max(...graph.nodes.map((entry) => entry.x + CARD_WIDTH / 2))
  const minNodeY = Math.min(...graph.nodes.map((entry) => cardY(entry)))
  const maxNodeY = Math.max(...graph.nodes.map((entry) => cardY(entry) + CARD_HEIGHT))
  const minX = minNodeX - CONTENT_PADDING
  const minY = minNodeY - CONTENT_PADDING
  const maxX = maxNodeX + CONTENT_PADDING
  const maxY = maxNodeY + CONTENT_PADDING
  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

function edgeStyle(kind = 'sponsor') {
  if (kind.includes('adoption')) return { color: '#9a5d12', width: 2.3, dash: kind.includes('heart') ? [8, 5] : [] }
  if (kind.includes('confirmation')) return { color: '#5b4bc4', width: 2.3, dash: kind.includes('heart') ? [8, 5] : [] }
  if (kind === 'heart') return { color: '#b62f5a', width: 2.4, dash: [8, 5] }
  if (kind === 'cross') return { color: '#22c55e', width: 2.1, dash: [5, 5] }
  return { color: '#087681', width: 2.3, dash: [] }
}

function cardY(person) {
  return person.y - CARD_HEIGHT / 2
}

function networkMainName(person) {
  return `${person.name || 'Sans nom'}${person.nickname ? ' dit' : ''}`
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
  return { parts: [prefixBytes, bytes, suffixBytes], length: prefixBytes.length + bytes.length + suffixBytes.length }
}

function asciiBytes(value) {
  return Uint8Array.from(String(value), (char) => char.charCodeAt(0))
}

function dataUrlBytes(value) {
  return Uint8Array.from(atob(String(value).split(',')[1] || ''), (char) => char.charCodeAt(0))
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
