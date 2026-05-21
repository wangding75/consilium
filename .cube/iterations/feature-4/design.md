# 迭代 4 技术设计：讨论状态机与会话生命周期

## 1. 概述

本次设计用最小改动补齐“会话中心 + 讨论详情页 + 状态机”的生命周期闭环：复用现有 `SessionService`、`SessionRepository`、`DiscussionService`、`DiscussionModule` 和 API Route 结构，在现有 Mock Repository 上扩展查询、状态更新、状态查询与 phase 推进能力。

核心约束：

- 会话生命周期状态面向产品列表与管理，统一为 `running / completed / archived`。
- 讨论 phase 面向引擎推进，保持 `idle / opening / developing / climax / closing`。
- `status` 与 `phase` 只能通过 service / engine 层关联，UI 不直接计算最终状态。
- 讨论页只作为 `/discussion/[sessionId]` 当前会话工作台，不恢复底部“讨论”一级 Tab。
- `closing` 不自动完成会话；主持人总结消息落库后，由用户人工确认完成。
- 本迭代继续使用现有本地 Mock Repository，不新增数据库表。

## 2. Impact Analysis

| 模块/文件 | 影响程度 | 说明 |
|---|---|---|
| `src/types/index.ts` | 修改 | 新增 `SessionLifecycleStatus`、状态历史类型和状态转换类型；会话状态统一支持 `running / completed / archived`。 |
| `src/types/api.ts` | 修改 | 新增会话列表查询、状态更新、讨论状态查询的 DTO；扩展会话详情返回 phase/status 信息。 |
| `src/engine/state-machine.ts` | 修改 | 将现有 skeleton 扩展为独立状态机接口，声明合法转换、消息后推进、历史记录输出。 |
| `src/server/repositories/session.repository.ts` | 修改 | 扩展会话查询、状态更新和 state 更新接口。 |
| `src/server/repositories/mock/mock-session.repository.ts` | 修改 | 在 Mock Repository 中实现接口骨架，后续 04 阶段补齐行为。 |
| `src/server/services/session.service.ts` | 修改 | 扩展列表查询、状态动作和状态查询服务接口。 |
| `src/server/services/discussion.service.ts` | 修改 | 消息发送成功后接入状态机推进；支持主持人总结落库后的完成确认前置条件。 |
| `src/app/api/sessions/route.ts` | 修改 | `GET /api/sessions` 增加 status、keyword、limit 查询参数。 |
| `src/app/api/sessions/[sessionId]/route.ts` | 修改 | 保持 `GET /api/sessions/:sessionId` 会话详情恢复入口，并扩展返回 phase/status 信息。 |
| `src/app/api/sessions/[sessionId]/status/route.ts` | 新增 | 提供 `PATCH /api/sessions/:sessionId/status`。 |
| `src/app/api/sessions/[sessionId]/state/route.ts` | 新增 | 提供 `GET /api/sessions/:sessionId/state`。 |
| `src/app/api/sessions/recent/route.ts` | 修改 | 最近讨论返回统一生命周期状态，继续复用 SessionService 数据源。 |
| `src/modules/sessions/index.tsx` | 修改 | 从占位页升级为会话中心：筛选、搜索、列表、归档/恢复/新建入口。 |
| `src/modules/home/index.tsx` | 修改 | 最近讨论继续复用 `/api/sessions/recent`，展示新状态文案并处理 archived/completed。 |
| `src/modules/discussion/index.tsx` | 修改 | 无效 sessionId 错误状态、当前会话工作台职责、人工确认完成入口。 |
| `src/modules/discussion/more-sheet.tsx` | 修改 | 增加归档、继续讨论、确认完成等会话动作入口。 |

### 接口兼容性

