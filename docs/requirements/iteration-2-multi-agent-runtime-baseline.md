# 迭代 2：多 Agent 运行时基础架构

> 评审日期：2026-05-19  
> 评审结论：条件通过。迭代 2 与产品蓝图主线一致，可进入开发；本修订版补充 API 契约、Agent 调用日志、MockLLM 验收、Scheduler 扩展口、Critic 定位和前端范围边界，避免实现阶段范围漂移。  
> 修订来源：Iteration 2 需求评审。  
> 文档基线：以 `iteration-2-multi-agent-runtime-baseline.md` 为当前开发入口；旧版 `iteration-2-multi-agent-architecture.md` 仅作架构参考，不作为开发入口。

---

## 评审修订摘要

| 变更项 | 修订内容 | 原因 |
|---|---|---|
| API 契约 | 补充 3 个核心接口的请求/响应结构 | 避免前后端在 02-design / 03-test-cases 阶段契约不一致 |
| Agent 调用日志 | 明确 `AgentCallLog` 最小字段 | 支撑调试、失败定位、成本统计和后续 Director 复盘 |
| MockLLM | 明确测试环境默认使用 MockLLM，且输出需稳定可预测 | 避免自动化测试依赖真实模型，降低波动 |
| Scheduler | 增加 `selectSpeakers` 扩展口，不把轮转策略写死 | 为迭代 4 状态机、迭代 5 用户意图、迭代 6 导演逻辑预留接入点 |
| Critic Agent | 明确本迭代 Critic 是可见的风险/反对型角色 | 避免提前引入隐藏裁判、质量评估等超范围能力 |
| 前端范围 | 明确本迭代只做运行时验证页/基础联动，不做正式消息流完整体验 | 避免与迭代 3 讨论页消息流联动范围重叠 |
| 不包含范围 | 补充模板配置、角色配置、事件真实触发等后置边界 | 控制迭代 2 范围，聚焦多 Agent 运行时 |

---

## 迭代目标

建立产品的核心智能架构：多 Agent 讨论运行时。完成 Host Agent、Expert Agent、Critic Agent 的基础抽象，实现多个角色围绕同一议题串行发言。

本迭代重点在后端/API/引擎能力，前端只需完成讨论页基础联动，用于验证多 Agent 运行时是否可用。

本迭代不追求完整讨论页 UI 体验，不实现正式消息流高级交互、状态机、用户意图识别、导演逻辑和爽点事件。

## 原型映射

| 原型区域 | 本迭代要求 |
|---|---|
| 讨论页角色栏 | 能展示模板中的主持人和至少 3 个角色 |
| 讨论页消息流 | 能展示 Host 开场和第一轮多角色发言 |
| 讨论页标题 | 显示当前会话议题和模板名称 |
| 发送输入 | 支持基础消息提交，并触发下一条角色回应 |
| Loading / Typing | Agent 生成中有基础状态提示 |
| Error / Retry | LLM 或运行时失败时展示错误和重试入口 |
| 事件卡/邀请卡 | 仅保留 Mock 容器，不要求真实触发 |

## 前端需求

| 编号 | 需求 |
|---|---|
| FE-001 | 讨论页通过 `sessionId` 加载会话详情 |
| FE-002 | 展示会话标题、模板名称、角色栏 |
| FE-003 | 展示 Host Agent 开场消息 |
| FE-004 | 展示多个角色的基础发言消息 |
| FE-005 | 用户发送消息后，页面展示用户消息和系统生成的下一条角色消息 |
| FE-006 | 消息气泡区分主持人、角色、用户 |
| FE-007 | 当前发言角色在角色栏高亮 |
| FE-008 | 生成中显示 Loading 或 Typing 状态 |
| FE-009 | LLM 失败时展示错误提示和重试入口 |
| FE-010 | 页面预留 EventCard 和 InviteCard 容器 |
| FE-011 | 本迭代前端定位为运行时验证页/基础讨论联动，不做完整消息流高级体验 |
| FE-012 | 页面不得直接调用 LLM Provider，必须通过 API / Service / Engine |

