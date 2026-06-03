# 迭代 8：模板、角色与模型策略

> 评审日期：2026-05-20  
> 评审结论：通过。模板页仍是一级 Tab；本修订补充模板选择影响新会话创建，并由新会话跳转到讨论详情页，而不是跳转独立讨论 Tab。  
> 修订来源：底部导航架构调整评审。  
> 导航基线：底部一级导航为 `首页 / 会话 / 模板 / 设置`；讨论页保留为 `/discussion/[sessionId]` 会话详情页，不作为一级 Tab。  
> 复评日期：2026-06-01  
> 复评结论：通过。最终需求与项目蓝图、当前导航基线及迭代 0-7 已完成主线无方向背离；本次补充模板/角色/模型策略 API 契约、会话快照边界、角色配置生效范围、模型策略消费路径与测试要求，无需更新蓝图。

---

## 迭代目标

完善模板中心和首页中的模板/模型策略能力，使产品从单一“三国军师团”扩展为可配置、可复用的多场景讨论产品。

本迭代将模板页、角色列表、事件规则和模型策略连接到真实数据。

## 导航与会话入口约束

| 约束 | 说明 |
|---|---|
| 模板页定位 | 模板页保留为 BottomNav 一级 Tab |
| 讨论页定位 | 模板选择不直接进入“讨论 Tab”，而是影响首页创建 session 时的 templateId |
| 新会话链路 | 首页选择模板和模型策略后创建 session，再进入 `/discussion/[sessionId]` |
| 历史会话 | 历史 session 使用创建时保存的 template snapshot，从会话页恢复进入讨论详情页 |

## 原型映射

| 原型区域 | 本迭代要求 |
|---|---|
| 模板中心 | 展示模板详情、使用次数、会话数、收藏数 |
| 模板 Tab | 概览、角色、事件、节奏 |
| 角色列表 | 展示角色名称、描述、模型、配置状态 |
| 配置角色 Sheet | 可调整角色模型、发言长度 |
| 首页模板 Sheet | 可选择不同模板 |
| 首页模型策略 Sheet | 可选择智能、质量优先、成本优先 |

## 前端需求

| 编号 | 需求 |
|---|---|
| FE-001 | 实现模板中心页面真实数据渲染 |
| FE-002 | 模板详情展示名称、描述、标签、使用数据 |
| FE-003 | 支持模板 Tab：概览、角色、事件、节奏 |
| FE-004 | 角色列表展示角色名称、人设、模型、状态 |
| FE-005 | 角色详情 Sheet 展示角色提示词和模型配置 |
| FE-006 | 角色配置 Sheet 支持调整默认模型和发言长度 |
| FE-007 | 首页模板选择 Sheet 使用模板 API 数据 |
| FE-008 | 首页模型策略 Sheet 使用策略配置数据 |
| FE-009 | 选择模板后，创建会话时使用对应 templateId，并在创建成功后进入 `/discussion/[sessionId]` |
| FE-010 | 选择模型策略后，创建会话时使用对应 strategyId |

## 后端/API需求

| 编号 | 需求 |
|---|---|
| BE-001 | 实现 `GET /api/templates` 获取模板列表 |
| BE-002 | 实现 `GET /api/templates/:templateId` 获取模板详情 |
| BE-003 | 实现 `GET /api/templates/:templateId/roles` 获取角色列表 |
| BE-004 | 实现 `GET /api/model-strategies` 获取模型策略 |
| BE-005 | 实现 `PATCH /api/templates/:templateId/roles/:roleId/config` 更新角色配置 |
| BE-006 | 模板数据包含 overview、roles、events、rhythm、modelDefaults |
| BE-007 | 模型策略包含质量、成本、速度、fallback 规则 |
| BE-008 | 会话创建时复制模板快照，避免后续模板变更影响历史会话 |
| BE-009 | 支持至少 3 个内置模板：三国军师团、创业公司董事会、产品辩论桌 |
| BE-010 | 支持模板版本号，预留后续动态下发能力 |

## 模板数据结构

