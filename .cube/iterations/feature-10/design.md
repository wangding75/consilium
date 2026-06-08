# 迭代 10 技术设计：设置页缺失交互补全

## 1. 概述

本次设计解决设置页 5 个功能点的交互补全：Provider 配置 Sheet、模型配置 Sheet、Prompt 配置、本地数据清理、模板管理占位优化。整体方案为：在现有 `SettingsModule` 基础上新增独立 Sheet 组件，复用现有 UI 组件库（Sheet/Modal/Toast/Button/Input/Textarea），对接 feature/9 已完成的 API 路由，并补齐缺失的 `POST /api/settings/clear` 路由。

**核心原则：**
- 最小改动：复用现有 UI 组件、API 路由、Service 层，不引入新依赖
- 面向接口：每个 Sheet 为独立组件，通过 props 接收数据和回调
- 适配现有风格：遵循项目 Tailwind CSS + 函数组件的代码风格
- 单文件不超过 800 行：每个 Sheet 拆分为独立文件

**关键约束：**
- 不修改 feature/9 已通过的后端测试和既有设置页集成测试契约
- 不引入新的状态管理库、表单库或第三方 UI 组件库
- 不扩展模板管理真实能力

**PRD 与现状差异说明：**
- PRD 依赖章节将 `/api/settings/clear` 列为 feature/9 已实现 API，但实际代码中该路由不存在。Service 层 `SettingsService.clearData()` 已实现，仅缺 Route Handler。本次设计补齐该路由，属于补全而非新增能力。

## 2. Impact Analysis

### 受影响模块

| 模块 | 路径 | 影响程度 | 说明 |
|------|------|---------|------|
| settings 模块 | `src/modules/settings/index.tsx` | **修改** | 添加 Sheet 状态管理、点击事件、数据刷新逻辑 |
| settings API | `src/app/api/settings/clear/route.ts` | **新增** | 补齐缺失的 clear API 路由（Service 层已有 clearData 方法） |
| UI 组件 | `src/components/ui/` | **无影响** | 直接复用现有 Sheet/Modal/Toast/Button/Input/Textarea/Tag/Card |
| Service 层 | `src/server/services/settings.service.ts` | **无影响** | 复用现有 listProviders/upsertProviderConfig/testProvider/getModelDefaults/saveModelDefaults/getRoleModelOverrides/saveRoleModelOverrides/getPromptConfigs/updatePrompt/resetPromptToDefault/clearData |
| Repository 层 | `src/server/repositories/` | **无影响** | 无变更 |
| 类型定义 | `src/types/api.ts`, `src/types/index.ts` | **无影响** | 复用现有 DTO 和领域类型 |
| LLM Providers | `src/app/api/llm/providers/` | **无影响** | 复用现有路由 |
| 其他模块 | `src/modules/home/`, `discussion/`, `sessions/`, `templates/` | **无影响** | 不涉及 |

### 接口兼容性

- 所有现有 API 路由保持不变，请求/响应格式不变
- 新增 `POST /api/settings/clear` 路由，遵循现有 ApiResponse 信封格式
- SettingsModule 对外接口不变（仍是页面级组件，无 props 变更）

### 数据兼容性

- 无数据模型变更
- 无数据库/存储结构变更
- clear API 使用现有 Service 层 clearData 方法，操作现有存储

## 3. Flow Design

### 3.1 Provider 配置流程

**始终展示 5 种 Provider 的实现方式**：SettingsModule 内置硬编码的 5 个 Provider ID 列表（openai、anthropic、gemini、deepseek、custom）。加载时将此列表与 API 返回的已配置 Provider 做合并：已配置的展示配置详情，未配置的展示"未配置/点击配置"占位卡片。用户点击任一 Provider 卡片均可打开 Sheet，未配置 Provider 进入带默认初始值的 Sheet（enabled=false，baseUrl 预填默认 URL）。

