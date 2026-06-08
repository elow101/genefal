import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PersonDetails from './PersonDetails.vue'

describe('PersonDetails', () => {
  it('renders past cooptage events when provided', () => {
    const wrapper = mount(PersonDetails, {
      props: {
        person: {
          id: 'person-1',
          name: 'Camille',
          roles: [],
          ceremonyEvents: [],
        },
        people: [{ id: 'pm-1', name: 'PM Intro' }],
        pastCooptageEvents: [
          {
            id: 'event-1',
            title: 'Ordre des Gontrands',
            dateTime: '2026-04-12T20:00',
            sponsorIds: ['pm-1'],
            cooptageNickname: 'Dudu',
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('Rôles et statuts')
    expect(wrapper.text()).toContain('Cooptage / Intronisation')
    expect(wrapper.text()).toContain('Intronisé / coopté le 12/04/2026 — Ordre des Gontrands')
    expect(wrapper.text()).toContain('Surnom : Dudu')
    expect(wrapper.text()).toContain("PM d'intro : PM Intro")
  })

  it('does not render cooptage information without events', () => {
    const wrapper = mount(PersonDetails, {
      props: {
        person: {
          id: 'person-1',
          name: 'Camille',
          roles: [],
          ceremonyEvents: [],
        },
        pastCooptageEvents: [],
      },
    })

    expect(wrapper.text()).not.toContain('Cooptage / Intronisation')
  })

  it('renders cooptages without visible date when date is not known', () => {
    const wrapper = mount(PersonDetails, {
      props: {
        person: {
          id: 'person-1',
          name: 'Camille',
          roles: [],
          ceremonyEvents: [],
        },
        pastCooptageEvents: [
          {
            id: 'event-1',
            title: 'Ordre des Gontrands',
            dateTime: '2000-01-01T00:00',
            cooptageDateKnown: false,
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('Ordre des Gontrands')
    expect(wrapper.text()).not.toContain('Intronisé / coopté le')
  })
})
