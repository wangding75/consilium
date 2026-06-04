# 迭代 9：设置、Provider 与数据闭环

> 评审日期：2026-05-20  
> 评审结论：通过。设置页和会话页仍为一级 Tab；本修订明确会话导出入口绑定具体 session，可从会话页或讨论详情页更多操作触发。  
> 修订来源：底部导航架构调整评审。  
> 导航基线：底部一级导航为 `首页 / 会话 / 模板 / 设置`；讨论页保留为 `/discussion/[sessionId]` 会话详情页，不作为一级 Tab。
> 复评日期：2026-06-04  
> 复评结论：通过。最终需求与项目蓝图和当前导航基线无方向背离；本次补充 Provider 状态模型、设置生效优先级、API Key 安全边界、Prompt 版本与默认恢复、会话导出 Markdown 契约、设置导入/导出安全边界和本地数据清理规则；无需更新蓝图。  
> 复评来源：Iteration 9 需求评审。  

---

## 迭代目标

完成设置页和数据闭环能力，包括 Provider 状态、默认模型、角色专属模型、Prompt 配置、本地数据与导出。

本迭代使产品从“核心讨论可用”走向“可被真实用户持续使用”。

## 导航与数据闭环约束

| 约束 | 说明 |
|---|---|
| 设置页定位 | 设置页保留为 BottomNav 一级 Tab |
| 会话页定位 | 会话页保留为 BottomNav 一级 Tab，并承担跨会话导出/清理入口 |
| 讨论页定位 | 讨论页为 `/discussion/[sessionId]`，只提供当前 session 的更多操作入口 |
| 导出绑定 | 导出必须绑定具体 sessionId，不允许从无 session 的“讨论”入口导出 |

## 原型映射

| 原型区域 | 本迭代要求 |
|---|---|
| 设置页 Provider 状态 | 展示 OpenAI、Anthropic、Gemini、DeepSeek 连接状态 |
| 模型与 Provider | 管理 Provider、Base URL、API Key |
| 全局默认模型 | 配置默认模型和参数 |
| 角色专属模型 | 为角色指定模型 |
| 模板管理 | 新建、导入、导出模板入口 |
| Prompt 配置 | 全局提示词与角色提示词 |
| 本地数据与安全 | 会话导出、清理、隐私说明 |
| 会话页导出 | 导出指定 session 为 Markdown |

## 前端需求

| 编号 | 需求 |
|---|---|
| FE-001 | 实现设置页完整分组布局 |
| FE-002 | 展示 Provider 连接状态 |
| FE-003 | 实现 Provider 配置 Sheet：provider、baseUrl、apiKey |
| FE-004 | 实现默认模型配置 Sheet：model、temperature、maxTokens |
| FE-005 | 实现角色专属模型配置 Sheet |
| FE-006 | 实现 Prompt 配置入口，支持查看和编辑全局 Prompt |
| FE-007 | 实现模板导入/导出入口 |
| FE-008 | 实现本地数据清理入口 |
| FE-009 | 会话页支持导出指定会话为 Markdown；讨论详情页更多操作可导出当前 session |
| FE-010 | 敏感信息如 API Key 默认脱敏展示 |
| FE-011 | Provider 状态需区分未配置、已配置未测试、连接正常、连接失败、已禁用，不能硬编码“全部正常” |
| FE-012 | Provider 配置 Sheet 支持 modelList、customHeaders、enabled、lastTestStatus、lastTestedAt 展示与编辑 |
| FE-013 | 默认模型与角色专属模型配置页需展示生效优先级：角色覆盖 > 会话 runtimeConfig > 模板/策略默认 > 全局默认 > Provider 默认 |
| FE-014 | Prompt 配置支持查看、编辑、恢复默认、版本号/更新时间展示，保存前需二次确认 |
| FE-015 | 会话导出前展示导出范围、格式和“不包含 API Key / Provider Secret”的说明 |
| FE-016 | 本地数据清理需区分清理会话、清理设置、清理全部，并在危险操作前二次确认 |

## 后端/API需求

