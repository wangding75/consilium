# 迭代 11：设置页信息架构、厂商配置、模板配置与数据安全

> 评审日期：2026-06-08  
> 评审结论：通过。本次复评将设置页信息架构收敛为「厂商配置 / 模板配置 / 数据安全」3 个一级入口；模型配置和 Prompt 配置不再作为设置页独立入口，改为跟随模板与角色配置。本需求作为迭代 11 独立落地，不并入迭代 9；该调整与产品蓝图无方向背离。  
> 修订来源：设置页实现走查与用户反馈；按用户要求从迭代 9 调整为迭代 11 独立需求。  
> 导航基线：底部一级导航为 `首页 / 会话 / 模板 / 设置`；讨论页保留为 `/discussion/[sessionId]` 会话详情页，不作为一级 Tab。

---

## 1. 迭代目标

完成设置页的真实可用配置闭环，使用户能够：

1. 管理 LLM 厂商连接，包括同一厂商的多个连接。
2. 在模板内管理角色、模型、Prompt、事件和节奏配置。
3. 管理本地数据、会话导出、设置导入导出和 API Key 安全策略。

本迭代的核心不是把所有配置平铺在设置首页，而是建立移动端可维护的信息架构：

```text
/settings
  ├─ 厂商配置
  ├─ 模板配置
  └─ 数据安全
```

---

## 2. 背景与现状问题

| 问题 | 现状表现 | 影响 | 修订结论 |
|---|---|---|---|
| 设置页入口过多 | Provider、模型、模板、Prompt、数据安全同时出现 | 移动端首屏复杂，用户难以判断入口 | 一级页只保留 3 个大按钮 |
| 厂商表单裸露在一级页 | 设置页底部直接显示 Provider 配置表单 | 破坏页面层级，且不支持多连接管理 | 厂商进入二级页，先列表后新增 |
| 模型配置和 Prompt 配置分散 | 全局模型、角色模型、Prompt 各自独立 | 与模板/角色能力重复，容易产生冲突 | 模型和 Prompt 跟随模板走 |
| 数据安全不完整 | 只有占位或泛化入口 | 无法验收导出、导入、清理、安全策略 | 独立数据安全二级页 |

---

## 3. 初步对齐检查

| 检查项 | 修订需求描述 | 蓝图 / 既有迭代定义 | 状态 |
|---|---|---|---|
| 设置页定位 | 设置页保留为 BottomNav 一级 Tab，只承载配置入口 | 当前导航基线为 `首页 / 会话 / 模板 / 设置`，设置页仍为一级 Tab；本次作为迭代 11 独立优化项 | ✅ 对齐 |
| Provider 能力 | 厂商配置支持 OpenAI、Anthropic、Gemini、DeepSeek、Custom，并允许同厂商多连接 | 蓝图要求 LLM 调用层统一支持多 Provider 和 Custom Provider 的 BaseURL、API Key、ModelList、Headers | ✅ 对齐 |
| 模板承载模型与 Prompt | 模型、Prompt 不在设置页单独平铺，而在模板/角色内配置 | 蓝图定义模板包含角色、事件、节奏和推荐模型；角色字段包含 systemPrompt、model、temperature | ✅ 对齐 |
| 配置页范围 | 设置页做可持续使用所需配置，不挤占讨论主线 | 蓝图红线要求不能前期被配置页拖慢，配置 UI 是后置能力 | ✅ 对齐 |
| 数据闭环 | 数据安全页覆盖导出、导入、清理、API Key 安全 | 既有设置与数据闭环能力已定义会话导出、API Key 安全；本迭代在此基础上收敛信息架构 | ✅ 对齐 |
| 会话导出 | 会话页和讨论详情页仍可导出具体 session | 既有数据闭环要求导出绑定具体 sessionId | ✅ 对齐 |
| 全局默认模型 | 不作为一级设置入口；可作为模板默认策略或 provider fallback 配置存在 | 迭代 8 已定义模板模型策略，既有设置需求中曾包含全局默认模型 | ⚠️ 范围调整：从全局入口降级为模板默认 / fallback |

---

## 4. 需求评审意见

### 4.1 完整性

