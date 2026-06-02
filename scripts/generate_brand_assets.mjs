import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const outDir = path.resolve('frontend/public')
const rootDir = path.resolve('.')
fs.mkdirSync(outDir, { recursive: true })

const cyan = [0, 190, 245, 255]
const white = [255, 255, 255, 255]
const navy = [1, 18, 54, 255]

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const chunk = Buffer.alloc(8 + data.length + 4)
  chunk.writeUInt32BE(data.length, 0)
  typeBuffer.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length)
  return chunk
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function encodePng(width, height, rgba) {
  const scanlineLength = width * 4 + 1
  const raw = Buffer.alloc(scanlineLength * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * scanlineLength] = 0
    rgba.copy(raw, y * scanlineLength + 1, y * width * 4, (y + 1) * width * 4)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function blendPixel(data, width, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= width || y >= data.length / 4 / width) return
  const index = (Math.floor(y) * width + Math.floor(x)) * 4
  const a = Math.max(0, Math.min(1, alpha)) * (color[3] / 255)
  for (let channel = 0; channel < 3; channel += 1) {
    data[index + channel] = Math.round(color[channel] * a + data[index + channel] * (1 - a))
  }
  data[index + 3] = 255
}

function roundedRectMask(x, y, left, top, right, bottom, radius) {
  const insideX = x >= left + radius && x <= right - radius && y >= top && y <= bottom
  const insideY = x >= left && x <= right && y >= top + radius && y <= bottom - radius
  if (insideX || insideY) return true
  const cx = x < left + radius ? left + radius : right - radius
  const cy = y < top + radius ? top + radius : bottom - radius
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

function renderLogo(width, height, { social = false } = {}) {
  const scale = 4
  const w = width * scale
  const h = height * scale
  const data = Buffer.alloc(w * h * 4)

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const nx = x / w - 0.5
      const ny = y / h - 0.5
      const glow = Math.max(0, 1 - Math.hypot(nx * 1.2, ny * 1.05) * 1.55)
      const index = (y * w + x) * 4
      data[index] = Math.round(navy[0] + glow * 8)
      data[index + 1] = Math.round(navy[1] + glow * 14)
      data[index + 2] = Math.round(navy[2] + glow * 32)
      data[index + 3] = 255
    }
  }

  const unit = Math.min(w, h)
  const logoScale = social ? 0.72 : 1
  const offsetX = 0
  const cx = w * 0.46 + offsetX
  const cy = h * 0.36
  const rOuter = unit * 0.265 * logoScale
  const rInner = unit * 0.185 * logoScale
  const gapStart = -50 * Math.PI / 180
  const gapEnd = 8 * Math.PI / 180

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x - cx
      const dy = y - cy
      const distance = Math.hypot(dx, dy)
      let angle = Math.atan2(dy, dx)
      if (angle < -Math.PI / 2) angle += Math.PI * 2
      const inGap = angle >= gapStart && angle <= gapEnd
      const inRing = distance >= rInner && distance <= rOuter && !inGap
      const inBar = roundedRectMask(x, y, cx - unit * 0.035, cy - unit * 0.04, cx + unit * 0.23, cy + unit * 0.055, unit * 0.005)
      if (inRing || inBar) blendPixel(data, w, x, y, cyan)
    }
  }

  const stemX = w * 0.51 + offsetX
  const stemTop = h * 0.32
  const stemBottom = h * 0.72
  const stemWidth = unit * 0.075 * logoScale
  const barHeight = unit * 0.06 * logoScale
  const topY = h * 0.32
  const midY = h * 0.455
  const branchY = h * 0.62
  const leftX = w * 0.29 + offsetX
  const rightX = w * 0.73 + offsetX
  const endRadius = unit * 0.035 * logoScale

  drawRoundedRect(data, w, stemX - stemWidth / 2, stemTop, stemX + stemWidth / 2, stemBottom, unit * 0.01, white)
  drawRoundedRect(data, w, stemX - stemWidth / 2, topY, rightX, topY + barHeight, barHeight / 2, white)
  drawRoundedRect(data, w, stemX - stemWidth / 2, midY, rightX - unit * 0.035, midY + barHeight, barHeight / 2, white)
  drawRoundedRect(data, w, leftX, branchY, rightX, branchY + unit * 0.035, unit * 0.016, white)
  drawRoundedRect(data, w, leftX, branchY, leftX + unit * 0.035, h * 0.73, unit * 0.016, white)
  drawRoundedRect(data, w, stemX - unit * 0.017, branchY, stemX + unit * 0.018, h * 0.74, unit * 0.016, white)
  drawRoundedRect(data, w, rightX - unit * 0.035, branchY, rightX, h * 0.73, unit * 0.016, white)

  for (const [cxNode, cyNode] of [[leftX + unit * 0.0175, h * 0.76], [stemX, h * 0.76], [rightX - unit * 0.0175, h * 0.76]]) {
    drawCircle(data, w, cxNode, cyNode, endRadius, white)
    drawCircle(data, w, cxNode, cyNode, endRadius * 0.58, cyan)
  }

  return encodePng(width, height, downsample(data, w, h, scale))
}