```
用户点击 Provider 卡片
  → SettingsModule 设置 selectedProviderId
  → ProviderSheet 打开（底部滑出，约 80vh）
  → 从 providers 状态中读取当前 Provider 数据填充表单
  → 用户编辑字段（实时校验）
  → 用户点击"测试连接"
    → POST /api/llm/providers/test
    → 按钮进入 Loading 态
    → 成功：展示绿色延迟提示，刷新 lastTestStatus
    → 失败：映射错误码为用户可读提示，展示红色摘要
  → 用户点击"保存"
    → 最终校验 → 失败则阻止保存
    → PUT /api/llm/providers
    → 成功：关闭 Sheet，Toast 提示，刷新 Provider 列表
    → 失败：Sheet 保持打开，展示错误提示
  → 用户点击遮罩层或关闭按钮 → 关闭 Sheet
```

### 3.2 模型配置流程

```
用户点击"模型配置"分组的"编辑"按钮
  → ModelSheet 打开
  → 加载 modelDefaults、roleModelOverrides 和角色列表
    → 角色列表从 GET /api/templates 获取（提取所有模板的 roles 去重）
    → 若模板 API 不可用，角色覆盖面板仅展示已有覆盖记录
  → 上半区：全局默认模型表单
    → Provider 下拉框（仅展示 enabled=true 的 Provider，使用原生 <select> 元素）
    → 无 enabled Provider 时展示空状态，禁用保存
    → temperature 使用原生 <input type="range"> 滑块
    → 保存：PUT /api/settings/model-defaults
  → 下半区：角色专属模型覆盖折叠面板
    → 展开后展示角色列表
    → 每个角色可独立设置 Provider/model/temperature/maxTokens
    → 未覆盖角色展示"使用全局默认"
    → "清除覆盖"按钮——仅清除此项覆盖，不影响其他角色
    → 保存：PUT /api/settings/role-models
  → 底部固定操作按钮区
```

**Provider 下拉框与 temperature 滑块说明**：使用原生 HTML `<select>` 和 `<input type="range">` 元素，不新增自定义 UI 组件，符合"不引入新依赖"约束。

### 3.3 Prompt 配置流程

```
用户点击"Prompt 提示词配置"分组
  → PromptSheet 打开
  → 加载 GET /api/settings/prompts
  → 列表分"全局 Prompt"和"角色 Prompt"两栏
  → 点击单项 → 切换为编辑态（Textarea 展示 content）
  → 用户编辑 content → 点击"保存"
    → 弹出 ConfirmDialog（二次确认）
    → 确认后 PUT /api/settings/prompts
    → 刷新列表（version/updatedAt/isDefault 更新）
  → 用户点击"恢复默认"
    → 弹出 ConfirmDialog
    → 确认后 PUT /api/settings/prompts (reset: true)
    → 刷新列表（isDefault: true）
```

### 3.4 数据清理流程

**数据量获取说明**：当前 Repository 层无 count/统计方法。DataCleanupSheet 在打开时调用 `GET /api/sessions` 获取会话列表（取 `length` 为会话数），设置项数量通过 `GET /api/llm/providers` + `GET /api/settings/prompts` 等已有 API 返回的数组长度估算。若 API 调用失败，展示"暂无法统计"。

```
用户点击"数据与安全"分组
  → DataCleanupSheet 打开
  → 展示三个清理入口 + 数据量
  → 用户点击"清理会话"
    → ConfirmDialog（二次确认）
    → 确认后 POST /api/settings/clear { scope: 'sessions' }
  → 用户点击"清理设置"
    → ConfirmDialog（含红色高风险警告）
    → 确认后 POST /api/settings/clear { scope: 'settings' }
  → 用户点击"清理全部"
    → 三步确认流程：
      1. 展示总影响范围
      2. 输入确认词"确认删除"
      3. 最终确认
    → POST /api/settings/clear { scope: 'all' }
    → 关闭 Sheet，刷新设置页为空状态
```

