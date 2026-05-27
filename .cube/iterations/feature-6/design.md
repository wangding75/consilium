# Design：迭代 6 — 导演逻辑、邀请与收束

## 1. 概述

本次设计在现有 client-first Next.js 架构上补齐迭代 6 的 Director 导演控制闭环：由 `DirectorService` 基于当前 session、消息历史、用户意图和最近调度状态输出结构化决策，再由服务层把决策落到消息流、邀请记录、状态机推进和调度提示中。

整体方案采用最小改动：

- 扩展现有 `src/engine/director.ts` 预留 stub，不替代 `AgentRuntime`、`Scheduler`、`IntentClassifier` 或 `StateMachine`。
- 复用现有 `DiscussionStage`：`idle / opening / developing / climax / closing`，不新增阶段枚举。
- 新增本地 mock repository 保存 `DirectorDecisionRecord` 和 `InvitationRecord`，符合 MVP 本地持久化方向。
- 新增两个 HTTP endpoint：Director 下一步决策、邀请回应/跳过。
- 扩展 discussion store 和 discussion UI，以现有消息流、角色栏、输入区和 MoreSheet 为载体展示邀请与总结动作。

核心约束：

- 总结消息生成成功后，才允许推进 `closing` 并将 session 标记为 `completed`。
- `trigger_event` 本迭代只输出候选事件和主持人解释，不创建真实 EventRecord、投票接口或投票交互。
- pending 邀请在同一 session 内唯一，且必须满足冷却窗口和总次数上限；节流时选择 `continue` 或非打断动作。
- 邀请回应和跳过必须幂等：相同重复请求返回成功且不创建重复消息，冲突请求返回明确错误。
- 总结后的“继续追问”复用现有 session resume 能力，将 session 恢复为 `running`，并保留总结 checkpoint。
- 需求文档和原型文件只读，不在本阶段修改。

## 2. Impact Analysis

| 模块 / 文件 | 影响程度 | 说明 |
|---|---:|---|
| `src/types/index.ts` | 修改 | 新增 Director、Invitation、Summary metadata、扩展 scheduler hint action 与 message metadata。 |
| `src/types/api.ts` | 修改 | 新增 Director API、Invitation respond API 的请求/响应 DTO。 |
| `src/engine/director.ts` | 修改 | 将 stub 扩展为可测试接口和默认骨架实现。 |
| `src/engine/state-machine.ts` | 修改 | 保持阶段枚举不变，暴露 Director phase transition 验证入口。 |
| `src/engine/scheduler.ts` | 修改 | 复用现有 hint，兼容 `preferredAction`。 |
| `src/server/repositories/director.repository.ts` | 新增 | DirectorDecisionRecord 持久化接口。 |
| `src/server/repositories/invitation.repository.ts` | 新增 | InvitationRecord 持久化与幂等查询接口。 |
| `src/server/repositories/mock/mock-director.repository.ts` | 新增 | 本地 mock Director 决策仓储。 |
| `src/server/repositories/mock/mock-invitation.repository.ts` | 新增 | 本地 mock 邀请仓储。 |
| `src/server/repositories/mock/instances.ts` | 修改 | 导出共享 mock Director / Invitation repository。 |
| `src/server/services/discussion.service.ts` | 修改 | 新增 `runDirectorNext()`、`respondInvitation()` 服务方法，集成 Director、StateMachine、Scheduler、MessageRepository。 |
| `src/app/api/discussions/[sessionId]/director/next/route.ts` | 新增 | Director next HTTP endpoint。 |
| `src/app/api/discussions/[sessionId]/invitations/[invitationId]/respond/route.ts` | 新增 | Invitation respond/skip HTTP endpoint。 |
| `src/store/discussion.store.ts` | 修改 | 增加 pending invitation、director next、invitation respond/skip 状态和 actions。 |
| `src/modules/discussion/index.tsx` | 修改 | 串接 InviteCard、summary actions、MoreSheet 总结触发。 |
| `src/modules/discussion/invite-card.tsx` | 新增 | 展示邀请说明、回应、跳过。 |
| `src/modules/discussion/summary-actions.tsx` | 新增 | 总结完成后的返回首页、查看会话页、继续追问入口。 |
| `src/modules/discussion/message-list.tsx` | 修改 | 在消息流内渲染 InviteCard 和 summary actions。 |
| `src/modules/discussion/message-bubble.tsx` | 修改 | 支持主持人消息 renderType / summary metadata 的差异化展示。 |
| `src/modules/discussion/message-input.tsx` | 修改 | 支持邀请高亮提示和邀请回应提交。 |
| `src/modules/discussion/more-sheet.tsx` | 修改 | “总结当前结论”触发 Director conclude，不再仅作为占位提示。 |

