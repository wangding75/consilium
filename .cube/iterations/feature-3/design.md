# Design — 迭代 3：讨论页消息流与前后端联动

## 1. 概述

本次迭代在现有骨架的基础上补全讨论页完整交互体验：
- **后端**：扩展消息类型、补充 `clientMessageId` 去重逻辑、修复消息排序，整体遵循现有 Service → Repository → Mock 分层。
- **前端**：引入 `DiscussionStore`（React Context + useReducer）作为消息状态唯一同步入口，完整实现 Header / RoleBar / MessageList / MessageBubble / TypingIndicator / MessageInput / MoreSheet，替换现有占位骨架。

**核心约束**：
- UI 不直接调用 LLM / Orchestrator，不维护私有消息数组——所有操作经由 Store Action。
- 最小改动原则：API Route 层逻辑不变，只补充错误码；Service 层只增补 `clientMessageId` 去重和排序；Repository 接口增两个方法。
- 所有新增文件遵循现有 `'use client'`、Tailwind 分层、命名风格。

---

## 2. Impact Analysis

| 层 | 文件 | 变更类型 | 影响 |
|----|------|---------|------|
| Types | `src/types/index.ts` | 修改 | `DiscussionMessage.status` 增加 `pending`；增加可选字段 `clientMessageId`；agent 消息通过 `metadata.replyToClientMessageId` 关联用户消息 |
| Types | `src/types/api.ts` | 修改 | `SendMessageRequest` / `SendMessageResult` 增加 `clientMessageId` 回显字段；消息列表参数类型补充 `before` 游标语义 |
| Repository | `src/server/repositories/message.repository.ts` | 修改 | 增加 `findByClientMessageId`、`findRepliesByClientMessageId`、`updateStatus` 方法签名 |
| Repository | `src/server/repositories/mock/mock-message.repository.ts` | 修改 | 实现上述三个新方法；修复消息按 `createdAt` 升序排序；支持 `before` 游标过滤与 replyToClientMessageId 无分页关联查询 |
| Engine | `src/engine/agent-runtime.ts` | 修改 | 补齐 LLMConfig.provider 以满足骨架编译 |
| Service | `src/server/services/discussion.service.ts` | 修改 | `getMessages` 传递 `before`；`sendUserMessage` 实现 `clientMessageId` 去重、失败后重试再生成和排序 |
| API Route | `src/app/api/discussions/[sessionId]/messages/route.ts` | 修改 | GET 补齐 `limit` / `before` 校验；POST 透传 `clientMessageId`，重复 completed 请求走 200 幂等，重复 failed 请求重新生成 |
| Store | `src/store/discussion.store.ts` | 新增 | DiscussionStore（Context + useReducer）；类型 `DiscussionStoreState`；记录 typing speaker |
| UI Component | `src/modules/discussion/discussion-header.tsx` | 新增 | Header 组件 |
| UI Component | `src/modules/discussion/message-bubble.tsx` | 新增 | MessageBubble 组件 |
| UI Component | `src/modules/discussion/typing-indicator.tsx` | 新增 | TypingIndicator 组件 |
| UI Component | `src/modules/discussion/more-sheet.tsx` | 新增 | MoreSheet 组件 |
| UI Component | `src/modules/discussion/role-bar.tsx` | 修改 | 完整实现（替换占位骨架） |
| UI Component | `src/modules/discussion/message-list.tsx` | 修改 | 完整实现（替换占位骨架） |
| UI Component | `src/modules/discussion/message-input.tsx` | 修改 | 完整实现（替换占位骨架） |
| UI Component | `src/modules/discussion/index.tsx` | 修改 | 接入 DiscussionStore，完整实现 |
| Page | `src/app/discussion/[sessionId]/page.tsx` | 修改 | 修复 Next.js 15 params 异步类型 |

**兼容性**：
- `DiscussionMessage.status` 新增 `pending` 为可选状态，现有 `completed | streaming | failed` 仍有效，不破坏已有测试。
- `DiscussionMessage.metadata.replyToClientMessageId` 仅用于关联 agent 回复与用户消息，不改变现有必填字段。
- `MessageRepository` 新增两个方法，现有调用方不受影响；PRD 中的 `appendMessage` / `listMessages` / `updateMessageStatus` 分别映射到现有仓储命名 `save` / `findBySessionId` / `updateStatus`。
- API Route 响应结构新增可选字段 `clientMessageId`，完全向后兼容。
- `DUPLICATE_CLIENT_MESSAGE` 语义：PRD 将其列为错误码；设计统一为 200 幂等成功，不再返回 409。若历史请求已 completed，返回已有 userMessage + 已关联 agentMessages；若历史请求 failed，则复用原 userMessage 重新进入 Agent 生成链路。


---

## 3. Flow Design

### 3.1 用户发送消息（乐观更新）

```
用户点击发送（MessageInput）
  ↓
MessageInput 调用 Store.sendMessage(sessionId, content)
  ↓
Store Action：生成 clientMessageId = `client_${Date.now()}_${random}`
              从 activeSpeakerBySessionId[sessionId] 解析 typingSpeakerId / typingSpeakerName
              追加 optimistic userMessage { type:'user', status:'pending', clientMessageId }
              设置 typingBySessionId[sessionId] = true
              设置 typingSpeakerBySessionId[sessionId] = { roleId, name }
  ↓
调用 POST /api/discussions/:sessionId/messages { content, clientMessageId }
  ↓
[成功] API 返回 { userMessage, agentMessages, activeSpeakerId, clientMessageId }
    → Store：userMessage 替换 optimistic（按 clientMessageId 匹配） → status: completed
    → Store：追加 agentMessages
    → Store：更新 activeSpeakerBySessionId
    → Store：typingBySessionId = false
    → Store：typingSpeakerBySessionId = null
    → sendingByClientMessageId[clientMessageId] = 'completed'
  ↓
[失败] 
    → Store：optimistic userMessage status → 'failed'
    → Store：typingBySessionId = false
    → Store：typingSpeakerBySessionId = null
    → sendingByClientMessageId[clientMessageId] = 'failed'
    → errorBySessionId[sessionId] = ApiError
```