- `POST /api/sessions` 保持路径和请求体兼容；返回 `status` 从旧 `active` 迁移为 `running`。
- `GET /api/sessions` 保持无参数调用兼容；新增可选 `status`、`keyword`、`limit`。
- `GET /api/sessions/:sessionId` 保持现有会话详情能力；返回状态字段统一使用新状态，并返回当前 phase 供讨论页恢复上下文。
- `GET /api/sessions/recent` 保持现有首页调用路径；内部复用 `SessionService.getRecentSessions()` 与状态归一化，确保与会话中心同源。
- 新增 `PATCH /api/sessions/:sessionId/status` 和 `GET /api/sessions/:sessionId/state`，不破坏现有调用方。

### 数据兼容性

当前数据源为 Mock Repository / 本地运行态数据，无持久化数据库迁移。存量测试和旧 Mock 数据中可能出现 `active`，04 阶段实现应在读取边界将旧值归一化为 `running`，输出层只暴露 `running / completed / archived`。

## 3. Flow Design

### 3.1 会话中心查询流程

```text
SessionsModule
  → GET /api/sessions?status&keyword&limit
  → SessionService.listSessions(query)
  → SessionRepository.findMany(query)
  → 返回按 updatedAt 倒序的 Session[]
  → SessionsModule 渲染分段筛选、搜索结果、空状态或错误状态
```

异常流程：

- `status` 非法：API 返回 `VALIDATION_ERROR`。
- `limit` 非法：API 返回 `VALIDATION_ERROR`。
- 查询无结果：返回空数组，由 UI 展示空状态。
- Repository 异常：API 返回 `INTERNAL_ERROR`。

### 3.2 会话状态动作流程

```text
SessionsModule / Discussion MoreSheet
  → PATCH /api/sessions/:sessionId/status { action }
  → SessionService.updateSessionStatus(sessionId, action)
  → SessionRepository.findById(sessionId)
  → 根据 action 计算目标 status 和 reason
  → SessionRepository.updateStatus(sessionId, nextStatus, reason)
  → Repository 追加 status history 并返回更新后的 Session
```

动作规则：

| action | 当前状态 | 目标状态 | 幂等规则 |
|---|---|---|---|
| `archive` | `running` / `completed` / `archived` | `archived` | 已归档再次归档返回当前会话 |
| `resume` | `archived` / `completed` / `running` | `running` | 已进行中再次恢复返回当前会话 |
| `complete` | `running` / `completed` | `completed` | 已完成再次完成返回当前会话 |

`complete` 必须满足：当前 phase 为 `closing`，且已存在主持人总结消息。否则返回 `SUMMARY_REQUIRED`。

### 3.3 讨论 phase 推进流程

```text
POST /api/discussions/:sessionId/messages
  → DiscussionService.sendUserMessage()
  → 保存用户消息和 agent 消息
  → DefaultStateMachine.advanceAfterMessage(session, messages)
  → SessionRepository.updateState(sessionId, nextState, reason)
  → Repository 追加 phase history
  → 返回 SendMessageResult
```

基础推进规则：

| 当前 phase | 触发条件 | 下一 phase |
|---|---|---|
| `idle` | 首次开场或首次消息生成成功 | `opening` |
| `opening` | 已产生主持人开场 + 至少一条角色消息 | `developing` |
| `developing` | turnCount 达到基础阈值或出现分歧/反驳信号 | `climax` |
| `climax` | 用户/系统触发总结或达到最大轮次 | `closing` |
| `closing` | 不自动跳转 | `closing` |

非法转换必须被拒绝并保留原 state。

### 3.4 讨论详情恢复流程

```text
用户点击会话卡片或首页最近讨论
  → router.push('/discussion/[sessionId]')
  → DiscussionModule.loadSession(sessionId)
  → GET /api/sessions/:sessionId
  → loadMessages(sessionId)
  → 渲染标题、模板、角色栏、消息流、输入区
```

异常流程：

- session 不存在：展示错误状态和返回首页/会话中心入口。
- 消息为空：展示可继续讨论的空状态或开场加载状态。
- 讨论详情页不展示会话列表、筛选或阶段评估入口。

## 4. Table Design

