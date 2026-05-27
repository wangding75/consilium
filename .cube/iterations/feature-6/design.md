# 迭代 6 技术设计：导演逻辑、邀请与收束

## 1. 概述

本次设计在现有 `/discussion/[sessionId]` 会话详情页和消息发送链路中接入 Director 导演逻辑，使讨论从单纯轮转发言升级为由主持人根据会话阶段、消息历史、用户意图和调度结果进行控场。

整体采用“服务层内聚方案”：以 `DiscussionService` 作为编排入口，复用现有 `IntentClassifier`、`RoundRobinScheduler`、`DiscussionOrchestrator`、`MessageRepository` 和 `SessionRepository`，新增 Director 决策模型、邀请仓储与 UI 组件。该方案避免重写调度器和运行时，只在现有消息链路中插入可测试的 Director 决策、邀请状态变更、主持人消息和总结完成逻辑。

核心原则：

- 最小改动：保留现有 `/api/discussions/[sessionId]/messages`、`/intent`、session status API 与 mock repository 架构。
- 可测试：Director 使用规则化默认实现和可注入接口，不依赖真实 LLM 随机输出。
- 状态一致：邀请、消息、阶段、session status 均通过服务层顺序更新。
- 前端轻量：邀请和阶段变化进入现有消息流与输入区，不新增独立阶段评估面板。
- 安全展示：用户回应和指令内容继续按 React 文本节点渲染，不使用 HTML 注入。

## 2. Impact Analysis

| 模块/文件 | 影响程度 | 影响说明 |
|---|---|---|
| `src/types/index.ts` | 修改 | 新增 Director、Invitation、Summary、消息 metadata 类型；调整 Director action 为 PRD 要求的 `continue`、`invite_user`、`trigger_event`、`conclude`。 |
| `src/types/api.ts` | 修改 | 新增邀请查询、邀请回应、邀请跳过、总结触发的请求/响应类型；扩展 `SendMessageResult` 携带 Director 后续状态。 |
| `src/engine/director.ts` | 修改 | 将占位 `DefaultDirector` 扩展为规则化结构化决策接口与骨架实现。 |
| `src/engine/orchestrator.ts` | 修改 | 扩展输入支持 Director scheduler hint 和 host message kind；保留现有 speaker selection 与 agent runtime。 |
| `src/server/repositories/invitation.repository.ts` | 新增 | 定义 invitation 持久化接口。 |
| `src/server/repositories/director-decision.repository.ts` | 新增 | 定义 Director 决策记录持久化接口。 |
| `src/server/repositories/mock/mock-invitation.repository.ts` | 新增 | Mock invitation repository 骨架。 |
| `src/server/repositories/mock/mock-director-decision.repository.ts` | 新增 | Mock Director decision repository 骨架。 |
| `src/server/repositories/mock/instances.ts` | 修改 | 暴露 shared invitation/director decision repositories。 |
| `src/server/repositories/message.repository.ts` | 修改 | 增加按消息 ID 查询或追加 metadata 的接口，用于邀请幂等与总结 checkpoint。 |
| `src/server/services/discussion.service.ts` | 修改 | 在发送消息、邀请回应、跳过邀请、总结触发中编排 Director、仓储和消息产出。 |
| `src/app/api/discussions/[sessionId]/messages/route.ts` | 修改 | 复用现有消息发送 endpoint，返回 pending invitation/summary 状态；邀请回应不经此 endpoint。 |
| `src/app/api/discussions/[sessionId]/invitations/route.ts` | 新增 | 查询当前 session 的 pending invitation。 |
| `src/app/api/discussions/[sessionId]/invitations/[invitationId]/response/route.ts` | 新增 | 处理邀请文本回应。 |
| `src/app/api/discussions/[sessionId]/invitations/[invitationId]/skip/route.ts` | 新增 | 处理跳过邀请。 |
| `src/app/api/discussions/[sessionId]/summary/route.ts` | 新增 | 处理“总结当前结论”主动触发。 |
| `src/app/api/sessions/[sessionId]/status/route.ts` | 修改 | 扩展 resume action 对总结后继续追问的状态恢复语义。 |
| `src/server/services/session.service.ts` | 修改 | 扩展 resume action：当 completed + closing 且存在 summary checkpoint 时恢复为 running 并保留 checkpoint。 |
| `src/modules/discussion/index.tsx` | 修改 | 装配 InviteCard、总结完成入口、更多操作真实触发、输入区高亮。 |
| `src/modules/discussion/invite-card.tsx` | 新增 | 邀请卡 UI 骨架。 |
| `src/modules/discussion/summary-actions.tsx` | 新增 | 总结后返回首页、查看会话页、继续追问入口骨架。 |
| `src/modules/discussion/message-bubble.tsx` | 修改 | 支持主持人消息类型样式与 summary metadata 展示。 |
| `src/modules/discussion/message-list.tsx` | 修改 | 在消息流内展示主持人控场、事件候选、总结反馈。 |
| `src/modules/discussion/message-input.tsx` | 修改 | 增加 invitation 高亮提示与邀请回应模式。 |
| `src/modules/discussion/more-sheet.tsx` | 修改 | “总结当前结论”调用真实 summary action，不再只显示占位提示。 |
| `src/store/discussion.store.ts` | 修改 | 增加 invitation、summary、director error 状态与 actions。 |

### 现有接口兼容性

- 保持统一响应 envelope：`{ success, data, error, requestId }`。
- `POST /api/discussions/[sessionId]/messages` 仅处理普通用户发言；邀请回应必须走 dedicated invitation response endpoint，以保证邀请状态机和幂等语义唯一。
- 新增 endpoint 不改变既有 session、messages、intent endpoint 行为。
- `SendMessageResult` 新增字段为可选或向后兼容字段，旧调用方可忽略。

### 现有数据兼容性

- 不引入远端数据库，不修改 `Session` 已有必填字段。
- 邀请和 Director 决策使用新增 mock repositories 保存，后续可替换为 IndexedDB 或真实持久层。
- 已有消息继续保留；新增主持人控场、事件候选、总结消息通过 `DiscussionMessage.metadata` 区分语义。
- session 只有在总结消息成功保存后才允许更新为 `completed`。

