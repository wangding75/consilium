# PRD — 迭代 3：讨论页消息流与前后端联动

> 版本：v1.0  
> 日期：2026-05-19  
> 状态：已评审通过

---

## 1. 功能概述

本迭代将 `/discussion/[sessionId]` 页面从静态骨架变为真实可用的讨论界面。用户能看到消息流、角色栏、输入区和生成状态，并完成基础收发消息闭环。

本迭代承接迭代 2 的多 Agent 运行时 API，聚焦正式讨论页 UI、消息状态管理、前后端联动与错误处理。不实现完整状态机、用户意图识别、导演逻辑、邀请、投票、爽点事件和会话中心完整生命周期。

**功能点清单：**
1. 讨论页 Header
2. 角色栏（Roster Bar）
3. 消息流（Message Stream）
4. 消息发送与乐观更新（Composer）
5. Agent Typing / 生成状态
6. 错误处理与重试
7. 更多操作 Sheet（仅入口 Mock）
8. 前端状态管理（DiscussionStore）
9. 后端 API 完善

---

## 2. Functional Requirements

### 功能点 1：讨论页 Header

| 编号 | 需求 | 优先级 |
|------|------|--------|
| FR-001 | 进入页面时调用 `GET /api/sessions/:sessionId`，加载议题（topic）、模板名（template.name）展示在 Header | P0 |
| FR-002 | Header 提供返回按钮，点击返回首页 | P0 |
| FR-003 | Header 提供更多操作入口（"..."），点击展开 More Sheet | P1 |

**异常处理：** 会话加载失败时，Header 展示错误状态并提供"返回首页"引导，不显示空白。

---

### 功能点 2：角色栏（Roster Bar）

| 编号 | 需求 | 优先级 |
|------|------|--------|
| FR-004 | Roster Bar 展示主持人和所有角色的头像与名称，数据来自 `GET /api/sessions/:sessionId` 的 `roles` 字段 | P0 |
| FR-005 | 当前发言角色高亮，高亮依据为 API / Store 中的 `activeSpeakerId`，不得从最后一条消息临时推断 | P0 |

**异常处理：** `activeSpeakerId` 为 null 时，取消所有高亮，不崩溃。

---

### 功能点 3：消息流（Message Stream）

| 编号 | 需求 | 优先级 |
|------|------|--------|
| FR-006 | 支持 4 种消息类型的差异化渲染：host（左侧气泡）、character（左侧气泡）、user（右侧气泡）、system（居中弱化展示） | P0 |
| FR-007 | 消息流自动滚动到底部；用户手动上滑查看历史时不强制抢滚动 | P1 |
| FR-008 | MessageList 预留 EventCard / InviteCard 插槽，本迭代不渲染真实事件或邀请数据 | P2 |
| FR-009 | 页面初次加载时展示 Loading 状态；无消息时展示空态；加载失败时展示错误提示 | P0 |

**异常处理：** 消息列表加载失败时展示可重试的错误提示，不显示空白消息流。

---

### 功能点 4：消息发送与乐观更新（Composer）

| 编号 | 需求 | 优先级 |
|------|------|--------|
| FR-010 | Composer 输入框为空时发送按钮不可用，尝试发送时给出轻量提示 | P0 |
| FR-011 | 点击发送后，用户消息以 `pending` 状态立即追加到消息流（乐观展示） | P0 |
| FR-012 | 每条发出的消息必须携带 `clientMessageId`，用于去重和重试 | P0 |
| FR-013 | 快捷入口可填充文本到 Composer，但不触发意图识别、投票或总结逻辑 | P1 |

**异常处理：** `clientMessageId` 重复时，服务端不重复追加消息，返回已有消息映射。

---

### 功能点 5：Agent Typing / 生成状态

