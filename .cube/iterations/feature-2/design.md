# 迭代 2 技术设计：多 Agent 运行时基础架构

## 概述

本次设计目标：在现有骨架基础上实现多 Agent 讨论运行时，包括 ContextBuilder、Scheduler、AgentRuntime、DiscussionOrchestrator 四个核心引擎模块，以及 LLMClient / MockLLMClient 封装、消息/日志仓储层、三个讨论 API，以及讨论页基础前端联动。

核心原则：
- 在现有骨架代码基础上扩展，不重写无关模块
- 严格遵循已有的 Repository → Service → API Route 分层模式
- 引擎层与 UI 层隔离，UI 只调 API；Engine 层不直接依赖 Server 仓储层

**类型替换说明（C-01/C-02 修正）**：`src/types/index.ts` 中现有的 `AgentProfile`、`AgentRuntime`（接口）、`AgentOutput`、`Agent` 将被**替换**（非扩展）为与本次设计契约一致的定义。同样，`src/engine/scheduler.ts` 和 `src/engine/orchestrator.ts` 的现有接口/实现将被**完整替换**。受影响的现有文件（需同步更新或删除引用）：`src/engine/engine.test.ts`（引用了 `DefaultScheduler`）。

---

## Impact Analysis

| 模块/文件 | 影响 | 说明 |
|---|---|---|
| `src/types/index.ts` | 修改 | 新增 `AgentType`、`DiscussionMessage`、`AgentCallLog`、更新 `Role.agentType`、扩展 `AgentProfile` |
| `src/types/api.ts` | 修改 | 新增讨论 API 的请求/响应类型 |
| `src/data/templates/three-kingdoms.ts` | 修改 | 为每个 role 补充 `agentType` 字段 |
| `src/engine/orchestrator.ts` | 修改 | **替换** `Orchestrator` 接口和 `DefaultOrchestrator` stub，实现 `DiscussionOrchestrator` |
| `src/engine/scheduler.ts` | 修改 | **替换** `Scheduler` 接口和 `DefaultScheduler` stub，实现 `selectSpeakers` 接口和 `RoundRobinScheduler` |
| `src/engine/engine.test.ts` | 修改 | 删除对旧 `DefaultScheduler` 的引用，对齐新接口 |
| `src/engine/context-builder.ts` | 新增 | `ContextBuilder` 实现 |
| `src/engine/agent-runtime.ts` | 新增 | `DefaultAgentRuntime` 实现 |
| `src/llm/mock-llm-client.ts` | 新增 | `MockLLMClient` 实现 |
| `src/server/repositories/message.repository.ts` | 新增 | `MessageRepository` 接口 |
| `src/server/repositories/agent-call-log.repository.ts` | 新增 | `AgentCallLogRepository` 接口 |
| `src/server/repositories/mock/mock-message.repository.ts` | 新增 | `MockMessageRepository` |
| `src/server/repositories/mock/mock-agent-call-log.repository.ts` | 新增 | `MockAgentCallLogRepository` |
| `src/server/repositories/mock/instances.ts` | 修改 | 新增 `sharedMessageRepo`、`sharedAgentCallLogRepo` |
| `src/server/services/discussion.service.ts` | 修改 | 修改构造函数（注入 5 个依赖），扩展 `getSessionDetail`、`getMessages`、`sendUserMessage` |
| `src/engine/engine.test.ts` | 修改 | 删除旧 `DefaultScheduler`/`Orchestrator` 引用，对齐新接口 |
| `src/app/api/discussions/route.ts` | 修改 | 更新 `DiscussionService` 构造调用以匹配新构造函数签名 |
| `src/app/api/sessions/[sessionId]/route.ts` | 新增 | `GET /api/sessions/:sessionId` |
| `src/app/api/discussions/[sessionId]/messages/route.ts` | 新增 | `GET/POST /api/discussions/:sessionId/messages` |
| `src/modules/discussion/role-bar.tsx` | 新增 | `RoleBar` 组件 |
| `src/modules/discussion/message-list.tsx` | 新增 | `MessageList` + `MessageBubble` 组件 |
| `src/modules/discussion/message-input.tsx` | 新增 | `MessageInput` 组件 |
| `src/modules/discussion/index.tsx` | 修改 | 接入三个子组件，完成前后端联动 |

**不受影响**：`SessionService`、`SessionRepository`、`TemplateRepository`、`GET /api/sessions`、`POST /api/sessions`、`GET /api/discussions`（保留，但构造调用需更新）、首页模块、健康检查。

