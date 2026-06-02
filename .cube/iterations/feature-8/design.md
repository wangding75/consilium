# 迭代 8 技术设计：模板、角色与模型策略

## 1. 概述

本次设计采用用户确认的“完整服务端数据模型方案”：在不引入真实数据库和外部 Provider 配置的前提下，把模板、模板版本、角色配置、模型策略、会话快照抽象为稳定的服务端领域模型，并通过 Next.js Route Handler、Service、Repository 边界向首页、模板中心、会话创建、会话恢复和讨论运行时提供统一数据源。

整体方案：

1. 扩展 `src/types` 中的模板、角色、策略、快照、AgentCallLog 与 API DTO 契约。
2. 扩展 TemplateRepository / TemplateService，支持模板摘要、详情、角色列表、角色配置版本更新。
3. 新增 ModelStrategyRepository / ModelStrategyService，支持服务端策略查询、策略快照和运行时策略解析。
4. 会话创建时保存深拷贝的 `templateSnapshot` 与 `strategySnapshot`，历史会话恢复优先使用快照。
5. DiscussionService 和 AgentRuntime 从会话快照与策略快照生成 AgentProfile / LLMConfig，不再只使用硬编码默认模型。
6. 首页与模板页从 API 加载真实数据，并提供 loading、empty、error、retry、save success、save failure 等 UI 状态。
7. 模板页“使用模板”不直接进入讨论页，而是进入首页预选模板的创建链路。

核心约束：

- 不引入真实 SQL 数据库；Table Design 使用逻辑服务端表/集合形式描述，当前实现落在 Mock Repository，后续可迁移到 DB。
- 不实现复杂模板编辑器、模板市场、远程动态下发、Provider/API Key 配置。
- 角色配置只影响模板未来版本或新会话，不回写任何已创建 session 的快照。
- 所有 API 继续遵循 `ApiResponse<T>` envelope 和现有 `ServiceError` 错误处理风格。
- `modelStrategyId` 在创建会话请求中继续兼容可选；缺省时服务端使用 active 默认策略 `smart`，并在响应和 session.strategySnapshot 中显式记录 `selectedByDefault: true`。

## 2. Impact Analysis

| 模块/文件 | 影响类型 | 影响说明 |
|---|---|---|
| `src/types/index.ts` | 修改 | 扩展 Template、Role、Session、AgentProfile、LLMConfig、AgentCallLog，新增模板版本、角色配置、策略、快照、运行时解析类型。 |
| `src/types/api.ts` | 修改 | 新增模板摘要/详情/角色/策略/角色配置/会话列表 API DTO，扩展 CreateSessionParams、CreateSessionResult 和 SessionDetailResult。 |
| `src/data/templates/three-kingdoms.ts` | 修改 | 补充模板版本、分类、标签、使用数据、overview、modelDefaults、角色配置字段。 |
| `src/data/templates/startup-board.ts` | 新增 | 内置“创业公司董事会”模板。 |
| `src/data/templates/product-debate.ts` | 新增 | 内置“产品辩论桌”模板。 |
| `src/data/templates/index.ts` | 新增 | 统一导出内置模板集合。 |
| `src/data/model-strategies.ts` | 修改 | 从简单 UI 数据升级为完整 ModelStrategy 配置。 |
| `src/server/repositories/template.repository.ts` | 修改 | 扩展模板摘要、详情、角色列表、角色配置更新接口。 |
| `src/server/repositories/model-strategy.repository.ts` | 新增 | 定义模型策略 Repository 接口。 |
| `src/server/repositories/mock/mock-template.repository.ts` | 修改 | 支持多模板、版本化角色配置、模板摘要/详情查询；角色配置更新必须不可变并深拷贝旧版本。 |
| `src/server/repositories/mock/mock-model-strategy.repository.ts` | 新增 | 提供内置模型策略 Mock Repository。 |
| `src/server/repositories/mock/mock-session.repository.ts` | 修改 | 保存并查询包含快照的 Session，不修改历史快照。 |
| `src/server/repositories/mock/instances.ts` | 修改 | 增加 sharedModelStrategyRepo。 |
| `src/server/services/template.service.ts` | 修改 | 增加模板摘要、详情、角色和配置更新服务。 |
| `src/server/services/model-strategy.service.ts` | 新增 | 增加策略查询、快照、运行时解析服务。 |
| `src/server/services/session.service.ts` | 修改 | 创建会话保存 templateSnapshot/strategySnapshot，缺省策略记录 selectedByDefault。 |
| `src/server/services/discussion.service.ts` | 修改 | 会话详情、意图识别、发言运行时优先使用会话快照与策略快照。 |
| `src/engine/agent-runtime.ts` | 修改 | AgentRuntime 接收并传递策略解析后的 model、temperature、maxTokens。 |
| `src/app/api/templates/route.ts` | 修改 | 返回模板摘要 envelope，而非裸 Template[]；同步更新所有现有调用点和相关测试。 |
| `src/app/api/templates/[templateId]/route.ts` | 新增 | 返回模板详情。 |
| `src/app/api/templates/[templateId]/roles/route.ts` | 新增 | 返回模板角色列表。 |
| `src/app/api/templates/[templateId]/roles/[roleId]/config/route.ts` | 新增 | PATCH 角色轻量配置。 |
| `src/app/api/model-strategies/route.ts` | 新增 | 返回模型策略列表。 |
| `src/app/api/sessions/route.ts` | 修改 | GET 返回会话列表 DTO；POST 创建会话入参/响应包含策略与快照结果，错误码扩展。 |
| `src/app/api/sessions/[sessionId]/route.ts` | 修改 | 会话详情返回快照模板和策略信息。 |
| `src/modules/home/index.tsx` | 修改 | 首页从 API 加载模板与策略，创建会话携带真实选择；支持 URL query 预选模板。 |
| `src/modules/templates/index.tsx` | 修改 | 模板中心从 API 加载真实数据，支持 Tab、角色详情、角色配置和“使用模板”。 |
| `src/modules/sessions/index.tsx` | 修改 | 会话列表展示模板快照摘要。 |

### 接口兼容性分析

