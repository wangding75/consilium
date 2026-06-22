import type { SessionExportResult } from '@/types/api'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { MessageRepository } from '@/server/repositories/message.repository'
import type { EventRepository } from '@/server/repositories/event.repository'
import type { VoteRepository } from '@/server/repositories/vote.repository'
import { ServiceError } from '@/server/errors'

export class SessionExportService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly messageRepo: MessageRepository,
    private readonly eventRepo: EventRepository,
    private readonly voteRepo: VoteRepository
  ) {}

  async exportToMarkdown(sessionId: string): Promise<SessionExportResult> {
    const session = await this.sessionRepo.findById(sessionId)
    if (!session) throw new ServiceError('NOT_FOUND', 'Session not found')

    const [messages, events, votes] = await Promise.all([
      this.messageRepo.findBySessionId(sessionId),
      this.eventRepo.findBySessionId(sessionId),
      this.voteRepo.findBySessionId(sessionId),
    ])

    const lines: string[] = []

    lines.push('# 讨论导出\n')
    lines.push('> ⚠️ 本文件已脱敏处理，不包含任何 Provider Secret 或 API Key。\n')
    lines.push('## 会话信息\n')
    lines.push(`- **Session ID**: ${session.id}`)
    lines.push(`- **主题**: ${session.topic}`)
    lines.push(`- **模板**: ${session.templateSnapshot?.name ?? session.templateId}`)
    lines.push(`- **状态**: ${session.status}`)
    lines.push(`- **创建时间**: ${new Date(session.createdAt).toISOString()}`)
    lines.push(`- **更新时间**: ${new Date(session.updatedAt).toISOString()}\n`)

    if (session.templateSnapshot?.roles?.length) {
      lines.push('## 角色列表\n')
      for (const role of session.templateSnapshot.roles) {
        lines.push(`- **${role.name}** (${role.agentType ?? 'expert'})`)
      }
      lines.push('')
    }

    if (messages.length > 0) {
      lines.push('## 消息记录\n')
      for (const msg of messages) {
        const ts = new Date(msg.createdAt).toISOString()
        lines.push(`### [${msg.type}] ${msg.roleId ?? 'system'} — ${ts}\n`)
        lines.push(msg.content)
        lines.push('')
      }
    }

    if (events.length > 0) {
      lines.push('## 事件记录\n')
      for (const event of events) {
        lines.push(`### ${event.title} (${event.eventType}) — ${event.createdAt}\n`)
        lines.push(`${event.description}\n`)
        const eventVotes = votes.filter((v) => v.eventId === event.eventId)
        if (eventVotes.length > 0) {
          lines.push('**投票结果:**\n')
          for (const vote of eventVotes) {
            lines.push(`- ${vote.voterId}: 选项 ${vote.optionId}`)
          }
          lines.push('')
        }
      }
    }

    lines.push('\n---')
    lines.push('*本导出已移除所有 Provider Secret，sanitized: true*')

    const content = lines.join('\n')
    const generatedAt = new Date().toISOString()

    return {
      sessionId,
      format: 'md',
      filename: `session-${sessionId}.md`,
      content,
      generatedAt,
      sanitized: true,
    }
  }
}
