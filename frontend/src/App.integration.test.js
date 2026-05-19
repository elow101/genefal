import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'

const baseState = {
  schemaVersion: 1,
  roleResetVersion: 1,
  activeGenealogyId: 'main',
  genealogies: [
    {
      id: 'main',
      name: 'Faluche Nationale',
      type: 'region',
      parentId: '',
      people: [
        {
          id: 'alice',
          name: 'Alice',
          nickname: '',
          sponsorIds: [],
          heartSponsorIds: [],
        },
      ],
    },
  ],
  upcomingBaptisms: [],
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('App integration', () => {
  it('loads, creates, edits and saves a person through the full Vue flow', async () => {
    const requests = installFetchMock()
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === 'Nouveau').trigger('click')
    await wrapper.get('input[required]').setValue('Bérénice')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    const saveRequest = requests.find((request) => request.url === '/api/genealogy.php' && request.options?.method === 'POST')
    const body = JSON.parse(saveRequest.options.body)
    expect(body.schemaVersion).toBe(1)
    expect(body.genealogies[0].people.some((person) => person.name === 'Bérénice')).toBe(true)
    expect(wrapper.text()).toContain('La fiche a bien')
  })

  it('explains when a public edit is refused by the server', async () => {
    installFetchMock({
      saveState({ previousState }) {
        return previousState
      },
    })
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text().includes('Alice')).trigger('click')
    await wrapper.get('input[required]').setValue('Alice modifiée')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain("Cette fiche n'est modifiable qu'en mode admin")
    expect(wrapper.text()).toContain('envoie une dol')
  })

  it('creates an upcoming event and persists it automatically', async () => {
    vi.useFakeTimers()
    const requests = installFetchMock()
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.findAll('.genealogy-option').find((button) => button.text().includes('Région')).trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Event')).trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Annoncer un baptême')).trigger('click')
    await wrapper.get('select').setValue('bapteme')
    await wrapper.find('form.upcoming-form input[type="search"]').setValue('Alice')
    await wrapper.findAll('form.upcoming-form button').find((button) => button.text().includes('Alice')).trigger('click')
    await wrapper.get('textarea').setValue('Camille')
    await wrapper.get('input[type="datetime-local"]').setValue('2026-06-01T20:30')
    await wrapper.get('form.upcoming-form').trigger('submit.prevent')
    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()

    const saveRequests = requests.filter((request) => request.url === '/api/genealogy.php' && request.options?.method === 'POST')
    const lastBody = JSON.parse(saveRequests.at(-1).options.body)
    expect(lastBody.upcomingBaptisms).toHaveLength(1)
    expect(lastBody.upcomingBaptisms[0].baptizedNames).toEqual(['Camille'])
  })

  it('shows the admin login form when no admin session exists', async () => {
    installFetchMock()
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text().includes('Admin')).trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Mot de passe admin')
    expect(wrapper.text()).not.toContain('Admin régional')
  })
})

function installFetchMock(config = {}) {
  const requests = []
  let currentState = structuredClone(baseState)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      requests.push({ url, options })

      if (url === '/api/auth.php') return json({ authenticated: true, csrfToken: 'csrf' })
      if (url === '/api/genealogy.php' && options.method === 'POST') {
        const incomingState = JSON.parse(options.body)
        currentState =
          typeof config.saveState === 'function'
            ? config.saveState({ incomingState, previousState: currentState })
            : incomingState
        return json({ ok: true, state: currentState })
      }
      if (url === '/api/genealogy.php') return json(currentState)
      return json({})
    }),
  )
  return requests
}

function json(payload) {
  return {
    ok: true,
    status: 200,
    async json() {
      return payload
    },
  }
}