### 现有接口兼容性

- 现有 `/api/discussions/[sessionId]/messages`、`/api/discussions/[sessionId]/intent` 不删除、不改路径。
- `DiscussionService` 构造函数新增依赖必须为可选参数，现有 route 的实例化方式保持兼容。
- `SchedulerHint` 新增字段为可选字段，不破坏现有调用方。
- `DiscussionMessage.metadata` 新增字段均为可选字段，不破坏历史消息渲染。

### 现有数据兼容性

- MVP 无远端数据库；新增记录保存在本地 mock repository / IndexedDB 方向的数据模型中。
- 历史 session 没有 DirectorDecisionRecord 或 InvitationRecord 时，默认视为无 pending 邀请、无 Director 历史。
- 不迁移、不删除现有消息、session、template 数据。

## 3. Flow Design

### 3.1 Director 下一步决策流程

1. 前端在以下场景调用 `POST /api/discussions/:sessionId/director/next`：
   - 用户点击“总结当前结论”。
   - 角色消息生成后需要判断是否邀请、事件候选或收束。
   - 从会话页恢复当前 session 后用户主动触发继续推进。
2. API route 解析请求，创建 `DiscussionService`。
3. `DiscussionService.runDirectorNext()` 读取 session、template roles、messages、最近 invitation、最近 Director decisions。
4. `DefaultDirector.decide()` 输出结构化 `DirectorDecisionRecord`。
5. 服务层校验 phase transition：
   - 合法 transition 才更新 session state。
   - 非法 transition 返回 `INVALID_PHASE_TRANSITION`，不更新消息和状态。
6. 按 action 分支：
   - `continue`：返回 scheduler hint 和 activeSpeakerId，不创建邀请。
   - `invite_user`：创建主持人邀请消息和 pending invitation；同 session 已有 pending invitation 时返回既有邀请。
   - `trigger_event`：创建主持人事件候选解释消息，不创建 EventRecord。
   - `conclude`：先创建主持人总结消息；成功后推进 `closing` 并标记 session `completed`。
7. 返回统一 `ApiResponse<DirectorNextResult>`。

### 3.2 邀请节流与回应流程

#### 邀请节流规则

1. `DefaultDirector.decide()` 读取 `pendingInvitation`、`recentInvitations` 和当前消息数。
2. 同一 session 已存在 `pending` invitation 时，不得创建新 invitation，返回既有 pending invitation 或改为 `continue`。
3. 冷却窗口：同一 session 最近 3 条非系统消息内已经创建过 invitation 时，不得再次邀请。
4. 总次数上限：同一 session 最多创建 3 次 invitation；超过后 `invite_user` 候选必须降级为 `continue` 或 `trigger_event` 候选解释。
5. 节流降级时必须在 decision.reason 中说明原因，方便测试和 UI 反馈。

#### 邀请回应规则

1. InviteCard 提供文本回应与跳过按钮。
2. 前端调用 `POST /api/discussions/:sessionId/invitations/:invitationId/respond`。
3. 服务层读取 session 与 invitation，校验 invitation 属于当前 session。
4. 幂等矩阵：
   - `pending + respond`：保存用户消息，将 invitation 标记为 `responded`。
   - `pending + skip`：将 invitation 标记为 `skipped`，不创建用户消息。
   - `responded + 相同 clientMessageId`：返回成功和既有 invitation / userMessage，不创建重复消息。
   - `responded + 不同 content 或不同 clientMessageId`：返回 `INVITATION_ALREADY_HANDLED`。
   - `skipped + skip`：返回成功和既有 skipped invitation。
   - `skipped + respond`：返回 `INVITATION_ALREADY_HANDLED`。
   - `expired + 任意 action`：返回 `INVITATION_ALREADY_HANDLED`。
5. `respond` 成功后返回 Director follow-up 为 `continue`，使讨论围绕用户输入继续。
6. 前端合并返回消息，隐藏 InviteCard，讨论继续。

### 3.3 总结收束与继续追问流程

1. 用户输入“总结/结束”或 MoreSheet 点击“总结当前结论”。
2. Intent 可识别为 `decide`，但最终是否收束由 Director 决策。
3. `conclude` 分支先创建主持人总结消息，消息 metadata 标记 `summaryType: stage | final`，并写入 `sourceMessageIds`。
4. 仅当总结消息保存成功后：
   - phase 推进至 `closing`。
   - session status 更新为 `completed`。