## 后端/API/引擎需求

| 编号 | 需求 |
|---|---|
| BE-001 | 实现 `GET /api/sessions/:sessionId` 获取会话详情 |
| BE-002 | 实现 `GET /api/discussions/:sessionId/messages` 获取消息列表 |
| BE-003 | 实现 `POST /api/discussions/:sessionId/messages` 发送用户消息并触发下一轮 Agent 发言 |
| BE-004 | 实现 `AgentProfile`：角色身份、人设、Prompt、模型、温度 |
| BE-005 | 实现 `AgentRuntime`：接收上下文并生成 `AgentOutput` |
| BE-006 | 实现 `DiscussionOrchestrator`：统一调度 Host、Expert、Critic |
| BE-007 | 实现基础 `Scheduler`：默认串行轮转角色，避免同一角色连续发言 |
| BE-008 | 实现上下文构造：topic、template、role prompt、message history，并限制上下文长度 |
| BE-009 | 实现 LLM Client 统一入口；支持 MockLLM 和真实 Provider 两种模式 |
| BE-010 | 记录 Agent 调用结果，包括 session、message、agent、provider、model、输入摘要、输出、耗时、状态、错误 |
| BE-011 | 本迭代默认自研轻量 Agent 编排，不引入 LangGraph/AutoGen/CrewAI 作为主依赖 |
| BE-012 | 预留并行 Agent 接口，但默认采用串行执行 |
| BE-013 | Critic Agent 在本迭代定义为可见的风险/反对型角色，不作为隐藏裁判或质量评估器 |
| BE-014 | Scheduler 必须提供可扩展选择接口，后续可接入状态机、用户意图和 Director |
| BE-015 | MockLLM 输出必须稳定、可预测，并体现不同角色差异 |

## Agent 架构基线

```text
User Topic
  ↓
SessionService
  ↓
DiscussionOrchestrator
  ├─ HostAgent
  ├─ ExpertAgent[]
  └─ CriticAgent
  ↓
Scheduler
  ↓
ContextBuilder
  ↓
LLMClient / MockLLMClient
  ↓
Message Repository
  ↓
AgentCallLog Repository
```

## Agent 职责边界

| Agent | 本迭代职责 | 不承担职责 |
|---|---|---|
| HostAgent | 生成开场消息、说明议题和讨论规则 | 不做完整收束总结，不做 Director 决策 |
| ExpertAgent | 按角色人设围绕议题输出观点 | 不做用户意图识别，不直接决定流程 |
| CriticAgent | 作为可见风险/反对型角色提出质疑、风险和反例 | 不做隐藏裁判，不做质量评分，不替代 Director |

## Scheduler 扩展口要求

本迭代可以使用简单串行调度，但不得把轮转逻辑写死在 UI 或业务流程中。建议保留如下接口形态：

```ts
interface SpeakerSelectionInput {
  sessionId: string
  roles: AgentProfile[]
  messageHistory: Message[]
  roundIndex: number
  lastSpeakerId?: string | null
  policy?: SchedulerPolicy
}

interface SpeakerSelectionResult {
  speakerIds: string[]
  reason: string
}

interface Scheduler {
  selectSpeakers(input: SpeakerSelectionInput): SpeakerSelectionResult
}
```

默认策略要求：

| 规则 | 说明 |
|---|---|
| 主持人优先 | 新会话或空消息时 HostAgent 先开场 |
| 串行执行 | 本迭代默认一次只选择一个 speaker |
| 避免重复 | 默认不允许同一角色连续发言 |
| 至少 3 角色 | 一轮讨论至少覆盖 3 个非主持角色 |
| 可扩展 | 后续可接入 phase、intent、director decision |

## API 契约

### `GET /api/sessions/:sessionId`

获取会话详情。

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

获取指定会话的消息列表。

**Query**

| 参数 | 必填 | 说明 |
|---|---:|---|
| `limit` | 否 | 默认 50 |
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