| 编号 | 需求 |
|---|---|
| BE-001 | 实现 `GET /api/llm/providers` 获取 Provider 状态 |
| BE-002 | 实现 `POST /api/llm/providers/test` 测试连接 |
| BE-003 | 实现 `PUT /api/settings/model-defaults` 保存默认模型 |
| BE-004 | 实现 `PUT /api/settings/role-models` 保存角色模型配置 |
| BE-005 | 实现 `GET /api/settings/prompts` 和 `PUT /api/settings/prompts` |
| BE-006 | 实现 `GET /api/sessions/:sessionId/export?format=md` |
| BE-007 | 实现本地/服务端设置仓储接口 |
| BE-008 | API Key 不返回明文，只返回 maskedKey |
| BE-009 | LLMClient 从设置读取 Provider 和模型配置 |
| BE-010 | 提供设置导入/导出 JSON 的服务接口 |
| BE-011 | 定义 `SettingsRepository` 与 `SettingsService`，统一保存 providerConfigs、modelDefaults、roleModelOverrides、promptConfigs、dataPolicy |
| BE-012 | 定义 `ModelConfigResolver`，负责将全局默认、模板/策略默认、会话 runtimeConfig、角色覆盖解析为最终 `ResolvedModelConfig` |
| BE-013 | 创建新会话时写入 runtimeConfig snapshot；后续全局设置变更默认只影响新会话，当前会话需显式选择应用 |
| BE-014 | Provider 测试接口只返回结构化状态和错误摘要，保存 lastTestStatus / lastTestedAt，不记录真实 API Key、Headers 或完整请求体 |
| BE-015 | Prompt 配置需支持 version、scope、content、updatedAt、resetToDefault；角色 Prompt 修改不得污染模板快照和历史会话 |
| BE-016 | 会话导出由 `SessionExportService` 生成 Markdown，内容包含议题、模板、状态、时间、角色、消息、事件、投票、总结，不包含任何密钥或敏感 Provider 配置 |
| BE-017 | 设置导出 JSON 默认不包含真实 API Key；如后续支持敏感信息导出，必须单独确认且本迭代不实现 |

## 安全与数据要求

| 编号 | 要求 |
|---|---|
| SEC-001 | API Key 前端展示必须脱敏 |
| SEC-002 | 真实 API Key 不进入日志 |
| SEC-003 | 导出会话不包含 API Key |
| SEC-004 | 清理本地数据前必须确认 |
| SEC-005 | Provider 测试失败时返回可解释错误 |
| SEC-006 | API Key、Authorization Header、Custom Header 中的敏感值均按 write-only 处理，读取接口只能返回 maskedKey / maskedHeaders |
| SEC-007 | 设置导出、会话导出、日志、错误上报均不得包含真实 API Key 或完整 Authorization Header |
| SEC-008 | API Key 保存策略与蓝图一致：Phase 1 不做复杂加密或云端托管，但必须做到本地保存、脱敏展示、不入日志、可清除 |
| SEC-009 | 清理本地数据前必须展示影响范围；清理 Provider 设置会导致真实模型不可用，需单独确认 |

## 验收标准

| 类型 | 标准 |
|---|---|
| 产品 | 设置页展示 Provider、模型、模板、Prompt、本地数据分组 |
| 产品 | 用户可查看 Provider 状态 |
| 产品 | Provider 状态能准确展示未配置、未测试、正常、失败、禁用等状态 |
| 产品 | 用户可测试 Provider 连接 |
| 产品 | 用户可设置全局默认模型 |
| 产品 | 用户能理解全局默认、角色专属、模板/策略默认之间的生效优先级 |
| 产品 | 用户可为角色设置专属模型 |
| 产品 | 用户可从会话页导出指定会话为 Markdown，也可从讨论详情页导出当前 session |
| 产品 | API Key 脱敏展示 |
| 产品 | 清理数据前有二次确认 |
| 产品 | Prompt 编辑支持恢复默认，避免用户误改后无法回退 |
| 技术 | Provider 设置能被 LLMClient 使用 |
| 技术 | `ModelConfigResolver` 能稳定解析最终模型配置，并被 LLMClient 消费 |
| 技术 | Provider 测试接口可返回成功或具体失败原因 |
| 技术 | 默认模型配置能影响新会话 |
| 技术 | 新会话保存 runtimeConfig snapshot，避免后续设置变更污染历史会话 |
| 技术 | 角色模型配置能影响对应 Agent |
| 技术 | 会话导出 Markdown 内容完整 |
| 技术 | 会话导出 Markdown 包含消息、事件、投票、总结和必要元信息，且不包含 Provider Secret |
| 技术 | API Key 不进入日志和导出内容 |
| 技术 | e2e 覆盖 Provider 配置、默认模型设置、会话导出 |
| 技术 | 单元测试覆盖 Provider 状态解析、设置优先级解析、Prompt 恢复默认、导出脱敏 |
| 技术 | e2e 覆盖会话页指定 session 导出和讨论详情页当前 session 导出 |

