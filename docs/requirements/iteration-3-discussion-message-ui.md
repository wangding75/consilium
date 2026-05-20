# 迭代 3：讨论页消息流与前后端联动

> 评审日期：2026-05-19  
> 评审结论：条件通过。迭代 3 与当前重拆版迭代计划一致，可进入开发；本修订版补充会话加载依赖、消息 DTO/API 契约、前端 Store 边界、乐观发送与重试规则、Typing/Streaming 状态边界、错误与空态、测试要求，避免实现阶段把消息流逻辑写散到 UI 组件。  
> 修订来源：Iteration 3 需求评审。  
> 文档基线：以 `iteration-3-discussion-message-ui.md` 为当前开发入口；旧版 `iteration-3-discussion-state-machine.md` 属于重拆前文档命名，不作为当前开发入口。

---

## 评审修订摘要

| 变更项 | 修订内容 | 原因 |
|---|---|---|
| 迭代定位 | 明确迭代 3 聚焦“正式讨论页消息流体验”，不实现状态机、意图识别、导演和事件真实触发 | 避免与迭代 4-7 范围重叠 |
| 会话加载依赖 | 明确复用迭代 2 的 `GET /api/sessions/:sessionId` 加载标题、模板、角色栏和 `activeSpeakerId` | Header / Roster 不能依赖组件硬编码 |
| 消息 API 契约 | 补充 `GET /api/discussions/:sessionId/messages` 和 `POST /api/discussions/:sessionId/messages` 的请求/响应结构 | 支撑前后端并行开发和 e2e 验收 |
| 消息状态 | 明确用户消息乐观态、Agent Typing 态、失败态、重试态的状态流转 | 避免“看起来能发，实际状态不可控” |
| 前端 Store 边界 | 要求 `DiscussionStore` / service 作为消息状态唯一同步入口，UI 组件只负责渲染和触发动作 | 符合 UI / engine / service 分层原则 |
| `clientMessageId` | 新增客户端消息 ID，用于乐观展示、重试和去重 | 避免重复提交造成消息重复 |
| Streaming 边界 | 本迭代默认允许非流式返回 + Typing 状态；如实现 streaming，必须落到统一消息状态机 | 控制复杂度，同时不阻断后续流式增强 |
| Event/Invite 扩展位 | 消息流组件预留 `EventCard` / `InviteCard` 插槽，但 API 本迭代不要求真实产生事件或邀请 | 承接迭代 6/7，避免当前迭代范围膨胀 |
| 测试要求 | 补充组件、Store、API、e2e 测试覆盖点 | 保证消息流不是纯视觉实现 |
| 文档基线偏差 | 旧蓝图/旧 iteration README 仍保留“迭代 3 = 状态机”的历史表述；当前以重拆版计划为开发基线 | 属于文档版本遗留，不构成产品方向背离 |

---

## Step 3｜初步对齐检查

| 检查项 | 初始需求描述 | 蓝图 / 当前计划定义 | 状态 |
|---|---|---|---|
| 产品主线 | 将讨论页从静态页变成可用消息流 | 产品核心是多 Agent 讨论编排与讨论 UI，消息流、角色栏、用户输入是讨论体验层核心组成 | ✅ 对齐 |
| 迭代顺序 | 承接迭代 2 的多 Agent 运行时 | 重拆版计划定义迭代 2 为多 Agent 运行时、迭代 3 为讨论页消息流联动 | ✅ 对齐 |
| UI 结构 | Header、Roster、Message Stream、Composer、More Sheet、Typing | 移动端原型讨论页包含角色栏、消息流、事件卡、邀请卡、输入区 | ✅ 对齐 |
| 消息类型 | host、character、user、system | 蓝图消息模块定义 host、character、user、system、event、invite；本迭代先实现前四类并预留后两类 | ✅ 对齐 |
| Engine / UI 边界 | 前端展示消息流，API 触发 Agent 回复 | 蓝图要求 UI 不承担调度逻辑，LLM 调用必须统一封装 | ✅ 对齐 |
| 状态机 | 初始需求明确不做完整状态机 | 状态机是 MVP 必须能力，但重拆版计划放在迭代 4 | ✅ 对齐 |
| 用户意图 | 本迭代只做普通输入和基础收发 | 用户插话、指挥、定夺放在迭代 5 | ✅ 对齐 |
| 导演逻辑 | More Sheet 可展示总结、投票入口，但核心逻辑后置 | 导演控制放在迭代 6，爽点事件放在迭代 7 | ✅ 对齐 |
| 会话恢复 | 返回首页/会话页不丢失当前会话状态 | 会话保存与恢复是 MVP 核心能力；完整会话中心在迭代 4 | ✅ 对齐，需限定范围 |
| 文档编号 | 当前文件为“讨论页消息流” | 旧蓝图迭代表仍写“迭代 3：讨论状态机” | ⚠️ 文档基线偏差，不是产品方向冲突 |

