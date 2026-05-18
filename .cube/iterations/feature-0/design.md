# Design — 迭代 0：项目脚手架与模块骨架

**版本**：v1.1（修订：修复审查发现的 CRITICAL/HIGH 问题）
**日期**：2026-05-18  
**迭代**：feature/0

---

## 1. 概述

### 问题描述
项目从零开始，无任何源代码。需要建立一个规范、可演进的 Next.js 14 全栈项目基础，为后续 9 个迭代提供清晰的目录边界、类型系统、接口契约和 Mock 数据。

### 整体方案
- 使用 `create-next-app` 初始化 Next.js 14 App Router + TypeScript strict + Tailwind CSS 项目
- 在 `src/` 下按职责分层：`app/`（路由）、`components/`（UI）、`modules/`（页面功能容器）、`engine/`（讨论引擎）、`server/`（服务/仓储）、`llm/`（模型适配）、`types/`（类型）、`data/`（Mock 数据）、`config/`（配置）
- 核心领域类型在 `src/types/index.ts` 导出；API 响应结构类型在 `src/types/api.ts` 导出
- API 路由通过统一响应类型包装，路由只做参数验证和结果封装，业务逻辑下沉到 Service，Service 通过 Repository 接口访问数据
- 引擎模块（`src/engine/`）为纯 TypeScript 模块，不依赖 React 或 Next.js
- `src/modules/` 是页面功能容器（Page → Module → engine/service 调用），迭代 0 骨架阶段允许 modules 直接 import engine 类型接口（不含实现），后续迭代统一改为经由 server/services 层
- 使用 Vitest 作为测试框架（环境 jsdom，路径别名配置），测试文件与源码同目录（`*.test.ts`），测试工具函数放 `src/tests/utils/`
- `ServiceError` 作为所有 Service 层的统一错误基类，放在 `src/server/errors.ts`

### 核心约束
- TypeScript 严格模式全程通过（`npx tsc --noEmit`）
- ESLint 无 error（`next lint`）
- 所有 API 路由调用 Service 层，Service 调用 Repository 接口（AC-013）
- UI 层（modules/app）不得直接实现调度逻辑，只能调用 engine/service 接口
- 本迭代不实现任何真实业务逻辑——只有接口定义、类型声明和空实现

---

## 2. Impact Analysis

| 模块/文件 | 变更类型 | 影响说明 |
|-----------|----------|----------|
| 项目根目录 | 新增 | 初始化 Next.js 项目（package.json、tsconfig.json、next.config.ts 等） |
| `src/types/` | 新增 | 核心领域类型（index.ts）+ API 响应类型（api.ts），后续所有迭代的类型基础 |
| `src/app/` | 新增 | Next.js App Router 页面和 API 路由 |
| `src/components/` | 新增 | 基础 UI 组件，后续迭代直接复用 |
| `src/modules/` | 新增 | 页面功能容器（由 page.tsx 引用，持有页面级 state 和组件编排，不持有业务逻辑） |
| `src/engine/` | 新增 | 讨论引擎骨架，后续迭代 2-7 在此填充逻辑 |
| `src/server/` | 新增 | 服务层、仓储层、错误类，后续迭代在此实现业务 |
| `src/llm/` | 新增 | LLM Provider Adapter 骨架 |
| `src/data/` | 新增 | Mock 数据，三国军师团模板 |
| `src/config/` | 新增 | 配置读取模块 |
| `vitest.config.ts` | 新增 | 测试框架配置（环境 jsdom，路径别名，coverage） |

**兼容性分析**：全新项目，无现有代码，无兼容性问题。

---

## 3. Flow Design

### 页面访问流程
```
用户访问 URL
  → Next.js App Router 匹配路由
  → RootLayout（App Shell）渲染
    ├─ Header（状态栏占位）
    ├─ main（页面内容区，渲染子页面）
    └─ BottomNav（底部 Tab 导航）
```

### API 请求流程（统一，所有 API 路由遵循此链路）
```
HTTP Request
  → Next.js Route Handler (src/app/api/*/route.ts)
    → try { requestId = randomUUID() }
    → Service 调用 (src/server/services/)
      → Repository 调用 (src/server/repositories/)
        → Mock 数据返回 / throw ServiceError
    → catch ServiceError
    → 封装统一响应 { success, data, error, requestId }
  → HTTP Response (JSON)
```

