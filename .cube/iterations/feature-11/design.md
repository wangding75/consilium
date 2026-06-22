# 迭代 11 技术设计：设置页信息架构、厂商多连接、模板配置与数据安全

## 1. 概述

本次设计要把当前 iteration-9 风格的设置页，调整为 iteration-11 需要的三入口信息架构，并在现有本地优先、Mock Repository、Next.js API Route 体系上补齐三条能力链路：

1. 厂商配置从 `providerId` 单实例配置升级为 `connectionId` 多连接配置。
2. 模型与 Prompt 配置从设置首页独立入口收拢到模板/角色运行配置中。
3. 数据安全页统一承载设置导入导出、会话导出、本地清理与敏感信息保护说明。

整体方案遵循最小改动原则：

- 保留 `src/app/settings/page.tsx -> SettingsModule` 作为设置入口，不新增新的顶层设置路由。
- 复用现有 `/api/templates`、`/api/templates/[templateId]`、`/api/templates/[templateId]/roles` 读取链路，不重做模板读接口。
- 保留现有 `TemplateService` / `TemplateRepository` / `MockTemplateRepository` 体系，在其上补齐模板管理写接口。
- 保留现有 `SettingsService` / `SettingsRepository` / `MockSettingsRepository` 体系，在其上把 provider 配置抽象扩展为 provider connection 管理。
- 对现有带 `x-template-config-api-key` 的模板角色配置 PATCH 路由不做兼容性破坏；设置页新增本地 UI 专用写入口，避免直接修改现有显式授权契约。

**关键约束：**

- 不修改 `docs/requirements/` 下原始需求文档。
- 不引入新的状态管理库、表单库或后端依赖。
- 不引入服务器数据库；数据仍通过现有本地 Mock Repository / 本地存储抽象维护。
- API Key、Custom Header 值在列表、测试结果、导出结果、错误信息中一律脱敏。
- 删除已被模板角色引用的连接时必须阻止删除，并返回引用详情。
- 导入设置必须先预检查，再显式确认导入，不允许静默覆盖。

## 2. Impact Analysis

### 受影响模块

| 模块 | 路径 | 影响程度 | 说明 |
|------|------|---------|------|
| settings 页面模块 | `src/modules/settings/index.tsx` | **修改** | 由旧的多分组占位页改为三入口首页 + 二级视图切换容器 |
| settings 组件 | `src/modules/settings/ProviderSheet.tsx` | **修改** | 复用为连接编辑器，输入从 `providerId` 升级为 `connectionId?` + `providerType` |
| templates 页面模块 | `src/modules/templates/index.tsx` | **修改** | 复用模板列表/详情/角色列表展示能力，并增加设置入口下的管理动作 |
| settings API | `src/app/api/settings/**` | **新增/修改** | 新增 provider-connections、templates、export/import 系列路由；复用 clear 路由 |
| templates API | `src/app/api/templates/**` | **无影响（读取）** | 列表/详情/角色读取继续复用现有实现 |
| settings service | `src/server/services/settings.service.ts` | **修改** | 新增连接 CRUD、删除前引用检查、设置导入导出、会话批量导出能力 |
| template service | `src/server/services/template.service.ts` | **修改** | 新增模板创建、模板基础信息更新、角色新增/复制/删除、角色运行配置更新能力 |
| settings repository | `src/server/repositories/settings.repository.ts` | **修改** | 仓储契约从 `ProviderConfig[]` 扩展到 `ProviderConnection[]`、导入导出、删除检查 |
| template repository | `src/server/repositories/template.repository.ts` | **修改** | 扩展模板管理写接口 |
| mock settings repository | `src/server/repositories/mock/mock-settings.repository.ts` | **修改** | 存储键从 `providerId` 转为 `connectionId`，并保存模板运行配置快照/导入导出中间结果 |
| mock template repository | `src/server/repositories/mock/mock-template.repository.ts` | **修改** | 补齐模板与角色管理写入逻辑 |
| 类型定义 | `src/types/index.ts`, `src/types/api.ts` | **修改** | 新增 provider connection、template runtime、settings import/export 契约 |
| 其他模块 | `discussion`, `sessions`, `engine`, `llm` | **读依赖 / 无代码变更** | 不修改讨论主链路代码，但会读取 session/message/event/vote 数据用于批量导出，并在连接测试链路中依赖现有 provider 调用约定 |

### 复用方案比较

| 方案 | 描述 | 改动范围 | 问题 | 结论 |
|------|------|---------|------|------|
| A | 在 `/settings` 下完全新建模板管理读写链路 | 最大 | 与现有 `/api/templates`、`TemplateService` 重复 | 不选 |
| B | 直接改现有 `/api/templates/[templateId]/roles/[roleId]/config`，去掉 header 授权 | 中等 | 会破坏已有显式授权契约 | 不选 |
| C | 复用现有模板读取链路，新增 settings 专用模板写接口；复用 settings service 承载连接和数据安全 | **最小** | 需要少量新 API 路由，但不破坏现有读路径 | **采用** |

### 接口兼容性

- 现有 `/api/templates`、`/api/templates/[templateId]`、`/api/templates/[templateId]/roles` 保持不变，前端老调用方继续可用。
- 现有 `/api/llm/providers` 与 `/api/llm/providers/test` 在本迭代后不再作为设置页主入口；为降低 02 阶段骨架风险，保留旧接口不删除。
- 新的设置页写能力统一通过 `/api/settings/**` 暴露，不要求旧模板写接口变更授权方式。
- `src/types/index.ts` 中新增的 `ProviderConnection`、`TemplateRuntimeConfig` 等契约与旧 `ProviderConfig` 并存，04 阶段逐步把实现迁移到新契约上。

### 数据兼容性

- 无 SQL 表结构变更；项目仍为本地存储/Mock Repository。
- `MockSettingsRepository` 的 provider 存储从 `Map<providerId, ProviderConfig>` 迁移为 `Map<connectionId, ProviderConnection>`，需要在读取时为旧 provider 配置提供一次性兼容映射。
- 模板运行配置优先保存在模板角色 `runtimeConfig` 中；旧 `GlobalModelDefaults` / `RoleModelOverride` / `PromptConfig` 数据在 04 阶段由迁移逻辑合并到模板维度配置。
- 设置导出 JSON 只输出脱敏连接信息和可恢复配置，不输出原始 `apiKeyRef` 或 header 值。

## 3. Flow Design

### 3.1 设置首页与二级视图切换

```
用户进入 /settings
  -> SettingsModule 加载 settings home 视图
  -> 页面只展示三个入口卡片：厂商配置 / 模板配置 / 数据安全
  -> 用户点击任一入口
     -> 切换 activeView
     -> 渲染对应二级视图
  -> 用户点击二级页返回
     -> activeView 回到 home
```

- `SettingsModule` 只负责视图切换、返回栈、共享刷新信号。
- 不新增新的 Next.js page；保持移动端单列视图切换，符合原型与现有设置页入口方式。

### 3.2 厂商连接管理流程

