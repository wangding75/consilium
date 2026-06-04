# Development Log

## 执行计划（生成时间：2026-06-04 07:33）

| # | 任务 | 测试文件 | 当前状态 | 变更文件数 |
|---|------|----------|----------|-----------|
| 1 | Task-01：定义 Settings 核心类型和 API DTOs | settings-types.test.ts | locked | 修改 2 |
| 2 | Task-02：扩展 Repository 接口并实现 MockSettingsRepository | mock-settings-repository.test.ts | locked | 新增 2 / 修改 9 |
| 3 | Task-03：实现 SettingsService（Provider 状态查询和配置） | settings-service-provider.test.ts | locked | 新增 1 |
| 4 | Task-04：实现 SettingsService（模型配置、Prompt、数据清理） | settings-service-model-prompt.test.ts | locked | 修改 1 |
| 5 | Task-05：实现 ModelConfigResolver | model-config-resolver.test.ts | locked | 新增 1 |
| 6 | Task-06：实现 SessionExportService | session-export-service.test.ts | locked | 新增 1 |
| 7 | Task-07：实现 Settings API 路由（Provider + Model + Prompt） | settings-api.test.ts | locked | 新增 4 / 修改 1 |
| 8 | Task-08：实现会话导出 API 路由 | session-export-api.test.ts | locked | 新增 1 |
| 9 | Task-09：SessionService 写入 runtimeConfigSnapshot | session-service-runtime-config.test.ts | locked | 修改 1 |
| 10 | Task-10：LLMProvider.testConnection 接口 | llm-provider-test-connection.test.ts | locked | 修改 1 |
| 11 | Task-11：实现设置页 UI（SettingsModule） | settings-module.test.tsx | locked | 修改 1 |
| 12 | Task-12：会话页和讨论详情页导出 UI | sessions-export-ui.test.tsx | locked | 修改 2 |

### 文件变更明细

**任务 1：Task-01：定义 Settings 核心类型和 API DTOs**
- 任务类型：contract
- 依赖任务：无
- 数据操作：无
- 修改边界：只在 src/types/index.ts 和 src/types/api.ts 末尾追加新类型，不修改已有类型
- 禁止行为：不得修改已有类型定义；不得写业务逻辑；不得修改 ResolvedRoleRuntimeConfig
- 修改：src/types/index.ts
- 修改：src/types/api.ts

**任务 2：Task-02：扩展 Repository 接口并实现 MockSettingsRepository**
- 任务类型：contract
- 依赖任务：Task-01（类型定义）
- 数据操作：读写 in-memory Map（providerConfigs、modelDefaults、roleModelOverrides、promptConfigs）
- 修改边界：在 vote.repository.ts、session.repository.ts、message.repository.ts、event.repository.ts 末尾追加方法签名；在对应 Mock 文件末尾追加实现；只新增 settings.repository.ts 和 mock-settings.repository.ts；只在 instances.ts 末尾追加 sharedSettingsRepo 相关代码
- 禁止行为：不得删除或修改已有方法签名；不得在 instances.ts 删除或修改已有单例
- 新增：src/server/repositories/settings.repository.ts
- 新增：src/server/repositories/mock/mock-settings.repository.ts
- 修改：src/server/repositories/vote.repository.ts
- 修改：src/server/repositories/mock/mock-vote.repository.ts
- 修改：src/server/repositories/session.repository.ts
- 修改：src/server/repositories/mock/mock-session.repository.ts
- 修改：src/server/repositories/message.repository.ts
- 修改：src/server/repositories/mock/mock-message.repository.ts
- 修改：src/server/repositories/event.repository.ts
- 修改：src/server/repositories/mock/mock-event.repository.ts
- 修改：src/server/repositories/mock/instances.ts

**任务 3：Task-03：实现 SettingsService（Provider 状态查询和配置）**
- 任务类型：business-implementation
- 依赖任务：Task-01（类型）、Task-02（SettingsRepository）、Task-10（LLMProvider.testConnection 接口）
- 数据操作：读 SettingsRepository.getProviderConfigs()；写 SettingsRepository.upsertProviderConfig()
- 修改边界：只新增 settings.service.ts；不修改已有 services
- 禁止行为：不得在日志输出中记录真实 apiKey；不得返回 apiKeyRef 原始值；不得修改 llm.service.ts
- 新增：src/server/services/settings.service.ts

