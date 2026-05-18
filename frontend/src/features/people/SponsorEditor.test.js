import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SponsorEditor from './SponsorEditor.vue'

const people = [
  { id: 'mentor', name: 'Mentor', sponsorIds: [], heartSponsorIds: [] },
  { id: 'fillot', name: 'Fillot', sponsorIds: [], heartSponsorIds: [] },
  { id: 'existing', name: 'Déjà fillot', sponsorIds: ['mentor'], heartSponsorIds: ['mentor'] },
]

describe('SponsorEditor', () => {
  it('adds a fillot by updating the selected fillot sponsorship', async () => {
    const wrapper = mount(SponsorEditor, {
      props: {
        title: 'Fillots',
        field: 'fillotIds',
        person: people[0],
        people,
      },
    })

    await wrapper.get('select').setValue('fillot')
    await wrapper.findAll('button').find((button) => button.text() === 'Ajouter').trigger('click')

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

    await wrapper.findAll('button').find((button) => button.text() === 'Retirer').trigger('click')

    const [[updatedFillot]] = wrapper.emitted('update')
    expect(updatedFillot.id).toBe('existing')
    expect(updatedFillot.sponsorIds).toEqual([])
    expect(updatedFillot.heartSponsorIds).toEqual([])
  })
})