### health API 特殊说明
`/api/health` 调用 `HealthService.getHealth()`，HealthService 不依赖 Repository，直接从 AppConfig 读取 version 并返回 `{ version, status: 'ok', timestamp }`。这保持了"路由不内联业务逻辑"的约束。

### 引擎模块分层（骨架阶段临时规则）
```
src/modules/discussion/
  → src/engine/orchestrator.ts（只 import 接口 Orchestrator，不 import 实现类）
  → src/types/（共享类型）

注意：FR-E-007 要求 UI 层不直接实现调度逻辑。
迭代 0 骨架阶段，modules 可 import engine 接口（用于类型标注），
后续迭代（迭代 2+）统一改为经 src/server/services/ 调用引擎。
```

### 异常处理
- Service 层：抛出 `ServiceError`（`src/server/errors.ts`），字段 `code: string`、`message: string`
- Route Handler：捕获 `ServiceError`，转换为 `{ success: false, data: null, error: { code, message }, requestId }`，HTTP 500
- TypeScript 严格模式在编译期捕获类型错误

---

## 4. Table Design

本迭代无数据库表。领域数据通过 TypeScript 类型定义：

### src/types/index.ts — 核心领域类型
```typescript
export type DiscussionStage = 'opening' | 'developing' | 'climax' | 'closing'

export interface DiscussionState {
  stage: DiscussionStage
  turnCount: number
  lastSpeakerId: string | null
}

export interface Role {
  id: string
  name: string
  persona: string
  isHost: boolean
  systemPrompt: string
  avatarEmoji?: string
}

export interface Template {
  id: string
  name: string
  description: string
  worldview: string
  roles: Role[]
  events: DiscussionEvent[]
  rhythmConfig: RhythmConfig
}

export interface Message {
  id: string
  sessionId: string
  roleId: string
  content: string
  type: 'text' | 'event' | 'system'
  timestamp: number
}

export interface Session {
  id: string
  templateId: string
  topic: string
  state: DiscussionState
  messages: Message[]
  createdAt: number
  updatedAt: number
}

// Discussion 表示一次正在进行的讨论运行时（迭代 2+ 完善）
export interface Discussion {
  id: string
  sessionId: string
  status: 'active' | 'paused' | 'completed'
  createdAt: number
}

export interface LLMConfig {
  provider: string
  model: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
}

export type EventType = 'face-slap' | 'side-taking' | 'vote' | 'reversal'

export interface DiscussionEvent {
  id: string
  type: EventType
  trigger: string
  description: string
}

export interface RhythmConfig {
  maxTurnsPerStage: Partial<Record<DiscussionStage, number>>
  minTurnsBeforeClimax: number
}

// Agent = 运行时角色（AgentProfile + 方法）
export interface Agent {
  profile: AgentProfile
  run(context: Session): Promise<AgentOutput>
}

export interface AgentProfile {
  roleId: string
  role: Role
  llmConfig: LLMConfig
}

export interface AgentOutput {
  roleId: string
  content: string
  eventTriggered?: EventType
  timestamp: number
}

export interface AgentRuntime {
  run(profile: AgentProfile, context: Session): Promise<AgentOutput>
}
```

### src/types/api.ts — API 响应结构类型
```typescript
export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error?: ApiError
  requestId: string
}
```

### src/config/types.ts — 应用配置类型
```typescript
export interface AppConfig {
  version: string
  llm: {
    apiKey: string
    baseUrl: string
    model: string
  }
}
```

环境变量映射：
| 环境变量 | AppConfig 字段 | 默认值 |
|----------|---------------|--------|
| `NEXT_PUBLIC_APP_VERSION` | `version` | `"0.1.0"` |
| `LLM_API_KEY` | `llm.apiKey` | `""` |
| `LLM_BASE_URL` | `llm.baseUrl` | `"https://api.anthropic.com"` |
| `LLM_MODEL` | `llm.model` | `"claude-haiku-4-5-20251001"` |

---

## 5. API Design

### 统一响应类型（来自 src/types/api.ts）
```typescript
// ApiResponse<T>、ApiError 见 Section 4
```

### Endpoints