## 3. Flow Design

### 3.1 普通发言与 Director 决策流程

1. UI 调用 `actions.sendMessage(sessionId, content)`。
2. Store 生成 `clientMessageId` 并插入 optimistic user message。
3. Store 调用 `POST /api/discussions/[sessionId]/intent` 获取可选 `IntentResult`。
4. Store 调用 `POST /api/discussions/[sessionId]/messages`。
5. `DiscussionService.sendUserMessage()` 校验 session 存在且可操作。
6. 服务层根据 `clientMessageId` 做幂等检查，避免重复用户消息。
7. 服务层保存或复用用户消息。
8. 服务层读取 session、messages、roles、pending invitation 和 intent。
9. `DefaultDirector.decide()` 输出结构化 `DirectorDecisionRecord`。
10. 服务层保存 Director 决策记录。
11. 当 action 为 `continue`：调用现有 `DiscussionOrchestrator.run()` 生成下一条角色或主持人消息。
12. 当 action 为 `invite_user`：创建 pending invitation，保存主持人邀请消息，返回 InviteCard 数据。
13. 当 action 为 `trigger_event`：保存主持人事件候选解释消息，不创建真实 EventRecord 或投票交互。
14. 当 action 为 `conclude`：生成主持人总结消息；保存成功后推进 state 到 `closing` 并将 session 标记为 `completed`。
15. API 返回 user message、agent/host messages、active speaker、pending invitation 和 summary 状态。
16. Store 合并消息并更新 invitation/summary 状态。

异常流程：

- Director 决策失败：返回 `DIRECTOR_DECISION_FAILED`，用户看到“暂时无法判断下一步”，已保存用户消息标记为 failed 或保留为可重试状态；session 不完成。
- 无可调度角色：返回 `NO_AVAILABLE_AGENT`，用户可重试或继续普通发言。
- 非法阶段变化：返回 `INVALID_STATE_TRANSITION`，保留原 session state。
- 消息保存失败：不得创建 invitation 或完成 session。

### 3.2 邀请创建与频率控制流程

1. Director 判断是否满足邀请条件：明显分歧、分叉、接近收束或角色质疑用户。
2. 服务层查询 `InvitationRepository.findPendingBySessionId(sessionId)`。
3. 若存在 pending invitation，Director 不得创建新邀请，改为 `continue` 或返回已有 invitation。
4. 服务层查询最近 invitation 历史，检查冷却窗口和总次数。
5. 满足节流条件时创建 `Invitation`，状态为 `pending`。
6. 保存主持人邀请消息，metadata 写入 `hostMessageKind: 'invitation'` 和 `invitationId`。
7. API 返回 pending invitation，UI 展示 InviteCard 并高亮输入区。

异常流程：

- pending invitation 已存在：不重复创建，返回当前 invitation。
- repository 保存失败：不保存邀请消息，返回 `INVITATION_CREATE_FAILED`。

### 3.3 回应邀请流程

1. UI 在 InviteCard 输入文本并调用 `respondInvitation(sessionId, invitationId, content)`。
2. API 校验 content 非空。
3. 服务层查找 invitation，确认属于当前 session 且状态为 `pending`。
4. 根据 `clientMessageId` 检查是否已有回应消息。
5. 首次提交：将 invitation 状态更新为 `responded`，保存用户消息，调用 Director 决定后续推进。
6. 重复提交：返回既有回应和后续消息，不创建重复消息。
7. UI 隐藏 InviteCard，消息流继续生成后续角色或主持人消息。

异常流程：

- 空内容：返回 `MESSAGE_EMPTY`。
- invitation 不存在、已失效或跨 session：返回 `INVITATION_INVALID`，UI 隐藏失效 InviteCard 并提示邀请已失效。
- 重复提交：幂等返回已有结果。

### 3.4 跳过邀请流程

1. UI 点击跳过，调用 `skipInvitation(sessionId, invitationId, clientMessageId)`。
2. 服务层查找 invitation，确认属于当前 session。
3. 若已 `skipped`，幂等返回当前状态。
4. 若为 `pending`，更新为 `skipped`，保存轻量系统或主持人消息。
5. 服务层触发 Director 后续 `continue` 决策，讨论不被阻塞。
6. UI 隐藏 InviteCard 并更新消息流。

异常流程：

- 跳过失败：InviteCard 保持可操作并展示错误反馈。

### 3.5 主动总结与自动收束流程

1. 用户输入总结/结束指令，或点击 MoreSheet “总结当前结论”。
2. Store 调用 summary endpoint；普通消息 endpoint 只保留用户发言入口，不承载邀请回应或总结专用状态机。
3. 服务层校验讨论历史不少于最小上下文。
4. Director 输出 `conclude`，并提供 summary hint。
5. 服务层通过主持人生成结构化总结消息，metadata 写入 `summary`。
6. 总结消息保存成功后：更新 session state 为 `closing`，再更新 session status 为 `completed`。
7. UI 显示总结消息和 SummaryActions：返回首页、查看会话页、继续追问。
8. 用户点击继续追问时调用现有 `PATCH /api/sessions/[sessionId]/status`，body 为 `{ action: 'resume' }`；`SessionService.updateSessionStatus()` 在 completed + closing + 存在 summary checkpoint 时恢复为 running，将 state stage 推回 `developing`，并保留 summary checkpoint metadata。

异常流程：

- 总结生成失败：返回 `SUMMARY_GENERATION_FAILED`，session 不进入 completed。
- 状态更新失败：保留总结消息但返回 `SESSION_STATE_UPDATE_FAILED`，避免丢失总结内容，UI 显示可重试恢复提示。

## 4. Table Design

本迭代不新增远端数据库表，不编写 SQL，不修改现有远端数据结构。新增本地/Mock 数据模型如下：