5. 若总结生成或保存失败，返回 `SUMMARY_GENERATION_FAILED`，session 保持原状态。
6. 若总结消息已保存但 session status 更新失败，返回 `SESSION_STATUS_UPDATE_FAILED`，保留总结消息和当前 phase，前端提示可重试完成/继续追问。
7. 用户点击“继续追问”时，前端调用现有 `PATCH /api/sessions/:sessionId/status`，请求 `{ action: 'resume' }`。
8. resume 成功后 session status 恢复为 `running`，输入区恢复可用；后续用户消息 metadata.summary.resumedFromSummaryId 指向最近 final summary messageId。
9. resume 失败返回现有 session status API 错误，前端保持总结可见并提示重试。

### 3.4 异常流程

| 场景 | 处理 |
|---|---|
| session 不存在 | 返回 `SESSION_NOT_FOUND`，前端引导返回首页或会话页。 |
| Director 无法决策 | 返回 `DIRECTOR_DECISION_FAILED`，前端允许重试或继续普通发言。 |
| 非法阶段变化 | 返回 `INVALID_PHASE_TRANSITION`，不更新状态。 |
| pending 邀请已存在 | 返回既有 pending invitation，不重复创建。 |
| invitation 不存在或不属于 session | 返回 `INVITATION_NOT_FOUND`，前端隐藏失效卡片并提示。 |
| invitation 已处理 | 相同重复请求返回成功和当前处理结果；冲突请求返回 `INVITATION_ALREADY_HANDLED`，不重复创建消息。 |
| 总结生成失败 | 返回 `SUMMARY_GENERATION_FAILED`，不标记 completed。 |
| 总结已保存但状态更新失败 | 返回 `SESSION_STATUS_UPDATE_FAILED`，保留总结消息并允许重试或继续追问。 |
| 邀请创建/更新失败 | 返回 `INVITATION_CREATE_FAILED` 或 `INVITATION_UPDATE_FAILED`，不产生重复 pending invitation。 |
| 用户回应消息保存失败 | 返回 `MESSAGE_SAVE_FAILED`，不将 invitation 更新为 responded。 |
| 无可调度角色 | 返回 `NO_AVAILABLE_AGENT`，允许主持人兜底或重试。 |

## 4. Table Design

本迭代不引入 SQL 数据库和远端表结构。以下为本地持久化记录模型，后续可映射到 IndexedDB object store 或真实数据库表。

### 4.1 director_decisions（逻辑表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| decisionId | string | PK | Director 决策 ID。 |
| sessionId | string | required, indexed | 所属 session。 |
| action | union | required | `continue / invite_user / trigger_event / conclude`。 |
| reason | string | required | 决策原因，面向用户/调试可读。 |
| confidence | number | required, 0-1 | 决策置信度。 |
| phaseTransition | object/null | optional | 阶段变化建议。 |
| schedulerHint | object/null | optional | 给 Scheduler 的下一步提示。 |
| eventCandidate | object/null | optional | 事件候选，仅 `status: candidate`。 |
| createdAt | string | required | ISO 时间。 |

索引：`sessionId + createdAt`，用于查询最近决策。

### 4.2 invitations（逻辑表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| invitationId | string | PK | 邀请 ID。 |
| sessionId | string | required, indexed | 所属 session。 |
| decisionId | string | required | 来源 Director 决策。 |
| status | union | required | `pending / responded / skipped / expired`。 |
| reason | string | required | 邀请原因。 |
| prompt | string | required | InviteCard 展示提示。 |
| createdAt | string | required | 创建时间。 |
| respondedAt | string | optional | 回应/跳过时间。 |
| responseMessageId | string | optional | 用户回应消息 ID。 |
| sourceMessageCount | number | required | 创建邀请时的非系统消息数量，用于冷却窗口判断。 |

约束：同一 session 同一时刻最多一个 `pending` invitation；同一 session 最近 3 条非系统消息内不得重复创建 invitation；同一 session invitation 总数不得超过 3。

## 5. API Design

所有 API 遵循 `.cube/config/api-spec.md` 统一响应格式：

```ts
{ success: boolean, data: T | null, error?: { code: string, message: string, details?: unknown }, requestId: string }
```

### 5.1 POST `/api/discussions/[sessionId]/director/next`

用于让 Director 基于当前 session 状态和消息历史决定下一步动作。

#### Request

```ts
interface DirectorNextRequest {
  trigger: 'after_agent_message' | 'user_request_summary' | 'session_resumed' | 'manual'
  clientRequestId?: string
  intentResultId?: string
  lastMessageId?: string
  debug?: boolean
}
```

#### Response

```ts
interface DirectorNextResult {
  sessionId: string
  decisionId: string
  decision: DirectorDecisionRecord
  activeSpeakerId: string | null
  createdMessages: DiscussionMessage[]
  invitation: InvitationRecord | null
  sessionStatus: SessionLifecycleStatus
}
```