- `GET /api/templates` 现有返回 `Template[]`，本次改为 `{ templates: TemplateSummary[] }`。这是内部 API 响应结构变更；必须同步首页、模板页、现有 API route 测试和模板模块测试。无外部公开兼容要求。
- `POST /api/sessions` 现有 `topic/templateId/modelStrategyId` 入参保持兼容；`modelStrategyId` 缺省时服务端选择默认 active 策略并在响应中标明默认选择。**Breaking Change**：现有 `CreateSessionResult.template.id` 字段重命名为 `templateId`，并新增 `version` 和 `modelStrategy` 字段；必须同步更新所有现有 `POST /api/sessions` 消费者和测试（含 session-service.test.ts、api.test.ts）。
- `GET /api/sessions` 从裸 `Session[]` 变为 `SessionListResult`，提供受约束的列表 DTO，避免 UI 直接依赖内部 Session 快照结构。
- `GET /api/sessions/:sessionId` 现有会话详情保留 `template`、`roles` 字段，同时新增 `modelStrategy`，并让 `template/roles` 来源改为快照优先。
- 新增 API 不影响现有调用方。

### 数据兼容性分析

- Session 新增 `templateSnapshot`、`strategySnapshot`、`snapshotCreatedAt` 字段；旧 session 读取时允许字段缺失，并在列表和详情响应中以 `fromSnapshot: false` 与 `fallbackReason` 标识兜底来源。
- 模板新增版本、可见性和可配置字段；旧模板数据通过 Mock Repository normalize 为完整结构。
- 角色配置更新通过新模板版本表达；Mock Repository 版本号按 patch 次数确定性递增 patch 版本，例如 `1.0.0 -> 1.0.1 -> 1.0.2`。
- Mock Repository 必须保留旧模板版本对象或保证已创建 session 持有深拷贝快照；禁止用可变引用污染历史会话。

## 3. Flow Design

### 3.1 首页加载与创建会话流程

```text
HomeModule mount
  -> 并行 GET /api/templates 与 GET /api/model-strategies
  -> 如果 URL query 有 templateId 且在列表中可用，则预选该模板
  -> 用户选择 templateId / modelStrategyId
  -> 用户输入 topic 并提交
  -> POST /api/sessions { topic, templateId, modelStrategyId? }
  -> SessionService 校验 topic/template/strategy
  -> 若 modelStrategyId 缺省，ModelStrategyService 选择默认 active 策略 smart，并记录 selectedByDefault
  -> TemplateService/Repository 读取模板详情
  -> ModelStrategyService/Repository 读取策略详情
  -> 创建深拷贝 templateSnapshot + strategySnapshot
  -> SessionRepository.save(session with snapshots)
  -> 返回 sessionId、template/version、modelStrategy/selectedByDefault
  -> HomeModule router.push(/discussion/{sessionId})
```

异常流程：

- topic 为空或超过长度：返回 `TOPIC_REQUIRED` / `TOPIC_TOO_LONG`。
- 请求体 JSON 无效或字段类型错误：返回 `INVALID_REQUEST`。
- templateId 不存在：返回 `TEMPLATE_NOT_FOUND`。
- 模板不可见或不可用于创建：返回 `TEMPLATE_UNAVAILABLE`。
- modelStrategyId 不存在：返回 `MODEL_STRATEGY_NOT_FOUND`。
- 策略 inactive：返回 `MODEL_STRATEGY_UNAVAILABLE`。
- modelStrategyId 缺省且默认策略不可用：返回 `MODEL_STRATEGY_REQUIRED`。
- API 网络失败：HomeModule 显示用户可读错误，不跳转。

### 3.2 模板中心、使用模板与角色配置流程

```text
TemplatesModule mount
  -> GET /api/templates
  -> 选中第一个 visible 模板
  -> GET /api/templates/{templateId}
  -> GET /api/templates/{templateId}/roles
  -> 用户切换概览/角色/事件/节奏 Tab
  -> 用户点击“使用模板”
  -> TemplatesModule router.push('/?templateId={templateId}')
  -> HomeModule 预选该 templateId，由首页完成 topic/strategy 输入与 POST /api/sessions

  -> 用户打开角色详情 Sheet
  -> 用户修改默认模型/发言长度并保存
  -> PATCH /api/templates/{templateId}/roles/{roleId}/config
  -> TemplateService 更新模板当前配置并生成新版本
  -> UI 刷新角色列表和配置状态
```

“使用模板”约束：

- 必须跳回首页并预选 templateId，或在已有 topic/strategy 的未来扩展中调用 `POST /api/sessions` 后带 sessionId 进入讨论页。
- 当前迭代选择“跳回首页预选 templateId”。
- 禁止模板页无 sessionId 直接导航 `/discussion/*`。
- 如果模板 `availableForSessionCreation=false`，按钮置灰或点击后显示 `TEMPLATE_UNAVAILABLE`。

异常流程：

- 模板列表为空：显示空状态和重试入口。
- 模板详情不存在：显示 `TEMPLATE_NOT_FOUND` 错误状态和返回列表入口。
- 角色不存在：返回 `ROLE_NOT_FOUND`。
- 模板不可配置：返回 `TEMPLATE_NOT_EDITABLE`。
- 配置字段无效：返回 `VALIDATION_ERROR`。
- 保存失败：角色 Sheet 保持打开并显示错误。

### 3.3 会话列表、历史恢复与讨论运行时流程

```text
用户进入会话页
  -> GET /api/sessions
  -> SessionService.listSessions()
  -> 每个 session 映射为 SessionListItem：templateName、roleCount、eventCount、messageCount、modelStrategyName、fromSnapshot
  -> SessionsModule 渲染列表；旧 session 缺快照时显示 fallback 文案但不阻断恢复

用户打开 /discussion/{sessionId}
  -> GET /api/sessions/{sessionId}
  -> DiscussionService.findById(sessionId)
  -> 若 session.templateSnapshot 存在：用 snapshot.template + snapshot.roles
     否则：读取实时 template 作为旧会话兜底，并标记 fallbackReason
  -> 角色栏展示 snapshot roles

用户发送消息或触发开场
  -> DiscussionService 读取 session
  -> 使用 session.templateSnapshot.roles 构造 AgentProfile
  -> 使用 session.strategySnapshot 解析每个角色 model/temperature/maxTokens
  -> Orchestrator -> AgentRuntime -> LLMProvider.chat(config)
  -> AgentCallLog 记录 provider/model/temperature/maxTokens/modelStrategyId/resolvedModelSource
```

策略解析规则：