### 3.5 异常流程处理

- 所有 API 调用失败时：保留用户当前输入，展示 Toast 错误提示
- 网络错误：catch 后展示通用错误 Toast，不关闭 Sheet
- 校验失败：内联展示错误信息，禁用提交按钮
- 二次确认取消：不执行操作，保持当前状态

## 4. Table Design

无新增或修改表结构。本次迭代不涉及数据模型变更。

## 5. API Design

### 复用现有 API（不变更）

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/llm/providers` | 获取 Provider 列表 |
| PUT | `/api/llm/providers` | 保存/更新 Provider 配置 |
| POST | `/api/llm/providers/test` | 测试 Provider 连接 |
| GET | `/api/settings/model-defaults` | 获取全局默认模型 |
| PUT | `/api/settings/model-defaults` | 保存全局默认模型 |
| GET | `/api/settings/role-models` | 获取角色模型覆盖 |
| PUT | `/api/settings/role-models` | 保存角色模型覆盖 |
| GET | `/api/settings/prompts` | 获取 Prompt 配置列表 |
| PUT | `/api/settings/prompts` | 更新/重置 Prompt |

### 新增 API

**POST /api/settings/clear**

清理本地数据。

- Request Body:
  ```json
  { "scope": "sessions" | "settings" | "all" }
  ```
- Response (200):
  ```json
  { "success": true, "data": null, "requestId": "uuid" }
  ```
- 错误码:
  - `VALIDATION_ERROR` (400): scope 参数缺失或非法
  - `INTERNAL_ERROR` (500): 清理操作失败

**实现说明**：Service 层 `SettingsService.clearData()` 已实现，仅需新增 Route Handler 做参数校验和调用。

### 错误码映射规范（Provider 连接测试）

PRD FR-006 要求前端对以下错误码做用户可读映射。当前 Service 层 `testProvider()` 方法已产出 `PROVIDER_NOT_CONFIGURED` 和 `PROVIDER_AUTH_FAILED`；`PROVIDER_TIMEOUT`、`PROVIDER_MODEL_NOT_FOUND`、`PROVIDER_TEST_FAILED` 为前端预留映射（Service 层后续可扩展产出这些错误码而不需前端改动）。

| 后端错误码 | 前端用户提示 | Service 层状态 |
|-----------|------------|--------------|
| `PROVIDER_NOT_CONFIGURED` | "Provider 尚未配置，请先完成配置" | 已产出 |
| `PROVIDER_AUTH_FAILED` | "API Key 验证失败，请检查 Key 是否正确" | 已产出 |
| `PROVIDER_TIMEOUT` | "连接超时，请检查网络或 Base URL 后重试" | 预留 |
| `PROVIDER_MODEL_NOT_FOUND` | "模型不可用，请检查模型列表" | 预留 |
| `PROVIDER_TEST_FAILED` | "连接测试失败，请稍后重试" | 预留 |
| 未知错误码 | "操作失败，请稍后重试"（不暴露原始错误码） | — |

## 6. Module Design

### 组件拆分

```
src/modules/settings/
  index.tsx                  # 主组件：状态管理 + 5 个分组 + Sheet 开关控制
  ProviderSheet.tsx           # Provider 配置 Sheet（FR-001 ~ FR-006）
  ModelSheet.tsx              # 模型配置 Sheet（FR-007 ~ FR-009）
  PromptSheet.tsx             # Prompt 配置 Sheet（FR-010 ~ FR-012）
  DataCleanupSheet.tsx        # 数据清理 Sheet（FR-013 ~ FR-016）
  ConfirmDialog.tsx           # 通用确认弹窗组件