```
进入厂商配置页
  -> GET /api/settings/provider-connections
  -> 展示 connection card 列表（displayName / providerType / baseUrl / modelCount / enabled / lastTestStatus）
  -> 点击 +
     -> 打开空白连接编辑器
  -> 点击已有连接卡片
     -> 打开编辑器并加载该连接
  -> 保存
     -> 新建时 POST /api/settings/provider-connections
     -> 编辑时 PATCH /api/settings/provider-connections/[connectionId]
     -> SettingsService 校验字段 -> Repository 保存 -> 返回脱敏 DTO
     -> UI 关闭编辑器并刷新列表
  -> 测试连接
     -> 新建/未保存场景：POST /api/settings/provider-connections/test （提交当前表单）
     -> 已保存场景：POST /api/settings/provider-connections/[connectionId]/test （服务端读取已保存密钥）
     -> 返回 success/failed + latency + availableModels + masked values
  -> 删除连接
     -> DELETE /api/settings/provider-connections/[connectionId]
     -> SettingsService 先检查模板引用
     -> 若有引用则返回 CONNECTION_IN_USE + references[]
     -> 无引用则删除并刷新列表
```

### 3.3 模板配置流程

```
用户点击模板配置
  -> 复用 GET /api/templates 拉取模板摘要列表
  -> 点击模板卡片
     -> 复用 GET /api/templates/[templateId] 拉取详情
     -> 复用 GET /api/templates/[templateId]/roles 拉取角色列表
  -> 新增模板
     -> POST /api/settings/templates
  -> 编辑模板基础配置（name/description/defaultStrategy/...）
     -> PATCH /api/settings/templates/[templateId]
  -> 新增角色
     -> POST /api/settings/templates/[templateId]/roles
  -> 编辑角色运行配置（providerConnectionId/model/temperature/maxTokens/systemPrompt/includedInDefaultQueue/enabled）
     -> PATCH /api/settings/templates/[templateId]/roles/[roleId]
  -> 复制角色
     -> POST /api/settings/templates/[templateId]/roles/[roleId]/copy
  -> 删除角色
     -> DELETE /api/settings/templates/[templateId]/roles/[roleId]
```

关键设计点：

- 模板**读取**继续走现有 template API。
- 模板**写入**统一走 settings 专用管理路由，内部调用 `TemplateService` 新增的 admin 方法。
- 设置页模式下不使用现有 `x-template-config-api-key` header 授权；因为 `api-spec.md` 已声明 MVP 无鉴权，本地 UI 管理接口直接走本地调用。
- 若未来需要恢复显式授权，可在 settings admin route 外层单独加开关，不影响当前读写拆分结构。

### 3.4 数据安全流程

```
进入数据安全页
  -> 展示：设置导出 / 设置导入 / 会话导出 / 本地清理 / 隐私说明
  -> 导出设置
     -> GET /api/settings/export
     -> 返回 SettingsExportBundle（不含明文 key）
  -> 选择导入文件
     -> POST /api/settings/import/preview
     -> 返回 additions / updates / conflicts / invalidItems + previewToken
     -> 用户确认后 POST /api/settings/import（必须携带 previewToken）
  -> 导出全部会话 Markdown
     -> GET /api/settings/export/sessions
     -> 返回多会话 markdown bundle
  -> 清理本地数据
     -> 复用 POST /api/settings/clear
     -> 二次确认后按 scope 执行（支持 cache / sessions / settings / all）
```

### 3.5 异常流程处理

- 连接保存失败：返回 `VALIDATION_ERROR` / `INTERNAL_ERROR`，UI 保留原输入，不清空 API Key 输入框。
- 连接测试失败：返回 `PROVIDER_AUTH_FAILED`、`PROVIDER_TIMEOUT`、`PROVIDER_TEST_FAILED` 等错误码；响应中不得包含明文 key。
- 删除连接失败：若被引用，返回 `CONNECTION_IN_USE` 和引用链 `template -> role`。
- 导入预检查失败：返回 `INVALID_IMPORT_FILE` 或 `VALIDATION_ERROR`，不写入任何配置。
- 导入确认失败：必须整体回滚，不允许部分静默覆盖。
- 删除角色失败：主控角色或最后一个 host 角色时返回 `ROLE_DELETE_FORBIDDEN`。
- 所有 settings 导出接口都必须过滤掉明文 key 和敏感 header 值。

## 4. Table Design

项目无数据库表；本次只扩展本地设置存储的领域结构。

### 4.1 ProviderConnection 存储模型

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | string | 必填，唯一 | 连接主键（`connectionId`） |
| `providerType` | `'openai' \| 'anthropic' \| 'gemini' \| 'deepseek' \| 'custom'` | 必填 | 厂商类型 |
| `displayName` | string | 必填 | 列表展示名称 |
| `baseUrl` | string | 必填 | API 基础地址 |
| `apiKeyRef` | string | 可选 | 仅内部存储，外部输出必须脱敏 |
| `modelList` | string[] | 必填 | 可选模型列表 |
| `customHeaders` | `Record<string, string>` | 可选 | 仅内部存储，外部输出必须脱敏 |
| `enabled` | boolean | 必填 | 是否启用 |
| `lastTestStatus` | `'untested' \| 'success' \| 'failed'` | 必填 | 最近测试状态 |
| `lastTestAt` | string | 可选 | 最近测试时间 |
| `lastErrorCode` | string | 可选 | 最近测试错误码 |
| `lastErrorMessage` | string | 可选 | 最近测试错误摘要 |
| `createdAt` | string | 必填 | 创建时间 |
| `updatedAt` | string | 必填 | 更新时间 |

### 4.2 TemplateRuntimeConfig 存储模型

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `templateId` | string | 必填，唯一 | 模板主键 |
| `defaultStrategy` | `smart_fallback \| quality_first \| cost_first` | 必填 | 模板默认策略 |
| `fallbackProviderConnectionId` | string | 可选 | fallback 连接 |
| `fallbackModel` | string | 可选 | fallback 模型 |
| `roleConfigs` | `TemplateRoleRuntimeConfig[]` | 必填 | 角色运行配置列表 |

### 4.3 导出/导入中间结构

- `SettingsExportBundle`：导出 Settings 时的最终 JSON 结构。
- `SettingsImportPreview`：导入预检查结果，仅描述增量与冲突，不写入数据。
- 无新增索引与 SQL 约束；唯一性和引用检查在 Service 层完成。

## 5. API Design