| 编号 | 需求 | 优先级 |
|------|------|--------|
| FR-014 | 调用 `POST /messages` 后，消息流底部展示 Typing 指示器，格式为"[角色名]正在输入..."（如"诸葛亮正在输入..."），提示具体 Agent 正在生成 | P0 |
| FR-015 | 接口成功返回后，user message 状态更新为 `completed`，追加 agentMessages，关闭 Typing | P0 |
| FR-016 | Typing 状态必须可结束：成功、失败、超时均须清除，不允许永久卡在 Typing | P0 |

---

### 功能点 6：错误处理与重试

| 编号 | 需求 | 优先级 |
|------|------|--------|
| FR-017 | 发送失败时，user message 状态更新为 `failed`，并在消息气泡附近展示重试入口 | P0 |
| FR-018 | 点击重试时，复用原 `clientMessageId` 或 `messageId` 提交，不重复追加新的用户消息 | P0 |
| FR-019 | Agent 生成失败时，展示生成失败提示并可重试 | P0 |
| FR-020 | 会话不存在（SESSION_NOT_FOUND）时，引导用户返回首页 | P0 |

---

### 功能点 7：更多操作 Sheet（More Sheet）

| 编号 | 需求 | 优先级 |
|------|------|--------|
| FR-021 | More Sheet 可展示总结、投票、归档等入口；点击任意入口弹出半屏 Modal，说明"该功能将在后续迭代支持"，不触发真实业务逻辑 | P1 |

---

### 功能点 8：前端状态管理（DiscussionStore）

| 编号 | 需求 | 优先级 |
|------|------|--------|
| FR-022 | 新增或完善 `DiscussionStore`，作为消息状态唯一同步入口；UI 组件只负责渲染和触发动作，不直接维护消息数组 | P0 |
| FR-023 | 乐观消息必须可回滚：请求失败时消息进入 `failed` 状态，不直接消失 | P0 |
| FR-024 | 消息合并必须以 `messageId` + `clientMessageId` 去重，防止重复气泡 | P0 |
| FR-025 | 页面重新进入时，根据 sessionId 重新调用 `listMessages`，不依赖组件局部状态 | P0 |

Store 状态结构：
```ts
interface DiscussionStoreState {
  sessions: Record<string, DiscussionSessionSummary>
  messagesBySessionId: Record<string, Message[]>
  activeSpeakerBySessionId: Record<string, string | null>
  loadingBySessionId: Record<string, boolean>
  sendingByClientMessageId: Record<string, 'pending' | 'completed' | 'failed'>
  typingBySessionId: Record<string, boolean>
  errorBySessionId: Record<string, ApiError | null>
}
```

---

### 功能点 9：后端 API 完善

| 编号 | 需求 | 优先级 |
|------|------|--------|
| FR-026 | `GET /api/sessions/:sessionId` 返回 `topic`、`template`、`roles`、`status`、`activeSpeakerId` | P0 |
| FR-027 | `GET /api/discussions/:sessionId/messages` 支持 `limit`（默认50, 最大100）、`before` 分页参数，返回 `hasMore` | P0 |
| FR-028 | 消息列表按时间升序返回 | P0 |
| FR-029 | `POST /api/discussions/:sessionId/messages` 接收 `content` 和 `clientMessageId`，返回 `userMessage`、`agentMessages`、`activeSpeakerId` | P0 |
| FR-030 | `clientMessageId` 在同一 session 内具备去重能力；重复提交不重复追加用户消息 | P0 |
| FR-031 | 支持消息类型：`host`、`character`、`user`、`system`；`event`、`invite` 作为后续扩展类型预留 | P0 |
| FR-032 | 支持消息状态：`pending`、`streaming`、`completed`、`failed` | P0 |
| FR-033 | 失败场景返回 `errorCode`、`errorMessage`；支持错误码：`SESSION_NOT_FOUND`、`MESSAGE_EMPTY`、`DUPLICATE_CLIENT_MESSAGE`、`NO_AVAILABLE_AGENT`、`LLM_PROVIDER_ERROR`、`AGENT_GENERATION_FAILED` | P0 |
| FR-034 | 不同 session 的消息必须严格隔离，分页与重试也必须带 sessionId 校验 | P0 |
| FR-035 | Agent 生成通过迭代 2 的 Orchestrator / Scheduler / AgentRuntime，不允许在 API route 内直接写生成逻辑 | P0 |
| FR-036 | Repository 提供 `appendMessage`、`listMessages`、`updateMessageStatus`、`findByClientMessageId` | P0 |