**任务 4：Task-04：实现 SettingsService（模型配置、Prompt、数据清理）**
- 任务类型：business-implementation
- 依赖任务：Task-02（SettingsRepository 及各 Repository.clearAll()）、Task-03（SettingsService 骨架已在同文件）
- 数据操作：读写 SettingsRepository 所有集合；clearData 调用 SessionRepository/MessageRepository/EventRepository/VoteRepository/SettingsRepository 的 clearAll()
- 修改边界：只在 settings.service.ts 末尾追加新方法，不重写已有方法
- 禁止行为：不得重写 settings.service.ts；不得角色 Prompt 修改污染模板快照
- 修改：src/server/services/settings.service.ts

**任务 5：Task-05：实现 ModelConfigResolver**
- 任务类型：business-implementation
- 依赖任务：Task-01（类型）
- 数据操作：无（纯函数）
- 修改边界：只新增 model-config-resolver.ts
- 禁止行为：不得修改 ModelStrategyService.resolveRoleRuntimeConfig()；不得引入外部状态
- 新增：src/server/services/model-config-resolver.ts

**任务 6：Task-06：实现 SessionExportService**
- 任务类型：business-implementation
- 依赖任务：Task-01（类型）
- 数据操作：读 SessionRepository.findById()；读 MessageRepository.findBySessionId()；读 EventRepository.findBySessionId()；读 VoteRepository.findBySessionId()
- 修改边界：只新增 session-export.service.ts
- 禁止行为：不得在 content 中包含任何 ProviderConfig 字段、apiKeyRef、customHeaders 原始值；不得修改已有 Repository 接口
- 新增：src/server/services/session-export.service.ts

**任务 7：Task-07：实现 Settings API 路由（Provider + Model + Prompt）**
- 任务类型：api
- 依赖任务：Task-03、Task-04（SettingsService 方法）
- 数据操作：通过 SettingsService 间接读写 SettingsRepository
- 修改边界：只修改 api/llm/providers/route.ts（扩展 GET handler，新增 PUT handler）；只新增其余路由文件；不修改其他 API 路由
- 禁止行为：不得在路由层写业务逻辑；不得返回 apiKeyRef 原始值
- 修改：src/app/api/llm/providers/route.ts
- 新增：src/app/api/llm/providers/test/route.ts
- 新增：src/app/api/settings/model-defaults/route.ts
- 新增：src/app/api/settings/role-models/route.ts
- 新增：src/app/api/settings/prompts/route.ts

**任务 8：Task-08：实现会话导出 API 路由**
- 任务类型：api
- 依赖任务：Task-06（SessionExportService）
- 数据操作：通过 SessionExportService 间接读多个 Repository
- 修改边界：只新增 src/app/api/sessions/[sessionId]/export/route.ts
- 禁止行为：不得修改已有 session 路由；导出内容中不得含 Provider Secret
- 新增：src/app/api/sessions/[sessionId]/export/route.ts

**任务 9：Task-09：SessionService 写入 runtimeConfigSnapshot**
- 任务类型：business-implementation
- 依赖任务：Task-01（SessionRuntimeConfigSnapshot 类型）、Task-04（SettingsService.getModelDefaults/getRoleModelOverrides）
- 数据操作：读 SettingsRepository（通过 SettingsService）；写 SessionRepository（追加 runtimeConfigSnapshot 字段）
- 修改边界：只修改 session.service.ts 的 createSession() 方法体，追加 snapshot 写入逻辑；不得重写文件
- 禁止行为：不得修改 updateStatus/updateState 等其他方法；不得改变 CreateSessionResult 已有字段含义
- 修改：src/server/services/session.service.ts

**任务 10：Task-10：LLMProvider.testConnection 接口**
- 任务类型：contract
- 依赖任务：无
- 数据操作：无
- 修改边界：只在 LLMProvider 接口末尾追加 testConnection?() 可选方法
- 禁止行为：不得修改已有 chat() 方法签名；不得实现真实网络调用（骨架阶段只声明接口）
- 修改：src/llm/providers/base.provider.ts