## 不包含范围

| 不包含 | 说明 |
|---|---|
| 企业级权限系统 | 后续版本 |
| 多设备同步 | Phase 3 |
| 付费计费系统 | 后续商业化 |
| 模板市场 | 后续产品化 |
| API Key 云端托管 / 强加密 | 后续版本；本迭代只做本地保存、脱敏展示、不入日志和可清除 |
| Provider 计费统计和成本报表 | 后续版本；本迭代只记录连接状态和必要调用配置 |
| Prompt 市场 / 多版本协作 | 后续产品化；本迭代只做本地查看、编辑、恢复默认 |

## 需求评审关注点

1. Provider 配置是否与 LLMClient 打通。
2. API Key 是否安全处理。
3. 会话导出是否满足用户留存需求。
4. 设置页是否保持移动端简洁，不变成复杂后台。

---

## 需求评审记录（Iteration 9）

> 评审日期：2026-06-04  
> 评审结论：通过。最终需求与项目蓝图、当前导航基线及迭代 0-8 已完成能力无方向背离；无需更新蓝图。  
> 本次评审重点：确认设置页不挤占多 Agent 讨论主线；Provider 配置必须真正被 LLMClient 消费；API Key 按 Phase 1 安全边界处理；会话导出必须绑定具体 sessionId 并保证内容完整、脱敏。

### Step 3｜初步对齐检查

| 检查项 | 初始需求描述 | 蓝图 / 当前计划定义 | 状态 |
|---|---|---|---|
| 产品主线 | 设置、Provider、Prompt、本地数据和会话导出，服务真实持续使用 | 蓝图主线在完成多 Agent、状态机、用户介入、导演和事件后进入多模板和会话闭环 | ✅ 对齐 |
| 导航架构 | 设置页和会话页仍为 BottomNav 一级 Tab；讨论页只作为 `/discussion/[sessionId]` | 当前导航基线为 `首页 / 会话 / 模板 / 设置`，讨论页必须携带 sessionId | ✅ 对齐 |
| Provider 能力 | OpenAI、Anthropic、Gemini、DeepSeek、Custom Provider 状态和配置 | 蓝图要求 LLM 调用层统一封装，Custom Provider 支持 BaseURL、API Key、ModelList、Headers | ✅ 对齐，需补充字段 |
| 设置存储 | 保存 Provider、默认模型、角色模型、Prompt、本地数据策略 | 蓝图本地数据层包含会话存储、模板缓存、设置存储和 IndexedDB | ✅ 对齐 |
| API Key 安全 | API Key 脱敏展示、不进入日志、不进入导出 | 蓝图明确 Phase 1 暂不做复杂加密，但必须本地保存并避免泄露 | ✅ 对齐，需补充 write-only 边界 |
| 会话导出 | 会话页导出指定 session，讨论详情页导出当前 session | README 与导航变更要求会话页承担导出，讨论页只操作当前 session | ✅ 对齐 |
| 模型配置生效 | 默认模型和角色专属模型影响 LLMClient / Agent | 迭代 8 已引入模板 modelDefaults 和模型策略，迭代 9 需补充全局设置和覆盖优先级 | ✅ 对齐，需明确优先级 |
| 配置 UI 边界 | 设置页提供必要配置，不做复杂后台 | 蓝图红线要求配置 UI 不得拖慢核心讨论主线 | ✅ 对齐，需保持移动端简洁 |

### Step 4｜需求评审意见

#### 1. 完整性