#### GET /api/health
- **组件链路**：Route → HealthService → AppConfig
- **请求**：无参数
- **响应**：`ApiResponse<{ version: string; status: 'ok'; timestamp: string }>`
- **成功示例**：`{ success: true, data: { version: "0.1.0", status: "ok", timestamp: "2026-05-18T00:00:00.000Z" }, requestId: "uuid" }`
- **错误码**：`INTERNAL_ERROR`（500）

#### GET /api/templates
- **组件链路**：Route → TemplateService → TemplateRepository
- **请求**：无参数
- **响应**：`ApiResponse<Template[]>`
- **成功示例**：`{ success: true, data: [...], requestId: "uuid" }`
- **错误码**：`INTERNAL_ERROR`（500）

#### GET /api/sessions
- **组件链路**：Route → SessionService → SessionRepository
- **请求**：无参数
- **响应**：`ApiResponse<Session[]>`
- **错误码**：`INTERNAL_ERROR`（500）

#### GET /api/discussions
- **组件链路**：Route → DiscussionService → DiscussionRepository
- **请求**：无参数
- **响应**：`ApiResponse<Discussion[]>`
- **错误码**：`INTERNAL_ERROR`（500）

#### GET /api/llm/providers
- **组件链路**：Route → LlmService（无 Repository，从 AppConfig 读取）
- **请求**：无参数
- **响应**：`ApiResponse<{ id: string; name: string }[]>`
- **成功示例**：`{ success: true, data: [{ id: "anthropic", name: "Anthropic" }], requestId: "uuid" }`
- **错误码**：`INTERNAL_ERROR`（500）

---

## 6. Module Design

### 目录结构
```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── discussion/[sessionId]/page.tsx
│   ├── sessions/page.tsx
│   ├── templates/page.tsx
│   ├── settings/page.tsx
│   ├── globals.css
│   └── api/
│       ├── health/route.ts
│       ├── templates/route.ts
│       ├── sessions/route.ts
│       ├── discussions/route.ts
│       └── llm/providers/route.ts
├── components/
│   ├── layout/
│   │   └── AppShell.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Textarea.tsx
│   │   ├── Card.tsx
│   │   ├── Tag.tsx
│   │   ├── Sheet.tsx
│   │   ├── Modal.tsx
│   │   └── Toast.tsx
│   └── mobile/
│       └── BottomNav.tsx
├── modules/
│   ├── home/index.tsx          # 首页功能容器（发起讨论占位）
│   ├── discussion/index.tsx    # 讨论功能容器（消息流、角色栏、输入区占位）
│   ├── sessions/index.tsx      # 会话列表容器（列表、搜索、筛选占位）
│   ├── templates/index.tsx     # 模板详情容器（模板详情、角色列表占位）
│   └── settings/index.tsx      # 设置容器（Provider、模型、Prompt 占位）
├── engine/
│   ├── orchestrator.ts
│   ├── scheduler.ts
│   ├── state-machine.ts
│   ├── director.ts
│   ├── intent.ts
│   ├── events.ts
│   └── rhythm.ts
├── server/
│   ├── errors.ts               # ServiceError 基类
│   ├── services/
│   │   ├── health.service.ts
│   │   ├── template.service.ts
│   │   ├── session.service.ts
│   │   ├── discussion.service.ts
│   │   └── llm.service.ts
│   └── repositories/
│       ├── template.repository.ts     # interface
│       ├── session.repository.ts      # interface
│       ├── discussion.repository.ts   # interface
│       └── mock/
│           ├── mock-template.repository.ts
│           ├── mock-session.repository.ts
│           └── mock-discussion.repository.ts
├── llm/
│   └── providers/
│       └── base.provider.ts
├── config/
│   ├── index.ts
│   └── types.ts
├── data/
│   └── templates/
│       └── three-kingdoms.ts
├── types/
│   ├── index.ts
│   └── api.ts
└── tests/
    └── utils/
        └── mock-factories.ts
```

### 关键接口定义

**ServiceError**
```typescript
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) { super(message) }
}
```

**Repository 接口**
```typescript
export interface TemplateRepository {
  findAll(): Promise<Template[]>
  findById(id: string): Promise<Template | null>
}
export interface SessionRepository {
  findAll(): Promise<Session[]>
  findById(id: string): Promise<Session | null>
  save(session: Session): Promise<Session>
  delete(id: string): Promise<void>
}
export interface DiscussionRepository {
  findAll(): Promise<Discussion[]>
  findById(id: string): Promise<Discussion | null>
}
```

