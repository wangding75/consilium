# Design — 迭代 1：首页与创建讨论会话

## 概述

本次设计在现有骨架基础上，以最小改动实现首页主流程：

1. **类型层**：扩展 `Session` 类型（新增 `status`、`modelStrategyId`）；扩展 `DiscussionStage` 加入 `'idle'`；新增 `CreateSessionParams` / `CreateSessionResult` 类型；新增 `ModelStrategy` 常量。
2. **后端**：扩展 `MockSessionRepository` 为 in-memory Map 存储；扩展 `SessionService` 新增 `createSession` / `getRecentSessions`；新增 `POST /api/sessions` 和 `GET /api/sessions/recent` 路由。
3. **前端**：用现有 `Sheet`、`Toast`、`Button`、`Textarea` 等 UI 组件实现完整的 `HomeModule` 首页交互。
4. **测试兼容**：更新 `services.test.ts` 和 `mock-factories.ts` 以适配新的构造器签名和类型变更。

核心约束：
- SessionId 只来自 API 返回，前端不自行生成。
- 最近讨论数据只来自 `GET /api/sessions/recent`，不硬编码。
- 本迭代 MockSessionRepository 使用 in-memory Map，不接真实持久化层。
- **PRD BE-007 中的 "phase" 对应代码中的 `DiscussionState.stage`**——两者是同一字段，后续测试必须断言 `state.stage === 'idle'`，而非 `state.phase`。
- Session 创建时 `modelStrategyId` 若调用方不传，服务层默认置为 `DEFAULT_STRATEGY_ID`（`'smart'`）。
- 模板 Sheet 中的 "创业公司董事会" 和 "产品辩论桌" 为 UI 层静态常量（标注"即将支持"，不可点击），无对应 API 数据——只有 "三国军师团" 可选且有后端模板数据。
- 快速开始 chip 的议题文字为 HomeModule 内部静态常量，不从 API 读取。

---

## Impact Analysis

| 模块 | 影响程度 | 说明 |
|---|---|---|
| `src/types/index.ts` | 修改 | 补充 `'idle'` 到 `DiscussionStage`；为 `Session` 新增 `status`（必填）和 `modelStrategyId`（可选）字段 |
| `src/types/api.ts` | 修改 | 新增 `CreateSessionParams`、`CreateSessionResult` 接口 |
| `src/data/model-strategies.ts` | 新增 | 定义 `ModelStrategyId`、`ModelStrategy`、`MODEL_STRATEGIES`、`DEFAULT_STRATEGY_ID` |
| `src/server/repositories/session.repository.ts` | 修改 | 新增 `findRecent(limit?: number)` 接口方法 |
| `src/server/repositories/mock/mock-session.repository.ts` | 修改 | 重写为 in-memory Map 存储；实现 `save`（含 `crypto.randomUUID()`）+ `findRecent` |
| `src/server/repositories/repositories.test.ts` | 无影响 | `findAll` 在空 Map 上仍返回 `[]`，现有测试继续通过，不修改 |
| `src/server/services/session.service.ts` | 修改 | 构造器增加 `templateRepo: TemplateRepository` 第二参数；新增 `createSession` 和 `getRecentSessions` |
| `src/server/services/services.test.ts` | 修改 | `new SessionService(...)` 补充 `new MockTemplateRepository()` 为第二参数 |
| `src/app/api/sessions/route.ts` | 修改 | 新增 `POST` handler；更新 `GET` handler 的构造器调用（补第二参数）|
| `src/app/api/sessions/recent/route.ts` | 新增 | `GET /api/sessions/recent` 路由 |
| `src/modules/home/index.tsx` | 修改 | 替换占位内容，实现完整首页 UI |
| `src/tests/utils/mock-factories.ts` | 修改 | `mockSession()` 补充 `status: 'active'` 字段（`Session` 新增必填字段） |
| `src/types/domain.test.ts` | 无影响 | 使用 `stage: 'opening'` 的现有测试继续通过，添加 `'idle'` 到 union 不破坏已有断言 |

**接口兼容性**：现有 `GET /api/sessions` 不变；`SessionRepository` 接口只新增方法；`Session` 类型只新增字段（`status` 为必填，影响 `mockSession` 默认值）。

**Next.js 路由兼容性**：`/api/sessions/recent` 对应 `src/app/api/sessions/recent/route.ts`，比 `/api/sessions` 更具体，App Router 会正确解析，两路由互不干扰。

---

