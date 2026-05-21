# 迭代 5：用户介入与快捷指令系统技术设计

## 1. 概述

本次设计在现有 `/discussion/[sessionId]` 会话详情页、`DiscussionService`、`DiscussionOrchestrator` 与 `RoundRobinScheduler` 基础上扩展用户介入链路。核心方案是新增独立的 Intent 识别契约与 API：前端仍通过会话详情页提交用户输入，后端先把输入识别为结构化 `IntentResult`，再把 `schedulerHint` 传入调度器，由调度器决定下一位角色或主持人。

设计约束：

- 用户介入必须绑定当前 `sessionId`，不得存在无会话上下文的讨论入口。
- Composer 与快捷指令必须等 `loadSession()` 和 `loadMessages()` 都成功、且 session status 为 `running` 后才可操作；`completed`、`archived` 或加载失败时禁用输入并展示恢复/不可操作提示。
- Intent 分类、规则兜底、调度消费与消息元数据必须独立于 React UI，可单独测试。
- 本迭代只识别投票/结束/总结意图和基础调度，不创建真实投票卡，不完成 Director 终局收束。
- Mock/规则分类是默认自动化路径；LLM 分类仅保留接口形态，不在本迭代引入真实 Provider 配置。
- API、服务、仓储和 UI 继续使用现有 TypeScript strict、Next.js App Router、统一 `ApiResponse<T>` 响应格式。

## 2. Impact Analysis

| 模块 | 影响程度 | 说明 |
|---|---:|---|
| `src/types/index.ts` | 修改 | 扩展 Intent、CommandTarget、SchedulerHint、消息 metadata 与 Orchestrator/Scheduler 输入类型。 |
| `src/types/api.ts` | 修改 | 新增 Intent API 请求/响应 DTO。 |
| `src/engine/intent.ts` | 修改 | 从占位识别器扩展为可测试的 IntentClassifier 接口、Mock 分类器、规则兜底分类器与组合入口。 |
| `src/engine/scheduler.ts` | 修改 | `SpeakerSelectionInput` 消费可选 `schedulerHint`，优先点名角色/主持人；保留现有轮转兜底。 |
| `src/engine/orchestrator.ts` | 修改 | `OrchestratorInput` 透传 intent/schedulerHint 到 Scheduler。 |
| `src/server/services/discussion.service.ts` | 修改 | 新增 `recognizeIntent()`，并在发送用户消息链路保存 intent metadata、传递 schedulerHint。 |
| `src/app/api/discussions/[sessionId]/intent/route.ts` | 新增 | 新增 `POST /api/discussions/:sessionId/intent`。 |
| `src/app/api/discussions/[sessionId]/messages/route.ts` | 修改 | 消息发送请求支持可选已识别 intent，保持旧请求兼容。 |
| `src/store/discussion.store.ts` | 修改 | 增加 intent 解析状态、错误选择、快捷填入与按普通发言继续动作。 |
| `src/modules/discussion/index.tsx` | 修改 | 将快捷指令、Composer、消息流错误操作接入 store。 |
| `src/modules/discussion/message-input.tsx` | 修改 | 支持工具栏快捷填入、空输入提示、解析 loading 展示。 |
| `src/modules/discussion/more-sheet.tsx` | 修改 | 快捷指令 Sheet 点击后填入 Composer，而非展示后续迭代弹窗。 |
| `src/modules/discussion/message-bubble.tsx` | 修改 | 指令型 user message 展示“指令”类视觉标记。 |
| `src/modules/discussion/message-list.tsx` | 修改 | 不可识别指令错误展示“改写指令 / 按普通发言继续”。 |
| `src/modules/discussion/role-bar.tsx` | 修改 | 继续使用 activeSpeakerId 高亮被 schedulerHint 选中的目标角色，并补充验收覆盖。 |

### 接口兼容性