---

## Step 4｜需求评审意见

### 1. 完整性

| 问题 | 评审意见 | 修订建议 |
|---|---|---|
| Header / Roster 数据来源不明确 | 原始需求写了展示标题、模板、角色，但未说明从哪个接口加载 | 明确依赖迭代 2 的 `GET /api/sessions/:sessionId` |
| 乐观发送缺少去重依据 | FE-006 要求乐观展示，但 BE 只写 `messageId`，未写 `clientMessageId` | `POST /messages` 必须接收 `clientMessageId`，服务端返回时带回映射关系 |
| Typing 与 streaming 边界模糊 | BE 写了 `streaming` 状态，但没有要求 SSE / chunk 协议 | 本迭代默认非流式也可通过 Typing 满足体验；如实现流式必须复用统一状态 |
| 重试规则不完整 | FE 写了失败与重试，但未说明重试的是用户消息还是 Agent 生成 | 重试以 `clientMessageId` 或 `messageId` 去重，不能重复追加用户消息 |
| 会话不丢失表述过宽 | 迭代 4 才做会话中心与生命周期，迭代 3 不应扩大成完整恢复能力 | 本迭代只保证当前 session 消息可重新加载，不做完整归档、筛选、恢复列表 |

### 2. 合理性

| 检查点 | 结论 |
|---|---|
| 技术方案可行性 | 可行。迭代 2 已定义会话详情、消息列表、发送消息、`activeSpeakerId`、MockLLM 和 Agent 生成链路，迭代 3 主要完善 UI 与状态管理。 |
| 范围控制 | 基本合理，但必须明确 More Sheet、快捷入口、总结、投票只做入口或 Mock，不触发真实业务逻辑。 |
| API 复杂度 | 可控。继续使用迭代 2 的 3 个核心接口，只补充消息 UI 所需字段，不引入新引擎能力。 |
| UI 实现风险 | 中等。消息滚动、乐观更新、失败重试、角色高亮是本迭代最容易出现状态错乱的部分。 |

### 3. 一致性

| 对象 | 结论 |
|---|---|
| 与迭代 0 | 对齐。迭代 0 已要求 `/discussion/[sessionId]` 页面骨架、消息流、角色栏、输入区占位。 |
| 与迭代 1 | 对齐。迭代 1 创建 session 后跳转讨论页，迭代 3 完善该页面真实渲染。 |
| 与迭代 2 | 对齐。迭代 2 负责多 Agent 运行时和基础 API，迭代 3 不重复实现调度，只消费 API/Service 输出。 |
| 与迭代 4 | 有潜在重叠。会话恢复、归档、状态筛选必须后置到迭代 4；迭代 3 只做当前讨论页内状态保持。 |
| 与迭代 5-7 | 有潜在重叠。快捷指令、总结、投票、邀请、事件只保留入口或 Mock，不真实执行。 |

### 4. 风险点

| 风险 | 等级 | 影响 | 应对 |
|---|---|---|---|
| UI 直接维护消息数组 | P0 | 后续 EventCard、InviteCard、状态机接入时会重构 | 强制使用 Store / service，同步 API 返回，不让组件成为唯一数据源 |
| 乐观消息重复 | P1 | 重试或网络抖动导致重复气泡 | 使用 `clientMessageId` 去重，服务端返回映射 |
| 角色高亮错误 | P1 | 用户无法感知当前发言者 | 统一使用 `activeSpeakerId`，不要从最后一条消息临时推断 |
| Typing 卡死 | P1 | 生成失败时 UI 一直显示“正在输入” | 所有请求必须落到 completed / failed，并有超时兜底 |
| 过早实现总结/投票/归档 | P1 | 范围膨胀，冲击迭代 4-7 | More Sheet 本迭代只展示入口和提示，不接真实逻辑 |
| 消息模型不兼容后续事件卡 | P2 | 迭代 6/7 插入事件卡时重构成本高 | MessageList 设计 `renderType` / 插槽机制，保留 event/invite 扩展位 |

