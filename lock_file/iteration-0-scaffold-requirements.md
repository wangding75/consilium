# 迭代 0：项目脚手架与基础代码框架

## 1. 迭代目标

建立项目的基础工程框架、代码目录规范、核心类型边界和基础运行环境，为后续多 Agent 讨论、状态机、导演逻辑、聊天 UI、模板扩展等迭代提供稳定的代码基础。

本迭代不追求完整业务闭环，不开发配置 UI，不实现复杂讨论能力，只要求项目能够启动、构建、类型检查通过，并具备后续模块开发的清晰落位。

---

## 2. 迭代范围

### 2.1 本迭代包含

| 范围 | 说明 |
|---|---|
| 项目初始化 | 初始化 Next.js 14 App Router 项目 |
| TypeScript 配置 | 启用 TypeScript 严格模式，配置路径别名 |
| 样式基础 | 接入 Tailwind CSS，建立全局 CSS 与主题变量基础 |
| 目录结构 | 建立 app、components、engine、llm、store、db、types、data 等核心目录 |
| 基础页面 | 提供 `/` 和 `/chat` 两个最小可访问页面 |
| 基础类型 | 定义 Template、Role、Message、LLMConfig、EngineState 等核心类型 |
| LLM 调用边界 | 建立统一 LLM client 接口占位，后续可接入不同模型 Provider |
| 引擎边界 | 建立 engine 模块类型入口，不在 UI 中直接写调度逻辑 |
| 状态管理边界 | 建立 Zustand store 目录与基础 store 占位 |
| 存储边界 | 建立 IndexedDB 封装入口，占位 sessions、templates、settings 存储模块 |
| 工程规范 | 配置 ESLint、基础脚本、import alias、构建命令 |

### 2.2 本迭代不包含

| 不包含内容 | 原因 |
|---|---|
| 模板选择 UI | 后续迭代暂时通过内置模板或代码配置完成 |
| LLM 配置 UI | 后续先通过环境变量或代码配置模型 |
| 角色配置 UI | 后续先使用模板内置角色 |
| 多 Agent 调度逻辑 | 属于迭代 2 |
| 讨论状态机 | 属于迭代 3 |
| 用户意图识别 | 属于迭代 4 |
| 导演逻辑 | 属于迭代 5 |
| 爽点机制 | 属于迭代 6 |
| 完整聊天 UI | 属于迭代 7 |
| 模板动态下发 | 属于后续产品化迭代 |
| Sentry、埋点、性能优化 | 非功能模块，暂不纳入当前阶段 |

---

## 3. 产品需求

### PRD-0.1：项目可访问

**需求说明**  
作为开发者，我需要项目在本地可以正常启动，并能访问最基础页面，以确认工程框架可用。

**功能要求**

| 编号 | 需求 |
|---|---|
| PRD-0.1.1 | 访问 `/` 时显示项目名称、简短描述和进入讨论入口 |
| PRD-0.1.2 | 访问 `/chat` 时显示讨论页面占位内容 |
| PRD-0.1.3 | 页面不需要真实业务数据，但不能报错或白屏 |

---

### PRD-0.2：基础产品结构可识别

**需求说明**  
作为产品和开发人员，我需要从项目结构中清楚看到后续模块如何演进，避免后续代码堆积在页面层。

**功能要求**

| 编号 | 需求 |
|---|---|
| PRD-0.2.1 | 项目中明确存在讨论引擎模块 `engine` |
| PRD-0.2.2 | 项目中明确存在 LLM 调用模块 `llm` |
| PRD-0.2.3 | 项目中明确存在状态管理模块 `store` |
| PRD-0.2.4 | 项目中明确存在本地存储模块 `db` |
| PRD-0.2.5 | 项目中明确存在业务类型模块 `types` |
| PRD-0.2.6 | 项目中明确存在模板数据模块 `data` |

---

### PRD-0.3：后续业务迭代有稳定落位

**需求说明**  
作为后续迭代开发者，我需要知道多 Agent、模板、角色、消息、会话、LLM 配置分别应该放在哪里。

**功能要求**

| 编号 | 需求 |
|---|---|
| PRD-0.3.1 | 模板数据后续统一放在 `src/data/templates` |
| PRD-0.3.2 | 角色类型后续统一定义在 `src/types/role.ts` |
| PRD-0.3.3 | 消息类型后续统一定义在 `src/types/message.ts` |
| PRD-0.3.4 | 讨论引擎状态后续统一定义在 `src/types/engine.ts` 或 `src/engine/types.ts` |
| PRD-0.3.5 | LLM 配置类型后续统一定义在 `src/types/llm.ts` |
| PRD-0.3.6 | UI 层后续只负责展示和交互，不直接实现角色调度、状态机、导演逻辑 |

---

## 4. 技术需求

### TECH-0.1：基础技术栈

| 项目 | 要求 |
|---|---|
| 前端框架 | Next.js 14 App Router |
| 语言 | TypeScript 5.x |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand |
| 本地存储 | IndexedDB，使用 `idb` 封装 |
| LLM SDK | Vercel AI SDK 作为后续接入方向 |
| 包管理 | npm，除非项目后续明确改为 pnpm |