- 新增 `POST /api/discussions/:sessionId/intent`，不改变已有 API 路径。
- `POST /api/discussions/:sessionId/messages` 保持 `content` 与 `clientMessageId` 兼容；新增可选 `intentResponse` 字段供前端复用已识别结果，服务层必须校验 `intentResponse.sessionId === sessionId`、`intentResponse.clientMessageId === clientMessageId` 且 `intentResponse.intent.rawText === content`。校验失败返回 `SESSION_CONTEXT_MISMATCH`。
- 旧调用方不传 `intentResponse` 时，`sendUserMessage()` 内部走同一个 `recognizeIntent()` 入口，避免双路径语义漂移。
- `Scheduler.selectSpeakers()` 的输入新增可选 `schedulerHint`，现有调用未传入时继续按轮转策略运行。

### 数据兼容性

- 不新增数据库表，不改 IndexedDB/Mock Repository 的存储结构。
- `DiscussionMessage.metadata` 仅新增可选字段：`intent`、`intentLabel`、`replyToClientMessageId` 保持兼容。
- Session 的 `state.lastSpeakerId` 语义不变，仍作为当前 active speaker 来源。

## 3. Flow Design

### 3.1 普通输入 / 指令输入主链路

1. 用户进入 `/discussion/[sessionId]`。
2. `DiscussionModule` 调用 `loadSession(sessionId)` 与 `loadMessages(sessionId)` 恢复会话上下文。
3. 在 session 恢复完成前，Composer、@/#/总结按钮和 `MoreSheet` 均禁用并展示加载状态；session 不存在时展示“会话不存在”；session 为 `completed` 或 `archived` 时展示“当前会话不可继续操作或需要恢复”，不允许发送用户介入。
4. 用户在 `MessageInput` 输入文本，或通过工具栏 / `MoreSheet` 填入快捷指令。
5. `discussion.store.sendMessage()` 生成 `clientMessageId`，先调用 `POST /api/discussions/:sessionId/intent`，进入“正在识别意图”状态。
6. `DiscussionService.recognizeIntent()` 校验 session、可操作状态、content、template roles 与总结上下文，调用 `IntentClassifier.classify()`。
7. Intent API 返回 `IntentResponse`，包含 `sessionId`、`clientMessageId`、`intent`、`activeSpeakerId`，其中 `intent` 包含 `type`、`target`、`schedulerHint`、`execution` 与可选 `debugSummary`。
8. 前端追加 pending user message，并调用 `POST /api/discussions/:sessionId/messages`，携带 `content`、`clientMessageId` 与已识别 `intentResponse`。
9. `DiscussionService.sendUserMessage()` 校验 `intentResponse` 绑定当前 session 和 clientMessageId，保存 user message，写入 `metadata.intent` 与 `metadata.intentLabel`。
10. `DiscussionOrchestrator.run()` 接收 `intent` 与 `schedulerHint`，调用 `RoundRobinScheduler.selectSpeakers()`。
11. Scheduler 优先选择 `schedulerHint.preferredSpeakerId`；总结/投票/结束指令选择 host；无 hint 时使用既有轮转策略。
12. Agent 回复保存后，API 返回 `agentMessages` 与 `activeSpeakerId`；前端更新消息流和角色高亮。

### 3.2 不可识别或失败流程

- 空内容：Intent API 返回 `MESSAGE_EMPTY`，前端保持 Composer 内容并提示“请输入内容”。
- session 不可操作：Intent API 返回 `SESSION_NOT_OPERABLE`，前端禁用 Composer 与快捷指令并提示“当前会话不可继续操作或需要恢复”。
- session 上下文不一致：Message API 返回 `SESSION_CONTEXT_MISMATCH`，前端不得更新消息流或 active speaker。
- 总结上下文不足：当当前会话少于 2 条非 system 消息时，总结类指令返回 `INSUFFICIENT_CONTEXT`，前端提示“当前信息不足，请先继续讨论”。
- debug 模式：store 保留最近一次 `debugSummary`，讨论页在调试模式开启时展示 classifierMode、matchedRule、confidence、target、schedulerHint 摘要。
- 角色不存在：返回 `ROLE_NOT_FOUND`，前端提示“当前模板无该角色”。
- 目标歧义：返回 `AMBIGUOUS_TARGET`，前端提示用户明确角色。
- 看起来像指令但无法识别：返回 `INTENT_CLASSIFICATION_FAILED`，前端展示“改写指令”和“按普通发言继续”。只有用户选择“按普通发言继续”后，才以 forced interrupt 重新发送。
- LLM 分类失败：`DefaultIntentClassifier` 捕获后转规则兜底；规则仍无法解释时按上面的失败流程返回。