```ts
interface DiscussionTemplate {
  id: string
  name: string
  version: string
  description: string
  category: string
  roles: AgentProfile[]
  events: EventRule[]
  rhythm: RhythmConfig
  modelDefaults: ModelDefaults
}
```

## 验收标准

| 类型 | 标准 |
|---|---|
| 产品 | 模板中心可展示模板详情 |
| 产品 | 模板中心可切换概览、角色、事件、节奏 Tab |
| 产品 | 角色列表展示完整角色信息 |
| 产品 | 首页可选择不同模板 |
| 产品 | 创建会话时使用用户选择的模板 |
| 产品 | 创建会话成功后进入携带 sessionId 的讨论详情页 |
| 产品 | 首页可选择模型策略 |
| 产品 | 模型策略影响后续 Agent 生成参数 |
| 产品 | 至少 3 个内置模板可用 |
| 技术 | 模板 API 返回结构稳定 |
| 技术 | 会话保存 template snapshot |
| 技术 | 角色配置变更不影响历史会话 |
| 技术 | ModelStrategy 能被 LLM 调用层消费 |
| 技术 | 单元测试覆盖模板加载和会话快照 |
| 技术 | e2e 覆盖选择模板后创建会话 |
| 技术 | 模板 Tab 数据不再依赖组件硬编码 |

## 不包含范围

| 不包含 | 说明 |
|---|---|
| 服务端模板动态下发/CDN | Phase 2 |
| 复杂模板编辑器 | 后续产品化 |
| 社区模板市场 | 后续版本 |

## 需求评审关注点

1. 模板是否是讨论能力的配置源，而不是纯展示页。
2. 会话是否保存模板快照，避免历史数据被污染。
3. 模型策略是否真正影响 LLM 参数。
4. 模板页是否严格覆盖原型中的概览、角色、事件、节奏。

---

## 需求评审记录（Iteration 8）

> 评审日期：2026-06-01  
> 评审结论：通过。最终需求与项目蓝图、当前导航基线及迭代 0-7 已完成能力无方向背离；无需更新蓝图。  
> 本次评审重点：确认模板是讨论能力的配置源，而不是纯展示页；首页选择模板和模型策略必须影响新 session 创建；历史 session 使用 template snapshot；角色配置只影响模板未来版本或新会话，不回写历史会话；模型策略必须能被 LLM 调用层消费。

### Step 3｜初步对齐检查

| 检查项 | 初始需求描述 | 蓝图 / 当前计划定义 | 状态 |
|---|---|---|---|
| 产品主线 | 模板中心、角色列表、事件规则、节奏配置和模型策略接入真实数据 | 蓝图定义模板是场景模板层核心，包含角色、事件规则、节奏和推荐模型；多模板和会话闭环位于核心主线后段 | ✅ 对齐 |
| 导航架构 | 模板页为 BottomNav 一级 Tab；讨论页为 `/discussion/[sessionId]` | 当前导航基线为 `首页 / 会话 / 模板 / 设置`，讨论页不是一级 Tab | ✅ 对齐 |
| 首页链路 | 首页选择模板和模型策略后创建 session，再进入讨论详情页 | 迭代 1 已定义 `POST /api/sessions` 入参包含 `topic`、`templateId`、`modelStrategyId`，首页不得自行构造 sessionId | ✅ 对齐 |
| 模板定位 | 模板页展示概览、角色、事件、节奏，并作为创建讨论的配置源 | 蓝图要求模板包含 worldview、roles、events、rhythm、推荐模型，是多角色讨论质量基础 | ✅ 对齐 |
| 角色配置 | 角色详情/配置 Sheet 可调整默认模型和发言长度 | 蓝图将角色配置 UI 作为后置能力；当前阶段允许最小可用配置，但不得扩展成复杂模板编辑器 | ✅ 对齐，需限定范围 |
| 模型策略 | 首页模型策略 Sheet 使用策略配置数据，创建会话时传入 strategyId | 蓝图要求 LLM 调用层统一封装，支持多 Provider、多模型适配；迭代 9 再做 Provider 设置 | ✅ 对齐，需明确不做 Provider 配置 |
| 历史会话 | 会话创建时复制 template snapshot，历史会话恢复使用创建时快照 | 蓝图要求本地会话保存和恢复上下文，Session 绑定 Template、Topic、EngineState、Messages 和 RuntimeConfig | ✅ 对齐 |
| 事件规则 | 模板事件 Tab 展示规则，讨论详情页事件真实触发在迭代 7 已实现 | 事件机制属于讨论引擎和爽点机制；模板只提供规则配置源 | ✅ 对齐 |
| 数据源 | 模板 Tab、首页模板 Sheet、模型策略 Sheet 均不再依赖组件硬编码 | 迭代 0 已建立 API / service / repository 边界，UI 不直接写业务逻辑 | ✅ 对齐 |
| 范围边界 | 不做服务端模板动态下发、复杂模板编辑器、社区模板市场 | 当前文档包明确复杂配置 UI、服务端模板动态下发、模板市场不纳入当前阶段 | ✅ 对齐 |