### Invitation

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `invitationId` | `string` | required, unique | 邀请 ID |
| `sessionId` | `string` | required | 所属 session |
| `status` | `'pending' \| 'responded' \| 'skipped' \| 'expired'` | required | 邀请状态 |
| `prompt` | `string` | required | InviteCard 展示文案 |
| `reason` | `string` | required | Director 创建邀请原因 |
| `createdByMessageId` | `string` | optional | 主持人邀请消息 ID |
| `respondedByMessageId` | `string` | optional | 用户回应消息 ID |
| `clientMessageId` | `string` | optional | 幂等键 |
| `createdAt` | `string` | required | ISO 时间 |
| `updatedAt` | `string` | required | ISO 时间 |

索引/查询规则：

- `sessionId + status`：查询当前 pending invitation。
- `sessionId + clientMessageId`：邀请回应/跳过幂等。
- `sessionId + createdAt`：邀请频率控制。

### DirectorDecisionRecord

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `decisionId` | `string` | required, unique | 决策 ID |
| `sessionId` | `string` | required | 所属 session |
| `action` | `'continue' \| 'invite_user' \| 'trigger_event' \| 'conclude'` | required | Director 动作 |
| `reason` | `string` | required | 决策原因 |
| `confidence` | `number` | required, 0-1 | 置信度 |
| `schedulerHint` | `SchedulerHint` | optional | 调度提示 |
| `stageSuggestion` | `DiscussionStage` | optional | 阶段变化建议 |
| `eventCandidate` | `DirectorEventCandidate` | optional | 事件候选 |
| `summaryHint` | `DirectorSummaryHint` | optional | 总结结构提示 |
| `createdAt` | `string` | required | ISO 时间 |

索引/查询规则：

- `sessionId + createdAt`：查询最近决策与审计。

## 5. API Design

### 5.1 获取消息

现有 API 保持：

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/discussions/[sessionId]/messages?limit=50&before=msg-id` | 获取消息列表 |

响应：

```ts
ApiResponse<MessageListResult>
```

错误码：

- `VALIDATION_ERROR`：limit 非法。
- `SESSION_NOT_FOUND`：session 不存在。
- `INTERNAL_ERROR`：未知错误。

### 5.2 发送普通消息并触发 Director

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/discussions/[sessionId]/messages` | 发送用户消息并由 Director 推进讨论 |

请求：

```ts
interface SendMessageParams {
  content: string
  clientMessageId?: string
  intentResponse?: IntentResponse
}
```

成功响应：

```ts
interface SendMessageResult {
  sessionId: string
  runId: string
  clientMessageId?: string
  userMessage: DiscussionMessage | null
  agentMessages: DiscussionMessage[]
  activeSpeakerId: string | null
  directorDecision?: DirectorDecisionRecord
  pendingInvitation?: Invitation | null
  summary?: DiscussionSummary | null
}
```

错误码：

- `SESSION_NOT_FOUND`：session 不存在。
- `SESSION_NOT_OPERABLE`：session 不可继续操作。
- `SESSION_CONTEXT_MISMATCH`：intent 或 invitation 不属于当前 session。
- `MESSAGE_EMPTY`：非开场消息内容为空。
- `DIRECTOR_DECISION_FAILED`：Director 决策失败。
- `INVITATION_CREATE_FAILED`：邀请创建失败，消息流和 session 状态保持不变。
- `NO_AVAILABLE_AGENT`：无可调度角色。
- `AGENT_GENERATION_FAILED`：角色或主持人消息生成失败。
- `SUMMARY_GENERATION_FAILED`：总结生成失败。
- `INVALID_STATE_TRANSITION`：非法阶段变化。
- `SESSION_STATE_UPDATE_FAILED`：总结消息已保存但 session 状态更新失败。
- `INTERNAL_ERROR`：未知错误。

### 5.3 获取当前邀请

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/discussions/[sessionId]/invitations` | 获取当前 pending invitation |

响应：

```ts
ApiResponse<{ sessionId: string; invitation: Invitation | null }>
```

错误码：

- `SESSION_NOT_FOUND`
- `INTERNAL_ERROR`

### 5.4 回应邀请

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/discussions/[sessionId]/invitations/[invitationId]/response` | 文本回应邀请 |

请求：

```ts
interface RespondInvitationRequest {
  content: string
  clientMessageId?: string
}
```

响应：

```ts
ApiResponse<RespondInvitationResult>
```

错误码：

- `MESSAGE_EMPTY`
- `SESSION_NOT_FOUND`
- `INVITATION_INVALID`
- `SESSION_CONTEXT_MISMATCH`
- `AGENT_GENERATION_FAILED`
- `DIRECTOR_DECISION_FAILED`
- `INTERNAL_ERROR`

### 5.5 跳过邀请

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/discussions/[sessionId]/invitations/[invitationId]/skip` | 跳过邀请 |

请求：

```ts
interface SkipInvitationRequest {
  clientMessageId?: string
}
```

响应：

```ts
ApiResponse<SkipInvitationResult>
```

错误码：

- `SESSION_NOT_FOUND`
- `INVITATION_INVALID`
- `DIRECTOR_DECISION_FAILED`
- `INTERNAL_ERROR`

### 5.6 主动总结

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/discussions/[sessionId]/summary` | 主动触发总结当前结论 |

请求：

```ts
interface RequestSummaryRequest {
  clientMessageId?: string
  source: 'more_sheet' | 'composer' | 'auto'
}
```

响应：

```ts
ApiResponse<RequestSummaryResult>
```

错误码：

- `SESSION_NOT_FOUND`
- `SESSION_NOT_OPERABLE`
- `INSUFFICIENT_CONTEXT`
- `SUMMARY_GENERATION_FAILED`
- `INVALID_STATE_TRANSITION`
- `SESSION_STATE_UPDATE_FAILED`
- `INTERNAL_ERROR`


### 5.7 总结后继续追问

| Method | Path | 说明 |
|---|---|---|
| PATCH | `/api/sessions/[sessionId]/status` | 总结后恢复当前 session 继续追问 |

请求：

```ts
interface UpdateSessionStatusRequest {
  action: 'resume'
}
```

响应：

```ts
ApiResponse<Session>
```

正确性规则：

- 仅当 session 为 `completed` 且 state stage 为 `closing`，并且存在最终总结 checkpoint 时，resume 才恢复为 `running`。
- resume 后 state stage 变为 `developing`，summary checkpoint 继续保留在最终总结消息 metadata 中。
- resume 不删除总结消息，不清空历史消息，不新建 session。