**接口兼容性**：现有 API 响应格式（`ApiResponse<T>`）不变，所有新 API 遵循同一格式。

---

## Flow Design

### 主流程：用户发送消息触发 Agent 发言

一次 `POST /api/discussions/:sessionId/messages` 触发当前轮次所有被 Scheduler 选中的 Agent 串行发言（通常是 1 条用户消息对应 N 条 Agent 消息），确保"一轮讨论至少覆盖 3 个非主持角色"的要求可在单次交互中实现。

```
POST /api/discussions/:sessionId/messages
  ↓
DiscussionService.sendUserMessage(sessionId, content)
  ├─ 1. 查 SessionRepository.findById(sessionId) → Session
  ├─ 2. 查 TemplateRepository.findById(session.templateId) → Template
  ├─ 3. 构建 AgentProfile[] = template.roles.map(roleToAgentProfile)
  ├─ 4. 查 MessageRepository.findBySessionId(sessionId) → DiscussionMessage[]
  ├─ 5. 保存用户消息 → MessageRepository.save(userMsg)
  └─ 6. DiscussionOrchestrator.run(input) → OrchestratorResult
            ├─ Scheduler.selectSpeakers(input) → { speakerIds: string[], reason }
            ├─ for each speakerId in speakerIds（串行执行）：
            │    ├─ ContextBuilder.build(role, topic, templateName, updatedHistory) → LLMMessage[]
            │    ├─ AgentRuntime.run(profile, contextMessages) → AgentOutput
            │    └─ 构造 DiscussionMessage 和 AgentCallLogData（不直接写库）
            └─ 返回 { agentMessages: DiscussionMessage[], callLogs: AgentCallLogData[], activeSpeakerId }
  ├─ 7. 保存所有 agentMessages → MessageRepository.save(each)
  └─ 8. 保存所有 callLogs → AgentCallLogRepository.save(each)
  → 返回 { userMessage, agentMessages[], activeSpeakerId, runId }
```

**架构约束（M-04 修正）**：`DiscussionOrchestrator` 属于 Engine 层，不直接持有 `AgentCallLogRepository`（避免 engine→server/repositories 跨层依赖）。Orchestrator 只构造日志数据结构（`AgentCallLogData`）作为返回值的一部分，由 Service 层负责持久化。

### 开场流程（空历史时）

当 content 为空字符串 且 messageHistory 为空时：
- Scheduler 选择 Host 开场
- 不保存用户消息（无用户消息）
- 返回 Host 开场 agentMessage
- activeSpeakerId = host.roleId

当 content 为空字符串 且 messageHistory 不为空时：
- 返回错误 `MESSAGE_EMPTY`

### 异常流程

| 场景 | 处理 |
|---|---|
| SessionId 不存在 | ServiceError(`SESSION_NOT_FOUND`) |
| Template 不存在 | ServiceError(`TEMPLATE_NOT_FOUND`) |
| 消息为空且非首条 | ServiceError(`MESSAGE_EMPTY`) |
| Scheduler 找不到可用角色 | ServiceError(`NO_AVAILABLE_AGENT`) |
| MockLLMClient / Provider 错误 | ServiceError(`LLM_PROVIDER_ERROR`)，同时写 AgentCallLog(status:failed) |
| AgentRuntime 生成失败 | ServiceError(`AGENT_GENERATION_FAILED`) |

---

## Table Design

本迭代使用 in-memory mock 存储，无数据库。数据结构如下：

### DiscussionMessage（存入 MessageRepository）

| 字段 | 类型 | 说明 |
|---|---|---|
| messageId | string | UUID |
| sessionId | string | 关联会话 |
| type | 'host' \| 'character' \| 'user' \| 'system' | 消息来源类型 |
| roleId | string \| undefined | 角色 ID（user 类型时为 undefined） |
| agentType | 'host' \| 'expert' \| 'critic' \| undefined | Agent 类型 |
| content | string | 消息文本 |
| status | 'completed' \| 'streaming' \| 'failed' | 状态 |
| createdAt | string | ISO 8601 时间戳 |
| metadata | object \| undefined | roundIndex, isMock, promptTokens, completionTokens, durationMs |