### 3.2 重试消息

```
用户点击重试（MessageBubble）
  ↓
Store.retryMessage(sessionId, clientMessageId)
  ↓
根据 clientMessageId 找到 failed user message → 重置 status:'pending'
根据 activeSpeakerBySessionId[sessionId] 解析 typingSpeakerId / typingSpeakerName
设置 typingBySessionId[sessionId] = true，typingSpeakerBySessionId[sessionId] = { roleId, name }
  ↓
重新调用 POST /messages { content, clientMessageId }（相同 clientMessageId）
  ↓
服务端检测到 clientMessageId 已存在：
  - 若历史 userMessage.status === 'completed' 且存在已关联 agentMessages → HTTP 200 幂等返回已有 userMessage + agentMessages
  - 若历史 userMessage.status === 'failed' 或无已关联 agentMessages → 将 userMessage 更新为 pending，重新进入 Orchestrator / Scheduler / AgentRuntime 生成链路
  ↓
生成成功：Store 按 clientMessageId 更新 userMessage status → completed；追加带 metadata.replyToClientMessageId 的 agentMessages；清除 typing
生成失败：Store 将 userMessage status → failed；清除 typing，保留重试入口
```

### 3.3 页面加载

```
DiscussionModule mount（useEffect）
  ↓
Store.loadSession(sessionId) → GET /api/sessions/:sessionId
  → sessions[sessionId]、activeSpeakerBySessionId[sessionId]
Store.loadMessages(sessionId) → GET /api/discussions/:sessionId/messages?limit=50
  → messagesBySessionId[sessionId]、activeSpeakerBySessionId[sessionId]
```

### 3.4 异常流程

| 场景 | 处理 |
|------|------|
| 会话不存在（SESSION_NOT_FOUND） | loadSession 捕获 → errorBySessionId；UI 展示"会话不存在"引导返回首页 |
| 空消息发送 | MessageInput 本地校验拦截，不调 API |
| clientMessageId 重复（幂等返回） | 已完成请求返回已有 userMessage + metadata.replyToClientMessageId 关联的 agentMessages（HTTP 200）；Store 按 clientMessageId 合并更新 |
| clientMessageId 重复（失败重试） | 历史 userMessage 为 failed 或缺少关联 agentMessages 时，服务端复用原 userMessage 重新生成；不追加第二条用户消息 |
| Agent 生成失败 | Store：userMessage 置为 `failed`；若 API 返回失败 agentMessage 则展示该系统提示；Typing 与 typingSpeaker 清除；展示重试入口 |
| Typing 超时（10s） | Store：setTimeout 10s 检查 sendingByClientMessageId[id] 仍为 pending → typingBySessionId = false，typingSpeakerBySessionId = null，userMessage → failed；成功/失败时 clearTimeout 取消超时，防止误触发 |

---

## 4. Table Design

无数据库变更。本迭代使用 in-memory `MockMessageRepository`，结构扩展如下：

```
MockMessageRepository 内部
  store: Map<messageId, DiscussionMessage>          // 主存储，按 messageId 索引
  clientIdIndex: Map<clientMessageId, messageId>    // 客户端消息 ID 反查索引
  // 消息中 clientMessageId 字段仅在 type='user' 时有值
```

**扩展后 DiscussionMessage 字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| messageId | string | 服务端稳定 ID |
| sessionId | string | 会话 ID |
| type | 'host' \| 'character' \| 'user' \| 'system' | 消息类型 |
| roleId? | string | 角色 ID（host/character 时有值） |
| agentType? | AgentType | agent 类型 |
| content | string | 消息内容 |
| status | 'pending' \| 'streaming' \| 'completed' \| 'failed' | **新增 pending** |
| clientMessageId? | string | **新增** 客户端消息 ID（user 消息回显） |
| createdAt | string | ISO 8601 |
| metadata? | object | 元数据 |

---

## 5. API Design

遵循 `api-spec.md` 统一响应格式：`{ success, data, error, requestId }`。

### 5.1 GET /api/sessions/:sessionId

无接口变更，响应格式已满足 PRD 要求。

**Path 参数：**
- `sessionId` 由 Next.js 动态路由提供；空字符串不会进入该 route。
- 未知或不存在的 `sessionId` 统一返回 `SESSION_NOT_FOUND`（404），不另设 `VALIDATION_ERROR`。

**Response `data`：**
```ts
{
  sessionId: string
  topic: string
  template: { templateId: string; name: string }
  status: 'active' | 'completed' | 'archived'
  roles: Array<{ roleId, name, agentType, avatar, model }>
  activeSpeakerId: string | null
  createdAt: string
  updatedAt: string
}
```

**错误码（HTTP 状态码映射）：**

| errorCode | HTTP | 场景 |
|-----------|------|------|
| `SESSION_NOT_FOUND` | 404 | 会话不存在 |
| `INTERNAL_ERROR` | 500 | 服务端未知错误 |

### 5.2 GET /api/discussions/:sessionId/messages

参数补充说明（代码已存在，Mock 需要实际支持）：

