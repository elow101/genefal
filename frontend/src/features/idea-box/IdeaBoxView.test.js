import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import IdeaBoxView from './IdeaBoxView.vue'
import * as api from '../../api/ideaBoxApi.js'

vi.mock('../../api/ideaBoxApi.js', () => ({
  getOrCreateIdeaBoxVoterId: vi.fn(() => 'anonymous-token-with-128-bits'),
  listIdeaBoxProposals: vi.fn(),
  getIdeaBoxProposal: vi.fn(),
  voteIdeaBoxProposal: vi.fn(),
  deleteIdeaBoxVote: vi.fn(),
  createIdeaBoxSuggestion: vi.fn(),
}))

const proposal = {
  id: 1,
  slug: 'vue-calendrier-des-evenements',
  title: 'Vue calendrier des événements',
  summary: 'Afficher les événements à venir dans un calendrier mensuel.',
  description: 'Description complète',
  problemStatement: 'La liste est moins visuelle.',
  expectedBenefit: 'Planifier plus vite.',
  category: 'Evenements',
  status: 'under_review',
  difficulty: 'medium',
  targetVersion: '',
  publicComment: '',
  votingOpen: true,
  featured: false,
  createdAt: '2026-06-19 10:00:00',
  updatedAt: '2026-06-19 10:00:00',
  releasedAt: '',
  votes: { up: 47, down: 6, total: 53 },
  currentVote: null,
}

describe('IdeaBoxView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    history.replaceState({}, '', '/')
    api.listIdeaBoxProposals.mockResolvedValue({ proposals: [proposal], pagination: { total: 1 } })
    api.getIdeaBoxProposal.mockResolvedValue({ proposal })
  })

  it('loads and renders public proposals', async () => {
    const wrapper = mount(IdeaBoxView)
    await flushPromises()

    expect(api.listIdeaBoxProposals).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Boîte à idées')
    expect(wrapper.text()).toContain('Vue calendrier des événements')
    expect(wrapper.text()).toContain('Voir le détail')
  })

  it('opens a proposal detail and records a positive vote', async () => {
    api.voteIdeaBoxProposal.mockResolvedValue({
      vote: 1,
      counts: { up: 48, down: 6, total: 54 },
    })
    const wrapper = mount(IdeaBoxView)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === 'Voir le détail').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().startsWith('Pour')).trigger('click')
    await flushPromises()

    expect(api.voteIdeaBoxProposal).toHaveBeenCalledWith(
      expect.objectContaining({ proposalId: 1, voteValue: 1, voterToken: 'anonymous-token-with-128-bits' }),
    )
    expect(wrapper.emitted('feedback')[0][0].message).toContain('enregistré')
    expect(wrapper.text()).toContain('Pour 48')
  })

  it('removes the current vote when the active choice is clicked again', async () => {
    api.getIdeaBoxProposal.mockResolvedValue({ proposal: { ...proposal, currentVote: 1 } })
    api.deleteIdeaBoxVote.mockResolvedValue({
      vote: null,
      counts: { up: 47, down: 6, total: 53 },
    })
    const wrapper = mount(IdeaBoxView)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === 'Voir le détail').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().startsWith('Pour')).trigger('click')
    await flushPromises()

    expect(api.deleteIdeaBoxVote).toHaveBeenCalledWith(1, 'anonymous-token-with-128-bits')
    expect(wrapper.emitted('feedback')[0][0].message).toContain('retiré')
  })

  it('submits a public suggestion without publishing it', async () => {
    api.createIdeaBoxSuggestion.mockResolvedValue({ ok: true })
    const wrapper = mount(IdeaBoxView)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === 'Proposer une idée').trigger('click')
    await wrapper.find('input[required]').setValue('Nouvelle idée')
    await wrapper.find('textarea[required]').setValue('Un besoin clair')
    await wrapper.find('select[required]').setValue('Autre')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(api.createIdeaBoxSuggestion).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Nouvelle idée',
    }))
    expect(wrapper.emitted('feedback')[0][0].message).toContain('transmise')
  })
})