---

### TECH-0.2：推荐目录结构

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── chat/
│       └── page.tsx
│
├── components/
│   └── ui/
│       └── Button.tsx
│
├── data/
│   └── templates/
│       └── default.ts
│
├── db/
│   ├── index.ts
│   ├── sessions.ts
│   ├── templates.ts
│   └── settings.ts
│
├── engine/
│   ├── index.ts
│   └── types.ts
│
├── llm/
│   └── client.ts
│
├── store/
│   ├── chat.ts
│   ├── template.ts
│   ├── role.ts
│   ├── llm.ts
│   └── theme.ts
│
├── styles/
│   └── globals.css
│
└── types/
    ├── template.ts
    ├── role.ts
    ├── message.ts
    ├── llm.ts
    └── engine.ts
```

---

### TECH-0.3：工程配置

| 编号 | 技术需求 |
|---|---|
| TECH-0.3.1 | 配置 `tsconfig.json`，启用 `strict: true` |
| TECH-0.3.2 | 配置路径别名 `@/* -> ./src/*` |
| TECH-0.3.3 | 配置 ESLint，未使用变量应报错或警告 |
| TECH-0.3.4 | 配置 Tailwind 扫描 `src/**/*.{js,ts,jsx,tsx,mdx}` |
| TECH-0.3.5 | 配置 `next.config.js`，开启 React strict mode |
| TECH-0.3.6 | 配置 `npm run dev`、`npm run build`、`npm run lint` 脚本 |

---

### TECH-0.4：基础类型定义

#### Template

```ts
export interface Template {
  id: string
  name: string
  version: string
  description: string
  theme: string
  roles: Role[]
  rhythm?: {
    maxTurnsPerRole: number
    maxCharsPerTurn: number
    speakerDelay: number
  }
}
```

#### Role

```ts
export interface Role {
  id: string
  name: string
  type: string
  isHost: boolean
  personality: string
  systemPrompt: string
  model?: string
  temperature?: number
}
```

#### Message

```ts
export type MessageRole = 'host' | 'character' | 'user' | 'system'

export interface Message {
  id: string
  role: MessageRole
  characterId?: string
  content: string
  timestamp: number
  isStreaming?: boolean
}
```

#### LLMConfig

```ts
export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'custom'

export interface LLMConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  baseUrl?: string
  temperature: number
  maxTokens: number
  stream: boolean
}
```

#### EngineState

```ts
export type Phase = 'idle' | 'opening' | 'developing' | 'climax' | 'closing'

