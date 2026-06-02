import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PersonForm from './PersonForm.vue'

const person = {
  id: 'mentor',
  name: 'Mentor',
  nickname: '',
  sponsorIds: [],
  heartSponsorIds: [],
  roles: [],
}

const people = [
  person,
  { id: 'fillot', name: 'Fillot', sponsorIds: ['mentor'], heartSponsorIds: [] },
]

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PersonForm', () => {
  it('saves cross baptism fields from the baptism section', async () => {
    const wrapper = mount(PersonForm, {
      props: {
        person,
        people,
        roleOptions: [],
      },
    })

    await wrapper.findAll('.form-step-tabs button').find((button) => button.text() === 'Baptême').trigger('click')
    await wrapper.find('input[placeholder="ex : promo-2026-tours"]').setValue('promo-2026-tours')
    await wrapper.find('input[type="number"]').setValue(4)
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('save')?.at(-1)?.[0]).toMatchObject({
      crossGroupId: 'promo-2026-tours',
      crossGroupSize: 4,
    })
  })

  it('can clear existing cross baptism fields', async () => {
    const wrapper = mount(PersonForm, {
      props: {
        person: { ...person, crossGroupId: 'promo-2026-tours', crossGroupSize: 4 },
        people,
        roleOptions: [],
      },
    })

    await wrapper.findAll('.form-step-tabs button').find((button) => button.text() === 'Baptême').trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Supprimer le baptême croisé')).trigger('click')
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('save')?.at(-1)?.[0]).toMatchObject({
      crossGroupId: '',
      crossGroupSize: 0,
    })
  })

  it('keeps family collapsed until the Famille tab opens it', async () => {
    const wrapper = mount(PersonForm, {
      props: {
        person,
        people,
        roleOptions: [],
      },
    })
    const sponsorshipSection = wrapper.findAll('details').find((details) => details.text().includes('Famille'))

    expect(sponsorshipSection.element.open).toBe(false)

    await wrapper.findAll('.form-step-tabs button').find((button) => button.text() === 'Famille').trigger('click')

    expect(sponsorshipSection.element.open).toBe(true)
    expect(wrapper.text()).toContain('Fillots')
  })

  it('shows and saves custom filiere only when Autre is selected', async () => {
    const wrapper = mount(PersonForm, {
      props: {
        person,
        people,
        roleOptions: [],
      },
    })

    expect(wrapper.find('.custom-filiere-field').exists()).toBe(false)

    await wrapper.find('select').setValue('autre')
    await wrapper.find('.custom-filiere-field input').setValue('Taille de pierre')
    await wrapper.get('form').trigger('submit.prevent')

    expect(wrapper.emitted('save')?.at(-1)?.[0]).toMatchObject({
      filiere: 'autre',
      filiereCustom: 'Taille de pierre',
    })
  })
})
