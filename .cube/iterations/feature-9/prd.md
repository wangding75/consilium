# PRD：迭代 9 — 设置、Provider 与数据闭环

> 迭代分支：feature/9
> 创建日期：2026-06-04
> 状态：草稿

---

## 1. 功能概述

本次迭代完成"设置页 + Provider 配置 + 数据闭环"三大模块，使产品从"核心讨论可用"走向"可被真实用户持续使用"。

本次迭代包含以下功能点：

1. **设置页完整布局** — Provider、模型、模板、Prompt、本地数据五个分组
2. **Provider 管理** — 支持 OpenAI / Anthropic / Gemini / DeepSeek / Custom；配置状态 / 测试连接 / 脱敏展示
3. **模型配置** — 全局默认模型 + 角色专属模型覆盖，明确生效优先级
4. **Prompt 配置** — 全局和角色级 Prompt 查看、编辑、恢复默认
5. **会话导出** — 从会话页或讨论详情页导出指定 session 为 Markdown
6. **本地数据管理** — 分类清理会话 / 设置 / 全部，含二次确认
7. **设置后端闭环** — SettingsRepository / SettingsService / ModelConfigResolver / LLMClient 打通

---

## 2. Functional Requirements

### 2.1 设置页布局（FE-001）

**FR-001** 设置页按五个分组呈现：Provider 状态与配置、模型配置、模板管理、Prompt 配置、本地数据与安全。
- 输入：用户点击底部导航"设置"Tab
- 输出：页面展示五个分组，每组有入口标题和简要状态摘要
- 异常：无数据时，Provider 分组展示"未配置"状态摘要，其他分组展示空状态引导
- 优先级：P0

---

### 2.2 Provider 管理（FE-002 / FE-003 / FE-010 / FE-011 / FE-012 / BE-001 / BE-002 / BE-008 / BE-014 / SEC-001 / SEC-002 / SEC-005 / SEC-006 / SEC-007）

**FR-002** 设置页 Provider 分组展示已支持 Provider 的连接状态卡片。
- Provider：OpenAI、Anthropic、Gemini、DeepSeek、Custom Provider
- 每个卡片展示：Provider 名称、连接状态（未配置 / 已配置未测试 / 连接正常 / 连接失败 / 已禁用）、最近测试时间
- 状态不得硬编码为"全部正常"，必须反映实际配置和测试结果
- 优先级：P0

**FR-003** 用户可点击任意 Provider 卡片进入配置 Sheet，查看和编辑 Provider 参数。
- 展示和编辑字段：providerId、enabled、baseUrl、maskedKey（只读脱敏）、modelList、customHeaders（maskedHeaders 只读脱敏）、lastTestStatus、lastTestedAt
- API Key 和自定义 Header 值默认脱敏展示（如 `sk-***1234`），不可读取明文
- 用户可输入新 API Key 覆盖（write-only），提交后仅返回脱敏值
- 异常：字段格式不合法时，提交前内联提示
- 优先级：P0

**FR-004** Provider 配置 Sheet 内提供"测试连接"按钮。
- 点击后调用 `POST /api/llm/providers/test`
- 显示测试中 Loading 状态
- 成功：展示"连接正常 · xxx ms"；更新 lastTestStatus / lastTestedAt
- 失败：展示结构化错误摘要（如"鉴权失败，请检查 API Key"），不展示原始 Key 或完整请求体
- 错误码处理：PROVIDER_NOT_CONFIGURED / PROVIDER_AUTH_FAILED / PROVIDER_TIMEOUT / PROVIDER_MODEL_NOT_FOUND / PROVIDER_TEST_FAILED
- 优先级：P0

**FR-005** 后端接口 `GET /api/llm/providers` 返回所有 Provider 的配置状态。
- 返回字段包含 providerId、enabled、maskedKey、modelList、maskedHeaders、lastTestStatus、lastTestedAt、lastErrorCode、lastErrorMessage
- 不返回真实 API Key、真实 Authorization Header 或 Custom Header 明文值
- 优先级：P0

**FR-006** 后端接口 `POST /api/llm/providers/test` 测试 Provider 连接。
- 接受 providerId、baseUrl、apiKey、model、headers
- 测试完成后保存 lastTestStatus / lastTestedAt；不记录真实 Key / Headers 到日志
- 响应包含 providerId、status、latencyMs、checkedAt、availableModels、maskedKey
- 按需返回错误码和可读错误摘要
- 优先级：P0

