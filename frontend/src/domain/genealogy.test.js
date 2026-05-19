import { describe, expect, it } from 'vitest'
import {
  appendPersonToGenealogy,
  createEmptyPerson,
  getAllPeople,
  getPeopleForGenealogy,
  getPersonSourceGenealogy,
  movePersonToGenealogy,
  removePersonFromGenealogy,
  replaceGenealogy,
  updatePersonEverywhere,
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

  it('aggregates people when the selected genealogy is national', () => {
    const national = { ...baseGenealogy, type: 'national' }
    const people = getPeopleForGenealogy(national, [
      national,
      { id: 'region', name: 'Alsace', type: 'region', people: [{ id: 'c', name: 'Camille' }] },
    ])

    expect(people.map((person) => person.id)).toEqual(['a', 'b', 'c'])
    expect(people[2]).toMatchObject({ genealogyId: 'region', genealogyName: 'Alsace' })
  })

  it('deduplicates aggregate national copies and prefers specific source trees', () => {
    const state = {
      genealogies: [
        { id: 'faluche-nationale', name: 'National', type: 'national', people: [{ id: 'a', name: 'National A' }] },
        { id: 'region', name: 'Region', type: 'region', people: [{ id: 'a', name: 'Region A' }] },
        { id: 'family', name: 'Family', type: 'family', parentId: 'region', people: [{ id: 'a', name: 'Family A' }] },
      ],
    }

    const people = getAllPeople(state)

    expect(people).toHaveLength(1)
    expect(people[0]).toMatchObject({ name: 'Family A', genealogyId: 'family' })
    expect(getPersonSourceGenealogy(state, 'a').id).toBe('family')
  })

  it('updates a person immutably', () => {
    const next = updatePersonInGenealogy(baseGenealogy, {
      ...baseGenealogy.people[0],
      name: 'Alice Bis',
    })

    expect(next.people[0].name).toBe('Alice Bis')
    expect(baseGenealogy.people[0].name).toBe('Alice')
  })

  it('updates duplicate aggregate copies together', () => {
    const state = {
      genealogies: [
        { id: 'faluche-nationale', name: 'National', type: 'national', people: [{ id: 'a', name: 'Old' }] },
        { id: 'region', name: 'Region', type: 'region', people: [{ id: 'a', name: 'Old' }] },
      ],
    }
    const next = updatePersonEverywhere(state, { id: 'a', name: 'Updated' })

    expect(next.genealogies.flatMap((genealogy) => genealogy.people).map((person) => person.name)).toEqual([
      'Updated',
      'Updated',
    ])
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

  it('moves a person between manageable genealogies without deleting relationships', () => {
    const state = {
      genealogies: [
        { id: 'national', name: 'National', type: 'national', people: [] },
        { id: 'region', name: 'Region', type: 'region', people: [{ id: 'a', name: 'Alice', sponsorIds: ['b'] }] },
        { id: 'family', name: 'Family', type: 'family', parentId: 'region', people: [{ id: 'b', name: 'Bob' }] },
      ],
    }

    const next = movePersonToGenealogy(state, 'a', 'family', ['region', 'family'])

    expect(next.genealogies.find((genealogy) => genealogy.id === 'region').people).toEqual([])
    expect(next.genealogies.find((genealogy) => genealogy.id === 'family').people).toEqual([
      { id: 'b', name: 'Bob' },
      { id: 'a', name: 'Alice', sponsorIds: ['b'] },
    ])
    expect(next.activeGenealogyId).toBe('family')
  })

  it('refuses person moves outside the allowed genealogy scope', () => {
    const state = {
      genealogies: [
        { id: 'region-a', name: 'Region A', type: 'region', people: [{ id: 'a', name: 'Alice' }] },
        { id: 'region-b', name: 'Region B', type: 'region', people: [] },
      ],
    }

    const next = movePersonToGenealogy(state, 'a', 'region-b', ['region-a'])

    expect(next).toBe(state)
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

  it('migrates old multi-tree payloads without losing existing people', () => {
    const next = migrateGenealogyState({
      activeGenealogyId: 'kfetteria',
      genealogies: [
        {
          id: 'kfetteria',
          name: "Descendance de la K'fetteria",
          people: [{ id: 'regional-person', name: 'Regional Person' }],
        },
        {
          id: 'family-a',
          name: 'Famille A',
          people: [{ id: 'family-person', name: 'Family Person' }],
        },
      ],
    })

    expect(next.activeGenealogyId).toBe('faluche-nationale')
    expect(next.genealogies.map((genealogy) => genealogy.type)).toEqual(['national', 'region', 'family'])
    expect(next.genealogies[1].people[0].id).toBe('regional-person')
    expect(next.genealogies[2].people[0].id).toBe('family-person')
    expect(next.genealogies[2].parentId).toBe('faluche-alsacienne')
  })
})