### 5.1 厂商连接管理 API

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/settings/provider-connections` | 获取全部连接列表 |
| POST | `/api/settings/provider-connections` | 新增连接 |
| PATCH | `/api/settings/provider-connections/[connectionId]` | 更新连接 |
| DELETE | `/api/settings/provider-connections/[connectionId]` | 删除连接 |
| POST | `/api/settings/provider-connections/test` | 测试当前表单连接 |
| POST | `/api/settings/provider-connections/[connectionId]/test` | 测试已保存连接 |

#### GET /api/settings/provider-connections

- Response `200`
  ```ts
  ApiResponse<{
    connections: ProviderConnectionDTO[]
  }>
  ```
- 错误码：`INTERNAL_ERROR`

#### POST /api/settings/provider-connections

- Request
  ```ts
  interface CreateProviderConnectionRequest {
    providerType: ProviderType
    displayName: string
    baseUrl: string
    apiKey?: string
    modelList: string[]
    customHeaders?: Record<string, string>
    enabled: boolean
  }
  ```
- Response `200`
  ```ts
  ApiResponse<ProviderConnectionDTO>
  ```
- 错误码：
  - `VALIDATION_ERROR`
  - `INVALID_BASE_URL`
  - `INVALID_MODEL_LIST`
  - `INVALID_CUSTOM_HEADERS`
  - `CONNECTION_NAME_CONFLICT`
  - `INTERNAL_ERROR`

#### PATCH /api/settings/provider-connections/[connectionId]

- Request
  ```ts
  interface UpdateProviderConnectionRequest {
    displayName?: string
    baseUrl?: string
    apiKey?: string
    modelList?: string[]
    customHeaders?: Record<string, string>
    enabled?: boolean
  }
  ```
- Response `200`: `ApiResponse<ProviderConnectionDTO>`
- 错误码：
  - `NOT_FOUND`
  - `VALIDATION_ERROR`
  - `INVALID_BASE_URL`
  - `INVALID_MODEL_LIST`
  - `INVALID_CUSTOM_HEADERS`
  - `CONNECTION_NAME_CONFLICT`
  - `INTERNAL_ERROR`

#### DELETE /api/settings/provider-connections/[connectionId]

- Response `200`
  ```ts
  ApiResponse<{
    deletedConnectionId: string
  }>
  ```
- 错误码：
  - `NOT_FOUND`
  - `CONNECTION_IN_USE`
  - `INTERNAL_ERROR`

#### POST /api/settings/provider-connections/test

- Request
  ```ts
  interface ProviderConnectionTestRequest {
    providerType: ProviderType
    baseUrl: string
    apiKey?: string
    model?: string
    customHeaders?: Record<string, string>
  }
  ```
- Response `200`
  ```ts
  ApiResponse<ProviderConnectionTestResult>
  ```
- 错误码：
  - `VALIDATION_ERROR`
  - `INVALID_BASE_URL`
  - `PROVIDER_AUTH_FAILED`
  - `PROVIDER_TIMEOUT`
  - `PROVIDER_MODEL_NOT_FOUND`
  - `PROVIDER_TEST_FAILED`
  - `INTERNAL_ERROR`

#### POST /api/settings/provider-connections/[connectionId]/test

- Response `200`: `ApiResponse<ProviderConnectionTestResult>`
- 错误码：
  - `NOT_FOUND`
  - `PROVIDER_AUTH_FAILED`
  - `PROVIDER_TIMEOUT`
  - `PROVIDER_MODEL_NOT_FOUND`
  - `PROVIDER_TEST_FAILED`
  - `INTERNAL_ERROR`

### 5.2 模板配置管理 API

读取接口继续复用，但 `GET /api/templates` 的模板摘要结果需要以**向后兼容的增量字段**补充 `defaultStrategy` 和 `configStatus`，以满足模板配置页展示要求。

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/templates` | 模板摘要列表（增量补充策略与配置状态） |
| GET | `/api/templates/[templateId]` | 模板详情 |
| GET | `/api/templates/[templateId]/roles` | 角色列表 |

新增写接口：

| Method | Path | 用途 |
|--------|------|------|
| POST | `/api/settings/templates` | 新增模板 |
| PATCH | `/api/settings/templates/[templateId]` | 更新模板基础配置与默认策略 |
| POST | `/api/settings/templates/[templateId]/roles` | 新增角色 |
| PATCH | `/api/settings/templates/[templateId]/roles/[roleId]` | 更新角色运行配置 |
| DELETE | `/api/settings/templates/[templateId]/roles/[roleId]` | 删除角色 |
| POST | `/api/settings/templates/[templateId]/roles/[roleId]/copy` | 复制角色 |

#### GET /api/templates

- Response `200`
  ```ts
  ApiResponse<{
    templates: Array<TemplateSummary & {
      defaultStrategy: TemplateDefaultStrategy
      configStatus: 'default' | 'customized'
    }>
  }>
  ```
- 错误码：`INTERNAL_ERROR`

#### POST /api/settings/templates

- Request
  ```ts
  interface CreateTemplateRequest {
    name: string
    description: string
    category?: string
    defaultStrategy: TemplateDefaultStrategy
  }
  ```
- Response `200`: `ApiResponse<TemplateDetailResult>`
- 错误码：`VALIDATION_ERROR` / `TEMPLATE_NAME_CONFLICT` / `INTERNAL_ERROR`

#### PATCH /api/settings/templates/[templateId]

- Request
  ```ts
  interface UpdateTemplateRequest {
    name?: string
    description?: string
    defaultStrategy?: TemplateDefaultStrategy
    fallbackProviderConnectionId?: string
    fallbackModel?: string
  }
  ```
- Response `200`: `ApiResponse<TemplateDetailResult>`
- 错误码：`NOT_FOUND` / `VALIDATION_ERROR` / `TEMPLATE_NAME_CONFLICT` / `PROVIDER_CONNECTION_NOT_FOUND` / `INTERNAL_ERROR`

#### POST /api/settings/templates/[templateId]/roles

- Request
  ```ts
  interface CreateTemplateRoleRequest {
    name: string
    persona: string
    systemPrompt: string
    providerConnectionId: string
    model: string
    temperature?: number
    maxTokens?: number
    includedInDefaultQueue?: boolean
    enabled?: boolean
  }
  ```
- Response `200`: `ApiResponse<TemplateRolesResult>`
- 错误码：`NOT_FOUND` / `VALIDATION_ERROR` / `ROLE_NAME_CONFLICT` / `PROVIDER_CONNECTION_NOT_FOUND` / `PROVIDER_CONNECTION_DISABLED` / `MODEL_NOT_AVAILABLE` / `INTERNAL_ERROR`

#### PATCH /api/settings/templates/[templateId]/roles/[roleId]

- Request
  ```ts
  interface UpdateTemplateRoleRequest {
    name?: string
    persona?: string
    systemPrompt?: string
    providerConnectionId?: string
    model?: string
    temperature?: number
    maxTokens?: number
    includedInDefaultQueue?: boolean
    enabled?: boolean
  }
  ```
- Response `200`: `ApiResponse<TemplateRolesResult>`
- 错误码：`NOT_FOUND` / `VALIDATION_ERROR` / `ROLE_NAME_CONFLICT` / `PROVIDER_CONNECTION_NOT_FOUND` / `PROVIDER_CONNECTION_DISABLED` / `MODEL_NOT_AVAILABLE` / `INTERNAL_ERROR`

#### DELETE /api/settings/templates/[templateId]/roles/[roleId]

- Response `200`: `ApiResponse<{ deletedRoleId: string }>`
- 错误码：`NOT_FOUND` / `ROLE_DELETE_FORBIDDEN` / `INTERNAL_ERROR`

#### POST /api/settings/templates/[templateId]/roles/[roleId]/copy

- Response `200`: `ApiResponse<TemplateRolesResult>`
- 错误码：`NOT_FOUND` / `VALIDATION_ERROR` / `ROLE_NAME_CONFLICT` / `INTERNAL_ERROR`

