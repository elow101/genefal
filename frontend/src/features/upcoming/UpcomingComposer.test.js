import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UpcomingComposer from './UpcomingComposer.vue'

describe('UpcomingComposer', () => {
  it('filters cooptage pickers by the selected regional role', async () => {
    const wrapper = mount(UpcomingComposer, {
      props: {
        enabled: true,
        cooptageRole: { id: 'gardien', label: 'Gardien' },
        people: [
          { id: 'a', name: 'Alice', roles: ['gardien'] },
          { id: 'b', name: 'Basile', roles: [] },
        ],
      },
    })

    await wrapper.findAll('button').find((button) => button.text().includes('cooptage')).trigger('click')

    const searchInputs = wrapper.findAll('input[type="search"]')
    await searchInputs[0].setValue('Alice')
    expect(wrapper.text()).toContain('Alice')

    await searchInputs[1].setValue('Basile')
    expect(wrapper.text()).toContain('Basile')
  })
})
