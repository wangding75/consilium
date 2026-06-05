# 迭代 9：设置、Provider 与数据闭环 — 技术设计

## 1. 概述

本次设计在现有分层架构（Next.js API Routes → Server Services → Repositories）和 Mock 仓储模式的基础上，以**最小改动**的原则新增 Settings 模块。

核心方案：
1. 新建 `SettingsRepository` + `MockSettingsRepository`，统一存储 providerConfigs、modelDefaults、roleModelOverrides、promptConfigs
2. 新建 `SettingsService`，封装 Provider 状态查询与 Provider 连接测试
3. 新建 `ModelConfigResolver`，按优先级（角色覆盖 > 会话 runtimeConfig > 模板/策略默认 > 全局默认 > Provider 默认）解析 `ResolvedModelConfig`；LLMClient 只消费 `ResolvedModelConfig`
4. 新建 `SessionExportService`，从 Session + Message + EventRecord + VoteRecord 生成脱敏 Markdown
5. 新建相关 API 路由：`/api/llm/providers/test`、`/api/settings/model-defaults`、`/api/settings/role-models`、`/api/settings/prompts`、`/api/sessions/[sessionId]/export`
6. 改写 `src/modules/settings/index.tsx`（现为占位），实现完整设置页 UI

关键约束：
- API Key 和自定义 Header 值永不以明文返回（write-only），读取只返回 maskedKey / maskedHeaders
- `Session.runtimeConfig` 新会话写入快照；历史会话不受全局设置变更污染
- Prompt 配置支持 version / updatedAt / resetToDefault；角色 Prompt 修改不污染模板快照

---

## 2. Impact Analysis

| 模块 / 文件 | 影响程度 | 说明 |
|---|---|---|
| `src/types/index.ts` | 修改 | 新增 ProviderConfig、SettingsData、PromptConfig、GlobalModelDefaults、RoleModelOverride、ResolvedModelConfig（新建，不复用 ResolvedRoleRuntimeConfig，新增 providerId 字段）、SessionRuntimeConfigSnapshot |
| `src/types/api.ts` | 修改 | 新增 ProviderStatusDTO、ModelDefaultsDTO、RoleModelOverrideDTO、PromptConfigDTO、SessionExportResult、ProviderTestRequest、ProviderTestResult 等 API DTOs |
| `src/server/repositories/settings.repository.ts` | 新增 | SettingsRepository 接口 |
| `src/server/repositories/mock/mock-settings.repository.ts` | 新增 | MockSettingsRepository 实现 |
| `src/server/repositories/mock/instances.ts` | 修改 | 注册 MockSettingsRepository 单例 |
| `src/server/repositories/vote.repository.ts` | 修改 | 新增 findBySessionId() 方法，供 SessionExportService 使用 |
| `src/server/repositories/mock/mock-vote.repository.ts` | 修改 | 实现 findBySessionId()，新增 clearAll() |
| `src/server/repositories/session.repository.ts` | 修改 | 新增 clearAll() 方法，供 clearData 清理使用 |
| `src/server/repositories/mock/mock-session.repository.ts` | 修改 | 实现 clearAll() |
| `src/server/repositories/message.repository.ts` | 修改 | 新增 clearAll() 方法 |
| `src/server/repositories/mock/mock-message.repository.ts` | 修改 | 实现 clearAll() |
| `src/server/repositories/event.repository.ts` | 修改 | 新增 clearAll() 方法 |
| `src/server/repositories/mock/mock-event.repository.ts` | 修改 | 实现 clearAll() |
| `src/server/services/settings.service.ts` | 新增 | SettingsService 实现 Provider 列表/状态/测试 |
| `src/server/services/model-config-resolver.ts` | 新增 | ModelConfigResolver 五级优先级解析 |
| `src/server/services/session-export.service.ts` | 新增 | SessionExportService 生成脱敏 Markdown |
| `src/app/api/llm/providers/route.ts` | 修改 | GET 改从 SettingsService 返回含状态的 ProviderConfig 列表；新增 PUT handler（upsertProviderConfig） |
| `src/app/api/llm/providers/test/route.ts` | 新增 | POST /api/llm/providers/test |
| `src/app/api/settings/model-defaults/route.ts` | 新增 | GET + PUT /api/settings/model-defaults |
| `src/app/api/settings/role-models/route.ts` | 新增 | GET + PUT /api/settings/role-models |
| `src/app/api/settings/prompts/route.ts` | 新增 | GET + PUT /api/settings/prompts |
| `src/app/api/sessions/[sessionId]/export/route.ts` | 新增 | GET /api/sessions/[sessionId]/export?format=md |
| `src/server/services/session.service.ts` | 修改 | createSession 写入 runtimeConfig snapshot（SessionRuntimeConfigSnapshot） |
| `src/modules/settings/index.tsx` | 修改 | 替换占位，实现完整设置页 UI |
| `src/modules/sessions/index.tsx` | 修改 | 添加指定 session 导出入口 |
| `src/modules/discussion/index.tsx` | 修改 | 更多操作菜单添加当前 session 导出入口 |
| `src/llm/providers/base.provider.ts` | 修改 | 添加 testConnection() 方法 |

