# PRD — 迭代 0：项目脚手架与模块骨架

**版本**：v1.0  
**日期**：2026-05-18  
**迭代**：feature/0  
**状态**：待评审

---

## 1. 功能概述

建立智囊团项目的可演进基础。本迭代不实现真实业务逻辑，目标是：

1. 初始化 Next.js 14 App Router + TypeScript 项目
2. 建立移动端 App Shell（状态栏 / 内容区 / 底部导航）
3. 搭建 5 个主页面骨架（首页 / 讨论 / 会话 / 模板 / 设置）
4. 建立基础 UI 组件库骨架
5. 建立 API 路由骨架（含 `/api/health`）
6. 建立服务层 / 仓储层 / Mock Repository 目录结构
7. 建立讨论引擎模块骨架（文件占位 + 核心类型定义）
8. 建立 Mock 三国军师团模板数据
9. 建立测试工具函数

完成后，后续迭代可直接在既有目录、类型和模块边界内继续填充。

---

## 2. Functional Requirements

### FR-A：前端页面与 App Shell

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-A-001 | 初始化 Next.js 14 App Router 项目，使用 TypeScript 严格模式 | P0 |
| FR-A-002 | 接入 Tailwind CSS，建立全局 CSS 变量（颜色、间距、字体等） | P0 |
| FR-A-003 | 建立移动端 App Shell：顶部状态栏占位、中间内容区（可滚动）、底部导航（BottomNav） | P0 |
| FR-A-004 | 建立 5 个主页面骨架，路由如下：首页 `/`、讨论 `/discussion/[sessionId]`、会话 `/sessions`、模板 `/templates`、设置 `/settings` | P0 |
| FR-A-005 | 底部导航包含 5 个 Tab 入口（首页 / 讨论 / 会话 / 模板 / 设置），可点击跳转 | P0 |
| FR-A-006 | 所有页面使用统一 App Shell，页面内容区有模块占位（非空白） | P0 |
| FR-A-007 | 移动端宽度（≤430px）下布局可用，无明显错位 | P0 |
| FR-A-008 | 预留 Mock 数据入口（如 `src/data/` 目录），方便迭代 1 快速接入真实数据 | P1 |

**输入**：用户访问对应路由  
**输出**：页面正常渲染，不出现空白、运行时报错或明显样式错位  
**异常**：路由不存在时显示 404 页面（Next.js 默认行为）

---

### FR-B：基础 UI 组件骨架

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-B-001 | 建立组件目录 `src/components/ui/`、`src/components/layout/`、`src/components/mobile/` | P0 |
| FR-B-002 | 创建以下 UI 组件骨架（可接受最小可用实现，不要求完整样式）：Button、Input、Textarea、Card、Tag、Sheet、Modal、Toast、BottomNav | P0 |
| FR-B-003 | 组件导出正确，页面可引用 | P0 |

**输入**：页面引用组件  
**输出**：组件正常渲染，不报类型错误  
**异常**：缺少必要 props 时 TypeScript 编译报错（预期行为）

---

### FR-C：API 路由骨架

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-C-001 | 建立 API 路由骨架：`/api/health`、`/api/templates`、`/api/sessions`、`/api/discussions`、`/api/llm/providers` | P0 |
| FR-C-002 | 建立统一 API 响应结构：`{ success: boolean, data: T \| null, error?: { code: string, message: string, details?: unknown }, requestId: string }` | P0 |
| FR-C-003 | `GET /api/health` 返回 `{ version: string, status: 'ok', timestamp: string }` | P0 |
| FR-C-004 | 其他 API 路由返回空数据结构（空数组或空对象），不报错 | P0 |
| FR-C-005 | API 路由不直接写业务逻辑，必须调用 service 层 | P0 |

**输入**：HTTP GET 请求  
**输出**：符合统一响应结构的 JSON  
**异常**：服务器内部错误返回 `{ success: false, data: null, error: { code: 'INTERNAL_ERROR', message: '...' }, requestId: '...' }`

---

### FR-D：服务层 / 仓储层骨架

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-D-001 | 建立服务层目录 `src/server/services/`，包含 TemplateService、SessionService、DiscussionService 骨架 | P0 |
| FR-D-002 | 建立仓储层接口目录 `src/server/repositories/`，定义 TemplateRepository、SessionRepository 接口 | P0 |
| FR-D-003 | 建立 Mock Repository 实现，返回空数组或 Mock 数据 | P0 |
| FR-D-004 | 建立配置读取模块 `src/config/`，支持环境变量和本地默认配置 | P1 |
| FR-D-005 | 建立 LLM Provider Adapter 骨架 `src/llm/`，本迭代不要求真实调用模型 | P1 |

**输入**：API 路由调用 service  
**输出**：service 返回类型正确的数据  
**异常**：Repository 抛出异常时，service 向上传递结构化错误

---