| 问题 | 评审意见 | 修订建议 |
|---|---|---|
| Provider 状态模型过粗 | 仅写“展示连接状态”不足以支撑真实调试，容易变成硬编码正常态 | 增加未配置、已配置未测试、连接正常、连接失败、已禁用、最近测试时间和错误摘要 |
| Custom Provider 字段不完整 | 蓝图要求 Custom Provider 支持 BaseURL、API Key、ModelList、Headers，初始需求只写 provider、baseUrl、apiKey | Provider 配置 Sheet 和后端结构补充 modelList、customHeaders、enabled |
| 模型配置生效规则不清 | 全局默认模型、角色专属模型、模板默认、模型策略可能冲突 | 增加 `ModelConfigResolver`，统一解析角色覆盖、会话 runtimeConfig、模板/策略默认、全局默认、Provider 默认 |
| 设置变更是否影响历史会话不明确 | 若全局设置直接影响历史 session，会导致复盘和导出不可追溯 | 新会话写入 runtimeConfig snapshot；历史会话默认不被全局设置污染，当前会话需显式应用 |
| Prompt 编辑缺少回退机制 | 用户误改全局 Prompt 或角色 Prompt 后，可能无法恢复 | Prompt 配置增加 version、updatedAt、resetToDefault 和保存确认 |
| 会话导出内容边界不完整 | 只写 Markdown 容易遗漏事件、投票、总结或导出密钥 | `SessionExportService` 明确导出议题、模板、状态、时间、角色、消息、事件、投票、总结，排除 Provider Secret |
| 设置导出 JSON 存在泄密风险 | 初始 BE-010 未说明是否包含 API Key | 设置导出默认不包含真实 API Key；本迭代不实现敏感信息导出 |
| 本地数据清理粒度不足 | “清理本地数据”可能误删设置或会话 | 区分清理会话、清理设置、清理全部，并在危险操作前二次确认 |

#### 2. 合理性

| 检查点 | 结论 |
|---|---|
| 技术可行性 | 可行。迭代 0 已预留 API、Repository、配置读取和 LLM Provider Adapter；迭代 2 已建立 LLMClient 统一入口；迭代 4 已建立会话中心；迭代 8 已建立模板与模型策略数据。 |
| 产品范围 | 合理。本迭代是核心讨论闭环之后的持续使用能力补全，不改变多 Agent 主线。 |
| API 范围 | 可控。新增设置、Provider 测试、Prompt、导出接口即可，核心复杂度集中在设置解析、脱敏和导出服务。 |
| 安全边界 | 可接受。Phase 1 不做复杂加密或云端托管，但必须保证脱敏展示、不入日志、不导出、可清除。 |
| UI 复杂度 | 中等。移动端设置页需要分组明确，避免变成后台配置系统；Provider 测试、模型覆盖关系和 Prompt 恢复默认是主要交互风险。 |

#### 3. 一致性

| 对象 | 结论 |
|---|---|
| 与迭代 0 | 对齐。迭代 0 已建立 `/settings` 页面骨架、`/api/llm/providers`、配置读取模块、Repository 和 LLM Provider Adapter 骨架。 |
| 与迭代 1 | 对齐。默认模型设置会影响后续新会话创建，但首页仍只负责选择模板/策略并创建 session。 |
| 与迭代 2 | 对齐。Provider 和模型配置必须被 LLMClient 消费，UI 不直接调用 Provider。 |
| 与迭代 3 | 对齐。会话导出基于已存在的消息流数据；不改变消息发送、Typing、重试等交互。 |
| 与迭代 4 | 对齐。会话页已经承担搜索、筛选、归档和恢复；本迭代补充指定 session 导出。 |
| 与迭代 5 | 对齐。Prompt 配置不改变 IntentClassifier 的职责，只为后续 Prompt 管理提供入口。 |
| 与迭代 6 | 对齐。导出总结内容应复用 Director / Host 总结结果，不在设置页重新生成总结。 |
| 与迭代 7 | 对齐。导出可包含 EventRecord / VoteRecord，但不新增事件触发或投票逻辑。 |
| 与迭代 8 | 对齐。角色专属模型和默认模型配置需要与模板 modelDefaults、模型策略共同解析，不污染模板快照。 |

#### 4. 风险点