---

## 迭代目标

将移动端原型中的讨论页从静态页面变成真实可用的讨论界面。用户能看到消息流、角色栏、输入区、生成状态，并完成基础收发消息闭环。

本迭代承接迭代 2 的多 Agent 运行时，重点是正式讨论页 UI、消息状态管理、前后端联动和错误处理。

本迭代不实现完整状态机、用户意图识别、导演逻辑、邀请用户、投票、爽点事件、会话中心完整生命周期。

## 前置依赖

| 依赖 | 要求 |
|---|---|
| 迭代 0 | 已存在 `/discussion/[sessionId]` 页面骨架、App Shell、基础 UI 组件、Mock Repository、API 统一响应结构 |
| 迭代 1 | 首页可创建会话，并跳转到 `/discussion/[sessionId]` |
| 迭代 2 | 已实现 `GET /api/sessions/:sessionId`、`GET /api/discussions/:sessionId/messages`、`POST /api/discussions/:sessionId/messages`，并能返回 Host / Expert / Critic 基础消息 |
| MockLLM | 测试环境默认可用，输出稳定，支持成功与失败场景 |

## 原型映射

| 原型区域 | 本迭代要求 |
|---|---|
| Chat Header | 返回、标题、模板 Tag、更多操作 |
| Roster Bar | 主持人、角色、当前发言人高亮 |
| Message Stream | 主持人、角色、用户、系统消息气泡 |
| Composer | 输入框、发送按钮、快捷入口 |
| More Sheet | 总结、投票、归档等入口可展示，但核心逻辑后续迭代完善 |
| Loading/Typing | Agent 生成中有明确状态 |
| Error / Retry | 发送失败、生成失败、会话加载失败有明确反馈 |

## 前端需求

| 编号 | 需求 |
|---|---|
| FE-001 | 实现 `/discussion/[sessionId]` 页面，进入页面时加载会话详情和消息列表 |
| FE-002 | 实现讨论页 Header，展示议题、模板名、返回按钮、更多操作入口 |
| FE-003 | 实现角色栏，展示主持人、角色头像、名称和当前发言状态 |
| FE-004 | 角色栏高亮必须以 API / Store 中的 `activeSpeakerId` 为准 |
| FE-005 | 实现消息流组件，支持主持人、角色、用户、系统消息 |
| FE-006 | 实现用户消息右侧气泡、主持人/角色消息左侧气泡、系统消息弱化展示 |
| FE-007 | 实现消息自动滚动到底部；用户手动上滑查看历史时不得强制频繁抢滚动 |
| FE-008 | 实现用户发送消息后的乐观展示，发送中展示 pending 状态 |
| FE-009 | 实现 Agent 生成中 Typing 状态，展示在消息流底部或对应角色下方 |
| FE-010 | 实现发送失败 / 生成失败后的错误提示与重试入口 |
| FE-011 | 重试时不得重复追加用户消息，必须复用 `clientMessageId` 或原 `messageId` |
| FE-012 | 实现更多操作 Sheet；总结、投票、归档等入口本迭代只允许 Mock 或提示“后续迭代支持” |
| FE-013 | Composer 输入为空时不能发送，并给出轻量提示 |
| FE-014 | 快捷入口可以填充文本，但不得触发真实意图识别、投票或总结逻辑 |
| FE-015 | 页面初次加载、空消息、加载失败、发送中、发送失败均有明确 UI 状态 |
| FE-016 | 返回首页再进入同一 session 时，应能从 API / Store 重新得到当前消息，不依赖组件局部状态 |
| FE-017 | MessageList 组件需预留 EventCard / InviteCard 插入能力，但本迭代不要求真实事件或邀请数据 |
| FE-018 | 前端不得直接调用 LLM Provider，不得在组件内拼 Prompt 或执行调度逻辑 |

## 后端/API需求