### 3.3 投票 / 总结 / 结束边界

- “总结当前结论”：当当前会话至少有 2 条非 system 消息时返回 `type=decide`，`target.action=summarize`，`schedulerHint.preferredAgentType=host`，Scheduler 调度主持人；否则返回 `INSUFFICIENT_CONTEXT` 和“当前信息不足，请先继续讨论”。
- “触发投票”：`type=command`，`target.eventType=vote`，`execution.status=deferred`，保存精确 system message：`已识别投票意图；本迭代暂不创建真实投票卡，将由主持人先回应并继续讨论。`，不创建投票卡、投票接口、票数状态或 EventRecord。
- “结束讨论”：`type=decide`，`target.action=end`，`execution.status=recorded` 或 `deferred`，不把 session 标记为 completed。

## 4. Table Design

本迭代不新增或修改数据库表。当前 MVP 使用 Mock Repository / IndexedDB 风格本地持久化，新增字段均挂载在 `DiscussionMessage.metadata` 的可选属性上。

| 数据结构 | 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|---|
| `DiscussionMessage.metadata` | `intent` | `IntentResult` | 可选 | 保存用户消息对应的结构化识别结果。 |
| `DiscussionMessage.metadata` | `intentLabel` | `string` | 可选 | UI 展示“指令”等标签。 |
| `DiscussionMessage.metadata` | `replyToClientMessageId` | `string` | 可选 | 保留既有 agent 回复关联字段。 |

## 5. API Design

### 5.1 `POST /api/discussions/:sessionId/intent`

请求：

```ts
interface IntentRequest {
  content: string
  clientMessageId?: string
  debug?: boolean
  forceAsPlainMessage?: boolean
}
```

成功响应：

```ts
ApiResponse<IntentResponse>

interface IntentResponse {
  sessionId: string
  clientMessageId?: string
  intent: IntentResult
  activeSpeakerId: string | null
}
```

错误码：

| Code | HTTP | 场景 |
|---|---:|---|
| `SESSION_NOT_FOUND` | 404 | sessionId 不存在。 |
| `SESSION_NOT_OPERABLE` | 409 | session 尚未恢复完成，或状态为 completed/archived，不允许继续介入。 |
| `SESSION_CONTEXT_MISMATCH` | 409 | Message API 收到的 intentResponse 不属于当前 session/clientMessageId/content。 |
| `INSUFFICIENT_CONTEXT` | 400 | 总结类指令在当前会话少于 2 条非 system 消息时触发。 |
| `MESSAGE_EMPTY` | 400 | content 为空或仅空白字符。 |
| `ROLE_NOT_FOUND` | 400 | command/decide 指向不存在角色。 |
| `AMBIGUOUS_TARGET` | 400 | 多个角色或动作可匹配，无法确定目标。 |
| `UNSUPPORTED_COMMAND` | 400 | 指令超出本迭代能力边界。 |
| `INTENT_CLASSIFICATION_FAILED` | 422 | 看起来像指令但无法解释，要求用户改写或显式按普通发言继续。 |
| `INTERNAL_ERROR` | 500 | 未预期异常。 |

正确性规则：

- `data.sessionId` 必须等于路径 sessionId。
- `data.clientMessageId` 必须回显请求值。
- `intent.rawText` 必须等于用户原文。
- `debug=true` 时仅返回 classifierMode、matchedRule、confidence、type、target、schedulerHint 摘要，不返回 Prompt、API Key、Provider 请求体或敏感日志。

### 5.2 `POST /api/discussions/:sessionId/messages`

现有请求扩展：

```ts
interface SendMessageParams {
  content: string
  clientMessageId?: string
  intentResponse?: IntentResponse
}
```

兼容性：不传 `intentResponse` 时，服务层必须调用同一个 `recognizeIntent()` 完成识别；传入 `intentResponse` 时服务层校验 `sessionId`、`clientMessageId` 与 `content/rawText` 一致，不一致返回 `SESSION_CONTEXT_MISMATCH`。