| code | 场景 |
|---|---|
| `SESSION_NOT_FOUND` | 会话不存在 |
| `MESSAGE_EMPTY` | 用户消息为空 |
| `TEMPLATE_NOT_FOUND` | 会话绑定模板不存在 |
| `NO_AVAILABLE_AGENT` | 没有可调度角色 |
| `LLM_PROVIDER_ERROR` | 真实 Provider 调用失败 |
| `AGENT_GENERATION_FAILED` | Agent 生成失败 |

## 核心数据结构

### `AgentProfile`

```ts
interface AgentProfile {
  agentId: string
  roleId: string
  agentType: 'host' | 'expert' | 'critic'
  name: string
  persona: string
  systemPrompt: string
  model: string
  temperature: number
  visible: boolean
}
```

### `AgentOutput`

```ts
interface AgentOutput {
  agentId: string
  roleId: string
  messageType: 'host' | 'character'
  content: string
  metadata?: {
    roundIndex?: number
    isMock?: boolean
    promptTokens?: number
    completionTokens?: number
    durationMs?: number
  }
}
```

### `AgentCallLog`

```ts
interface AgentCallLog {
  id: string
  sessionId: string
  runId: string
  messageId?: string
  agentId: string
  roleId: string
  provider: string
  model: string
  inputSummary: string
  outputSummary?: string
  output?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  cost?: number
  durationMs: number
  status: 'success' | 'failed'
  errorCode?: string
  errorMessage?: string
  createdAt: string
}
```

### `ContextBuilderInput`

```ts
interface ContextBuilderInput {
  sessionId: string
  topic: string
  templateName: string
  role: AgentProfile
  messageHistory: Message[]
  maxMessages?: number
  maxChars?: number
}
```

上下文构造要求：

| 要求 | 说明 |
|---|---|
| 必须包含 topic | 保证所有角色围绕同一议题发言 |
| 必须包含 role prompt | 保证角色差异 |
| 必须包含必要历史消息 | 保证上下文连续 |
| 必须限制长度 | 防止 token 无限增长 |
| 不允许 UI 拼 Prompt | Prompt 构造必须在 Engine / Service 层完成 |

## MockLLM 验收要求

| 编号 | 要求 |
|---|---|
| MOCK-001 | 测试环境默认使用 MockLLM，不依赖真实 API Key |
| MOCK-002 | MockLLM 对相同输入返回稳定结果，便于快照测试和 e2e |
| MOCK-003 | 不同角色必须输出不同语气和观点，不能只是替换角色名 |
| MOCK-004 | MockLLM 支持模拟失败，用于验证错误提示和重试入口 |
| MOCK-005 | MockLLM 输出需要覆盖 Host、Expert、Critic 三类 Agent |

## 验收标准

| 类型 | 标准 |
|---|---|
| 产品 | 一个会话中至少能看到主持人和 3 个角色 |
| 产品 | 点击开始讨论后，主持人能发出开场消息 |
| 产品 | 多个角色能围绕同一议题输出不同观点 |
| 产品 | 用户发送消息后，系统能继续生成角色回应 |
| 产品 | 角色发言不能全部像同一个人，至少体现角色差异 |
| 产品 | Critic 角色能作为可见风险/反对型角色提出质疑 |
| 产品 | 生成中用户能看到 Loading 或 Typing 状态 |
| 产品 | 生成失败时用户可看到明确错误提示并可重试 |
| 技术 | Orchestrator、Scheduler、AgentRuntime、ContextBuilder 模块存在且职责清晰 |
| 技术 | UI 不直接调用 LLM，必须通过 API/Service/Engine |
| 技术 | 支持 MockLLM 模式，测试环境无需真实 API Key |
| 技术 | MockLLM 输出稳定、可预测，并体现角色差异 |
| 技术 | 消息按 sessionId 正确隔离 |
| 技术 | 每次 Agent 生成都有 AgentCallLog 记录 |
| 技术 | Scheduler 避免同一角色连续发言 |
| 技术 | ContextBuilder 有上下文长度限制 |
| 技术 | API 返回结构符合本文档契约 |
| 技术 | 单元测试覆盖角色调度、上下文构造、MockLLM 输出、Orchestrator 基础流程 |