**Service 接口**
```typescript
// HealthService — 无 Repository 依赖
export class HealthService {
  constructor(private config: AppConfig) {}
  async getHealth(): Promise<{ version: string; status: 'ok'; timestamp: string }>
}
// TemplateService
export class TemplateService {
  constructor(private repo: TemplateRepository) {}
  async listTemplates(): Promise<Template[]>
  async getTemplate(id: string): Promise<Template | null>
}
// SessionService
export class SessionService {
  constructor(private repo: SessionRepository) {}
  async listSessions(): Promise<Session[]>
}
// DiscussionService
export class DiscussionService {
  constructor(private repo: DiscussionRepository) {}
  async listDiscussions(): Promise<Discussion[]>
}
// LlmService — 无 Repository，从 AppConfig 读取 Provider 列表
export class LlmService {
  constructor(private config: AppConfig) {}
  async listProviders(): Promise<{ id: string; name: string }[]>
}
```

**Engine 接口（骨架）**
```typescript
export interface Orchestrator {
  start(session: Session): Promise<void>
  next(session: Session): Promise<AgentOutput | null>
}
export class DefaultOrchestrator implements Orchestrator {
  async start(_session: Session): Promise<void> { throw new Error('not implemented') }
  async next(_session: Session): Promise<AgentOutput | null> { throw new Error('not implemented') }
}
```

**LLM Provider 接口**
```typescript
export interface LLMMessage { role: 'user' | 'assistant' | 'system'; content: string }
export interface LLMProvider {
  chat(messages: LLMMessage[], config: LLMConfig): Promise<string>
}
```

### 模块依赖关系
```
app/api/* → server/services/* → server/repositories/*
app/api/health → server/services/health.service.ts → config/index.ts
app/api/llm/* → server/services/llm.service.ts → config/index.ts
app/pages → modules/* → types/*
modules/discussion → engine/orchestrator (仅 import Orchestrator 接口，用于类型标注)
engine/* → types/*
```

---

## 7. Output Contract

