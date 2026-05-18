import { describe, expect, it } from 'vitest'
import { buildGraphModel } from './graph.js'

describe('buildGraphModel', () => {
  it('places descendants on later generations', () => {
    const graph = buildGraphModel([
      { id: 'a', name: 'Alice', sponsorIds: [] },
      { id: 'b', name: 'Bob', sponsorIds: ['a'] },
    ], { focusId: 'a' })

    const alice = graph.nodes.find((node) => node.id === 'a')
    const bob = graph.nodes.find((node) => node.id === 'b')

    expect(alice.generation).toBeLessThan(bob.generation)
    expect(bob.y).toBeGreaterThan(alice.y)
  })
})
