# 迭代 7 技术设计：爽点事件与投票机制

## 1. 概述

本次设计基于 PRD 的 FR-001 ~ FR-020，在现有讨论系统中新增爽点事件卡、投票事件、事件检测、限频、投票结果消费和模板事件规则展示。

**核心方案**：采用“事件即消息”策略。每个 `EventRecord` 都绑定一条 host/system `DiscussionMessage`，`EventRecord.relatedMessageId` 指向该消息，消息 metadata 保存 `eventId`。这样事件能自然进入消息流、参与滚动、刷新恢复后仍可通过现有 message timeline 定位渲染。

**分层策略**：
- `engine/events.ts`：纯规则检测与纯限频判断，不访问 Repository、API、React 或浏览器环境。
- `server/services/discussion.service.ts`：事件生命周期编排，负责检测接入、限频、创建事件消息、投票校验、票数更新、Director 事件结果消费输入。
- `server/repositories/*`：事件和投票的 Mock 持久化接口与实现。
- `store/discussion.store.ts`：事件、投票、pending、乐观更新与回滚状态。
- `modules/discussion/*`：事件卡、投票网格、消息流渲染、`#` 手动触发入口。

**关键约束**：
- EventType 统一为 `slap | camp | vote | reverse`。
- 投票幂等键为 `(sessionId, eventId, voterType, voterId)`。
- 所有事件/投票读写必须校验 `sessionId`，不得跨 session 访问。
- Scheduler 不修改；Director 通过 `schedulerHint.preferredAgentType` 或真实 `roleId` 使用现有调度能力。

## 2. Impact Analysis

### 受影响的现有模块

| 文件 | 影响程度 | 变更说明 |
|------|---------|---------|
| `src/types/index.ts` | 修改 | EventType 重命名；新增 EventRecord、VoteRecord、EventPayload、VoteOption、EventDetectionResult、事件消息 metadata 类型；DirectorInput 增加 recentEvents |
| `src/types/api.ts` | 修改 | 新增事件与投票 API request/result 类型；SendMessageResult 可携带 createdEvents/eventMessages |
| `src/engine/events.ts` | 修改 | 替换 stub 为 DefaultEventDetector 与 DefaultEventRateLimiter；二者均保持纯逻辑 |
| `src/engine/director.ts` | 修改 | EventType 适配；新增事件结果消费逻辑，输出 schedulerHint |
| `src/server/services/discussion.service.ts` | 修改 | 接入 EventDetector；新增 createEvent/listEvents/submitVote；创建事件时同步写入 event message；调用 Director 前注入 recentEvents |
| `src/app/api/discussions/[sessionId]/messages/route.ts` | 修改 | 创建 DiscussionService 时注入 event/vote repositories 与 EventDetector/RateLimiter；响应透传 createdEvents/eventMessages |
| `src/server/repositories/mock/instances.ts` | 修改 | 导出共享 event/vote repositories，保证 GET/POST route 间共享 Mock 状态 |
| `src/store/discussion.store.ts` | 修改 | 新增事件/投票/pending/rollback 状态与 actions；loadSession 后加载事件；sendMessage 合并 event messages |
| `src/modules/discussion/index.tsx` | 修改 | 将 store 中 events/votes/pending 和 triggerEvent/submitVote 传给 MessageList、MessageInput |
| `src/modules/discussion/message-list.tsx` | 修改 | 根据 message metadata.eventId 渲染 EventCard；复用 userScrolledUp 处理事件滚动 |
| `src/modules/discussion/message-input.tsx` | 修改 | `#` 按钮触发投票事件创建 |
| `src/modules/templates/index.tsx` | 修改 | 展示模板事件规则 |
| `src/data/templates/three-kingdoms.ts` | 修改 | 旧 EventType 字符串更新为 `slap/camp/reverse` |
| `src/engine/director-integration.test.ts` | 修改 | 旧 EventType 字符串更新 |
| `src/server/services/discussion-director.test.ts` | 修改 | 旧 EventType 字符串更新 |
| `src/types/director-invitation-contract.test.ts` | 修改 | 旧 EventType 字符串更新 |

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/server/repositories/event.repository.ts` | EventRecord 持久化接口 |
| `src/server/repositories/vote.repository.ts` | VoteRecord 持久化接口 |
| `src/server/repositories/mock/mock-event.repository.ts` | EventRepository Mock 实现 |
| `src/server/repositories/mock/mock-vote.repository.ts` | VoteRepository Mock 实现 |
| `src/modules/discussion/event-card.tsx` | 四类事件卡组件 |
| `src/modules/discussion/vote-grid.tsx` | 投票网格组件 |
| `src/app/api/discussions/[sessionId]/events/route.ts` | 事件列表与创建 API |
| `src/app/api/discussions/[sessionId]/events/[eventId]/vote/route.ts` | 投票 API |
| `src/modules/discussion/event-card.test.ts` | EventCard 测试（03 阶段产物） |
| `src/modules/discussion/vote-grid.test.ts` | VoteGrid 测试（03 阶段产物） |
| `src/engine/events.test.ts` | EventDetector 与 EventRateLimiter 测试（03 阶段产物） |
| `src/server/services/discussion-events.test.ts` | 事件服务集成测试（03 阶段产物） |

### 兼容性分析

- **类型兼容**：旧 EventType 引用包括 `src/types/index.ts`、`src/engine/director.ts`、`src/data/templates/three-kingdoms.ts` 与现有相关测试文件，全部需要同步更新。
- **消息兼容**：保留现有 host message metadata 模式，但新增 `hostMessageKind: 'event'` 与 `eventId`。旧 `event_candidate` 仍可作为兼容显示，不作为新事件写入路径。
- **API 兼容**：新增 API 均位于 `/api/discussions/[sessionId]/events` 下；现有消息 API 只扩展响应数据，不破坏既有字段。
- **Scheduler 兼容**：`src/engine/scheduler.ts` 已支持 `schedulerHint.preferredSpeakerId` 与 `schedulerHint.preferredAgentType`。主持人解释投票结果时优先使用 `preferredAgentType: 'host'`；如果需要指定角色，则由 Service/Director 解析真实 `roleId` 后填入 `preferredSpeakerId`。

## 3. Flow Design

### 3.1 自动检测并插入事件消息

```
MessageInput → sendMessage → POST /api/discussions/:sessionId/messages
  → DiscussionService.sendMessage()
    → Orchestrator.run() 生成 agentMessages
    → 取最后一条 agent output + 当前 messageHistory
    → EventDetector.detect(session, messageHistory, lastOutput)
      → 返回 EventDetectionResult { eventTriggered, eventType, confidence, reason, title, description, payload, relatedMessageId }
    → 若 eventTriggered 且 confidence >= 0.6
      → EventRepository.findRecentBySessionId(sessionId, limit)
      → EventRateLimiter.check({ sessionId, eventType, recentMessages, recentEvents, currentMessageIndex })
      → 通过限频后调用 createEvent(sessionId, detectionResult, trigger='auto')
        → MessageRepository.save(eventMessage metadata: { hostMessageKind: 'event', eventId })
        → EventRepository.save(eventRecord relatedMessageId=eventMessage.messageId)
    → Director.decide(input with recentEvents)
      → 若 decision.action === 'trigger_event'，同样调用 createEvent(..., trigger='auto')
    → 返回原有消息结果 + createdEvents + eventMessages
  → Store 合并 agentMessages 与 eventMessages 到 messagesBySessionId
  → MessageList 按消息流顺序渲染；带 eventId 的消息渲染为 EventCard