### AgentCallLog（存入 AgentCallLogRepository）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | UUID |
| sessionId | string | 关联会话 |
| runId | string | 本次 run 的 UUID |
| messageId | string \| undefined | 关联消息 |
| agentId | string | = roleId（本迭代同值） |
| roleId | string | 角色 ID |
| provider | string | 'mock' 或真实 provider 名 |
| model | string | 使用的模型 |
| inputSummary | string | 输入摘要（前 200 字符） |
| outputSummary | string \| undefined | 输出摘要（前 200 字符） |
| output | string \| undefined | 完整输出 |
| promptTokens | number \| undefined | 输入 token 数 |
| completionTokens | number \| undefined | 输出 token 数 |
| totalTokens | number \| undefined | 总 token 数 |
| cost | number \| undefined | 调用成本（USD，mock 时为 0） |
| durationMs | number | 调用耗时 |
| status | 'success' \| 'failed' | 状态 |
| errorCode | string \| undefined | 错误码 |
| errorMessage | string \| undefined | 错误消息 |
| createdAt | string | ISO 8601 时间戳 |

---

## API Design

所有接口遵循 `api-spec.md` 的 `ApiResponse<T>` 格式：
```ts
{ success: true; data: T; requestId: string }
| { success: false; data: null; error: { code, message }; requestId: string }
```

### GET /api/sessions/:sessionId

**描述**：获取会话详情（含角色列表、模板名称、activeSpeakerId）

**成功响应** `200`：
```ts
{
  sessionId: string
  topic: string
  template: { templateId: string; name: string }
  status: 'active' | 'completed' | 'archived'  // 与 Session 类型一致（注：baseline 示例中的 "running" 为笔误）
  roles: Array<{
    roleId: string
    name: string
    agentType: 'host' | 'expert' | 'critic'
    avatar: string        // avatarEmoji 或 role.name 首字
    model: string         // 'mock-role-model' for mock
  }>
  activeSpeakerId: string | null
  createdAt: string
  updatedAt: string
}
```

**错误码**：
| code | HTTP | 场景 |
|---|---|---|
| `SESSION_NOT_FOUND` | 404 | 会话不存在 |
| `INTERNAL_ERROR` | 500 | 未知错误 |

---

### GET /api/discussions/:sessionId/messages

**描述**：获取指定会话的消息列表

**Query 参数**：`limit`（默认 50）、`before`（messageId，分页游标）

**成功响应** `200`：
```ts
{
  sessionId: string
  messages: DiscussionMessage[]
  activeSpeakerId: string | null
  hasMore: boolean
}
```

**错误码**：
| code | HTTP | 场景 |
|---|---|---|
| `SESSION_NOT_FOUND` | 404 | 会话不存在 |
| `INTERNAL_ERROR` | 500 | 未知错误 |

---

### POST /api/discussions/:sessionId/messages

**描述**：提交用户消息并触发下一轮 Agent 发言。content 为空字符串时，若历史为空则触发 Host 开场，否则返回 `MESSAGE_EMPTY`。

**请求体**：
```ts
{ content: string; clientMessageId?: string }
```

**成功响应** `200`：
```ts
{
  sessionId: string
  runId: string
  userMessage: DiscussionMessage | null   // 开场时为 null
  agentMessages: DiscussionMessage[]
  activeSpeakerId: string | null
}
```

**错误码**：
| code | HTTP | 场景 |
|---|---|---|
| `SESSION_NOT_FOUND` | 404 | 会话不存在 |
| `MESSAGE_EMPTY` | 400 | 非首条消息但内容为空 |
| `TEMPLATE_NOT_FOUND` | 404 | 模板不存在 |
| `NO_AVAILABLE_AGENT` | 500 | 无可调度角色 |
| `LLM_PROVIDER_ERROR` | 502 | LLM 调用失败 |
| `AGENT_GENERATION_FAILED` | 500 | Agent 生成失败 |

---

## Module Design

### LLM 层

**`MockLLMClient`** (`src/llm/mock-llm-client.ts`)

- 接口：实现 `LLMProvider`（现有 `src/llm/providers/base.provider.ts`）
- `chat(messages, config): Promise<string>`
- 根据 systemPrompt 中的角色特征（host/expert/critic）返回差异化的稳定文本
- 支持模拟失败：`config.model === 'mock-fail'` 时抛出错误

---

### 引擎层

**`ContextBuilder`** (`src/engine/context-builder.ts`)

- `build(input: ContextBuilderInput): LLMMessage[]`
- `ContextBuilderInput`：`{ sessionId, topic, templateName, role: AgentProfile, messageHistory: DiscussionMessage[], maxMessages?, maxChars? }`  （使用 `DiscussionMessage[]` 而非旧的 `Message[]`）
- 拼装规则：`[system: role.systemPrompt + topic + templateName]` + `[user/assistant: 最近 N 条消息]`
- 长度控制：默认 maxMessages=20，maxChars=4000；超出时截断最旧消息

**`Scheduler`** (`src/engine/scheduler.ts`)