| 参数 | 说明 |
|------|------|
| `limit` | 默认 50，最大 100；`limit <= 0` 或非数字返回 `VALIDATION_ERROR`；`limit > 100` clamp 为 100 |
| `before` | 游标：**messageId**（取该 messageId 之前的消息，不使用 ISO timestamp，避免时间戳相同时的边界问题）；找不到游标时返回空 messages、`hasMore: false`，不报错 |

**Response `data`：**
```ts
{
  sessionId: string
  messages: DiscussionMessage[]   // 按 createdAt 升序
  activeSpeakerId: string | null
  hasMore: boolean
}
```

**错误码（HTTP 状态码映射）：**

| errorCode | HTTP | 场景 |
|-----------|------|------|
| `SESSION_NOT_FOUND` | 404 | 会话不存在 |
| `VALIDATION_ERROR` | 400 | `limit` 非数字或小于等于 0 |
| `INTERNAL_ERROR` | 500 | 服务端未知错误 |

### 5.3 POST /api/discussions/:sessionId/messages

**Request：**
```ts
{ content: string; clientMessageId?: string }
```

**Response `data`（新增 clientMessageId 回显）：**
```ts
{
  sessionId: string
  runId: string
  clientMessageId?: string        // ← 新增：回显 clientMessageId
  userMessage: DiscussionMessage | null
  agentMessages: DiscussionMessage[]
  activeSpeakerId: string | null
}
```

**错误码（HTTP 状态码映射）：**

| errorCode | HTTP | 场景 |
|-----------|------|------|
| `SESSION_NOT_FOUND` | 404 | 会话不存在 |
| `MESSAGE_EMPTY` | 400 | 内容为空 |
| `NO_AVAILABLE_AGENT` | 500 | 无可调度角色 |
| `LLM_PROVIDER_ERROR` | 502 | Provider 调用失败 |
| `AGENT_GENERATION_FAILED` | 500 | Agent 生成失败 |
| `INTERNAL_ERROR` | 500 | 服务端未知错误 |

**注意：`DUPLICATE_CLIENT_MESSAGE` 不再作为错误响应返回（从 PRD 错误码中移除）。**  
`sendUserMessage` 在检测到重复 `clientMessageId` 时：
- 若历史 userMessage 已 `completed` 且存在 `metadata.replyToClientMessageId === clientMessageId` 的 agentMessages，直接返回已有 userMessage + agentMessages，HTTP 200 幂等。
- 若历史 userMessage 为 `failed` 或不存在已关联 agentMessages，将原 userMessage 更新为 `pending`，复用原 `clientMessageId` 重新进入 Orchestrator / Scheduler / AgentRuntime 生成链路；生成成功后 agentMessages 写入 `metadata.replyToClientMessageId`。
- 前端重试不新增用户消息，统一按 `clientMessageId` 合并结果。

---

## 6. Module Design

### 6.1 DiscussionStore（`src/store/discussion.store.ts`）

**职责**：消息状态唯一同步入口，封装所有 API 调用，UI 组件只触发 Action 和读取 State。

**State 类型：**
```ts
interface DiscussionStoreState {
  sessions: Record<string, SessionSummary>
  messagesBySessionId: Record<string, DiscussionMessage[]>
  activeSpeakerBySessionId: Record<string, string | null>
  loadingBySessionId: Record<string, boolean>
  sendingByClientMessageId: Record<string, 'pending' | 'completed' | 'failed'>
  typingBySessionId: Record<string, boolean>
  typingSpeakerBySessionId: Record<string, { roleId: string; name: string } | null>
  errorBySessionId: Record<string, ApiError | null>
}
```

**Actions（暴露给 UI）：**
```ts
interface DiscussionActions {
  loadSession(sessionId: string): Promise<void>
  loadMessages(sessionId: string, opts?: { before?: string }): Promise<void>
  sendMessage(sessionId: string, content: string): Promise<void>
  retryMessage(sessionId: string, clientMessageId: string): Promise<void>
  clearError(sessionId: string): void
}
```

**实现模式**：React Context + useReducer（不引入第三方库）。

提供：
- `DiscussionProvider` — 包裹 DiscussionModule 的 Context Provider
- `useDiscussionStore()` — 消费 hook，返回 `{ state, actions }`
- `generateClientMessageId()` — 工具方法，生成 `client_${Date.now()}_${nanoid(6)}` 格式 ID
- **Typing 角色来源**：`activeSpeakerBySessionId[sessionId]` 是 RoleBar 和 TypingIndicator 的唯一 active speaker 来源。loadSession、loadMessages、sendMessage 成功分支若收到 `activeSpeakerId`，必须同时更新 `activeSpeakerBySessionId[sessionId]`；`sessions[sessionId]` 只保存会话摘要字段，不作为后续 typing speaker 的来源。sendMessage / retryMessage 启动时用 `activeSpeakerBySessionId[sessionId]` 查找角色名并写入 `typingSpeakerBySessionId`；若 `activeSpeakerId === null`，不展示具体角色高亮，Typing 文案退化为“正在生成...”，该退化仅用于无 active speaker 的异常/边界状态。
- **Agent 回复关联规则**：所有由某次用户消息触发的 agentMessages 必须写入 `metadata.replyToClientMessageId = clientMessageId`，用于 duplicate 幂等返回和失败重试后合并；没有该 metadata 的历史 agentMessages 不参与重复请求返回。
- **超时句柄管理**：`DiscussionProvider` 内部持有 `timeoutHandles: Map<clientMessageId, ReturnType<typeof setTimeout>>`（`useRef`），在 sendMessage/retryMessage 设置 10s 超时；成功或失败分支均调用 `clearTimeout` 取消；超时回调仅在 `sendingByClientMessageId[id] === 'pending'` 时才触发 failed 转换，同时清空 `typingSpeakerBySessionId`。