## 测试要求

| 测试类型 | 覆盖点 |
|---|---|
| 单元测试 | Scheduler 默认选择逻辑 |
| 单元测试 | Scheduler 避免同一角色连续发言 |
| 单元测试 | ContextBuilder 拼接 topic、template、role prompt、message history |
| 单元测试 | ContextBuilder 超长历史截断 |
| 单元测试 | MockLLM Host / Expert / Critic 输出 |
| 单元测试 | Orchestrator 完成 Host 开场和角色发言 |
| 单元测试 | AgentCallLog 成功和失败记录 |
| API 测试 | `GET /api/sessions/:sessionId` 返回契约 |
| API 测试 | `GET /api/discussions/:sessionId/messages` 返回契约 |
| API 测试 | `POST /api/discussions/:sessionId/messages` 成功和失败场景 |
| e2e | 创建会话后进入讨论页，看到 Host 和至少 3 个角色 |
| e2e | 用户发送消息后看到用户消息和角色回应 |
| e2e | MockLLM 失败时显示错误和重试入口 |

## 不包含范围

| 不包含 | 说明 |
|---|---|
| 完整状态机 | 迭代 4 实现 |
| 用户意图识别 | 迭代 5 实现 |
| 导演逻辑 | 迭代 6 实现 |
| 爽点事件真实触发 | 迭代 7 实现 |
| 正式 EventCard / InviteCard 交互 | 迭代 6 / 7 实现 |
| 讨论页完整消息流高级体验 | 迭代 3 实现 |
| 模板配置 UI | 迭代 8 实现 |
| Provider 设置 UI | 迭代 9 实现 |
| 隐藏裁判 / 质量评分 Agent | 后续视产品效果再评估 |
| 并行 Agent 执行 | 仅预留接口，本迭代默认串行 |

## 需求评审关注点

1. 是否采用自研轻量 Agent 架构，而不是过早引入复杂开源 Agent 框架。
2. Host / Expert / Critic 是否有明确职责。
3. Critic 是否被限定为可见风险/反对型角色，避免超出本迭代范围。
4. 上下文拼接是否可控，避免 token 无限增长。
5. MockLLM 是否能支撑自动化测试。
6. API 契约是否足够明确，能支撑前后端并行开发。
7. Agent 调用日志是否足够支撑调试和后续复盘。
8. 多 Agent 运行时是否可以被后续状态机、导演逻辑和事件机制复用。

## 最终对齐验证

| 检查项 | 最终需求 | 蓝图定义 | 状态 |
|---|---|---|---|
| 多 Agent 主线 | Host / Expert / Critic 串行讨论 | 多 Agent 讨论编排是产品核心 | ✅ 对齐 |
| 多角色要求 | 主持人 + 至少 3 个角色 | MVP 至少主持人 + 3 个以上角色 | ✅ 对齐 |
| 自研编排 | 自研轻量 Orchestrator | 不过早引入复杂 Agent 框架 | ✅ 对齐 |
| UI / Engine 边界 | UI 只调 API/Service/Engine | UI 不承担调度逻辑 | ✅ 对齐 |
| LLM 封装 | 统一 LLMClient / MockLLMClient | 业务组件不得直接调 Provider | ✅ 对齐 |
| 状态机 | 本迭代不做，仅预留接入 | 蓝图要求 MVP 有状态机，后续迭代实现 | ✅ 对齐 |
| 导演逻辑 | 本迭代不做，仅预留接入 | 蓝图要求 Director 后续实现 | ✅ 对齐 |
| 爽点事件 | Mock 占位，不真实触发 | 后续迭代实现事件机制 | ✅ 对齐 |
| 配置 UI | 不做模板/模型/角色配置 UI | 配置 UI 不应拖慢核心体验 | ✅ 对齐 |

结论：本修订版与项目蓝图无产品方向背离，可作为迭代 2 当前开发入口文档。