| 编号 | 需求 |
|---|---|
| BE-001 | 复用并完善 `GET /api/sessions/:sessionId`，返回 topic、template、roles、status、activeSpeakerId |
| BE-002 | 完善 `GET /api/discussions/:sessionId/messages`，支持按时间升序返回 |
| BE-003 | `GET /messages` 支持 `limit`、`before` 参数，返回 `hasMore` |
| BE-004 | 完善 `POST /api/discussions/:sessionId/messages`，返回用户消息和 Agent 生成消息 |
| BE-005 | `POST /messages` 请求必须支持 `content` 和 `clientMessageId` |
| BE-006 | 支持消息类型：host、character、user、system；event、invite 作为后续扩展类型预留 |
| BE-007 | 支持消息状态：pending、streaming、completed、failed |
| BE-008 | 服务端需返回稳定 `messageId`，前端可用于重试、去重和状态更新 |
| BE-009 | 服务端需返回 `activeSpeakerId`，用于角色栏高亮 |
| BE-010 | 服务层提供 `DiscussionService.listMessages` 与 `DiscussionService.sendMessage` |
| BE-011 | Repository 提供 `appendMessage`、`listMessages`、`updateMessageStatus`、`findByClientMessageId` |
| BE-012 | `clientMessageId` 在同一 session 内应具备去重能力；重复提交不得重复追加用户消息 |
| BE-013 | 失败场景需保留 `errorCode`、`errorMessage`，便于前端展示和重试 |
| BE-014 | 本迭代默认可采用非流式返回；如实现 streaming，必须保证最终状态落到 completed / failed |
| BE-015 | Agent 生成仍通过迭代 2 的 Orchestrator / Scheduler / AgentRuntime，不允许在 API route 内直接写生成逻辑 |
| BE-016 | 不同 session 的消息必须严格隔离，分页与重试也必须带 sessionId 校验 |

## API 契约

### `GET /api/sessions/:sessionId`

用于讨论页 Header 和 Roster 初始化。

**Response**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "topic": "制定市场进入策略",
    "template": {
      "templateId": "sanguo_advisors",
      "name": "三国军师团"
    },
    "status": "running",
    "roles": [
      {
        "roleId": "host",
        "name": "主持人",
        "agentType": "host",
        "avatar": "主",
        "model": "mock-role-model"
      },
      {
        "roleId": "zhuge_liang",
        "name": "诸葛亮",
        "agentType": "expert",
        "avatar": "亮",
        "model": "mock-role-model"
      }
    ],
    "activeSpeakerId": "host",
    "createdAt": "2026-05-19T00:00:00.000Z",
    "updatedAt": "2026-05-19T00:00:00.000Z"
  },
  "error": null,
  "requestId": "req_001"
}
```

### `GET /api/discussions/:sessionId/messages`

获取指定会话消息列表。

**Query**

| 参数 | 必填 | 说明 |
|---|---:|---|
| `limit` | 否 | 默认 50，最大 100 |
| `before` | 否 | 分页游标，使用 messageId 或 createdAt |

**Response**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "messages": [
      {
        "messageId": "msg_001",
        "sessionId": "sess_001",
        "type": "host",
        "roleId": "host",
        "agentType": "host",
        "content": "各位，今日讨论主题：制定市场进入策略。",
        "status": "completed",
        "createdAt": "2026-05-19T00:00:00.000Z",
        "metadata": {
          "roundIndex": 0,
          "isMock": true
        }
      }
    ],
    "activeSpeakerId": "zhuge_liang",
    "hasMore": false
  },
  "error": null,
  "requestId": "req_002"
}
```

### `POST /api/discussions/:sessionId/messages`

提交用户消息，并触发下一条或下一轮 Agent 发言。

**Request**

```json
{
  "content": "我觉得应该优先验证中小企业市场。",
  "clientMessageId": "client_msg_001"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "runId": "run_001",
    "clientMessageId": "client_msg_001",
    "userMessage": {
      "messageId": "msg_user_001",
      "type": "user",
      "content": "我觉得应该优先验证中小企业市场。",
      "status": "completed",
      "createdAt": "2026-05-19T00:01:00.000Z"
    },
    "agentMessages": [
      {
        "messageId": "msg_agent_002",
        "type": "character",
        "roleId": "simayi",
        "agentType": "critic",
        "content": "此处应谨慎：中小企业市场验证快，但付费能力和续费稳定性需要先确认。",
        "status": "completed",
        "createdAt": "2026-05-19T00:01:02.000Z"
      }
    ],
    "activeSpeakerId": "simayi"
  },
  "error": null,
  "requestId": "req_003"
}
```

