import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPastCooptageEventsForPerson } from './upcoming.js'

describe('upcoming domain', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns past cooptage events linked to a person from newest to oldest', () => {
    vi.setSystemTime(new Date('2026-06-08T12:00:00'))
    const state = {
      upcomingBaptisms: [
        {
          id: 'future',
          eventType: 'cooptage',
          title: 'Futur',
          dateTime: '2026-06-09T20:00',
          fillotIds: ['person-1'],
        },
        {
          id: 'old',
          eventType: 'cooptage',
          title: 'Ancien',
          dateTime: '2026-05-01T20:00',
          fillotIds: ['person-1'],
        },
        {
          id: 'recent',
          eventType: 'cooptage',
          title: 'Récent',
          dateTime: '2026-06-01T20:00',
          fillotIds: ['person-1', 'person-2'],
        },
        {
          id: 'other-type',
          eventType: 'bapteme',
          title: 'Baptême',
          dateTime: '2026-06-01T20:00',
          fillotIds: ['person-1'],
        },
      ],
    }

    expect(getPastCooptageEventsForPerson(state, 'person-1').map((event) => event.id)).toEqual([
      'recent',
      'old',
    ])
  })
})
