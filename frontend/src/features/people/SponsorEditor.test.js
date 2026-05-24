import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SponsorEditor from './SponsorEditor.vue'

const people = [
  { id: 'mentor', name: 'Mentor', nickname: 'Guide', sponsorIds: [], heartSponsorIds: [] },
  { id: 'fillot', name: 'Fillot', nickname: 'Bleu', sponsorIds: [], heartSponsorIds: [] },
  { id: 'existing', name: 'Deja fillot', sponsorIds: ['mentor'], heartSponsorIds: ['mentor'] },
]

describe('SponsorEditor', () => {
  it('adds a fillot from the search results by updating the selected fillot sponsorship', async () => {
    const wrapper = mount(SponsorEditor, {
      props: {
        title: 'Fillots',
        field: 'fillotIds',
        person: people[0],
        people,
      },
    })

    await wrapper.get('input[type="search"]').setValue('Bleu')
    await wrapper.findAll('.picker-results button').find((button) => button.text().includes('Fillot')).trigger('click')

    const [[updatedFillot]] = wrapper.emitted('update')
    expect(updatedFillot.id).toBe('fillot')
    expect(updatedFillot.sponsorIds).toEqual(['mentor'])
  })

  it('removes a fillot by clearing the inverse sponsorship links', async () => {
    const wrapper = mount(SponsorEditor, {
      props: {
        title: 'Fillots',
        field: 'fillotIds',
        person: people[0],
        people,
      },
    })

    await wrapper.findAll('.chip-button').find((button) => button.text().includes('Deja fillot')).trigger('click')

    const [[updatedFillot]] = wrapper.emitted('update')
    expect(updatedFillot.id).toBe('existing')
    expect(updatedFillot.sponsorIds).toEqual([])
    expect(updatedFillot.heartSponsorIds).toEqual([])
  })

  it('prevents selecting an existing fillot as sponsor', async () => {
    const wrapper = mount(SponsorEditor, {
      props: {
        title: 'Parrains',
        field: 'sponsorIds',
        person: people[0],
        people,
      },
    })

    await wrapper.get('input[type="search"]').setValue('Deja')

    expect(wrapper.text()).toContain('Relation impossible')
    expect(wrapper.findAll('.picker-results button')).toHaveLength(0)
  })
})