### Step 4｜需求评审意见

#### 1. 完整性

| 问题 | 评审意见 | 修订建议 |
|---|---|---|
| 模板列表与详情契约不足 | 现有 BE-001/BE-002 只列接口名，未定义列表摘要和详情完整字段，容易导致首页 Sheet、模板中心、会话创建使用不同结构 | 补充 `TemplateSummary` 与 `DiscussionTemplate` 的返回边界：列表返回摘要和使用数据；详情返回 overview、roles、events、rhythm、modelDefaults、version |
| 角色配置生效范围不够明确 | `PATCH /roles/:roleId/config` 若直接修改角色会污染历史 session 或当前运行中的 session | 角色配置只更新模板当前配置或产生模板配置版本；已创建 session 继续使用 template snapshot，不被回写 |
| 模型策略缺少可消费字段 | 只写质量、成本、速度、fallback 规则，不足以让 LLMClient / Scheduler 稳定消费 | 定义 `ModelStrategy` 最小字段：id、name、priority、defaultModel、roleOverrides、fallbackChain、temperature/maxTokens、costPolicy、speedPolicy |
| 会话创建快照缺少内容边界 | BE-008 要求保存快照，但未说明快照包含什么 | 快照至少包含 templateId、templateVersion、name、roles、events、rhythm、modelDefaults 和选中的 modelStrategyId / strategySnapshot |
| 首页与模板页选择关系需明确 | 模板中心的“使用模板”如果直接进入讨论页，会绕过 session 创建链路 | 模板页点击“使用模板”应回到首页并预选 templateId，或直接调用创建 session API；禁止无 sessionId 跳讨论页 |
| 事件规则与真实事件触发边界需防混淆 | 迭代 8 展示事件规则，但真实事件检测/投票已由迭代 7 管理 | 模板事件 Tab 只维护规则展示和模板配置，不在模板页触发 EventRecord 或投票 |
| 测试覆盖不足 | 现有验收有模板加载和会话快照，但缺少角色配置、生效范围、模型策略消费测试 | 增加单元测试和 e2e：角色配置不影响历史会话、模型策略进入 LLM 调用参数、模板页使用模板创建会话 |

#### 2. 合理性

| 检查点 | 结论 |
|---|---|
| 技术可行性 | 可行。迭代 0 已预留 templates API、Repository、Mock 模板数据和 engine 类型；迭代 1 已建立 session 创建入参；迭代 2-7 已建立 Agent、消息、状态、意图、Director 和事件链路。 |
| 产品范围 | 合理。迭代 8 位于核心讨论链路之后，接入多模板和模型策略不会拖慢前期 MVP 主线。 |
| API 范围 | 中等。模板列表、详情、角色列表、模型策略和角色配置接口可以覆盖本迭代；需避免引入模板市场、动态下发和复杂编辑器。 |
| UI 复杂度 | 中等。模板中心四个 Tab、角色 Sheet、首页模板 Sheet 和策略 Sheet 都要复用同一数据源，避免重复 Mock。 |
| 数据一致性 | 风险较高但可控。通过 template snapshot、template version、strategy snapshot 和 Repository 查询边界可以避免历史会话被污染。 |

