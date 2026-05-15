import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UpcomingView from './UpcomingView.vue'

describe('UpcomingView', () => {
  it('renders the empty state', () => {
    const wrapper = mount(UpcomingView, {
      props: {
        events: [],
      },
    })

    expect(wrapper.text()).toContain(`Aucun ${'\u00e9'}v${'\u00e9'}nement ${'\u00e0'} venir`)
  })

  it('renders a formatted upcoming event', () => {
    const wrapper = mount(UpcomingView, {
      props: {
        events: [
          {
            id: 'event-1',
            eventType: 'cooptage',
            dateTime: '2026-06-01T20:30',
            place: 'Paris',
          },
        ],
      },
    })

    expect(wrapper.text()).toContain(`Cooptage ${'\u00e0'} venir`)
    expect(wrapper.text()).toContain('Paris')
  })
})