**兼容性分析**：
- 现有 `GET /api/llm/providers` 响应结构扩展（增加状态字段），向后兼容
- `Session` 类型新增 `runtimeConfigSnapshot` 可选字段，向后兼容
- `LLMConfig` / `ResolvedRoleRuntimeConfig` 不修改现有字段，向后兼容
- 现有 `ModelStrategyService.resolveRoleRuntimeConfig()` 不修改，新增 `ModelConfigResolver` 作为上层解析入口

---

## 3. Flow Design

### 3.1 Provider 状态查询与配置
```
用户打开设置页
  → SettingsModule 调用 GET /api/llm/providers
  → SettingsService.listProviders()
    → SettingsRepository.getProviderConfigs()
    → 返回 ProviderStatusDTO[]（含 maskedKey、lastTestStatus、lastTestedAt）
  → 渲染 Provider 状态卡片
  
用户点击 Provider 卡片 → ProviderSheet 展示可编辑字段
用户输入新 API Key + 点击保存
  → SettingsService.upsertProviderConfig()
    → 脱敏写入 SettingsRepository（写入 apiKeyRef，不存 明文）
    → 返回 maskedKey
  → 前端更新显示
  
用户点击"测试连接"
  → POST /api/llm/providers/test
  → SettingsService.testProvider()
    → 构造临时 LLMProvider 实例
    → 调用 provider.testConnection()
    → 保存 lastTestStatus / lastTestedAt（不记录 Key 到日志）
    → 返回 ProviderTestResult（含 maskedKey，无明文）
  → 前端展示成功/失败状态
```

### 3.2 模型配置与优先级解析
```
用户配置全局默认模型
  → PUT /api/settings/model-defaults → SettingsService.saveModelDefaults()
    → SettingsRepository.saveModelDefaults()
  → 新会话创建时：
    SessionService.createSession()
      → ModelConfigResolver.resolveForSession(template, modelStrategy, globalDefaults, roleOverrides)
      → 写入 session.runtimeConfigSnapshot
  → LLMClient 消费：
    → ModelConfigResolver.resolveForRole(roleId, session.runtimeConfigSnapshot)
    → 返回 ResolvedModelConfig { providerId, model, temperature, maxTokens, source }
```

优先级（高→低）：
1. 角色专属覆盖（RoleModelOverride）
2. 会话 runtimeConfigSnapshot（新会话创建时固化）
3. 模板/策略默认（TemplateModelDefaults / ModelStrategySnapshot）
4. 全局默认（GlobalModelDefaults）
5. Provider 默认

### 3.3 Prompt 配置
```
用户查看 Prompt
  → GET /api/settings/prompts → PromptConfig[]
用户编辑并确认
  → PUT /api/settings/prompts → SettingsService.updatePrompt()
    → 验证 content 非空、scope 合法
    → 写入 SettingsRepository，更新 version / updatedAt / isDefault=false
用户恢复默认
  → PUT /api/settings/prompts（body: { promptId, reset: true }）
    → SettingsService.resetPromptToDefault()
    → 从内置默认值恢复，isDefault=true，version 递增
```

### 3.4 会话导出
```
用户点击导出（会话页或讨论详情页）
  → 展示导出范围弹窗（消息数、格式说明、脱敏声明）
  → 用户确认 → 调用 GET /api/sessions/:sessionId/export?format=md
  → SessionExportService.exportToMarkdown(sessionId)
    → SessionRepository.findById(sessionId)
    → MessageRepository.findBySessionId(sessionId)
    → EventRepository.findBySessionId(sessionId)
    → VoteRepository.findBySessionId(sessionId)
    → 组装 Markdown（不包含任何 ProviderConfig / API Key）
    → 返回 { content, filename, sanitized: true }
  → 前端触发文件下载
```

### 3.5 本地数据清理
```
用户选择清理范围（会话 / 设置 / 全部）
  → 弹出影响范围说明 + 二次确认
  → 用户确认 → SettingsService.clearData(scope)
    → scope='sessions'：清空 MockSessionRepository + MockMessageRepository + MockEventRepository + MockVoteRepository
    → scope='settings'：清空 MockSettingsRepository
    → scope='all'：清空所有 Mock 仓储
```

### 3.6 异常流程
- API Key 无效：ProviderTestResult.status='failed', errorCode='PROVIDER_AUTH_FAILED'
- Provider 未配置（baseUrl/apiKey 缺失）：返回 PROVIDER_NOT_CONFIGURED
- 连接超时：返回 PROVIDER_TIMEOUT
- Session 不存在时导出：返回 404 NOT_FOUND
- Prompt content 为空：返回 VALIDATION_ERROR

---

## 4. Table Design

本项目使用 MockRepository（in-memory，globalThis 单例），无真实数据库。以下为数据模型定义：

### ProviderConfig（存储在 MockSettingsRepository）
| 字段 | 类型 | 说明 |
|---|---|---|
| providerId | string | 'openai' \| 'anthropic' \| 'gemini' \| 'deepseek' \| 'custom' |
| enabled | boolean | 是否启用 |
| baseUrl | string \| undefined | API 基础 URL |
| apiKeyRef | string \| undefined | 存储 key（内部，不对外返回明文） |
| modelList | string[] | 模型列表 |
| customHeaders | Record<string,string> \| undefined | 自定义 Headers（内部，不返回明文） |
| lastTestStatus | 'untested' \| 'success' \| 'failed' | 最近测试状态 |
| lastTestedAt | string \| undefined | ISO8601 |
| lastErrorCode | string \| undefined | 错误码 |
| lastErrorMessage | string \| undefined | 错误摘要 |

