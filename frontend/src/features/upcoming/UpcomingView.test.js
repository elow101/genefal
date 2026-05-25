import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UpcomingView from './UpcomingView.vue'

describe('UpcomingView', () => {
  it('renders the empty state', () => {
    const wrapper = mount(UpcomingView, {
      props: {
        events: [],
        people: [],
        region: { id: 'region-1', name: 'Alsace' },
      },
    })

    expect(wrapper.text()).toContain('Aucun événement trouvé')
  })

  it('renders a formatted upcoming event', () => {
    const wrapper = mount(UpcomingView, {
      props: {
        events: [
          {
            id: 'event-1',
            title: 'Cooptage de juin',
            eventType: 'cooptage',
            dateTime: '2026-06-01T20:30',
            place: 'Paris',
            fillotIds: ['person-1'],
            requests: [],
          },
        ],
        people: [{ id: 'person-1', name: 'Camille' }],
        region: { id: 'region-1', name: 'Alsace' },
      },
    })

    expect(wrapper.text()).toContain('Cooptage de juin')
    expect(wrapper.text()).toContain('Cooptage')
    expect(wrapper.text()).toContain('Camille')
    expect(wrapper.text()).toContain('Paris')
  })

  it('shows request buttons according to event participation rules', () => {
    const wrapper = mount(UpcomingView, {
      props: {
        events: [
          { id: 'bapteme-1', title: 'Baptême', eventType: 'bapteme', dateTime: '2026-06-01T20:30', sponsorIds: ['p1'], baptizedNames: ['A'], requests: [] },
          { id: 'cooptage-1', title: 'Cooptage', eventType: 'cooptage', dateTime: '2026-06-02T20:30', allowParticipation: true, sponsorIds: ['p1'], fillotIds: ['p2'], requests: [] },
          { id: 'autre-off', title: 'Autre fermé', eventType: 'autre', dateTime: '2026-06-03T20:30', requests: [] },
          { id: 'autre-on', title: 'Autre ouvert', eventType: 'autre', allowParticipation: true, dateTime: '2026-06-04T20:30', requests: [] },
        ],
        people: [
          { id: 'p1', name: 'Camille' },
          { id: 'p2', name: 'Noa' },
        ],
        region: { id: 'region-1', name: 'Alsace' },
      },
    })

    expect(wrapper.findAll('button').filter((button) => button.text() === 'Demander à participer')).toHaveLength(2)
  })

  it('filters events with quick chips', async () => {
    const wrapper = mount(UpcomingView, {
      props: {
        events: [
          { id: 'bapteme-1', title: 'Baptême', eventType: 'bapteme', dateTime: '2026-06-01T20:30', sponsorIds: ['p1'], baptizedNames: ['A'], requests: [] },
          { id: 'autre-on', title: 'Autre ouvert', eventType: 'autre', allowParticipation: true, dateTime: '2026-06-04T20:30', requests: [] },
        ],
        people: [{ id: 'p1', name: 'Camille' }],
        region: { id: 'region-1', name: 'Alsace' },
      },
    })

    await wrapper.findAll('.filter-chip').find((button) => button.text() === 'Autres').trigger('click')

    const cards = wrapper.findAll('.upcoming-card')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toContain('Autre ouvert')
    expect(cards[0].text()).not.toContain('Baptême')
  })
})