| 功能 | 功能类型描述 | type id | 是否跨组件 | 组件链路 | 测试规范 |
|------|-------------|---------|------------|---------|---------|
| GET /api/health | Web API 健康检查端点 | web-e2e | 是 | Route → HealthService → AppConfig | standards/testing/web-e2e.md |
| GET /api/templates | Web API 模板列表端点 | web-e2e | 是 | Route → TemplateService → TemplateRepository | standards/testing/web-e2e.md |
| GET /api/sessions | Web API 会话列表端点 | web-e2e | 是 | Route → SessionService → SessionRepository | standards/testing/web-e2e.md |
| GET /api/discussions | Web API 讨论列表端点 | web-e2e | 是 | Route → DiscussionService → DiscussionRepository | standards/testing/web-e2e.md |
| GET /api/llm/providers | Web API LLM Provider 列表端点 | web-e2e | 是 | Route → LlmService → AppConfig | standards/testing/web-e2e.md |
| 核心类型定义（types/index.ts） | TypeScript 类型库 | library | 否 | — | standards/testing/library.md |
| API 响应类型（types/api.ts） | TypeScript 类型库 | library | 否 | — | standards/testing/library.md |
| Repository 接口 + Mock 实现 | TypeScript 类型库 | library | 否 | — | standards/testing/library.md |
| Service 层骨架 | TypeScript 类型库 | library | 是 | Service → Repository | standards/testing/library.md |
| 引擎模块骨架（engine/*） | TypeScript 类型库 | library | 否 | — | standards/testing/library.md |
| Mock 三国军师团模板 | 静态 Mock 数据 | none | 否 | — | — |
| App Shell / 页面骨架 | UI 骨架 | none | 否 | — | — |
| 测试工具函数 | 测试辅助函数库 | library | 否 | — | standards/testing/library.md |

**API 响应契约**：
- 所有 API 返回 `ApiResponse<T>`（见 Section 4，`src/types/api.ts`）
- `requestId = crypto.randomUUID()`
- 正常响应：`{ success: true, data: <payload>, requestId }`
- 错误响应：`{ success: false, data: null, error: { code: "INTERNAL_ERROR", message: "..." }, requestId }`

---

## 8. Change Log

| 文件/目录 | 变更类型 | 说明 |
|-----------|----------|------|
| `package.json` | 新增 | Next.js 14、TypeScript、Tailwind CSS、Vitest、@testing-library/react 等依赖 |
| `tsconfig.json` | 新增 | TypeScript strict 配置，路径别名 `@/*` → `src/*` |
| `next.config.ts` | 新增 | Next.js 配置 |
| `vitest.config.ts` | 新增 | Vitest 配置（环境 jsdom，路径别名，coverage） |
| `.env.local.example` | 新增 | 环境变量模板（NEXT_PUBLIC_APP_VERSION、LLM_API_KEY、LLM_BASE_URL、LLM_MODEL） |
| `tailwind.config.ts` | 新增 | Tailwind CSS 配置，含设计 token（颜色、间距、字体） |
| `postcss.config.js` | 新增 | PostCSS 配置（Tailwind 依赖） |
| `src/types/index.ts` | 新增 | 核心领域类型（Template、Role、Agent、Message、Session 等） |
| `src/types/api.ts` | 新增 | API 响应结构类型（ApiResponse、ApiError） |
| `src/config/types.ts` | 新增 | AppConfig 类型定义 |
| `src/config/index.ts` | 新增 | getAppConfig() 函数，读取环境变量 |
| `src/app/globals.css` | 新增 | 全局样式，Tailwind 指令，CSS 变量（颜色：primary/surface/text；间距等） |
| `src/app/layout.tsx` | 新增 | Root layout（App Shell） |
| `src/app/page.tsx` | 新增 | 首页 |
| `src/app/discussion/[sessionId]/page.tsx` | 新增 | 讨论页 |
| `src/app/sessions/page.tsx` | 新增 | 会话页 |
| `src/app/templates/page.tsx` | 新增 | 模板页 |
| `src/app/settings/page.tsx` | 新增 | 设置页 |
| `src/app/api/health/route.ts` | 新增 | health API |
| `src/app/api/templates/route.ts` | 新增 | templates API |
| `src/app/api/sessions/route.ts` | 新增 | sessions API |
| `src/app/api/discussions/route.ts` | 新增 | discussions API |
| `src/app/api/llm/providers/route.ts` | 新增 | llm/providers API |
| `src/components/layout/AppShell.tsx` | 新增 | App Shell 布局组件 |
| `src/components/mobile/BottomNav.tsx` | 新增 | 底部导航组件 |
| `src/components/ui/Button.tsx` | 新增 | Button 组件骨架 |
| `src/components/ui/Input.tsx` | 新增 | Input 组件骨架 |
| `src/components/ui/Textarea.tsx` | 新增 | Textarea 组件骨架 |
| `src/components/ui/Card.tsx` | 新增 | Card 组件骨架 |
| `src/components/ui/Tag.tsx` | 新增 | Tag 组件骨架 |
| `src/components/ui/Sheet.tsx` | 新增 | Sheet 组件骨架 |
| `src/components/ui/Modal.tsx` | 新增 | Modal 组件骨架 |
| `src/components/ui/Toast.tsx` | 新增 | Toast 组件骨架 |
| `src/modules/home/index.tsx` | 新增 | 首页功能容器 |
| `src/modules/discussion/index.tsx` | 新增 | 讨论功能容器 |
| `src/modules/sessions/index.tsx` | 新增 | 会话列表容器 |
| `src/modules/templates/index.tsx` | 新增 | 模板详情容器 |
| `src/modules/settings/index.tsx` | 新增 | 设置容器 |
| `src/engine/orchestrator.ts` | 新增 | Orchestrator 接口 + DefaultOrchestrator 骨架 |
| `src/engine/scheduler.ts` | 新增 | Scheduler 接口骨架 |
| `src/engine/state-machine.ts` | 新增 | StateMachine 接口骨架 |
| `src/engine/director.ts` | 新增 | Director 接口骨架 |
| `src/engine/intent.ts` | 新增 | IntentRecognizer 接口骨架 |
| `src/engine/events.ts` | 新增 | EventDetector 接口骨架 |
| `src/engine/rhythm.ts` | 新增 | RhythmController 接口骨架 |
| `src/server/errors.ts` | 新增 | ServiceError 基类 |
| `src/server/services/health.service.ts` | 新增 | HealthService（返回 health 信息） |
| `src/server/services/template.service.ts` | 新增 | TemplateService 骨架 |
| `src/server/services/session.service.ts` | 新增 | SessionService 骨架 |
| `src/server/services/discussion.service.ts` | 新增 | DiscussionService 骨架 |
| `src/server/services/llm.service.ts` | 新增 | LlmService 骨架 |
| `src/server/repositories/template.repository.ts` | 新增 | TemplateRepository 接口 |
| `src/server/repositories/session.repository.ts` | 新增 | SessionRepository 接口 |
| `src/server/repositories/discussion.repository.ts` | 新增 | DiscussionRepository 接口 |
| `src/server/repositories/mock/mock-template.repository.ts` | 新增 | MockTemplateRepository |
| `src/server/repositories/mock/mock-session.repository.ts` | 新增 | MockSessionRepository |
| `src/server/repositories/mock/mock-discussion.repository.ts` | 新增 | MockDiscussionRepository |
| `src/llm/providers/base.provider.ts` | 新增 | LLMProvider 接口（LLMMessage + chat() 方法） |
| `src/data/templates/three-kingdoms.ts` | 新增 | 三国军师团模板 Mock 数据 |
| `src/tests/utils/mock-factories.ts` | 新增 | 测试工具函数（mockTemplate/Role/Message/Session） |

---

## 9. Development Tasks

- Task-01：初始化 Next.js 14 + TypeScript strict + Tailwind CSS + Vitest 项目
  - 所属模块：项目根
  - 简要描述：使用 create-next-app 初始化项目（App Router、TypeScript strict、Tailwind CSS、src/ 目录）；安装 Vitest + @testing-library/react；配置 vitest.config.ts（环境 jsdom，路径别名 @/* → src/*，coverage）；配置 tsconfig.json 路径别名；生成 .env.local.example
  - 涉及接口/方法：N/A（CLI 命令）
  - 输入：无
  - 输出：可运行项目（npm run dev 启动，npx tsc --noEmit 通过，vitest.config.ts 就绪）
  - 产出类型：none
  - 功能类型：项目初始化（type id: none）
  - 是否跨组件：否

- Task-02：定义核心领域类型（src/types/index.ts）
  - 所属模块：types
  - 简要描述：导出全部核心类型：DiscussionStage、DiscussionState、Role、Template、Message、Session、Discussion、LLMConfig、EventType、DiscussionEvent、RhythmConfig、Agent、AgentProfile、AgentRuntime、AgentOutput
  - 涉及接口/方法：N/A（类型定义）
  - 输入：无
  - 输出：TypeScript 类型定义，全项目可 import，tsc --noEmit 通过
  - 产出类型：library
  - 功能类型：TypeScript 核心类型库（type id: library）
  - 是否跨组件：否

- Task-03：定义 API 响应结构类型（src/types/api.ts）和配置类型（src/config/types.ts）
  - 所属模块：types，config
  - 简要描述：定义 ApiResponse<T>、ApiError（src/types/api.ts）；定义 AppConfig 类型（src/config/types.ts）；实现 getAppConfig() 读取环境变量（src/config/index.ts）
  - 涉及接口/方法：`ApiResponse<T>`、`getAppConfig(): AppConfig`
  - 输入：process.env（环境变量）
  - 输出：ApiResponse 类型可被所有 API 路由 import；getAppConfig() 返回 AppConfig 对象
  - 产出类型：library
  - 功能类型：TypeScript API 类型库 + 配置模块（type id: library）
  - 是否跨组件：否

- Task-04：创建 ServiceError 基类（src/server/errors.ts）
  - 所属模块：server
  - 简要描述：定义 ServiceError extends Error，字段 code: string、details?: unknown；所有 Service 层使用此类抛出错误
  - 涉及接口/方法：`new ServiceError(code, message, details?)`
  - 输入：code, message, details
  - 输出：ServiceError 实例，tsc --noEmit 通过
  - 产出类型：library
  - 功能类型：错误基类（type id: library）
  - 是否跨组件：否

- Task-05：创建 App Shell 布局组件（src/app/layout.tsx + src/app/globals.css + src/components/layout/AppShell.tsx）
  - 所属模块：app，components/layout
  - 简要描述：Root Layout 使用 AppShell（含状态栏占位、content 区、BottomNav）；globals.css 包含 Tailwind 指令和 CSS 变量（--color-primary、--color-surface、--color-text-primary、--spacing-safe-bottom 等）；移动端基准宽度 375-430px
  - 涉及接口/方法：`AppShell({ children })`
  - 输入：`children: React.ReactNode`
  - 输出：App Shell 渲染，5 个 Tab 可点击，移动端布局正常
  - 产出类型：none
  - 功能类型：UI 布局骨架（type id: none）
  - 是否跨组件：否

- Task-06：创建底部导航组件（src/components/mobile/BottomNav.tsx）
  - 所属模块：components/mobile
  - 简要描述：5 个 Tab（首页/讨论/会话/模板/设置），使用 Next.js Link 跳转，usePathname 高亮当前 Tab，移动端底部安全区适配
  - 涉及接口/方法：`BottomNav()`
  - 输入：无（内部读取 pathname）
  - 输出：5 Tab 底部导航，active 状态高亮，点击跳转正常
  - 产出类型：none
  - 功能类型：UI 组件（type id: none）
  - 是否跨组件：否

- Task-07：创建 5 个主页面骨架（src/app/*/page.tsx + src/modules/*/index.tsx）
  - 所属模块：app，modules
  - 简要描述：创建首页（/）、讨论页（/discussion/[sessionId]）、会话页（/sessions）、模板页（/templates）、设置页（/settings）page.tsx；每个页面引用对应 modules/*/index.tsx；各 module 显示页面名称、功能说明和"功能开发中"占位内容
  - 涉及接口/方法：各 page.tsx 导出 default，各 module 导出 default
  - 输入：路由参数（讨论页含 sessionId: string）
  - 输出：页面渲染，非空白，无控制台报错
  - 产出类型：none
  - 功能类型：页面骨架（type id: none）
  - 是否跨组件：否