#### 错误码

| code | HTTP | 场景 |
|---|---:|---|
| `SESSION_NOT_FOUND` | 404 | session 不存在。 |
| `DIRECTOR_DECISION_FAILED` | 500 | Director 无法产出有效决策。 |
| `INVALID_PHASE_TRANSITION` | 409 | 决策请求非法阶段变化。 |
| `SUMMARY_GENERATION_FAILED` | 502 | 主持人总结生成或保存失败。 |
| `SESSION_STATUS_UPDATE_FAILED` | 500 | 总结消息已保存但 session status 更新失败。 |
| `INVITATION_CREATE_FAILED` | 500 | 邀请消息或邀请记录创建失败。 |
| `SESSION_NOT_OPERABLE` | 409 | 当前 session 不可执行该 Director trigger。 |
| `NO_AVAILABLE_AGENT` | 409 | 没有可调度角色。 |
| `VALIDATION_ERROR` | 400 | trigger 或请求体不合法。 |

#### 五项生产契约

| 合同 | 内容 |
|---|---|
| Functional Contract | Schema source：`DirectorNextRequest` / `DirectorNextResult` in `src/types/api.ts`。 |
| SLO Contract | 本地 mock P50 < 50ms，P99 < 300ms；LLM 总结分支允许 P99 < 3000ms。 |
| Observability Contract | 记录 requestId、sessionId、trigger、decisionId、action、durationMs；不得记录用户完整敏感内容。 |
| Degradation Contract | Director 失败返回显式错误；trigger_event 失败退化为 continue；总结失败不 completed。 |
| Security Contract | 无认证；请求体只接受 schema 字段；错误不暴露堆栈和密钥。 |

### 5.2 POST `/api/discussions/[sessionId]/invitations/[invitationId]/respond`

用于回应或跳过当前 session 内的 pending invitation。

#### Request

```ts
interface InvitationRespondRequest {
  action: 'respond' | 'skip'
  content?: string
  clientMessageId?: string
}
```

#### Response

```ts
interface InvitationRespondResult {
  sessionId: string
  invitation: InvitationRecord
  userMessage: DiscussionMessage | null
  directorFollowUp: {
    action: 'continue'
    activeSpeakerId: string | null
    reason: string
  }
}
```

#### 错误码

| code | HTTP | 场景 |
|---|---:|---|
| `SESSION_NOT_FOUND` | 404 | session 不存在。 |
| `INVITATION_NOT_FOUND` | 404 | invitation 不存在或不属于当前 session。 |
| `INVITATION_ALREADY_HANDLED` | 409 | 已处理 invitation 收到冲突请求；相同重复请求返回 200 成功。 |
| `MESSAGE_EMPTY` | 400 | respond 缺少有效内容。 |
| `MESSAGE_SAVE_FAILED` | 500 | respond 用户消息保存失败。 |
| `INVITATION_UPDATE_FAILED` | 500 | invitation 状态更新失败。 |
| `VALIDATION_ERROR` | 400 | action 非法。 |
| `SESSION_NOT_OPERABLE` | 409 | 当前 session 不可操作。 |

#### 五项生产契约

| 合同 | 内容 |
|---|---|
| Functional Contract | Schema source：`InvitationRespondRequest` / `InvitationRespondResult` in `src/types/api.ts`。 |
| SLO Contract | P50 < 50ms，P99 < 300ms。 |
| Observability Contract | 记录 requestId、sessionId、invitationId、action、resultStatus、durationMs。 |
| Degradation Contract | 相同重复提交返回 200 和既有处理状态；冲突重复提交返回 409；保存用户消息失败则不更新 invitation 为 responded。 |
| Security Contract | respond content 作为用户输入，进入 React 渲染时按文本展示；错误不包含内部堆栈。 |

## 6. Module Design

### 6.1 类型层：`src/types/index.ts` / `src/types/api.ts`

新增和扩展公共类型：

```ts
type DirectorAction = 'continue' | 'invite_user' | 'trigger_event' | 'conclude'
type InvitationStatus = 'pending' | 'responded' | 'skipped' | 'expired'
type DirectorTrigger = 'after_agent_message' | 'user_request_summary' | 'session_resumed' | 'manual'
```

完整公共类型形状：