---

### 2.3 模型配置（FE-004 / FE-005 / FE-013 / BE-003 / BE-004 / BE-007 / BE-011 / BE-012 / BE-013）

**FR-007** 设置页模型分组提供"全局默认模型"入口，用户可配置默认 Provider / model / temperature / maxTokens。
- 保存后通过 `PUT /api/settings/model-defaults` 持久化
- 配置页展示生效优先级说明：角色专属 > 会话 runtimeConfig > 模板/策略默认 > 全局默认 > Provider 默认
- 异常：未选 Provider 时不可选择 model
- 优先级：P0

**FR-008** 设置页模型分组提供"角色专属模型"入口，用户可为具体角色指定 Provider / model / temperature / maxTokens。
- 展示当前模板中的所有角色列表
- 可逐个角色设置或清除覆盖
- 保存后通过 `PUT /api/settings/role-models` 持久化
- 优先级：P1

**FR-009** 后端实现 `ModelConfigResolver`，负责将角色覆盖、会话 runtimeConfig、模板/策略默认、全局默认、Provider 默认按优先级解析为最终 `ResolvedModelConfig`。
- LLMClient 只消费 `ResolvedModelConfig`，不自行解析优先级
- 优先级：P0

**FR-010** 创建新会话时，系统写入 runtimeConfig snapshot，记录当时有效的模型配置。
- 后续全局设置变更默认只影响新会话，不自动修改历史会话的 runtimeConfig
- 当前会话可显式选择"应用最新全局配置"
- 优先级：P1

**FR-011** 后端实现 `SettingsRepository` 和 `SettingsService`，统一保存和读取 providerConfigs、modelDefaults、roleModelOverrides、promptConfigs、dataPolicy。
- 优先级：P0

---

### 2.4 Prompt 配置（FE-006 / FE-014 / BE-005 / BE-015）

**FR-012** 设置页 Prompt 分组提供全局 Prompt 和角色 Prompt 查看/编辑入口。
- 展示字段：promptId、scope、targetId（角色名）、version、content、updatedAt、isDefault
- 用户编辑内容后，保存前弹出二次确认（"确认覆盖当前 Prompt？"）
- 优先级：P1

**FR-013** Prompt 配置支持"恢复默认"功能。
- 恢复前弹出确认提示
- 恢复后展示系统默认版本，version 和 updatedAt 更新
- 角色 Prompt 修改不得污染模板快照和历史会话的 Prompt 记录
- 优先级：P1

**FR-014** 后端接口 `GET /api/settings/prompts` 和 `PUT /api/settings/prompts`。
- GET 返回所有 prompt 配置列表（global / role 级）
- PUT 支持修改和重置，携带 promptId + content（或 reset 标志）
- 优先级：P1

---

### 2.5 会话导出（FE-009 / FE-015 / BE-006 / BE-016 / SEC-003 / SEC-007）

**FR-015** 会话页（Sessions Tab）支持为指定 session 触发导出，展示导出范围和格式说明，确认后下载 Markdown 文件。
- 导出前展示：导出范围（消息数、事件数）、导出格式（Markdown）、脱敏说明（"不包含 API Key / Provider Secret"）
- 用户确认后调用 `GET /api/sessions/:sessionId/export?format=md`
- 下载文件名格式：`session-{sessionId}.md`
- 优先级：P0

**FR-016** 讨论详情页（`/discussion/[sessionId]`）更多操作菜单支持导出当前 session，逻辑与 FR-015 一致。
- 优先级：P0

**FR-017** 后端接口 `GET /api/sessions/:sessionId/export?format=md`，由 `SessionExportService` 生成 Markdown 内容。
- 导出内容包含：会话元信息（sessionId、topic、template、status、createdAt、updatedAt）、角色信息（名称和角色类型，不含 API Key）、消息记录（host / character / user / system / event / invite 类型）、事件与投票（EventRecord / VoteRecord / 选项 / 结果 / 触发时间）、总结（Director / Host 生成的阶段总结或最终总结）、脱敏声明（已移除 Provider Secret）
- 不得包含任何 API Key、Authorization Header 或 Provider 敏感配置
- 优先级：P0

---

### 2.6 本地数据管理（FE-008 / FE-016 / SEC-004 / SEC-009）