| 风险 | 等级 | 影响 | 应对 |
|---|---|---|---|
| API Key 泄露 | P0 | 用户密钥可能出现在日志、导出或错误信息中 | Key 和敏感 Header 按 write-only 处理，只返回 maskedKey / maskedHeaders；日志和导出强制脱敏 |
| 设置优先级混乱 | P0 | 角色模型、全局模型、模板默认互相覆盖，导致 Agent 调用不可预测 | 增加 `ModelConfigResolver` 和单元测试，所有 LLM 调用只消费 `ResolvedModelConfig` |
| 历史会话被设置变更污染 | P1 | 导出或恢复时无法解释当时使用的模型配置 | 新会话写入 runtimeConfig snapshot；历史会话默认保持原配置 |
| Provider 测试误报 | P1 | 用户以为已连通，实际生成失败 | Provider 状态需区分配置、测试和最近失败原因；LLM 真实调用仍需独立错误处理 |
| Prompt 误改不可恢复 | P1 | 讨论质量突然下降，用户无法回退 | Prompt 配置支持恢复默认和版本信息，保存前二次确认 |
| 导出内容不完整 | P1 | 用户无法将讨论沉淀为可复用材料 | 导出契约明确包含消息、事件、投票、总结和元信息，并做 e2e 覆盖 |
| 清理数据误删 | P1 | 会话或 Provider 设置丢失 | 清理操作拆分类型并二次确认；危险操作明确提示影响范围 |
| 设置页范围膨胀 | P2 | 变成复杂后台，拖慢移动端体验 | 本迭代只做必要配置和闭环，不做权限、计费、市场、复杂 Prompt 协作 |

### Step 5｜最终需求修订摘要

| 变更项 | 最终需求 | 原因 |
|---|---|---|
| Provider 状态模型 | 增加未配置、未测试、正常、失败、禁用、最近测试时间、错误摘要 | 保证用户能真实判断 Provider 是否可用 |
| Custom Provider 字段 | Provider 配置补充 modelList、customHeaders、enabled | 对齐蓝图 Custom Provider 能力 |
| 设置生效优先级 | 增加 `ModelConfigResolver` 和配置覆盖顺序 | 避免模型配置冲突和调用不可预测 |
| 会话 runtimeConfig snapshot | 新会话保存运行时配置快照；历史会话默认不受全局设置变更污染 | 保证会话恢复和导出可追溯 |
| Prompt 配置安全 | Prompt 支持版本、恢复默认、保存确认 | 降低误改风险 |
| API Key 安全边界 | Key / Header write-only、脱敏返回、不入日志、不导出 | 降低敏感信息泄露风险 |
| 导出契约 | 明确 Markdown 导出内容和脱敏规则 | 保证数据闭环可用、可验收 |
| 设置导出 JSON | 默认不包含真实 API Key，本迭代不做敏感信息导出 | 避免配置备份造成密钥泄露 |
| 本地数据清理 | 拆分清理会话、设置、全部，并二次确认 | 避免误删关键数据 |

### 补充数据结构建议

```ts
interface ProviderConfig {
  providerId: 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'custom'
  enabled: boolean
  baseUrl?: string
  maskedKey?: string
  apiKeyRef?: string
  modelList: string[]
  customHeaders?: Record<string, string>
  maskedHeaders?: Record<string, string>
  lastTestStatus: 'untested' | 'success' | 'failed'
  lastTestedAt?: string
  lastErrorCode?: string
  lastErrorMessage?: string
}

interface ModelDefaults {
  providerId: string
  model: string
  temperature: number
  maxTokens: number
  stream?: boolean
  timeoutMs?: number
}

interface RoleModelOverride {
  roleId: string
  providerId?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

interface ResolvedModelConfig {
  providerId: string
  model: string
  temperature: number
  maxTokens: number
  source: 'roleOverride' | 'sessionRuntime' | 'templateDefault' | 'globalDefault' | 'providerDefault'
}

interface PromptConfig {
  promptId: string
  scope: 'global' | 'role' | 'template'
  targetId?: string
  version: string
  content: string
  updatedAt: string
  isDefault: boolean
}
```

### 补充 API 契约

#### `POST /api/llm/providers/test`

测试 Provider 连接，不返回真实密钥或完整请求信息。