### 5.3 数据安全 API

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/settings/export` | 导出设置 JSON |
| POST | `/api/settings/import/preview` | 导入预检查 |
| POST | `/api/settings/import` | 确认导入 |
| GET | `/api/settings/export/sessions` | 导出全部会话 Markdown |
| POST | `/api/settings/clear` | 清理本地数据 |

#### GET /api/settings/export

- Response `200`: `ApiResponse<SettingsExportBundle>`
- 错误码：`INTERNAL_ERROR`

#### POST /api/settings/import/preview

- Request: `multipart/form-data` 或 `application/json`（MVP 先支持 JSON 文本）
- Response `200`
  ```ts
  ApiResponse<SettingsImportPreview & {
    previewToken: string
  }>
  ```
- 错误码：`INVALID_IMPORT_FILE` / `VALIDATION_ERROR` / `IMPORT_CONFLICT` / `INTERNAL_ERROR`

#### POST /api/settings/import

- Request
  ```ts
  interface SettingsImportCommitRequest {
    bundle: SettingsExportBundle
    previewToken: string
    overwrite: boolean
  }
  ```
- Response `200`
  ```ts
  ApiResponse<{
    importedConnections: number
    importedTemplates: number
    importedPrompts: number
  }>
  ```
- 错误码：`INVALID_IMPORT_FILE` / `VALIDATION_ERROR` / `IMPORT_PREVIEW_REQUIRED` / `IMPORT_PREVIEW_EXPIRED` / `IMPORT_CONFLICT` / `INTERNAL_ERROR`

#### GET /api/settings/export/sessions

- Response `200`
  ```ts
  ApiResponse<{
    filename: string
    content: string
    sessionCount: number
    sanitized: true
  }>
  ```
- 错误码：`INTERNAL_ERROR`

#### POST /api/settings/clear

- 复用现有路由并将 `scope` 扩展为 `cache | sessions | settings | all`。
- 保持 `ApiResponse<null>`。
- 错误码：`VALIDATION_ERROR` / `CLEAR_SCOPE_UNSUPPORTED` / `INTERNAL_ERROR`
- 兼容性说明：现有单会话导出能力保持不变，本次只新增“全部会话导出”入口，不移除既有单会话导出路径。

## 6. Module Design

### 模块划分

```
src/modules/settings/
  index.tsx                           # 设置首页 + 二级视图切换
  ProviderSheet.tsx                   # 连接编辑器（复用原文件名，承载新增/编辑连接）

src/modules/templates/
  index.tsx                           # 模板列表 / 详情 / 角色列表，增加 settings 入口下的管理动作

src/app/api/settings/
  provider-connections/route.ts
  provider-connections/[connectionId]/route.ts
  provider-connections/test/route.ts
  templates/route.ts
  templates/[templateId]/route.ts
  templates/[templateId]/roles/route.ts
  templates/[templateId]/roles/[roleId]/route.ts
  templates/[templateId]/roles/[roleId]/copy/route.ts
  export/route.ts
  export/sessions/route.ts
  import/preview/route.ts
  import/route.ts
  clear/route.ts

src/server/services/
  settings.service.ts                 # provider connection + import/export + clear + session export
  template.service.ts                 # template admin operations

src/server/repositories/
  settings.repository.ts
  template.repository.ts