```

### 3.2 手动触发投票事件

```
MessageInput → 用户点击 # 或输入 #投票问题
  → store.triggerEvent(sessionId, CreateEventRequest eventType='vote')
    → POST /api/discussions/:sessionId/events
      → DiscussionService.createEvent()
        → 读取 recentMessages/recentEvents
        → EventRateLimiter.check(...)
        → MessageRepository.save(eventMessage)
        → EventRepository.save(eventRecord)
        → 返回 { event, message }
  → Store 将 event 写入 eventsBySessionId，并将 message 写入 messagesBySessionId
  → MessageList 渲染投票 EventCard
```

### 3.3 投票提交流程

```
VoteGrid → 用户点击选项
  → Store dispatch VOTE_OPTIMISTIC(previousEvent, previousUserVote, optimisticVote)
  → POST /api/discussions/:sessionId/events/:eventId/vote
    → DiscussionService.submitVote(sessionId, eventId, optionId)
      → EventRepository.findById(sessionId, eventId)
      → 校验 event.sessionId === sessionId、eventType === 'vote'、status === 'active'
      → 校验 optionId 存在于 payload.options
      → voterType='user'，voterId='current-user'（当前无账号系统，后续可替换为真实用户 ID）
      → VoteRepository.findByKey(sessionId, eventId, voterType, voterId)
      → 同选项重复提交返回已有 vote + 当前 event
      → 不同选项重复提交返回 VOTE_ALREADY_CAST
      → VoteRepository.save(voteRecord)
      → EventRepository.updateTally(sessionId, eventId, optionId)
      → 返回 { vote, event }
  → 成功 dispatch VOTE_SUBMITTED，用服务端 event 覆盖乐观状态
  → 失败 dispatch VOTE_FAILED(previousEvent, previousUserVote, error)，回滚 UI
```

### 3.4 Director 消费事件结果

```
下一轮 sendMessage / resume
  → DiscussionService 从 EventRepository.findRecentBySessionId(sessionId, limit) 读取 recentEvents
  → 过滤出 status='closed' 或 vote tally 已更新且 directorConsumedAt 为空的事件
  → 构造 DirectorInput.recentEvents
  → Director.decide(input)
    → consumeEventResult(recentEvents)
      → 投票事件产生 schedulerHint { preferredAgentType: 'host', reason: '解释投票结果' }
      → camp/slap/reverse 可产生 preferredSpeakerId（真实 roleId）或 preferredAgentType
  → 若 DirectorDecision 消费了事件，DiscussionService 调用 EventRepository.markDirectorConsumed(sessionId, eventId, consumedAt)
  → Scheduler.selectSpeakers() 沿用现有 schedulerHint 逻辑
```

### 3.5 异常流程

- **事件检测失败**：返回 `{ eventTriggered: false }`，讨论继续。
- **低置信度检测**：不创建 EventRecord，仅作为 Director 输入候选。
- **同类冷却未满足**：返回 `EVENT_RATE_LIMITED`。
- **事件密度超限**：返回 `EVENT_DENSITY_EXCEEDED`。
- **事件不属于当前 session**：按 `EVENT_NOT_FOUND` 处理，避免泄露跨 session 信息。
- **非投票事件提交投票**：返回 `EVENT_NOT_VOTABLE`。
- **投票选项不存在**：返回 `OPTION_NOT_FOUND`。
- **投票已关闭**：返回 `VOTE_CLOSED`。
- **重复投票不同选项**：返回 `VOTE_ALREADY_CAST`。
- **网络或 API 失败**：Store 使用 previous snapshot 回滚乐观投票状态。

## 4. Table Design

本迭代使用 Mock 内存存储，无真实数据库表。以下为实体契约。

### EventRecord

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| eventId | string | 事件唯一 ID | `evt-{uuid}` |
| sessionId | string | 所属会话 | 必填 |
| eventType | EventType | 事件类型 | `slap\|camp\|vote\|reverse` |
| trigger | 'auto' \| 'manual' | 触发方式 | 必填 |
| status | 'active' \| 'closed' | 事件状态 | 默认 active |
| title | string | 事件标题 | 必填 |
| description | string | 事件描述 | 必填 |
| reason | string | 触发原因 | 必填 |
| payload | EventPayload | 事件负载 | 按 eventType 区分 |
| relatedMessageId | string | 事件消息 ID | 必填，指向消息流中的 event message |
| directorConsumedAt | string? | Director 消费时间 | 防止重复解释 |
| createdAt | string | 创建时间 | ISO 8601 |

### EventPayload

```typescript
type EventPayload = SlapPayload | CampPayload | VotePayload | ReversePayload