1. 基础值来自 `templateSnapshot.modelDefaults`。
2. `strategySnapshot.defaultModel`、`temperature`、`maxTokens` 覆盖模板默认值。
3. `strategySnapshot.roleOverrides[roleId]` 覆盖策略默认值。
4. `TemplateRole.runtimeConfig` 覆盖该角色的 model、temperature、maxCharsPerTurn。
5. `maxTokens` 与 `maxCharsPerTurn` 是两个独立约束：`maxTokens` 传入 LLMConfig；`maxCharsPerTurn` 保存在 AgentProfile/ResolvedRoleRuntimeConfig，供 prompt/context 或 UI 显示约束使用，本迭代不做 token 与字符数换算。
6. `fallbackChain` 在 Provider 返回错误或模型不可用时提供后续模型候选；当前 MockProvider 不真实失败，但解析结果和 call log 必须包含 fallbackChain，测试通过注入失败 provider 验证 fallback 顺序。
7. fallback 实际切换时，AgentCallLog 记录最终 `model`、`resolvedModelSource='fallback'` 和 `fallbackFrom`。

异常流程：

- session 不存在：返回 `SESSION_NOT_FOUND`。
- session 缺少 snapshot：使用实时模板/默认策略兜底，但响应中提供 `fromSnapshot: false` 和 `fallbackReason`。
- 策略缺少 role override：使用 strategy 默认值。
- 角色不可见：不参与运行时 profiles，但保留在模板详情展示中。

## 4. Table Design

当前项目不引入 SQL 数据库。以下为逻辑服务端数据模型，当前落地为 Mock Repository 内存集合，后续可一一映射到数据库表。

### `template_versions`（逻辑集合）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `templateId` | string | required | 模板唯一标识。 |
| `version` | string | required | 语义化版本。Mock 更新时 patch 位确定性 +1。 |
| `name` | string | required | 模板名称。 |
| `description` | string | required | 模板描述。 |
| `category` | string | required | 模板分类。 |
| `tags` | string[] | required | 模板标签。 |
| `overview` | TemplateOverview | required | 世界观、用户身份、适用场景。 |
| `roles` | TemplateRole[] | required | 当前版本角色配置。 |
| `events` | DiscussionEvent[] | required | 事件规则。 |
| `rhythm` | RhythmConfig | required | 节奏配置。 |
| `modelDefaults` | ModelDefaults | required | 模板默认模型参数。 |
| `metrics` | TemplateMetrics | required | 使用数、会话数、收藏数。 |
| `isBuiltin` | boolean | required | 是否内置模板。 |
| `visible` | boolean | required | 是否在列表/详情中可见。 |
| `availableForSessionCreation` | boolean | required | 是否可用于创建新会话。 |
| `editable` | boolean | required | 是否允许角色配置 PATCH。 |
| `createdAt` | string | required | 版本创建时间。 |

索引：`templateId + version` 唯一；`visible` 用于列表；`availableForSessionCreation` 用于会话创建；`editable` 用于配置更新。

### `model_strategies`（逻辑集合）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `modelStrategyId` | string | required unique | 策略唯一标识。统一使用该字段名。 |
| `name` | string | required | 策略名称。 |
| `description` | string | required | 策略说明。 |
| `priority` | Array<'quality'|'speed'|'cost'> | required | 策略优先级。 |
| `defaultModel` | string | required | 默认模型。 |
| `roleOverrides` | Record<string, ModelOverride> | required | 角色级 override。 |
| `fallbackChain` | string[] | required | 模型兜底链。 |
| `temperature` | number | required | 默认 temperature。 |
| `maxTokens` | number | required | 默认 maxTokens。 |
| `costPolicy` | string | required | 成本策略说明。 |
| `speedPolicy` | string | required | 速度策略说明。 |
| `active` | boolean | required | 是否可选。 |
| `isDefault` | boolean | required | 是否默认策略；只能有一个 active default。 |

索引：`modelStrategyId` 唯一；`active` 用于过滤可用策略；`isDefault` 用于缺省策略。

### `sessions` 扩展字段（逻辑集合）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `templateSnapshot` | TemplateSnapshot | optional for legacy | 会话创建时模板快照。 |
| `strategySnapshot` | ModelStrategySnapshot | optional for legacy | 会话创建时策略快照。 |
| `snapshotCreatedAt` | string | optional for legacy | 快照创建时间。 |

兼容性：旧会话可能没有上述字段，读取时使用实时模板/默认策略兜底，不回写历史数据。

## 5. API Design

所有 API 使用：

```ts
ApiResponse<T> =
  | { success: true; data: T; requestId: string }
  | { success: false; data: null; error: { code: string; message: string; details?: unknown }; requestId: string }
```

### 5.1 DTO 字段契约

```ts
interface TemplateSummary {
  templateId: string
  version: string
  name: string
  description: string
  category: string
  tags: string[]
  roleCount: number
  eventCount: number
  usageCount: number
  sessionCount: number
  favoriteCount: number
  isBuiltin: boolean
  availableForSessionCreation: boolean
}

interface SessionListItem {
  sessionId: string
  topic: string
  status: SessionLifecycleStatus
  template: {
    templateId: string
    name: string
    version?: string
    fromSnapshot: boolean
    fallbackReason?: string
  }
  modelStrategy?: {
    modelStrategyId: string
    name: string
    selectedByDefault?: boolean
    fromSnapshot: boolean
  }
  roleCount: number
  eventCount: number
  messageCount: number
  createdAt: number
  updatedAt: number
}
```

### `GET /api/templates`

用途：模板中心和首页模板 Sheet 获取模板摘要。

Response：

```ts
interface TemplateListResult {
  templates: TemplateSummary[]
}
```

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `TEMPLATE_LIST_FAILED` | 500 | 模板列表读取失败。 |
| `INTERNAL_ERROR` | 500 | 未预期错误。 |

### `GET /api/templates/:templateId`

用途：获取模板详情。

Response：

```ts
interface TemplateDetailResult {
  template: DiscussionTemplate
}
```

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `TEMPLATE_NOT_FOUND` | 404 | 模板不存在或不可见。 |
| `TEMPLATE_UNAVAILABLE` | 400 | 模板存在但不可访问详情。 |
| `TEMPLATE_GET_FAILED` | 500 | 模板详情读取失败。 |
| `INTERNAL_ERROR` | 500 | 未预期错误。 |

### `GET /api/templates/:templateId/roles`

用途：获取模板角色列表。

Response：

```ts
interface TemplateRolesResult {
  templateId: string
  templateVersion: string
  roles: TemplateRole[]
}
```

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `TEMPLATE_NOT_FOUND` | 404 | 模板不存在。 |
| `TEMPLATE_UNAVAILABLE` | 400 | 模板不可访问。 |
| `TEMPLATE_ROLES_FAILED` | 500 | 角色列表读取失败。 |
| `INTERNAL_ERROR` | 500 | 未预期错误。 |

### `PATCH /api/templates/:templateId/roles/:roleId/config`

用途：更新模板角色轻量配置，只影响未来新会话。

Request：