## Flow Design

### 创建会话主流程

```
用户填写议题，选好模板+策略 → 点击"开始讨论"
  ↓ (前端校验 topic 非空)
HomeModule → POST /api/sessions { topic, templateId, modelStrategyId }
  ↓
sessions/route.ts (POST handler)
  ↓
SessionService.createSession(params, templateRepo)
  ├─ topic 为空/空白 → throw ServiceError('TOPIC_REQUIRED')
  ├─ topic 超 100 字 → throw ServiceError('TOPIC_TOO_LONG')
  ├─ templateRepo.findById(templateId) 返回 null → throw ServiceError('TEMPLATE_NOT_FOUND')
  └─ 构造 Session {
       id: crypto.randomUUID(),
       topic,
       templateId,
       modelStrategyId: params.modelStrategyId ?? DEFAULT_STRATEGY_ID,
       status: 'active',
       state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
       messages: [],
       createdAt: Date.now(),
       updatedAt: Date.now()
     }
     ↓ repo.save(session)
     ↓ 返回 CreateSessionResult
  ↓
Route 返回 200 { success:true, data:CreateSessionResult }
  ↓
HomeModule 收到 sessionId → router.push(/discussion/[sessionId])
```

### 异常流程

```
topic 为空：
  前端：显示行内错误提示，不发请求
  后端（防御）：400 { error: { code:'TOPIC_REQUIRED' } }

topic 超 100 字：
  后端：400 { error: { code:'TOPIC_TOO_LONG' } }

templateId 不存在：
  后端：404 { error: { code:'TEMPLATE_NOT_FOUND' } }

服务器内部错误：
  后端：500 { error: { code:'INTERNAL_ERROR' } }

创建中 / loading 状态：
  前端：按钮显示 loading 状态，禁止重复点击
```

### 最近讨论加载流程

```
HomeModule 挂载
  ↓ useEffect → GET /api/sessions/recent
  ↓
sessions/recent/route.ts (GET handler)
  ↓
SessionService.getRecentSessions(limit=10)
  ↓ repo.findRecent(10) → 按 createdAt 倒序返回最近 N 条
  ↓
Route 返回 200 { success:true, data:Session[] }
  ↓
HomeModule 渲染列表（空列表 → "暂无最近讨论"；加载中 → 骨架占位；错误 → Toast）
```

---

## Table Design

本迭代无数据库。会话数据存储于 `MockSessionRepository` 的 in-memory Map（`Map<string, Session>`），进程重启后丢失。

**Session 类型扩展**（`src/types/index.ts`）：

```ts
// 原有：
export type DiscussionStage = 'opening' | 'developing' | 'climax' | 'closing'
// 修改后（新增 idle，PRD 中的 "phase=idle" 即指此字段）：
export type DiscussionStage = 'idle' | 'opening' | 'developing' | 'climax' | 'closing'

// Session 新增字段（status 为必填）：
export interface Session {
  // ... 原有字段不变 ...
  status: 'active' | 'completed' | 'archived'   // 新增，必填
  modelStrategyId?: string                        // 新增，可选
}
```

**注**：`Session.status` 与现有 `Discussion.status` 语义不同——Session status 表示会话生命周期（active/completed/archived），Discussion status 表示讨论运行状态（active/paused/completed），二者在不同层次使用。

**ModelStrategy 类型**（`src/data/model-strategies.ts`）：

```ts
export type ModelStrategyId = 'smart' | 'quality' | 'cost'
export interface ModelStrategy { id: ModelStrategyId; name: string; description: string }
export const MODEL_STRATEGIES: ModelStrategy[] = [
  { id: 'smart',   name: '智能躲避反馈', description: '优先快模型，复杂场景切强模型' },
  { id: 'quality', name: '质量优先',     description: '更多推理与更强模型，适合严肃决策' },
  { id: 'cost',    name: '成本优先',     description: '压缩 token 与发言长度，适合快速探索' },
]
export const DEFAULT_STRATEGY_ID: ModelStrategyId = 'smart'
```

---

## API Design

遵循 `api-spec.md` 的统一响应格式 `{ success, data, error?, requestId }`。

### POST /api/sessions

**功能**：创建讨论会话

**请求**：
```json
{
  "topic": "string，必填，1-100字",
  "templateId": "string，必填",
  "modelStrategyId": "string，可选，默认 'smart'"
}
```

