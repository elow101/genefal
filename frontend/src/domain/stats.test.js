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

  it('deduplicates people present in national, regional and family trees', () => {
    const stats = computeStats([
      {
        id: 'national',
        type: 'national',
        people: [{ id: 'a', name: 'Alice', roles: ['tva'], sponsorIds: [] }],
      },
      {
        id: 'region',
        type: 'region',
        people: [{ id: 'a', name: 'Alice Region', roles: ['tva'], sponsorIds: [] }],
      },
      {
        id: 'family',
        type: 'family',
        parentId: 'region',
        people: [{ id: 'a', name: 'Alice Family', roles: ['tva'], sponsorIds: [] }],
      },
    ])

    expect(stats.peopleCount).toBe(1)
    expect(stats.roles.TVA).toBe(1)
    expect(stats.rolePeople.TVA.map((person) => person.name)).toEqual(['Alice Family'])
  })

})