```

### 组件职责与接口

**SettingsModule（修改）**
- 职责：管理 5 个 Sheet 的 open/close 状态、数据加载与刷新、Toast 状态
- 新增状态：`activeSheet: 'provider' | 'model' | 'prompt' | 'cleanup' | null`, `selectedProviderId`, `toastMessage`, `toastVariant`
- 依赖：ProviderSheet, ModelSheet, PromptSheet, DataCleanupSheet, Toast

**ProviderSheet（新增）**
- 职责：Provider 配置表单、字段校验、保存、连接测试
- 输入：`isOpen: boolean`, `providerId: string`, `onClose: () => void`, `onSaved: () => void`
- 输出：通过 `onSaved` 回调通知父组件刷新
- 依赖：Sheet, Button, Input, Textarea, Tag, Toast (from @/components/ui/), PUT /api/llm/providers, POST /api/llm/providers/test

**ModelSheet（新增）**
- 职责：全局默认模型编辑、角色覆盖编辑、折叠面板
- 输入：`isOpen: boolean`, `onClose: () => void`, `onSaved: () => void`
- 输出：通过 `onSaved` 回调通知父组件刷新
- 依赖：Sheet, Button, Input, Tag

**PromptSheet（新增）**
- 职责：Prompt 列表展示、编辑、保存、恢复默认
- 输入：`isOpen: boolean`, `onClose: () => void`, `onSaved: () => void`
- 输出：通过 `onSaved` 回调通知父组件刷新
- 依赖：Sheet, Button, Textarea, Tag, ConfirmDialog

**DataCleanupSheet（新增）**
- 职责：数据量展示、清理入口、确认流程
- 输入：`isOpen: boolean`, `onClose: () => void`
- 输出：无（清理后通过 `onClose` 回调）
- 依赖：Sheet, Button, ConfirmDialog

**ConfirmDialog（新增）**
- 职责：通用二次确认弹窗，支持警告信息、确认词输入
- 输入：`isOpen: boolean`, `title: string`, `message: string`, `confirmText?: string`, `requireTyping?: string`, `variant?: 'default' | 'danger'`, `onConfirm: () => void`, `onCancel: () => void`
- 输出：通过回调通知确认/取消
- 依赖：Modal, Button, Input

### 模块依赖关系

```
SettingsModule
  ├── ProviderSheet ────── Sheet, Button, Input, Toast
  ├── ModelSheet ───────── Sheet, Button, Input, Tag
  ├── PromptSheet ──────── Sheet, Button, Textarea, Tag, ConfirmDialog
  ├── DataCleanupSheet ─── Sheet, Button, ConfirmDialog
  └── ConfirmDialog ────── Modal, Button, Input