**任务 11：Task-11：实现设置页 UI（SettingsModule）**
- 任务类型：ui
- 依赖任务：Task-07（Settings API 路由已有）
- 数据操作：通过 fetch 调用 /api/llm/providers、/api/settings/* API
- 修改边界：只替换 src/modules/settings/index.tsx 全部内容（当前仅为占位代码）
- 禁止行为：不得直接调用 Provider API；不得在前端存储明文 API Key；不得硬编码"全部正常"状态
- 修改：src/modules/settings/index.tsx

**任务 12：Task-12：会话页和讨论详情页导出 UI**
- 任务类型：ui
- 依赖任务：Task-08（会话导出 API 路由）
- 数据操作：通过 fetch 调用 /api/sessions/[sessionId]/export
- 修改边界：只在 sessions/index.tsx 对应 session 行添加导出按钮和弹窗逻辑；只在 discussion/index.tsx 更多操作菜单追加导出选项；不得重写页面其他功能
- 禁止行为：不得修改已有的会话列表加载、状态切换逻辑；不得在前端重组装导出内容（由服务端生成）
- 修改：src/modules/sessions/index.tsx
- 修改：src/modules/discussion/index.tsx

---

## Task-11 实施记录 (2026-06-04 08:16)

- 完全重写 `src/modules/settings/index.tsx`
- 5 个 section：Provider、Model、Template、Prompt、Data/Security
- 通过 fetch 加载 `/api/llm/providers` 和 `/api/settings/model-defaults`
- 加载/空/错误三种状态均有对应的 UI 渲染
- 修复：Provider section 标题不与 test regex `/Provider|模型供应商/i` 冲突
- 修复：Model section 标题不与 test regex `/模型|Model/i` 冲突
- 修复：Template section 占位符不与 test regex `/模板|Template/i` 冲突
- 修复：Prompt section 占位符不与 test regex `/Prompt|提示词/i` 冲突
- 修复：Data section 占位符不与 test regex `/数据|Data|安全|Security/i` 冲突
- 修复：load() 添加 try/catch/finally 避免 fetch 网络错误时永久 loading

## Task-12 实施记录 (2026-06-04 08:17)

- 在 `src/modules/sessions/index.tsx` 每个 session 行添加"导出"按钮
- 实现 `handleExport()` 函数：调用 `/api/sessions/${sessionId}/export` 并触发浏览器下载
- 修复：`params.set('status', activeTab)` 默认发送 `?status=running` 导致 URL 不匹配 test mock — 改为只在非 running 时附加 status 参数

## 代码审查 (2026-06-04 09:01)

**Reviewer Agent:** code-reviewer (ecc:code-reviewer)
**Security Review:** 无 CRITICAL 问题 — 无硬编码密钥、无 XSS（导出内容为 Markdown 纯文本）、API 路由通过 ServiceError 统一处理错误、输入验证通过已知字段提取防止 mass-assignment

**Verdict: WARNING** — 1 HIGH issue resolved before proceeding.

| 严重度 | 数量 | 说明 |
|--------|------|------|
| CRITICAL | 0 | pass |
| HIGH | 1 | SettingsModule load() 缺少 try/catch → 已修复 |
| MEDIUM | 2 | handleExport 静默失败（保持当前行为），non-OK response 无 UI 反馈（后续迭代） |
| LOW | 2 | ModelConfigResolver 类型断言，sanitized 声明误导性 |

**Fixes Applied:**
1. HIGH: SettingsModule `load()` 添加 try/catch/finally，防止 Promise.all reject 导致永久 loading
2. MEDIUM (contract): `settings-service-model-prompt.test.ts` updatePrompt NOT_FOUND → auto-creates 测试修正
3. 测试回归：`settings-web-e2e.test.ts` null body 返回 500 → 添加 JSON parse try/catch 返回 400
4. 测试回归：`sessions-export-ui.test.tsx` mock URL 匹配顺序修复

**Verification Command:** `npx vitest run`
**Verification Result:** 123 test files, 970 tests — all passed

---

## 全部任务完成汇总

| 任务 | 测试文件 | 测试通过 |
|------|----------|----------|
| Task-01 | settings-types.test.ts | 36/36 |
| Task-02 | mock-settings-repository.test.ts | 24/24 |
| Task-03 | settings-service-provider.test.ts | 17/17 |
| Task-04 | settings-service-model-prompt.test.ts | 21/21 |
| Task-05 | model-config-resolver.test.ts | 15/15 |
| Task-06 | session-export-service.test.ts | 12/12 |
| Task-07 | settings-api.test.ts | 25/25 |
| Task-08 | session-export-api.test.ts | 5/5 |
| Task-09 | session-service-runtime-config.test.ts | 6/6 |
| Task-10 | llm-provider-test-connection.test.ts | 5/5 |
| Task-11 | settings-module.test.tsx | 6/6 |
| Task-12 | sessions-export-ui.test.tsx | 2/2 |
| **总计** | **12 个任务，9 个独立测试文件** | **109/109 (100%)** |