**响应 200**：
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "topic": "string",
    "template": { "id": "string", "name": "string" },
    "status": "active",
    "createdAt": 1234567890000
  },
  "requestId": "uuid"
}
```

**错误码**：

| HTTP | code | 触发条件 |
|---|---|---|
| 400 | `TOPIC_REQUIRED` | topic 为空或空白字符串 |
| 400 | `TOPIC_TOO_LONG` | topic 超过 100 字 |
| 404 | `TEMPLATE_NOT_FOUND` | templateId 对应模板不存在 |
| 500 | `INTERNAL_ERROR` | 服务器异常 |

---

### GET /api/sessions/recent

**功能**：查询最近讨论会话列表（按 createdAt 倒序，默认 10 条）

**请求**：无参数

**响应 200**：
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "topic": "string",
      "templateId": "string",
      "status": "active | completed | archived",
      "modelStrategyId": "string | null",
      "createdAt": 1234567890000,
      "updatedAt": 1234567890000,
      "state": { "stage": "idle", "turnCount": 0, "lastSpeakerId": null },
      "messages": []
    }
  ],
  "requestId": "uuid"
}
```

**注**：返回完整 `Session[]`，本迭代中所有 session 的 `messages` 为空数组，无性能问题。

**错误码**：

| HTTP | code | 触发条件 |
|---|---|---|
| 500 | `INTERNAL_ERROR` | 服务器异常 |

---

## Module Design

### 新增类型定义（src/types/api.ts）

```ts
// 新增到现有 ApiError / ApiResponse 之外：

export interface CreateSessionParams {
  topic: string
  templateId: string
  modelStrategyId?: string
}

export interface CreateSessionResult {
  sessionId: string
  topic: string
  template: { id: string; name: string }
  status: 'active'
  createdAt: number
}
```

### SessionRepository 接口扩展

```ts
// src/server/repositories/session.repository.ts
export interface SessionRepository {
  findAll(): Promise<Session[]>
  findById(id: string): Promise<Session | null>
  findRecent(limit?: number): Promise<Session[]>   // 新增
  save(session: Session): Promise<Session>
  delete(id: string): Promise<void>
}
```

### MockSessionRepository

```ts
// src/server/repositories/mock/mock-session.repository.ts
// 用 Map<string, Session> 存储（模块级单例，共享于同一进程）
// save(session): 若 session.id 为空则用 crypto.randomUUID() 生成；存入 Map；返回存储后的 session
// findAll(): 返回 [...store.values()]
// findById(id): store.get(id) ?? null
// findRecent(limit=10): [...store.values()].sort((a,b) => b.createdAt - a.createdAt).slice(0, limit)
// delete(id): store.delete(id)
```

### SessionService 扩展

```ts
// src/server/services/session.service.ts
class SessionService {
  constructor(
    private readonly repo: SessionRepository,
    private readonly templateRepo: TemplateRepository  // 新增（必填）
  )

  // 原有，不变：
  async listSessions(): Promise<Session[]>

  // 新增：
  async createSession(params: CreateSessionParams): Promise<CreateSessionResult>
  // 校验：topic.trim() 为空 → TOPIC_REQUIRED；topic.trim().length > 100 → TOPIC_TOO_LONG
  // 验模板：templateRepo.findById(params.templateId) 返回 null → TEMPLATE_NOT_FOUND
  // 构造 Session（id 由 repo.save 中的 crypto.randomUUID() 生成）
  // modelStrategyId: params.modelStrategyId ?? DEFAULT_STRATEGY_ID
  // state.stage 初始为 'idle'（对应 PRD BE-007 "phase 初始为 idle"）
  // 调用 repo.save(session) → 返回 CreateSessionResult

  async getRecentSessions(limit?: number): Promise<Session[]>
  // 调用 repo.findRecent(limit)
}
```

### HomeModule UI 结构