错误码：

- `SESSION_NOT_FOUND`
- `SESSION_NOT_RESUMABLE`
- `INTERNAL_ERROR`

### 5.8 Result Payload Shapes

```ts
interface GetInvitationResult {
  sessionId: string
  invitation: Invitation | null
}

interface RespondInvitationResult {
  sessionId: string
  invitation: Invitation
  userMessage: DiscussionMessage | null
  agentMessages: DiscussionMessage[]
  activeSpeakerId: string | null
  directorDecision?: DirectorDecisionRecord
  pendingInvitation?: Invitation | null
  summary?: DiscussionSummary | null
}

interface SkipInvitationResult {
  sessionId: string
  invitation: Invitation
  agentMessages: DiscussionMessage[]
  activeSpeakerId: string | null
  directorDecision?: DirectorDecisionRecord
  pendingInvitation?: Invitation | null
}

interface RequestSummaryResult {
  sessionId: string
  summary: DiscussionSummary
  summaryMessage: DiscussionMessage
  sessionStatus: SessionLifecycleStatus
  directorDecision: DirectorDecisionRecord
}

interface DiscussionSummary {
  summaryId: string
  sessionId: string
  messageId: string
  consensus: string[]
  disagreements: string[]
  recommendations: string[]
  nextSteps: string[]
  checkpointCreatedAt: string
}
```

## 6. Module Design

### 6.1 Director 模块

文件：`src/engine/director.ts`

职责：

- 接收 session、messages、roles、intent、pending invitation、最近调度信息。
- 输出结构化 `DirectorDecisionRecord`。
- 只做节奏决策，不直接保存消息、修改 session 或调用 repository。

接口：

```ts
interface Director {
  decide(input: DirectorInput): Promise<DirectorDecisionRecord>
}
```

输入：`DirectorInput`

- `session: Session`
- `messages: DiscussionMessage[]`
- `roles: AgentProfile[]`
- `trigger: DirectorTrigger`
- `intent?: IntentResult`
- `pendingInvitation?: Invitation | null`
- `lastSchedulerHint?: SchedulerHint`

输出：`DirectorDecisionRecord`

异常：

- 抛出 `ServiceError('DIRECTOR_DECISION_FAILED', ...)` 或普通错误由服务层映射。

### 6.2 DiscussionService 编排模块

文件：`src/server/services/discussion.service.ts`

职责：

- 作为 Director 决策、消息保存、邀请状态、总结完成的事务边界。
- 保持现有发送消息、意图识别、幂等逻辑。
- 新增邀请回应、跳过邀请、主动总结方法。
- 继续追问复用 `SessionService.updateSessionStatus(sessionId, 'resume')`，由 session service 负责从 completed/closing 恢复为 running/developing 并保留 summary checkpoint。

新增/扩展方法：

```ts
getPendingInvitation(sessionId: string): Promise<GetInvitationResult>
respondInvitation(sessionId: string, invitationId: string, params: RespondInvitationRequest): Promise<RespondInvitationResult>
skipInvitation(sessionId: string, invitationId: string, params: SkipInvitationRequest): Promise<SkipInvitationResult>
requestSummary(sessionId: string, params: RequestSummaryRequest): Promise<RequestSummaryResult>
```

异常：

- repository 返回 null 时映射为对应业务错误。
- 总结成功前不得调用 complete status 更新。

### 6.3 Invitation Repository

文件：`src/server/repositories/invitation.repository.ts`

职责：

- 按 session 查询 pending invitation。
- 保存 invitation。
- 按 invitation ID 查询和更新状态。
- 支持按 session 查询最近 invitation 用于频率控制。

接口：

```ts
interface InvitationRepository {
  findPendingBySessionId(sessionId: string): Promise<Invitation | null>
  findById(invitationId: string): Promise<Invitation | null>
  findRecentBySessionId(sessionId: string, limit?: number): Promise<Invitation[]>
  findByClientMessageId(sessionId: string, clientMessageId: string): Promise<Invitation | null>
  save(invitation: Invitation): Promise<Invitation>
  updateStatus(invitationId: string, status: InvitationStatus, patch?: InvitationStatusPatch): Promise<Invitation | null>
}
```

### 6.4 Director Decision Repository

文件：`src/server/repositories/director-decision.repository.ts`

职责：

- 保存 Director 决策，方便测试和审计。
- 查询 session 最近决策。

接口：

```ts
interface DirectorDecisionRepository {
  save(decision: DirectorDecisionRecord): Promise<DirectorDecisionRecord>
  findRecentBySessionId(sessionId: string, limit?: number): Promise<DirectorDecisionRecord[]>
}
```

### 6.5 Message Repository 扩展

文件：`src/server/repositories/message.repository.ts`、`src/server/repositories/mock/mock-message.repository.ts`

职责：

- 支持按 messageId 查询总结 checkpoint 消息。
- 支持以不可变方式合并 message metadata，用于记录 summary checkpoint 与邀请关联。
- 保留现有 clientMessageId 幂等查询和 reply 查询语义。

扩展接口：

```ts
interface MessageRepository {
  findById(messageId: string): Promise<DiscussionMessage | null>
  updateMetadata(messageId: string, metadata: DiscussionMessage['metadata']): Promise<DiscussionMessage | null>
}
```

正确性规则：

- `updateMetadata()` 必须合并既有 metadata，不得清空 `replyToClientMessageId`、`intent` 或 `intentLabel`。
- 找不到 message 时返回 null，由 service 映射为 `SESSION_STATE_UPDATE_FAILED` 或领域错误。

### 6.5 API Routes

新增或修改 Next.js App Router route 文件，只做：

- 解析 params/body。
- 做边界输入校验。
- 调用 `DiscussionService`。
- 按统一 envelope 返回。
- 映射 ServiceError 到 HTTP status。

### 6.6 前端 Store

文件：`src/store/discussion.store.ts`

职责：