```

## 7. Output Contract

### API 产出

| API | 输入 | 输出 | 产出类型 | 正确性规则 |
|-----|------|------|---------|-----------|
| GET /api/llm/providers | 无 | `ApiResponse<ProviderStatusDTO[]>` | web-e2e | maskedKey 不含明文；按 providerId 列出 |
| PUT /api/llm/providers | `UpsertProviderConfigRequest` | `ApiResponse<ProviderStatusDTO>` | web-e2e | providerId 必填；返回 maskedKey |
| POST /api/llm/providers/test | `ProviderTestRequest` | `ApiResponse<ProviderTestResult>` | web-e2e | providerId 必填；返回 latencyMs |
| GET /api/settings/model-defaults | 无 | `ApiResponse<ModelDefaultsDTO \| null>` | web-e2e | 无配置时返回 null |
| PUT /api/settings/model-defaults | `{ providerId, model, temperature?, maxTokens? }` | `ApiResponse<ModelDefaultsDTO>` | web-e2e | providerId + model 必填 |
| GET /api/settings/role-models | 无 | `ApiResponse<RoleModelOverrideDTO[]>` | web-e2e | 无覆盖时返回 [] |
| PUT /api/settings/role-models | `{ overrides: RoleModelOverride[] }` | `ApiResponse<RoleModelOverrideDTO[]>` | web-e2e | overrides 必须是数组 |
| GET /api/settings/prompts | 无 | `ApiResponse<PromptConfigDTO[]>` | web-e2e | 无 prompt 时返回 [] |
| PUT /api/settings/prompts | `{ promptId, content?, reset? }` | `ApiResponse<PromptConfigDTO>` | web-e2e | promptId 必填；reset 时 isDefault=true |
| POST /api/settings/clear | `{ scope }` | `ApiResponse<null>` | web-e2e | scope 必填，值为 sessions/settings/all |

### 组件产出

| 组件 | 输入 | 输出 | 产出类型 | 正确性规则 |
|------|------|------|---------|-----------|
| ProviderSheet | providerId, isOpen | 用户编辑后的 Provider 配置（通过 PUT 保存） | frontend-ui | 字段校验规则见 FR-003；错误码映射见 FR-006 |
| ModelSheet | isOpen | 全局默认模型 + 角色覆盖（通过 PUT 保存） | frontend-ui | 无 enabled Provider 时禁用保存；角色覆盖可清除 |
| PromptSheet | isOpen | Prompt 编辑结果（通过 PUT 保存） | frontend-ui | 保存/恢复默认均需二次确认 |
| DataCleanupSheet | isOpen | 清理范围（通过 POST /api/settings/clear 执行） | frontend-ui | 清理设置/全部需红色警告；清理全部需三步确认 |
| ConfirmDialog | title, message, confirmText, requireTyping, variant | 用户确认或取消 | frontend-ui | 危险操作套红色；requireTyping 时需输入匹配 |

### 功能类型声明

根据 `workflow.yaml` 的 `project.features: [web-api]`，结合本次迭代实际变更：

| 触发条件 | type id | 引用规范 | 说明 |
|---------|---------|---------|------|
| 新增 POST /api/settings/clear 端点 | `web-e2e` | `standards/testing/web-e2e.md` | 新的 HTTP 端点需 E2E 验证 |
| 新增 5 个前端 Sheet 组件 | `frontend-ui` | `standards/testing/frontend-ui.md` | 设置页新增交互组件需 UI 验证 |
| 涉及 ProviderSheet → API → Service 组件链 | `integration` | `standards/testing/integration.md` | 跨组件链路需集成测试 |

> `frontend-ui` 类型：workflow.yaml features 未登记 `frontend-ui`，但本次迭代的实际内容涉及前端页面/组件，type id 基于本次迭代实际内容推断。建议将 `frontend-ui` 补充到 workflow.yaml features。

## 8. Change Log

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/modules/settings/index.tsx` | 修改 | 添加 Sheet 状态管理、点击事件、数据刷新、Toast；更新模板管理占位文案 |
| `src/modules/settings/ProviderSheet.tsx` | 新增 | Provider 配置 Sheet 组件 |
| `src/modules/settings/ModelSheet.tsx` | 新增 | 模型配置 Sheet 组件 |
| `src/modules/settings/PromptSheet.tsx` | 新增 | Prompt 配置 Sheet 组件 |
| `src/modules/settings/DataCleanupSheet.tsx` | 新增 | 数据清理 Sheet 组件 |
| `src/modules/settings/ConfirmDialog.tsx` | 新增 | 通用确认弹窗组件 |
| `src/app/api/settings/clear/route.ts` | 新增 | POST /api/settings/clear 路由（对接已有 Service 层） |

## 9. Development Tasks

- Task-01：新增 POST /api/settings/clear 路由
  - 任务类型：api
  - 所属模块：api-server/settings
  - 简要描述：创建 clear 路由，校验 scope 参数（sessions/settings/all），调用已有 SettingsService.clearData()，返回 ApiResponse 信封。
  - 涉及接口/方法：POST /api/settings/clear
  - 输入：`{ scope: 'sessions' | 'settings' | 'all' }`
  - 输出：`ApiResponse<null>`
  - 依赖任务：无
  - 数据操作：调用 SettingsService.clearData() → 写 session/message/event/vote/settings 存储
  - 修改边界：只新增 route.ts 文件，不修改 Service 层
  - 禁止行为：不得修改 SettingsService；不得修改其他路由文件
  - 产出类型：web-e2e
  - 功能类型：设置数据清理 API（type id: web-e2e）
  - 是否跨组件：是（组件链路：ClearRoute → SettingsService → SettingsRepository）