| 问题 | 评审意见 | 修订建议 |
|---|---|---|
| 同一 Provider 多连接未覆盖 | 用户明确需要多个 OpenAI 链接 | 新增 ProviderConnection 概念，providerType 与 connectionId 分离 |
| 模型和 Prompt 归属必须明确 | 若仍保留全局模型、角色模型、Prompt 独立入口，会与模板配置冲突 | 删除设置首页独立入口；在模板详情的角色配置中维护 |
| 二级页交互需统一 | 设置页所有配置都应先列表再新增，避免进入就是表单 | 厂商、模板、数据安全均采用「列表页 + 右上角＋」模式 |
| 数据安全验收需具体 | 只写“数据安全”无法开发和测试 | 明确导出设置、导入设置、导出会话、清理数据、隐私说明 |
| Provider 测试要可解释 | 连接失败时用户需要知道是 Key、Base URL、模型列表还是网络问题 | 测试接口返回结构化错误码和 message |

### 4.2 合理性

| 检查点 | 结论 |
|---|---|
| 产品合理性 | 合理。设置首页收敛为 3 个大按钮，更符合移动端设置页的扫读和点击习惯。 |
| 技术合理性 | 合理。ProviderConnection、TemplateConfig、DataSecurityConfig 可分别由独立 service/repository 承载。 |
| 复杂度控制 | 合理。模型和 Prompt 归入模板，避免在设置页提前做复杂全局配置后台。 |
| 与既有迭代关系 | 合理。迭代 8 已负责模板、角色和模型策略，迭代 11 聚焦设置页信息架构重构与持久化闭环补强。 |

### 4.3 一致性

| 对象 | 结论 |
|---|---|
| 与迭代 0 | 对齐。迭代 0 已预留 settings、templates、llm/providers、settings storage 等骨架。 |
| 与迭代 8 | 对齐并补强。模板作为角色、模型、Prompt 的配置源，迭代 11 补充设置入口中的模板配置入口和数据持久化。 |
| 与蓝图 | 对齐。Provider、Template、Role、LLMConfig 均在蓝图中有对应模型。 |
| 与当前实现截图 | 存在偏差。当前页面仍有多入口和裸露表单，需要按本需求重构。 |

### 4.4 风险点

| 风险 | 等级 | 影响 | 应对 |
|---|---|---|---|
| Provider 与模型绑定混乱 | P0 | 模板角色选择模型时无法知道来自哪个连接 | 模型引用必须包含 `providerConnectionId + modelId` |
| 继续保留全局模型独立入口 | P0 | 与“模型跟随模板走”的产品原则冲突 | 设置首页禁止出现模型配置独立按钮 |
| Prompt 泄漏或误导出 | P1 | 用户敏感模板资产被泄漏 | 设置导出前明确范围，API Key 不导出；Prompt 可由用户选择是否导出 |
| 连接测试泄露 API Key | P1 | 安全风险 | 日志、错误、导出均不得包含明文 Key |
| 模板配置过复杂 | P1 | 迭代 11 变成大型模板编辑器 | 本迭代只做可用表单，不做复杂画布式模板编辑器 |

---

## 5. 最终需求

### 5.1 页面与路由

| 页面 | 路由建议 | 说明 |
|---|---|---|
| 设置首页 | `/settings` | 只展示 3 个大按钮 |
| 厂商配置列表 | `/settings/providers` | 展示所有 ProviderConnection |
| 新增 / 编辑厂商连接 | `/settings/providers/new`、`/settings/providers/:connectionId` | 表单配置连接 |
| 模板配置列表 | `/settings/templates` 或复用 `/templates` 管理态 | 展示可配置模板 |
| 新增 / 编辑模板 | `/settings/templates/:templateId` 或 `/templates/:templateId/edit` | 配置角色模型、Prompt、事件、节奏 |
| 数据安全 | `/settings/security` | 导入导出、清理、安全说明 |

---

### 5.2 前端需求