### 6.2 消息状态去重规则

Store 合并消息时，按以下优先级去重：
1. 已有 `messageId` 匹配 → 用服务端消息替换（更新 status 等字段）
2. 已有 `clientMessageId` 匹配 → 用服务端消息替换 optimistic message（保留位置）
3. 都不匹配 → 追加到列表末尾

每次 merge 后，对 `messagesBySessionId[sessionId]` 按 `createdAt` 升序重排，保证并发发送时的消息顺序确定性。

### 6.3 前端 UI 模块（`src/modules/discussion/`）

| 文件 | 职责 | 依赖 |
|------|------|------|
| `discussion-header.tsx` | 标题行（标题+模板 Tag+返回+更多） | Sheet, Tag |
| `role-bar.tsx` | 角色头像行，激活高亮 | DiscussionStore |
| `message-bubble.tsx` | 单条消息气泡（4 类型 + 失败状态 + 重试入口） | DiscussionStore.actions |
| `typing-indicator.tsx` | "[角色名]正在输入..." 动画 | 无 |
| `message-list.tsx` | 消息流容器（滚动控制 + loading/empty/error） | MessageBubble, TypingIndicator |
| `message-input.tsx` | 输入框 + 发送 + 快捷入口 | DiscussionStore.actions |
| `more-sheet.tsx` | 底部抽屉（总结/投票/归档入口 + Mock Modal） | Sheet, Modal |
| `index.tsx` | DiscussionModule：集成 Provider + 所有子组件 | DiscussionProvider |

### 6.4 MessageBubble 可扩展槽位设计

`MessageList` 渲染时根据 `msg.type` 选择渲染策略：
```ts
type RenderType = 'host' | 'character' | 'user' | 'system' | 'event' | 'invite'
```
- `event` / `invite` 类型当前渲染为空（预留插槽，不报错）
- 后续迭代 6/7 直接补充对应 Card 组件即可，无需修改消息流主体逻辑

### 6.5 集成测试链路契约

- **启动链路**：Home 创建会话（迭代 1 已有入口）→ 跳转 `/discussion/:sessionId` → DiscussionModule 调用 `loadSession` + `loadMessages` → Header / RoleBar / MessageList 以 API 数据渲染。测试需断言 topic、template、roles、activeSpeaker 高亮和空消息/历史消息状态。
- **发送链路**：MessageInput → DiscussionStore optimistic pending → POST /messages → DiscussionService → MessageRepository → Orchestrator / Scheduler / AgentRuntime → Store 合并 userMessage + agentMessages → Typing 清除。测试需断言 pending、具体角色 typing、completed、agent 回复和 activeSpeaker 更新。
- **失败重试链路**：POST /messages 返回生成失败或超时 → Store 标记 failed 并清空 typing → MessageBubble 展示重试 → retryMessage 复用 clientMessageId → 服务端对 failed 历史消息重新生成 → Store 不追加第二条用户消息，仅合并结果。

### 6.6 后端模块扩展

**MessageRepository（`src/server/repositories/message.repository.ts`）**：
```ts
interface MessageRepository {
  findBySessionId(sessionId: string, opts?: { limit?: number; before?: string }): Promise<DiscussionMessage[]>
  save(msg: DiscussionMessage): Promise<DiscussionMessage>
  countBySessionId(sessionId: string): Promise<number>
  findByClientMessageId(clientMessageId: string, sessionId: string): Promise<DiscussionMessage | null>       // 新增
  findRepliesByClientMessageId(sessionId: string, clientMessageId: string): Promise<DiscussionMessage[]>    // 新增，无分页扫描同 session 关联回复
  updateStatus(messageId: string, status: DiscussionMessage['status']): Promise<void>                    // 新增
}
```

**DiscussionService 变更：**
- `getMessages`：调用 repo 时传递 `before` 参数（messageId 游标）；repo 返回的消息已按 createdAt 升序排序。
- `sendUserMessage`：按 `clientMessageId` 分三分支处理，且不在 route 层实现生成逻辑：
  1. **首次提交**：创建 userMessage（携带 `clientMessageId`，status 从 pending 到 completed/failed），调用 Orchestrator / Scheduler / AgentRuntime 生成 agentMessages；生成成功后 agentMessages 写入 `metadata.replyToClientMessageId = clientMessageId`。
  2. **重复 completed**：`repo.findByClientMessageId(clientMessageId, sessionId)` 命中 completed userMessage 后，service 调用 `repo.findRepliesByClientMessageId(sessionId, clientMessageId)` 无分页扫描同 session 内 `metadata.replyToClientMessageId === clientMessageId` 的 agentMessages；若存在关联回复，则 HTTP 200 幂等返回已有 userMessage + agentMessages，不重新生成。
  3. **重复 failed / 缺少关联回复**：命中 failed userMessage 或 completed 但找不到关联 agentMessages 时，调用 `repo.updateStatus(userMessage.messageId, 'pending')` 复用原 userMessage，重新进入 Orchestrator / Scheduler / AgentRuntime；生成成功后写入关联 metadata，生成失败则将原 userMessage 标记 failed。
  返回结果始终补充 `clientMessageId` 回显。

---

## 7. Output Contract