- 保存 `pendingInvitationBySessionId`、`summaryBySessionId`、`directorErrorBySessionId`。
- 提供 actions：`loadPendingInvitation`、`respondInvitation`、`skipInvitation`、`requestSummary`、`resumeAfterSummary`。
- 继续使用 immutable reducer 更新。

### 6.7 讨论 UI

文件：`src/modules/discussion/*`

职责：

- `InviteCard` 展示邀请文案、回应输入、跳过按钮、错误状态。
- `MessageInput` 在 pending invitation 时高亮提示，并支持邀请回应模式。
- `MoreSheet` 的“总结当前结论”触发 `requestSummary()`。
- `MessageBubble` 根据 `metadata.hostMessageKind` 区分开场、转场、邀请、事件候选、阶段总结、最终总结。
- `SummaryActions` 在最终总结后提供返回首页、查看会话页、继续追问。

## 7. Output Contract

### 7.1 功能类型核对

`workflow.yaml` 中 `project.features` 包含：`web-api`。

本次迭代变更 HTTP endpoints、服务层、前端讨论页面和跨组件消息链路，因此触发：

| 业务描述 | type id | 测试规范 |
|---|---|---|
| Director 确定性规则覆盖（03 阶段可生成单元级测试文件，但 cube type id 归入 integration） | `integration` | `standards/testing/integration.md` |
| 讨论 API 发送消息、邀请、总结 endpoint | `web-e2e` | `standards/testing/web-e2e.md` |
| UI -> Store -> API -> Service -> Repository -> Engine 跨组件链路 | `integration` | `standards/testing/integration.md` |

本次不涉及 SQL/query generator，不触发 `sql-query`，无 SQL Contract。

### 7.2 自动化测试契约

03 阶段不得从 Development Tasks 复制测试任务，而应根据本 Output Contract 生成 test-map：

- Director 确定性测试必须覆盖 `continue`、`invite_user`、`trigger_event`、`conclude` 四类动作，以及 pending invitation 存在时不得重复邀请；由于 cube type id 不包含 `unit`，03 阶段将该测试映射为 `integration` 类型下的 engine/director 确定性测试。
- Invitation 集成测试必须覆盖创建邀请、回应邀请、跳过邀请、冷却窗口、重复回应/跳过幂等、跨 session invitation 拒绝。
- Summary 集成测试必须覆盖主动总结、总结失败不 complete、总结成功后 complete、resume 后保留 summary checkpoint 并恢复可输入。
- Web/API E2E 必须按 `{PLUGIN_ROOT}/standards/testing/web-e2e.md` 执行真实 HTTP 请求，覆盖 messages、invitations response/skip、summary、session status resume 的成功、校验失败和领域失败。
- Feature integration 必须按 `{PLUGIN_ROOT}/standards/testing/integration.md` 覆盖 `UI -> Store -> API -> DiscussionService -> Repository -> Director/Orchestrator` 链路；如 05 阶段无法启动浏览器，必须记录 Known Issue，但 HTTP 请求验证不可省略。
- Session 恢复路径必须覆盖 FR-013：从 `/sessions` 进入 running session 后，仍能加载 pending invitation、触发 Director、回应邀请和请求总结，行为与首页新建 session 进入一致。

### 7.3 对外 API 契约

- 所有 API 响应必须符合 `ApiResponse<T>`。
- 失败响应 `data` 必须为 `null`。
- 错误码必须使用 API Design 中列出的 code。
- sessionId、invitationId 必须来自路径参数，不信任 body 中跨 session 数据。
- 用户输入内容按字符串处理，UI 不使用 `dangerouslySetInnerHTML`。

### 7.4 公共方法契约

- `Director.decide(input)`：返回合法 action 和 reason；当 pending invitation 存在时不得返回创建新邀请的决策。
- `DiscussionService.respondInvitation()`：同一 invitation + clientMessageId 重复调用不得创建重复消息。
- `DiscussionService.skipInvitation()`：重复跳过同一 invitation 幂等。
- `DiscussionService.requestSummary()`：总结消息保存成功前不得 complete session。
- `SessionService.updateSessionStatus(sessionId, 'resume')`：对 completed + closing + summary checkpoint 的 session 恢复为 running/developing，checkpoint 不得删除。
- `InvitationRepository.updateStatus()`：返回更新后的 invitation；不存在时返回 null。

### 7.5 任务产物正确性规则

- Director action 只能为 `continue`、`invite_user`、`trigger_event`、`conclude`。
- 事件候选只保存解释消息，不创建 EventRecord、投票 API 或投票交互。
- 总结成功后 session status 才能变为 `completed`。
- 继续追问必须保留 summary checkpoint，并恢复为可输入状态。
- 任何失败不得重复消息、丢失已保存消息、跨 session 污染 invitation。

## 8. Change Log