```
HomeModule (src/modules/home/index.tsx)
  ├─ 状态：topic, selectedTemplateId, selectedStrategyId, isSubmitting, topicError
  ├─ 状态：recentSessions, isLoadingRecent, recentError
  ├─ 状态：isTemplateSheetOpen, isStrategySheetOpen
  ├─ 快速开始静态常量：['评估新功能优先级', '制定市场进入策略', '分析用户增长方案', '优化定价策略']
  ├─ Hero 区
  │   ├─ Textarea (topic, maxLength=100, 实时字数 `n/100`)
  │   ├─ 行内错误提示（topicError 非空时显示）
  │   ├─ 模板 Card（显示当前模板名，点击 → isTemplateSheetOpen=true）
  │   ├─ 策略 Card（显示当前策略名，点击 → isStrategySheetOpen=true）
  │   └─ Button "开始讨论"（isSubmitting 时 loading + 禁用）
  ├─ 快速开始区（4 个 chip，点击 → setTopic(text)）
  ├─ 最近讨论区
  │   ├─ loading: 骨架占位
  │   ├─ error: Toast 错误提示
  │   ├─ empty: "暂无最近讨论"
  │   └─ list: RecentSession 列表项（topic, templateId, status, createdAt，点击 → router.push）
  ├─ Sheet 模板选择
  │   ├─ 三国军师团（可选，id: 'three-kingdoms-advisors'）
  │   ├─ 创业公司董事会（disabled，标注"即将支持"，UI 静态常量）
  │   └─ 产品辩论桌（disabled，标注"即将支持"，UI 静态常量）
  └─ Sheet 策略选择（来自 MODEL_STRATEGIES 常量，全部可选）
```

**模块间依赖**：
- `HomeModule` → fetch `POST /api/sessions` 和 `GET /api/sessions/recent`
- `HomeModule` → `Sheet`、`Toast`、`Button`、`Textarea`（`src/components/ui/`）
- `HomeModule` → `useRouter`（`next/navigation`）
- `HomeModule` → `MODEL_STRATEGIES`、`DEFAULT_STRATEGY_ID`（`src/data/model-strategies.ts`）

---

## Output Contract

| 任务 | 对外产物 | 输入 | 输出 | 产出类型 | 功能类型（type id） | 是否跨组件 | 测试规范 |
|---|---|---|---|---|---|---|---|
| Task-01 | 扩展 DiscussionStage + Session 类型 | — | TypeScript 类型 | none | 类型扩展 (none) | 否 | — |
| Task-02 | CreateSessionParams / CreateSessionResult 接口 | — | 导出类型 | none | 类型定义 (none) | 否 | — |
| Task-03 | ModelStrategy 常量 | — | 常量导出 | none | 数据常量 (none) | 否 | — |
| Task-04 | SessionRepository.findRecent 签名 | limit?: number | `Promise<Session[]>` | none | 接口定义 (none) | 否 | — |
| Task-05 | MockSessionRepository Map 存储 | Session | Session | none | Mock 实现 (none) | 否 | — |
| Task-06 | SessionService.createSession | CreateSessionParams | CreateSessionResult | none | 服务层业务逻辑 (none) | 否 | — |
| Task-07 | SessionService.getRecentSessions | limit?: number | `Session[]` | none | 服务层查询 (none) | 否 | — |
| Task-08 | POST /api/sessions | HTTP JSON body | HTTP 200/400/404/500 JSON | web-e2e | Web API 创建会话 (web-e2e) | 是（Route Handler → SessionService → MockSessionRepository） | `standards/testing/web-e2e.md` |
| Task-09 | GET /api/sessions/recent | HTTP 无参 | HTTP 200/500 JSON | web-e2e | Web API 最近会话 (web-e2e) | 是（Route Handler → SessionService → MockSessionRepository） | `standards/testing/web-e2e.md` |
| Task-10 | HomeModule 首页 UI | 用户交互 | 页面状态/路由跳转 | frontend-ui | 前端 UI 页面 (frontend-ui) | 是（HomeModule → POST /api/sessions → GET /api/sessions/recent） | `standards/testing/frontend-ui.md` |
| Task-11 | 更新现有测试兼容性 | — | 测试通过 | none | 测试基础设施 (none) | 否 | — |

**必须声明的测试规范（来自 workflow.yaml features: [web-api]）**：
- `standards/testing/web-e2e.md`（覆盖 Task-08、Task-09）
- `standards/testing/frontend-ui.md`（覆盖 Task-10）
- `standards/testing/integration.md`（组件链：Route Handler → Service → Repository）

---

## Change Log