- 接口：`selectSpeakers(input: SpeakerSelectionInput): SpeakerSelectionResult`
- `SpeakerSelectionInput`：`{ sessionId, roles: AgentProfile[], messageHistory: DiscussionMessage[], roundIndex, lastSpeakerId?, policy? }`
- `SpeakerSelectionResult`：`{ speakerIds: string[], reason: string }`
- 策略 `RoundRobinScheduler`：
  - 空历史 → 选 Host
  - 其余 → 轮转非 Host 角色，跳过 `lastSpeakerId`
  - 返回单个 speakerId（串行）

**`AgentRuntime`** (`src/engine/agent-runtime.ts`)

- `run(profile: AgentProfile, contextMessages: LLMMessage[]): Promise<AgentOutput>`
- 委托 `LLMProvider.chat()` 调用，返回 `AgentOutput`
- `AgentOutput`：`{ agentId, roleId, messageType: 'host'|'character', content, metadata }`

**`DiscussionOrchestrator`** (`src/engine/orchestrator.ts`)

- 替换现有 `Orchestrator` 接口和 `DefaultOrchestrator`
- `run(input: OrchestratorInput): Promise<OrchestratorResult>`
- `OrchestratorInput`：`{ sessionId, runId, topic, templateName, profiles: AgentProfile[], messageHistory: DiscussionMessage[], triggerContent: string | null }`
- 流程：`Scheduler.selectSpeakers(input)` → 对每个 speakerId 串行执行 `ContextBuilder.build → AgentRuntime.run`，构造 `DiscussionMessage` 和 `AgentCallLogData`
- `OrchestratorResult`：`{ agentMessages: DiscussionMessage[], callLogs: AgentCallLogData[], activeSpeakerId: string | null }`
- **注意**：Orchestrator 不持有任何 Repository（Engine 层不依赖 Server/Repository 层）

---

### 仓储层

**`MessageRepository`** (`src/server/repositories/message.repository.ts`)
```ts
interface MessageRepository {
  findBySessionId(sessionId: string, opts?: { limit: number; before?: string }): Promise<DiscussionMessage[]>
  save(msg: DiscussionMessage): Promise<DiscussionMessage>
  countBySessionId(sessionId: string): Promise<number>
}
```

**`AgentCallLogRepository`** (`src/server/repositories/agent-call-log.repository.ts`)
```ts
interface AgentCallLogRepository {
  save(log: AgentCallLog): Promise<AgentCallLog>
  findBySessionId(sessionId: string): Promise<AgentCallLog[]>
}
```

**Mock 实现**：内存 Map，`instances.ts` 加入全局共享实例。

---

### 服务层

**`DiscussionService`** 扩展 (`src/server/services/discussion.service.ts`)

新增三个方法，注入 `SessionRepository`、`TemplateRepository`、`MessageRepository`、`AgentCallLogRepository`、`DiscussionOrchestrator`：

- `getSessionDetail(sessionId: string): Promise<SessionDetailResult>`
- `getMessages(sessionId: string, opts: { limit: number; before?: string }): Promise<MessageListResult>`
- `sendUserMessage(sessionId: string, content: string, clientMessageId?: string): Promise<SendMessageResult>`

---

### 前端层

**`RoleBar`** (`src/modules/discussion/role-bar.tsx`)
- Props: `roles: RoleInfo[]`, `activeSpeakerId: string | null`
- 横向滚动角色头像列表，当前 activeSpeakerId 对应角色高亮显示边框/背景

**`MessageList`** (`src/modules/discussion/message-list.tsx`)
- Props: `messages: DiscussionMessage[]`, `isLoading: boolean`
- 按时间排列消息，host/character 在左，user 在右
- Loading 时在末尾显示 Typing 指示器（三个点动画）
- 错误消息在列表末尾显示红色提示 + 重试按钮

**`MessageInput`** (`src/modules/discussion/message-input.tsx`)
- Props: `onSend: (content: string) => Promise<void>`, `disabled: boolean`
- 文本输入框 + 发送按钮，发送中禁用

**`DiscussionModule`** (`src/modules/discussion/index.tsx`)
- 挂载时调用 GET session detail + GET messages（含开场触发逻辑）
- 发送消息时调用 POST messages
- 管理 loading / error / messages 状态

---

## Output Contract