**错误码**

| code | 场景 | 前端处理 |
|---|---|---|
| `SESSION_NOT_FOUND` | 会话不存在 | 展示会话不存在，引导返回首页 |
| `MESSAGE_EMPTY` | 用户消息为空 | 不提交，提示请输入内容 |
| `DUPLICATE_CLIENT_MESSAGE` | 重复 `clientMessageId` | 复用已有消息，不重复追加 |
| `NO_AVAILABLE_AGENT` | 没有可调度角色 | 展示生成失败，可重试 |
| `LLM_PROVIDER_ERROR` | Provider 调用失败 | 展示生成失败，可重试 |
| `AGENT_GENERATION_FAILED` | Agent 生成失败 | 展示生成失败，可重试 |

## 前端状态管理要求

建议新增或完善 `DiscussionStore`：

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

| 要求 | 说明 |
|---|---|
| Store 是 UI 状态同步入口 | 组件不直接把本地数组作为唯一消息源 |
| 乐观消息必须可回滚 | 请求失败时消息进入 failed 状态，而不是直接消失 |
| Agent Typing 必须可结束 | 成功、失败、超时都必须清除 typing 状态 |
| 消息合并必须去重 | 以 `messageId` + `clientMessageId` 去重 |
| 页面重新进入可恢复 | 根据 sessionId 重新 listMessages，而不是依赖组件未卸载 |

## 消息状态流转

```text
用户点击发送
  ↓
本地追加 user message: pending
  ↓
调用 POST /messages
  ↓
显示 Agent Typing
  ↓
接口成功：user message → completed；append agentMessages；更新 activeSpeakerId；关闭 Typing
  ↓
接口失败：user message → failed；关闭 Typing；展示重试入口
```

若实现 streaming：

```text
agent message: streaming → completed / failed
```

本迭代不强制实现真实 SSE / chunk streaming。

## 验收标准

| 类型 | 标准 |
|---|---|
| 产品 | 用户进入讨论页能看到会话标题、模板、角色栏 |
| 产品 | 用户能看到 Host / 角色 / 用户 / 系统消息的差异化样式 |
| 产品 | 用户发送消息后，消息立即以 pending 状态出现在消息流中 |
| 产品 | Agent 生成中显示正在输入或生成中状态 |
| 产品 | Agent 回答完成后消息显示在消息流中 |
| 产品 | 消息气泡样式符合移动端原型，用户消息右侧，角色消息左侧 |
| 产品 | 当前发言角色在角色栏有视觉高亮 |
| 产品 | 网络或生成错误时，用户能看到错误并可重试 |
| 产品 | 返回首页再进入讨论页，当前会话消息仍可加载 |
| 产品 | More Sheet 可打开，但总结、投票、归档等后续能力不得误导为已真实完成 |
| 技术 | 消息接口返回结构符合本文档契约 |
| 技术 | 前端不直接操作消息数组作为唯一数据源，必须通过 Store / service 同步 |
| 技术 | 消息状态流转正确：pending / streaming → completed / failed |
| 技术 | `clientMessageId` 支持乐观展示、去重和重试 |
| 技术 | `activeSpeakerId` 驱动角色栏高亮 |
| 技术 | 不同 session 的消息不会串 |
| 技术 | 消息组件可复用，后续 EventCard、InviteCard 可插入同一消息流 |
| 技术 | UI 不直接调用 LLM Provider，不拼 Prompt，不实现调度 |
| 技术 | e2e 覆盖“创建会话 → 进入讨论 → 发送消息 → 看到回复” |
| 技术 | e2e 覆盖发送失败后展示错误并可重试 |

## 测试要求

