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
})