**Request**

```json
{
  "providerId": "custom",
  "baseUrl": "https://api.example.com/v1",
  "apiKey": "sk-***",
  "model": "custom-model",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "providerId": "custom",
    "status": "success",
    "latencyMs": 821,
    "checkedAt": "2026-06-04T00:00:00.000Z",
    "availableModels": ["custom-model"],
    "maskedKey": "sk-***1234"
  },
  "error": null,
  "requestId": "req_provider_test_001"
}
```

**错误码**

| code | 场景 | 前端处理 |
|---|---|---|
| `PROVIDER_NOT_CONFIGURED` | Provider 缺少必要配置 | 提示补全 BaseURL / API Key / Model |
| `PROVIDER_AUTH_FAILED` | 鉴权失败 | 提示检查 API Key，不展示原始密钥 |
| `PROVIDER_TIMEOUT` | 连接超时 | 提示网络或 BaseURL 问题 |
| `PROVIDER_MODEL_NOT_FOUND` | 模型不存在 | 提示更换模型或刷新模型列表 |
| `PROVIDER_TEST_FAILED` | 其他测试失败 | 展示错误摘要和重试入口 |

#### `GET /api/sessions/:sessionId/export?format=md`

导出指定会话为 Markdown。

**Response**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "format": "md",
    "filename": "session-sess_001.md",
    "content": "# 讨论导出\n\n## 议题\n...",
    "generatedAt": "2026-06-04T00:00:00.000Z",
    "sanitized": true
  },
  "error": null,
  "requestId": "req_export_001"
}
```

导出内容至少包含：

| 区块 | 内容 |
|---|---|
| 会话元信息 | sessionId、topic、template、status、createdAt、updatedAt |
| 角色信息 | Host、Expert、Critic 名称与角色类型，不导出 API Key |
| 消息记录 | host、character、user、system、event、invite 消息 |
| 事件与投票 | EventRecord、VoteRecord、选项、结果、触发时间 |
| 总结 | Director / Host 生成的阶段总结或最终总结 |
| 脱敏说明 | 标记导出已移除 Provider Secret 和敏感设置 |

### Step 6｜最终对齐验证

| 检查项 | 最终需求 | 蓝图 / 当前计划定义 | 状态 |
|---|---|---|---|
| 设置页定位 | 仍为 BottomNav 一级 Tab，承载 Provider、模型、Prompt、本地数据 | 当前导航基线将设置作为一级 Tab，迭代 9 对应设置能力 | ✅ 对齐 |
| 会话导出 | 从会话页导出指定 session，讨论详情页导出当前 session | 讨论页必须携带 sessionId，会话页负责跨会话管理 | ✅ 对齐 |
| Provider 支持 | 支持 OpenAI、Anthropic、Gemini、DeepSeek、Custom Provider | 蓝图要求 LLM 调用模块统一支持多 Provider 和 Custom Provider | ✅ 对齐 |
| LLMClient 边界 | 设置通过 `ModelConfigResolver` 和 LLMClient 消费，UI 不直接调 Provider | 蓝图要求业务组件不得直接调用 Provider API | ✅ 对齐 |
| 本地数据闭环 | 保存会话、模板、设置，支持导出和清理 | 蓝图本地数据层包含会话存储、模板缓存、设置存储、IndexedDB | ✅ 对齐 |
| API Key 安全 | Phase 1 不做复杂加密，但脱敏、write-only、不入日志、不导出、可清理 | 蓝图允许 Phase 1 暂不做 API Key 加密，同时要求后续处理安全边界 | ✅ 对齐 |
| 配置 UI 范围 | 只做必要设置，不做权限、计费、模板市场、Prompt 市场 | 蓝图红线要求配置 UI 不得拖慢核心体验验证 | ✅ 对齐 |
| 历史会话稳定性 | 新会话保存 runtimeConfig snapshot，历史会话不被全局设置污染 | 蓝图 Session 包含 RuntimeConfig，迭代 8 已要求模板快照保护历史会话 | ✅ 对齐 |

结论：最终需求与项目蓝图无方向背离，属于对迭代 9 实现边界和验收细节的补强；无需更新 `00-product-blueprint.md`。

