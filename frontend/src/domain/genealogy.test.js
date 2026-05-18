import { describe, expect, it } from 'vitest'
import {
  appendPersonToGenealogy,
  createEmptyPerson,
  getPeopleForGenealogy,
  removePersonFromGenealogy,
  replaceGenealogy,
  updatePersonInGenealogy,
} from './genealogy.js'
import { CURRENT_SCHEMA_VERSION, migrateGenealogyState } from './schema.js'

const baseGenealogy = {
  id: 'main',
  name: 'Faluche Nationale',
  people: [
    { id: 'a', name: 'Alice', sponsorIds: ['b'], heartSponsorIds: ['b'] },
    { id: 'b', name: 'Bob', sponsorIds: [], heartSponsorIds: [] },
  ],
}

describe('genealogy domain', () => {
  it('attaches the genealogy name to visible people', () => {
    expect(getPeopleForGenealogy(baseGenealogy)[0]).toMatchObject({
      id: 'a',
      genealogyName: 'Faluche Nationale',
    })
  })

  it('updates a person immutably', () => {
    const next = updatePersonInGenealogy(baseGenealogy, {
      ...baseGenealogy.people[0],
      name: 'Alice Bis',
    })

    expect(next.people[0].name).toBe('Alice Bis')
    expect(baseGenealogy.people[0].name).toBe('Alice')
  })

  it('adds and removes people while cleaning relationships', () => {
    const created = createEmptyPerson('c')
    const appended = appendPersonToGenealogy(baseGenealogy, created)
    const removed = removePersonFromGenealogy(appended, 'b')

    expect(appended.people).toHaveLength(3)
    expect(removed.people.map((person) => person.id)).toEqual(['a', 'c'])
    expect(removed.people[0].sponsorIds).toEqual([])
    expect(removed.people[0].heartSponsorIds).toEqual([])
  })

  it('replaces one genealogy in a global state snapshot', () => {
    const state = {
      genealogies: [baseGenealogy, { id: 'secondary', name: 'Autre', people: [] }],
    }
    const next = replaceGenealogy(state, {
      ...baseGenealogy,
      name: 'Nouvelle valeur',
    })

    expect(next.genealogies[0].name).toBe('Nouvelle valeur')
    expect(next.genealogies[1].name).toBe('Autre')
  })

  it('migrates legacy flat people payloads into the current schema', () => {
    const next = migrateGenealogyState({
      people: [{ id: 'legacy', name: 'Legacy' }],
    })

    expect(next.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(next.activeGenealogyId).toBe('faluche-nationale')
    expect(next.genealogies[0].people[0].id).toBe('legacy')
  })
})