```ts
interface DirectorPhaseTransition {
  from: DiscussionStage
  to: DiscussionStage
}

interface DirectorSchedulerHint extends SchedulerHint {
  preferredAction?: 'continue' | 'challenge' | 'invite_user' | 'stage_summary' | 'final_summary' | 'explain_event_candidate'
}

interface DirectorEventCandidate {
  eventType: 'slap' | 'camp' | 'vote' | 'reverse'
  title: string
  reason: string
  status: 'candidate'
}

interface DirectorDecisionRecord {
  decisionId: string
  sessionId: string
  action: DirectorAction
  reason: string
  confidence: number
  phaseTransition?: DirectorPhaseTransition | null
  schedulerHint?: DirectorSchedulerHint | null
  eventCandidate?: DirectorEventCandidate | null
  createdAt: string
}

interface InvitationRecord {
  invitationId: string
  sessionId: string
  decisionId: string
  status: InvitationStatus
  reason: string
  prompt: string
  createdAt: string
  respondedAt?: string
  responseMessageId?: string
  sourceMessageCount: number
}

interface DiscussionSummaryMetadata {
  summaryType: 'stage' | 'final'
  sections: Array<'背景' | '共识' | '分歧' | '风险' | '建议' | '下一步'>
  sourceMessageIds: string[]
  resumedFromSummaryId?: string
}
```

`SchedulerHint` 增加可选 `preferredAction`，供 Director 向 Scheduler/Service 传递意图，不影响既有 preferredSpeakerId / preferredAgentType。

`DiscussionMessage.metadata` 增加：

- `renderType?: 'opening' | 'transition' | 'invitation' | 'event_candidate' | 'stage_summary' | 'final_summary'`
- `summary?: DiscussionSummaryMetadata`
- `directorDecisionId?: string`
- `invitationId?: string`

### 6.2 Director 引擎：`src/engine/director.ts`

接口：

```ts
interface Director {
  decide(input: DirectorInput): Promise<DirectorDecisionRecord>
}
```

输入包括 session、messages、roles、trigger、intent、lastDecision、pendingInvitation、recentInvitations。`DiscussionService` 构造函数新增可选 `director?: Director`，测试可注入 `MockDirector` 或固定决策 fixture。默认实现 `DefaultDirector` 按规则实现：

- 用户总结/结束信号优先 conclude。
- pending invitation 存在时不得再次 invite。
- 最近 3 条非系统消息内创建过 invitation 时不得再次 invite。
- 同 session invitation 总数达到 3 时不得再次 invite。
- message count 未达开场阈值时 continue。
- 出现分歧/分叉关键词时 invite_user 或 trigger_event。
- 达到轮次上限或连续同意时 conclude。

### 6.3 Service 层：`src/server/services/discussion.service.ts`

新增方法：

```ts
runDirectorNext(sessionId: string, request: DirectorNextRequest): Promise<DirectorNextResult>
respondInvitation(sessionId: string, invitationId: string, request: InvitationRespondRequest): Promise<InvitationRespondResult>
```

职责：

- 读取 session/messages/template roles。
- 调用 Director 并保存 decision。
- 处理 phase transition、邀请创建、总结消息创建、session completed。
- 处理 invitation 幂等回应/跳过。
- 映射 ServiceError 到 API route。

### 6.4 Repository 层

新增接口：

```ts
interface DirectorDecisionRepository {
  save(record: DirectorDecisionRecord): Promise<DirectorDecisionRecord>
  findLatestBySessionId(sessionId: string): Promise<DirectorDecisionRecord | null>
  findBySessionId(sessionId: string): Promise<DirectorDecisionRecord[]>
}

interface InvitationRepository {
  save(record: InvitationRecord): Promise<InvitationRecord>
  findById(invitationId: string): Promise<InvitationRecord | null>
  findPendingBySessionId(sessionId: string): Promise<InvitationRecord | null>
  findRecentBySessionId(sessionId: string, limit: number): Promise<InvitationRecord[]>
  countBySessionId(sessionId: string): Promise<number>
  update(record: InvitationRecord): Promise<InvitationRecord>
}
```

### 6.5 UI 层

- `InviteCard`：展示 prompt/reason，支持输入回应和跳过。
- `SummaryActions`：总结完成后展示返回首页、查看会话页、继续追问；继续追问复用现有 `PATCH /api/sessions/:sessionId/status` 的 `resume` action。
- `MessageList`：接收 pending invitation 和 summary action props，在消息流内插入轻量卡片。
- `MessageInput`：pending invitation 时显示高亮提示，并可作为回应输入。
- `MoreSheet`：点击“总结当前结论”调用 `actions.runDirectorNext(sessionId, { trigger: 'user_request_summary' })`。

### 6.6 依赖关系

```text
DiscussionModule
  -> discussion.store
    -> /api/discussions/:sessionId/director/next
    -> /api/discussions/:sessionId/invitations/:invitationId/respond
      -> DiscussionService
        -> DefaultDirector
        -> DefaultStateMachine
        -> MessageRepository
        -> DirectorDecisionRepository
        -> InvitationRepository
```

## 7. Output Contract