- Task-02：实现 ConfirmDialog 通用确认弹窗组件
  - 任务类型：contract
  - 所属模块：settings
  - 简要描述：创建通用确认弹窗组件，支持标题、正文、确认/取消按钮、危险样式、确认词输入。
  - 涉及接口/方法：ConfirmDialog
  - 输入：`{ isOpen, title, message, confirmText?, requireTyping?, variant?, onConfirm, onCancel }`
  - 输出：用户确认或取消回调
  - 依赖任务：无
  - 数据操作：无
  - 修改边界：只新增 ConfirmDialog.tsx
  - 禁止行为：不得引入外部依赖；不得在组件内发起 API 调用
  - 产出类型：frontend-ui
  - 功能类型：通用确认弹窗（type id: frontend-ui）
  - 是否跨组件：否

- Task-03：实现 ProviderSheet 组件（表单与校验）
  - 任务类型：ui
  - 所属模块：settings
  - 简要描述：实现 Provider 配置 Sheet，包含 providerId（只读）、enabled、baseUrl、apiKey、modelList、customHeaders 字段编辑，实时校验。
  - 涉及接口/方法：ProviderSheet
  - 输入：`{ isOpen, providerId, onClose, onSaved }`
  - 输出：编辑后的 Provider 配置数据
  - 依赖任务：无
  - 数据操作：无（纯 UI 组件，通过回调传递数据）
  - 修改边界：只新增 ProviderSheet.tsx
  - 禁止行为：不得在组件内直接发起 API 调用（由父组件处理）；不得使用内联样式替代 Tailwind
  - 产出类型：frontend-ui
  - 功能类型：Provider 配置表单 UI（type id: frontend-ui）
  - 是否跨组件：否

- Task-04：实现 ProviderSheet 保存与连接测试
  - 任务类型：business-implementation
  - 所属模块：settings
  - 简要描述：实现 ProviderSheet 的保存（调用 PUT /api/llm/providers）和连接测试（调用 POST /api/llm/providers/test）逻辑，含 Loading 态、错误映射、成功反馈。覆盖 Flow Design 中的"按钮进入 Loading 态"、"成功：展示绿色延迟提示"、"失败：映射错误码为用户可读提示"。
  - 涉及接口/方法：handleSave(), handleTest()
  - 输入：表单数据
  - 输出：API 调用结果与 UI 反馈
  - 依赖任务：Task-03（ProviderSheet 表单骨架）
  - 数据操作：写 PUT /api/llm/providers；读 POST /api/llm/providers/test；按钮进入 Loading 态（UI 状态管理）
  - 修改边界：只填充 ProviderSheet 中的 handleSave/handleTest 方法体
  - 禁止行为：不得修改 Task-03 的表单结构；不得绕过校验直接提交
  - 产出类型：integration
  - 功能类型：Provider 保存与测试交互（type id: integration）
  - 是否跨组件：是（组件链路：ProviderSheet → fetch API → SettingsService）

- Task-05：实现 ModelSheet 组件
  - 任务类型：ui
  - 所属模块：settings
  - 简要描述：实现模型配置 Sheet，包含全局默认模型表单（Provider 下拉、model、temperature 滑块、maxTokens）和角色覆盖折叠面板，含保存逻辑。
  - 涉及接口/方法：ModelSheet
  - 输入：`{ isOpen, onClose, onSaved }`
  - 输出：保存后的模型配置
  - 依赖任务：无
  - 数据操作：读 GET /api/llm/providers（获取 enabled Provider 列表）；读 GET /api/settings/model-defaults（初始化默认值）；读 GET /api/settings/role-models（初始化覆盖列表）；读 GET /api/templates（获取角色列表用于展示未覆盖角色）；写 PUT /api/settings/model-defaults；写 PUT /api/settings/role-models
  - 修改边界：只新增 ModelSheet.tsx
  - 禁止行为：不得修改 model-defaults/role-models 路由；不得在无 enabled Provider 时允许保存
  - 产出类型：frontend-ui
  - 功能类型：模型配置 Sheet UI（type id: frontend-ui）
  - 是否跨组件：是（组件链路：ModelSheet → fetch API → SettingsService）