```ts
interface RoleConfigPatchRequest {
  model?: string
  temperature?: number
  maxCharsPerTurn?: number
}
```

Response：

```ts
interface RoleConfigPatchResult {
  templateId: string
  templateVersion: string
  roleId: string
  config: RoleRuntimeConfig
  effectScope: 'future_sessions_only'
}
```

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `INVALID_REQUEST` | 400 | JSON 无效或 request body 不是对象。 |
| `TEMPLATE_NOT_FOUND` | 404 | 模板不存在。 |
| `TEMPLATE_UNAVAILABLE` | 400 | 模板不可访问。 |
| `TEMPLATE_NOT_EDITABLE` | 400 | 模板不允许角色配置。 |
| `ROLE_NOT_FOUND` | 404 | 角色不存在。 |
| `VALIDATION_ERROR` | 400 | 配置字段非法、空 patch 或字段类型错误。 |
| `ROLE_CONFIG_UPDATE_FAILED` | 500 | 保存失败。 |
| `INTERNAL_ERROR` | 500 | 未预期错误。 |

### `GET /api/model-strategies`

用途：首页模型策略 Sheet 获取策略列表。

Response：

```ts
interface ModelStrategiesResult {
  strategies: ModelStrategy[]
  defaultModelStrategyId: string
}
```

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `MODEL_STRATEGY_LIST_FAILED` | 500 | 策略读取失败。 |
| `DEFAULT_MODEL_STRATEGY_UNAVAILABLE` | 500 | active 默认策略不存在。 |
| `INTERNAL_ERROR` | 500 | 未预期错误。 |

### `GET /api/sessions`

用途：会话中心获取包含模板/策略快照摘要的会话列表。

Response：

```ts
interface SessionListResult {
  sessions: SessionListItem[]
}
```

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | status 或 limit 查询参数非法。 |
| `SESSION_LIST_FAILED` | 500 | 会话列表读取失败。 |
| `INTERNAL_ERROR` | 500 | 未预期错误。 |

### `POST /api/sessions`

用途：创建新会话并保存模板/策略快照。

Request：沿用并扩展现有 `CreateSessionParams`。`modelStrategyId` 可选；缺省时使用 active 默认策略。

Response：扩展现有 `CreateSessionResult`：

```ts
interface CreateSessionResult {
  sessionId: string
  topic: string
  template: { templateId: string; name: string; version: string }
  modelStrategy: { modelStrategyId: string; name: string; selectedByDefault: boolean }
  status: SessionLifecycleStatus
  createdAt: number
}
```

错误码：

| code | HTTP | 说明 |
|---|---:|---|
| `INVALID_REQUEST` | 400 | JSON 无效、topic/templateId 类型错误。 |
| `TOPIC_REQUIRED` | 400 | 议题为空。 |
| `TOPIC_TOO_LONG` | 400 | 议题超过长度限制。 |
| `TEMPLATE_NOT_FOUND` | 404 | 模板不存在。 |
| `TEMPLATE_UNAVAILABLE` | 400 | 模板不可用于创建会话。 |
| `MODEL_STRATEGY_NOT_FOUND` | 404 | 模型策略不存在。 |
| `MODEL_STRATEGY_UNAVAILABLE` | 400 | 模型策略不可用。 |
| `MODEL_STRATEGY_REQUIRED` | 400 | 请求未提供策略且没有可用默认策略。 |
| `INTERNAL_ERROR` | 500 | 会话创建失败。 |

### `GET /api/sessions/:sessionId`

用途：恢复历史会话，返回快照优先的模板与角色信息。

Response：扩展现有 `SessionDetailResult`：

```ts
interface SessionDetailResult {
  sessionId: string
  topic: string
  template: { templateId: string; name: string; version?: string; fromSnapshot: boolean; fallbackReason?: string }
  modelStrategy?: { modelStrategyId: string; name: string; selectedByDefault?: boolean; fromSnapshot: boolean; fallbackReason?: string }
  roles: Array<{ roleId: string; name: string; agentType: AgentType; avatar: string; model: string }>
  // existing fields preserved
}
```

错误码：沿用现有 `SESSION_NOT_FOUND`、`INTERNAL_ERROR`。

## 6. Module Design

### 6.1 类型层：`src/types`

新增/扩展类型：

- `TemplateSummary`
- `TemplateMetrics`
- `TemplateOverview`
- `TemplateRole`
- `RoleRuntimeConfig`
- `ModelDefaults`
- `DiscussionTemplate`
- `TemplateSnapshot`
- `ModelStrategy`
- `ModelStrategySnapshot`
- `ResolvedRoleRuntimeConfig`
- `SessionListItem`
- `SessionListResult`
- `RuntimeConfigSummary`

集成方式：

- `Template` 作为兼容别名/扩展继续可用，避免已有导入立即失效。
- `Session` 新增快照字段。
- `AgentCallLog` / `AgentCallLogData` 新增结构化运行时字段：`modelStrategyId?`、`temperature?`、`maxTokens?`、`resolvedModelSource?`、`fallbackFrom?`。
- `LLMConfig` 新增 `maxTokens?: number`。

### 6.2 模板服务层

`TemplateRepository`：

```ts
interface TemplateRepository {
  findAll(): Promise<DiscussionTemplate[]>
  findSummaries(): Promise<TemplateSummary[]>
  findById(id: string): Promise<DiscussionTemplate | null>
  findRoles(templateId: string): Promise<TemplateRolesResult | null>
  updateRoleConfig(templateId: string, roleId: string, patch: RoleConfigPatchRequest): Promise<RoleConfigPatchResult | null>
}
```

`findRoles()` 必须从同一个 immutable template version 派生 `templateId`、`templateVersion` 和 `roles`，不得分两次读取造成版本漂移。

`TemplateService`：

- `listTemplateSummaries()`：返回模板摘要。
- `getTemplateDetail(templateId)`：返回模板详情或抛 `TEMPLATE_NOT_FOUND`。
- `listTemplateRoles(templateId)`：返回 `TemplateRolesResult`。
- `updateRoleConfig(templateId, roleId, patch)`：校验 patch 并更新模板版本。
- `createTemplateSnapshot(template)`：深拷贝创建会话快照。

异常：统一转为 `ServiceError`。

### 6.3 模型策略服务层

`ModelStrategyRepository`：

```ts
interface ModelStrategyRepository {
  findAll(): Promise<ModelStrategy[]>
  findById(modelStrategyId: string): Promise<ModelStrategy | null>
  findDefault(): Promise<ModelStrategy | null>
}
```

`ModelStrategyService`：