| 文件 | 类型 | 原因 |
|---|---|---|
| `src/types/index.ts` | 修改 | 新增 Director、Invitation、Summary、主持人消息 metadata 类型。 |
| `src/types/api.ts` | 修改 | 新增邀请/总结 API DTO，扩展消息发送响应。 |
| `src/engine/director.ts` | 修改 | 实现结构化 Director 接口和默认规则决策骨架。 |
| `src/engine/orchestrator.ts` | 修改 | 支持 Director 传入的调度提示和主持人消息语义。 |
| `src/server/repositories/invitation.repository.ts` | 新增 | 定义邀请仓储接口。 |
| `src/server/repositories/director-decision.repository.ts` | 新增 | 定义 Director 决策仓储接口。 |
| `src/server/repositories/mock/mock-invitation.repository.ts` | 新增 | 提供 mock 邀请仓储骨架。 |
| `src/server/repositories/mock/mock-director-decision.repository.ts` | 新增 | 提供 mock Director 决策仓储骨架。 |
| `src/server/repositories/mock/instances.ts` | 修改 | 注册 shared repositories。 |
| `src/server/repositories/message.repository.ts` | 修改 | 支持邀请/总结所需的消息查询与 metadata 更新接口。 |
| `src/server/repositories/mock/mock-message.repository.ts` | 修改 | 实现 messageId 查询和 metadata 合并更新，支撑 summary checkpoint 与 resume。 |
| `src/server/services/discussion.service.ts` | 修改 | 编排 Director、邀请、总结和状态更新。 |
| `src/app/api/discussions/[sessionId]/messages/route.ts` | 修改 | 支持 Director 扩展返回；不承载 invitation response 状态机。 |
| `src/app/api/discussions/[sessionId]/invitations/route.ts` | 新增 | 查询当前 pending invitation。 |
| `src/app/api/discussions/[sessionId]/invitations/[invitationId]/response/route.ts` | 新增 | 回应邀请。 |
| `src/app/api/discussions/[sessionId]/invitations/[invitationId]/skip/route.ts` | 新增 | 跳过邀请。 |
| `src/app/api/discussions/[sessionId]/summary/route.ts` | 新增 | 主动总结。 |
| `src/store/discussion.store.ts` | 修改 | 增加邀请、总结和 Director 错误状态/actions。 |
| `src/modules/discussion/index.tsx` | 修改 | 装配邀请卡、总结入口和总结后操作。 |
| `src/modules/discussion/invite-card.tsx` | 新增 | 邀请卡组件。 |
| `src/modules/discussion/summary-actions.tsx` | 新增 | 总结后操作组件。 |
| `src/modules/discussion/message-bubble.tsx` | 修改 | 主持人消息和总结样式。 |
| `src/modules/discussion/message-list.tsx` | 修改 | 消息流展示新增语义状态。 |
| `src/modules/discussion/message-input.tsx` | 修改 | 邀请回应高亮和输入模式。 |
| `src/modules/discussion/more-sheet.tsx` | 修改 | 总结当前结论触发真实流程。 |
| `src/app/api/sessions/[sessionId]/status/route.ts` | 修改 | 将 resume action 映射到总结后继续追问恢复语义。 |
| `src/server/services/session.service.ts` | 修改 | 扩展 resume：completed + closing + summary checkpoint 时恢复 running/developing，并保留 checkpoint。 |

## 9. Development Tasks

- Task-01：定义 Director、邀请、总结和消息语义契约
  - 任务类型：contract
  - 所属模块：types/engine
  - 简要描述：定义 Director 输入输出、Invitation、Summary、主持人消息语义 metadata、邀请/总结 API DTO，供后续服务层、API 和 UI 测试引用。
  - 涉及接口/方法：DirectorInput、DirectorDecisionRecord、Invitation、DiscussionSummary、SendMessageResult、RespondInvitationRequest、SkipInvitationRequest、RequestSummaryRequest
  - 输入：无运行时输入，仅类型定义
  - 输出：可导入的 TypeScript 类型和常量
  - 依赖任务：无
  - 数据操作：无
  - 修改边界：只新增或扩展 `src/types/index.ts`、`src/types/api.ts` 中的类型声明和导出字段；不得删除既有类型字段
  - 禁止行为：不得写业务逻辑；不得修改 API envelope；不得引入运行时依赖
  - 产出类型：integration
  - 功能类型：跨层契约定义（type id: integration）
  - 是否跨组件：是（组件链路：Types -> Engine -> Service -> API -> Store -> UI）
- Task-02：实现 Director 结构化决策骨架
  - 任务类型：business-implementation
  - 所属模块：engine/director
  - 简要描述：基于 session 阶段、消息历史、intent、pending invitation 和邀请频率信号输出 continue、invite_user、trigger_event、conclude 四类结构化决策。
  - 涉及接口/方法：Director.decide()、DefaultDirector.decide()
  - 输入：DirectorInput
  - 输出：DirectorDecisionRecord 或错误
  - 依赖任务：Task-01（Director 类型契约）
  - 数据操作：无
  - 修改边界：只替换 `src/engine/director.ts` 中现有占位类型和 `DefaultDirector.decide()` 方法体；不得修改 scheduler 或 runtime 职责
  - 禁止行为：不得直接保存消息、邀请或 session；不得调用 LLM；不得创建真实 EventRecord
  - 产出类型：integration
  - 功能类型：Director 决策业务实现（type id: integration）
  - 是否跨组件：是（组件链路：DiscussionService -> Director -> SchedulerHint）
- Task-03：实现邀请、Director 决策和消息 checkpoint 仓储契约
  - 任务类型：contract
  - 所属模块：server/repositories
  - 简要描述：定义并提供 mock invitation repository、Director decision repository，并扩展 message repository 的 messageId 查询与 metadata 合并更新能力，支持 pending 查询、状态更新、幂等键查询、最近记录查询和 summary checkpoint 读取。
  - 涉及接口/方法：InvitationRepository、DirectorDecisionRepository、MessageRepository.findById()、MessageRepository.updateMetadata()、MockInvitationRepository、MockDirectorDecisionRepository、MockMessageRepository
  - 输入：Invitation、DirectorDecisionRecord、sessionId、invitationId、clientMessageId、messageId、DiscussionMessage.metadata
  - 输出：Invitation、DirectorDecisionRecord、DiscussionMessage、数组或 null
  - 依赖任务：Task-01（Invitation 和 DirectorDecisionRecord 类型）
  - 数据操作：读写 mock repository 内存 Map；读写 message repository 内存 Map 中的 metadata；读写 global shared repository instances
  - 修改边界：只新增 invitation/director decision repository 接口和 mock 实现文件；只扩展 `message.repository.ts` 与 `mock-message.repository.ts` 的 findById/updateMetadata 方法；只在 `instances.ts` 增加 shared repository 字段；不得修改 session/template repository 既有语义
  - 禁止行为：不得引入数据库；不得用跨 session 全局单值保存 pending invitation；不得在 updateMetadata 时覆盖既有 metadata；不得删除既有 shared instances
  - 产出类型：integration
  - 功能类型：本地持久化与 summary checkpoint 仓储契约（type id: integration）
  - 是否跨组件：是（组件链路：DiscussionService/SessionService -> InvitationRepository/DirectorDecisionRepository/MessageRepository -> MockStore）