export interface EngineState {
  sessionId: string | null
  templateId: string | null
  topic: string
  phase: Phase
  currentTurn: number
  lastSpeakerId: string | null
  messageHistory: Message[]
}
```

---

### TECH-0.5：LLM 调用边界

本迭代只建立统一接口，不要求真实完成所有模型调用。

```ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMClient {
  chat(messages: ChatMessage[]): Promise<string>
  streamChat?(messages: ChatMessage[]): AsyncGenerator<string>
}
```

技术要求：

| 编号 | 技术需求 |
|---|---|
| TECH-0.5.1 | UI 层不能直接调用具体模型 SDK |
| TECH-0.5.2 | 后续 OpenAI、Gemini、自定义 Provider 都通过 `llm/client.ts` 统一接入 |
| TECH-0.5.3 | 预留 `baseUrl`、`apiKey`、`model`、`temperature`、`stream` 参数 |
| TECH-0.5.4 | 当前阶段可以先提供 mock client 或占位实现 |

---

### TECH-0.6：Engine 模块边界

本迭代只定义引擎类型和入口，不实现完整调度逻辑。

技术要求：

| 编号 | 技术需求 |
|---|---|
| TECH-0.6.1 | `engine/index.ts` 作为引擎统一导出入口 |
| TECH-0.6.2 | `engine/types.ts` 定义 Phase、Intent、EngineState 基础类型 |
| TECH-0.6.3 | UI 层不直接操作 phase 转换规则 |
| TECH-0.6.4 | 后续状态机、调度器、导演逻辑、爽点机制都放在 `engine` 下 |

---

### TECH-0.7：Store 模块边界

| Store | 责任 |
|---|---|
| `chat.ts` | 当前会话、消息列表、当前阶段、当前发言人 |
| `template.ts` | 当前模板、模板列表 |
| `role.ts` | 当前角色列表、主持人角色 |
| `llm.ts` | 当前模型配置 |
| `theme.ts` | 当前主题配置 |

本迭代可以只实现基础字段和 setter，不要求完成完整业务状态流转。

---

### TECH-0.8：DB 模块边界

| 文件 | 责任 |
|---|---|
| `db/index.ts` | 初始化 IndexedDB |
| `db/sessions.ts` | 会话存储接口占位 |
| `db/templates.ts` | 模板缓存接口占位 |
| `db/settings.ts` | 设置存储接口占位 |

技术要求：

| 编号 | 技术需求 |
|---|---|
| TECH-0.8.1 | IndexedDB 数据库名称建议使用 `zhinangtuan` 或正式产品英文名 |
| TECH-0.8.2 | 至少预留 `sessions`、`templates`、`settings` 三个 object store |
| TECH-0.8.3 | 存储接口必须和业务代码解耦，页面不能直接操作 IndexedDB API |

---

## 5. 页面要求

### 5.1 首页 `/`

页面内容：

| 元素 | 要求 |
|---|---|
| 产品名称 | 显示当前产品名称，暂用“智囊团” |
| 产品描述 | 显示一句简短说明，例如“AI 多角色讨论与决策辅助工具” |
| 入口按钮 | 点击后进入 `/chat` |

---

### 5.2 讨论页 `/chat`

页面内容：

| 元素 | 要求 |
|---|---|
| 页面标题 | 显示“讨论室”或类似标题 |
| 状态提示 | 显示“迭代 0：讨论页面占位” |
| 基础布局 | 预留后续消息流和输入区位置 |

---

## 6. 验收标准

### 6.1 工程验收

| 编号 | 验收项 | 验收标准 |
|---|---|---|
| AC-0.1 | 项目启动 | 执行 `npm run dev` 后项目正常启动 |
| AC-0.2 | 首页访问 | 浏览器访问 `/` 正常显示首页内容 |
| AC-0.3 | 讨论页访问 | 浏览器访问 `/chat` 正常显示讨论页占位内容 |
| AC-0.4 | 项目构建 | 执行 `npm run build` 成功，无阻断错误 |
| AC-0.5 | 类型检查 | TypeScript 无阻断错误 |
| AC-0.6 | Lint 检查 | 执行 `npm run lint` 无阻断错误 |
| AC-0.7 | 路径别名 | 项目内可以正常使用 `@/xxx` 引入模块 |
| AC-0.8 | Tailwind 生效 | 页面中 Tailwind class 正常生效 |

---

### 6.2 架构验收

| 编号 | 验收项 | 验收标准 |
|---|---|---|
| AC-0.9 | 目录结构 | `app`、`components`、`engine`、`llm`、`store`、`db`、`types`、`data` 目录存在 |
| AC-0.10 | 类型边界 | Template、Role、Message、LLMConfig、EngineState 类型已定义 |
| AC-0.11 | LLM 边界 | 存在 `src/llm/client.ts`，上层不直接依赖具体模型 SDK |
| AC-0.12 | Engine 边界 | 存在 `src/engine/index.ts` 和 `src/engine/types.ts` |
| AC-0.13 | Store 边界 | chat、template、role、llm、theme store 文件存在 |
| AC-0.14 | DB 边界 | index、sessions、templates、settings 存储模块存在 |
| AC-0.15 | 页面职责 | 页面层不包含多 Agent 调度、状态机、导演逻辑等复杂业务规则 |

---

### 6.3 产品验收

| 编号 | 验收项 | 验收标准 |
|---|---|---|
| AC-0.16 | 产品入口清晰 | 用户能从首页进入讨论页 |
| AC-0.17 | 当前阶段明确 | 页面能看出当前仍是脚手架阶段，不误导为完整产品 |
| AC-0.18 | 后续扩展清晰 | 从代码结构可以判断后续模板、角色、LLM、讨论引擎应放在哪里 |

---

## 7. 交付物

| 交付物 | 说明 |
|---|---|
| 可运行项目 | Next.js 项目可以本地启动 |
| 基础目录结构 | 核心模块目录已建立 |
| 基础类型文件 | Template、Role、Message、LLMConfig、EngineState 等类型已定义 |
| 首页 | `/` 可访问 |
| 讨论页占位 | `/chat` 可访问 |
| LLM client 占位 | 后续统一接入模型 |
| Engine 类型入口 | 后续统一实现多 Agent 讨论引擎 |
| Store 占位 | 后续统一管理状态 |
| DB 占位 | 后续统一管理 IndexedDB 存储 |

---

## 8. 迭代完成定义

满足以下条件时，迭代 0 可视为完成：

1. 项目可以启动、构建、Lint 通过。
2. `/` 和 `/chat` 页面可以正常访问。
3. 核心目录结构已经建立。
4. 核心业务类型已经定义。
5. LLM、Engine、Store、DB 四个关键模块边界已经建立。
6. 后续迭代可以在当前框架上直接开发，不需要重新调整基础目录。

---

## 9. 后续衔接

迭代 0 完成后，进入迭代 1：最小讨论入口。

迭代 1 将在当前框架基础上完成：

| 后续内容 | 依赖迭代 0 的内容 |
|---|---|
| 内置默认模板 | `src/data/templates/default.ts` |
| 用户输入议题 | `/chat` 页面基础布局 |
| 第一轮 AI 回复 | `src/llm/client.ts` |
| 基础消息展示 | `Message` 类型与 `chat store` |
| 讨论会话初始化 | `EngineState` 类型 |