- Task-06：实现 PromptSheet 组件
  - 任务类型：ui
  - 所属模块：settings
  - 简要描述：实现 Prompt 配置 Sheet，包含列表展示（全局/角色分组）、编辑态（Textarea）、保存（二次确认）和恢复默认（二次确认）。
  - 涉及接口/方法：PromptSheet
  - 输入：`{ isOpen, onClose, onSaved }`
  - 输出：Prompt 编辑/重置结果
  - 依赖任务：Task-02（ConfirmDialog 组件）
  - 数据操作：读 GET /api/settings/prompts；写 PUT /api/settings/prompts
  - 修改边界：只新增 PromptSheet.tsx
  - 禁止行为：不得跳过二次确认直接保存/恢复；不得修改 prompts 路由
  - 产出类型：frontend-ui
  - 功能类型：Prompt 配置 Sheet UI（type id: frontend-ui）
  - 是否跨组件：是（组件链路：PromptSheet → ConfirmDialog → fetch API → SettingsService）

- Task-07：实现 DataCleanupSheet 组件
  - 任务类型：ui
  - 所属模块：settings
  - 简要描述：实现数据清理 Sheet，包含三个清理入口、数据量展示、二次确认弹窗、三步确认（清理全部）。
  - 涉及接口/方法：DataCleanupSheet
  - 输入：`{ isOpen, onClose }`
  - 输出：清理执行结果
  - 依赖任务：Task-01（clear API 路由）、Task-02（ConfirmDialog 组件）
  - 数据操作：写 POST /api/settings/clear
  - 修改边界：只新增 DataCleanupSheet.tsx
  - 禁止行为：不得跳过确认流程直接清理；不得在警告信息未加载时允许操作
  - 产出类型：frontend-ui
  - 功能类型：数据清理 Sheet UI（type id: frontend-ui）
  - 是否跨组件：是（组件链路：DataCleanupSheet → ConfirmDialog → fetch API → SettingsService）

- Task-08：更新 SettingsModule 主组件（Sheet 调度与状态联动）
  - 任务类型：business-implementation
  - 所属模块：settings
  - 简要描述：修改 SettingsModule，添加 Sheet 开关状态、点击事件绑定、数据刷新回调、Toast 状态管理；更新模板管理占位文案；更新模型配置分组（添加优先级说明和编辑按钮）。
  - 涉及接口/方法：SettingsModule
  - 输入：无（页面级组件）
  - 输出：完整的设置页交互
  - 依赖任务：Task-03, Task-04, Task-05, Task-06, Task-07（所有 Sheet 组件）
  - 数据操作：读 GET /api/llm/providers；读 GET /api/settings/model-defaults；读 GET /api/settings/role-models；设置 selectedProviderId/activeSheet 等 Sheet 调度状态（UI 状态管理）
  - 修改边界：只修改 index.tsx 的 state 声明、事件处理函数、JSX 渲染部分；不得删除现有数据加载逻辑
  - 禁止行为：不得删除现有测试覆盖的渲染结构；不得将 Sheet 逻辑内联到主组件（通过 import 使用）
  - 产出类型：frontend-ui
  - 功能类型：设置页 Sheet 调度与交互联动（type id: frontend-ui）
  - 是否跨组件：是（组件链路：SettingsModule → Sheet 组件 → fetch API → SettingsService）