- `listStrategies()`：返回 active 策略和默认策略 id。
- `getStrategy(modelStrategyId)`：返回 active 策略或抛 `MODEL_STRATEGY_NOT_FOUND` / `MODEL_STRATEGY_UNAVAILABLE`。
- `getDefaultStrategy()`：返回 active default 策略或抛 `MODEL_STRATEGY_REQUIRED`。
- `createStrategySnapshot(strategy, selectedByDefault)`：深拷贝保存会话策略快照。
- `resolveRoleRuntimeConfig(role, templateDefaults, snapshot)`：按 Flow Design 的 7 条规则合并配置，输出 AgentRuntime 可消费配置。

### 6.4 会话服务层

`SessionService.createSession()` 新增步骤：

1. 校验 topic。
2. 获取模板详情，要求 `availableForSessionCreation=true`。
3. 如果入参有 `modelStrategyId`，获取对应 active 策略；否则获取默认 active 策略。
4. 创建深拷贝 `templateSnapshot`、`strategySnapshot`。
5. 保存 session。
6. 返回 template/version/strategy/selectedByDefault 摘要。

`SessionService.listSessions()`：

- 从 repository 读取 session。
- 映射为 `SessionListResult`。
- 快照存在时从快照取 templateName、roleCount、eventCount、modelStrategyName。
- 快照缺失时从实时模板/默认策略兜底并标注 `fromSnapshot:false`。

禁止行为：不得在角色配置更新时遍历或修改历史 session。

### 6.5 讨论服务和运行时

`DiscussionService`：

- `getSessionDetail()` 使用 snapshot 优先生成 `template`、`modelStrategy` 和 `roles`。
- `recognizeIntent()` 使用 snapshot roles 进行目标角色识别。
- `sendUserMessage()` 使用 snapshot roles + strategySnapshot 生成 AgentProfile 和运行时配置。

`DefaultAgentRuntime`：

- 从 AgentProfile / ResolvedRoleRuntimeConfig 读取 model、temperature、maxTokens。
- 调用 LLMProvider 时传递 `{ provider, model, temperature, maxTokens }`。
- Provider 报错时按 fallbackChain 重试；当前 mock provider 测试用可注入失败 provider 验证 fallback。

### 6.6 UI 模块

`HomeModule`：

- mount 时并行加载 `/api/templates` 与 `/api/model-strategies`。
- 支持 `?templateId=` query 预选模板。
- 模板 Sheet 展示真实可用模板，列表为空显示 empty，加载失败显示 error + retry。
- 策略 Sheet 展示真实策略，列表为空显示默认不可用提示。
- 提交失败时展示错误，不跳转；创建成功才 `router.push('/discussion/{sessionId}')`。

`TemplatesModule`：

- 加载模板列表、详情、角色列表。
- 支持概览/角色/事件/节奏 Tab，详情数据已加载后切 Tab 不阻塞网络。
- 支持“使用模板”：跳转首页并携带 `templateId` query。
- 支持角色详情 Sheet；详情加载失败允许关闭和重试。
- 支持角色配置 Sheet PATCH 保存；保存成功刷新角色列表，保存失败保持 Sheet 打开。

`SessionsModule`：

- 会话列表展示 `SessionListItem` 的模板快照摘要。
- 旧会话缺少快照时显示兜底模板名或“模板信息待恢复”，但继续允许点击恢复。

## 7. Output Contract

| 产物 | 输入 | 输出 | 正确性规则 | type id | 测试规范 |
|---|---|---|---|---|---|
| 模板列表 API | `GET /api/templates` | `TemplateListResult` | 至少返回 3 个 active/visible 内置模板；字段包含 templateId/version/name/description/category/tags/roleCount/eventCount/usageCount/sessionCount/favoriteCount/isBuiltin/availableForSessionCreation。 | `web-e2e` | `standards/testing/web-e2e.md` |
| 模板详情 API | `GET /api/templates/:templateId` | `TemplateDetailResult` | 存在且可见返回完整 overview/roles/events/rhythm/modelDefaults/visible/availableForSessionCreation/editable；不存在返回 `TEMPLATE_NOT_FOUND`。 | `web-e2e` | `standards/testing/web-e2e.md` |
| 模板角色 API | `GET /api/templates/:templateId/roles` | `TemplateRolesResult` | 从同一模板版本返回 templateId/templateVersion/roles；不存在返回错误；角色包含模型、温度、发言长度、visible、configStatus。 | `web-e2e` | `standards/testing/web-e2e.md` |
| 角色配置 API | `PATCH /api/templates/:templateId/roles/:roleId/config` | `RoleConfigPatchResult` | 合法 patch 以不可变方式产生新 patch 版本且 effectScope 为 `future_sessions_only`；空 patch/非法字段返回 `VALIDATION_ERROR`；不可配置模板返回 `TEMPLATE_NOT_EDITABLE`。 | `web-e2e` | `standards/testing/web-e2e.md` |
| 模型策略 API | `GET /api/model-strategies` | `ModelStrategiesResult` | 返回 active smart/quality/cost 策略、defaultModelStrategyId、fallback、temperature、maxTokens；默认策略不可用返回 `DEFAULT_MODEL_STRATEGY_UNAVAILABLE`。 | `web-e2e` | `standards/testing/web-e2e.md` |
| 会话列表 API | `GET /api/sessions` | `SessionListResult` | 每项包含 template 快照摘要、modelStrategy 摘要、roleCount/eventCount/messageCount/时间；旧会话缺快照时 fromSnapshot=false 且不阻断列表。 | `web-e2e` | `standards/testing/web-e2e.md` |
| 创建会话链路 | `CreateSessionParams` | `CreateSessionResult` + persisted Session | 保存深拷贝 templateSnapshot/strategySnapshot/snapshotCreatedAt；缺省 strategy 使用默认 active 策略并记录 selectedByDefault=true；template 或 strategy 无效时不创建 session。 | `integration` | `standards/testing/integration.md` |
| 讨论运行时策略解析 | Session snapshot + role | `AgentProfile` / `LLMConfig` / `AgentCallLog` | 配置优先级为 templateDefaults -> strategy defaults -> roleOverrides -> role.runtimeConfig；maxTokens 传入 LLMConfig，maxCharsPerTurn 单独保留；fallbackChain 按顺序重试；call log 记录 modelStrategyId/temperature/maxTokens/resolvedModelSource/fallbackFrom。 | `integration` | `standards/testing/integration.md` |
| 模板使用流程 UI | 用户在模板详情点击“使用模板” | 首页预选 templateId | 不直接进入 discussion；不可创建模板置灰或报错；首页可继续选择策略和 topic 后创建 session。 | `frontend-ui` | `standards/testing/frontend-ui.md` |
| 首页 UI | 用户选择模板/策略并提交 topic | 新会话创建并跳转 | 页面渲染真实模板/策略；覆盖 loading/empty/error/retry/success；创建失败不跳转。 | `frontend-ui` | `standards/testing/frontend-ui.md` |
| 模板中心 UI | 用户浏览模板、切 Tab、配置角色 | 数据渲染与保存反馈 | 覆盖真实数据、Tab 切换、角色详情、配置保存、错误、重试、关闭 Sheet。 | `frontend-ui` | `standards/testing/frontend-ui.md` |
| 会话恢复 UI/服务 | sessionId | 快照优先详情 | 历史 session 不受模板角色配置更新影响；旧 session 缺快照可兜底恢复。 | `integration` | `standards/testing/integration.md` |
| 会话列表 UI | SessionListResult | 会话卡片摘要 | 展示模板名、角色数、事件/消息数、时间；快照缺失时显示兜底文案。 | `frontend-ui` | `standards/testing/frontend-ui.md` |