### 7.1 功能类型识别

项目 `workflow.yaml` 的 `project.features` 包含 `web-api`。本迭代新增 HTTP endpoint，因此触发 `web-e2e`。本迭代跨越 UI、store、API route、service、engine、repository，因此触发 `integration`。

引用测试规范：

- `standards/testing/web-e2e.md`
- `standards/testing/integration.md`

### 7.2 对外 API 契约

| 产物 | 输入 | 输出 | 正确性规则 | 产出类型 |
|---|---|---|---|---|
| `POST /api/discussions/:sessionId/director/next` | `DirectorNextRequest` | `DirectorNextResult` | action 合法；非法 phase 不更新状态；总结失败不 completed；pending 邀请唯一；邀请满足 3 条消息冷却和 3 次总上限。 | web-e2e |
| `POST /api/discussions/:sessionId/invitations/:invitationId/respond` | `InvitationRespondRequest` | `InvitationRespondResult` | respond 必须有内容；相同重复请求 200 幂等；冲突重复请求 409；invitation 必须属于 session。 | web-e2e |
| `PATCH /api/sessions/:sessionId/status` resume | `{ action: 'resume' }` | `Session` | 总结后继续追问恢复 running，保留 final summary checkpoint；失败时总结仍可见。 | web-e2e |

### 7.3 公共方法契约

| 方法 | 输入 | 输出 | 正确性规则 | 产出类型 |
|---|---|---|---|---|
| `DefaultDirector.decide()` | `DirectorInput` | `DirectorDecisionRecord` | action 在允许集合内；confidence 0-1；invite 前检查 pending invitation；conclude 提供 host scheduler hint。 | integration |
| `DiscussionService.runDirectorNext()` | sessionId + `DirectorNextRequest` | `DirectorNextResult` | 保存 decision；按 action 创建消息/邀请/状态；错误不产生部分完成状态。 | integration |
| `DiscussionService.respondInvitation()` | sessionId + invitationId + `InvitationRespondRequest` | `InvitationRespondResult` | 幂等；respond 创建用户消息；skip 不创建用户消息；跨 session 拒绝。 | integration |
| `InvitationRepository.findPendingBySessionId()` | sessionId | `InvitationRecord | null` | 同 session 最多返回一个 pending invitation。 | none |
| `DirectorDecisionRepository.findLatestBySessionId()` | sessionId | `DirectorDecisionRecord | null` | 返回当前 session 最新 decision。 | none |

### 7.4 Development Task 契约映射

| Task | 业务描述 | type id | 跨组件链路 |
|---|---|---|---|
| Task-01 | 公共类型承载 Director、Invitation、Summary 和 API 数据流 | integration | 类型 -> Engine -> Service -> API -> Store -> UI |
| Task-02 | Director 产出可测试的四类动作并执行邀请节流 | integration | Director -> SchedulerHint -> StateMachine |
| Task-03 | 本地仓储保存决策、邀请、pending 状态和幂等查询 | none | 否 |
| Task-04 | Director next 服务按 action 创建消息、邀请、事件候选或总结并维护 session 状态 | integration | Service -> Director -> Repositories -> StateMachine |
| Task-05 | Invitation respond 服务实现 respond/skip 幂等和 follow-up continue | integration | Service -> InvitationRepository -> MessageRepository |
| Task-06 | Director next API route 暴露统一响应和错误语义 | web-e2e | HTTP -> Route -> Service -> Engine |
| Task-07 | Invitation respond API route 暴露回应/跳过和幂等错误语义 | web-e2e | HTTP -> Route -> Service -> Repository |
| Task-08 | Discussion store 驱动 Director、邀请回应、跳过和总结后 resume 状态 | integration | UI Store -> HTTP -> API |
| Task-09 | InviteCard 和输入区完成邀请展示、回应、跳过交互 | integration | UI -> Store -> API |
| Task-10 | MoreSheet 总结触发和 SummaryActions 完成收束后操作入口 | integration | UI -> Store -> Director API -> Session status API |

## 8. Change Log