### GlobalModelDefaults（存储在 MockSettingsRepository）
| 字段 | 类型 | 说明 |
|---|---|---|
| providerId | string | 默认 Provider |
| model | string | 默认模型 |
| temperature | number | 温度 |
| maxTokens | number | 最大 tokens |

### RoleModelOverride（存储在 MockSettingsRepository）
| 字段 | 类型 | 说明 |
|---|---|---|
| roleId | string | 角色 ID |
| providerId | string \| undefined | 覆盖 Provider |
| model | string \| undefined | 覆盖模型 |
| temperature | number \| undefined | 覆盖温度 |
| maxTokens | number \| undefined | 覆盖 maxTokens |

### PromptConfig（存储在 MockSettingsRepository）
| 字段 | 类型 | 说明 |
|---|---|---|
| promptId | string | 唯一 ID |
| scope | 'global' \| 'role' | 作用域 |
| targetId | string \| undefined | roleId（scope=role 时） |
| version | string | 版本号（如 '1.0.0'） |
| content | string | Prompt 内容 |
| updatedAt | string | ISO8601 |
| isDefault | boolean | 是否为系统默认 |

### Session 扩展（runtimeConfigSnapshot）
Session 类型新增可选字段 `runtimeConfigSnapshot?: SessionRuntimeConfigSnapshot`：
| 字段 | 类型 | 说明 |
|---|---|---|
| globalDefaults | GlobalModelDefaults | 创建会话时的全局默认快照 |
| roleOverrides | RoleModelOverride[] | 创建会话时的角色覆盖快照 |
| snapshotAt | string | 快照时间 |

---

## 5. API Design

遵循 `/api-spec.md`：统一 `{ success, data, error, requestId }` 信封格式。

### 5.1 GET /api/llm/providers（扩展现有）

**Response**
```json
{
  "success": true,
  "data": [
    {
      "providerId": "openai",
      "enabled": true,
      "baseUrl": "https://api.openai.com/v1",
      "maskedKey": "sk-***1234",
      "modelList": ["gpt-4o", "gpt-4o-mini"],
      "maskedHeaders": {},
      "lastTestStatus": "success",
      "lastTestedAt": "2026-06-04T06:00:00.000Z",
      "lastErrorCode": null,
      "lastErrorMessage": null
    }
  ],
  "requestId": "..."
}
```
**错误码**：INTERNAL_ERROR

---

### 5.1b PUT /api/llm/providers（新增）

保存或更新 Provider 配置（write-only）。

**Request**
```json
{
  "providerId": "openai",
  "enabled": true,
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-xxx",
  "modelList": ["gpt-4o", "gpt-4o-mini"],
  "headers": { "X-Custom": "value" }
}
```
**Response**
```json
{
  "success": true,
  "data": {
    "providerId": "openai",
    "enabled": true,
    "maskedKey": "sk-***1234",
    "modelList": ["gpt-4o", "gpt-4o-mini"]
  },
  "requestId": "..."
}
```
**错误码**：VALIDATION_ERROR / INTERNAL_ERROR

---

### 5.2 POST /api/llm/providers/test

**Request**
```json
{
  "providerId": "custom",
  "baseUrl": "https://api.example.com/v1",
  "apiKey": "sk-xxx",
  "model": "custom-model",
  "headers": { "X-Custom": "value" }
}
```
**Response（成功）**
```json
{
  "success": true,
  "data": {
    "providerId": "custom",
    "status": "success",
    "latencyMs": 821,
    "checkedAt": "2026-06-04T06:00:00.000Z",
    "availableModels": ["custom-model"],
    "maskedKey": "sk-***xxx"
  }
}
```
**错误码**：PROVIDER_NOT_CONFIGURED / PROVIDER_AUTH_FAILED / PROVIDER_TIMEOUT / PROVIDER_MODEL_NOT_FOUND / PROVIDER_TEST_FAILED

---

### 5.3 GET /api/settings/model-defaults

**Response**
```json
{
  "success": true,
  "data": {
    "providerId": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "maxTokens": 512
  }
}
```
**错误码**：INTERNAL_ERROR

---

### 5.4 PUT /api/settings/model-defaults

**Request**
```json
{ "providerId": "openai", "model": "gpt-4o-mini", "temperature": 0.7, "maxTokens": 512 }
```
**Response**：返回更新后的 GlobalModelDefaults
**错误码**：VALIDATION_ERROR / INTERNAL_ERROR

---

### 5.5 GET /api/settings/role-models

**Response**
```json
{
  "success": true,
  "data": [
    { "roleId": "role_001", "providerId": "anthropic", "model": "claude-haiku-4-5-20251001", "temperature": 0.8, "maxTokens": 1024 }
  ]
}
```
**错误码**：INTERNAL_ERROR

---

### 5.6 PUT /api/settings/role-models

**Request**
```json
{ "overrides": [{ "roleId": "role_001", "model": "claude-haiku-4-5-20251001" }] }
```
**Response**：返回更新后的 RoleModelOverride[]
**错误码**：VALIDATION_ERROR / INTERNAL_ERROR

