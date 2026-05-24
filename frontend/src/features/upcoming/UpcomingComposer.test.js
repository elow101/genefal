import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UpcomingComposer from './UpcomingComposer.vue'

describe('UpcomingComposer', () => {
  it('recomposes separate date and time fields into the expected dateTime payload', async () => {
    const wrapper = mount(UpcomingComposer, {
      props: {
        enabled: true,
        people: [],
      },
    })

    await wrapper.find('input[placeholder="Soirée, baptême, repas..."]').setValue('Repas')
    await wrapper.find('input[type="date"]').setValue('2026-06-01')
    await wrapper.find('input[type="time"]').setValue('20:30')
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('create')?.[0]?.[0]).toMatchObject({
      title: 'Repas',
      dateTime: '2026-06-01T20:30',
    })
  })

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

    await wrapper.get('select').setValue('cooptage')

    const searchInputs = wrapper.findAll('input[type="search"]')
    await searchInputs[0].setValue('Alice')
    expect(wrapper.text()).toContain('Alice')

    await searchInputs[1].setValue('Basile')
    expect(wrapper.text()).toContain('Basile')
  })
})
