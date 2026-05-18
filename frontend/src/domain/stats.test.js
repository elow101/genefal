import { describe, expect, it } from 'vitest'
import { computeStats } from './stats.js'

describe('computeStats', () => {
  it('computes richer genealogy insights', () => {
    const stats = computeStats([
      {
        id: 'main',
        people: [
          { id: 'a', name: 'Alice', nickname: 'Très Long Surnom', song: 'Chant', sponsorIds: [] },
          { id: 'b', name: 'Bob', sponsorIds: ['a'], crossGroupId: 'x' },
          { id: 'c', name: 'Camille', sponsorIds: ['b'], crossGroupId: 'x' },
        ],
      },
    ])

    expect(stats.peopleCount).toBe(3)
    expect(stats.largestDescendance.person.id).toBe('a')
    expect(stats.largestDescendance.count).toBe(2)
    expect(stats.longestNickname.nickname).toBe('Très Long Surnom')
    expect(stats.crossGroupCount).toBe(1)
  })
})
