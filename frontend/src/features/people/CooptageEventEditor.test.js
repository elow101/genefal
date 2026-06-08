import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CooptageEventEditor from './CooptageEventEditor.vue'

const person = { id: 'fillot', name: 'Fillot', roles: [] }
const people = [
  person,
  { id: 'tva-1', name: 'TVA Un', nickname: 'Uno', roles: ['tva'] },
  { id: 'other', name: 'Autre', roles: [] },
]
const roleOptions = [
  { id: 'tva', label: 'TVA' },
  { id: 'gontrand', label: 'Ordre des Gontrands' },
]

describe('CooptageEventEditor', () => {
  it('emits a cooptage draft with role title, nickname and PM intro', async () => {
    const wrapper = mount(CooptageEventEditor, {
      props: {
        person,
        people,
        roleOptions,
      },
    })

    await wrapper.find('summary').trigger('click')
    await wrapper.find('select').setValue('Ordre des Gontrands')
    await wrapper.find('input[type="date"]').setValue('2026-05-24')
    await wrapper.find('input[maxlength="90"]').setValue('Dudu')
    await wrapper.find('input[type="search"]').setValue('TVA')
    await wrapper.find('.picker-results button').trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes("Ajouter le cooptage")).trigger('click')

    const [payload] = wrapper.emitted('create').at(-1)
    expect(payload).toEqual({
      title: 'Ordre des Gontrands',
      dateTime: '2026-05-24T00:00',
      cooptageDateKnown: true,
      cooptageNickname: 'Dudu',
      sponsorIds: ['tva-1'],
    })
  })

  it('allows adding a cooptage without date, nickname or PM intro', async () => {
    const wrapper = mount(CooptageEventEditor, {
      props: {
        person,
        people,
        roleOptions,
      },
    })

    await wrapper.find('summary').trigger('click')
    await wrapper.find('select').setValue('TVA')
    await wrapper.findAll('button').find((button) => button.text().includes("Ajouter le cooptage")).trigger('click')

    const [payload] = wrapper.emitted('create').at(-1)
    expect(payload.sponsorIds).toEqual([])
    expect(payload.cooptageNickname).toBe('')
    expect(payload.cooptageDateKnown).toBe(false)
    expect(payload.dateTime).toBe('2000-01-01T00:00')
  })
})