项目 `workflow.yaml` 的 `project.features` 包含 `web-api`，且本次新增/修改 HTTP endpoint，因此必须包含 `web-e2e`。本次涉及前端页面渲染和交互，必须包含 `frontend-ui`。本次跨越 Controller/Route -> Service -> Repository -> UI/Runtime，必须包含 `integration`。本次不涉及 SQL/query generator、CLI、batch-job、messaging、library SDK，因此不触发对应 type id。

## 8. Change Log

| 文件 | 变更类型 | 原因 |
|---|---|---|
| `src/types/index.ts` | 修改 | 增加完整服务端模板/策略/快照领域模型、LLMConfig maxTokens、AgentCallLog 运行时字段。 |
| `src/types/api.ts` | 修改 | 增加模板、角色、策略、配置、会话列表、会话快照 API DTO。 |
| `src/data/templates/three-kingdoms.ts` | 修改 | 升级现有模板到完整 DiscussionTemplate。 |
| `src/data/templates/startup-board.ts` | 新增 | 内置第二个模板。 |
| `src/data/templates/product-debate.ts` | 新增 | 内置第三个模板。 |
| `src/data/templates/index.ts` | 新增 | 统一导出模板集合。 |
| `src/data/model-strategies.ts` | 修改 | 增加完整策略字段和运行时参数。 |
| `src/server/repositories/template.repository.ts` | 修改 | 扩展模板 repository 契约。 |
| `src/server/repositories/model-strategy.repository.ts` | 新增 | 新增模型策略 repository 契约。 |
| `src/server/repositories/mock/mock-template.repository.ts` | 修改 | 实现多模板、详情、角色、配置版本 mock 存储。 |
| `src/server/repositories/mock/mock-model-strategy.repository.ts` | 新增 | 新增策略 mock 存储。 |
| `src/server/repositories/mock/mock-session.repository.ts` | 修改 | 支持保存和返回 session 快照字段。 |
| `src/server/repositories/mock/instances.ts` | 修改 | 共享模型策略仓储实例。 |
| `src/server/services/template.service.ts` | 修改 | 增加模板摘要、详情、角色和配置更新服务。 |
| `src/server/services/model-strategy.service.ts` | 新增 | 新增策略查询、快照、运行时解析服务。 |
| `src/server/services/session.service.ts` | 修改 | 创建会话保存 templateSnapshot/strategySnapshot；列表映射 SessionListResult。 |
| `src/server/services/discussion.service.ts` | 修改 | 会话详情、意图识别和发言生成使用快照与策略。 |
| `src/engine/agent-runtime.ts` | 修改 | 传递策略解析后的 LLM 参数并支持 fallback。 |
| `src/app/api/templates/route.ts` | 修改 | 返回模板摘要 envelope。 |
| `src/app/api/templates/[templateId]/route.ts` | 新增 | 模板详情 endpoint。 |
| `src/app/api/templates/[templateId]/roles/route.ts` | 新增 | 模板角色 endpoint。 |
| `src/app/api/templates/[templateId]/roles/[roleId]/config/route.ts` | 新增 | 角色配置 endpoint。 |
| `src/app/api/model-strategies/route.ts` | 新增 | 策略列表 endpoint。 |
| `src/app/api/sessions/route.ts` | 修改 | GET 返回 SessionListResult；POST 创建会话快照与错误映射。 |
| `src/app/api/sessions/[sessionId]/route.ts` | 修改 | 返回快照优先的模板/策略详情。 |
| `src/modules/home/index.tsx` | 修改 | 首页真实模板/策略加载、query 预选和选择。 |
| `src/modules/templates/index.tsx` | 修改 | 模板中心真实数据、Tab、使用模板、角色详情、配置。 |
| `src/modules/sessions/index.tsx` | 修改 | 会话列表展示模板快照摘要。 |

## 9. Development Tasks

- Task-01：定义模板、策略与会话快照契约
  - 任务类型：contract
  - 所属模块：types
  - 简要描述：定义完整模板版本、角色运行时配置、模型策略、策略快照、模板快照、会话列表 DTO、API DTO、LLMConfig maxTokens、AgentCallLog 运行时字段。
  - 涉及接口/方法：TemplateSummary、DiscussionTemplate、TemplateRole、ModelStrategy、TemplateSnapshot、ModelStrategySnapshot、SessionListItem、CreateSessionResult、SessionDetailResult、LLMConfig、AgentCallLog
  - 输入：无
  - 输出：可被 API、Service、Repository、UI、测试导入的类型定义
  - 依赖任务：无
  - 数据操作：无
  - 修改边界：只修改 `src/types/index.ts` 与 `src/types/api.ts` 的类型声明和导出；不得删除既有类型字段
  - 禁止行为：不得写业务逻辑；不得删除现有 API DTO；不得把类型定义放入组件文件
  - 产出类型：integration
  - 功能类型：跨层领域契约（type id: integration）
  - 是否跨组件：是（组件链路：API DTO -> Service -> Repository -> UI/Runtime）