| 文件 | 类型 | 原因 |
|---|---|---|
| `src/types/index.ts` | 修改 | 承载 Director、Invitation、Summary metadata、message metadata 和 scheduler hint 扩展。 |
| `src/types/api.ts` | 修改 | 承载 Director next、invitation respond 和 session resume 相关 DTO 契约。 |
| `src/engine/director.ts` | 修改 | 实现可注入、可测试的 Director 决策入口和节流规则。 |
| `src/engine/state-machine.ts` | 修改 | 为 Director phase transition 提供合法性校验入口。 |
| `src/engine/scheduler.ts` | 修改 | 兼容 Director preferredAction hint 并保留现有 speaker hint 行为。 |
| `src/server/repositories/director.repository.ts` | 新增 | 保存和查询当前 session 的 Director decision 历史。 |
| `src/server/repositories/invitation.repository.ts` | 新增 | 保存、查询、统计和更新 invitation，支撑 pending 唯一、冷却和幂等。 |
| `src/server/repositories/mock/mock-director.repository.ts` | 新增 | 提供本地 Director decision 仓储实现。 |
| `src/server/repositories/mock/mock-invitation.repository.ts` | 新增 | 提供本地 invitation 仓储实现。 |
| `src/server/repositories/mock/instances.ts` | 修改 | 导出共享 mock Director / Invitation repository 实例。 |
| `src/server/services/discussion.service.ts` | 修改 | 编排 Director next、invitation respond、总结完成和错误回滚语义。 |
| `src/app/api/discussions/[sessionId]/director/next/route.ts` | 新增 | 暴露 Director next API，映射统一响应和错误码。 |
| `src/app/api/discussions/[sessionId]/invitations/[invitationId]/respond/route.ts` | 新增 | 暴露 invitation respond/skip API，映射幂等和冲突错误码。 |
| `src/store/discussion.store.ts` | 修改 | 管理 pending invitation、Director action、respond/skip、summary actions 和 resume 后状态。 |
| `src/modules/discussion/index.tsx` | 修改 | 串接邀请、总结和 MoreSheet 的 UI 状态与 actions。 |
| `src/modules/discussion/invite-card.tsx` | 新增 | 展示 invitation prompt/reason，并提交回应或跳过。 |
| `src/modules/discussion/summary-actions.tsx` | 新增 | 展示返回首页、查看会话页、继续追问入口，并触发 resume。 |
| `src/modules/discussion/message-list.tsx` | 修改 | 在消息流内插入 InviteCard 和 SummaryActions。 |
| `src/modules/discussion/message-bubble.tsx` | 修改 | 根据主持人 renderType 和 summary metadata 区分开场、转场、邀请、事件候选和总结。 |
| `src/modules/discussion/message-input.tsx` | 修改 | 在 pending invitation 时展示高亮提示并提交回应内容。 |
| `src/modules/discussion/more-sheet.tsx` | 修改 | “总结当前结论”直接触发 Director conclude 流程。 |

## 9. Development Tasks

- Task-01：落地 Director 与 Invitation 公共类型契约
  - 所属模块：types
  - 简要描述：让 Director、Invitation、Summary metadata、Director API DTO 和 Invitation API DTO 成为 engine、service、route、store、UI 的共享类型来源。
  - 涉及接口/方法：DirectorDecisionRecord, InvitationRecord, DirectorNextRequest, DirectorNextResult, InvitationRespondRequest, InvitationRespondResult
  - 输入：session、message、intent、invitation、director request 的类型定义
  - 输出：可被 engine、service、route、store、UI 共同 import 的公共类型
  - 产出类型：integration
  - 功能类型：跨层 DTO 契约（type id: integration）
  - 是否跨组件：是（组件链路：types -> engine -> service -> route -> store -> UI）
- Task-02：实现 Director 四类动作与邀请节流决策
  - 所属模块：engine
  - 简要描述：让 `DefaultDirector.decide()` 根据 trigger、messages、pending invitation、recent invitations 和轮次输出 `continue`、`invite_user`、`trigger_event`、`conclude`，并在 pending、冷却窗口和总次数上限下禁止重复邀请。
  - 涉及接口/方法：DefaultDirector.decide()
  - 输入：DirectorInput
  - 输出：DirectorDecisionRecord
  - 产出类型：integration
  - 功能类型：引擎决策规则（type id: integration）
  - 是否跨组件：是（组件链路：Director -> StateMachine -> Scheduler）
- Task-03：实现 Director 与 Invitation 本地仓储行为
  - 所属模块：server/repositories
  - 简要描述：保存 Director decision，查询最新 decision；保存 invitation，查询 pending/recent/count，并更新 responded、skipped、expired 状态以支持节流和幂等。
  - 涉及接口/方法：DirectorDecisionRepository.save(), DirectorDecisionRepository.findLatestBySessionId(), InvitationRepository.findPendingBySessionId(), InvitationRepository.findRecentBySessionId(), InvitationRepository.countBySessionId(), InvitationRepository.update()
  - 输入：DirectorDecisionRecord, InvitationRecord, sessionId, invitationId
  - 输出：保存或查询到的记录
  - 产出类型：none
  - 功能类型：本地仓储契约（type id: none）
  - 是否跨组件：否