- Task-08：创建基础 UI 组件骨架（src/components/ui/）
  - 所属模块：components/ui
  - 简要描述：创建 Button、Input、Textarea、Card、Tag、Sheet、Modal、Toast 最小可用实现；各组件定义 props 接口（ButtonProps、InputProps 等），有基础 Tailwind 样式；Button 支持 variant（primary/secondary/ghost）和 size（sm/md/lg）；Input/Textarea 受控组件
  - 涉及接口/方法：各组件导出 default 函数
  - 输入：组件 props（类型化）
  - 输出：各组件渲染，tsc --noEmit 通过，无 any 类型
  - 产出类型：none
  - 功能类型：UI 组件骨架（type id: none）
  - 是否跨组件：否

- Task-09：创建 GET /api/health 路由（src/app/api/health/route.ts + src/server/services/health.service.ts）
  - 所属模块：app/api，server/services
  - 简要描述：实现 HealthService.getHealth()（返回 version + status + timestamp）；route.ts 调用 HealthService，捕获异常，包装为 ApiResponse，requestId = crypto.randomUUID()
  - 涉及接口/方法：`GET /api/health`、`HealthService.getHealth()`
  - 输入：HTTP GET 请求
  - 输出：`ApiResponse<{ version: string; status: 'ok'; timestamp: string }>`，HTTP 200
  - 产出类型：web-e2e
  - 功能类型：Web API 健康检查（type id: web-e2e）
  - 是否跨组件：是（组件链路：Route → HealthService → AppConfig）