| 任务 | 对外接口/方法 | 输入 | 输出 | 产出类型 | 功能类型 | 是否跨组件 | 测试规范 |
|------|-------------|------|------|---------|---------|----------|---------|
| Task-01 | `DiscussionMessage` 类型 | - | 类型正确包含 pending/clientMessageId；agent message metadata 可记录 replyToClientMessageId | none | 类型定义（type id: none） | 否 | - |
| Task-02 | `SendMessageRequest` / `SendMessageResult` / 消息列表参数类型 | content, clientMessageId, limit, before | API 类型包含 clientMessageId 回显和 before messageId 游标语义 | none | API 类型定义（type id: none） | 否 | - |
| Task-03 | `MessageRepository` 接口 | - | 接口含 findByClientMessageId/findRepliesByClientMessageId/updateStatus；PRD 方法名语义映射到现有 save/findBySessionId/updateStatus | none | 接口定义（type id: none） | 否 | - |
| Task-04 | `MockMessageRepository` | clientMessageId | 消息查找/状态更新正确；消息按 createdAt 升序；agentMessages 可无分页按 replyToClientMessageId 关联 | none | Repository（type id: none） | 否 | - |
| Task-05 | `DiscussionService.getMessages` | sessionId, {limit, before} | messages 按 createdAt 升序；before 游标正确过滤 | integration | Service→Repository（type id: integration） | 是（Service -> Repo） | standards/testing/integration.md |
| Task-06 | `DiscussionService.sendUserMessage` | sessionId, content, clientMessageId | completed 重复 clientMessageId 时幂等返回已有消息；failed 重复 clientMessageId 时重新生成；agentMessages 关联 replyToClientMessageId | integration | Service→Repository→Runtime（type id: integration） | 是（Service -> Repo -> Orchestrator） | standards/testing/integration.md |
| Task-07 | `GET /api/discussions/:sessionId/messages` | limit, before | 200 返回分页消息；limit 非法 400；session 不存在 404；before 找不到返回空列表 | web-e2e | Web/API（type id: web-e2e） | 是（Route -> Service -> Repo） | standards/testing/web-e2e.md |
| Task-08 | `POST /api/discussions/:sessionId/messages` | { content, clientMessageId } | 200 及 response.data.clientMessageId 回显；重复 completed 仍 200；重复 failed 重新生成；空消息 400；会话不存在 404 | web-e2e | Web/API（type id: web-e2e） | 是（Route -> Service -> Repo -> Runtime） | standards/testing/web-e2e.md |
| Task-09 | `DiscussionStore`（useDiscussionStore） | sessionId, content | state 包含 messages/loading/typing/typingSpeaker/error；Action 调用正确 API；超时清理 typing | none | Store 单元（type id: none） | 否 | - |
| Task-10 | `MessageBubble` | DiscussionMessage | host/character 左侧气泡；user 右侧气泡；system 居中；pending 灰色；failed 展示重试 | none | 组件单元（type id: none） | 否 | - |
| Task-11 | `RoleBar` | roles[], activeSpeakerId | active 角色有高亮样式（ring/border）；其余正常 | none | 组件单元（type id: none） | 否 | - |
| Task-12 | `TypingIndicator` | speakerName | 渲染"[speakerName]正在输入..."；speakerName 为 null 时仅在无 activeSpeaker 边界状态渲染"正在生成..." | none | 组件单元（type id: none） | 否 | - |
| Task-13 | `MessageList` | messages, isLoading, error | loading/empty/error/messages 四态各自渲染；auto-scroll；typing speaker 透传 | none | 组件单元（type id: none） | 否 | - |
| Task-14 | `MessageInput` | onSend, disabled | 空输入不触发 onSend；发送后清空；快捷文本填充 | none | 组件单元（type id: none） | 否 | - |
| Task-15 | `MoreSheet` | isOpen, onClose | Sheet 显示三入口；点击入口弹 Modal；Modal 说明后续支持 | none | 组件单元（type id: none） | 否 | - |
| Task-16 | `DiscussionHeader` | topic, templateName, onBack, onMore | 渲染标题、模板 Tag、返回按钮触发 onBack、更多触发 onMore | none | 组件单元（type id: none） | 否 | - |
| Task-17 | `DiscussionModule`（完整集成） | sessionId | 页面加载 session+messages；乐观发送显示 pending；具体角色 Typing 显示；失败后重试；返回首页 | integration | 前端 UI 全链路（type id: integration） | 是（UI -> Store -> API -> Service -> Repo） | standards/testing/integration.md |

**type_tests（需专项类型化测试的任务）：**
- `integration`：Task-05（Service.getMessages → Repo）、Task-06（Service.sendUserMessage → Repo → Runtime）、Task-17（DiscussionModule 前端全链路 UI 测试）
- `web-e2e`：Task-07（GET /messages 全链路 HTTP 测试）、Task-08（POST /messages 全链路 HTTP 测试）

---

## 8. Change Log