```

### 职责定义

**SettingsModule**
- 职责：渲染三入口首页、维护 `activeView`、承载刷新信号和返回动作。
- 输入：无。
- 输出：home / provider-connections / template-config / data-security 三类视图。
- 异常：子视图失败时展示错误和返回入口，不影响首页入口继续可见。

**ProviderSheet**
- 职责：新增/编辑/测试连接表单。
- 输入：`connectionId?: string`, `providerType?: ProviderType`, `initialValue?: ProviderConnectionDTO`。
- 输出：保存成功后通过 `onSaved(connection)` 把脱敏结果回传给父层。
- 异常：字段校验失败、测试失败、保存失败都在组件内内联提示。

**SettingsService**
- 职责：Settings 领域聚合服务。
- 新增接口：
  - `listProviderConnections()`
  - `createProviderConnection()`
  - `updateProviderConnection()`
  - `deleteProviderConnection()`
  - `testProviderConnection()`
  - `exportSettings()`
  - `previewImportSettings()`
  - `importSettings()`
  - `exportSessionsMarkdown()`
- 依赖：`SettingsRepository` + `SessionRepository` + `MessageRepository` + `EventRepository` + `VoteRepository` + `TemplateRepository`（用于删除前引用检查）

**TemplateService**
- 职责：模板读取 + 模板管理写操作。
- 新增接口：
  - `createTemplate()`
  - `updateTemplateMeta()`
  - `createRole()`
  - `updateRoleRuntimeConfig()`
  - `copyRole()`
  - `deleteRole()`
- 依赖：`TemplateRepository`，并在需要时校验 `SettingsRepository` 中的连接存在性。

### 依赖关系

```
SettingsModule
  -> ProviderSheet
  -> TemplatesModule（复用）
  -> fetch /api/settings/**

/api/settings/provider-connections/**
  -> SettingsService
  -> SettingsRepository + TemplateRepository

/api/settings/templates/**
  -> TemplateService
  -> TemplateRepository (+ SettingsRepository for provider connection validation)

/api/settings/export|import|clear
  -> SettingsService
  -> SettingsRepository + SessionRepository + MessageRepository + EventRepository + VoteRepository
```

### 与现有模块的集成方式

- `TemplatesModule` 保持现有读取状态机，只在 settings 入口模式下展示“新增模板 / 新增角色 / 编辑角色 / 复制 / 删除”等动作按钮。
- `SettingsModule` 不直接管理模板数据细节；模板数据仍由 `TemplatesModule` 内部加载。
- 连接删除前引用检查走 `SettingsService -> TemplateRepository`，避免 UI 自行拼装检查逻辑。

## 7. Output Contract

### API 产出

| API | 输入 | 输出 | 产出类型 | 正确性规则 |
|-----|------|------|---------|-----------|
| GET `/api/settings/provider-connections` | 无 | `ApiResponse<{ connections: ProviderConnectionDTO[] }>` | web-e2e | 不返回明文 `apiKey` / header value |
| POST `/api/settings/provider-connections` | `CreateProviderConnectionRequest` | `ApiResponse<ProviderConnectionDTO>` | web-e2e | 同一 providerType 下允许多连接；`displayName` 唯一 |
| PATCH `/api/settings/provider-connections/[connectionId]` | `UpdateProviderConnectionRequest` | `ApiResponse<ProviderConnectionDTO>` | web-e2e | 未传 `apiKey` 时保留旧 key |
| DELETE `/api/settings/provider-connections/[connectionId]` | 无 | `ApiResponse<{ deletedConnectionId: string }>` | web-e2e | 被引用时返回 `CONNECTION_IN_USE` |
| POST `/api/settings/provider-connections/test` | `ProviderConnectionTestRequest` | `ApiResponse<ProviderConnectionTestResult>` | web-e2e | 错误信息不得包含明文 key |
| POST `/api/settings/provider-connections/[connectionId]/test` | 无 | `ApiResponse<ProviderConnectionTestResult>` | web-e2e | 服务端读取已保存密钥，响应仍只返回脱敏结果 |
| GET `/api/templates` | 无 | `ApiResponse<{ templates: Array<TemplateSummary & { defaultStrategy: TemplateDefaultStrategy; configStatus: 'default' \| 'customized' }> }>` | web-e2e | 模板列表必须包含 roleCount、eventCount、defaultStrategy、configStatus |
| POST `/api/settings/templates` | `CreateTemplateRequest` | `ApiResponse<TemplateDetailResult>` | web-e2e | 新模板初始可进入详情页 |
| PATCH `/api/settings/templates/[templateId]` | `UpdateTemplateRequest` | `ApiResponse<TemplateDetailResult>` | web-e2e | `defaultStrategy` 必须落盘 |
| POST `/api/settings/templates/[templateId]/roles` | `CreateTemplateRoleRequest` | `ApiResponse<TemplateRolesResult>` | web-e2e | `providerConnectionId` 必须存在且启用 |
| PATCH `/api/settings/templates/[templateId]/roles/[roleId]` | `UpdateTemplateRoleRequest` | `ApiResponse<TemplateRolesResult>` | web-e2e | 更新后角色配置在详情页可见 |
| DELETE `/api/settings/templates/[templateId]/roles/[roleId]` | 无 | `ApiResponse<{ deletedRoleId: string }>` | web-e2e | 不允许删除唯一 host 角色 |
| POST `/api/settings/templates/[templateId]/roles/[roleId]/copy` | 无 | `ApiResponse<TemplateRolesResult>` | web-e2e | 新角色名称自动避免冲突 |
| GET `/api/settings/export` | 无 | `ApiResponse<SettingsExportBundle>` | web-e2e | 导出内容不包含敏感值 |
| POST `/api/settings/import/preview` | 导入 bundle | `ApiResponse<SettingsImportPreview & { previewToken: string }>` | web-e2e | 只预检查，不写数据 |
| POST `/api/settings/import` | `SettingsImportCommitRequest` | `ApiResponse<{ importedConnections: number; importedTemplates: number; importedPrompts: number }>` | web-e2e | 导入失败时不得部分提交 |
| GET `/api/settings/export/sessions` | 无 | `ApiResponse<{ filename: string; content: string; sessionCount: number; sanitized: true }>` | web-e2e | 导出 Markdown 不得包含敏感值 |
| POST `/api/settings/clear` | `{ scope }` | `ApiResponse<null>` | web-e2e | scope 仅允许 `cache/sessions/settings/all` |

### 关键 DTO 字段契约

| DTO | 必填字段 | 关键字段约束 |
|-----|---------|-------------|
| `ProviderConnectionDTO` | `id`, `providerType`, `displayName`, `baseUrl`, `modelList`, `enabled`, `lastTestStatus`, `maskedKey`, `maskedHeaders`, `createdAt`, `updatedAt` | `maskedKey` 只能是脱敏值或空；`maskedHeaders` 只能返回 key 名与脱敏占位符 |
| `ProviderConnectionTestResult` | `status`, `latencyMs`, `checkedAt`, `availableModels`, `maskedKey` | 失败时允许 `errorCode`/`errorMessage`，但不得包含明文密钥或 header 值 |
| `SettingsExportBundle` | `version`, `exportedAt`, `includePrompts`, `providerConnections`, `templateRuntimeConfigs`, `prompts` | `providerConnections` 中不得包含明文 `apiKeyRef` 和原始 `customHeaders` 值 |
| `SettingsImportPreview` | `additions`, `updates`, `conflicts`, `invalidItems` | 只描述预检查结果；正式导入必须依赖配套 `previewToken` |
| `TemplateRolesResult` | `templateId`, `templateVersion`, `roles` | 每个 role 必须可返回 `runtimeConfig`、`configStatus` 与 `enabled` 状态 |

### 组件产出

| 组件 | 输入 | 输出 | 产出类型 | 正确性规则 |
|------|------|------|---------|-----------|
| `SettingsModule` | 无 | 三入口首页和二级视图切换 | frontend-ui | 首页只出现 3 个一级入口；二级页均有返回入口；移动端保持单列布局 |
| `ProviderSheet` | `connectionId?`, `providerType?`, `initialValue?` | 连接保存/测试结果 | frontend-ui | API Key 默认脱敏；失败不丢输入；支持测试已保存连接 |
| `TemplatesModule`（settings 模式） | `entry: 'settings'`（可选） | 模板详情、角色配置管理结果 | frontend-ui | 模型/Prompt 在角色配置中维护，不回流到 settings 首页；模板列表必须展示 roleCount/eventCount/defaultStrategy/configStatus |
| `DataSecurityView`（由 `SettingsModule` 承载） | 无 | 导入导出、清理、隐私说明交互 | frontend-ui | 导入必须先预检查；清理必须二次确认；支持 cache/sessions/settings/all 范围 |

### 公共方法产出

| 方法 | 输入 | 输出 | 产出类型 | 正确性规则 |
|------|------|------|---------|-----------|
| `SettingsService.createProviderConnection()` | `CreateProviderConnectionRequest` | `ProviderConnectionDTO` 或异常 | integration | 组件链路：Route -> SettingsService -> SettingsRepository |
| `SettingsService.updateProviderConnection()` | `connectionId`, patch | `ProviderConnectionDTO` 或异常 | integration | 组件链路：Route -> SettingsService -> SettingsRepository |
| `SettingsService.deleteProviderConnection()` | `connectionId` | `{ deletedConnectionId }` 或异常 | integration | 组件链路：Route -> SettingsService -> TemplateRepository + SettingsRepository |
| `SettingsService.testProviderConnection()` | 表单请求或 `connectionId` | `ProviderConnectionTestResult` 或异常 | integration | 组件链路：Route -> SettingsService -> Provider adapter/SettingsRepository |
| `SettingsService.previewImportSettings()` | `bundle` | `SettingsImportPreview & { previewToken: string }` 或异常 | integration | 组件链路：Route -> SettingsService -> SettingsRepository + TemplateRepository |
| `SettingsService.importSettings()` | `bundle`, `previewToken`, `overwrite` | 导入统计结果或异常 | integration | 组件链路：Route -> SettingsService -> SettingsRepository + TemplateRepository；失败时整体回滚 |
| `SettingsService.exportSessionsMarkdown()` | 无 | `{ filename, content, sessionCount, sanitized: true }` 或异常 | integration | 组件链路：Route -> SettingsService -> SessionRepository + MessageRepository + EventRepository + VoteRepository |
| `TemplateService.createTemplate()` | `CreateTemplateRequest` | `TemplateDetailResult` 或异常 | integration | 组件链路：Route -> TemplateService -> TemplateRepository |
| `TemplateService.updateRoleRuntimeConfig()` | `templateId`, `roleId`, patch | `TemplateRolesResult` 或异常 | integration | 组件链路：Route -> TemplateService -> TemplateRepository + SettingsRepository |
| `TemplateService.copyRole()` | `templateId`, `roleId` | `TemplateRolesResult` 或异常 | integration | 复制结果必须保留原运行配置 |
| `TemplateService.deleteRole()` | `templateId`, `roleId` | `{ deletedRoleId }` 或异常 | integration | 组件链路：Route -> TemplateService -> TemplateRepository |

### 功能类型声明

读取 `workflow.yaml` 可见 `project.features: [web-api]`，因此本次 API 端点必须声明 `web-e2e`。

同时，本次迭代实际内容还涉及前端页面/组件和跨组件链路：

| 触发条件 | type id | 引用规范 | 说明 |
|---------|---------|---------|------|
| API Design 中存在 HTTP endpoint | `web-e2e` | `standards/testing/web-e2e.md` | 由 workflow.yaml 已登记的 `web-api` 直接触发 |
| 设置首页、连接编辑器、模板配置页、数据安全页涉及前端交互 | `frontend-ui` | `standards/testing/frontend-ui.md` | workflow.yaml features 未登记，type id 基于本次迭代实际内容推断 |
| Development Tasks 中存在跨 Route -> Service -> Repository 的链路任务 | `integration` | `standards/testing/integration.md` | 满足跨组件条件，必须声明 |

> 建议后续把 `frontend-ui` 补充到 `workflow.yaml project.features`，避免后续迭代遗漏类型化测试声明。

## 8. Change Log

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/types/index.ts` | 修改 | 新增 provider connection、template runtime、settings import/export 领域契约 |
| `src/types/api.ts` | 修改 | 新增 settings provider/template/data-security DTO |
| `src/server/repositories/settings.repository.ts` | 修改 | 扩展 settings 仓储接口 |
| `src/server/repositories/template.repository.ts` | 修改 | 扩展模板管理写接口 |
| `src/server/services/settings.service.ts` | 修改 | 增加连接管理、导入导出、删除前引用检查、会话导出接口 |
| `src/server/services/template.service.ts` | 修改 | 增加模板新增/更新、角色新增/复制/删除、角色运行配置更新接口 |
| `src/server/repositories/mock/mock-settings.repository.ts` | 修改 | provider 存储迁移到 connection 模型 |
| `src/server/repositories/mock/mock-template.repository.ts` | 修改 | 补齐模板管理写入实现 |
| `src/modules/settings/index.tsx` | 修改 | 设置首页改为三入口信息架构 |
| `src/modules/settings/ProviderSheet.tsx` | 修改 | 编辑器升级为多连接表单 |
| `src/modules/templates/index.tsx` | 修改 | 复用模板配置读视图并增加 settings 模式管理动作 |
| `src/app/api/settings/provider-connections/route.ts` | 新增 | 连接列表/新增 API |
| `src/app/api/settings/provider-connections/[connectionId]/route.ts` | 新增 | 连接更新/删除 API |
| `src/app/api/settings/provider-connections/test/route.ts` | 新增 | 连接测试 API |
| `src/app/api/settings/templates/route.ts` | 新增 | 模板新增 API |
| `src/app/api/settings/templates/[templateId]/route.ts` | 新增 | 模板基础配置更新 API |
| `src/app/api/settings/templates/[templateId]/roles/route.ts` | 新增 | 模板新增角色 API |
| `src/app/api/settings/templates/[templateId]/roles/[roleId]/route.ts` | 新增 | 角色更新/删除 API |
| `src/app/api/settings/templates/[templateId]/roles/[roleId]/copy/route.ts` | 新增 | 角色复制 API |
| `src/app/api/settings/export/route.ts` | 新增 | 设置导出 API |
| `src/app/api/settings/export/sessions/route.ts` | 新增 | 全部会话 Markdown 导出 API |
| `src/app/api/settings/import/preview/route.ts` | 新增 | 设置导入预检查 API |
| `src/app/api/settings/import/route.ts` | 新增 | 设置导入确认 API |
| `src/app/api/settings/clear/route.ts` | 修改 | 保留现有 clear 契约并对齐数据安全页用法 |

## 9. Development Tasks

- Task-01：定义多连接厂商、模板运行配置与设置导入导出契约
  - 任务类型：contract
  - 所属模块：shared-types/settings
  - 简要描述：在共享领域类型和 API DTO 中定义 provider connection、template runtime、settings export/import preview、template admin request/response 契约，供后续路由、服务和测试直接 import。
  - 涉及接口/方法：`ProviderConnection`、`TemplateRuntimeConfig`、`SettingsExportBundle`、settings/template admin DTOs
  - 输入：各 settings/template 管理请求参数
  - 输出：类型定义与 DTO 契约
  - 依赖任务：无
  - 数据操作：无
  - 修改边界：只修改 `src/types/index.ts` 与 `src/types/api.ts` 中的类型声明；不得写业务逻辑
  - 禁止行为：不得删除现有旧 DTO；不得在类型文件中写运行时流程
  - 产出类型：integration
  - 功能类型：共享契约定义（type id: integration）
  - 是否跨组件：否

- Task-02：扩展设置仓储与服务接口以支持多连接、导入导出和删除前引用检查
  - 任务类型：contract
  - 所属模块：server/settings
  - 简要描述：扩展 `SettingsRepository` 与 `SettingsService` 的公共方法签名，覆盖连接 CRUD、连接测试、设置导入导出、全部会话导出、删除前引用检查等行为。
  - 涉及接口/方法：`listProviderConnections()`、`createProviderConnection()`、`updateProviderConnection()`、`deleteProviderConnection()`、`testProviderConnection()`、`exportSettings()`、`previewImportSettings()`、`importSettings()`、`exportSessionsMarkdown()`
  - 输入：connectionId、provider connection patch、import bundle、clear/export 请求
  - 输出：脱敏连接 DTO、导入预检查结果、导出 bundle、删除结果
  - 依赖任务：Task-01（共享契约）
  - 数据操作：读写 settings 存储；读取模板角色引用关系；读取 sessions/messages/events/votes 导出数据
  - 修改边界：只修改 `src/server/repositories/settings.repository.ts`、`src/server/services/settings.service.ts` 的接口与空实现位置；不得重写整个 service 文件
  - 禁止行为：不得删除现有旧 settings 方法；不得在 02 阶段写完整业务实现
  - 产出类型：integration
  - 功能类型：设置服务契约扩展（type id: integration）
  - 是否跨组件：是（组件链路：SettingsRoute -> SettingsService -> SettingsRepository/TemplateRepository）

- Task-03：扩展模板仓储与服务接口以支持模板和角色管理写操作
  - 任务类型：contract
  - 所属模块：server/templates
  - 简要描述：为模板新增、模板基础配置更新、角色新增、角色复制、角色删除、角色运行配置更新定义公共方法签名，并保持现有读取接口继续可用。
  - 涉及接口/方法：`createTemplate()`、`updateTemplateMeta()`、`createRole()`、`updateRoleRuntimeConfig()`、`copyRole()`、`deleteRole()`
  - 输入：templateId、roleId、template patch、role patch
  - 输出：`TemplateDetailResult`、`TemplateRolesResult`、删除结果
  - 依赖任务：Task-01（共享契约）
  - 数据操作：读写 template 存储；读取 settings 中的 provider connection 用于合法性校验
  - 修改边界：只修改 `src/server/repositories/template.repository.ts` 与 `src/server/services/template.service.ts` 的接口及空实现位置
  - 禁止行为：不得修改现有 `/api/templates` 读取返回结构；不得删除已有 `updateRoleConfig()` 兼容入口
  - 产出类型：integration
  - 功能类型：模板管理服务契约扩展（type id: integration）
  - 是否跨组件：是（组件链路：TemplateAdminRoute -> TemplateService -> TemplateRepository）

- Task-04：实现多连接设置仓储与模板管理仓储的写入骨架
  - 任务类型：contract
  - 所属模块：server/repositories/mock
  - 简要描述：在 `MockSettingsRepository` 与 `MockTemplateRepository` 中补齐与新契约对应的公开方法骨架、返回结构和兼容迁移占位，让 03 阶段测试可直接实例化并调用新仓储接口。
  - 涉及接口/方法：provider connection CRUD、template admin CRUD、import/export preview persistence helpers
  - 输入：connection/template/role patch DTO
  - 输出：仓储公开方法与返回值骨架
  - 依赖任务：Task-01（共享契约）、Task-02（settings 契约）、Task-03（template 契约）
  - 数据操作：读写内存 settings/template 存储结构；保留旧 provider 数据兼容映射入口
  - 修改边界：只修改 `src/server/repositories/mock/mock-settings.repository.ts` 与 `src/server/repositories/mock/mock-template.repository.ts`；不得改写 shared instances 组合方式
  - 禁止行为：不得在 02 阶段写完整业务校验；不得删除现有已被读取链路依赖的方法
  - 产出类型：integration
  - 功能类型：Mock 仓储骨架扩展（type id: integration）
  - 是否跨组件：是（组件链路：Service -> MockRepository）

- Task-05：实现 provider connection 持久化、校验与测试业务逻辑
  - 任务类型：business-implementation
  - 所属模块：server/settings
  - 简要描述：实现连接新增、更新、删除、删除前引用检查、当前表单测试、已保存连接测试、启用状态与模型可用性校验，以及脱敏返回逻辑。
  - 涉及接口/方法：`SettingsService.createProviderConnection()`、`updateProviderConnection()`、`deleteProviderConnection()`、`testProviderConnection()`
  - 输入：connection request、connectionId、test request
  - 输出：`ProviderConnectionDTO`、`ProviderConnectionTestResult`、删除结果或异常
  - 依赖任务：Task-02（settings 契约）、Task-04（Mock 仓储骨架）
  - 数据操作：读写 settings 存储；读取 template 角色引用；调用 provider test adapter 或其占位实现
  - 修改边界：只填充 `src/server/services/settings.service.ts` 中连接相关空实现，并补齐 `src/server/repositories/mock/mock-settings.repository.ts` 中对应存储逻辑
  - 禁止行为：不得在返回值或错误信息中暴露明文 key/header；不得删除旧 `/api/llm/providers` 兼容方法
  - 产出类型：integration
  - 功能类型：厂商连接业务实现（type id: integration）
  - 是否跨组件：是（组件链路：ProviderConnectionsRoute -> SettingsService -> SettingsRepository/TemplateRepository）

- Task-06：实现模板管理与角色运行配置业务逻辑
  - 任务类型：business-implementation
  - 所属模块：server/templates
  - 简要描述：实现模板新增、模板基础配置更新、模板摘要补充 defaultStrategy/configStatus、角色新增、角色编辑、角色复制、角色删除，以及 provider connection 合法性校验。
  - 涉及接口/方法：`TemplateService.createTemplate()`、`updateTemplateMeta()`、`createRole()`、`updateRoleRuntimeConfig()`、`copyRole()`、`deleteRole()`、`listTemplateSummaries()`
  - 输入：template patch、role patch、templateId、roleId
  - 输出：`TemplateDetailResult`、`TemplateRolesResult`、增强版模板摘要、删除结果或异常
  - 依赖任务：Task-03（template 契约）、Task-04（Mock 仓储骨架）、Task-05（provider connection 业务实现）
  - 数据操作：读写 template 存储；读取 settings 中启用连接与模型列表；更新角色 runtimeConfig 与 enabled 状态
  - 修改边界：只填充 `src/server/services/template.service.ts` 与 `src/server/repositories/mock/mock-template.repository.ts` 中模板管理相关空实现，并最小修改模板摘要读取逻辑
  - 禁止行为：不得破坏现有 `/api/templates` 读取兼容性；不得删除已有 `updateRoleConfig()` 兼容入口
  - 产出类型：integration
  - 功能类型：模板与角色管理业务实现（type id: integration）
  - 是否跨组件：是（组件链路：TemplateAdminRoute -> TemplateService -> TemplateRepository/SettingsRepository）

- Task-07：实现设置导入导出、预检查令牌、会话批量导出与清理业务逻辑
  - 任务类型：business-implementation
  - 所属模块：server/settings
  - 简要描述：实现设置导出脱敏、导入预检查与 previewToken 校验、导入失败整体回滚、全部会话 Markdown 组装，以及 `cache/sessions/settings/all` 四种清理范围。
  - 涉及接口/方法：`SettingsService.exportSettings()`、`previewImportSettings()`、`importSettings()`、`exportSessionsMarkdown()`、`clearData()`
  - 输入：bundle、previewToken、overwrite、clear scope
  - 输出：`SettingsExportBundle`、`SettingsImportPreview & { previewToken }`、导入统计结果、session markdown bundle、clear result
  - 依赖任务：Task-02（settings 契约）、Task-04（Mock 仓储骨架）
  - 数据操作：读取 settings/template/session/message/event/vote 存储；写入 settings/template 配置；清理本地数据；保存导入预检查令牌
  - 修改边界：只填充 `src/server/services/settings.service.ts` 与 `src/server/repositories/mock/mock-settings.repository.ts` 中数据安全相关空实现，并最小修改 `src/app/api/settings/clear/route.ts` 对 scope 的校验枚举
  - 禁止行为：不得在导出或错误信息中输出敏感值；不得允许绕过 previewToken 直接导入
  - 产出类型：integration
  - 功能类型：数据安全业务实现（type id: integration）
  - 是否跨组件：是（组件链路：DataSecurityRoute -> SettingsService -> SettingsRepository/TemplateRepository/SessionRepository）

- Task-08：实现厂商连接管理 API 入口
  - 任务类型：api
  - 所属模块：api-server/settings
  - 简要描述：新增 settings provider-connections 路由骨架，覆盖列表、新增、更新、删除、测试当前表单连接和测试已保存连接入口，并统一返回 ApiResponse 信封。
  - 涉及接口/方法：GET/POST `/api/settings/provider-connections`，PATCH/DELETE `/api/settings/provider-connections/[connectionId]`，POST `/api/settings/provider-connections/test`，POST `/api/settings/provider-connections/[connectionId]/test`
  - 输入：provider connection request DTO、connectionId
  - 输出：provider connection DTO、删除结果、测试结果
  - 依赖任务：Task-01（DTO）、Task-05（provider connection 业务实现）
  - 数据操作：调用 SettingsService 读写 settings 存储与连接测试链路
  - 修改边界：只新增 `src/app/api/settings/provider-connections/**` 路由文件；不得改写现有 `/api/llm/providers` 路由
  - 禁止行为：不得在路由里直接访问 repository；不得绕过 Service 层做引用检查
  - 产出类型：web-e2e
  - 功能类型：厂商连接管理 API（type id: web-e2e）
  - 是否跨组件：是（组件链路：ProviderConnectionsRoute -> SettingsService -> SettingsRepository/TemplateRepository）

- Task-09：实现模板配置管理 API 入口
  - 任务类型：api
  - 所属模块：api-server/settings
  - 简要描述：新增 settings templates 写接口，覆盖模板新增、模板基础配置更新、角色新增、角色更新、角色删除和角色复制。
  - 涉及接口/方法：POST `/api/settings/templates`，PATCH `/api/settings/templates/[templateId]`，POST `/api/settings/templates/[templateId]/roles`，PATCH/DELETE `/api/settings/templates/[templateId]/roles/[roleId]`，POST `/api/settings/templates/[templateId]/roles/[roleId]/copy`
  - 输入：template patch、role patch、templateId、roleId
  - 输出：`TemplateDetailResult`、`TemplateRolesResult`、删除结果
  - 依赖任务：Task-01（DTO）、Task-06（模板与角色管理业务实现）
  - 数据操作：调用 TemplateService 读写 template 存储，并读取 settings 中 provider connection 进行校验
  - 修改边界：只新增 `src/app/api/settings/templates/**` 路由文件；不得修改现有 `/api/templates` 读取路由
  - 禁止行为：不得删除现有带 header 授权的模板 PATCH 路由；不得在路由内复制业务校验逻辑
  - 产出类型：web-e2e
  - 功能类型：模板配置管理 API（type id: web-e2e）
  - 是否跨组件：是（组件链路：TemplateAdminRoute -> TemplateService -> TemplateRepository/SettingsRepository）

- Task-10：实现数据安全管理 API 入口
  - 任务类型：api
  - 所属模块：api-server/settings
  - 简要描述：新增 settings export/import/export sessions 路由，并复用 clear 路由支撑数据安全页。
  - 涉及接口/方法：GET `/api/settings/export`，POST `/api/settings/import/preview`，POST `/api/settings/import`，GET `/api/settings/export/sessions`，POST `/api/settings/clear`
  - 输入：import bundle、previewToken、overwrite、clear scope
  - 输出：export bundle、import preview、import result、session markdown bundle、clear result
  - 依赖任务：Task-01（DTO）、Task-07（数据安全业务实现）
  - 数据操作：读取 settings/template/session/message/event/vote 存储；写入 settings/template 配置；清理本地数据
  - 修改边界：只新增 `src/app/api/settings/export/**`、`src/app/api/settings/import/**`，并最小修改 `src/app/api/settings/clear/route.ts`
  - 禁止行为：不得在导出接口返回明文 key；不得在 preview 路由写入数据
  - 产出类型：web-e2e
  - 功能类型：数据安全 API（type id: web-e2e）
  - 是否跨组件：是（组件链路：DataSecurityRoute -> SettingsService -> SettingsRepository/TemplateRepository/SessionRepository）

- Task-11：更新设置首页为三入口导航并承载二级视图切换
  - 任务类型：ui
  - 所属模块：settings
  - 简要描述：改造 `SettingsModule`，只保留厂商配置、模板配置、数据安全三个一级入口，并支持进入/返回二级视图。
  - 涉及接口/方法：`SettingsModule`
  - 输入：无
  - 输出：三入口首页与二级页切换交互
  - 依赖任务：无
  - 数据操作：无
  - 修改边界：只修改 `src/modules/settings/index.tsx` 的状态与渲染结构；不得在首页继续渲染旧模型/Prompt 入口
  - 禁止行为：不得新增新的顶层 settings page 文件；不得把二级页逻辑塞到路由层
  - 产出类型：frontend-ui
  - 功能类型：设置首页信息架构重构（type id: frontend-ui）
  - 是否跨组件：否

- Task-12：实现厂商连接列表与编辑交互
  - 任务类型：ui
  - 所属模块：settings
  - 简要描述：复用并升级 `ProviderSheet`，实现连接列表卡片、新增/编辑表单、测试连接、保存回写和删除前确认交互。
  - 涉及接口/方法：`ProviderSheet`、provider connection fetch handlers
  - 输入：connectionId、providerType、form fields
  - 输出：连接列表刷新、测试结果反馈、保存结果反馈
  - 依赖任务：Task-08（厂商连接管理 API）
  - 数据操作：读写 `/api/settings/provider-connections`；调用 `/api/settings/provider-connections/test`；调用 `/api/settings/provider-connections/[connectionId]/test`；调用删除接口
  - 修改边界：只修改 `src/modules/settings/ProviderSheet.tsx` 与 `src/modules/settings/index.tsx` 中的连接视图联动位置
  - 禁止行为：不得在 UI 中展示明文 key；不得把引用检查逻辑硬编码在前端
  - 产出类型：frontend-ui
  - 功能类型：厂商连接管理交互（type id: frontend-ui）
  - 是否跨组件：是（组件链路：SettingsModule -> ProviderSheet -> ProviderConnectionsRoute -> SettingsService）

- Task-13：复用模板模块承载模板配置、角色配置与新增角色交互
  - 任务类型：business-implementation
  - 所属模块：templates
  - 简要描述：在保留现有模板读取体验的前提下，为 settings 入口模式增加新增模板、更新默认策略、编辑角色运行配置、新增角色、复制角色、删除角色入口。
  - 涉及接口/方法：`TemplatesModule`
  - 输入：templateId、roleId、template/role form patch
  - 输出：模板详情刷新、角色列表刷新、错误提示
  - 依赖任务：Task-09（模板配置管理 API）
  - 数据操作：读 `/api/templates*`；写 `/api/settings/templates*`
  - 修改边界：只修改 `src/modules/templates/index.tsx`；不得新建第二套模板读取模块
  - 禁止行为：不得把模型/Prompt 再拆回 settings 首页独立入口；不得改坏现有模板只读入口
  - 产出类型：frontend-ui
  - 功能类型：模板配置与角色管理交互（type id: frontend-ui）
  - 是否跨组件：是（组件链路：SettingsModule -> TemplatesModule -> TemplateAdminRoute -> TemplateService）

- Task-14：实现数据安全页的导入导出、清理与隐私说明交互
  - 任务类型：business-implementation
  - 所属模块：settings
  - 简要描述：在 settings 二级页中实现设置导出、设置导入预检查/确认、全部会话 Markdown 导出、本地清理二次确认和隐私说明展示。
  - 涉及接口/方法：`SettingsModule` data-security view handlers
  - 输入：import bundle、preview result、clear scope、export actions
  - 输出：download payload、preview result、success/error feedback
  - 依赖任务：Task-10（数据安全管理 API）、Task-11（设置首页视图切换）
  - 数据操作：读 `/api/settings/export`、`/api/settings/export/sessions`；写 `/api/settings/import/preview`、`/api/settings/import`、`/api/settings/clear`
  - 修改边界：只修改 `src/modules/settings/index.tsx` 中的数据安全视图与事件处理；不得重写现有 clear API 契约
  - 禁止行为：不得跳过导入预检查直接导入；不得在错误提示中展示敏感值
  - 产出类型：frontend-ui
  - 功能类型：数据安全交互（type id: frontend-ui）
  - 是否跨组件：是（组件链路：SettingsModule -> DataSecurityRoute -> SettingsService -> SettingsRepository/SessionRepository）