- Task-10：创建 Repository 接口和 Mock 实现（src/server/repositories/）
  - 所属模块：server/repositories
  - 简要描述：定义 TemplateRepository、SessionRepository、DiscussionRepository 接口；实现 MockTemplateRepository（返回三国模板数据）、MockSessionRepository（返回空数组）、MockDiscussionRepository（返回空数组）
  - 涉及接口/方法：`TemplateRepository.findAll()`、`SessionRepository.findAll()`、`DiscussionRepository.findAll()` 等
  - 输入：无（Mock 实现从 data/ 读取数据）
  - 输出：各 Repository 方法返回类型正确，tsc --noEmit 通过
  - 产出类型：library
  - 功能类型：数据仓储接口 + Mock 实现（type id: library）
  - 是否跨组件：否

- Task-11：创建 Service 层骨架（src/server/services/）
  - 所属模块：server/services
  - 简要描述：创建 TemplateService（listTemplates/getTemplate）、SessionService（listSessions）、DiscussionService（listDiscussions）、LlmService（listProviders）；各 Service 构造函数注入 Repository 或 AppConfig；骨架实现调用 repo 方法并返回结果；捕获异常并 re-throw 为 ServiceError
  - 涉及接口/方法：各 Service 方法（见 Section 6 接口定义）
  - 输入：Repository 实例或 AppConfig（构造函数注入）
  - 输出：各方法返回类型正确，tsc --noEmit 通过
  - 产出类型：library
  - 功能类型：服务层骨架（type id: library）
  - 是否跨组件：是（组件链路：Service → Repository）