**FR-018** 设置页本地数据分组提供清理入口，区分三种清理范围：清理会话、清理设置、清理全部。
- 每种清理操作前展示影响范围说明，并弹出二次确认
- 清理 Provider 设置时，额外提示"清理后真实模型将不可用，直到重新配置 Provider"
- 清理全部需两步确认（第一步提示影响，第二步输入确认词或明确点击）
- 优先级：P1

---

### 2.7 LLMClient 与设置打通（BE-009 / BE-010 / BE-017）

**FR-019** LLMClient 从 `ModelConfigResolver` 读取最终模型配置，不硬编码 Provider 或模型。
- 优先级：P0

**FR-020** 提供设置导入/导出 JSON 的服务接口（`SettingsService` 层），默认导出不包含真实 API Key。
- 本迭代不实现带敏感信息的导出（排除在本迭代范围外）
- 优先级：P2

---

## 3. Non-Functional Requirements

- **安全**：API Key 和 Authorization Header 按 write-only 处理，所有读取接口只返回 maskedKey / maskedHeaders；API Key 不进入日志、错误上报或任何导出内容（包含设置导出 JSON 和会话导出 Markdown）
- **数据一致性**：新会话创建时保存 runtimeConfig snapshot，历史会话默认不受全局设置变更污染
- **移动端适配**：设置页在移动端保持分组清晰、操作流程简洁，不得变成复杂后台配置系统

---

## 4. 验收标准

| 功能点 | 可测试条件 |
|---|---|
| Provider 状态 | 设置页展示至少 5 个 Provider 卡片，状态准确区分未配置/未测试/正常/失败/禁用，不硬编码"全部正常" |
| Provider 配置 | 用户可打开配置 Sheet，查看脱敏 API Key，输入新 Key 后返回脱敏值 |
| Provider 测试 | 点击"测试连接"后显示 Loading，成功展示延迟 ms，失败展示可读错误摘要 |
| 全局默认模型 | 用户可配置默认模型，配置后新会话使用该模型；页面展示生效优先级说明 |
| 角色专属模型 | 用户可为角色指定覆盖模型，对应 Agent 使用该模型 |
| ModelConfigResolver | 单元测试覆盖五级优先级解析；LLMClient 消费 ResolvedModelConfig |
| 新会话 runtimeConfig | 创建新会话后可检查 session.runtimeConfig 包含模型快照 |
| Prompt 编辑 | 用户可查看/编辑全局 Prompt，保存前有二次确认 |
| Prompt 恢复默认 | 用户可恢复默认，version 和 updatedAt 更新；历史会话 Prompt 不受影响 |
| 会话页导出 | 从会话页触发指定 session 导出，下载 Markdown 文件，内容含消息/事件/投票/总结，不含 API Key |
| 讨论详情页导出 | 从更多操作菜单触发当前 session 导出，功能与会话页一致 |
| 导出脱敏 | 导出 Markdown 不含任何 Provider Secret，含脱敏声明 |
| 本地数据清理 | 三种清理范围可独立触发，均有二次确认，清理 Provider 设置时有额外警告 |
| API Key 不入日志 | 检查服务端日志无明文 API Key 或完整 Authorization Header |
| e2e 覆盖 | Provider 配置流程、默认模型设置、会话页导出、讨论详情页导出均有 e2e 用例 |
| 单元测试 | Provider 状态解析、ModelConfigResolver 优先级解析、Prompt 恢复默认、导出脱敏均有单元测试 |

---

## 5. Out of Scope

- 企业级权限系统和多用户支持
- 多设备同步（Phase 3）
- 付费计费系统和 Provider 计费统计
- 模板市场和 Prompt 市场
- API Key 云端托管或强加密（Phase 1 只做本地保存、脱敏、不入日志、可清除）
- Provider 计费成本报表
- 带真实 API Key 的设置导出（本迭代排除）
- Prompt 多版本协作

---

## 6. 依赖说明

- **迭代 2**：LLMClient 统一入口已建立，本迭代补充 `ModelConfigResolver` 为 LLMClient 提供配置
- **迭代 4**：会话页已有搜索/筛选/归档，本迭代补充指定 session 导出
- **迭代 8**：模板 modelDefaults 和模型策略数据已就绪，本迭代补充全局设置和优先级解析
- **SettingsRepository**：需新建，为 providerConfigs / modelDefaults / roleModelOverrides / promptConfigs / dataPolicy 提供统一存储