| 文件 | 变更类型 | 原因 |
|---|---|---|
| `src/types/index.ts` | 修改 | 新增 `'idle'` 到 DiscussionStage；Session 增加 `status`（必填）和 `modelStrategyId`（可选）|
| `src/types/api.ts` | 修改 | 新增 `CreateSessionParams`、`CreateSessionResult` 接口 |
| `src/data/model-strategies.ts` | 新增 | 定义模型策略枚举与常量 |
| `src/server/repositories/session.repository.ts` | 修改 | 新增 `findRecent` 接口方法 |
| `src/server/repositories/mock/mock-session.repository.ts` | 修改 | 重写为 in-memory Map 存储；实现带 uuid 的 `save` 和 `findRecent` |
| `src/server/services/session.service.ts` | 修改 | 构造器增加 `templateRepo`；新增 `createSession` 和 `getRecentSessions` |
| `src/server/services/services.test.ts` | 修改 | `SessionService` 构造调用补充第二参数 `new MockTemplateRepository()` |
| `src/app/api/sessions/route.ts` | 修改 | GET handler 补 templateRepo 构造参数；新增 POST handler |
| `src/app/api/sessions/recent/route.ts` | 新增 | GET /api/sessions/recent 路由 |
| `src/modules/home/index.tsx` | 修改 | 替换占位，实现完整首页 UI |
| `src/tests/utils/mock-factories.ts` | 修改 | `mockSession()` 补充 `status: 'active'`（Session 新增必填字段） |

---

## Development Tasks

- Task-01：扩展 Session 类型（添加 idle 阶段、status、modelStrategyId 字段）
  - 所属模块：types
  - 简要描述：在 `src/types/index.ts` 中扩展 `DiscussionStage`（加 `'idle'`）；在 `Session` 接口中增加 `status: 'active' | 'completed' | 'archived'`（必填）和 `modelStrategyId?: string`（可选）。同步更新 `src/tests/utils/mock-factories.ts` 的 `mockSession()` 补充 `status: 'active'`
  - 涉及接口/方法：`DiscussionStage`、`Session`、`mockSession()`
  - 输入：无（类型定义）
  - 输出：编译通过，现有测试全部继续通过
  - 产出类型：none
  - 功能类型：TypeScript 类型扩展（type id: none）
  - 是否跨组件：否

- Task-02：新增 CreateSessionParams 和 CreateSessionResult 类型
  - 所属模块：types
  - 简要描述：在 `src/types/api.ts` 中新增 `CreateSessionParams { topic, templateId, modelStrategyId? }` 和 `CreateSessionResult { sessionId, topic, template:{id,name}, status:'active', createdAt }` 接口
  - 涉及接口/方法：`CreateSessionParams`、`CreateSessionResult`
  - 输入：无
  - 输出：导出类型
  - 产出类型：none
  - 功能类型：类型定义（type id: none）
  - 是否跨组件：否

- Task-03：定义 ModelStrategy 数据常量
  - 所属模块：data
  - 简要描述：新建 `src/data/model-strategies.ts`，定义 `ModelStrategyId`、`ModelStrategy`，导出 `MODEL_STRATEGIES`（3 条）和 `DEFAULT_STRATEGY_ID = 'smart'`
  - 涉及接口/方法：`ModelStrategyId`、`ModelStrategy`、`MODEL_STRATEGIES`、`DEFAULT_STRATEGY_ID`
  - 输入：无
  - 输出：常量导出
  - 产出类型：none
  - 功能类型：数据常量（type id: none）
  - 是否跨组件：否

- Task-04：扩展 SessionRepository 接口（添加 findRecent 方法）
  - 所属模块：server/repositories
  - 简要描述：在 `src/server/repositories/session.repository.ts` 中新增 `findRecent(limit?: number): Promise<Session[]>` 方法签名
  - 涉及接口/方法：`SessionRepository.findRecent()`
  - 输入：limit?: number（默认 10）
  - 输出：`Promise<Session[]>`，按 createdAt 倒序
  - 产出类型：none
  - 功能类型：接口定义（type id: none）
  - 是否跨组件：否

- Task-05：实现 MockSessionRepository 内存存储与 findRecent
  - 所属模块：server/repositories/mock
  - 简要描述：将 MockSessionRepository 重写为 `Map<string, Session>` 存储；`save` 用 `crypto.randomUUID()` 赋 id；`findRecent` 按 createdAt 倒序切片
  - 涉及接口/方法：`MockSessionRepository.save()`、`MockSessionRepository.findAll()`、`MockSessionRepository.findById()`、`MockSessionRepository.findRecent()`
  - 输入：`save(session)` session 对象（id 可为空）；`findRecent(limit)`
  - 输出：`save` 返回含 id 的 Session；`findAll/findRecent` 返回存储中的 Session 数组
  - 产出类型：none
  - 功能类型：Mock 仓储实现（type id: none）
  - 是否跨组件：否