- Task-12：创建其余 4 个 API 路由骨架（templates / sessions / discussions / llm/providers）
  - 所属模块：app/api
  - 简要描述：各路由实例化对应 Service（注入 MockRepository 或 AppConfig）；调用 Service 方法；try-catch 捕获 ServiceError 并返回错误响应；统一使用 ApiResponse 包装；requestId = crypto.randomUUID()
  - 涉及接口/方法：`GET /api/templates`、`GET /api/sessions`、`GET /api/discussions`、`GET /api/llm/providers`
  - 输入：HTTP GET 请求
  - 输出：`ApiResponse<T[]>`，HTTP 200；错误时 HTTP 500
  - 产出类型：web-e2e
  - 功能类型：Web API 骨架端点（type id: web-e2e）
  - 是否跨组件：是（组件链路：Route → Service → Repository）

- Task-13：创建引擎模块骨架（src/engine/）
  - 所属模块：engine
  - 简要描述：创建 7 个文件；orchestrator.ts 导出 Orchestrator 接口 + DefaultOrchestrator（方法抛出 Error('not implemented')）；scheduler/state-machine/director/intent/events/rhythm 各导出接口和空类；所有接口方法参数和返回类型使用 src/types/ 中的类型
  - 涉及接口/方法：Orchestrator、Scheduler、StateMachine、Director、IntentRecognizer、EventDetector、RhythmController
  - 输入：各接口入参（Session、AgentOutput 等）
  - 输出：各接口可被 import，tsc --noEmit 通过
  - 产出类型：library
  - 功能类型：引擎接口骨架（type id: library）
  - 是否跨组件：否

- Task-14：创建 LLM Provider Adapter 骨架（src/llm/providers/base.provider.ts）
  - 所属模块：llm
  - 简要描述：定义 LLMMessage 接口（role: 'user'|'assistant'|'system', content: string）和 LLMProvider 接口（chat(messages: LLMMessage[], config: LLMConfig): Promise<string>）；本迭代不实现真实调用
  - 涉及接口/方法：`LLMProvider.chat()`
  - 输入：`LLMMessage[]`、`LLMConfig`
  - 输出：`Promise<string>`（骨架，方法体抛出 Error）
  - 产出类型：library
  - 功能类型：LLM 适配器接口（type id: library）
  - 是否跨组件：否

- Task-15：创建 Mock 三国军师团模板数据（src/data/templates/three-kingdoms.ts）
  - 所属模块：data
  - 简要描述：导出 `threeKingdomsTemplate: Template`，包含：id, name, description, worldview；roles: 主持人荀彧（isHost: true）+ 诸葛亮/司马懿/庞统/周瑜（isHost: false）；events: 4 个占位事件（face-slap/side-taking/vote/reversal）；rhythmConfig 含各阶段 maxTurns 和 minTurnsBeforeClimax
  - 涉及接口/方法：`export const threeKingdomsTemplate: Template`
  - 输入：无
  - 输出：符合 Template 类型的对象，tsc --noEmit 通过
  - 产出类型：none
  - 功能类型：静态 Mock 数据（type id: none）
  - 是否跨组件：否

- Task-16：创建测试工具函数（src/tests/utils/mock-factories.ts）
  - 所属模块：tests
  - 简要描述：导出 mockTemplate(override?: Partial<Template>): Template、mockRole(override?: Partial<Role>): Role、mockMessage(override?: Partial<Message>): Message、mockSession(override?: Partial<Session>): Session；每个工厂函数返回类型正确的完整 Mock 对象
  - 涉及接口/方法：`mockTemplate()`、`mockRole()`、`mockMessage()`、`mockSession()`
  - 输入：Partial<T>（可选覆盖）
  - 输出：完整 Mock 对象，符合对应类型，tsc --noEmit 通过
  - 产出类型：library
  - 功能类型：测试工具函数库（type id: library）
  - 是否跨组件：否