本迭代不新增物理数据库表。当前 Phase 1 使用 Mock Repository / 本地运行态数据，以下为会话领域模型字段变更：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `Session.status` | `SessionLifecycleStatus` | 必填 | `running / completed / archived`。输入边界兼容旧 `active` 并归一化为 `running`。 |
| `Session.state.stage` | `DiscussionStage` | 必填 | `idle / opening / developing / climax / closing`。 |
| `Session.state.turnCount` | `number` | `>= 0` | 状态机推进的基础轮次。 |
| `Session.state.lastSpeakerId` | `string | null` | 可空 | 最近发言角色。 |
| `Session.state.history` | `StateHistoryEntry[]` | 可选 | phase/status 变化记录。 |
| `StateHistoryEntry.from` | `string` | 必填 | 变化前状态或 phase。 |
| `StateHistoryEntry.to` | `string` | 必填 | 变化后状态或 phase。 |
| `StateHistoryEntry.reason` | `string` | 必填 | 变化原因。 |
| `StateHistoryEntry.createdAt` | `string` | ISO 字符串 | 变化时间。 |

## 5. API Design

公共响应格式继续遵循 `.cube/config/api-spec.md`：

```ts
type ApiResponse<T> =
  | { success: true; data: T; requestId: string }
  | { success: false; data: null; error: { code: string; message: string; details?: unknown }; requestId: string }
```

### 5.1 GET `/api/sessions`

请求参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `status` | `running | completed | archived` | 否 | 状态筛选。缺省返回全部。 |
| `keyword` | `string` | 否 | 搜索标题、模板、角色。 |
| `limit` | `number` | 否 | 返回数量，默认 20。 |

成功响应：`ApiResponse<Session[]>`，按 `updatedAt` 倒序。

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | status 或 limit 非法。 |
| `INTERNAL_ERROR` | 500 | 服务端异常。 |

### 5.2 GET `/api/sessions/:sessionId`

成功响应：`ApiResponse<SessionDetailResult>`。

`SessionDetailResult` 以现有详情 DTO 为基础，明确最小字段集并新增 phase/state：

```ts
interface SessionDetailResult {
  sessionId: string
  topic: string
  template: { templateId: string; name: string }
  status: SessionLifecycleStatus
  phase: DiscussionStage
  state: DiscussionState
  // invariant: phase === state.stage
  roles: Array<{
    roleId: string
    name: string
    agentType: AgentType
    avatar: string
    model: string
  }>
  activeSpeakerId: string | null
  createdAt: string
  updatedAt: string
}
```

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `SESSION_NOT_FOUND` | 404 | sessionId 不存在。 |
| `INTERNAL_ERROR` | 500 | 服务端异常。 |

### 5.3 GET `/api/sessions/recent`

成功响应：`ApiResponse<Session[]>`，默认返回最近 10 条，按 `updatedAt` 倒序，状态字段输出 `running / completed / archived`。

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `INTERNAL_ERROR` | 500 | 服务端异常。 |

### 5.4 PATCH `/api/sessions/:sessionId/status`

请求体：

```ts
interface UpdateSessionStatusRequest {
  action: 'archive' | 'complete' | 'resume'
}
```

成功响应：`ApiResponse<Session>`。

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `SESSION_NOT_FOUND` | 404 | sessionId 不存在。 |
| `VALIDATION_ERROR` | 400 | action 非法。 |
| `SUMMARY_REQUIRED` | 409 | complete 时尚未满足 closing + 主持人总结落库条件。 |
| `INTERNAL_ERROR` | 500 | 服务端异常。 |

### 5.5 GET `/api/sessions/:sessionId/state`

成功响应：

```ts
interface SessionStateResult {
  sessionId: string
  status: SessionLifecycleStatus
  phase: DiscussionStage
  state: DiscussionState
  history: StateHistoryEntry[]
}
```

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `SESSION_NOT_FOUND` | 404 | sessionId 不存在。 |
| `INTERNAL_ERROR` | 500 | 服务端异常。 |

### 5.6 POST `/api/discussions/:sessionId/messages`

保留现有请求与响应；新增副作用：消息和 agent 回复落库后，调用状态机推进 phase 并记录 history。若状态机推进失败，不应导致已成功生成的消息丢失；API 返回现有消息结果，并在服务层记录可诊断错误。