| 文件 | 变更类型 | 原因 |
|------|---------|------|
| `src/types/index.ts` | 修改 | DiscussionMessage 增加 pending 状态、clientMessageId 字段和 agent 回复关联 metadata |
| `src/types/api.ts` | 修改 | SendMessageRequest / SendMessageResult 增加 clientMessageId；消息列表类型补充 before 游标语义 |
| `src/server/repositories/message.repository.ts` | 修改 | 增加 findByClientMessageId、findRepliesByClientMessageId、updateStatus 方法签名 |
| `src/server/repositories/mock/mock-message.repository.ts` | 修改 | 实现新方法；修复排序（createdAt 升序）；支持 before 游标；支持 replyToClientMessageId 无分页关联查询 |
| `src/engine/agent-runtime.ts` | 修改 | 补齐 LLMConfig.provider，解除设计骨架编译阻塞 |
| `src/server/services/discussion.service.ts` | 修改 | getMessages 传递 before；sendUserMessage 增加 clientMessageId 去重、failed 重试再生成和 agent 回复关联 |
| `src/app/api/discussions/[sessionId]/messages/route.ts` | 修改 | GET 补齐 limit/before 校验；POST 透传 clientMessageId；重复 completed 请求 200 幂等，重复 failed 请求重新生成 |
| `src/app/discussion/[sessionId]/page.tsx` | 修改 | 修复 Next.js 15 params 异步解包 |
| `src/store/discussion.store.ts` | 新增 | DiscussionStore（Context + useReducer），含 typing speaker 和超时清理 |
| `src/modules/discussion/discussion-header.tsx` | 新增 | Header 组件 |
| `src/modules/discussion/message-bubble.tsx` | 新增 | MessageBubble 组件 |
| `src/modules/discussion/typing-indicator.tsx` | 新增 | TypingIndicator 组件 |
| `src/modules/discussion/more-sheet.tsx` | 新增 | MoreSheet 组件 |
| `src/modules/discussion/role-bar.tsx` | 修改 | 完整实现（替换占位骨架） |
| `src/modules/discussion/message-list.tsx` | 修改 | 完整实现（替换占位骨架） |
| `src/modules/discussion/message-input.tsx` | 修改 | 完整实现（替换占位骨架） |
| `src/modules/discussion/index.tsx` | 修改 | 接入 DiscussionProvider，完整集成 |

---

## 9. Development Tasks

- Task-01：扩展 DiscussionMessage 类型（添加 pending 状态、clientMessageId 和回复关联 metadata）
  - 所属模块：types
  - 简要描述：在 `src/types/index.ts` 中，`DiscussionMessage.status` union 增加 `'pending'`；增加可选字段 `clientMessageId?: string`；约定 agent message 的 `metadata.replyToClientMessageId` 用于关联触发它的用户消息
  - 涉及接口/方法：DiscussionMessage（类型）
  - 输入：无（类型定义）
  - 输出：编译通过；status 包含 pending；clientMessageId 可选存在；metadata 可承载 replyToClientMessageId
  - 产出类型：none
  - 功能类型：类型扩展（type id: none）
  - 是否跨组件：否

- Task-02：扩展 API 类型（SendMessageRequest / SendMessageResult / 消息列表参数）
  - 所属模块：types/api
  - 简要描述：在 `src/types/api.ts` 中补充 `clientMessageId` 请求与响应回显字段；消息列表参数类型补充 `before` messageId 游标语义
  - 涉及接口/方法：SendMessageRequest、SendMessageResult、ListMessagesRequest
  - 输入：content、clientMessageId、limit、before
  - 输出：API 类型编译通过；clientMessageId 和 before 字段可被 route/service/store 引用
  - 产出类型：none
  - 功能类型：API 类型定义（type id: none）
  - 是否跨组件：否

- Task-03：扩展 MessageRepository 接口（添加 findByClientMessageId 和 updateStatus 方法）
  - 所属模块：server/repositories
  - 简要描述：在 `src/server/repositories/message.repository.ts` 中增加 `findByClientMessageId(clientMessageId: string, sessionId: string): Promise<DiscussionMessage | null>`、`findRepliesByClientMessageId(sessionId: string, clientMessageId: string): Promise<DiscussionMessage[]>` 和 `updateStatus(messageId: string, status: DiscussionMessage['status']): Promise<void>`；`findRepliesByClientMessageId` 必须无分页扫描同 session 的关联回复，不能受列表页 `limit` 影响；PRD 的 appendMessage/listMessages/updateMessageStatus 语义映射为现有 save/findBySessionId/updateStatus 命名
  - 涉及接口/方法：MessageRepository 接口
  - 输入：无（接口定义）
  - 输出：接口文件编译通过；包含三个新方法签名；命名映射明确
  - 产出类型：none
  - 功能类型：接口扩展（type id: none）
  - 是否跨组件：否

- Task-04：实现 MockMessageRepository 的新方法、排序和回复关联
  - 所属模块：server/repositories/mock
  - 简要描述：在 `mock-message.repository.ts` 中实现 `findByClientMessageId`（使用内部 `clientIdIndex: Map<string, string>` 索引）、`findRepliesByClientMessageId`（无分页扫描同 session 并过滤 `metadata.replyToClientMessageId`）和 `updateStatus`；修复 `findBySessionId` 按 `createdAt` 升序排序；支持 `before` messageId 游标过滤；`save` 时若消息有 `clientMessageId` 则写入索引；agent message 保存时保留 `metadata.replyToClientMessageId`
  - 涉及接口/方法：findByClientMessageId()、findRepliesByClientMessageId()、updateStatus()、findBySessionId()、save()
  - 输入：findByClientMessageId(clientMessageId, sessionId)；updateStatus(messageId, status)；save(msg)
  - 输出：findByClientMessageId 返回消息或 null；findRepliesByClientMessageId 返回同 session 所有关联 agentMessages（不受分页限制）；updateStatus 修改对应消息；findBySessionId 返回升序消息；before 游标正确过滤；agent 回复可按 metadata 关联
  - 产出类型：none
  - 功能类型：Repository 实现（type id: none）
  - 是否跨组件：否

- Task-05：完善 DiscussionService.getMessages（消息排序与 before 游标）
  - 所属模块：server/services
  - 简要描述：在 `discussion.service.ts` 中修改 `getMessages`，将 `before` 参数传递给 `messageRepo.findBySessionId`；repo 已实现排序，service 层无需重排
  - 涉及接口/方法：DiscussionService.getMessages()
  - 输入：{ sessionId: string; limit: number; before?: string }
  - 输出：MessageListResult，messages 按 createdAt 升序；before 游标生效
  - 产出类型：integration
  - 功能类型：Service 调用 Repository（type id: integration）
  - 是否跨组件：是（组件链路：DiscussionService -> MessageRepository）