interface VotePayload {
  question: string
  options: VoteOption[]
  tally: Record<string, number>
}

interface VoteOption {
  id: string
  label: string
  roles: string[]
}
```

票数统一存放在 `VotePayload.tally`，`options[]` 不携带 `count`，避免 API、UI 与 Repository 表示不一致。

### VoteRecord

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| voteId | string | 投票记录 ID | `vote-{uuid}` |
| sessionId | string | 所属会话 | 必填 |
| eventId | string | 所属事件 | 必填 |
| voterType | 'user' \| 'role' | 投票人类型 | 本迭代用户投票固定为 user |
| voterId | string | 投票人 ID | 当前无账号系统时为 `current-user` |
| optionId | string | 选项 ID | 必须存在于 VotePayload.options |
| createdAt | string | 创建时间 | ISO 8601 |

唯一约束：`(sessionId, eventId, voterType, voterId)`。

## 5. API Design

### 5.1 事件列表

```
GET /api/discussions/[sessionId]/events
```

Response:
```json
{
  "success": true,
  "data": {
    "sessionId": "s1",
    "events": [{
      "eventId": "evt-xxx",
      "sessionId": "s1",
      "eventType": "vote",
      "trigger": "manual",
      "status": "active",
      "title": "是否需要迁都？",
      "description": "许昌还是洛阳？",
      "reason": "用户手动发起投票",
      "payload": {
        "question": "迁都何处？",
        "options": [
          { "id": "opt1", "label": "许昌", "roles": ["zgl"] },
          { "id": "opt2", "label": "洛阳", "roles": ["simayi"] }
        ],
        "tally": { "opt1": 0, "opt2": 0 }
      },
      "relatedMessageId": "msg-event-xxx",
      "createdAt": "2026-06-01T10:00:00Z"
    }],
    "votes": [{ "voteId": "vote-xxx", "eventId": "evt-xxx", "optionId": "opt1", "voterType": "user", "voterId": "current-user" }]
  },
  "requestId": "req-xxx"
}
```

错误码：`SESSION_NOT_FOUND`。

### 5.2 创建事件

```
POST /api/discussions/[sessionId]/events
```

Request:
```json
{
  "eventType": "vote",
  "title": "是否需要迁都？",
  "description": "许昌还是洛阳？",
  "payload": {
    "question": "迁都何处？",
    "options": [
      { "id": "opt1", "label": "许昌", "roles": ["zgl"] },
      { "id": "opt2", "label": "洛阳", "roles": ["simayi"] }
    ],
    "tally": { "opt1": 0, "opt2": 0 }
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "event": { "eventId": "evt-xxx", "relatedMessageId": "msg-event-xxx" },
    "message": { "messageId": "msg-event-xxx", "metadata": { "hostMessageKind": "event", "eventId": "evt-xxx" } }
  },
  "requestId": "req-xxx"
}
```

错误码：`SESSION_NOT_FOUND`, `EVENT_RATE_LIMITED`, `EVENT_DENSITY_EXCEEDED`, `VALIDATION_ERROR`。

### 5.3 提交投票

```
POST /api/discussions/[sessionId]/events/[eventId]/vote
```

Request:
```json
{ "optionId": "opt1" }
```

Response:
```json
{
  "success": true,
  "data": {
    "vote": { "voteId": "vote-xxx", "sessionId": "s1", "eventId": "evt-xxx", "optionId": "opt1", "voterType": "user", "voterId": "current-user" },
    "event": { "eventId": "evt-xxx", "payload": { "tally": { "opt1": 1, "opt2": 0 } } }
  },
  "requestId": "req-xxx"
}
```

错误码：`SESSION_NOT_FOUND`, `EVENT_NOT_FOUND`, `EVENT_NOT_VOTABLE`, `OPTION_NOT_FOUND`, `VOTE_CLOSED`, `VOTE_ALREADY_CAST`。

## 6. Module Design

### 6.1 EventDetector

```typescript
export interface EventDetectionResult {
  eventTriggered: boolean
  eventType?: EventType
  confidence: number
  reason: string
  title?: string
  description?: string
  payload?: EventPayload
  relatedMessageId?: string
}

export interface EventDetector {
  detect(session: Session, messages: DiscussionMessage[], lastOutput: AgentOutput): Promise<EventDetectionResult>
}
```

规则：
- `slap`：最近 5 条消息中出现反驳信号（反对、不同意、反驳、不认为、错、误）且可定位被反驳观点。
- `camp`：至少两个角色围绕同一议题出现不同立场信号。
- `vote`：出现无法定夺、各有利弊、需要选择、请大家投票等信号。
- `reverse`：出现如果、反过来、前提变化、新变量、极端情况等信号。
- `confidence < 0.6` 时不自动创建事件。

### 6.2 EventRateLimiter

```typescript
export interface EventRateLimitInput {
  sessionId: string
  eventType: EventType
  recentMessages: DiscussionMessage[]
  recentEvents: EventRecord[]
  currentMessageIndex: number
}

export interface EventRateLimiter {
  check(input: EventRateLimitInput): RateLimitResult
}