错误码沿用现有消息 API：

| code | HTTP | 说明 |
|---|---:|---|
| `SESSION_NOT_FOUND` | 404 | sessionId 不存在。 |
| `VALIDATION_ERROR` | 400 | 消息内容或请求体非法。 |
| `INTERNAL_ERROR` | 500 | 消息保存、agent 调用或不可恢复服务端异常。 |

状态机推进失败属于已落库消息后的可降级副作用失败：服务层保留原 phase，记录诊断信息，不新增 HTTP 错误码，不改变 `SendMessageResult` 成功返回结构。

## 6. Module Design

### 6.1 类型层 `src/types/*`

新增/扩展导出：

```ts
export type SessionLifecycleStatus = 'running' | 'completed' | 'archived'
export type SessionStatusAction = 'archive' | 'complete' | 'resume'

export interface StateHistoryEntry {
  from: string
  to: string
  reason: string
  createdAt: string
}

export interface DiscussionState {
  stage: DiscussionStage
  turnCount: number
  lastSpeakerId: string | null
  history?: StateHistoryEntry[]
}
```

### 6.2 状态机层 `src/engine/state-machine.ts`

接口：

```ts
interface StateMachine {
  getState(session: Session): DiscussionState
  canTransition(from: DiscussionStage, to: DiscussionStage): boolean
  transition(session: Session, nextStage: DiscussionStage, reason: string): DiscussionState
  advanceAfterMessage(session: Session, messages: DiscussionMessage[]): DiscussionState
}
```

正确性规则：

- 只允许 `idle → opening → developing → climax → closing` 方向上的相邻或受控转换。
- 非法转换抛出 `ServiceError('INVALID_STATE_TRANSITION', ...)` 或等价错误。
- 状态机只计算下一 `DiscussionState`，不直接追加 history；Repository 是 phase/status history 的唯一持久化写入边界。

### 6.3 Repository 层

`SessionRepository` 扩展：

```ts
findMany(query?: ListSessionsQuery): Promise<Session[]>
updateStatus(id: string, status: SessionLifecycleStatus, reason: string): Promise<Session | null>
updateState(id: string, state: DiscussionState, reason: string): Promise<Session | null>
```

History 写入归属：`DefaultStateMachine` 和 `SessionService` 只计算目标状态与 reason；`SessionRepository.updateStatus()` / `updateState()` 是唯一追加 `StateHistoryEntry` 的边界，避免重复记录。

### 6.4 Service 层

`SessionService` 扩展：

```ts
listSessions(query?: ListSessionsQuery): Promise<Session[]>
updateSessionStatus(sessionId: string, action: SessionStatusAction): Promise<Session>
getSessionState(sessionId: string): Promise<SessionStateResult>
```

`DiscussionService` 扩展：

- `sendUserMessage()` 成功保存消息后调用状态机推进。
- 主持人总结消息落库后，保留当前 phase 为 `closing`，等待用户通过 `complete` 人工确认。

### 6.5 UI 层

`SessionsModule`：

- 加载 `/api/sessions` 数据。
- 支持分段筛选、关键词搜索、空状态、错误状态。
- 会话卡片点击进入 `/discussion/[sessionId]`。
- 支持归档、恢复、新建入口。

`HomeModule`：

- 最近讨论继续调用统一会话数据源。
- 状态文案映射：`running → 进行中`，`completed → 已完成`，`archived → 已归档`。

`DiscussionModule` / `MoreSheet`：

- 无效 sessionId 展示错误和返回入口。
- 更多操作中提供归档、继续讨论、确认完成入口。
- 不展示会话列表、筛选或阶段评估入口。

## 7. Output Contract

