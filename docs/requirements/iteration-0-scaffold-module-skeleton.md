# 迭代 0：项目脚手架与模块骨架代码

## 迭代目标

建立一个可以长期演进的项目基础。迭代 0 不只是让项目能启动，还要把后续所有核心模块的代码骨架提前定好。

完成后，后续迭代应在既有目录、类型、接口、Mock 数据和模块边界内继续完善。

## 原型映射

| 原型页面 | 骨架要求 |
|---|---|
| 首页 | `/` 或 `/home` 页面骨架，包含发起讨论模块占位 |
| 讨论 | `/discussion/[sessionId]` 页面骨架，包含消息流、角色栏、输入区占位 |
| 会话 | `/sessions` 页面骨架，包含列表、搜索、筛选占位 |
| 模板 | `/templates` 页面骨架，包含模板详情、角色列表、事件规则占位 |
| 设置 | `/settings` 页面骨架，包含 Provider、模型、Prompt、安全设置占位 |

## 前端需求

| 编号 | 需求 |
|---|---|
| FE-001 | 初始化 Next.js 14 App Router 项目 |
| FE-002 | 使用 TypeScript 严格模式 |
| FE-003 | 接入 Tailwind CSS，建立全局样式变量 |
| FE-004 | 建立移动端 App Shell：状态栏、内容区、底部导航 |
| FE-005 | 建立 5 个主页面骨架：首页、讨论、会话、模板、设置 |
| FE-006 | 建立基础 UI 组件骨架：Button、Input、Textarea、Card、Tag、Sheet、Modal、Toast、BottomNav |
| FE-007 | 建立页面模块目录：`modules/home`、`modules/discussion`、`modules/sessions`、`modules/templates`、`modules/settings` |
| FE-008 | 页面可访问，不要求真实业务数据，但不能出现空白页 |
| FE-009 | 所有页面使用统一移动端布局 |
| FE-010 | 预留 Mock 数据入口，保证迭代 1 起可以快速接入真实数据流 |

## 后端/API/服务需求

| 编号 | 需求 |
|---|---|
| BE-001 | 建立 API 路由骨架：`/api/health`、`/api/templates`、`/api/sessions`、`/api/discussions`、`/api/llm/providers` |
| BE-002 | 建立统一 API 响应结构：`{ success, data, error, requestId }` |
| BE-003 | 建立统一错误结构：`{ code, message, details }` |
| BE-004 | 建立服务层目录：`src/server/services` |
| BE-005 | 建立仓储层接口目录：`src/server/repositories` |
| BE-006 | 建立 Mock Repository，后续可替换真实数据库 |
| BE-007 | 建立 LLM Provider Adapter 骨架，本迭代不要求真实调用模型 |
| BE-008 | 建立配置读取模块，支持环境变量和本地默认配置 |
| BE-009 | `/api/health` 返回项目版本、运行状态和时间戳 |
| BE-010 | API 路由可以通过最小测试验证返回结构一致 |

## 引擎/领域模型骨架需求

| 编号 | 需求 |
|---|---|
| ENG-001 | 建立 `src/engine` 目录 |
| ENG-002 | 预留 `orchestrator.ts`、`scheduler.ts`、`state-machine.ts`、`director.ts`、`intent.ts`、`events.ts`、`rhythm.ts` |
| ENG-003 | 建立核心类型：Template、Role、Agent、Message、Session、DiscussionState、LLMConfig |
| ENG-004 | 建立 Agent 抽象接口：`AgentProfile`、`AgentRuntime`、`AgentOutput` |
| ENG-005 | 建立 Orchestrator 空实现，后续迭代 2 完善 |
| ENG-006 | 建立 DiscussionState 初始结构，后续迭代 4 完善 |
| ENG-007 | 建立 Event 类型定义，后续迭代 7 完善 |
| ENG-008 | 建立 Mock 三国军师团模板数据 |
| ENG-009 | 建立测试工具：mock template、mock roles、mock messages、mock session |
| ENG-010 | UI 层不得直接实现调度逻辑，只能调用 engine/service 层 |

## 建议目录结构

```text
src/
├── app/
│   ├── page.tsx
│   ├── discussion/[sessionId]/page.tsx
│   ├── sessions/page.tsx
│   ├── templates/page.tsx
│   ├── settings/page.tsx
│   └── api/
│       ├── health/route.ts
│       ├── templates/route.ts
│       ├── sessions/route.ts
│       ├── discussions/route.ts
│       └── llm/providers/route.ts
├── components/
│   ├── layout/
│   ├── ui/
│   └── mobile/
├── modules/
│   ├── home/
│   ├── discussion/
│   ├── sessions/
│   ├── templates/
│   └── settings/
├── engine/
├── server/
├── llm/
├── store/
├── db/
├── data/
├── types/
└── tests/
```

## 验收标准

### 前端验收

| 编号 | 标准 |
|---|---|
| AC-FE-001 | `npm run dev` 可启动 |
| AC-FE-002 | 首页、讨论、会话、模板、设置 5 个页面均可访问 |
| AC-FE-003 | 底部导航可在 5 个页面之间切换 |
| AC-FE-004 | 页面使用统一 App Shell |
| AC-FE-005 | 页面不出现空白、运行时报错或明显样式错位 |
| AC-FE-006 | 基础 UI 组件可被页面引用 |
| AC-FE-007 | 移动端宽度下布局可用 |

### 后端/API验收

| 编号 | 标准 |
|---|---|
| AC-BE-001 | `/api/health` 可返回成功响应 |
| AC-BE-002 | API 响应结构统一 |
| AC-BE-003 | API 错误结构统一 |
| AC-BE-004 | Mock Repository 可返回模板、会话、讨论空数据 |
| AC-BE-005 | API 路由不直接写复杂业务逻辑，必须调用 service 层 |

### 架构验收

| 编号 | 标准 |
|---|---|
| AC-ARCH-001 | `engine`、`server`、`modules`、`components`、`types` 边界清晰 |
| AC-ARCH-002 | 核心领域类型已定义并可复用 |
| AC-ARCH-003 | 模块骨架代码存在，不只是空目录 |
| AC-ARCH-004 | 后续迭代能够在既有模块内继续开发 |
| AC-ARCH-005 | TypeScript 类型检查通过 |
| AC-ARCH-006 | ESLint 通过，无阻断错误 |

## 不包含范围

| 不包含 | 说明 |
|---|---|
| 真实 LLM 调用 | 迭代 2 开始接入 |
| 真实讨论生成 | 迭代 2/3 完成 |
| 状态机完整逻辑 | 迭代 4 完成 |
| 模板管理完整 UI | 迭代 8 完成 |
| Provider 配置完整 UI | 迭代 9 完成 |

## 需求评审关注点

1. 模块骨架是否足够支撑后续迭代。
2. 页面骨架是否覆盖移动端原型 5 个 Tab。
3. API 和 Service 是否分层，避免页面直接写业务逻辑。
4. Engine 是否作为独立模块存在，避免讨论逻辑散落在组件中。
5. Mock 数据是否能支撑迭代 1 开始做页面联动。