新增错误码：沿用 Intent API 的 `ROLE_NOT_FOUND`、`AMBIGUOUS_TARGET`、`UNSUPPORTED_COMMAND`、`INTENT_CLASSIFICATION_FAILED`，以及既有 `SESSION_NOT_FOUND`、`MESSAGE_EMPTY`、`AGENT_GENERATION_FAILED`、`NO_AVAILABLE_AGENT`、`LLM_PROVIDER_ERROR`。

## 6. Module Design

### 6.1 Domain Types (`src/types/index.ts`)

```ts
type IntentType = 'interrupt' | 'command' | 'decide' | 'passive'
type CommandAction = 'reply' | 'rebut' | 'summarize' | 'vote' | 'end'
type IntentExecutionStatus = 'immediate' | 'deferred' | 'recorded' | 'unsupported'

interface CommandTarget {
  roleId?: string
  action?: CommandAction
  eventType?: EventType
  referenceRoleId?: string
}

interface SchedulerHint {
  preferredSpeakerId?: string
  preferredAgentType?: AgentType
  reason: string
}

interface IntentResult {
  type: IntentType
  confidence: number
  rawText: string
  target?: CommandTarget
  schedulerHint?: SchedulerHint
  execution: { status: IntentExecutionStatus; message?: string }
  debugSummary?: IntentDebugSummary
}

interface IntentResponse {
  sessionId: string
  clientMessageId?: string
  intent: IntentResult
  activeSpeakerId: string | null
}
```

### 6.2 Intent Engine (`src/engine/intent.ts`)

职责：

- `IntentClassifier.classify(input)`：根据用户文本、角色列表、session 上下文返回 `IntentResult`。
- `MockIntentClassifier`：自动化测试默认使用的稳定分类器。
- `RuleBasedIntentClassifier`：LLM 失败或默认路径的规则兜底。
- `DefaultIntentRecognizer`：保留旧接口兼容，内部委托 `DefaultIntentClassifier`。

接口：

```ts
interface IntentClassifierInput {
  sessionId: string
  content: string
  roles: AgentProfile[]
  messages: DiscussionMessage[]
  debug?: boolean
  forceAsPlainMessage?: boolean
}

interface IntentClassifier {
  classify(input: IntentClassifierInput): Promise<IntentResult>
}
```

异常：抛出带明确 code 的 `IntentClassificationError`，由 Service 映射为 `ServiceError`。

### 6.3 Scheduler (`src/engine/scheduler.ts`)

职责：

- 如果 `schedulerHint.preferredSpeakerId` 存在且属于当前 roles，优先返回该角色。
- 如果 `schedulerHint.preferredAgentType === 'host'`，优先返回 host。
- 如果 hint 无效，返回空选择或错误原因，由 Service/API 转为可解释错误；不盲目调度不存在角色。
- 无 hint 时保持现有 Round Robin 行为。

### 6.4 Orchestrator (`src/engine/orchestrator.ts`)

职责：

- 接收 `OrchestratorInput.intent` 与 `OrchestratorInput.schedulerHint`。
- 调用 Scheduler 时透传 hint，不由 UI 或 Service 直接指定 speaker。
- Agent message 生成逻辑保持不变。

### 6.5 Discussion Service (`src/server/services/discussion.service.ts`)

新增 `recognizeIntent(sessionId, params)`：

1. 读取 session，不存在抛 `SESSION_NOT_FOUND`。
2. 校验 session status；仅 `running` 可继续，`completed`、`archived` 抛 `SESSION_NOT_OPERABLE`。
3. 校验 content，空内容抛 `MESSAGE_EMPTY`。
4. 读取 template roles 与消息历史。
5. 调用 classifier。
6. 对 `target.action === 'summarize'` 校验至少 2 条非 system 消息，否则抛 `INSUFFICIENT_CONTEXT`。
7. 校验 schedulerHint 指向角色属于当前 template。
8. 返回 `IntentResponse`。

修改 `sendUserMessage()`：