| 任务 | 功能描述 | 产出类型 | type id | 是否跨组件 | 测试规范 |
|---|---|---|---|---|---|
| Task-01 | 类型定义 | none | — | 否 | — |
| Task-02 | MockLLMClient | library | library | 否 | — |
| Task-03 | ContextBuilder | library | library | 否 | — |
| Task-04 | Scheduler | library | library | 否 | — |
| Task-05 | AgentRuntime | integration | integration | 是（AgentRuntime → LLMClient） | standards/testing/integration.md |
| Task-06 | DiscussionOrchestrator | integration | integration | 是（Orchestrator → Scheduler → ContextBuilder → AgentRuntime） | standards/testing/integration.md |
| Task-07 | MessageRepository + Mock | none | — | 否 | — |
| Task-08 | AgentCallLogRepository + Mock | none | — | 否 | — |
| Task-09 | instances.ts 共享实例 | none | — | 否 | — |
| Task-10 | DiscussionService.getSessionDetail | integration | integration | 是（Service → SessionRepo → TemplateRepo → MessageRepo） | standards/testing/integration.md |
| Task-11 | DiscussionService.getMessages | integration | integration | 是（Service → MessageRepo） | standards/testing/integration.md |
| Task-12 | DiscussionService.sendUserMessage | integration | integration | 是（Service → Orchestrator → Scheduler → AgentRuntime → Repos） | standards/testing/integration.md |
| Task-13 | GET /api/sessions/:sessionId | web-e2e | web-e2e | 是（Route → Service → Repos） | standards/testing/web-e2e.md |
| Task-14 | GET /api/discussions/:sessionId/messages | web-e2e | web-e2e | 是（Route → Service → MessageRepo） | standards/testing/web-e2e.md |
| Task-15 | POST /api/discussions/:sessionId/messages | web-e2e | web-e2e | 是（Route → Service → Orchestrator → MockLLM） | standards/testing/web-e2e.md |
| Task-16 | RoleBar + MessageList + MessageInput UI 组件 | none | — | 否 | — |
| Task-17 | DiscussionModule 前后端联动 | web-e2e | web-e2e | 是（UI → API → Engine → MockLLM） | standards/testing/web-e2e.md |

**项目 web-api feature 要求**：Task-13/14/15/17 均声明 `web-e2e` 类型测试。

---

## Change Log

| 文件 | 变更类型 | 原因 |
|---|---|---|
| `src/types/index.ts` | 修改 | 新增 AgentType、DiscussionMessage、AgentCallLog；Role 增加 agentType；AgentProfile 扩展；Scheduler 相关接口 |
| `src/types/api.ts` | 修改 | 新增 SessionDetailResult、MessageListResult、SendMessageParams、SendMessageResult |
| `src/data/templates/three-kingdoms.ts` | 修改 | 每个 role 补充 agentType（host/expert/critic） |
| `src/engine/context-builder.ts` | 新增 | ContextBuilder 实现 |
| `src/engine/agent-runtime.ts` | 新增 | DefaultAgentRuntime 实现 |
| `src/engine/orchestrator.ts` | 修改 | DiscussionOrchestrator 实现（替换空 stub） |
| `src/engine/scheduler.ts` | 修改 | RoundRobinScheduler + selectSpeakers 接口（替换空 stub） |
| `src/llm/mock-llm-client.ts` | 新增 | MockLLMClient 实现 |
| `src/server/repositories/message.repository.ts` | 新增 | MessageRepository 接口 |
| `src/server/repositories/agent-call-log.repository.ts` | 新增 | AgentCallLogRepository 接口 |
| `src/server/repositories/mock/mock-message.repository.ts` | 新增 | MockMessageRepository 实现 |
| `src/server/repositories/mock/mock-agent-call-log.repository.ts` | 新增 | MockAgentCallLogRepository 实现 |
| `src/server/repositories/mock/instances.ts` | 修改 | 新增 sharedMessageRepo、sharedAgentCallLogRepo |
| `src/server/services/discussion.service.ts` | 修改 | 新增 getSessionDetail、getMessages、sendUserMessage |
| `src/app/api/sessions/[sessionId]/route.ts` | 新增 | GET /api/sessions/:sessionId |
| `src/app/api/discussions/[sessionId]/messages/route.ts` | 新增 | GET/POST /api/discussions/:sessionId/messages |
| `src/modules/discussion/role-bar.tsx` | 新增 | RoleBar 组件 |
| `src/modules/discussion/message-list.tsx` | 新增 | MessageList + MessageBubble 组件 |
| `src/modules/discussion/message-input.tsx` | 新增 | MessageInput 组件 |
| `src/modules/discussion/index.tsx` | 修改 | 接入子组件，完成前后端联动 |

---

## Development Tasks