export interface RateLimitResult {
  allowed: boolean
  reason?: 'COOLDOWN' | 'DENSITY'
}
```

限频基于持久化 events + 当前 messages 计算，不依赖跨请求内存状态：
- 同类冷却：最近同类型事件的 `relatedMessageId` 与当前消息之间必须间隔至少 3 条角色/主持人消息。
- 密度限制：最近 10 条 timeline item 中事件卡不超过 3 张。

### 6.3 EventRepository

```typescript
export interface EventRepository {
  findById(sessionId: string, eventId: string): Promise<EventRecord | null>
  findBySessionId(sessionId: string): Promise<EventRecord[]>
  findRecentBySessionId(sessionId: string, limit: number): Promise<EventRecord[]>
  save(event: EventRecord): Promise<EventRecord>
  updateStatus(sessionId: string, eventId: string, status: EventRecord['status']): Promise<EventRecord | null>
  updateTally(sessionId: string, eventId: string, optionId: string): Promise<EventRecord | null>
  markDirectorConsumed(sessionId: string, eventId: string, consumedAt: string): Promise<EventRecord | null>
}
```

### 6.4 VoteRepository

```typescript
export interface VoteRepository {
  findByEventId(sessionId: string, eventId: string): Promise<VoteRecord[]>
  findByKey(sessionId: string, eventId: string, voterType: VoteRecord['voterType'], voterId: string): Promise<VoteRecord | null>
  save(vote: VoteRecord): Promise<VoteRecord>
  countByOption(sessionId: string, eventId: string, optionId: string): Promise<number>
}
```

### 6.5 DiscussionService 新增/扩展方法

```typescript
async createEvent(sessionId: string, params: CreateEventRequest, trigger?: EventRecord['trigger']): Promise<CreateEventResult>
async listEvents(sessionId: string): Promise<EventListResult>
async submitVote(sessionId: string, eventId: string, params: VoteRequest): Promise<VoteResult>
```

扩展行为：
- `sendMessage` 在 agent 输出后调用 `EventDetector.detect()`，并在通过限频后调用 `createEvent()`。
- `createEvent()` 必须先创建 event message，再保存 EventRecord，并返回 `{ event, message }`。
- `submitVote()` 必须先按 `(sessionId,eventId)` 读取事件并校验 session、类型、状态和 option。
- 调用 Director 前由 Service 读取 `recentEvents` 并注入 `DirectorInput.recentEvents`。
- Director 消费事件后由 Service 调用 `markDirectorConsumed()`。

### 6.6 Store 状态与 Action

状态字段：
```typescript
eventsBySessionId: Record<string, EventRecord[]>
votesByEventId: Record<string, VoteRecord[]>
eventLoadingBySessionId: Record<string, boolean>
eventErrorBySessionId: Record<string, ApiError | null>
votePendingByEventId: Record<string, boolean>
voteRollbackByEventId: Record<string, { previousEvent: EventRecord; previousUserVote?: VoteRecord }>
```

Action：
```typescript
triggerEvent(sessionId: string, params: CreateEventRequest): Promise<void>
submitVote(sessionId: string, eventId: string, optionId: string): Promise<void>
loadEvents(sessionId: string): Promise<void>
```

Reducer action types：
```typescript
| { type: 'EVENTS_LOADED'; sessionId: string; events: EventRecord[]; votes: VoteRecord[] }
| { type: 'EVENT_CREATED'; sessionId: string; event: EventRecord; message: DiscussionMessage }
| { type: 'VOTE_OPTIMISTIC'; sessionId: string; eventId: string; previousEvent: EventRecord; previousUserVote?: VoteRecord; optimisticVote: VoteRecord }
| { type: 'VOTE_SUBMITTED'; sessionId: string; eventId: string; vote: VoteRecord; event: EventRecord }
| { type: 'VOTE_FAILED'; sessionId: string; eventId: string; error: ApiError; previousEvent: EventRecord; previousUserVote?: VoteRecord }
| { type: 'EVENT_ERROR_SET'; sessionId: string; error: ApiError | null }
```

### 6.7 UI 组件

**EventCard**：
- Props: `{ event: EventRecord; votes: VoteRecord[]; onVote: (optionId: string) => void; userVote?: VoteRecord; votePending?: boolean }`
- `slap`：展示反驳双方、被反驳观点和原因。
- `camp`：展示阵营、角色头像和立场摘要。
- `vote`：渲染 VoteGrid。
- `reverse`：展示前提、新变量和影响。

**VoteGrid**：
- Props: `{ options: VoteOption[]; tally: Record<string, number>; selectedOptionId?: string; disabled: boolean; onVote: (optionId: string) => void }`
- 票数只读取 `payload.tally`。
- disabled 或 votePending 时禁止重复点击。

### 6.8 模块依赖

```
modules/discussion/index.tsx
  → MessageInput / MessageList
  → store/discussion.store
  → API routes
  → DiscussionService
      → MessageRepository
      → EventRepository
      → VoteRepository
      → EventDetector
      → EventRateLimiter
      → Director
      → Scheduler（现有 schedulerHint）
```

## 7. Output Contract

### 7.1 类型化测试标准

| 产物 | 类型 | 测试规范 |
|------|------|---------|
| 事件/投票 HTTP API | web-e2e | `standards/testing/web-e2e.md` |
| EventCard、VoteGrid、消息流集成、`#` 触发入口 | frontend-ui | `standards/testing/frontend-ui.md` |
| EventDetector、EventRateLimiter、DiscussionService 事件链路、Director 事件消费 | integration | `standards/testing/integration.md` |

本迭代不涉及 SQL/query generator、CLI、batch-job、messaging consumer/producer、library/SDK，因此不触发 `sql-query`、`cli`、`batch-job`、`messaging`、`library`。

### 7.2 跨组件链路