- 接收可选 intentResponse。
- 传入 intentResponse 时仍必须重新读取 session 并校验当前 status 为 `running`，避免识别后会话状态变化仍写入消息。
- 保存 user message metadata。
- 投票 intent 追加轻量 system message。
- 调用 orchestrator 时透传 intent/schedulerHint。

### 6.6 UI / Store

- `MessageInput`：显示 @、#、总结按钮；点击只填入输入框，不自动发送；空输入展示“请输入内容”。
- `MoreSheet`：展示常用快捷指令，点击后关闭并填入 Composer。
- `discussion.store`：新增 `recognizingIntentBySessionId`、`pendingCommandBySessionId`、`intentErrorBySessionId`、`debugSummaryBySessionId`；`sendMessage()` 先识别 intent 再发送消息；`continueAsPlainMessage()` 以 `forceAsPlainMessage=true` 重走识别。
- `DiscussionModule`：根据 session 加载状态与 status 计算 `canIntervene`，未恢复、completed、archived 时禁用 Composer 与快捷指令。
- `MessageList`：对 `INTENT_CLASSIFICATION_FAILED` 展示“改写指令”和“按普通发言继续”。
- `MessageBubble`：当 `msg.metadata.intent` 为 command/decide 或 `intentLabel` 存在时，展示指令标签。

## 7. Output Contract

| 产物 | 输入 | 输出 | 产出类型 | 正确性规则 | 测试规范 |
|---|---|---|---|---|---|
| Intent API | `sessionId + IntentRequest` | `ApiResponse<IntentResponse>` | `web-e2e` | HTTP round-trip 覆盖成功、验证失败、领域失败；响应 schema 与错误码符合 `api-spec.md`。 | `standards/testing/web-e2e.md` |
| Session operability gate | `SessionDetailResult.status + load state` | `canIntervene` 与不可操作提示 | `web-e2e` | 未恢复、completed、archived 会话禁用 Composer 与快捷指令。 | `standards/testing/web-e2e.md` |
| Debug summary UI | `IntentResult.debugSummary` | 调试摘要展示 | `web-e2e` | 只展示摘要字段，不展示 Prompt/API Key/Provider 请求体。 | `standards/testing/web-e2e.md` |
| IntentClassifier | `IntentClassifierInput` | `IntentResult` 或 `IntentClassificationError` | `library` | 点名、反驳、总结、投票、结束、普通观点、不可识别输入稳定映射。 | 单元测试 + `standards/testing/integration.md` |
| Scheduler hint consumption | `SpeakerSelectionInput.schedulerHint` | `SpeakerSelectionResult` | `integration` | preferredSpeakerId / host hint 跨 Intent -> Orchestrator -> Scheduler 保持一致。 | `standards/testing/integration.md` |
| Message metadata | `content + clientMessageId + intent` | `DiscussionMessage.metadata.intent` | `integration` | user message 入流且指令型消息带 metadata 与标签；跨 session 不串扰。 | `standards/testing/integration.md` |
| Discussion UI command flow | 用户点击快捷按钮 / Sheet / 发送 | Composer 填入、Loading、错误操作、角色高亮 | `web-e2e` | 快捷填入不自动发送；发送后目标角色高亮；不可识别提示有两个显式操作。 | `standards/testing/web-e2e.md` |

项目 `workflow.yaml` 声明 `features: [web-api]`，且本次新增 HTTP endpoint，因此必须执行 `standards/testing/web-e2e.md`。本次不涉及 SQL/query generator，无 SQL Contract。

### 类型化测试要求

- `web-e2e`：`POST /api/discussions/:sessionId/intent` 真实 HTTP 请求，至少覆盖成功、validation failure、domain failure。
- `integration`：`IntentClassifier -> DiscussionService -> DiscussionOrchestrator -> RoundRobinScheduler` 组件链，覆盖 schedulerHint 传递、sessionId 绑定、错误映射。
- `web-e2e`：前端会话页从恢复 session 到快捷指令发送和角色高亮的浏览器链路。

## 8. Change Log