- Task-04：实现 Director next 服务编排
  - 所属模块：server/services
  - 简要描述：在 `runDirectorNext()` 中读取 session/messages/roles，保存 decision，并按 action 创建角色推进提示、邀请消息、事件候选解释或主持人总结；总结消息保存成功后才推进 `closing` 并完成 session。
  - 涉及接口/方法：DiscussionService.runDirectorNext()
  - 输入：sessionId, DirectorNextRequest
  - 输出：DirectorNextResult
  - 产出类型：integration
  - 功能类型：跨组件服务编排（type id: integration）
  - 是否跨组件：是（组件链路：Service -> Director -> StateMachine -> Repository）
- Task-05：实现 Invitation respond/skip 幂等服务
  - 所属模块：server/services
  - 简要描述：在 `respondInvitation()` 中校验 invitation 归属和 session 可操作性，处理 respond/skip、空内容、相同重复请求、冲突重复请求、用户消息保存和 follow-up continue。
  - 涉及接口/方法：DiscussionService.respondInvitation()
  - 输入：sessionId, invitationId, InvitationRespondRequest
  - 输出：InvitationRespondResult
  - 产出类型：integration
  - 功能类型：跨组件邀请回应流程（type id: integration）
  - 是否跨组件：是（组件链路：Service -> InvitationRepository -> MessageRepository）
- Task-06：实现 Director next API route
  - 所属模块：app/api
  - 简要描述：新增 `POST /api/discussions/[sessionId]/director/next` route，校验 trigger，请求 `DiscussionService.runDirectorNext()`，并按设计错误码返回统一 ApiResponse。
  - 涉及接口/方法：POST()
  - 输入：DirectorNextRequest
  - 输出：ApiResponse<DirectorNextResult>
  - 产出类型：web-e2e
  - 功能类型：Web/API endpoint（type id: web-e2e）
  - 是否跨组件：是（组件链路：HTTP -> Route -> Service -> Engine）
- Task-07：实现 Invitation respond API route
  - 所属模块：app/api
  - 简要描述：新增 `POST /api/discussions/[sessionId]/invitations/[invitationId]/respond` route，校验 action/content，请求 `DiscussionService.respondInvitation()`，并区分相同重复请求和冲突重复请求。
  - 涉及接口/方法：POST()
  - 输入：InvitationRespondRequest
  - 输出：ApiResponse<InvitationRespondResult>
  - 产出类型：web-e2e
  - 功能类型：Web/API endpoint（type id: web-e2e）
  - 是否跨组件：是（组件链路：HTTP -> Route -> Service -> Repository）
- Task-08：实现 Discussion store 的 Director、Invitation 与 resume 状态流
  - 所属模块：store
  - 简要描述：扩展 discussion store 状态和 actions，支持 pending invitation 展示、Director next 请求、respond invitation、skip invitation、错误反馈，以及总结后通过 session status resume 恢复输入。
  - 涉及接口/方法：runDirectorNext(), respondInvitation(), skipInvitation(), resumeFromSummary()
  - 输入：sessionId, DirectorTrigger, invitationId, content, summaryMessageId
  - 输出：store state 更新
  - 产出类型：integration
  - 功能类型：前端状态到 API 链路（type id: integration）
  - 是否跨组件：是（组件链路：UI -> Store -> HTTP API）
- Task-09：实现 InviteCard 与邀请回应 UI
  - 所属模块：modules/discussion
  - 简要描述：新增 InviteCard 并串接 MessageList/MessageInput，在 pending invitation 时展示 prompt/reason、高亮输入区，支持文本回应、空内容拦截、跳过和失败反馈。
  - 涉及接口/方法：InviteCard(), MessageList(), MessageInput()
  - 输入：InvitationRecord, disabled, onRespond, onSkip
  - 输出：React UI 和 invitation action 调用
  - 产出类型：integration
  - 功能类型：UI 与 store 交互（type id: integration）
  - 是否跨组件：是（组件链路：InviteCard -> DiscussionStore -> API）
- Task-10：实现总结触发、总结展示与继续追问入口
  - 所属模块：modules/discussion
  - 简要描述：让 MoreSheet 的“总结当前结论”触发 `user_request_summary` Director flow；在最终总结消息后展示 SummaryActions，并让继续追问调用 session resume、保留 summary checkpoint、恢复输入区。
  - 涉及接口/方法：SummaryActions(), MoreSheet.onSummarize, resumeFromSummary()
  - 输入：summaryMessageId, onBackHome, onViewSessions, onContinue
  - 输出：React UI、Director trigger action 和 session resume action
  - 产出类型：integration
  - 功能类型：UI 到 Director API 与 Session status API 触发链路（type id: integration）
  - 是否跨组件：是（组件链路：MoreSheet -> DiscussionStore -> Director API -> Session status API）