- Task-04：实现普通消息发送链路中的 Director 推进
  - 任务类型：business-implementation
  - 所属模块：server/services/discussion
  - 简要描述：在发送用户消息后调用 Director，保存决策，并按 continue、invite_user、trigger_event、conclude 分支生成对应主持人或角色消息。
  - 涉及接口/方法：DiscussionService.sendUserMessage()
  - 输入：sessionId、content、clientMessageId、IntentResponse
  - 输出：SendMessageResult
  - 依赖任务：Task-01（DTO）、Task-02（Director）、Task-03（repositories）
  - 数据操作：读 session repository；读写 message repository；读写 invitation repository；写 director decision repository；写 call log repository；按总结成功条件更新 session repository
  - 修改边界：只扩展 `sendUserMessage()` 内用户消息保存后、orchestrator 调用前后的编排逻辑；只新增私有辅助方法；不得重写整个 service 文件
  - 禁止行为：不得绕过 clientMessageId 幂等；不得在总结消息保存前完成 session；不得让 trigger_event 创建真实投票或 EventRecord
  - 产出类型：web-e2e
  - 功能类型：消息发送 API 导演推进（type id: web-e2e）
  - 是否跨组件：是（组件链路：API Route -> DiscussionService -> Director -> Repository -> Orchestrator）
- Task-05：实现邀请回应业务逻辑
  - 任务类型：business-implementation
  - 所属模块：server/services/discussion
  - 简要描述：校验 pending invitation，保存用户回应消息，将 invitation 更新为 responded，并触发后续 Director 推进，重复提交不创建重复消息。
  - 涉及接口/方法：DiscussionService.respondInvitation()
  - 输入：sessionId、invitationId、RespondInvitationRequest
  - 输出：RespondInvitationResult
  - 依赖任务：Task-03（InvitationRepository）、Task-04（Director 推进辅助逻辑）
  - 数据操作：读 session repository；读写 invitation repository；读写 message repository；写 director decision repository；可写 call log repository
  - 修改边界：只在 `DiscussionService` 新增 `respondInvitation()` 和必要私有复用方法；不得修改普通消息幂等规则的既有输入含义
  - 禁止行为：不得接受空回应；不得回应跨 session invitation；不得重复创建用户消息
  - 产出类型：web-e2e
  - 功能类型：邀请回应 API 业务实现（type id: web-e2e）
  - 是否跨组件：是（组件链路：Invitation API -> DiscussionService -> InvitationRepository -> MessageRepository -> Director）
- Task-06：实现跳过邀请业务逻辑
  - 任务类型：business-implementation
  - 所属模块：server/services/discussion
  - 简要描述：将 pending invitation 幂等更新为 skipped，保存跳过后的轻量消息或状态，并触发后续继续讨论。
  - 涉及接口/方法：DiscussionService.skipInvitation()
  - 输入：sessionId、invitationId、SkipInvitationRequest
  - 输出：SkipInvitationResult
  - 依赖任务：Task-03（InvitationRepository）、Task-04（Director 推进辅助逻辑）
  - 数据操作：读 session repository；读写 invitation repository；可写 message repository；写 director decision repository
  - 修改边界：只在 `DiscussionService` 新增 `skipInvitation()` 和必要私有复用方法；不得修改 invitation response 方法体以外无关逻辑
  - 禁止行为：不得重复更新已 skipped invitation 造成重复消息；不得阻塞后续普通发言
  - 产出类型：web-e2e
  - 功能类型：跳过邀请 API 业务实现（type id: web-e2e）
  - 是否跨组件：是（组件链路：Invitation API -> DiscussionService -> InvitationRepository -> Director）
- Task-07：实现主动总结和完成会话业务逻辑
  - 任务类型：business-implementation
  - 所属模块：server/services/discussion
  - 简要描述：处理总结当前结论请求，生成结构化主持人总结消息，保存成功后推进 closing 并完成 session。
  - 涉及接口/方法：DiscussionService.requestSummary()
  - 输入：sessionId、RequestSummaryRequest
  - 输出：RequestSummaryResult
  - 依赖任务：Task-01（总结 DTO 与 metadata 契约）、Task-02（Director conclude 决策）、Task-03（DirectorDecisionRepository）
  - 数据操作：读 session repository；读 message repository；写 message repository；写 director decision repository；更新 session repository state/status
  - 修改边界：只在 `DiscussionService` 新增 `requestSummary()` 和总结私有辅助方法；不得修改 `SessionService.updateSessionStatus()` 的既有 public contract
  - 禁止行为：不得在总结消息保存失败时 complete session；不得丢失 summary checkpoint；不得要求真实 LLM
  - 产出类型：web-e2e
  - 功能类型：主动总结 API 业务实现（type id: web-e2e）
  - 是否跨组件：是（组件链路：Summary API -> DiscussionService -> Director -> MessageRepository -> SessionRepository）
- Task-08：实现总结后继续追问恢复语义
  - 任务类型：business-implementation
  - 所属模块：server/services/session
  - 简要描述：扩展 resume action，使 completed + closing 且存在最终总结 checkpoint 的 session 可恢复为 running/developing，并保留总结 checkpoint 供当前 session 继续追问。
  - 涉及接口/方法：SessionService.updateSessionStatus()、PATCH `/api/sessions/[sessionId]/status`
  - 输入：sessionId、UpdateSessionStatusRequest(action: 'resume')
  - 输出：恢复后的 Session 或 `SESSION_NOT_RESUMABLE` 错误
  - 依赖任务：Task-01（summary metadata 契约）、Task-03（MessageRepository checkpoint 查询）、Task-07（总结 checkpoint 产出）
  - 数据操作：读 session repository；读 message repository 查找 summary checkpoint；更新 session repository status/state/history
  - 修改边界：只扩展 `SessionService.updateSessionStatus()` 的 resume 分支和 session status route 的错误码映射；不得修改 archive/complete 分支既有语义
  - 禁止行为：不得删除总结消息；不得清空 session 历史；不得新建 session 替代恢复；没有 summary checkpoint 时不得恢复 completed session
  - 产出类型：web-e2e
  - 功能类型：总结后继续追问恢复（type id: web-e2e）
  - 是否跨组件：是（组件链路：SummaryActions -> Store -> Session Status API -> SessionService -> SessionRepository）
