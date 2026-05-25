import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import UpcomingComposer from './UpcomingComposer.vue'

describe('UpcomingComposer', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

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

  it('only sends allowParticipation for custom events', async () => {
    const wrapper = mount(UpcomingComposer, {
      props: {
        enabled: true,
        people: [{ id: 'sponsor-1', name: 'Sponsor' }],
      },
    })

    await wrapper.find('input[placeholder="Soirée, baptême, repas..."]').setValue('Repas')
    await wrapper.find('input[type="date"]').setValue('2026-06-01')
    await wrapper.find('input[type="time"]').setValue('20:30')
    await wrapper.find('.switch-field input').setValue(true)
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('create')?.[0]?.[0]).toMatchObject({
      eventType: 'autre',
      allowParticipation: true,
    })
    wrapper.emitted('create')?.[0]?.[1]?.(true)
    await wrapper.vm.$nextTick()

    await wrapper.find('input[placeholder="Soirée, baptême, repas..."]').setValue('Baptême')
    await wrapper.get('select').setValue('bapteme')
    await wrapper.find('input[type="date"]').setValue('2026-06-02')
    await wrapper.find('input[type="time"]').setValue('20:30')
    await wrapper.find('textarea[required]').setValue('Camille')
    await wrapper.find('input[type="search"]').setValue('Sponsor')
    await wrapper.find('.picker-results button').trigger('click')
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('create')?.[1]?.[0]).toMatchObject({
      eventType: 'bapteme',
      allowParticipation: false,
    })
  })

  it('restores a saved draft after reload', async () => {
    window.localStorage.setItem('genefaluche-upcoming-event-draft', JSON.stringify({
      title: 'Brouillon',
      eventType: 'autre',
      eventDate: '2026-06-01',
      eventTime: '20:30',
      visibility: 'family',
      allowParticipation: true,
    }))

    const wrapper = mount(UpcomingComposer, {
      props: {
        enabled: true,
        people: [],
      },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('input[placeholder="Soirée, baptême, repas..."]').element.value).toBe('Brouillon')
    expect(wrapper.text()).toContain('Brouillon récupéré')
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