- Task-06：完善 DiscussionService.sendUserMessage（clientMessageId 去重、失败重试再生成）
  - 所属模块：server/services
  - 简要描述：若 `clientMessageId` 传入，先调 `messageRepo.findByClientMessageId`；若历史 userMessage 已 completed 且存在 `metadata.replyToClientMessageId` 关联的 agentMessages，则 HTTP 200 幂等返回；若历史 userMessage 为 failed 或缺少关联 agentMessages，则复用原 userMessage，更新为 pending，并重新进入 Orchestrator / Scheduler / AgentRuntime；新生成 agentMessages 写入 `metadata.replyToClientMessageId`
  - 涉及接口/方法：DiscussionService.sendUserMessage()
  - 输入：{ sessionId, content, clientMessageId? }
  - 输出：成功返回 SendMessageResult（含 clientMessageId 回显）；completed 重复返回已有映射；failed 重复重新生成；不重复追加 user message
  - 产出类型：integration
  - 功能类型：Service 调用 Repository 与 Runtime（type id: integration）
  - 是否跨组件：是（组件链路：DiscussionService -> MessageRepository -> Orchestrator）

- Task-07：完善 GET /messages API（分页、校验和错误码）
  - 所属模块：app/api
  - 简要描述：在 `route.ts` 中 GET handler 解析 `limit` 与 `before`；`limit <= 0` 或非数字返回 400 VALIDATION_ERROR；`limit > 100` clamp 为 100；session 不存在返回 404 SESSION_NOT_FOUND；before 找不到返回空 messages 与 hasMore false
  - 涉及接口/方法：GET /api/discussions/:sessionId/messages
  - 输入：limit、before
  - 输出：成功 200 返回 messages/activeSpeakerId/hasMore；非法 limit 返回 400；会话不存在返回 404
  - 产出类型：web-e2e
  - 功能类型：Web/API HTTP 接口（type id: web-e2e）
  - 是否跨组件：是（组件链路：API Route -> DiscussionService -> MessageRepository）

- Task-08：完善 POST /messages API（clientMessageId 回显、幂等和失败重试）
  - 所属模块：app/api
  - 简要描述：在 `route.ts` 中 POST handler 将 service 返回的 `clientMessageId` 透传到响应 `data` 中；重复 completed 请求返回 200 幂等；重复 failed 请求由 service 重新生成；route 层不返回 DUPLICATE_CLIENT_MESSAGE 409
  - 涉及接口/方法：POST /api/discussions/:sessionId/messages
  - 输入：{ content: string; clientMessageId?: string }
  - 输出：成功 200 含 clientMessageId；空消息 400 MESSAGE_EMPTY；会话不存在 404 SESSION_NOT_FOUND；重复 completed 200；重复 failed 重新生成并 200/失败错误码
  - 产出类型：web-e2e
  - 功能类型：Web/API HTTP 接口（type id: web-e2e）
  - 是否跨组件：是（组件链路：API Route -> DiscussionService -> MessageRepository -> Orchestrator）

- Task-09：实现 DiscussionStore（React Context + useReducer）
  - 所属模块：store
  - 简要描述：创建 `src/store/discussion.store.ts`，实现 `DiscussionStoreState`、`DiscussionActions`、`DiscussionProvider`、`useDiscussionStore()`；loadSession 调 GET /api/sessions/:sessionId；loadMessages 调 GET /api/discussions/:sessionId/messages；sendMessage 生成 clientMessageId、解析 typing speaker、追加 optimistic message（pending）、调 POST、合并结果并排序；retryMessage 复用 clientMessageId 重发；Typing 10s 超时兜底（使用 `useRef` Map 存储超时句柄，成功/失败时 clearTimeout，超时回调仅在 pending 状态时触发 failed 并清空 typingSpeaker）；每次消息合并后按 createdAt 升序重排
  - 涉及接口/方法：DiscussionProvider、useDiscussionStore()、generateClientMessageId()
  - 输入：sessionId、content
  - 输出：state 中 messages/loading/typing/typingSpeaker/error 正确更新；去重合并按 clientMessageId 或 messageId；消息列表始终升序；超时不误触发 failed
  - 产出类型：none
  - 功能类型：前端 Store（type id: none）
  - 是否跨组件：否

- Task-10：实现 MessageBubble 组件（4 种类型 + 失败重试）
  - 所属模块：modules/discussion
  - 简要描述：创建 `message-bubble.tsx`，根据 `msg.type` 渲染：host/character → 左侧气泡（有角色名、头像占位、tag）；user → 右侧气泡（蓝色背景）；system → 居中弱化文字；pending → 半透明灰；failed → 气泡下方显示"发送失败 [重试]"按钮，点击调 onRetry(clientMessageId)；EventCard/InviteCard 类型渲染空（预留插槽）
  - 涉及接口/方法：MessageBubble(props: { msg: DiscussionMessage; onRetry?: (clientMessageId: string) => void })
  - 输入：msg（DiscussionMessage），onRetry 回调
  - 输出：根据 type/status 渲染正确样式；failed 时展示重试入口
  - 产出类型：none
  - 功能类型：UI 组件（type id: none）
  - 是否跨组件：否