| 测试类型 | 覆盖点 |
|---|---|
| 单元测试 | MessageBubble 按 type 渲染不同样式 |
| 单元测试 | RosterBar 根据 `activeSpeakerId` 高亮角色 |
| 单元测试 | DiscussionStore 合并消息、去重、失败更新 |
| 单元测试 | 空输入不能发送 |
| API 测试 | `GET /api/sessions/:sessionId` 返回 Header / Roster 所需字段 |
| API 测试 | `GET /messages` 支持排序、分页、session 隔离 |
| API 测试 | `POST /messages` 成功返回 userMessage、agentMessages、activeSpeakerId |
| API 测试 | 重复 `clientMessageId` 不重复追加消息 |
| API 测试 | MockLLM 失败时返回可解释错误 |
| e2e | 从首页创建会话进入讨论页，看到标题、模板、角色栏 |
| e2e | 发送消息后看到用户消息、Typing、Agent 回复 |
| e2e | 发送失败时显示错误和重试入口 |
| e2e | 返回首页再进入同一会话，消息仍可加载 |

## 不包含范围

| 不包含 | 说明 |
|---|---|
| 多阶段状态机完整推进 | 迭代 4 |
| 会话中心完整搜索、筛选、归档、恢复 | 迭代 4 |
| 快捷指令真实执行 | 迭代 5 |
| 用户意图识别 | 迭代 5 |
| 邀请用户真实逻辑 | 迭代 6 |
| 主持人真实总结 / 收束 | 迭代 6 |
| 爽点事件真实触发 | 迭代 7 |
| 投票接口与投票状态 | 迭代 7 |
| 模板/角色/模型策略配置 | 迭代 8 |
| Provider 设置和会话导出 | 迭代 9 |

## 需求评审关注点

1. 讨论页是否严格参照原型的移动端结构。
2. 消息流是否能承载后续事件卡和邀请卡。
3. 前端是否处理生成中、失败、重试状态。
4. API 是否支持消息状态，避免只返回字符串。
5. 乐观发送是否有 `clientMessageId` 去重机制。
6. 角色高亮是否由 `activeSpeakerId` 驱动，而不是 UI 临时推断。
7. More Sheet 是否严格控制为入口 / Mock，避免提前实现迭代 5-7 能力。
8. UI 是否保持展示层职责，不拼 Prompt、不调 LLM、不实现调度。

## 最终对齐验证

| 检查项 | 最终需求 | 蓝图 / 当前计划定义 | 状态 |
|---|---|---|---|
| 多 Agent 主线 | 消息流消费迭代 2 的 Agent 输出 | 多 Agent 讨论编排是产品核心 | ✅ 对齐 |
| 讨论 UI | Header、Roster、MessageStream、Composer、Typing、错误重试 | 蓝图讨论体验层包含消息流、角色栏、用户输入、事件卡、邀请卡 | ✅ 对齐 |
| UI / Engine 边界 | UI 只调 API / service / store，不直接拼 Prompt 或调 LLM | UI 不承担调度逻辑，LLM 调用统一封装 | ✅ 对齐 |
| 消息模型 | host、character、user、system；event/invite 预留 | 蓝图消息模块定义多类型消息和事件/邀请扩展 | ✅ 对齐 |
| 状态机 | 本迭代不做完整 phase 推进 | 重拆版计划迭代 4 实现状态机与会话生命周期 | ✅ 对齐 |
| 用户介入 | 只做普通消息输入，快捷指令不真实执行 | 重拆版计划迭代 5 实现用户介入与快捷指令 | ✅ 对齐 |
| 导演逻辑 | 不做邀请、总结、收束决策 | 重拆版计划迭代 6 实现导演逻辑 | ✅ 对齐 |
| 爽点事件 | 只预留 EventCard 插槽，不真实触发 | 重拆版计划迭代 7 实现爽点事件与投票 | ✅ 对齐 |
| 会话闭环 | 只保证当前 session 消息可重新加载 | 重拆版计划迭代 4/9 完整实现会话生命周期与导出 | ✅ 对齐 |
| 文档编号 | 当前迭代 3 = 讨论页消息流联动 | 旧蓝图/旧 iteration README 有历史编号残留 | ⚠️ 文档基线偏差，不阻塞本迭代开发；建议后续统一同步蓝图迭代表 |

结论：本修订版与产品核心主线无方向背离，可作为迭代 3 当前开发入口文档。旧蓝图中的迭代编号残留需要后续做一次文档基线同步，但不影响本迭代需求成立。