| 产出 | 输入 | 输出 | 产出类型 | 正确性规则 | 测试规范 |
|---|---|---|---|---|---|
| `DefaultStateMachine.transition()` | `Session`, `DiscussionStage`, `reason` | `DiscussionState` | `library` | 合法转换返回新 stage；非法转换拒绝且不改变原 state；history 由 Repository 追加。 | `standards/testing/library.md` |
| `DefaultStateMachine.advanceAfterMessage()` | `Session`, `DiscussionMessage[]` | `DiscussionState` | `library` | 根据消息历史和 turnCount 只推进到合法下一阶段。 | `standards/testing/library.md` |
| `SessionRepository.findMany()` | `ListSessionsQuery` | `Session[]` | `library` | status/keyword/limit 生效，按 updatedAt 倒序，并归一化旧 `active` 为 `running`。 | `standards/testing/library.md` |
| `SessionService.listSessions()` | `ListSessionsQuery` | `Session[]` | `integration` | Service -> Repository 查询链路传递筛选参数、归一化状态并映射异常。 | `standards/testing/integration.md` |
| `SessionService.updateSessionStatus()` | `sessionId`, `action` | `Session` | `integration` | Service -> Repository 链路保持幂等、完成前置条件和错误映射。 | `standards/testing/integration.md` |
| `SessionService.getSessionState()` | `sessionId` | `SessionStateResult` | `integration` | 返回 phase/status/history；不存在映射为 `SESSION_NOT_FOUND`。 | `standards/testing/integration.md` |
| `GET /api/sessions` | query params | `ApiResponse<Session[]>` | `web-e2e` | HTTP 入口覆盖成功、校验失败、空结果。 | `standards/testing/web-e2e.md` |
| `GET /api/sessions/:sessionId` | `sessionId` | `ApiResponse<SessionDetailResult>` | `web-e2e` | 恢复详情返回 normalized status、phase、角色和时间信息；不存在返回 404。 | `standards/testing/web-e2e.md` |
| `GET /api/sessions/recent` | none | `ApiResponse<Session[]>` | `web-e2e` | 首页最近讨论与会话中心同源，按 updatedAt 倒序并输出 normalized status。 | `standards/testing/web-e2e.md` |
| `PATCH /api/sessions/:sessionId/status` | `{ action }` | `ApiResponse<Session>` | `web-e2e` | HTTP 入口覆盖归档、恢复、完成前置条件、NOT_FOUND。 | `standards/testing/web-e2e.md` |
| `GET /api/sessions/:sessionId/state` | `sessionId` | `ApiResponse<SessionStateResult>` | `web-e2e` | 返回 status、phase、history；不存在返回 404。 | `standards/testing/web-e2e.md` |
| `POST /api/discussions/:sessionId/messages` phase 副作用 | user message | `SendMessageResult`，并持久化更新后的 state | `integration` | 消息落库后推进 phase；推进失败不丢消息且保留原 phase。 | `standards/testing/integration.md` |
| 会话中心 UI | 用户点击/输入 | 页面状态变化 | `integration` | UI -> API -> Store/State -> UI 渲染链路覆盖筛选、搜索、归档、恢复。 | `standards/testing/integration.md` |
| 首页最近讨论与讨论详情恢复 | 最近会话 / sessionId | 页面状态变化 | `integration` | HomeModule/DiscussionModule -> API Route -> SessionService 链路展示统一状态并处理无效 sessionId。 | `standards/testing/integration.md` |

项目 `workflow.yaml` 声明 `features: [web-api]`，本迭代新增/修改 HTTP endpoint，因此必须包含 `web-e2e` 类型化测试。会话中心与 API/服务链路跨组件，因此必须包含 `integration` 类型化测试。

## 8. Change Log