- Task-09：实现邀请和总结 API endpoints
  - 任务类型：api
  - 所属模块：app/api/discussions
  - 简要描述：新增 pending invitation 查询、回应邀请、跳过邀请、主动总结 endpoint，并扩展 messages route 返回 Director 状态。
  - 涉及接口/方法：GET invitations、POST response、POST skip、POST summary、POST messages、PATCH session status resume
  - 输入：路径参数 sessionId/invitationId，请求 body DTO
  - 输出：ApiResponse<GetInvitationResult | RespondInvitationResult | SkipInvitationResult | RequestSummaryResult | SendMessageResult>
  - 依赖任务：Task-04（普通消息 Director 推进）、Task-05（回应邀请）、Task-06（跳过邀请）、Task-07（主动总结）、Task-08（继续追问恢复）
  - 数据操作：调用 DiscussionService；不直接读写 repository
  - 修改边界：只新增声明的 route 文件；只在 messages route 的 response mapping 处透出 Director 字段；只在 session status route 的 resume 分支复用 SessionService
  - 禁止行为：不得改变统一响应 envelope；不得把 body 中 sessionId 覆盖 path sessionId；不得暴露内部堆栈
  - 产出类型：web-e2e
  - 功能类型：讨论邀请和总结 HTTP API（type id: web-e2e）
  - 是否跨组件：是（组件链路：HTTP Route -> DiscussionService -> Repository）
- Task-10：实现前端邀请状态管理
  - 任务类型：ui
  - 所属模块：store/discussion
  - 简要描述：在 discussion store 中维护 pending invitation、邀请提交状态、summary 状态和 Director 错误，提供加载、回应、跳过和总结 actions。
  - 涉及接口/方法：DiscussionActions.loadPendingInvitation()、respondInvitation()、skipInvitation()、requestSummary()、resumeAfterSummary()
  - 输入：sessionId、invitationId、content、clientMessageId
  - 输出：更新后的 DiscussionStoreState
  - 依赖任务：Task-09（API endpoints）
  - 数据操作：调用 `/api/discussions/[sessionId]/invitations*`、`/summary`、`/messages`；更新 React reducer state
  - 修改边界：只扩展 `DiscussionStoreState`、`DiscussionAction`、reducer case 和 `actions` 对象；不得重写 provider 或移除现有 actions
  - 禁止行为：不得直接操作 DOM；不得用可变方式更新 state；不得吞掉需要展示给用户的错误
  - 产出类型：integration
  - 功能类型：前端状态跨 API 集成（type id: integration）
  - 是否跨组件：是（组件链路：DiscussionModule -> Store -> API）
- Task-11：实现讨论页邀请交互 UI
  - 任务类型：ui
  - 所属模块：modules/discussion
  - 简要描述：展示 InviteCard、支持用户回应和跳过、在输入区展示邀请高亮提示，并在 session 加载和消息更新后同步 pending invitation。
  - 涉及接口/方法：InviteCard、DiscussionModuleInner、MessageInput
  - 输入：Invitation、用户回应内容、跳过点击
  - 输出：InviteCard 状态变化、消息流更新、输入区高亮提示
  - 依赖任务：Task-10（前端邀请状态管理）
  - 数据操作：调用 discussion store actions；不直接调用 repository 或 API route
  - 修改边界：只新增 `invite-card.tsx`；只在 `index.tsx` 装配组件和 actions；只在 `message-input.tsx` 增加 invitation props 与提示区域
  - 禁止行为：不得新增独立阶段评估面板；不得使用 `dangerouslySetInnerHTML`；不得阻塞普通重试能力
  - 产出类型：integration
  - 功能类型：邀请 UI 跨组件交互（type id: integration）
  - 是否跨组件：是（组件链路：InviteCard -> Store -> API -> Service）
- Task-12：实现主持人消息、事件候选和总结展示
  - 任务类型：ui
  - 所属模块：modules/discussion
  - 简要描述：根据消息 metadata 展示主持人开场、转场、邀请、事件候选解释、阶段总结和最终总结样式，并提供总结后操作入口。
  - 涉及接口/方法：MessageBubble、MessageList、SummaryActions
  - 输入：DiscussionMessage.metadata.hostMessageKind、DiscussionSummary
  - 输出：语义化消息展示、返回首页、查看会话页、继续追问入口
  - 依赖任务：Task-01（消息 metadata 类型）、Task-10（summary 状态）
  - 数据操作：调用 store resume action 或页面跳转；不直接读写 repository
  - 修改边界：只新增 `summary-actions.tsx`；只扩展 `message-bubble.tsx`、`message-list.tsx` 的渲染分支；不得改写整个消息流组件
  - 禁止行为：不得创建真实事件投票 UI；未知 hostMessageKind 必须退化为普通主持人消息；不得隐藏失败消息重试按钮
  - 产出类型：integration
  - 功能类型：主持人消息和总结 UI 展示（type id: integration）
  - 是否跨组件：是（组件链路：MessageRepository -> API -> Store -> MessageList -> MessageBubble）
- Task-13：实现更多操作总结入口
  - 任务类型：ui
  - 所属模块：modules/discussion
  - 简要描述：将 MoreSheet 中“总结当前结论”从占位提示改为调用 requestSummary，并把失败反馈展示到现有错误区域。
  - 涉及接口/方法：MoreSheet、DiscussionModuleInner、DiscussionActions.requestSummary()
  - 输入：用户点击“总结当前结论”
  - 输出：触发 summary API、总结消息进入消息流或展示错误
  - 依赖任务：Task-07（主动总结业务逻辑）、Task-10（store summary action）
  - 数据操作：调用 discussion store requestSummary action；不直接读写 repository
  - 修改边界：只扩展 MoreSheet props 和 click handler；只在 `index.tsx` 传入总结 action；不得修改其他更多操作语义
  - 禁止行为：不得继续显示“后续迭代”占位；不得在 summary 失败时把 session 标记为 completed
  - 产出类型：integration
  - 功能类型：更多操作总结入口（type id: integration）
  - 是否跨组件：是（组件链路：MoreSheet -> Store -> Summary API -> DiscussionService）