| 文件 | 类型 | 原因 |
|---|---|---|
| `src/types/index.ts` | 修改 | 新增 Intent、CommandTarget、SchedulerHint、DebugSummary，并扩展消息 metadata 与调度输入。 |
| `src/types/api.ts` | 修改 | 新增 IntentRequest、IntentResponse，并扩展 SendMessageParams。 |
| `src/engine/intent.ts` | 修改 | 建立 IntentClassifier、Mock/RuleBased 分类器和错误类型骨架。 |
| `src/engine/scheduler.ts` | 修改 | Scheduler 消费 schedulerHint 的公共接口。 |
| `src/engine/orchestrator.ts` | 修改 | Orchestrator 透传 schedulerHint 的公共接口。 |
| `src/server/services/discussion.service.ts` | 修改 | 新增 recognizeIntent 服务入口，并扩展发送链路参数。 |
| `src/app/api/discussions/[sessionId]/intent/route.ts` | 新增 | 实现 Intent API 路由骨架。 |
| `src/app/api/discussions/[sessionId]/messages/route.ts` | 修改 | 请求 DTO 接收可选 intent。 |
| `src/store/discussion.store.ts` | 修改 | 增加 intent 解析状态与普通发言继续动作。 |
| `src/modules/discussion/index.tsx` | 修改 | 串接快捷指令填入和 intent 错误操作。 |
| `src/modules/discussion/message-input.tsx` | 修改 | Composer 工具栏、快捷填入、空输入提示与解析 loading。 |
| `src/modules/discussion/more-sheet.tsx` | 修改 | 快捷指令 Sheet 填入 Composer。 |
| `src/modules/discussion/message-bubble.tsx` | 修改 | 指令型消息视觉标签。 |
| `src/modules/discussion/message-list.tsx` | 修改 | 不可识别指令提示与两个显式操作。 |
| `src/modules/discussion/role-bar.tsx` | 修改 | 使用 activeSpeakerId 高亮被 schedulerHint 选中的目标角色。 |

## 9. Development Tasks

- Task-01：定义用户意图领域类型与 API DTO
  - 所属模块：types
  - 简要描述：新增 IntentResult、CommandTarget、SchedulerHint、IntentRequest、IntentResponse，并扩展 SendMessageParams 与 DiscussionMessage.metadata。
  - 涉及接口/方法：IntentResult, IntentRequest, IntentResponse, SendMessageParams
  - 输入：用户输入文本、sessionId、clientMessageId、debug 标记
  - 输出：可被 API、服务、调度器和 UI 共享的类型契约
  - 产出类型：library
  - 功能类型：领域与 API 类型契约（type id: library）
  - 是否跨组件：否
- Task-02：实现 IntentClassifier 接口与 Mock/规则分类骨架
  - 所属模块：engine/intent
  - 简要描述：提供可测试的 IntentClassifier、MockIntentClassifier、RuleBasedIntentClassifier、IntentClassificationError 与默认分类入口。
  - 涉及接口/方法：IntentClassifier.classify(), MockIntentClassifier.classify(), RuleBasedIntentClassifier.classify()
  - 输入：IntentClassifierInput，包含 content、roles、messages、debug、forceAsPlainMessage
  - 输出：IntentResult 或带 code 的 IntentClassificationError
  - 产出类型：library
  - 功能类型：可复用分类库（type id: library）
  - 是否跨组件：否
- Task-03：实现 Intent API 服务与路由契约
  - 所属模块：server/api
  - 简要描述：新增 DiscussionService.recognizeIntent() 与 POST /api/discussions/:sessionId/intent，完成 session 校验、可操作状态校验、content 校验、角色上下文装配、总结上下文校验和错误码映射。
  - 涉及接口/方法：DiscussionService.recognizeIntent(), POST()
  - 输入：sessionId 与 IntentRequest
  - 输出：ApiResponse<IntentResponse>
  - 产出类型：web-e2e
  - 功能类型：Web/API endpoint（type id: web-e2e）
  - 是否跨组件：是（组件链路：Route Handler -> DiscussionService -> IntentClassifier -> Repository）