- **自动检测事件链路**：`Message API → DiscussionService.sendMessage → Orchestrator → EventDetector → EventRateLimiter → MessageRepository/EventRepository → Store → MessageList/EventCard`（type id: integration + frontend-ui）
- **手动投票事件链路**：`MessageInput(#) → Store.triggerEvent → POST /events → DiscussionService.createEvent → MessageRepository/EventRepository → Store → MessageList/EventCard`（type id: web-e2e + frontend-ui）
- **投票提交链路**：`VoteGrid → Store.submitVote → POST /vote → DiscussionService.submitVote → VoteRepository/EventRepository.updateTally → Store rollback/success → VoteGrid`（type id: web-e2e + frontend-ui）
- **事件结果消费链路**：`EventRepository.recentEvents → DiscussionService → Director.consumeEventResult → schedulerHint → Scheduler.selectSpeakers`（type id: integration）

## 8. Change Log

| 文件 | 变更类型 | 变更原因 |
|------|---------|---------|
| `src/types/index.ts` | 修改 | 定义事件、投票、检测、消息 metadata、DirectorInput recentEvents 契约 |
| `src/types/api.ts` | 修改 | 定义事件列表、创建、投票 API DTO；扩展 SendMessageResult |
| `src/engine/events.ts` | 修改 | 实现纯 EventDetector 与 EventRateLimiter |
| `src/engine/director.ts` | 修改 | 适配新 EventType；消费 recentEvents 并输出 schedulerHint |
| `src/server/services/discussion.service.ts` | 修改 | 接入检测、事件消息创建、投票校验、Director 事件消费输入 |
| `src/app/api/discussions/[sessionId]/messages/route.ts` | 修改 | 注入事件相关依赖，透传 createdEvents/eventMessages |
| `src/app/api/discussions/[sessionId]/events/route.ts` | 新增 | 事件列表与创建 API |
| `src/app/api/discussions/[sessionId]/events/[eventId]/vote/route.ts` | 新增 | 投票提交 API |
| `src/server/repositories/event.repository.ts` | 新增 | EventRepository 接口 |
| `src/server/repositories/vote.repository.ts` | 新增 | VoteRepository 接口 |
| `src/server/repositories/mock/mock-event.repository.ts` | 新增 | EventRepository Mock 实现 |
| `src/server/repositories/mock/mock-vote.repository.ts` | 新增 | VoteRepository Mock 实现 |
| `src/server/repositories/mock/instances.ts` | 修改 | 导出共享 event/vote repositories |
| `src/store/discussion.store.ts` | 修改 | 事件/投票状态、乐观更新、回滚、恢复加载 |
| `src/modules/discussion/index.tsx` | 修改 | 连接 store events/votes/pending 与 MessageList/MessageInput props |
| `src/modules/discussion/message-list.tsx` | 修改 | 根据 event message metadata 渲染 EventCard，并处理滚动 |
| `src/modules/discussion/message-input.tsx` | 修改 | `#` 手动触发投票事件 |
| `src/modules/discussion/event-card.tsx` | 新增 | 事件卡 UI |
| `src/modules/discussion/vote-grid.tsx` | 新增 | 投票网格 UI |
| `src/modules/templates/index.tsx` | 修改 | 模板事件规则展示 |
| `src/data/templates/three-kingdoms.ts` | 修改 | 模板事件类型更新 |
| `src/engine/director-integration.test.ts` | 修改 | 旧 EventType 测试引用更新 |
| `src/server/services/discussion-director.test.ts` | 修改 | 旧 EventType 测试引用更新 |
| `src/types/director-invitation-contract.test.ts` | 修改 | 旧 EventType 测试引用更新 |
| `src/modules/discussion/event-card.test.ts` | 新增 | 03 阶段 UI 测试 |
| `src/modules/discussion/vote-grid.test.ts` | 新增 | 03 阶段 UI 测试 |
| `src/engine/events.test.ts` | 新增 | 03 阶段 engine 测试 |
| `src/server/services/discussion-events.test.ts` | 新增 | 03 阶段 service 集成测试 |

## 9. Development Tasks

- Task-01：定义事件、投票、检测和 API 契约
  - 任务类型：contract
  - 所属模块：types
  - 简要描述：定义 EventType、EventRecord、VoteRecord、EventPayload、SlapPayload、CampPayload、VotePayload、ReversePayload、VoteOption、EventDetectionResult、事件消息 metadata、DirectorInput.recentEvents、CreateEventRequest、VoteRequest、EventListResult、CreateEventResult、VoteResult，并扩展 SendMessageResult 支持 createdEvents/eventMessages。
  - 涉及接口/方法：EventRecord, VoteRecord, EventPayload, EventDetectionResult, CreateEventRequest, VoteRequest, EventListResult, CreateEventResult, VoteResult
  - 输入：设计文档中的类型契约
  - 输出：可被后续模块 import 的类型声明
  - 依赖任务：无
  - 数据操作：无
  - 修改边界：只修改 `src/types/index.ts` 与 `src/types/api.ts` 的类型声明区域
  - 禁止行为：不得删除现有非事件类型；不得改变既有 API response envelope
  - 产出类型：integration
  - 功能类型：事件与投票类型契约（type id: integration）
  - 是否跨组件：否

- Task-02：实现四类事件检测规则
  - 任务类型：business-implementation
  - 所属模块：engine/events
  - 简要描述：实现 DefaultEventDetector.detect()，基于关键词规则检测 slap/camp/vote/reverse，低置信度不触发事件。
  - 涉及接口/方法：EventDetector.detect()
  - 输入：Session, DiscussionMessage[], AgentOutput
  - 输出：EventDetectionResult
  - 依赖任务：Task-01（类型契约）
  - 数据操作：无
  - 修改边界：只替换 `src/engine/events.ts` 中 DefaultEventDetector.detect() stub，并新增私有检测方法
  - 禁止行为：不得访问 Repository、API、React 或浏览器对象
  - 产出类型：integration
  - 功能类型：自动事件检测（type id: integration）
  - 是否跨组件：否