- Task-02：实现服务端模板版本数据源与模板查询能力
  - 任务类型：business-implementation
  - 所属模块：templates
  - 简要描述：提供至少 3 个内置模板，支持模板摘要列表、模板详情、同版本角色列表查询，并保证模板包含版本、overview、roles、events、rhythm、modelDefaults、metrics、visible、availableForSessionCreation、editable。
  - 涉及接口/方法：TemplateRepository.findSummaries()、findById()、findRoles()、TemplateService.listTemplateSummaries()、getTemplateDetail()、listTemplateRoles()
  - 输入：templateId
  - 输出：TemplateSummary[]、DiscussionTemplate、TemplateRolesResult 或 ServiceError
  - 依赖任务：Task-01（领域类型契约）
  - 数据操作：读 `template_versions` 逻辑集合
  - 修改边界：只新增/修改 Change Log 中模板数据、TemplateRepository、MockTemplateRepository、TemplateService 和模板 GET route 的相关方法；模板 GET/PATCH route 必须使用 `instances.ts` 中的 `sharedTemplateRepo` 共享实例，不得每次 new；同步更新所有现有 `/api/templates` 消费者和测试；不得改写 SessionService
  - 禁止行为：不得硬编码在 UI 组件中返回模板数据；不得只返回三国模板；不得省略模板版本字段；不得分两次读取造成角色版本漂移
  - 产出类型：web-e2e
  - 功能类型：模板查询 API 与服务端模型（type id: web-e2e）
  - 是否跨组件：是（组件链路：Route Handler -> TemplateService -> TemplateRepository）
- Task-03：实现模板角色配置版本更新能力
  - 任务类型：business-implementation
  - 所属模块：templates
  - 简要描述：校验角色配置 patch，按不可变方式更新模板角色运行时配置，确定性递增 patch 版本，并返回 future_sessions_only 生效范围。
  - 涉及接口/方法：TemplateRepository.updateRoleConfig()、TemplateService.updateRoleConfig()、PATCH /api/templates/:templateId/roles/:roleId/config
  - 输入：templateId、roleId、RoleConfigPatchRequest
  - 输出：RoleConfigPatchResult 或 ServiceError
  - 依赖任务：Task-01（配置 DTO）、Task-02（模板数据源）
  - 数据操作：读写 `template_versions` 逻辑集合；不读写 `sessions` 逻辑集合
  - 修改边界：只新增/修改角色配置 route、TemplateService 配置校验、MockTemplateRepository 配置更新方法；不得修改 SessionRepository 快照
  - 禁止行为：不得修改任何已创建 session 的 templateSnapshot；不得接受空 patch；不得接受非法 temperature/maxCharsPerTurn；不得可变修改旧版本对象
  - 产出类型：web-e2e
  - 功能类型：角色配置 API 与模板版本更新（type id: web-e2e）
  - 是否跨组件：是（组件链路：Route Handler -> TemplateService -> TemplateRepository）
- Task-04：实现模型策略查询 API
  - 任务类型：business-implementation
  - 所属模块：model-strategies
  - 简要描述：提供 active smart、quality、cost 策略列表和 defaultModelStrategyId，暴露完整策略字段供首页选择。
  - 涉及接口/方法：ModelStrategyRepository.findAll()、findById()、findDefault()、ModelStrategyService.listStrategies()、GET /api/model-strategies
  - 输入：无
  - 输出：ModelStrategiesResult 或 ServiceError
  - 依赖任务：Task-01（策略类型契约）
  - 数据操作：读 `model_strategies` 逻辑集合
  - 修改边界：只新增/修改 model strategy 数据、repository、service、GET /api/model-strategies route；不得实现 Provider/API Key 管理
  - 禁止行为：不得把策略只作为 UI 文案；不得省略 fallbackChain、temperature、maxTokens、defaultModelStrategyId
  - 产出类型：web-e2e
  - 功能类型：模型策略查询 API（type id: web-e2e）
  - 是否跨组件：是（组件链路：Route Handler -> ModelStrategyService -> ModelStrategyRepository）
- Task-05：实现模型策略快照与运行时解析能力
  - 任务类型：integration
  - 所属模块：model-strategies
  - 简要描述：支持策略详情查询、默认策略选择、策略快照创建，并按模板默认值、策略默认值、角色 override、角色配置解析运行时模型参数。
  - 涉及接口/方法：ModelStrategyService.getStrategy()、getDefaultStrategy()、createStrategySnapshot()、resolveRoleRuntimeConfig()
  - 输入：modelStrategyId、TemplateRole、ModelDefaults、ModelStrategySnapshot
  - 输出：ModelStrategySnapshot、ResolvedRoleRuntimeConfig 或 ServiceError
  - 依赖任务：Task-01（策略类型契约）、Task-04（策略数据源）
  - 数据操作：读 `model_strategies` 逻辑集合
  - 修改边界：只修改 ModelStrategyService 解析逻辑和必要类型；不得修改 UI 组件
  - 禁止行为：不得忽略配置优先级；不得把 maxCharsPerTurn 换算成 maxTokens；不得用硬编码 DEFAULT_MODEL 覆盖策略
  - 产出类型：integration
  - 功能类型：策略快照与运行时解析（type id: integration）
  - 是否跨组件：是（组件链路：SessionService/DiscussionService -> ModelStrategyService -> AgentRuntime）
- Task-06：实现创建会话保存模板与策略快照
  - 任务类型：integration
  - 所属模块：sessions
  - 简要描述：创建会话时校验模板和模型策略，复制 templateSnapshot 与 strategySnapshot 保存到 session，缺省策略使用默认 active 策略并记录 selectedByDefault。
  - 涉及接口/方法：SessionService.createSession()、SessionRepository.save()、POST /api/sessions
  - 输入：CreateSessionParams
  - 输出：CreateSessionResult 或 ServiceError
  - 依赖任务：Task-01（快照类型）、Task-02（模板查询）、Task-05（策略快照）
  - 数据操作：通过 TemplateService/Repository 读取模板详情（`template_versions` 逻辑集合）；通过 ModelStrategyService/Repository 读取策略详情（`model_strategies` 逻辑集合）；写 `sessions` 逻辑集合
  - 修改边界：只替换 SessionService.createSession() 中模板/策略校验与 session 构造逻辑；只扩展 MockSessionRepository 保存字段；不得修改会话状态流转方法
  - 禁止行为：不得保存对实时模板对象的可变引用；不得在策略无效时创建 session；不得省略 snapshotCreatedAt；不得在无默认策略时静默创建
  - 产出类型：integration
  - 功能类型：会话创建快照链路（type id: integration）
  - 是否跨组件：是（组件链路：SessionsRoute -> SessionService -> TemplateRepository -> ModelStrategyRepository -> SessionRepository）