| 编号 | 需求 |
|---|---|
| FE-001 | 设置首页只保留 3 个大按钮：厂商配置、模板配置、数据安全 |
| FE-002 | 设置首页不得直接展示 Provider 表单、模型配置表单、Prompt 配置表单 |
| FE-003 | 点击厂商配置进入二级列表页，展示所有连接配置 |
| FE-004 | 厂商配置列表页右上角提供独立 “＋” 新增按钮 |
| FE-005 | 支持同一 providerType 下多个连接，例如多个 OpenAI 链接 |
| FE-006 | 厂商连接卡片展示连接名称、providerType、baseUrl、模型数量、启用状态、最近测试状态 |
| FE-007 | 点击连接卡片进入编辑页 |
| FE-008 | 新增 / 编辑厂商连接表单包含 providerType、displayName、baseUrl、apiKey、modelList、customHeaders、enabled |
| FE-009 | 厂商连接支持测试连接，测试中、成功、失败均有明确状态 |
| FE-010 | 点击模板配置进入模板列表页，展示模板名称、角色数、事件数、默认模型策略、配置状态 |
| FE-011 | 模板配置列表页右上角提供 “＋” 新增模板按钮 |
| FE-012 | 模板详情内配置模型和 Prompt：每个角色可选择 providerConnectionId、model、temperature、maxTokens、systemPrompt |
| FE-013 | 设置首页不再出现“全局默认模型”“角色专属模型”“Prompt 提示词配置”独立入口 |
| FE-014 | 模板详情支持模板默认模型策略，例如智能 fallback、质量优先、成本优先 |
| FE-015 | 点击数据安全进入二级页，展示设置导出、设置导入、会话导出、本地数据清理、隐私说明 |
| FE-016 | 清理本地数据前必须展示二次确认 |
| FE-017 | API Key 在所有页面默认脱敏展示 |
| FE-018 | 页面保持移动端单列布局，所有配置页均有返回按钮和明确保存按钮 |

---

### 5.3 后端 / API 需求

| 编号 | 需求 |
|---|---|
| BE-001 | 实现 `GET /api/llm/providers`，返回 provider 类型、连接数量和总体状态 |
| BE-002 | 实现 `GET /api/llm/provider-connections`，返回所有 ProviderConnection 列表 |
| BE-003 | 实现 `POST /api/llm/provider-connections`，新增厂商连接 |
| BE-004 | 实现 `PUT /api/llm/provider-connections/:connectionId`，更新厂商连接 |
| BE-005 | 实现 `DELETE /api/llm/provider-connections/:connectionId`，删除厂商连接，若已被模板引用需阻止或提示影响 |
| BE-006 | 实现 `POST /api/llm/provider-connections/:connectionId/test`，测试连接并返回结构化结果 |
| BE-007 | 实现 `GET /api/settings/templates`，返回可配置模板列表 |
| BE-008 | 实现 `GET /api/settings/templates/:templateId`，返回模板配置详情 |
| BE-009 | 实现 `PUT /api/settings/templates/:templateId`，保存模板配置 |
| BE-010 | 模板配置保存时校验角色引用的 providerConnectionId 和 model 是否存在且启用 |
| BE-011 | 实现 `GET /api/settings/export`，导出设置 JSON，默认不包含 API Key 明文 |
| BE-012 | 实现 `POST /api/settings/import`，导入设置 JSON，支持 dryRun 预检查 |
| BE-013 | 实现 `DELETE /api/settings/local-data`，清理本地数据或服务端本地仓储数据 |
| BE-014 | 保留 `GET /api/sessions/:sessionId/export?format=md`，用于指定会话导出 |
| BE-015 | LLMClient 调用模型时从模板角色配置读取 providerConnectionId 和 model；若缺失则使用模板默认策略 fallback |

---

### 5.4 数据结构

#### ProviderConnection

```ts
interface ProviderConnection {
  id: string
  providerType: 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'custom'
  displayName: string
  baseUrl: string
  apiKeyEncrypted?: string
  maskedKey?: string
  modelList: string[]
  customHeaders?: Record<string, string>
  enabled: boolean
  lastTestStatus?: 'untested' | 'success' | 'failed'
  lastTestAt?: string
  lastErrorCode?: string
  createdAt: string
  updatedAt: string
}
```

#### TemplateRoleRuntimeConfig

```ts
interface TemplateRoleRuntimeConfig {
  roleId: string
  providerConnectionId: string
  model: string
  temperature?: number
  maxTokens?: number
  systemPrompt: string
}
```

#### TemplateRuntimeConfig

```ts
interface TemplateRuntimeConfig {
  templateId: string
  defaultStrategy: 'smart_fallback' | 'quality_first' | 'cost_first'
  roleConfigs: TemplateRoleRuntimeConfig[]
  fallbackProviderConnectionId?: string
  fallbackModel?: string
}
```

---

### 5.5 API 契约示例

#### `GET /api/llm/provider-connections`

```json
{
  "success": true,
  "data": {
    "connections": [
      {
        "id": "conn_openai_main",
        "providerType": "openai",
        "displayName": "OpenAI 官方接口",
        "baseUrl": "https://api.openai.com/v1",
        "maskedKey": "sk-••••••••1234",
        "modelList": ["gpt-4.1-mini", "gpt-4.1"],
        "enabled": true,
        "lastTestStatus": "success"
      }
    ]
  },
  "error": null,
  "requestId": "req_provider_001"
}
```