---

### 5.7 GET /api/settings/prompts

**Response**
```json
{
  "success": true,
  "data": [
    {
      "promptId": "global_system",
      "scope": "global",
      "version": "1.0.0",
      "content": "...",
      "updatedAt": "2026-06-04T00:00:00.000Z",
      "isDefault": true
    }
  ]
}
```
**错误码**：INTERNAL_ERROR

---

### 5.8 PUT /api/settings/prompts

**Request（编辑）**
```json
{ "promptId": "global_system", "content": "新 Prompt 内容" }
```
**Request（恢复默认）**
```json
{ "promptId": "global_system", "reset": true }
```
**Response**：返回更新后的 PromptConfig
**错误码**：NOT_FOUND / VALIDATION_ERROR / INTERNAL_ERROR

---

### 5.9 GET /api/sessions/[sessionId]/export?format=md

**Response**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "format": "md",
    "filename": "session-sess_001.md",
    "content": "# 讨论导出\n\n...",
    "generatedAt": "2026-06-04T06:00:00.000Z",
    "sanitized": true
  }
}
```
**错误码**：NOT_FOUND / INTERNAL_ERROR

---

## 6. Module Design

### SettingsRepository（接口）
```typescript
interface SettingsRepository {
  getProviderConfigs(): Promise<ProviderConfig[]>
  upsertProviderConfig(config: ProviderConfig): Promise<ProviderConfig>
  getModelDefaults(): Promise<GlobalModelDefaults | null>
  saveModelDefaults(defaults: GlobalModelDefaults): Promise<GlobalModelDefaults>
  getRoleModelOverrides(): Promise<RoleModelOverride[]>
  saveRoleModelOverrides(overrides: RoleModelOverride[]): Promise<RoleModelOverride[]>
  getPromptConfigs(): Promise<PromptConfig[]>
  savePromptConfig(prompt: PromptConfig): Promise<PromptConfig>
  clearAll(): Promise<void>  // 清空所有 Settings 数据
}
```

> **注意**：`clearData` 的多 Repository 清理职责完全在 `SettingsService` 层实现——Service 分别调用各 Repository 的 `clearAll()` 方法，SettingsRepository 只负责自身数据。

### SettingsService
依赖：`SettingsRepository`
```typescript
class SettingsService {
  listProviders(): Promise<ProviderStatusDTO[]>
  upsertProviderConfig(params): Promise<ProviderConfig>
  testProvider(params: ProviderTestRequest): Promise<ProviderTestResult>
  getModelDefaults(): Promise<GlobalModelDefaults | null>
  saveModelDefaults(defaults: GlobalModelDefaults): Promise<GlobalModelDefaults>
  getRoleModelOverrides(): Promise<RoleModelOverride[]>
  saveRoleModelOverrides(overrides: RoleModelOverride[]): Promise<RoleModelOverride[]>
  getPromptConfigs(): Promise<PromptConfig[]>
  updatePrompt(promptId: string, content: string): Promise<PromptConfig>
  resetPromptToDefault(promptId: string): Promise<PromptConfig>
  clearData(scope: 'sessions' | 'settings' | 'all'): Promise<void>
}
```

### ModelConfigResolver
无外部依赖，纯函数解析器
```typescript
class ModelConfigResolver {
  resolveForRole(
    roleId: string,
    runtimeConfigSnapshot: SessionRuntimeConfigSnapshot | undefined,
    templateDefaults: ModelDefaults,
    strategySnapshot: ModelStrategySnapshot | undefined,
    globalDefaults: GlobalModelDefaults | null,
    providerDefault?: string
  ): ResolvedModelConfig
}
// ResolvedModelConfig 返回 { providerId, model, temperature, maxTokens, source }
```

### SessionExportService
依赖：`SessionRepository`、`MessageRepository`、`EventRepository`、`VoteRepository`
```typescript
class SessionExportService {
  exportToMarkdown(sessionId: string): Promise<SessionExportResult>
}
```

### 模块依赖关系
```
API Routes → SettingsService → SettingsRepository (Mock)
API Routes → SessionExportService → SessionRepository / MessageRepository / EventRepository / VoteRepository
SessionService → ModelConfigResolver (在 createSession 中使用)
LLMClient → ModelConfigResolver → ResolvedModelConfig
```

---

## 7. Output Contract

| 产出 | 类型描述 | type id |
|---|---|---|
| GET /api/llm/providers | HTTP 端点，返回 Provider 状态列表 | web-e2e |
| POST /api/llm/providers/test | HTTP 端点，测试 Provider 连接 | web-e2e |
| PUT /api/settings/model-defaults | HTTP 端点，保存全局默认模型 | web-e2e |
| GET/PUT /api/settings/role-models | HTTP 端点，角色模型覆盖 | web-e2e |
| GET/PUT /api/settings/prompts | HTTP 端点，Prompt 配置 | web-e2e |
| GET /api/sessions/[sessionId]/export | HTTP 端点，会话导出 Markdown | web-e2e |
| ModelConfigResolver.resolveForRole() | 跨组件链路：RoleOverride→RuntimeSnapshot→TemplateDefaults→GlobalDefaults→ProviderDefault | integration |
| SessionExportService.exportToMarkdown() | 跨组件链路：SessionRepo→MessageRepo→EventRepo→VoteRepo | integration |
| SettingsModule UI | 前端页面，设置页完整布局 | frontend-ui |
| SessionsModule 导出入口 | 前端页面，会话页导出 | frontend-ui |
| DiscussionModule 导出入口 | 前端页面，讨论详情页导出 | frontend-ui |

**类型测试说明**（workflow.yaml features 包含 web-api，触发 web-e2e）：
- `web-e2e`：参考 `standards/testing/web-e2e.md`，启动真实 Next.js 服务，使用 curl 或 supertest 验证 HTTP 响应、状态码、脱敏字段
- `integration`：参考 `standards/testing/integration.md`，ModelConfigResolver 和 SessionExportService 的跨组件链路需端到端断言
- `frontend-ui`：设置页、导出入口的 UI 行为验证（此标记用于记录，05 阶段使用 browser 验证或注明 Known Issue）

---

## 8. Change Log

| 文件 | 变更类型 | 原因 |
|---|---|---|
| `src/types/index.ts` | 修改 | 新增 ProviderConfig、SettingsData、PromptConfig、GlobalModelDefaults、RoleModelOverride、SessionRuntimeConfigSnapshot、ResolvedModelConfig 类型 |
| `src/types/api.ts` | 修改 | 新增 ProviderStatusDTO、ProviderTestRequest、ProviderTestResult、ModelDefaultsDTO、RoleModelOverrideDTO、PromptConfigDTO、SessionExportResult API DTOs |
| `src/server/repositories/vote.repository.ts` | 修改 | 新增 findBySessionId() 和 clearAll() 方法签名 |
| `src/server/repositories/mock/mock-vote.repository.ts` | 修改 | 实现 findBySessionId() 和 clearAll() |
| `src/server/repositories/session.repository.ts` | 修改 | 新增 clearAll() 方法签名 |
| `src/server/repositories/mock/mock-session.repository.ts` | 修改 | 实现 clearAll() |
| `src/server/repositories/message.repository.ts` | 修改 | 新增 clearAll() 方法签名 |
| `src/server/repositories/mock/mock-message.repository.ts` | 修改 | 实现 clearAll() |
| `src/server/repositories/event.repository.ts` | 修改 | 新增 clearAll() 方法签名 |
| `src/server/repositories/mock/mock-event.repository.ts` | 修改 | 实现 clearAll() |
| `src/server/repositories/settings.repository.ts` | 新增 | SettingsRepository 接口定义 |
| `src/server/repositories/mock/mock-settings.repository.ts` | 新增 | MockSettingsRepository 实现 |
| `src/server/repositories/mock/instances.ts` | 修改 | 注册 sharedSettingsRepo 单例 |
| `src/server/services/settings.service.ts` | 新增 | SettingsService |
| `src/server/services/model-config-resolver.ts` | 新增 | ModelConfigResolver |
| `src/server/services/session-export.service.ts` | 新增 | SessionExportService |
| `src/app/api/llm/providers/route.ts` | 修改 | GET 改从 SettingsService，新增 PUT handler（upsertProviderConfig） |
| `src/app/api/llm/providers/test/route.ts` | 新增 | POST /api/llm/providers/test |
| `src/app/api/settings/model-defaults/route.ts` | 新增 | GET + PUT /api/settings/model-defaults |
| `src/app/api/settings/role-models/route.ts` | 新增 | GET + PUT /api/settings/role-models |
| `src/app/api/settings/prompts/route.ts` | 新增 | GET + PUT /api/settings/prompts |
| `src/app/api/sessions/[sessionId]/export/route.ts` | 新增 | GET /api/sessions/[sessionId]/export |
| `src/server/services/session.service.ts` | 修改 | createSession 写入 runtimeConfigSnapshot |
| `src/llm/providers/base.provider.ts` | 修改 | 添加 testConnection() 方法签名 |
| `src/modules/settings/index.tsx` | 修改 | 替换占位，实现完整设置页 UI |
| `src/modules/sessions/index.tsx` | 修改 | 添加会话导出入口 |
| `src/modules/discussion/index.tsx` | 修改 | 添加更多操作菜单的导出入口 |

> **不纳入本迭代的需求**：
> - **FR-020（设置导出 JSON，P2）**：延后至后续迭代。本迭代不实现 SettingsService.exportSettings() 及对应路由。
> - **FR-010 子需求"当前会话显式应用最新全局配置"**：本迭代只实现新会话写入 runtimeConfigSnapshot；已存在会话的配置刷新入口延后至后续迭代实现。

---

## 9. Development Tasks

- Task-01：定义 Settings 核心类型和 API DTOs
  - 任务类型：contract
  - 所属模块：src/types
  - 简要描述：在 types/index.ts 新增 ProviderConfig、GlobalModelDefaults、RoleModelOverride、PromptConfig、SessionRuntimeConfigSnapshot、ResolvedModelConfig（新类型，含 providerId/model/temperature/maxTokens/source 字段，独立于现有 ResolvedRoleRuntimeConfig）；在 types/api.ts 新增 ProviderStatusDTO、ProviderTestRequest、ProviderTestResult、ModelDefaultsDTO、RoleModelOverrideDTO、PromptConfigDTO、SessionExportResult
  - 涉及接口/方法：类型声明，无方法
  - 输入：无（类型定义）
  - 输出：导出类型供后续 Task 编译引用
  - 依赖任务：无
  - 数据操作：无
  - 修改边界：只在 src/types/index.ts 和 src/types/api.ts 末尾追加新类型，不修改已有类型
  - 禁止行为：不得修改已有类型定义；不得写业务逻辑；不得修改 ResolvedRoleRuntimeConfig
  - 产出类型：none
  - 功能类型：类型契约定义（type id: none）
  - 是否跨组件：否

- Task-02：扩展 Repository 接口并实现 MockSettingsRepository
  - 任务类型：contract
  - 所属模块：src/server/repositories
  - 简要描述：(a) 为 VoteRepository 接口新增 `findBySessionId(sessionId: string): Promise<VoteRecord[]>`，并在 MockVoteRepository 实现；(b) 为 SessionRepository、MessageRepository、EventRepository、VoteRepository 接口新增 `clearAll(): Promise<void>`，并在各 Mock 实现中添加；(c) 新建 settings.repository.ts 接口（含 clearAll()）；(d) 新建 mock-settings.repository.ts；(e) 在 instances.ts 末尾注册 sharedSettingsRepo 单例
  - 涉及接口/方法：VoteRepository.findBySessionId()、各 Repository.clearAll()、SettingsRepository 接口全部方法、MockSettingsRepository
  - 输入：ProviderConfig、GlobalModelDefaults、RoleModelOverride、PromptConfig
  - 输出：对应查询/写入结果
  - 依赖任务：Task-01（类型定义）
  - 数据操作：读写 in-memory Map（providerConfigs、modelDefaults、roleModelOverrides、promptConfigs）
  - 修改边界：在 vote.repository.ts、session.repository.ts、message.repository.ts、event.repository.ts 末尾追加方法签名；在对应 Mock 文件末尾追加实现；只新增 settings.repository.ts 和 mock-settings.repository.ts；只在 instances.ts 末尾追加 sharedSettingsRepo 相关代码
  - 禁止行为：不得删除或修改已有方法签名；不得在 instances.ts 删除或修改已有单例
  - 产出类型：none
  - 功能类型：Repository 契约扩展（type id: none）
  - 是否跨组件：否

- Task-03：实现 SettingsService（Provider 状态查询和配置）
  - 任务类型：business-implementation
  - 所属模块：src/server/services
  - 简要描述：新建 settings.service.ts，实现 listProviders（从 SettingsRepository 查询并脱敏 apiKey）、upsertProviderConfig（write-only 写入 apiKeyRef）、testProvider（调用 provider.testConnection()，保存 lastTestStatus/lastTestedAt，不记录 Key 到日志）
  - 涉及接口/方法：SettingsService.listProviders()、upsertProviderConfig()、testProvider()
  - 输入：ProviderTestRequest（providerId、baseUrl、apiKey、model、headers）
  - 输出：ProviderStatusDTO[]、ProviderConfig、ProviderTestResult
  - 依赖任务：Task-01（类型）、Task-02（SettingsRepository）、Task-10（LLMProvider.testConnection 接口）
  - 数据操作：读 SettingsRepository.getProviderConfigs()；写 SettingsRepository.upsertProviderConfig()
  - 修改边界：只新增 settings.service.ts；不修改已有 services
  - 禁止行为：不得在日志输出中记录真实 apiKey；不得返回 apiKeyRef 原始值；不得修改 llm.service.ts
  - 产出类型：integration
  - 功能类型：Provider 配置与状态管理（type id: integration）
  - 是否跨组件：是（组件链路：SettingsService → SettingsRepository → LLMProvider.testConnection）

- Task-04：实现 SettingsService（模型配置、Prompt、数据清理）
  - 任务类型：business-implementation
  - 所属模块：src/server/services
  - 简要描述：在 settings.service.ts 中追加 getModelDefaults、saveModelDefaults、getRoleModelOverrides、saveRoleModelOverrides、getPromptConfigs、updatePrompt（写入 version patch+1/updatedAt/isDefault=false）、resetPromptToDefault（从内置默认恢复，version patch+1，isDefault=true）、clearData（scope='sessions' 调用 SessionRepo/MessageRepo/EventRepo/VoteRepo.clearAll()；scope='settings' 调用 SettingsRepo.clearAll()；scope='all' 调用全部 clearAll()）
  - 涉及接口/方法：SettingsService 对应方法
  - 输入：GlobalModelDefaults、RoleModelOverride[]、PromptConfig 部分字段
  - 输出：对应更新后实体
  - 依赖任务：Task-02（SettingsRepository 及各 Repository.clearAll()）、Task-03（SettingsService 骨架已在同文件）
  - 数据操作：读写 SettingsRepository 所有集合；clearData 调用 SessionRepository/MessageRepository/EventRepository/VoteRepository/SettingsRepository 的 clearAll()
  - 修改边界：只在 settings.service.ts 末尾追加新方法，不重写已有方法
  - 禁止行为：不得重写 settings.service.ts；不得角色 Prompt 修改污染模板快照
  - 产出类型：integration
  - 功能类型：设置数据管理与清理（type id: integration）
  - 是否跨组件：是（组件链路：SettingsService.clearData → SessionRepository / MessageRepository / EventRepository / VoteRepository / SettingsRepository）

- Task-05：实现 ModelConfigResolver
  - 任务类型：business-implementation
  - 所属模块：src/server/services
  - 简要描述：新建 model-config-resolver.ts，实现 resolveForRole()，按优先级（角色覆盖 > 会话 runtimeConfigSnapshot > 模板/策略默认 > 全局默认 > Provider 默认）解析 ResolvedModelConfig，标注 source 字段
  - 涉及接口/方法：ModelConfigResolver.resolveForRole()
  - 输入：roleId、SessionRuntimeConfigSnapshot | undefined、ModelDefaults（模板）、ModelStrategySnapshot | undefined、GlobalModelDefaults | null、providerDefault?: string
  - 输出：ResolvedModelConfig { providerId, model, temperature, maxTokens, source }
  - 依赖任务：Task-01（类型）
  - 数据操作：无（纯函数）
  - 修改边界：只新增 model-config-resolver.ts
  - 禁止行为：不得修改 ModelStrategyService.resolveRoleRuntimeConfig()；不得引入外部状态
  - 产出类型：integration
  - 功能类型：模型配置优先级解析（type id: integration）
  - 是否跨组件：是（组件链路：RoleOverride → SessionSnapshot → TemplateDefaults → GlobalDefaults → ProviderDefault）

- Task-06：实现 SessionExportService
  - 任务类型：business-implementation
  - 所属模块：src/server/services
  - 简要描述：新建 session-export.service.ts，实现 exportToMarkdown(sessionId)：从 SessionRepository 读会话，从 MessageRepository 读消息，从 EventRepository 读事件，从 VoteRepository 读投票，组装脱敏 Markdown，返回 SessionExportResult
  - 涉及接口/方法：SessionExportService.exportToMarkdown()
  - 输入：sessionId: string
  - 输出：SessionExportResult { sessionId, format, filename, content, generatedAt, sanitized }
  - 依赖任务：Task-01（类型）
  - 数据操作：读 SessionRepository.findById()；读 MessageRepository.findBySessionId()；读 EventRepository.findBySessionId()；读 VoteRepository.findBySessionId()
  - 修改边界：只新增 session-export.service.ts
  - 禁止行为：不得在 content 中包含任何 ProviderConfig 字段、apiKeyRef、customHeaders 原始值；不得修改已有 Repository 接口
  - 产出类型：integration
  - 功能类型：会话 Markdown 导出（type id: integration）
  - 是否跨组件：是（组件链路：SessionExportService → SessionRepository → MessageRepository → EventRepository → VoteRepository）

- Task-07：实现 Settings API 路由（Provider + Model + Prompt）
  - 任务类型：api
  - 所属模块：src/app/api
  - 简要描述：(a) 修改 api/llm/providers/route.ts：GET 改用 SettingsService.listProviders()，新增 PUT handler 调用 SettingsService.upsertProviderConfig()；(b) 新建 api/llm/providers/test/route.ts（POST）；(c) 新建 api/settings/model-defaults/route.ts（GET+PUT）；(d) 新建 api/settings/role-models/route.ts（GET+PUT）；(e) 新建 api/settings/prompts/route.ts（GET+PUT）；所有路由遵循 api-spec.md 统一信封格式
  - 涉及接口/方法：NextResponse.json()，SettingsService 各方法
  - 输入：HTTP 请求体（各 DTO）
  - 输出：ApiResponse<T> 统一信封
  - 依赖任务：Task-03、Task-04（SettingsService 方法）
  - 数据操作：通过 SettingsService 间接读写 SettingsRepository
  - 修改边界：只修改 api/llm/providers/route.ts（扩展 GET handler，新增 PUT handler）；只新增其余路由文件；不修改其他 API 路由
  - 禁止行为：不得在路由层写业务逻辑；不得返回 apiKeyRef 原始值
  - 产出类型：web-e2e
  - 功能类型：Settings HTTP API（type id: web-e2e）
  - 是否跨组件：是（组件链路：HTTP Route → SettingsService → SettingsRepository）

- Task-08：实现会话导出 API 路由
  - 任务类型：api
  - 所属模块：src/app/api/sessions
  - 简要描述：新建 src/app/api/sessions/[sessionId]/export/route.ts，GET /api/sessions/[sessionId]/export?format=md，调用 SessionExportService.exportToMarkdown()
  - 涉及接口/方法：SessionExportService.exportToMarkdown()
  - 输入：sessionId（路径参数）、format（查询参数，只支持 'md'）
  - 输出：ApiResponse<SessionExportResult>；SessionId 不存在返回 404 NOT_FOUND
  - 依赖任务：Task-06（SessionExportService）
  - 数据操作：通过 SessionExportService 间接读多个 Repository
  - 修改边界：只新增 src/app/api/sessions/[sessionId]/export/route.ts
  - 禁止行为：不得修改已有 session 路由；导出内容中不得含 Provider Secret
  - 产出类型：web-e2e
  - 功能类型：会话导出 HTTP API（type id: web-e2e）
  - 是否跨组件：是（组件链路：HTTP Route → SessionExportService → 多 Repository）

- Task-09：SessionService 写入 runtimeConfigSnapshot
  - 任务类型：business-implementation
  - 所属模块：src/server/services
  - 简要描述：修改 session.service.ts 的 createSession() 方法，在创建新会话时调用 SettingsService.getModelDefaults() 和 getRoleModelOverrides()，构造 SessionRuntimeConfigSnapshot 写入 session.runtimeConfigSnapshot
  - 涉及接口/方法：SessionService.createSession()
  - 输入：CreateSessionParams（含 templateId、topic、modelStrategyId?）
  - 输出：CreateSessionResult（session 包含 runtimeConfigSnapshot）
  - 依赖任务：Task-01（SessionRuntimeConfigSnapshot 类型）、Task-04（SettingsService.getModelDefaults/getRoleModelOverrides）
  - 数据操作：读 SettingsRepository（通过 SettingsService）；写 SessionRepository（追加 runtimeConfigSnapshot 字段）
  - 修改边界：只修改 session.service.ts 的 createSession() 方法体，追加 snapshot 写入逻辑；不得重写文件
  - 禁止行为：不得修改 updateStatus/updateState 等其他方法；不得改变 CreateSessionResult 已有字段含义
  - 产出类型：integration
  - 功能类型：会话配置快照（type id: integration）
  - 是否跨组件：是（组件链路：SessionService.createSession → SettingsService → SettingsRepository）

- Task-10：LLMProvider.testConnection 接口
  - 任务类型：contract
  - 所属模块：src/llm/providers
  - 简要描述：在 base.provider.ts 的 LLMProvider 接口添加 testConnection() 方法签名（可选），供 SettingsService.testProvider() 调用
  - 涉及接口/方法：LLMProvider.testConnection()
  - 输入：无（使用构造时注入的配置）
  - 输出：{ status: 'success' | 'failed'; latencyMs: number; availableModels: string[]; errorCode?: string; errorMessage?: string }
  - 依赖任务：无
  - 数据操作：无
  - 修改边界：只在 LLMProvider 接口末尾追加 testConnection?() 可选方法
  - 禁止行为：不得修改已有 chat() 方法签名；不得实现真实网络调用（骨架阶段只声明接口）
  - 产出类型：none
  - 功能类型：LLM Provider 测试接口契约（type id: none）
  - 是否跨组件：否

- Task-11：实现设置页 UI（SettingsModule）
  - 任务类型：ui
  - 所属模块：src/modules/settings
  - 简要描述：改写 src/modules/settings/index.tsx，实现五个分组（Provider 状态、模型配置、模板管理占位、Prompt 配置、本地数据）；Provider 状态卡片调用 GET /api/llm/providers；ProviderSheet（配置 + 测试）；GlobalModelDefaultsSheet；RoleModelOverridesSheet（展示优先级说明）；PromptConfigSheet（查看/编辑/恢复默认）；DataManagementSection（三种清理范围 + 二次确认）
  - 涉及接口/方法：React 组件，调用各 API 路由
  - 输入：用户交互
  - 输出：UI 渲染和 API 调用
  - 依赖任务：Task-07（Settings API 路由已有）
  - 数据操作：通过 fetch 调用 /api/llm/providers、/api/settings/* API
  - 修改边界：只替换 src/modules/settings/index.tsx 全部内容（当前仅为占位代码）
  - 禁止行为：不得直接调用 Provider API；不得在前端存储明文 API Key；不得硬编码"全部正常"状态
  - 产出类型：frontend-ui
  - 功能类型：设置页 UI（type id: frontend-ui）
  - 是否跨组件：否

- Task-12：会话页和讨论详情页导出 UI
  - 任务类型：ui
  - 所属模块：src/modules/sessions, src/modules/discussion
  - 简要描述：在 sessions/index.tsx 每个 session 行添加导出按钮，点击后展示导出范围弹窗（消息数、格式说明、脱敏声明），确认后调用 GET /api/sessions/:sessionId/export?format=md 并触发下载；在 discussion/index.tsx 更多操作菜单添加当前 session 导出，逻辑相同
  - 涉及接口/方法：fetch('/api/sessions/[id]/export?format=md')
  - 输入：用户点击导出
  - 输出：触发 Markdown 文件下载
  - 依赖任务：Task-08（会话导出 API 路由）
  - 数据操作：通过 fetch 调用 /api/sessions/[sessionId]/export
  - 修改边界：只在 sessions/index.tsx 对应 session 行添加导出按钮和弹窗逻辑；只在 discussion/index.tsx 更多操作菜单追加导出选项；不得重写页面其他功能
  - 禁止行为：不得修改已有的会话列表加载、状态切换逻辑；不得在前端重组装导出内容（由服务端生成）
  - 产出类型：frontend-ui
  - 功能类型：导出入口 UI（type id: frontend-ui）
  - 是否跨组件：否

---

## 安全设计（补充章节）

| 机制 | 实现方式 |
|---|---|
| API Key write-only | SettingsRepository 存储 apiKeyRef；listProviders / upsertProviderConfig 只返回 maskedKey（`sk-***后4位`）|
| 日志脱敏 | SettingsService.testProvider() 不将 apiKey 传入 ServiceError.details；Next.js 路由层不 console.log request body |
| 导出脱敏 | SessionExportService 明确排除所有 ProviderConfig 字段；生成内容含 sanitized: true 标记 |
| 清理确认 | 前端弹出确认弹窗；清理 Provider 设置额外警告"真实模型将不可用" |