function drawRoundedRect(data, width, left, top, right, bottom, radius, color) {
  const minX = Math.max(0, Math.floor(left - 1))
  const maxX = Math.min(width - 1, Math.ceil(right + 1))
  const maxY = Math.min(data.length / 4 / width - 1, Math.ceil(bottom + 1))
  for (let y = Math.max(0, Math.floor(top - 1)); y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (roundedRectMask(x, y, left, top, right, bottom, radius)) blendPixel(data, width, x, y, color)
    }
  }
}

function drawCircle(data, width, cx, cy, radius, color) {
  const minX = Math.floor(cx - radius)
  const maxX = Math.ceil(cx + radius)
  const minY = Math.floor(cy - radius)
  const maxY = Math.ceil(cy + radius)
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) blendPixel(data, width, x, y, color)
    }
  }
}

function downsample(data, width, height, scale) {
  const outWidth = width / scale
  const outHeight = height / scale
  const out = Buffer.alloc(outWidth * outHeight * 4)
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const totals = [0, 0, 0, 0]
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const index = ((y * scale + sy) * width + x * scale + sx) * 4
          totals[0] += data[index]
          totals[1] += data[index + 1]
          totals[2] += data[index + 2]
          totals[3] += data[index + 3]
        }
      }
      const outIndex = (y * outWidth + x) * 4
      out[outIndex] = Math.round(totals[0] / (scale * scale))
      out[outIndex + 1] = Math.round(totals[1] / (scale * scale))
      out[outIndex + 2] = Math.round(totals[2] / (scale * scale))
      out[outIndex + 3] = Math.round(totals[3] / (scale * scale))
    }
  }
  return out
}

function writeIco(filePath, pngBuffers) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngBuffers.length, 4)
  const directory = Buffer.alloc(16 * pngBuffers.length)
  let offset = 6 + directory.length
  pngBuffers.forEach(({ size, buffer }, index) => {
    const base = index * 16
    directory[base] = size >= 256 ? 0 : size
    directory[base + 1] = size >= 256 ? 0 : size
    directory[base + 2] = 0
    directory[base + 3] = 0
    directory.writeUInt16LE(1, base + 4)
    directory.writeUInt16LE(32, base + 6)
    directory.writeUInt32LE(buffer.length, base + 8)
    directory.writeUInt32LE(offset, base + 12)
    offset += buffer.length
  })
  fs.writeFileSync(filePath, Buffer.concat([header, directory, ...pngBuffers.map((entry) => entry.buffer)]))
}

const favicon32 = renderLogo(32, 32)
const favicon192 = renderLogo(192, 192)
const appleTouch = renderLogo(180, 180)
const ogImage = renderLogo(1200, 630, { social: true })

fs.writeFileSync(path.join(outDir, 'favicon-32x32.png'), favicon32)
fs.writeFileSync(path.join(outDir, 'favicon-192x192.png'), favicon192)
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), appleTouch)
fs.writeFileSync(path.join(outDir, 'og-image.png'), ogImage)
writeIco(path.join(outDir, 'favicon.ico'), [
  { size: 32, buffer: favicon32 },
  { size: 192, buffer: favicon192 },
])

fs.writeFileSync(
  path.join(outDir, 'site.webmanifest'),
  `${JSON.stringify(
    {
      name: 'GeneFaluche',
      short_name: 'GeneFaluche',
      icons: [
        { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
      theme_color: '#011236',
      background_color: '#011236',
      display: 'standalone',
    },
    null,
    2,
  )}\n`,
)

for (const fileName of [
  'favicon.ico',
  'favicon-32x32.png',
  'favicon-192x192.png',
  'apple-touch-icon.png',
  'og-image.png',
  'site.webmanifest',
]) {
  fs.copyFileSync(path.join(outDir, fileName), path.join(rootDir, fileName))
}