| 文件 | 类型 | 原因 |
|---|---|---|
| `src/types/index.ts` | 修改 | 声明会话生命周期状态、状态历史和 DiscussionState 扩展。 |
| `src/types/api.ts` | 修改 | 声明列表查询、状态动作、状态查询和会话详情 DTO。 |
| `src/engine/state-machine.ts` | 修改 | 扩展状态机公共接口和 skeleton。 |
| `src/server/repositories/session.repository.ts` | 修改 | 扩展 Repository 查询、状态更新、state 更新接口。 |
| `src/server/repositories/mock/mock-session.repository.ts` | 修改 | 补齐 Mock Repository skeleton。 |
| `src/server/services/session.service.ts` | 修改 | 声明列表查询、状态动作、状态查询服务方法。 |
| `src/server/services/discussion.service.ts` | 修改 | 接入消息后 phase 推进的服务边界。 |
| `src/app/api/sessions/route.ts` | 修改 | GET 支持查询参数。 |
| `src/app/api/sessions/[sessionId]/route.ts` | 修改 | 会话详情返回 normalized status、phase 和 state。 |
| `src/app/api/sessions/[sessionId]/status/route.ts` | 新增 | 新增 status PATCH handler。 |
| `src/app/api/sessions/[sessionId]/state/route.ts` | 新增 | 新增 state 查询 handler。 |
| `src/app/api/sessions/recent/route.ts` | 修改 | 统一最近讨论状态输出并复用会话查询链路。 |
| `src/modules/sessions/index.tsx` | 修改 | 实现会话中心 UI。 |
| `src/modules/home/index.tsx` | 修改 | 统一最近讨论状态文案和入口。 |
| `src/modules/discussion/index.tsx` | 修改 | 错误状态与人工完成动作集成。 |
| `src/modules/discussion/more-sheet.tsx` | 修改 | 增加会话生命周期动作入口。 |

## 9. Development Tasks

- Task-01：统一会话生命周期状态与状态历史类型
  - 所属模块：types
  - 简要描述：新增 `SessionLifecycleStatus`、`SessionStatusAction`、`StateHistoryEntry`，并扩展 API DTO。
  - 涉及接口/方法：`SessionLifecycleStatus`, `SessionStateResult`, `UpdateSessionStatusRequest`
  - 输入：现有 session/domain/api 类型
  - 输出：可被 service、repository、route 和 UI 引用的公共类型
  - 产出类型：library
  - 功能类型：公共类型契约（type id: library）
  - 正确性规则：所有公共 DTO 只暴露 `running / completed / archived`，并保留 phase/history 字段类型。
  - 是否跨组件：否
- Task-02：实现讨论状态机合法转换与消息后推进接口
  - 所属模块：engine
  - 简要描述：扩展 `DefaultStateMachine`，支持合法 phase 转换、非法转换拒绝、消息后基础推进和 history 输出。
  - 涉及接口/方法：`DefaultStateMachine.transition()`, `DefaultStateMachine.advanceAfterMessage()`
  - 输入：`Session`, `DiscussionStage`, `DiscussionMessage[]`
  - 输出：`DiscussionState`
  - 产出类型：library
  - 功能类型：状态机库逻辑（type id: library）
  - 正确性规则：只允许合法相邻推进，非法转换拒绝并保持原 state；合法转换只返回下一 state，history 由 Repository 追加。
  - 是否跨组件：否
- Task-03：扩展会话仓储查询与状态更新接口
  - 所属模块：server/repositories
  - 简要描述：为 `SessionRepository` 和 Mock 实现增加列表查询、状态更新、state 更新能力，并在读取边界兼容旧 `active` 状态。
  - 涉及接口/方法：`findMany()`, `updateStatus()`, `updateState()`
  - 输入：`ListSessionsQuery`, `SessionLifecycleStatus`, `DiscussionState`
  - 输出：`Session[]` 或更新后的 `Session | null`
  - 产出类型：library
  - 功能类型：仓储库逻辑（type id: library）
  - 正确性规则：筛选、搜索、limit、更新时间排序和 `active` -> `running` 归一化在仓储边界生效。
  - 是否跨组件：否
- Task-04：实现 SessionService 会话查询与生命周期动作
  - 所属模块：server/services
  - 简要描述：实现会话列表筛选搜索、归档/恢复/人工完成、状态查询和错误映射。
  - 涉及接口/方法：`listSessions()`, `updateSessionStatus()`, `getSessionState()`
  - 输入：query、sessionId、action
  - 输出：`Session[]`, `Session`, `SessionStateResult`
  - 产出类型：integration
  - 功能类型：Service -> Repository 状态链路（type id: integration）
  - 正确性规则：查询链路透传筛选条件；状态动作幂等；complete 必须满足 closing + 主持人总结落库；not found 映射为 `SESSION_NOT_FOUND`。
  - 是否跨组件：是（组件链路：API Route -> SessionService -> SessionRepository）