- Task-06：实现 SessionService.createSession
  - 所属模块：server/services
  - 简要描述：更新 `SessionService` 构造器加入 `templateRepo: TemplateRepository`；实现 `createSession`：校验 topic 非空且 ≤100 字；`templateRepo.findById(templateId)` 验证模板；构造 Session（stage='idle'，modelStrategyId 若缺省用 `DEFAULT_STRATEGY_ID`）；调用 `repo.save`；返回 `CreateSessionResult`
  - 涉及接口/方法：`SessionService.createSession(params: CreateSessionParams): Promise<CreateSessionResult>`
  - 输入：`CreateSessionParams`
  - 输出：`CreateSessionResult`；topic 为空/空白 → `TOPIC_REQUIRED`；topic >100 字 → `TOPIC_TOO_LONG`；模板不存在 → `TEMPLATE_NOT_FOUND`
  - 产出类型：none
  - 功能类型：服务层业务逻辑（type id: none）
  - 是否跨组件：否

- Task-07：实现 SessionService.getRecentSessions
  - 所属模块：server/services
  - 简要描述：在 `SessionService` 中新增 `getRecentSessions(limit?: number): Promise<Session[]>`，调用 `repo.findRecent(limit)`
  - 涉及接口/方法：`SessionService.getRecentSessions()`
  - 输入：limit?: number（默认 10）
  - 输出：`Session[]`
  - 产出类型：none
  - 功能类型：服务层查询（type id: none）
  - 是否跨组件：否

- Task-08：实现 POST /api/sessions 路由
  - 所属模块：app/api/sessions
  - 简要描述：在 `src/app/api/sessions/route.ts` 新增 `POST` handler；解析 body；调用 `createSession`；将 `ServiceError` code 映射为 400/404/500；同时更新 `GET` handler 构造器（补 `new MockTemplateRepository()` 第二参数）
  - 涉及接口/方法：`POST /api/sessions`
  - 输入：`{ topic, templateId, modelStrategyId? }` JSON body
  - 输出：HTTP 200/400/404/500 `ApiResponse<CreateSessionResult>`
  - 产出类型：web-e2e
  - 功能类型：Web API 创建会话（type id: web-e2e）
  - 是否跨组件：是（组件链路：Route Handler → SessionService → MockSessionRepository）

- Task-09：实现 GET /api/sessions/recent 路由
  - 所属模块：app/api/sessions/recent
  - 简要描述：新建 `src/app/api/sessions/recent/route.ts`；调用 `SessionService.getRecentSessions(10)`；返回 Session 数组
  - 涉及接口/方法：`GET /api/sessions/recent`
  - 输入：无（HTTP GET）
  - 输出：HTTP 200/500 `ApiResponse<Session[]>`
  - 产出类型：web-e2e
  - 功能类型：Web API 最近会话（type id: web-e2e）
  - 是否跨组件：是（组件链路：Route Handler → SessionService → MockSessionRepository）

- Task-10：实现 HomeModule 首页完整 UI
  - 所属模块：modules/home
  - 简要描述：替换 `src/modules/home/index.tsx` 占位，实现完整首页：议题输入（max 100字 + 计数器 + 行内错误提示）、模板卡片+Sheet（三选一，后两个 disabled）、策略卡片+Sheet（MODEL_STRATEGIES 3 选）、"开始讨论"按钮（loading 防重）、快速开始 chip（4 个静态议题）、最近讨论列表（API 数据 + loading/empty/error 状态）
  - 涉及接口/方法：`HomeModule()`
  - 输入：用户交互
  - 输出：页面渲染、跳转 `/discussion/[sessionId]`
  - 产出类型：frontend-ui
  - 功能类型：前端 UI 页面（type id: frontend-ui）
  - 是否跨组件：是（组件链路：HomeModule → POST /api/sessions → GET /api/sessions/recent）

- Task-11：更新现有测试兼容性（services.test.ts 构造器参数）
  - 所属模块：server/services
  - 简要描述：在 `src/server/services/services.test.ts` 中更新 `new SessionService(new MockSessionRepository())` 为 `new SessionService(new MockSessionRepository(), new MockTemplateRepository())`，确保现有测试继续通过
  - 涉及接口/方法：`SessionService` 构造器调用
  - 输入：无（测试代码更新）
  - 输出：`npx tsc --noEmit` 无错误；现有测试全部通过
  - 产出类型：none
  - 功能类型：测试基础设施维护（type id: none）
  - 是否跨组件：否