---

## 3. Non-Functional Requirements

| 维度 | 要求 |
|------|------|
| UI 分层 | 前端不得直接调用 LLM Provider，不得在组件内拼 Prompt 或执行调度逻辑 |
| 状态一致性 | Typing 状态必须有超时兜底，不允许永久卡住 |
| 数据隔离 | 不同 session 的消息数据必须严格隔离，不得串流 |
| 可扩展性 | MessageList 设计须支持后续 EventCard / InviteCard 插槽插入，避免未来重构 |

---

## 4. 验收标准

| 类型 | 验收条件 |
|------|---------|
| 产品 | 用户进入讨论页能看到会话标题、模板、角色栏 |
| 产品 | 用户能看到 Host / 角色 / 用户 / 系统消息的差异化气泡样式 |
| 产品 | 用户发送消息后，消息立即以 pending 状态出现在消息流中 |
| 产品 | Agent 生成中显示 Typing 状态 |
| 产品 | Agent 回答完成后消息出现在消息流中 |
| 产品 | 当前发言角色在角色栏有视觉高亮 |
| 产品 | 网络或生成错误时，用户能看到错误提示并可重试 |
| 产品 | 返回首页再进入讨论页，当前会话消息仍可从 API 重新加载 |
| 产品 | More Sheet 可打开，后续能力不误导为已完成 |
| 技术 | 消息接口返回结构符合 API 契约 |
| 技术 | 前端消息状态通过 Store / service 同步，不直接操作本地数组 |
| 技术 | 消息状态流转正确：`pending` → `completed` / `failed` |
| 技术 | `clientMessageId` 支持乐观展示、去重和重试 |
| 技术 | `activeSpeakerId` 驱动角色栏高亮 |
| 技术 | 不同 session 消息不串流 |
| 技术 | MessageList 组件可后续插入 EventCard / InviteCard |
| 技术 | UI 不直接调用 LLM Provider，不拼 Prompt，不实现调度 |
| 测试 | e2e 覆盖"创建会话 → 进入讨论 → 发送消息 → 看到回复" |
| 测试 | e2e 覆盖发送失败后展示错误并可重试 |

---

## 5. Out of Scope

| 不包含 | 后置迭代 |
|--------|---------|
| 多阶段状态机完整推进（opening/developing/climax/closing） | 迭代 4 |
| 会话中心完整搜索、筛选、归档、恢复列表 | 迭代 4 |
| 快捷指令真实执行 | 迭代 5 |
| 用户意图识别（interrupt/command/passive） | 迭代 5 |
| 邀请用户真实逻辑 | 迭代 6 |
| 主持人真实总结 / 收束决策 | 迭代 6 |
| 爽点事件真实触发（打脸/站队/投票/反转） | 迭代 7 |
| 投票接口与投票状态 | 迭代 7 |
| 模板/角色/模型策略配置 | 迭代 8 |
| Provider 设置和会话导出 | 迭代 9 |
| 真实 SSE / chunk streaming 协议 | 不要求本迭代 |

---

## 依赖说明

| 依赖 | 状态 |
|------|------|
| 迭代 0：`/discussion/[sessionId]` 页面骨架、App Shell、基础组件、Mock Repository、API 统一响应结构 | ✅ 已完成 |
| 迭代 1：首页创建会话并跳转到讨论页 | ✅ 已完成 |
| 迭代 2：`GET /api/sessions/:sessionId`、`GET /api/discussions/:sessionId/messages`、`POST /api/discussions/:sessionId/messages`、MockLLM、Agent 生成链路 | ✅ 已完成 |
