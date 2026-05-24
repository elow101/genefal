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
})