- Task-04：实现 schedulerHint 调度消费链路
  - 所属模块：engine/scheduler
  - 简要描述：扩展 OrchestratorInput 与 SpeakerSelectionInput，确保 IntentResult.schedulerHint 由服务层透传到 Scheduler 并影响下一位发言者。
  - 涉及接口/方法：DiscussionOrchestrator.run(), RoundRobinScheduler.selectSpeakers()
  - 输入：OrchestratorInput.intent 与 schedulerHint
  - 输出：SpeakerSelectionResult 与 activeSpeakerId
  - 产出类型：integration
  - 功能类型：跨组件调度链路（type id: integration）
  - 是否跨组件：是（组件链路：IntentClassifier -> DiscussionService -> DiscussionOrchestrator -> Scheduler）
- Task-05：实现用户消息 intent metadata 与投票边界反馈
  - 所属模块：server/services
  - 简要描述：发送用户消息时校验 intentResponse 绑定当前 session/clientMessageId/content，写入 metadata.intent 和 intentLabel；投票意图追加精确轻量 system message；结束意图不完成 session。
  - 涉及接口/方法：DiscussionService.sendUserMessage()
  - 输入：sessionId、content、clientMessageId、IntentResponse
  - 输出：SendMessageResult.userMessage、agentMessages、activeSpeakerId
  - 产出类型：integration
  - 功能类型：消息持久化与调度集成（type id: integration）
  - 是否跨组件：是（组件链路：DiscussionService -> MessageRepository -> DiscussionOrchestrator -> Scheduler）
- Task-06：实现讨论页会话恢复与可介入状态门禁
  - 所属模块：modules/discussion
  - 简要描述：DiscussionModule 根据 session 加载状态和 status 计算 canIntervene；未恢复、completed、archived、session 不存在时禁用 Composer 与快捷指令并展示对应提示。
  - 涉及接口/方法：DiscussionModule, MessageInput, MoreSheet
  - 输入：SessionDetailResult.status、loadSession/loadMessages 状态
  - 输出：canIntervene、不可操作提示、禁用态 UI
  - 产出类型：web-e2e
  - 功能类型：Web/UI 会话门禁（type id: web-e2e）
  - 是否跨组件：是（组件链路：DiscussionModule -> discussion.store -> Session API -> MessageInput -> MoreSheet）
- Task-07：实现讨论页 Composer 快捷指令填入
  - 所属模块：modules/discussion
  - 简要描述：MessageInput 增加 @、#、总结按钮和可控填入行为；MoreSheet 点击常用指令后填入输入框并聚焦。
  - 涉及接口/方法：MessageInput, MoreSheet, DiscussionModule
  - 输入：用户点击工具栏或 Sheet 指令
  - 输出：Composer 内容更新，不自动发送
  - 产出类型：web-e2e
  - 功能类型：Web/UI 交互（type id: web-e2e）
  - 是否跨组件：是（组件链路：DiscussionModule -> MessageInput -> MoreSheet -> discussion.store）
- Task-08：实现前端 intent 解析状态与不可识别提示
  - 所属模块：store/discussion
  - 简要描述：store 发送前调用 Intent API，展示解析 Loading；不可识别指令提供“改写指令”和“按普通发言继续”两个显式操作；debug 模式保存并展示 debugSummary。
  - 涉及接口/方法：discussion.store.sendMessage(), continueAsPlainMessage(), MessageList
  - 输入：用户文本、Intent API 错误或结果
  - 输出：解析状态、错误操作、debugSummary、消息发送请求
  - 产出类型：web-e2e
  - 功能类型：Web/API + UI 状态链路（type id: web-e2e）
  - 是否跨组件：是（组件链路：MessageInput -> discussion.store -> Intent API -> MessageList）
- Task-09：实现指令型消息展示与目标角色高亮
  - 所属模块：modules/discussion
  - 简要描述：MessageBubble 展示指令标签；RoleBar 继续根据 activeSpeakerId 高亮由 schedulerHint 选择的角色。
  - 涉及接口/方法：MessageBubble, RoleBar, discussionReducer
  - 输入：DiscussionMessage.metadata.intent 与 IntentResponse.activeSpeakerId
  - 输出：消息“指令”标签与角色栏高亮
  - 产出类型：web-e2e
  - 功能类型：Web/UI 展示链路（type id: web-e2e）
  - 是否跨组件：是（组件链路：Intent API -> discussion.store -> MessageBubble -> RoleBar）