#### 3. 一致性

| 对象 | 结论 |
|---|---|
| 与迭代 0 | 对齐。迭代 0 已建立 `/api/templates`、Mock Repository、Template/Role/Agent/Session 类型和模板页骨架。 |
| 与迭代 1 | 对齐。迭代 1 已定义首页选择默认模板/模型策略并通过 API 创建 session；本迭代把数据源从简化默认数据升级为真实模板/策略数据。 |
| 与迭代 2 | 对齐。迭代 2 的 AgentProfile、AgentRuntime、ContextBuilder 和 LLMClient 可以消费模板角色与模型默认值。 |
| 与迭代 3 | 对齐。讨论页消息流继续通过 sessionId 加载会话和角色，不直接依赖模板页组件状态。 |
| 与迭代 4 | 对齐。会话恢复依赖 session 数据和 template snapshot，模板变更不影响历史会话。 |
| 与迭代 5 | 对齐。用户指令中的目标角色识别需要稳定 roleId/name/alias，角色数据由模板提供。 |
| 与迭代 6 | 对齐。Director 可读取模板 rhythm、events 和角色信息，但模板页不承担 Director 决策。 |
| 与迭代 7 | 对齐。事件规则来自模板，真实事件检测、EventRecord 和投票仍发生在讨论详情页当前 session 内。 |
| 与迭代 9 | 有边界衔接。Provider/API Key/全局默认模型配置留给迭代 9；迭代 8 只定义和消费模型策略，不做 Provider 管理。 |

#### 4. 风险点

| 风险 | 等级 | 影响 | 应对 |
|---|---|---|---|
| 模板页变成复杂配置后台 | P0 | 偏离多 Agent 讨论主线，吞掉迭代 9 和后续模板编辑器范围 | 本迭代只做内置模板详情、角色轻配置、策略选择和创建链路，不做复杂编辑器 |
| 历史 session 被模板配置修改污染 | P0 | 用户恢复旧会话时角色、人设、事件规则变化，导致上下文不一致 | 创建 session 时保存 template snapshot 和 strategy snapshot；角色配置只影响新会话 |
| 模型策略只停留在 UI 展示 | P0 | 用户选择策略后 Agent 生成参数无变化，产品承诺落空 | 验收要求 ModelStrategy 被 LLMClient / AgentRuntime 消费，并进入调用日志或 debug 摘要 |
| 首页和模板页数据源不一致 | P1 | 首页可选模板与模板中心展示不一致 | 统一走 TemplateService / Repository，不允许组件硬编码模板列表 |
| template version 未参与快照 | P1 | 后续模板演进无法追踪历史会话来源 | session 保存 `templateId`、`templateVersion` 和 `snapshotCreatedAt` |
| 角色配置接口权限/范围不清 | P1 | 当前 session、模板默认配置、全局角色模型配置混用 | 接口命名和服务层明确为模板角色配置；Provider/全局模型配置后置到迭代 9 |
| 事件规则误触发 | P2 | 用户在模板页误以为事件可以直接执行 | 模板事件 Tab 只展示规则；真实事件只能在 `/discussion/[sessionId]` 内触发 |

### Step 5｜最终需求修订摘要

| 变更项 | 最终需求 | 原因 |
|---|---|---|
| API 契约 | 补充模板列表、模板详情、角色列表、模型策略、角色配置接口的请求/响应边界 | 支撑前后端并行开发，避免字段各自实现 |
| 会话快照 | 明确 session 创建时保存 template snapshot 和 strategy snapshot | 防止模板或策略后续修改污染历史会话 |
| 模型策略消费 | 明确 `ModelStrategy` 必须进入 AgentRuntime / LLMClient 参数决策 | 保证模型策略不是纯展示项 |
| 角色配置边界 | 角色配置只影响模板未来配置或新会话，不影响已创建 session | 保护历史会话一致性 |
| 模板使用链路 | 模板页“使用模板”必须通过首页预选或创建 session API，不得无 sessionId 进入讨论页 | 保持导航基线和会话创建唯一入口 |
| 事件规则边界 | 模板页只展示/配置事件规则，不创建真实事件记录 | 避免与迭代 7 事件机制职责冲突 |
| 测试要求 | 增加角色配置、模型策略消费、快照隔离、模板页使用模板创建会话的测试 | 保证本迭代不是纯视觉展示 |

