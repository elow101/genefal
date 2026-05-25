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

  it('deduplicates descendants reached by multiple paths in the same view', () => {
    const graph = buildGraphModel([
      { id: 'a', name: 'Alice', sponsorIds: [] },
      { id: 'b', name: 'Bob', sponsorIds: ['a'] },
      { id: 'c', name: 'Camille', sponsorIds: ['a'] },
      { id: 'd', name: 'Dana', sponsorIds: ['b', 'c'] },
    ], { focusId: 'a', mode: 'tree' })

    expect(graph.nodes.filter((node) => node.id === 'd')).toHaveLength(1)
    expect(graph.edges.filter((edge) => edge.to === 'd').map((edge) => edge.from).sort()).toEqual(['b', 'c'])
  })

  it('draws adoption and confirmation edges in the network', () => {
    const graph = buildGraphModel([
      { id: 'a', name: 'Alice', sponsorIds: [] },
      {
        id: 'b',
        name: 'Bob',
        sponsorIds: [],
        ceremonyEvents: [
          { id: 'adoption-1', type: 'adoption', city: 'Lille', sponsorIds: ['a'] },
          { id: 'confirmation-1', type: 'confirmation', city: 'Lyon', heartSponsorIds: ['a'] },
        ],
      },
    ], { focusId: 'a', mode: 'network' })

    expect(graph.edges.some((edge) => edge.kind === 'adoption')).toBe(true)
    expect(graph.edges.some((edge) => edge.kind === 'confirmation-heart')).toBe(true)
  })


  it('places direct sponsors on the same focused network level', () => {
    const graph = buildGraphModel([
      { id: 'marraine', name: 'Marraine', sponsorIds: [] },
      { id: 'parrain', name: 'Parrain', sponsorIds: [] },
      { id: 'faluchard', name: 'Faluchard', sponsorIds: ['marraine', 'parrain'] },
      { id: 'fillot', name: 'Fillot', sponsorIds: ['faluchard'] },
    ], { focusId: 'faluchard', mode: 'network' })

    const marraine = graph.nodes.find((node) => node.id === 'marraine')
    const parrain = graph.nodes.find((node) => node.id === 'parrain')
    const faluchard = graph.nodes.find((node) => node.id === 'faluchard')
    const fillot = graph.nodes.find((node) => node.id === 'fillot')

    expect(marraine.y).toBe(parrain.y)
    expect(marraine.y).toBeLessThan(faluchard.y)
    expect(fillot.y).toBeGreaterThan(faluchard.y)
    expect(Math.abs(marraine.x - parrain.x)).toBeGreaterThanOrEqual(250)
  })

  it('can render the full national network instead of only the focused branch', () => {
    const graph = buildGraphModel([
      { id: 'a', name: 'Alice', sponsorIds: [] },
      { id: 'b', name: 'Bob', sponsorIds: ['a'] },
      { id: 'c', name: 'Camille', sponsorIds: [] },
    ], { focusId: 'a', mode: 'network', includeAllNetwork: true })

    expect(graph.nodes.map((node) => node.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('keeps the global network layered by genealogy links', () => {
    const graph = buildGraphModel([
      { id: 'a', name: 'Alice', sponsorIds: [] },
      { id: 'b', name: 'Bob', sponsorIds: ['a'] },
      { id: 'c', name: 'Camille', sponsorIds: ['b'] },
      { id: 'd', name: 'Disconnected', sponsorIds: [] },
    ], { focusId: 'a', mode: 'network', includeAllNetwork: true })

    const alice = graph.nodes.find((node) => node.id === 'a')
    const bob = graph.nodes.find((node) => node.id === 'b')
    const camille = graph.nodes.find((node) => node.id === 'c')

    expect(bob.y).toBeGreaterThan(alice.y)
    expect(camille.y).toBeGreaterThan(bob.y)
    expect(graph.nodes.map((node) => node.id)).toContain('d')
  })
})