- Task-01：定义多 Agent 讨论核心类型
  - 所属模块：types
  - 简要描述：在 src/types/index.ts 新增 AgentType、DiscussionMessage、AgentCallLog、SpeakerSelectionInput、SpeakerSelectionResult、OrchestratorInput、OrchestratorResult、ContextBuilderInput；扩展 Role（agentType）、AgentProfile（agentId/agentType/name/persona/visible）；在 src/types/api.ts 新增 SessionDetailResult、MessageListResult、SendMessageParams、SendMessageResult
  - 涉及接口/方法：类型声明
  - 输入：PRD 中的数据结构契约
  - 输出：编译可用的类型导出
  - 产出类型：none
  - 功能类型：类型定义（type id: none）
  - 是否跨组件：否

- Task-02：实现 MockLLMClient
  - 所属模块：llm
  - 简要描述：新建 src/llm/mock-llm-client.ts，实现 LLMProvider 接口；对 host 角色返回开场/主持风格文本；对 expert 角色返回策略分析风格文本；对 critic 角色返回质疑/风险风格文本；config.model === 'mock-fail' 时抛出错误
  - 涉及接口/方法：LLMProvider.chat()
  - 输入：LLMMessage[]（含 systemPrompt）, LLMConfig
  - 输出：string（稳定可预测的文本）
  - 产出类型：library
  - 功能类型：LLM 模拟客户端（type id: library）
  - 是否跨组件：否

- Task-03：实现 ContextBuilder
  - 所属模块：engine
  - 简要描述：新建 src/engine/context-builder.ts；build(input) 拼装 [system: systemPrompt+topic+templateName] + [最近 N 条历史消息]；默认 maxMessages=20、maxChars=4000；超出时截断最旧消息
  - 涉及接口/方法：ContextBuilder.build(input: ContextBuilderInput): LLMMessage[]
  - 输入：ContextBuilderInput（topic, templateName, role.systemPrompt, messageHistory, maxMessages?, maxChars?）
  - 输出：LLMMessage[]（system + history messages）
  - 产出类型：library
  - 功能类型：上下文构造工具（type id: library）
  - 是否跨组件：否

- Task-04：实现 Scheduler（selectSpeakers 扩展接口 + 串行轮转策略）
  - 所属模块：engine
  - 简要描述：修改 src/engine/scheduler.ts；定义 Scheduler 接口（selectSpeakers）；实现 RoundRobinScheduler：空历史选 Host，否则轮转非 Host 角色跳过 lastSpeakerId，返回单个 speakerId
  - 涉及接口/方法：Scheduler.selectSpeakers(input: SpeakerSelectionInput): SpeakerSelectionResult
  - 输入：SpeakerSelectionInput（roles, messageHistory, lastSpeakerId, roundIndex）
  - 输出：SpeakerSelectionResult（speakerIds: [string], reason: string）
  - 产出类型：library
  - 功能类型：角色调度器（type id: library）
  - 是否跨组件：否

- Task-05：实现 AgentRuntime（调用 LLMClient 生成角色输出）
  - 所属模块：engine
  - 简要描述：新建 src/engine/agent-runtime.ts；DefaultAgentRuntime 持有 LLMProvider；run(profile, contextMessages) 调用 provider.chat()，返回 AgentOutput；model 为 'mock-fail' 时传播错误
  - 涉及接口/方法：AgentRuntime.run(profile: AgentProfile, contextMessages: LLMMessage[]): Promise<AgentOutput>
  - 输入：AgentProfile, LLMMessage[]
  - 输出：AgentOutput（agentId, roleId, messageType, content, metadata）
  - 产出类型：integration
  - 功能类型：Agent 调用运行时（type id: integration）
  - 是否跨组件：是（组件链路：AgentRuntime → LLMProvider）

- Task-06：实现 DiscussionOrchestrator（替换旧 Orchestrator，协调 Host/Expert/Critic 串行发言）
  - 所属模块：engine
  - 简要描述：修改 src/engine/orchestrator.ts，完整替换现有 Orchestrator 接口和 DefaultOrchestrator；DiscussionOrchestrator 持有 Scheduler、ContextBuilder、AgentRuntime（无 Repository 依赖，Engine 层架构约束）；run(input) 调用 Scheduler.selectSpeakers → 对每个 speakerId 串行执行 ContextBuilder.build → AgentRuntime.run，构造 DiscussionMessage 和 AgentCallLogData；返回 { agentMessages, callLogs, activeSpeakerId }
  - 涉及接口/方法：DiscussionOrchestrator.run(input: OrchestratorInput): Promise<OrchestratorResult>
  - 输入：OrchestratorInput（sessionId, runId, topic, templateName, profiles, messageHistory, triggerContent）
  - 输出：OrchestratorResult（agentMessages: DiscussionMessage[], callLogs: AgentCallLogData[], activeSpeakerId: string | null）
  - 产出类型：integration
  - 功能类型：多 Agent 调度编排（type id: integration）
  - 是否跨组件：是（组件链路：Orchestrator → Scheduler → ContextBuilder → AgentRuntime）

