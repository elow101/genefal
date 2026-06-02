import { describe, expect, it } from 'vitest'

import { planNetworkGraphPdf } from './pdfExport.js'

describe('planNetworkGraphPdf', () => {
  it('keeps a readable scale and tiles large graphs instead of shrinking everything', () => {
    const graph = makeGraph(5, 8, 320, 190)
    const plan = planNetworkGraphPdf({
      graph,
      person: graph.nodes[0],
      orientation: 'portrait',
      exportMode: 'readable',
    })

    expect(plan.scale).toBeGreaterThanOrEqual(plan.minScale)
    expect(plan.tiles.length).toBeGreaterThan(1)
    expect(tileContains(plan.tiles[0], graph.nodes[0])).toBe(true)
  })

  it('keeps compact exports on a single page', () => {
    const graph = makeGraph(5, 8, 320, 190)
    const plan = planNetworkGraphPdf({
      graph,
      person: graph.nodes[0],
      orientation: 'landscape',
      exportMode: 'compact',
    })

    expect(plan.tiles).toHaveLength(1)
    expect(plan.scale).toBeCloseTo(plan.fitScale)
    expect(tileCenter(plan.tiles[0])).toEqual({ x: graph.nodes[0].x, y: graph.nodes[0].y })
  })

  it('chooses portrait automatically unless the graph is clearly wider than tall', () => {
    const tall = planNetworkGraphPdf({
      graph: makeGraph(1, 6, 260, 190),
      orientation: 'auto',
      exportMode: 'readable',
    })
    const wide = planNetworkGraphPdf({
      graph: makeGraph(8, 1, 260, 190),
      orientation: 'auto',
      exportMode: 'readable',
    })

    expect(tall.page).toEqual({ width: 595, height: 842 })
    expect(wide.page).toEqual({ width: 842, height: 595 })
  })
})

function makeGraph(columns, rows, columnGap, rowGap) {
  const nodes = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      nodes.push({
        id: `node-${row}-${column}`,
        name: `Personne ${row}-${column}`,
        filiere: 'medecine',
        x: 120 + column * columnGap,
        y: 100 + row * rowGap,
      })
    }
  }
  return { nodes, edges: [] }
}

function tileContains(tile, node) {
  return (
    node.x >= tile.minX &&
    node.x <= tile.minX + tile.width &&
    node.y >= tile.minY &&
    node.y <= tile.minY + tile.height
  )
}

function tileCenter(tile) {
  return {
    x: tile.minX + tile.width / 2,
    y: tile.minY + tile.height / 2,
  }
}