- Task-03：实现基于消息和事件历史的事件限频
  - 任务类型：business-implementation
  - 所属模块：engine/events
  - 简要描述：实现 EventRateLimiter.check(input)，基于 recentMessages/recentEvents/currentMessageIndex 判断同类冷却和事件密度。
  - 涉及接口/方法：EventRateLimiter.check()
  - 输入：EventRateLimitInput
  - 输出：RateLimitResult
  - 依赖任务：Task-01（类型契约）
  - 数据操作：无
  - 修改边界：只在 `src/engine/events.ts` 新增 EventRateLimiter 接口、EventRateLimitInput 和 DefaultEventRateLimiter
  - 禁止行为：不得使用跨请求内存 Map 作为唯一限频来源
  - 产出类型：integration
  - 功能类型：事件冷却与密度限制（type id: integration）
  - 是否跨组件：否

- Task-04：实现事件与投票 Mock 持久化契约
  - 任务类型：contract
  - 所属模块：server/repositories
  - 简要描述：定义并实现 session-scoped EventRepository 与 VoteRepository，所有读写方法必须包含 sessionId 校验；Mock 实现保持不可变更新。
  - 涉及接口/方法：EventRepository, VoteRepository
  - 输入：EventRecord, VoteRecord, sessionId, eventId, optionId
  - 输出：EventRecord | VoteRecord | null | EventRecord[] | VoteRecord[] | number
  - 依赖任务：Task-01（类型契约）
  - 数据操作：读写 event/vote 内存 Map
  - 修改边界：只新增 `src/server/repositories/event.repository.ts`、`src/server/repositories/vote.repository.ts`、`src/server/repositories/mock/mock-event.repository.ts`、`src/server/repositories/mock/mock-vote.repository.ts`
  - 禁止行为：不得修改现有 repository 接口语义；不得跨 session 返回记录
  - 产出类型：integration
  - 功能类型：事件与投票持久化契约（type id: integration）
  - 是否跨组件：否

- Task-05：接入共享事件与投票 Mock 仓储
  - 任务类型：integration
  - 所属模块：server/repositories/mock
  - 简要描述：在 shared mock instances 中导出 eventRepository 和 voteRepository，保证事件创建、列表查询、投票 API 之间共享 Mock 状态。
  - 涉及接口/方法：mock repository instances
  - 输入：MockEventRepository, MockVoteRepository
  - 输出：共享 repository 实例
  - 依赖任务：Task-04（Mock repository 实现）
  - 数据操作：初始化共享内存 repository 实例
  - 修改边界：只修改 `src/server/repositories/mock/instances.ts` 的导出列表
  - 禁止行为：不得重建现有 discussion/session/message/template repository 实例
  - 产出类型：integration
  - 功能类型：Mock 持久化共享实例（type id: integration）
  - 是否跨组件：否

- Task-06：实现事件创建并将事件写入消息流
  - 任务类型：business-implementation
  - 所属模块：server/services
  - 简要描述：实现 DiscussionService.createEvent()：校验 session、读取 recentMessages/recentEvents、限频、创建 host/system event message、保存 EventRecord、返回 { event, message }。
  - 涉及接口/方法：DiscussionService.createEvent()
  - 输入：sessionId, CreateEventRequest, trigger
  - 输出：CreateEventResult
  - 依赖任务：Task-03（限频）、Task-04（repository）、Task-05（共享实例）
  - 数据操作：读 SessionRepository；读 MessageRepository；写 MessageRepository；读写 EventRepository
  - 修改边界：只在 `src/server/services/discussion.service.ts` 新增 createEvent 方法和必要构造参数
  - 禁止行为：不得只保存 EventRecord 而不创建 event message；不得绕过 MessageRepository 直接修改 store
  - 产出类型：web-e2e
  - 功能类型：事件创建与消息流插入（type id: web-e2e）
  - 是否跨组件：是（组件链路：API Route → DiscussionService → MessageRepository → EventRepository）

- Task-07：在发送消息后接入自动事件检测
  - 任务类型：integration
  - 所属模块：server/services
  - 简要描述：在 DiscussionService 的发送消息流程中，Orchestrator 生成 agent output 后调用 EventDetector.detect()；检测成功且通过限频时调用 createEvent()；响应中携带 createdEvents/eventMessages。
  - 涉及接口/方法：DiscussionService.sendMessage(), EventDetector.detect(), DiscussionService.createEvent()
  - 输入：sessionId, messageHistory, lastOutput
  - 输出：SendMessageResult（含 createdEvents/eventMessages）
  - 依赖任务：Task-02（检测）、Task-06（事件创建）
  - 数据操作：读 MessageRepository；读写 EventRepository；写 MessageRepository
  - 修改边界：只修改 `src/server/services/discussion.service.ts` 的 sendMessage/side-effect 事件相关分支
  - 禁止行为：不得修改 Orchestrator 公共接口；不得在 EventDetector 中写存储
  - 产出类型：integration
  - 功能类型：自动检测事件闭环（type id: integration）
  - 是否跨组件：是（组件链路：DiscussionService → EventDetector → EventRateLimiter → MessageRepository → EventRepository）