- Task-07：实现 MessageRepository 接口和 MockMessageRepository
  - 所属模块：server/repositories
  - 简要描述：新建 message.repository.ts（接口）和 mock/mock-message.repository.ts（内存 Map 实现，按 sessionId 存储，支持 limit/before 分页）；分页游标基于消息创建时间排序
  - 涉及接口/方法：MessageRepository.findBySessionId(), save(), countBySessionId()
  - 输入：DiscussionMessage（save）；sessionId + opts（findBySessionId）
  - 输出：DiscussionMessage[]
  - 产出类型：library
  - 功能类型：消息仓储（type id: library）
  - 是否跨组件：否

- Task-08：实现 AgentCallLogRepository 接口和 MockAgentCallLogRepository
  - 所属模块：server/repositories
  - 简要描述：新建 agent-call-log.repository.ts（接口）和 mock/mock-agent-call-log.repository.ts（内存 Map 实现）
  - 涉及接口/方法：AgentCallLogRepository.save(), findBySessionId()
  - 输入：AgentCallLog（save）
  - 输出：AgentCallLog
  - 产出类型：library
  - 功能类型：Agent 调用日志仓储（type id: library）
  - 是否跨组件：否

- Task-09：扩展共享 mock 实例（instances.ts）
  - 所属模块：server/repositories/mock
  - 简要描述：修改 instances.ts，新增 sharedMessageRepo（MockMessageRepository）和 sharedAgentCallLogRepo（MockAgentCallLogRepository），使用与现有相同的 globalThis 单例模式
  - 涉及接口/方法：导出 sharedMessageRepo, sharedAgentCallLogRepo
  - 输入：无
  - 输出：全局共享 mock 实例
  - 产出类型：none
  - 功能类型：依赖注入配置（type id: none）
  - 是否跨组件：否

- Task-10：实现 DiscussionService.getSessionDetail()
  - 所属模块：server/services
  - 简要描述：修改 discussion.service.ts；getSessionDetail(sessionId) 查 SessionRepository.findById → 查 TemplateRepository.findById → 查 MessageRepository.countBySessionId（计算 activeSpeakerId）→ 返回 SessionDetailResult；Session 不存在抛 SESSION_NOT_FOUND；Template 不存在抛 TEMPLATE_NOT_FOUND
  - 涉及接口/方法：DiscussionService.getSessionDetail(sessionId: string): Promise<SessionDetailResult>
  - 输入：sessionId: string
  - 输出：SessionDetailResult（含 roles[], activeSpeakerId, template.name）
  - 产出类型：integration
  - 功能类型：会话详情查询（type id: integration）
  - 是否跨组件：是（组件链路：Service → SessionRepository → TemplateRepository → MessageRepository）

- Task-11：实现 DiscussionService.getMessages()
  - 所属模块：server/services
  - 简要描述：修改 discussion.service.ts；getMessages(sessionId, opts) 先验证 Session 存在，查 MessageRepository.findBySessionId，返回 MessageListResult（含 hasMore）；Session 不存在抛 SESSION_NOT_FOUND
  - 涉及接口/方法：DiscussionService.getMessages(sessionId: string, opts: { limit: number; before?: string }): Promise<MessageListResult>
  - 输入：sessionId, { limit: number, before?: string }
  - 输出：MessageListResult（messages[], activeSpeakerId, hasMore）
  - 产出类型：integration
  - 功能类型：消息列表查询（type id: integration）
  - 是否跨组件：是（组件链路：Service → SessionRepository → MessageRepository）

- Task-12：实现 DiscussionService.sendUserMessage()（含 Orchestrator 调用和日志持久化）
  - 所属模块：server/services
  - 简要描述：修改 discussion.service.ts；sendUserMessage(sessionId, content, clientMessageId?) 按流程：验证 Session/Template → 构建 AgentProfiles → 保存用户消息（content 非空时）→ 调用 DiscussionOrchestrator.run → 保存 result.agentMessages → 保存 result.callLogs → 返回 SendMessageResult；各种错误码按 API Design 中的定义抛出
  - 涉及接口/方法：DiscussionService.sendUserMessage(sessionId, content, clientMessageId?): Promise<SendMessageResult>
  - 输入：sessionId, content, clientMessageId?
  - 输出：SendMessageResult（userMessage?, agentMessages[], activeSpeakerId, runId）
  - 产出类型：integration
  - 功能类型：用户消息处理与 Agent 编排（type id: integration）
  - 是否跨组件：是（组件链路：Service → SessionRepo → TemplateRepo → MessageRepo → DiscussionOrchestrator → Scheduler → ContextBuilder → AgentRuntime → AgentCallLogRepo）