- Task-05：实现会话列表、状态更新和状态查询 API
  - 所属模块：app/api
  - 简要描述：实现 `GET /api/sessions` 查询参数、`GET /api/sessions/:sessionId` 状态扩展、`GET /api/sessions/recent` 状态统一、`PATCH /api/sessions/:sessionId/status`、`GET /api/sessions/:sessionId/state`。
  - 涉及接口/方法：`GET /api/sessions`, `GET /api/sessions/:sessionId`, `GET /api/sessions/recent`, `PATCH /api/sessions/:sessionId/status`, `GET /api/sessions/:sessionId/state`
  - 输入：HTTP query、path param、JSON body
  - 输出：`ApiResponse<Session[]>`, `ApiResponse<SessionDetailResult>`, `ApiResponse<Session>`, `ApiResponse<SessionStateResult>`
  - 产出类型：web-e2e
  - 功能类型：Web/API HTTP 入口（type id: web-e2e）
  - 正确性规则：每个 HTTP 入口返回统一 ApiResponse；校验失败、not found、summary required 和 internal error 均映射到设计错误码。
  - 是否跨组件：是（组件链路：HTTP Route -> SessionService -> SessionRepository）
- Task-06：实现会话中心搜索筛选归档恢复 UI
  - 所属模块：modules/sessions
  - 简要描述：将会话页从占位升级为会话中心，支持分段筛选、搜索、卡片恢复、归档、恢复和新建入口。
  - 涉及接口/方法：`SessionsModule`
  - 输入：用户点击、搜索关键词、API 返回会话列表
  - 输出：会话列表 UI、空状态、错误状态和导航动作
  - 产出类型：integration
  - 功能类型：前端 UI -> API -> UI 状态链路（type id: integration）
  - 正确性规则：筛选、搜索、归档、恢复、新建入口和空/错误状态均能从用户操作反映到 UI。
  - 是否跨组件：是（组件链路：SessionsModule -> /api/sessions -> SessionService）
- Task-07：统一首页最近讨论与讨论详情入口状态处理
  - 所属模块：modules/home, modules/discussion
  - 简要描述：首页最近讨论使用新状态文案和统一 sessionId 跳转；讨论详情页处理无效 sessionId 错误并保持当前会话工作台职责。
  - 涉及接口/方法：`HomeModule`, `DiscussionModule`
  - 输入：最近会话列表、sessionId、加载错误
  - 输出：首页最近讨论列表、讨论详情错误/加载/正常状态
  - 产出类型：integration
  - 功能类型：首页/讨论 UI 与会话 API 链路（type id: integration）
  - 正确性规则：首页最近讨论状态文案与会话中心一致；有效 sessionId 恢复详情；无效 sessionId 展示返回入口且不进入默认讨论页。
  - 是否跨组件：是（组件链路：HomeModule/DiscussionModule -> API Route -> SessionService）
- Task-08：在消息发送后推进 phase 并支持人工确认完成
  - 所属模块：server/services, modules/discussion
  - 简要描述：消息落库后调用状态机推进 phase；主持人总结消息落库后，用户可通过更多操作人工确认完成会话。
  - 涉及接口/方法：`DiscussionService.sendUserMessage()`, `MoreSheet`, `PATCH /api/sessions/:sessionId/status`
  - 输入：用户消息、agent 消息、complete action
  - 输出：更新后的 phase/history 和会话 `completed` 状态
  - 产出类型：integration
  - 功能类型：DiscussionService -> StateMachine -> SessionRepository -> UI 动作链路（type id: integration）
  - 正确性规则：消息成功落库后才推进 phase；推进失败不丢消息；只有 closing + 主持人总结落库后 complete 才成功。
  - 是否跨组件：是（组件链路：DiscussionService -> DefaultStateMachine -> SessionRepository -> DiscussionModule）