- Task-11：实现 RoleBar 组件（头像、名称、activeSpeakerId 高亮）
  - 所属模块：modules/discussion
  - 简要描述：修改 `role-bar.tsx`，渲染角色头像（用 avatar 字段文字或 emoji 在圆形背景中）、名称；`activeSpeakerId` 对应角色加 `ring-2 ring-primary` 高亮和底部蓝点指示；其余正常样式；横向滚动容器
  - 涉及接口/方法：RoleBar(props: { roles: RoleInfo[]; activeSpeakerId: string | null })
  - 输入：roles（RoleInfo[]），activeSpeakerId
  - 输出：active 角色有视觉高亮；其余正常；横向可滚动
  - 产出类型：none
  - 功能类型：UI 组件（type id: none）
  - 是否跨组件：否

- Task-12：实现 TypingIndicator 组件
  - 所属模块：modules/discussion
  - 简要描述：创建 `typing-indicator.tsx`，显示 "[speakerName]正在输入..." 并附动态三点动画；speakerName 为 null 时仅在 session 无 activeSpeaker 的边界状态显示 "正在生成..."
  - 涉及接口/方法：TypingIndicator(props: { speakerName: string | null })
  - 输入：speakerName
  - 输出：有 speakerName 时渲染具体角色名 + 动画；边界状态渲染 fallback
  - 产出类型：none
  - 功能类型：UI 组件（type id: none）
  - 是否跨组件：否

- Task-13：实现 MessageList 组件（消息流 + 自动滚动 + 四态）
  - 所属模块：modules/discussion
  - 简要描述：修改 `message-list.tsx`，渲染 messages 数组（调用 MessageBubble）；在末尾条件渲染 TypingIndicator 并传入 typingSpeakerName；isLoading 且无消息时渲染骨架屏；messages 为空且非 loading 时渲染空态；error 时渲染错误提示 + 重试按钮；新消息到达时若用户未上滑则 scrollToBottom；使用 useRef 检测用户手动上滑
  - 涉及接口/方法：MessageList(props: { messages, isLoading, error, typingSpeakerName, onRetry, onMessageRetry })
  - 输入：messages、isLoading、error、typingSpeakerName
  - 输出：4 种状态各自正确渲染；Typing 显示具体角色；新消息自动滚动底部；用户上滑时不强制滚动
  - 产出类型：none
  - 功能类型：UI 组件（type id: none）
  - 是否跨组件：否

- Task-14：实现 MessageInput 组件（发送、校验、快捷文本填充）
  - 所属模块：modules/discussion
  - 简要描述：修改 `message-input.tsx`，实现受控输入框；空内容点击发送展示轻量提示（红色边框或 Toast）；按 Enter 或点击发送按钮调 onSend；disabled 状态时禁用交互；快捷入口行（3个快捷按钮）点击填充文本到输入框；暴露 `fillText(text: string)` ref 方法供父组件填充
  - 涉及接口/方法：MessageInput(props: { onSend: (content: string) => void; disabled?: boolean })
  - 输入：onSend 回调，disabled
  - 输出：空输入不调 onSend；发送后清空；快捷文本正确填入
  - 产出类型：none
  - 功能类型：UI 组件（type id: none）
  - 是否跨组件：否

- Task-15：实现 MoreSheet 组件（总结/投票/归档入口 + Mock Modal）
  - 所属模块：modules/discussion
  - 简要描述：创建 `more-sheet.tsx`，使用现有 `Sheet` 组件（底部抽屉），展示"总结当前结论"、"触发投票"、"归档会话"三个入口行；点击任意入口关闭 Sheet，弹 `Modal`（使用现有 Modal 组件），Modal 内容："该功能将在后续迭代支持"；Modal 关闭按钮
  - 涉及接口/方法：MoreSheet(props: { isOpen: boolean; onClose: () => void })
  - 输入：isOpen、onClose
  - 输出：Sheet 显示三入口；点击入口弹 Modal 说明；Modal 可关闭
  - 产出类型：none
  - 功能类型：UI 组件（type id: none）
  - 是否跨组件：否

- Task-16：实现 DiscussionHeader 组件（标题、模板 Tag、返回、更多操作）
  - 所属模块：modules/discussion
  - 简要描述：创建 `discussion-header.tsx`，渲染一行：返回按钮（触发 onBack）、议题标题（截断 ellipsis）、模板 Tag（使用现有 Tag 组件）、更多按钮（"⋯" 触发 onMore）
  - 涉及接口/方法：DiscussionHeader(props: { topic: string; templateName: string; onBack: () => void; onMore: () => void })
  - 输入：topic、templateName、onBack、onMore
  - 输出：渲染正确；onBack/onMore 按钮响应点击
  - 产出类型：none
  - 功能类型：UI 组件（type id: none）
  - 是否跨组件：否

- Task-17：实现 DiscussionModule 完整集成（DiscussionProvider + 完整集成逻辑）
  - 所属模块：modules/discussion
  - 简要描述：修改 `index.tsx`，将 `DiscussionProvider` 包裹整个模块；useEffect 触发 `store.actions.loadSession + loadMessages`；将 DiscussionHeader、RoleBar、MessageList（传递 typing speaker）、MessageInput（传递 sendMessage）、MoreSheet 组合；会话加载失败时全页错误 + 返回首页链接；`page.tsx` 修复为异步 params
  - 涉及接口/方法：DiscussionModule(props: { sessionId: string })
  - 输入：sessionId
  - 输出：完整讨论页可交互；Store 驱动所有状态；乐观发送 → 具体角色 Typing → 消息到达；失败重试不重复追加用户消息；返回首页
  - 产出类型：integration
  - 功能类型：前端 UI 全链路（type id: integration）
  - 是否跨组件：是（组件链路：DiscussionModule -> DiscussionStore -> API -> DiscussionService -> MessageRepository）
