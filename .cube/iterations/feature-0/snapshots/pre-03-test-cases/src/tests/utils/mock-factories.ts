import type { Template, Role, Message, Session, DiscussionState } from '@/types'
import { threeKingdomsTemplate } from '@/data/templates/three-kingdoms'

export function mockRole(override: Partial<Role> = {}): Role {
  return {
    id: 'mock-role-1',
    name: '测试角色',
    persona: '测试用角色，无特定设定',
    isHost: false,
    systemPrompt: 'You are a test role.',
    avatarEmoji: '🤖',
    ...override,
  }
}

export function mockTemplate(override: Partial<Template> = {}): Template {
  return {
    ...threeKingdomsTemplate,
    id: 'mock-template-1',
    name: '测试模板',
    ...override,
  }
}

export function mockDiscussionState(override: Partial<DiscussionState> = {}): DiscussionState {
  return {
    stage: 'opening',
    turnCount: 0,
    lastSpeakerId: null,
    ...override,
  }
}

export function mockMessage(override: Partial<Message> = {}): Message {
  return {
    id: 'mock-message-1',
    sessionId: 'mock-session-1',
    roleId: 'mock-role-1',
    content: '这是一条测试消息',
    type: 'text',
    timestamp: Date.now(),
    ...override,
  }
}

export function mockSession(override: Partial<Session> = {}): Session {
  return {
    id: 'mock-session-1',
    templateId: 'mock-template-1',
    topic: '测试议题',
    state: mockDiscussionState(),
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...override,
  }
}