### FR-E：讨论引擎模块骨架

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-E-001 | 建立 `src/engine/` 目录，包含以下文件骨架：`orchestrator.ts`、`scheduler.ts`、`state-machine.ts`、`director.ts`、`intent.ts`、`events.ts`、`rhythm.ts` | P0 |
| FR-E-002 | 定义核心领域类型（位于 `src/types/`）：Template、Role、Agent、Message、Session、DiscussionState、LLMConfig | P0 |
| FR-E-003 | 定义 Agent 抽象接口：`AgentProfile`、`AgentRuntime`、`AgentOutput` | P0 |
| FR-E-004 | Orchestrator 提供空实现（接口定义完整），后续迭代 2 填充 | P0 |
| FR-E-005 | DiscussionState 定义初始结构（stage / turnCount / lastSpeaker），后续迭代 4 完善 | P0 |
| FR-E-006 | Event 类型定义占位（EventType 枚举 + DiscussionEvent 接口），后续迭代 7 完善 | P0 |
| FR-E-007 | UI 层不得直接调用引擎内部调度逻辑，只能通过 service 层接口 | P0 |

**输入**：引擎模块被其他模块 import  
**输出**：TypeScript 类型检查通过，无循环依赖  
**异常**：类型不匹配时 TypeScript 编译报错（预期行为）

---

### FR-F：Mock 数据与测试工具

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-F-001 | 建立 Mock 三国军师团模板数据（位于 `src/data/`），包含完整 Template 结构（角色：诸葛亮、司马懿、庞统、周瑜，主持人：荀彧） | P0 |
| FR-F-002 | 建立测试工具函数（位于 `src/tests/` 或 `src/__tests__/utils/`）：mockTemplate()、mockRole()、mockMessage()、mockSession() | P1 |

**输入**：测试文件 import 工具函数  
**输出**：返回符合核心类型的 Mock 对象  
**异常**：类型不一致时编译报错

---

## 3. Non-Functional Requirements

| 类别 | 要求 |
|------|------|
| 类型安全 | TypeScript 严格模式（`"strict": true`），编译无 error |
| 代码质量 | ESLint 通过，无阻断错误（`error` 级别） |
| 分层约束 | UI 层不直接写业务逻辑；engine 模块不依赖 UI 框架 |
| 移动端适配 | 以 375px~430px 宽度为设计基准，App Shell 在该范围布局正常 |

---

## 4. 验收标准

| 编号 | 标准 |
|------|------|
| AC-001 | `npm run dev` 可启动，无启动报错 |
| AC-002 | 访问 `/`、`/sessions`、`/templates`、`/settings` 均可渲染，页面非空白 |
| AC-003 | 访问 `/discussion/test-session` 可渲染讨论页骨架 |
| AC-004 | 底部导航 5 个 Tab 均可点击跳转到对应页面 |
| AC-005 | 移动端宽度（375px）下底部导航和页面内容无明显错位 |
| AC-006 | `GET /api/health` 返回 `{ success: true, data: { version, status: 'ok', timestamp }, requestId }` |
| AC-007 | `GET /api/templates`、`/api/sessions`、`/api/discussions`、`/api/llm/providers` 均返回成功响应（空数据） |
| AC-008 | `npx tsc --noEmit` 通过，无类型错误 |
| AC-009 | ESLint 通过（`npx eslint src/` 无 error） |
| AC-010 | `src/types/index.ts` 导出全部核心类型（Template、Role、Agent、Message、Session、DiscussionState、LLMConfig） |
| AC-011 | `src/engine/` 下 7 个文件存在且可 import，无编译错误 |
| AC-012 | Mock 三国军师团模板数据可通过 `src/data/` import，符合 Template 类型 |
| AC-013 | API 路由调用 service 层，service 不直接写 SQL/IndexedDB 操作（通过 repository 接口） |

---

## 5. Out of Scope

| 不包含 | 说明 |
|--------|------|
| 真实 LLM 调用 | 迭代 2 接入 |
| 讨论生成逻辑 | 迭代 2/3 完成 |
| 状态机完整逻辑 | 迭代 4 完成 |
| 用户介入 / 意图识别 | 迭代 5 完成 |
| 爽点事件完整实现 | 迭代 7 完成 |
| 模板管理完整 UI | 迭代 8 完成 |
| Provider 配置完整 UI | 迭代 9 完成 |
| IndexedDB 真实存储 | 迭代 4+ 完成 |
| 多设备同步 | Phase 3 |
| 用户登录 / 认证 | 超出 MVP 范围 |

---

## 6. 依赖说明

| 依赖 | 说明 |
|------|------|
| Node.js ≥ 20 | 已满足（当前 v20.20.2） |
| Next.js 14 | 需在初始化时安装 |
| Tailwind CSS | 需随 Next.js 项目初始化接入 |
| Vitest | 测试框架，需安装配置 |
| TypeScript | Next.js 自带，需配置 strict 模式 |
