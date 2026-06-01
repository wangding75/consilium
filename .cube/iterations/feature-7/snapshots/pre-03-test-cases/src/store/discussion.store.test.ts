import { describe, it, expect } from 'vitest'
import {
  discussionReducer,
  generateClientMessageId,
  type DiscussionStoreState,
  type DiscussionAction,
} from './discussion.store'
import type { DiscussionMessage } from '@/types'
import type { ApiError } from '@/types/api'

const initialState: DiscussionStoreState = {
  sessions: {},
  messagesBySessionId: {},
  activeSpeakerBySessionId: {},
  loadingBySessionId: {},
  sendingByClientMessageId: {},
  typingBySessionId: {},
  typingSpeakerBySessionId: {},
  errorBySessionId: {},
}

function makeMsg(overrides?: Partial<DiscussionMessage>): DiscussionMessage {
  return {
    messageId: `msg-${Math.random().toString(36).slice(2)}`,
    sessionId: 'sess-1',
    type: 'user',
    content: 'test',
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('discussionReducer', () => {
  it('SESSION_LOADED sets session data', () => {
    const action: DiscussionAction = {
      type: 'SESSION_LOADED',
      sessionId: 'sess-1',
      session: {
        sessionId: 'sess-1',
        topic: '三国战略',
        template: { templateId: 'tpl-1', name: '三国谋士' },
        status: 'active',
        roles: [],
        activeSpeakerId: 'zhuge-liang',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
    const state = discussionReducer(initialState, action)
    expect(state.sessions['sess-1'].topic).toBe('三国战略')
    expect(state.activeSpeakerBySessionId['sess-1']).toBe('zhuge-liang')
  })

  it('MESSAGES_LOADED sets messages and activeSpeakerId', () => {
    const msgs = [makeMsg({ messageId: 'msg-1' })]
    const action: DiscussionAction = {
      type: 'MESSAGES_LOADED',
      sessionId: 'sess-1',
      messages: msgs,
      activeSpeakerId: 'zhuge-liang',
    }
    const state = discussionReducer(initialState, action)
    expect(state.messagesBySessionId['sess-1']).toHaveLength(1)
    expect(state.activeSpeakerBySessionId['sess-1']).toBe('zhuge-liang')
  })

  it('LOADING_SET sets loading state', () => {
    const action: DiscussionAction = {
      type: 'LOADING_SET',
      sessionId: 'sess-1',
      loading: true,
    }
    const state = discussionReducer(initialState, action)
    expect(state.loadingBySessionId['sess-1']).toBe(true)
  })

  it('TYPING_SET sets typing state', () => {
    const action: DiscussionAction = {
      type: 'TYPING_SET',
      sessionId: 'sess-1',
      typing: true,
    }
    const state = discussionReducer(initialState, action)
    expect(state.typingBySessionId['sess-1']).toBe(true)
  })

  it('ERROR_SET sets error state', () => {
    const err: ApiError = { code: 'SESSION_NOT_FOUND', message: 'Not found' }
    const action: DiscussionAction = {
      type: 'ERROR_SET',
      sessionId: 'sess-1',
      error: err,
    }
    const state = discussionReducer(initialState, action)
    expect(state.errorBySessionId['sess-1']).toEqual(err)
  })

  it('ERROR_SET with null clears error', () => {
    const stateWithError: DiscussionStoreState = {
      ...initialState,
      errorBySessionId: { 'sess-1': { code: 'TEST', message: 'err' } },
    }
    const action: DiscussionAction = {
      type: 'ERROR_SET',
      sessionId: 'sess-1',
      error: null,
    }
    const state = discussionReducer(stateWithError, action)
    expect(state.errorBySessionId['sess-1']).toBeNull()
  })

  it('MESSAGE_OPTIMISTIC appends optimistic message with pending status', () => {
    const msg = makeMsg({ clientMessageId: 'client_1', status: 'pending' })
    const action: DiscussionAction = {
      type: 'MESSAGE_OPTIMISTIC',
      sessionId: 'sess-1',
      message: msg,
    }
    const state = discussionReducer(initialState, action)
    expect(state.messagesBySessionId['sess-1']).toHaveLength(1)
    expect(state.messagesBySessionId['sess-1'][0].status).toBe('pending')
  })

  it('MESSAGE_SENT replaces optimistic message by clientMessageId and appends agent messages', () => {
    const optimisticMsg = makeMsg({
      messageId: 'msg-opt',
      clientMessageId: 'client_1',
      status: 'pending',
    })
    const preState: DiscussionStoreState = {
      ...initialState,
      messagesBySessionId: { 'sess-1': [optimisticMsg] },
    }
    const userMsg = makeMsg({
      messageId: 'msg-real',
      clientMessageId: 'client_1',
      status: 'completed',
    })
    const agentMsg = makeMsg({
      messageId: 'msg-agent',
      type: 'character',
      roleId: 'zhuge-liang',
      content: 'agent reply',
    })
    const action: DiscussionAction = {
      type: 'MESSAGE_SENT',
      sessionId: 'sess-1',
      clientMessageId: 'client_1',
      userMessage: userMsg,
      agentMessages: [agentMsg],
      activeSpeakerId: 'zhuge-liang',
    }
    const state = discussionReducer(preState, action)
    // Optimistic replaced by real user message
    expect(state.messagesBySessionId['sess-1'].some(m => m.messageId === 'msg-real')).toBe(true)
    expect(state.messagesBySessionId['sess-1'].some(m => m.messageId === 'msg-opt')).toBe(false)
    // Agent messages appended
    expect(state.messagesBySessionId['sess-1'].some(m => m.messageId === 'msg-agent')).toBe(true)
    // Typing cleared
    expect(state.typingBySessionId['sess-1']).toBeFalsy()
    // Active speaker updated
    expect(state.activeSpeakerBySessionId['sess-1']).toBe('zhuge-liang')
  })

  it('MESSAGE_SENT with null userMessage only appends agent messages', () => {
    const agentMsg = makeMsg({
      messageId: 'msg-agent',
      type: 'host',
      roleId: 'xunyu',
    })
    const action: DiscussionAction = {
      type: 'MESSAGE_SENT',
      sessionId: 'sess-1',
      clientMessageId: 'client_1',
      userMessage: null,
      agentMessages: [agentMsg],
      activeSpeakerId: 'xunyu',
    }
    const state = discussionReducer(initialState, action)
    expect(state.messagesBySessionId['sess-1']).toHaveLength(1)
    expect(state.messagesBySessionId['sess-1'][0].type).toBe('host')
  })

  it('MESSAGE_FAILED marks optimistic message as failed', () => {
    const optimisticMsg = makeMsg({
      messageId: 'msg-opt',
      clientMessageId: 'client_1',
      status: 'pending',
    })
    const preState: DiscussionStoreState = {
      ...initialState,
      messagesBySessionId: { 'sess-1': [optimisticMsg] },
      typingBySessionId: { 'sess-1': true },
    }
    const action: DiscussionAction = {
      type: 'MESSAGE_FAILED',
      sessionId: 'sess-1',
      clientMessageId: 'client_1',
      error: { code: 'NETWORK_ERROR', message: 'Network error' },
    }
    const state = discussionReducer(preState, action)
    expect(state.messagesBySessionId['sess-1'][0].status).toBe('failed')
    expect(state.typingBySessionId['sess-1']).toBeFalsy()
  })

  it('SENDING_STATUS updates sending status for clientMessageId', () => {
    const action: DiscussionAction = {
      type: 'SENDING_STATUS',
      clientMessageId: 'client_1',
      status: 'pending',
    }
    const state = discussionReducer(initialState, action)
    expect(state.sendingByClientMessageId['client_1']).toBe('pending')
  })

  // Task-09: dedup merge by messageId
  it('MESSAGES_LOADED merges by messageId (replaces existing)', () => {
    const existing = makeMsg({ messageId: 'msg-1', content: 'old' })
    const preState: DiscussionStoreState = {
      ...initialState,
      messagesBySessionId: { 'sess-1': [existing] },
    }
    const updated = makeMsg({ messageId: 'msg-1', content: 'updated', status: 'completed' })
    const action: DiscussionAction = {
      type: 'MESSAGES_LOADED',
      sessionId: 'sess-1',
      messages: [updated],
      activeSpeakerId: null,
    }
    const state = discussionReducer(preState, action)
    expect(state.messagesBySessionId['sess-1']).toHaveLength(1)
    expect(state.messagesBySessionId['sess-1'][0].content).toBe('updated')
  })

  // Task-09: messages sorted by createdAt after merge
  it('MESSAGE_SENT sorts messages by createdAt ascending after merge', () => {
    const existing = makeMsg({
      messageId: 'msg-existing',
      createdAt: '2026-01-02T00:00:00.000Z',
    })
    const preState: DiscussionStoreState = {
      ...initialState,
      messagesBySessionId: { 'sess-1': [existing] },
    }
    const userMsg = makeMsg({
      messageId: 'msg-new',
      createdAt: '2026-01-01T00:00:00.000Z',
      clientMessageId: 'client_sort',
    })
    const agentMsg = makeMsg({
      messageId: 'msg-agent',
      createdAt: '2026-01-03T00:00:00.000Z',
    })
    const action: DiscussionAction = {
      type: 'MESSAGE_SENT',
      sessionId: 'sess-1',
      clientMessageId: 'client_sort',
      userMessage: userMsg,
      agentMessages: [agentMsg],
      activeSpeakerId: null,
    }
    const state = discussionReducer(preState, action)
    const msgs = state.messagesBySessionId['sess-1']
    // Should be sorted: msg-new (Jan 1), msg-existing (Jan 2), msg-agent (Jan 3)
    expect(msgs[0].messageId).toBe('msg-new')
    expect(msgs[1].messageId).toBe('msg-existing')
    expect(msgs[2].messageId).toBe('msg-agent')
  })
})

describe('generateClientMessageId', () => {
  it('generates a string starting with client_', () => {
    const id = generateClientMessageId()
    expect(id).toMatch(/^client_\d+_[a-zA-Z0-9]+$/)
  })

  it('generates unique ids on successive calls', () => {
    const id1 = generateClientMessageId()
    const id2 = generateClientMessageId()
    expect(id1).not.toBe(id2)
  })
})