- Task-08：实现投票提交、幂等和票数更新
  - 任务类型：business-implementation
  - 所属模块：server/services
  - 简要描述：实现 DiscussionService.submitVote()，按 sessionId/eventId 读取事件并校验 session、类型、状态、option；使用固定 voter identity 做幂等；保存 vote；更新 VotePayload.tally。
  - 涉及接口/方法：DiscussionService.submitVote()
  - 输入：sessionId, eventId, VoteRequest
  - 输出：VoteResult
  - 依赖任务：Task-04（repository）
  - 数据操作：读 EventRepository.findById(sessionId,eventId)；读写 VoteRepository；写 EventRepository.updateTally(sessionId,eventId,optionId)
  - 修改边界：只在 `src/server/services/discussion.service.ts` 新增 submitVote 方法和相关错误分支
  - 禁止行为：不得用 eventId 单独查询事件；不得允许跨 session 投票；不得把票数写入 options[].count
  - 产出类型：web-e2e
  - 功能类型：投票提交与幂等控制（type id: web-e2e）
  - 是否跨组件：是（组件链路：API Route → DiscussionService → VoteRepository → EventRepository）

- Task-09：实现事件列表和事件/投票 API 路由
  - 任务类型：api
  - 所属模块：app/api/discussions
  - 简要描述：实现 GET/POST `/events` 和 POST `/events/[eventId]/vote`，并修改 messages route 注入事件相关依赖与透传 createdEvents/eventMessages。
  - 涉及接口/方法：GET/POST events route, POST vote route, messages POST route
  - 输入：CreateEventRequest, VoteRequest
  - 输出：EventListResult, CreateEventResult, VoteResult, SendMessageResult
  - 依赖任务：Task-05（共享实例）、Task-06（createEvent）、Task-08（submitVote）
  - 数据操作：无直接数据操作（通过 DiscussionService）
  - 修改边界：只新增两个 events route 文件；只修改 `src/app/api/discussions/[sessionId]/messages/route.ts` 中 DiscussionService 构造参数与响应透传
  - 禁止行为：不得在 route 中直接操作 EventRepository/VoteRepository；不得改变现有 response envelope
  - 产出类型：web-e2e
  - 功能类型：事件与投票 HTTP API（type id: web-e2e）
  - 是否跨组件：否

- Task-10：实现事件与投票前端状态、乐观更新和回滚
  - 任务类型：business-implementation
  - 所属模块：store
  - 简要描述：新增 events/votes/pending/rollback 状态；实现 loadEvents、triggerEvent、submitVote。submitVote 先 dispatch VOTE_OPTIMISTIC，成功 dispatch VOTE_SUBMITTED，失败 dispatch VOTE_FAILED 并恢复 previousEvent/previousUserVote。
  - 涉及接口/方法：DiscussionActions.loadEvents(), triggerEvent(), submitVote()
  - 输入：sessionId, CreateEventRequest, eventId, optionId
  - 输出：store 状态更新
  - 依赖任务：Task-09（API 路由）
  - 数据操作：调用 GET/POST event/vote API；更新全局 store 状态
  - 修改边界：只修改 `src/store/discussion.store.ts` 的状态字段、action union、reducer case、actions 实现
  - 禁止行为：不得删除现有消息、邀请、总结 action；不得在失败时保留错误乐观票数
  - 产出类型：frontend-ui
  - 功能类型：事件/投票前端状态与回滚（type id: frontend-ui）
  - 是否跨组件：否

- Task-11：实现事件卡与投票网格组件
  - 任务类型：ui
  - 所属模块：modules/discussion
  - 简要描述：实现 EventCard 和 VoteGrid，支持 slap/camp/vote/reverse 四类展示；VoteGrid 读取 payload.tally、显示用户选择、pending 禁用重复点击。
  - 涉及接口/方法：EventCard(), VoteGrid()
  - 输入：EventRecord, VoteRecord[], VoteOption[], tally, callbacks
  - 输出：React 组件渲染
  - 依赖任务：Task-01（类型契约）
  - 数据操作：无
  - 修改边界：只新增 `src/modules/discussion/event-card.tsx` 与 `src/modules/discussion/vote-grid.tsx`
  - 禁止行为：不得修改 MessageBubble/MessageList；不得在组件内调用 API
  - 产出类型：frontend-ui
  - 功能类型：事件卡与投票网格 UI（type id: frontend-ui）
  - 是否跨组件：否

- Task-12：将事件卡接入消息流并保持滚动体验
  - 任务类型：ui
  - 所属模块：modules/discussion
  - 简要描述：MessageList 根据 message.metadata.eventId 查找 EventRecord，命中时渲染 EventCard；事件消息新增时若用户在底部则自动滚动，否则不抢滚动。
  - 涉及接口/方法：MessageList
  - 输入：messages, events, votes, votePending, onVote
  - 输出：消息流中按位置渲染 EventCard
  - 依赖任务：Task-10（store 状态）、Task-11（EventCard/VoteGrid）
  - 数据操作：无
  - 修改边界：只修改 `src/modules/discussion/message-list.tsx` 的 Props、messages.map 渲染分支和滚动依赖
  - 禁止行为：不得删除现有 error/intentError/typing 渲染；不得改变用户上滑不抢滚动规则
  - 产出类型：frontend-ui
  - 功能类型：消息流事件卡展示（type id: frontend-ui）
  - 是否跨组件：是（组件链路：MessageList → EventCard → VoteGrid）

- Task-13：实现讨论页面事件交互接线和手动触发
  - 任务类型：ui
  - 所属模块：modules/discussion
  - 简要描述：在 discussion/index.tsx 中读取 store 的 events/votes/pending/actions 并传入 MessageList、MessageInput；MessageInput 的 `#` 按钮或 `#投票问题` 调用 onTriggerEvent。
  - 涉及接口/方法：DiscussionModule, MessageInput
  - 输入：store state/actions, 用户点击 # 或输入 #投票问题
  - 输出：触发投票事件创建并在消息流显示
  - 依赖任务：Task-10（store actions）、Task-12（MessageList 事件渲染）
  - 数据操作：无
  - 修改边界：只修改 `src/modules/discussion/index.tsx` 的 props 接线；只修改 `src/modules/discussion/message-input.tsx` 的 # 触发逻辑和 Props
  - 禁止行为：不得删除 @、总结、发送、邀请相关入口；不得把非投票手动触发暴露为额外 UI
  - 产出类型：frontend-ui
  - 功能类型：手动触发投票事件闭环（type id: frontend-ui）
  - 是否跨组件：是（组件链路：MessageInput → Store → API → MessageList）