### 补充 API 契约

#### `GET /api/templates`

获取模板列表，用于模板中心和首页模板选择 Sheet。

**Response**

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "templateId": "sanguo_advisors",
        "name": "三国军师团",
        "version": "1.0.0",
        "description": "基于三国谋士的多角色决策讨论模板",
        "category": "strategy",
        "tags": ["战略", "风险", "决策"],
        "roleCount": 5,
        "eventCount": 4,
        "usageCount": 12643,
        "sessionCount": 1243,
        "favoriteCount": 923,
        "isBuiltin": true
      }
    ]
  },
  "error": null,
  "requestId": "req_tpl_001"
}
```

#### `GET /api/templates/:templateId`

获取模板详情，用于模板中心四个 Tab 和会话创建快照。

**Response**

```json
{
  "success": true,
  "data": {
    "templateId": "sanguo_advisors",
    "version": "1.0.0",
    "name": "三国军师团",
    "description": "基于三国谋士的多角色决策讨论模板",
    "category": "strategy",
    "tags": ["战略", "风险", "决策"],
    "overview": {
      "worldview": "三国谋士围绕用户议题进行谋略讨论",
      "userIdentity": "主公 / 决策者",
      "bestFor": ["战略决策", "产品评审", "风险分析"]
    },
    "roles": [],
    "events": [],
    "rhythm": {
      "maxTurnsPerRole": 4,
      "maxCharsPerTurn": 200,
      "speakerDelayMs": 800
    },
    "modelDefaults": {
      "defaultModel": "mock-role-model",
      "temperature": 0.7,
      "maxTokens": 600
    }
  },
  "error": null,
  "requestId": "req_tpl_002"
}
```

#### `GET /api/templates/:templateId/roles`

获取角色列表，用于角色 Tab、角色详情 Sheet 和指令目标识别。

**Response**

```json
{
  "success": true,
  "data": {
    "templateId": "sanguo_advisors",
    "templateVersion": "1.0.0",
    "roles": [
      {
        "roleId": "zhuge_liang",
        "agentType": "expert",
        "name": "诸葛亮",
        "aliases": ["孔明", "亮"],
        "avatar": "亮",
        "persona": "擅长系统谋略和长期规划",
        "systemPrompt": "...",
        "model": "mock-role-model",
        "temperature": 0.7,
        "maxCharsPerTurn": 200,
        "visible": true,
        "configStatus": "configured"
      }
    ]
  },
  "error": null,
  "requestId": "req_tpl_roles_001"
}
```

#### `GET /api/model-strategies`

获取模型策略，用于首页模型策略 Sheet 和会话创建。

**Response**

```json
{
  "success": true,
  "data": {
    "strategies": [
      {
        "strategyId": "smart",
        "name": "智能策略",
        "description": "优先速度与成本，必要时切换强模型",
        "priority": ["speed", "cost", "quality"],
        "defaultModel": "mock-role-model",
        "roleOverrides": {},
        "fallbackChain": ["mock-role-model", "mock-strong-model"],
        "temperature": 0.7,
        "maxTokens": 600,
        "costPolicy": "balanced",
        "speedPolicy": "fast_first"
      },
      {
        "strategyId": "quality_first",
        "name": "质量优先",
        "description": "优先使用强模型，成本较高",
        "priority": ["quality", "speed", "cost"],
        "defaultModel": "mock-strong-model",
        "roleOverrides": {},
        "fallbackChain": ["mock-strong-model", "mock-role-model"],
        "temperature": 0.7,
        "maxTokens": 800,
        "costPolicy": "quality_first",
        "speedPolicy": "normal"
      },
      {
        "strategyId": "cost_first",
        "name": "成本优先",
        "description": "优先使用低成本模型",
        "priority": ["cost", "speed", "quality"],
        "defaultModel": "mock-cheap-model",
        "roleOverrides": {},
        "fallbackChain": ["mock-cheap-model", "mock-role-model"],
        "temperature": 0.6,
        "maxTokens": 500,
        "costPolicy": "minimize_cost",
        "speedPolicy": "fast_first"
      }
    ]
  },
  "error": null,
  "requestId": "req_strategy_001"
}
```

#### `PATCH /api/templates/:templateId/roles/:roleId/config`

更新模板角色配置。该接口只影响模板未来配置或新创建 session，不修改任何已创建 session 的 template snapshot。

**Request**

```json
{
  "model": "mock-strong-model",
  "temperature": 0.6,
  "maxCharsPerTurn": 240
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "templateId": "sanguo_advisors",
    "templateVersion": "1.0.1",
    "roleId": "zhuge_liang",
    "config": {
      "model": "mock-strong-model",
      "temperature": 0.6,
      "maxCharsPerTurn": 240
    },
    "effectScope": "future_sessions_only"
  },
  "error": null,
  "requestId": "req_role_cfg_001"
}
```

**错误码**

| code | 场景 | 前端处理 |
|---|---|---|
| `TEMPLATE_NOT_FOUND` | 模板不存在 | 展示模板不存在，引导刷新模板列表 |
| `ROLE_NOT_FOUND` | 角色不存在 | 提示当前模板无该角色 |
| `MODEL_STRATEGY_NOT_FOUND` | 模型策略不存在 | 回退默认智能策略，并提示用户重新选择 |
| `INVALID_ROLE_CONFIG` | 角色配置非法 | 标出具体字段错误 |
| `TEMPLATE_VERSION_CONFLICT` | 模板版本冲突 | 提示用户刷新后重试 |
| `SNAPSHOT_CREATE_FAILED` | 创建会话时快照失败 | 中断创建并提示重试 |

### 补充数据结构

#### `TemplateSnapshot`

```ts
interface TemplateSnapshot {
  templateId: string
  templateVersion: string
  snapshotCreatedAt: string
  name: string
  description: string
  roles: AgentProfile[]
  events: EventRule[]
  rhythm: RhythmConfig
  modelDefaults: ModelDefaults
}
```

#### `ModelStrategy`

```ts
interface ModelStrategy {
  strategyId: string
  name: string
  description: string
  priority: Array<'quality' | 'cost' | 'speed'>
  defaultModel: string
  roleOverrides: Record<string, Partial<ModelDefaults>>
  fallbackChain: string[]
  temperature?: number
  maxTokens?: number
  costPolicy: 'balanced' | 'quality_first' | 'minimize_cost'
  speedPolicy: 'fast_first' | 'normal'
}
```

#### `SessionRuntimeConfig`

```ts
interface SessionRuntimeConfig {
  templateSnapshot: TemplateSnapshot
  modelStrategyId: string
  strategySnapshot: ModelStrategy
}
```

### 最终需求补充

#### 前端补充

| 编号 | 需求 |
|---|---|
| FE-011 | 模板页“使用模板”必须通过首页预选或调用创建 session API，成功后进入 `/discussion/[sessionId]`，不得无 sessionId 进入讨论页 |
| FE-012 | 模板事件 Tab 只展示事件规则，不触发真实事件、不提交投票 |
| FE-013 | 角色配置提交成功后需提示“仅影响后续新会话”，并不得刷新或改写历史会话中的角色信息 |
| FE-014 | 首页模板 Sheet 与模板中心必须复用同一 TemplateService 数据源 |
| FE-015 | 模型策略 Sheet 选择结果需要在创建 session 请求中携带，并在失败时回退默认智能策略或提示用户重选 |

#### 后端/API/引擎补充

| 编号 | 需求 |
|---|---|
| BE-011 | `POST /api/sessions` 创建会话时必须保存 `templateSnapshot` 与 `strategySnapshot` |
| BE-012 | `GET /api/sessions/:sessionId` 返回历史会话时优先使用 session 内的 template snapshot，而不是实时模板详情 |
| BE-013 | `AgentRuntime` / `LLMClient` 必须消费 `strategySnapshot`，决定默认模型、fallback、temperature 和 maxTokens |
| BE-014 | `PATCH /roles/:roleId/config` 只影响模板未来配置或新会话，不能修改已有 session snapshot |
| BE-015 | `TemplateService`、`ModelStrategyService`、`SessionService` 分工明确：模板负责配置源，策略负责模型选择，Session 负责快照和运行时配置 |

#### 验收标准补充

| 类型 | 标准 |
|---|---|
| 产品 | 模板页点击“使用模板”后可创建或预选该模板的新会话，并最终进入携带 sessionId 的讨论详情页 |
| 产品 | 角色配置后有明确提示：配置仅影响后续新会话 |
| 产品 | 模板事件 Tab 展示事件规则，但不会在模板页触发当前会话事件 |
| 技术 | 创建 session 时保存 template snapshot 和 strategy snapshot |
| 技术 | 修改模板角色配置后，已创建 session 的角色、人设、事件规则不变化 |
| 技术 | LLM 调用参数能体现所选 ModelStrategy 的默认模型、fallback、temperature 或 maxTokens |
| 技术 | 单元测试覆盖模板列表、模板详情、角色配置、模型策略加载、快照隔离 |
| 技术 | e2e 覆盖从模板页使用模板创建会话，以及首页切换模型策略后创建会话 |

### Step 6｜最终对齐验证

| 检查项 | 最终需求 | 蓝图 / 当前计划定义 | 状态 |
|---|---|---|---|
| 多 Agent 主线 | 模板、角色、事件规则和模型策略服务于多角色讨论运行 | 产品核心是多 Agent 讨论编排、角色化观点输出、导演式节奏控制 | ✅ 对齐 |
| 模板模块职责 | 模板包含概览、角色、事件、节奏、模型默认值和版本 | 蓝图模板模块包含世界观、角色、事件规则、节奏配置和推荐模型 | ✅ 对齐 |
| 角色模块职责 | 角色数据包含人设、Prompt、模型配置和可见性 | 蓝图角色模块要求角色服务于讨论和决策，包含 personality、systemPrompt、model、temperature 等字段 | ✅ 对齐 |
| 模型策略 | 策略进入 LLM 调用参数，而不是纯 UI 展示 | 蓝图要求 LLM 调用层统一封装，并支持模型适配 | ✅ 对齐 |
| 会话闭环 | 新会话保存 template snapshot 和 strategy snapshot，历史会话可稳定恢复 | 蓝图要求本地会话保存和恢复讨论上下文 | ✅ 对齐 |
| 导航基线 | 模板页是一级 Tab，讨论页必须携带 sessionId | 当前导航基线为 `首页 / 会话 / 模板 / 设置`，讨论页为 `/discussion/[sessionId]` | ✅ 对齐 |
| 事件边界 | 模板页只展示事件规则，真实事件发生在当前 session 讨论详情页 | 迭代 7 已定义事件检测、EventRecord 和投票绑定 sessionId | ✅ 对齐 |
| 配置边界 | 只做最小角色配置，不做复杂模板编辑器、模板市场或动态下发 | 当前阶段边界排除复杂配置 UI、服务端模板动态下发和模板市场 | ✅ 对齐 |
| Provider 边界 | 不做 API Key、Provider 连接和全局默认模型设置 | 迭代 9 负责设置、Provider 与数据闭环 | ✅ 对齐 |

结论：最终需求与项目蓝图和当前导航基线无方向背离，属于情况 A。已直接更新 `iteration-8-template-role-model-strategy.md`，无需同步更新 `00-product-blueprint.md`。