- Task-13：实现 GET /api/sessions/:sessionId API 路由
  - 所属模块：app/api/sessions
  - 简要描述：新建 src/app/api/sessions/[sessionId]/route.ts；注入 DiscussionService；GET handler 调用 getSessionDetail；SESSION_NOT_FOUND → 404；其他错误 → 500；遵循 ApiResponse 格式
  - 涉及接口/方法：GET /api/sessions/:sessionId
  - 输入：URL param sessionId
  - 输出：ApiResponse<SessionDetailResult>（200/404/500）
  - 产出类型：web-e2e
  - 功能类型：会话详情 HTTP 接口（type id: web-e2e）
  - 是否跨组件：是（组件链路：Route → DiscussionService → SessionRepo → TemplateRepo）

- Task-14：实现 GET /api/discussions/:sessionId/messages API 路由
  - 所属模块：app/api/discussions
  - 简要描述：新建 src/app/api/discussions/[sessionId]/messages/route.ts；GET handler 解析 limit/before query params，调用 getMessages；SESSION_NOT_FOUND → 404；遵循 ApiResponse 格式
  - 涉及接口/方法：GET /api/discussions/:sessionId/messages
  - 输入：URL param sessionId, query params limit/before
  - 输出：ApiResponse<MessageListResult>（200/404/500）
  - 产出类型：web-e2e
  - 功能类型：消息列表 HTTP 接口（type id: web-e2e）
  - 是否跨组件：是（组件链路：Route → DiscussionService → MessageRepo）

- Task-15：实现 POST /api/discussions/:sessionId/messages API 路由
  - 所属模块：app/api/discussions
  - 简要描述：在 src/app/api/discussions/[sessionId]/messages/route.ts 增加 POST handler；解析请求体；调用 sendUserMessage；按错误码映射 HTTP 状态码（SESSION_NOT_FOUND/TEMPLATE_NOT_FOUND → 404，MESSAGE_EMPTY → 400，LLM_PROVIDER_ERROR → 502，其余 → 500）
  - 涉及接口/方法：POST /api/discussions/:sessionId/messages
  - 输入：URL param sessionId, body { content, clientMessageId? }
  - 输出：ApiResponse<SendMessageResult>（200/400/404/500/502）
  - 产出类型：web-e2e
  - 功能类型：用户发消息 HTTP 接口（type id: web-e2e）
  - 是否跨组件：是（组件链路：Route → DiscussionService → Orchestrator → MockLLMClient）

- Task-16：实现讨论页 RoleBar / MessageList / MessageInput UI 组件
  - 所属模块：modules/discussion
  - 简要描述：新建 role-bar.tsx（横向角色头像列表，activeSpeakerId 高亮）、message-list.tsx（消息气泡列表，host/character 左，user 右，loading 时末尾 Typing 动画，错误消息+重试按钮）、message-input.tsx（输入框+发送按钮，发送中禁用）
  - 涉及接口/方法：组件 Props 接口
  - 输入：roles, messages, loading, error, onSend 等 Props
  - 输出：React 组件（无副作用 UI）
  - 产出类型：none
  - 功能类型：前端 UI 组件（type id: none）
  - 是否跨组件：否

- Task-17：实现 DiscussionModule 前后端联动
  - 所属模块：modules/discussion
  - 简要描述：修改 src/modules/discussion/index.tsx；挂载时并发调用 GET session detail + GET messages；消息为空时自动 POST 空 content 触发 Host 开场；发送消息时调用 POST messages；管理 loading/error/messages state；组合三个子组件
  - 涉及接口/方法：DiscussionModule 组件，调用 /api/sessions/:id 和 /api/discussions/:id/messages
  - 输入：sessionId prop
  - 输出：完整前端讨论页（含角色栏、消息流、输入区）
  - 产出类型：web-e2e
  - 功能类型：前端讨论页联动（type id: web-e2e）
  - 是否跨组件：是（组件链路：DiscussionModule → API Routes → DiscussionService → Orchestrator → MockLLMClient）