#### `POST /api/llm/provider-connections/:connectionId/test`

```json
{
  "success": true,
  "data": {
    "connectionId": "conn_openai_main",
    "status": "success",
    "latencyMs": 320,
    "availableModels": ["gpt-4.1-mini", "gpt-4.1"]
  },
  "error": null,
  "requestId": "req_provider_test_001"
}
```

**错误码**

| code | 场景 |
|---|---|
| `PROVIDER_CONNECTION_NOT_FOUND` | 连接不存在 |
| `PROVIDER_BASE_URL_INVALID` | Base URL 非法 |
| `PROVIDER_API_KEY_INVALID` | API Key 不可用 |
| `PROVIDER_TEST_FAILED` | 测试失败 |
| `MODEL_NOT_AVAILABLE` | 模板引用了不存在或不可用模型 |
| `PROVIDER_CONNECTION_IN_USE` | 删除的连接仍被模板引用 |
| `IMPORT_SCHEMA_INVALID` | 导入设置结构不合法 |

---

### 5.6 安全与数据要求

| 编号 | 要求 |
|---|---|
| SEC-001 | API Key 前端展示必须脱敏 |
| SEC-002 | 真实 API Key 不进入日志、导出文件、错误 details |
| SEC-003 | 设置导出默认不包含 API Key 明文 |
| SEC-004 | 清理本地数据前必须二次确认 |
| SEC-005 | 删除 ProviderConnection 前必须检查模板引用关系 |
| SEC-006 | 导入设置支持 dryRun，先展示将新增、覆盖、冲突的配置 |
| SEC-007 | 会话导出不包含 API Key、customHeaders 中的敏感字段 |

---

## 6. 验收标准

| 类型 | 标准 |
|---|---|
| 产品 | 设置首页只展示厂商配置、模板配置、数据安全 3 个大按钮 |
| 产品 | 点击 3 个大按钮均能进入二级页面 |
| 产品 | 厂商配置二级页先展示连接列表，右上角有 “＋” 新增入口 |
| 产品 | 用户可配置多个 OpenAI 连接 |
| 产品 | 用户可新增、编辑、测试、禁用厂商连接 |
| 产品 | 模型配置和 Prompt 配置不作为设置首页独立入口出现 |
| 产品 | 用户可在模板详情中为角色配置模型和 Prompt |
| 产品 | 数据安全页可导出设置、导入设置、清理本地数据 |
| 产品 | API Key 脱敏展示，清理数据前有二次确认 |
| 技术 | ProviderConnection API 支持增删改查和测试连接 |
| 技术 | 模板角色配置能引用 providerConnectionId 和 model |
| 技术 | LLMClient 能按模板角色配置选择对应连接和模型 |
| 技术 | 删除被模板引用的 ProviderConnection 会被阻止或返回明确错误 |
| 技术 | 设置导出不包含 API Key 明文 |
| 技术 | 单元测试覆盖 ProviderConnection、模板引用校验、设置导入导出 |
| 技术 | e2e 覆盖设置首页 3 入口、厂商新增、模板角色模型配置、数据清理确认 |

---

## 7. 不包含范围

| 不包含 | 说明 |
|---|---|
| 复杂模板画布编辑器 | 后续产品化 |
| 模板市场 | 后续版本 |
| 多设备同步 | Phase 3 |
| 企业权限系统 | 后续版本 |
| API Key 云端托管加密方案 | 可预留接口，本迭代只要求不明文展示、不进日志、不导出 |
| Provider 用量计费统计 | 后续运营能力 |

---

## 8. 最终对齐验证

本次最终需求与项目蓝图无方向背离：

1. Provider 多连接配置属于蓝图 LLM 调用层的 Provider 抽象增强。
2. 模型和 Prompt 跟随模板/角色，符合蓝图中 Template、Role、LLMConfig 的对象关系。
3. 设置页收敛为 3 个入口，符合“配置 UI 不挤占 MVP 讨论主线”的红线。
4. 数据安全与导出闭环延续既有设置模块目标，并在迭代 11 独立验收。

结论：无需更新产品蓝图；本需求作为迭代 11 独立需求文档执行，迭代 9 文档不追加本次需求。
