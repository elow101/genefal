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

    await wrapper.findAll('button').find((button) => button.text() === 'Ajouter une fiche').trigger('click')
    await flushPromises()
    expect(requests.filter((request) => request.url === '/api/genealogy.php' && request.options?.method === 'POST')).toHaveLength(0)
    await wrapper.get('input[required]').setValue('Bérénice')
    await wrapper.get('.person-form form').trigger('submit.prevent')
    await flushPromises()

    const saveRequest = requests.find((request) => request.url === '/api/genealogy.php' && request.options?.method === 'POST')
    const body = JSON.parse(saveRequest.options.body)
    expect(body.schemaVersion).toBe(1)
    expect(body.genealogies.some((genealogy) => genealogy.people.some((person) => person.name === 'Bérénice'))).toBe(true)
    expect(wrapper.text()).toContain('La fiche a bien')
  })

  it('abandons a temporary new person without saving it', async () => {
    const requests = installFetchMock()
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === 'Ajouter une fiche').trigger('click')
    await flushPromises()
    await wrapper.get('input[required]').setValue('Fiche temporaire')
    await wrapper.findAll('.person-form button').find((button) => button.text() === 'Annuler').trigger('click')
    await flushPromises()

    expect(requests.filter((request) => request.url === '/api/genealogy.php' && request.options?.method === 'POST')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Fiche temporaire')
  })

  it('opens the tree editor before starting a home-page person creation', async () => {
    const requests = installFetchMock()
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === 'Ajouter une fiche').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Mode Réseau')
    expect(wrapper.text()).toContain('Brouillon local non enregistré')
    expect(wrapper.find('.person-form form').exists()).toBe(true)
    expect(requests.filter((request) => request.url === '/api/genealogy.php' && request.options?.method === 'POST')).toHaveLength(0)

    await wrapper.findAll('.person-form button').find((button) => button.text() === 'Annuler').trigger('click')
    await flushPromises()

    expect(requests.filter((request) => request.url === '/api/genealogy.php' && request.options?.method === 'POST')).toHaveLength(0)
  })

  it('allows public duplicate person creation while admin duplicate tooling handles review', async () => {
    const requests = installFetchMock({
      initialState: {
        ...baseState,
        genealogies: [
          {
            ...baseState.genealogies[0],
            people: [
              {
                id: 'leo',
                name: 'Léo  Dupont',
                nickname: 'Herbizéeébi',
                sponsorIds: [],
                heartSponsorIds: [],
              },
            ],
          },
        ],
      },
    })
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === 'Ajouter une fiche').trigger('click')
    await flushPromises()
    await flushPromises()
    const inputs = wrapper.findAll('.person-form input')
    await inputs[0].setValue('  leo dupont  ')
    await inputs[1].setValue('herbizeeebi')
    await wrapper.get('.person-form form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Une fiche avec le même nom, prénom et surnom existe déjà.')
    expect(requests.filter((request) => request.url === '/api/genealogy.php' && request.options?.method === 'POST')).toHaveLength(1)
  })

  it('explains when a public edit is refused by the server', async () => {
    installFetchMock({
      saveState({ previousState }) {
        return previousState
      },
    })
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === 'Explorer l\'arbre').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('Alice')).trigger('click')
    await wrapper.get('input[required]').setValue('Alice modifiée')
    await wrapper.get('.person-form form').trigger('submit.prevent')
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
    await vi.dynamicImportSettled()
    await flushPromises()
    await wrapper.find('form.upcoming-form input[placeholder="Soirée, baptême, repas..."]').setValue('Baptême de Camille')
    await wrapper.get('select').setValue('bapteme')
    await wrapper.find('form.upcoming-form input[type="search"]').setValue('Alice')
    await wrapper.findAll('form.upcoming-form button').find((button) => button.text().includes('Alice')).trigger('click')
    await wrapper.get('textarea').setValue('Camille')
    await wrapper.get('input[type="date"]').setValue('2026-06-01')
    await wrapper.get('input[type="time"]').setValue('20:30')
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
    await vi.dynamicImportSettled()
    await flushPromises()
    await flushPromises()

    expect(wrapper.text()).toContain('Mot de passe admin')
    expect(wrapper.text()).not.toContain('Admin régional')
  })

  it('persists person deletion when an admin confirms it', async () => {
    const requests = installFetchMock({
      admin: { authenticated: true, level: 'general' },
    })
    vi.stubGlobal('confirm', vi.fn(() => true))
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === 'Explorer l\'arbre').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('Admin')).trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('Alice')).trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Supprimer cette personne')).trigger('click')
    await flushPromises()

    const saveRequests = requests.filter((request) => request.url === '/api/genealogy.php' && request.options?.method === 'POST')
    const lastBody = JSON.parse(saveRequests.at(-1).options.body)
    expect(lastBody.genealogies[0].people).toHaveLength(0)
    expect(wrapper.text()).toContain('La fiche a été supprimée.')
  })

})

function installFetchMock(config = {}) {
  const requests = []
  let currentState = structuredClone(config.initialState || baseState)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      requests.push({ url, options })

      if (url === '/api/auth.php') return json({ authenticated: true, csrfToken: 'csrf' })
      if (url === '/api/admin.php') {
        return json({
          admin: config.admin || { authenticated: false },
        })
      }
      if (url === '/api/genealogy.php' && options.method === 'POST') {
        const incomingState = JSON.parse(options.body)
        currentState =
          typeof config.saveState === 'function'
            ? config.saveState({ incomingState, previousState: currentState })
            : incomingState
        return json({ ok: true, state: currentState })
      }
      if (url === '/api/upcoming.php' && options.method === 'POST') {
        const event = JSON.parse(options.body)
        currentState = {
          ...currentState,
          upcomingBaptisms: [
            ...currentState.upcomingBaptisms,
            { ...event, id: 'event-1', requests: [], createdAt: '2026-01-01T00:00:00Z' },
          ],
        }
        return json({ ok: true, state: currentState, temporaryPassword: 'secret' })
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