- Task-07：实现会话列表快照摘要 API
  - 任务类型：integration
  - 所属模块：sessions
  - 简要描述：将 `GET /api/sessions` 从内部 Session[] 映射为 SessionListResult，展示模板名、角色数、事件数、消息数、策略摘要、时间和快照来源。
  - 涉及接口/方法：SessionService.listSessions()、GET /api/sessions、SessionListResult
  - 输入：ListSessionsQuery
  - 输出：SessionListResult 或 ServiceError
  - 依赖任务：Task-01（会话列表 DTO）、Task-06（会话保存快照）
  - 数据操作：读 `sessions` 逻辑集合；旧会话兜底时可读 `template_versions` 与 `model_strategies` 逻辑集合
  - 修改边界：只修改 SessionService.listSessions() 映射和 sessions GET route 响应；不得修改归档/恢复/完成状态流转逻辑
  - 禁止行为：不得让 UI 直接依赖内部 Session 快照对象；不得因旧会话缺少快照阻断列表返回
  - 产出类型：integration
  - 功能类型：会话列表快照摘要 API（type id: integration）
  - 是否跨组件：是（组件链路：SessionsRoute -> SessionService -> SessionRepository）
- Task-08：实现讨论恢复与 Agent 运行时使用会话快照
  - 任务类型：integration
  - 所属模块：discussion-runtime
  - 简要描述：会话详情、意图识别、消息发送和 AgentProfile 构建优先使用 session snapshot，并让策略参数进入 LLMConfig 与调用日志。
  - 涉及接口/方法：DiscussionService.getSessionDetail()、recognizeIntent()、sendUserMessage()、DefaultAgentRuntime.run()
  - 输入：sessionId、session.templateSnapshot、session.strategySnapshot
  - 输出：SessionDetailResult、IntentResponse、SendMessageResult、AgentCallLog
  - 依赖任务：Task-01（快照/运行时类型）、Task-05（策略解析）、Task-06（会话保存快照）
  - 数据操作：读 `sessions` 逻辑集合；读写 `messages` 逻辑集合；写 `agent_call_logs` 逻辑集合
  - 修改边界：只替换 DiscussionService 中构造 roles/profiles/templateName/model 的局部逻辑；只扩展 AgentRuntime config 和 call log runtime 字段；不得重写 orchestrator、scheduler 或 director
  - 禁止行为：不得在历史 session 恢复时读取并覆盖实时模板配置；不得继续用硬编码 DEFAULT_MODEL 覆盖策略；不得改变消息幂等逻辑
  - 产出类型：integration
  - 功能类型：历史会话恢复与运行时策略消费（type id: integration）
  - 是否跨组件：是（组件链路：DiscussionRoute -> DiscussionService -> SessionRepository -> AgentRuntime -> LLMProvider）
- Task-09：实现首页模板与模型策略真实数据联动
  - 任务类型：ui
  - 所属模块：home
  - 简要描述：首页并行加载模板摘要和模型策略 API，支持 query 预选模板，展示 loading/empty/error/retry 状态，用户选择模板/策略后创建会话并跳转讨论详情页。
  - 涉及接口/方法：HomeModule、GET /api/templates、GET /api/model-strategies、POST /api/sessions
  - 输入：用户选择 templateId、modelStrategyId、topic、可选 URL query templateId
  - 输出：首页状态更新、CreateSessionParams、路由跳转或错误提示
  - 依赖任务：Task-02（模板 API）、Task-04（策略 API）、Task-06（创建会话 API）
  - 数据操作：调用 `/api/templates`、`/api/model-strategies`、`/api/sessions`
  - 修改边界：只修改 HomeModule 的数据加载、Sheet 渲染、query 预选、提交错误处理和会话跳转逻辑；不得修改讨论页路由结构
  - 禁止行为：不得继续使用组件内硬编码模板列表作为主数据源；不得在创建失败时跳转；不得绕过 POST /api/sessions 自行构造 sessionId
  - 产出类型：frontend-ui
  - 功能类型：首页真实数据选择与创建会话 UI（type id: frontend-ui）
  - 是否跨组件：是（组件链路：HomeModule -> Templates API/Strategies API -> Sessions API -> Router）
- Task-10：实现模板中心真实数据、使用模板、角色详情与角色配置交互
  - 任务类型：ui
  - 所属模块：templates
  - 简要描述：模板中心加载真实模板数据，支持概览/角色/事件/节奏 Tab、使用模板跳回首页预选、角色详情 Sheet 和角色配置保存反馈。
  - 涉及接口/方法：TemplatesModule、GET /api/templates、GET /api/templates/:templateId、GET /api/templates/:templateId/roles、PATCH /api/templates/:templateId/roles/:roleId/config
  - 输入：templateId、roleId、RoleConfigPatchRequest、用户 Tab/Sheet/使用模板操作
  - 输出：模板详情 UI、首页预选跳转、角色详情 UI、配置保存成功/失败反馈
  - 依赖任务：Task-02（模板查询 API）、Task-03（角色配置 API）、Task-09（首页 query 预选）
  - 数据操作：调用模板列表、详情、角色列表、角色配置 API；点击使用模板时导航 `/?templateId=...`
  - 修改边界：只修改 TemplatesModule 的数据加载、Tab 渲染、使用模板按钮、Sheet 状态和 PATCH 保存逻辑；不得实现复杂模板编辑器、模板导入导出或模板市场
  - 禁止行为：不得从 `threeKingdomsTemplate` 直接渲染主数据；不得在模板页触发真实讨论事件；不得让角色配置影响历史 session；不得无 sessionId 直接进入讨论页
  - 产出类型：frontend-ui
  - 功能类型：模板中心真实数据与角色配置 UI（type id: frontend-ui）
  - 是否跨组件：是（组件链路：TemplatesModule -> Template APIs -> TemplateService -> TemplateRepository；TemplatesModule -> HomeModule）
- Task-11：实现会话列表展示模板快照摘要
  - 任务类型：ui
  - 所属模块：sessions
  - 简要描述：会话列表使用 SessionListResult 展示模板名称、角色数量、事件/消息数量、策略摘要和时间，旧会话缺少快照时显示兜底信息。
  - 涉及接口/方法：SessionsModule、GET /api/sessions
  - 输入：SessionListResult
  - 输出：会话列表模板摘要和可恢复入口
  - 依赖任务：Task-07（会话列表快照 API）
  - 数据操作：调用 `/api/sessions`
  - 修改边界：只修改 SessionsModule 的数据加载类型和展示字段；不得改变归档、恢复、完成等状态流转逻辑
  - 禁止行为：不得用最新模板覆盖历史会话摘要；不得因旧会话缺失快照阻断恢复
  - 产出类型：frontend-ui
  - 功能类型：会话列表快照摘要 UI（type id: frontend-ui）
  - 是否跨组件：是（组件链路：SessionsModule -> Sessions API -> SessionRepository）