- Task-14：实现会话恢复时事件和投票状态加载
  - 任务类型：business-implementation
  - 所属模块：store
  - 简要描述：loadSession 成功后调用 loadEvents；sendMessage 或 triggerEvent 返回 event message 后合并消息与事件，刷新恢复后事件卡仍按 relatedMessageId 显示在消息流。
  - 涉及接口/方法：DiscussionActions.loadSession(), loadEvents(), sendMessage(), triggerEvent()
  - 输入：sessionId
  - 输出：messagesBySessionId、eventsBySessionId、votesByEventId 一致更新
  - 依赖任务：Task-10（loadEvents）、Task-12（MessageList 渲染）
  - 数据操作：调用 GET /events；更新 store 状态
  - 修改边界：只修改 `src/store/discussion.store.ts` 中 loadSession/sendMessage/triggerEvent 的事件相关合并逻辑
  - 禁止行为：不得改变消息分页语义；不得重复插入同一 event message
  - 产出类型：frontend-ui
  - 功能类型：事件刷新恢复（type id: frontend-ui）
  - 是否跨组件：否

- Task-15：实现 Director 消费事件结果并产生调度提示
  - 任务类型：business-implementation
  - 所属模块：engine/director
  - 简要描述：DirectorInput 增加 recentEvents；DefaultDirector.decide() 消费未被 directorConsumedAt 标记的事件，投票事件优先产生 `schedulerHint.preferredAgentType='host'`，其他事件可产生真实 roleId 的 preferredSpeakerId。
  - 涉及接口/方法：DefaultDirector.decide(), consumeEventResult()
  - 输入：DirectorInput.recentEvents
  - 输出：DirectorDecisionRecord.schedulerHint
  - 依赖任务：Task-01（DirectorInput 类型）
  - 数据操作：无
  - 修改边界：只修改 `src/engine/director.ts` 的 EventType 引用、DirectorInput 消费逻辑和私有 helper；不得修改 scheduler.ts
  - 禁止行为：不得使用字面量 `preferredSpeakerId: 'host'`；不得访问 Repository
  - 产出类型：integration
  - 功能类型：事件结果驱动后续讨论（type id: integration）
  - 是否跨组件：否

- Task-16：在服务层注入 recentEvents 并标记 Director 消费状态
  - 任务类型：integration
  - 所属模块：server/services
  - 简要描述：DiscussionService 调用 Director 前读取 recentEvents 并传入 DirectorInput；若 DirectorDecision 消费事件，则调用 EventRepository.markDirectorConsumed，避免重复解释。
  - 涉及接口/方法：DiscussionService.runDirectorAndProduceSideEffects(), EventRepository.markDirectorConsumed()
  - 输入：sessionId, recentEvents, DirectorDecisionRecord
  - 输出：包含 schedulerHint 的 DirectorDecisionRecord；被标记 consumed 的 EventRecord
  - 依赖任务：Task-15（Director 消费逻辑）、Task-04（EventRepository）
  - 数据操作：读 MessageRepository（recentMessages）；读 EventRepository.findRecentBySessionId（recentEvents）；写 EventRepository.markDirectorConsumed；调用 Scheduler.selectSpeakers（沿用现有 schedulerHint 逻辑，不修改 Scheduler）
  - 修改边界：只修改 `src/server/services/discussion.service.ts` 中 DirectorInput 构造和 DirectorDecision 后处理
  - 禁止行为：不得让 Director 直接访问 Repository；不得重复消费已标记事件；不得修改 Scheduler.selectSpeakers
  - 产出类型：integration
  - 功能类型：Director 事件消费服务接入（type id: integration）
  - 是否跨组件：是（组件链路：DiscussionService → EventRepository → Director → Scheduler.selectSpeakers）

- Task-17：更新模板事件规则数据与展示
  - 任务类型：ui
  - 所属模块：modules/templates
  - 简要描述：更新 three-kingdoms 模板事件类型为新 EventType，并在模板页事件 Tab 展示事件规则；无规则时展示空状态。
  - 涉及接口/方法：TemplatesModule, TemplateEventsPanel
  - 输入：Template.events
  - 输出：事件规则列表 UI
  - 依赖任务：Task-01（EventType 类型）
  - 数据操作：读本地模板数据文件
  - 修改边界：只修改 `src/data/templates/three-kingdoms.ts` 的事件 type 字符串；只修改 `src/modules/templates/index.tsx` 的事件规则区域
  - 禁止行为：不得修改模板角色、世界观、节奏配置；不得删除模板页其他区域
  - 产出类型：frontend-ui
  - 功能类型：模板事件规则展示（type id: frontend-ui）
  - 是否跨组件：否

- Task-18：更新旧 EventType 引用以保持现有测试契约一致
  - 任务类型：contract
  - 所属模块：tests/contracts
  - 简要描述：将现有测试文件中的旧 EventType 字符串更新为 `slap/camp/reverse`，保持类型契约变更后测试可编译。
  - 涉及接口/方法：director integration/contract tests
  - 输入：旧 EventType 字符串
  - 输出：新 EventType 字符串
  - 依赖任务：Task-01（EventType 重命名）
  - 数据操作：无
  - 修改边界：只修改 `src/engine/director-integration.test.ts`、`src/server/services/discussion-director.test.ts`、`src/types/director-invitation-contract.test.ts` 中旧 EventType 字符串
  - 禁止行为：不得修改测试行为断言；不得新增新测试用例
  - 产出类型：integration
  - 功能类型：既有测试契约适配（type id: integration）
  - 是否跨组件：否
