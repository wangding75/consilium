# 智囊团产品蓝图

> 项目代号：智囊团  
> 文档类型：产品立项与正式开发总蓝图  
> 适用阶段：MVP 立项、需求评审、迭代开发、技术方案评审、验收对齐  
> 目标：保证后续迭代开发不背离最初产品设计，作为所有迭代 PRD、技术方案和验收标准的母版依据。

---

## 1. 产品总览

### 1.1 产品一句话定位

智囊团是一个 **AI 多角色决策讨论室**：用户输入一个议题，系统基于预设场景与多个 AI 角色，组织观点碰撞、反驳、站队、投票、反转和总结，帮助用户获得更全面、更有参与感的决策参考。

### 1.2 产品本质

它不是普通聊天机器人，也不是简单角色扮演应用，而是：

```text
多 Agent 讨论编排 + 角色化观点输出 + 导演式节奏控制 + 决策辅助总结
```

核心价值不在“多个 AI 同时说话”，而在于：

1. 让不同角色承担不同思考立场。
2. 让观点之间产生可控冲突，而不是平均化回答。
3. 让用户可以随时插话、指挥、定夺。
4. 让主持人最终收束为可理解、可执行的结论。

### 1.3 产品目标

| 层级 | 目标 |
|---|---|
| 用户目标 | 帮助用户围绕一个议题获得多视角分析、风险提醒、方案对比和最终建议 |
| 产品目标 | 建立区别于普通 Chatbot 的“多角色讨论体验” |
| 技术目标 | 建立可扩展的客户端优先多 Agent 讨论引擎 |
| MVP 目标 | 用一个固定模板跑通完整讨论闭环，验证多角色讨论体验是否成立 |
| 长期目标 | 形成可运营模板生态，支持多模型、多模板、多场景和更强的语义事件检测 |

---

## 2. 产品边界

### 2.1 当前阶段必须坚持的主线

```text
固定模板讨论
→ 多 Agent 发言
→ 状态机推进
→ 用户介入
→ 导演控制
→ 爽点事件
→ 讨论主界面
→ 多模板和会话闭环
```

### 2.2 MVP 必须包含

| 模块 | 是否必须 | 说明 |
|---|---:|---|
| 固定模板 | 是 | 至少内置一个完整模板，例如“三国军师团” |
| 多角色发言 | 是 | 至少包含主持人 + 3 个以上角色 |
| 用户议题输入 | 是 | 用户能发起讨论 |
| 讨论状态机 | 是 | opening / developing / climax / closing |
| 意图识别 | 是 | interrupt / command / passive |
| 角色调度 | 是 | 不能只靠固定轮流发言 |
| 导演逻辑 | 是 | 判断继续、邀请、收束、事件触发 |
| 爽点事件 | 是 | 打脸、站队、投票、反转至少规则化实现 |
| 讨论 UI | 是 | 能展示消息、角色、事件、邀请和输入 |
| 本地会话 | 是 | 支持保存和恢复讨论上下文 |

### 2.3 MVP 暂不作为主路径

| 暂不优先 | 原因 |
|---|---|
| 模板选择 UI | 初期先使用内置模板，避免拖慢核心体验验证 |
| LLM 配置 UI | 初期可使用环境变量或代码配置 |
| 角色配置 UI | 初期角色由模板内置，先验证讨论质量 |
| 移动端完整适配 | 先保证桌面端讨论体验 |
| Sentry / 埋点 / 性能优化 | 属于产品化阶段，不影响核心闭环验证 |
| 服务端模板动态下发 | Phase 2 再做，Phase 1 先本地内置 |
| API Key 加密 | Phase 1 暂不考虑，后续迭代处理 |
| 多设备同步 | Phase 3 按需补充 |

### 2.4 产品设计红线

后续迭代不得偏离以下原则：

| 红线 | 说明 |
|---|---|
| 不能退化为单 Agent Chatbot | 多角色观点碰撞是产品核心 |
| 不能只做角色扮演 | 每个角色必须服务于讨论和决策 |
| 不能完全依赖 Prompt 自由发挥 | 必须保留 director / scheduler / state machine |
| 不能让所有角色机械轮流发言 | 需要根据意图、阶段和上下文调度 |
| 不能只有热闹没有结论 | 主持人必须能收束为清晰总结 |
| 不能前期被配置页拖慢 | 配置 UI 不是 MVP 的核心壁垒 |
| 不能过早引入复杂 Agent 框架 | 先自研轻量编排，保证体验可控 |

---

## 3. 目标用户与使用场景

### 3.1 目标用户

| 用户类型 | 典型需求 | 产品价值 |
|---|---|---|
| 创业者 / 产品经理 | 对方案、定位、商业决策进行多角度讨论 | 快速获得机会、风险、反对意见和决策建议 |
| 软件工程师 / 技术负责人 | 技术选型、架构方案、开发计划评审 | 模拟架构师、安全、成本、维护性等多视角讨论 |
| 内容创作者 | 故事设定、角色冲突、剧情推进 | 借助多角色碰撞激发创意 |
| 学习者 | 对一个问题进行辩论式理解 | 通过不同立场加深理解 |
| 普通决策用户 | 生活、职业、规划类问题 | 获得比单一回答更完整的建议 |

### 3.2 核心场景

| 场景 | 示例议题 | 关键体验 |
|---|---|---|
| 决策讨论 | “这个产品 MVP 应该先做哪些功能？” | 多角色给出不同优先级判断，主持人总结 |
| 方案评审 | “这个技术架构是否合理？” | 专家指出风险，反对者打脸，主持人收束 |
| 商业推演 | “创业公司是否应该做 ToB？” | 角色站队、反驳、投票 |
| 创意发散 | “设计一个三国背景的 AI 产品场景” | 角色带入世界观，制造冲突和反转 |
| 学习辩论 | “React Server Components 是否值得学习？” | 多视角解释优缺点和适用边界 |

---

## 4. 产品架构

### 4.1 产品分层

```text
用户入口层
  ├─ 启动页
  ├─ 讨论页
  └─ 后续配置页

场景模板层
  ├─ 模板
  ├─ 世界观
  ├─ 角色
  ├─ 事件规则
  └─ 推荐模型

讨论体验层
  ├─ 消息流
  ├─ 角色栏
  ├─ 用户输入
  ├─ 邀请卡
  ├─ 事件卡
  └─ 主持人总结

讨论引擎层
  ├─ 状态机
  ├─ 意图识别
  ├─ 角色调度
  ├─ 导演逻辑
  ├─ 节奏控制
  └─ 爽点机制

模型调用层
  ├─ Provider 抽象
  ├─ Prompt 组装
  ├─ 流式输出
  ├─ 自定义 BaseURL
  └─ 模型适配

本地数据层
  ├─ 会话存储
  ├─ 模板缓存
  ├─ 设置存储
  └─ IndexedDB
```

### 4.2 核心对象关系

```text
Template
  ├─ Worldview
  ├─ Roles[]
  ├─ Events[]
  ├─ RhythmConfig
  └─ FreeModels[]

Role
  ├─ Host Role
  └─ Character Roles[]

Session
  ├─ Template
  ├─ Topic
  ├─ EngineState
  ├─ Messages[]
  └─ RuntimeConfig

Engine
  ├─ IntentRecognizer
  ├─ Scheduler
  ├─ Director
  ├─ RhythmController
  └─ SparkleEventDetector
```

### 4.3 主流程

```text
用户进入产品
  ↓
加载默认模板
  ↓
用户输入讨论议题
  ↓
主持人开场
  ↓
角色根据人设和上下文发言
  ↓
引擎判断阶段、分歧、事件和用户介入时机
  ↓
用户插话 / 指挥 / 定夺
  ↓
角色继续回应或触发事件
  ↓
主持人收束总结
  ↓
会话保存，可继续或新建讨论
```

---

## 5. 产品功能总览

### 5.1 功能地图

| 一级模块 | 二级功能 | MVP | Phase 2 | 说明 |
|---|---|---:|---:|---|
| 讨论入口 | 输入议题 | 是 | 是 | 用户发起讨论的主入口 |
| 讨论入口 | 默认模板加载 | 是 | 是 | MVP 用内置模板 |
| 多角色讨论 | 主持人开场 | 是 | 是 | 建立场景和讨论规则 |
| 多角色讨论 | 角色发言 | 是 | 是 | 角色按人设表达观点 |
| 多角色讨论 | 角色反驳 | 是 | 是 | 形成观点冲突 |
| 用户介入 | 插话 | 是 | 是 | 用户表达自己的观点 |
| 用户介入 | 指挥 | 是 | 是 | 用户要求某角色发言、反驳、总结 |
| 用户介入 | 定夺 | 是 | 是 | 用户做最终选择或要求收束 |
| 导演控制 | 继续讨论 | 是 | 是 | 正常推进下一轮 |
| 导演控制 | 邀请用户 | 是 | 是 | 在关键分歧点让用户参与 |
| 导演控制 | 收束总结 | 是 | 是 | 输出最终结论 |
| 爽点事件 | 打脸 | 是 | 是 | 角色用证据推翻另一角色判断 |
| 爽点事件 | 站队 | 是 | 是 | 分歧形成阵营 |
| 爽点事件 | 投票 | 是 | 是 | 争议无法收敛时投票 |
| 爽点事件 | 反转 | 是 | 是 | 引入意外变量改变讨论方向 |
| 讨论界面 | 消息流 | 是 | 是 | 展示所有发言 |
| 讨论界面 | 事件卡 | 是 | 是 | 强化戏剧性和可读性 |
| 讨论界面 | 邀请卡 | 是 | 是 | 引导用户参与 |
| 讨论界面 | 角色栏 | 是 | 是 | 展示当前角色和发言状态 |
| 会话闭环 | 保存会话 | 是 | 是 | IndexedDB 本地保存 |
| 会话闭环 | 恢复会话 | 是 | 是 | 可继续上次讨论 |
| 模板管理 | 多内置模板 | 后置 | 是 | 创业董事会、白雪公主智囊等 |
| 模板管理 | 服务端动态下发 | 否 | 是 | Vercel Functions + ETag |
| 模型能力 | 多 Provider | 是 | 是 | OpenAI / Anthropic / Gemini / DeepSeek / Custom |
| 模型能力 | 多模型 Prompt 适配 | 后置 | 是 | 针对不同模型优化 Prompt |

### 5.2 核心功能说明

#### 5.2.1 讨论入口

用户输入一个议题，系统基于默认模板创建 Session。MVP 不要求用户先选择模板、配置角色或配置模型，避免前置流程过重。

**产品要求：**

- 用户能在首页或讨论页输入议题。
- 输入后进入讨论主界面。
- 系统展示主持人开场。
- 系统自动进入第一轮角色发言。

**技术要求：**

- 创建 Session 数据结构。
- 绑定默认 Template。
- 初始化 EngineState。
- 将 Topic 注入 Host Prompt 和角色 Prompt。

#### 5.2.2 多 Agent 讨论

多 Agent 不是简单多个角色轮流对话，而是由系统统一编排。每个角色有独立立场、表达风格、知识偏好和任务职责。

**产品要求：**

- 至少支持 1 个主持人和 3 个角色。
- 每个角色发言应体现不同立场。
- 角色之间可以互相引用、反驳、补充。
- 主持人负责开场、控场和总结。

**技术要求：**

- 定义 Agent / Role 抽象。
- 定义 Role Prompt 生成机制。
- 实现上下文拼接。
- 实现发言队列。
- 实现角色发言调用 LLM。
- 预留并行 Agent 能力，但 MVP 默认串行执行。

#### 5.2.3 用户介入

用户不是旁观者，而是讨论的“主公 / 决策者”。系统需要识别用户输入是插话、指挥还是定夺。

**产品要求：**

- 用户可以随时发表观点。
- 用户可以点名某个角色回应。
- 用户可以要求反驳、投票、总结、结束。
- 用户可以跳过主持人邀请。

**技术要求：**

- 使用 LLM 分类识别用户意图。
- 意图类型包括 interrupt / command / passive。
- command 需要识别目标角色或动作。
- fallback 为 passive，保证失败时仍可继续讨论。

#### 5.2.4 导演逻辑

导演逻辑负责讨论的节奏控制，是产品区别于普通多人聊天的核心。

**产品要求：**

- 系统能判断何时继续讨论。
- 系统能判断何时邀请用户参与。
- 系统能判断何时触发事件。
- 系统能判断何时收束总结。

**技术要求：**

- 实现 DirectorDecision。
- action 包括 continue / invite_user / trigger_event / conclude。
- 基于 phase、turn、messageHistory、分歧关键词、用户结束信号判断。
- Director 不直接生成最终文本，只输出调度决策。

#### 5.2.5 爽点机制

爽点机制用于增强讨论的可看性和戏剧性，但必须服务于讨论，不应变成随机噱头。

| 事件 | 产品含义 | Phase 1 技术实现 | Phase 2 技术升级 |
|---|---|---|---|
| 打脸 | 角色 B 推翻角色 A 的明确断言 | 关键词 + 断言模式检测 | Embedding 或 LLM 裁判 |
| 站队 | 多角色围绕一个方向形成阵营 | 支持/反对关键词计数 | 语义立场聚类 |
| 投票 | 争论多轮无结论后做选择 | 轮次 + 无结论关键词 | 议题级争议检测 |
| 反转 | 引入意外变量改变讨论方向 | 反转关键词或模板事件 | 情境生成 + 影响评估 |

---

## 6. 业务模块

### 6.1 模块总览

| 模块 | 职责 | 是否核心 |
|---|---|---:|
| 模板模块 | 定义世界观、角色、事件、节奏和推荐模型 | 是 |
| 角色模块 | 定义主持人和参与角色的人设、立场、Prompt | 是 |
| 讨论引擎模块 | 控制状态、调度、意图、导演和事件 | 是 |
| 消息模块 | 管理用户、角色、主持人、系统事件消息 | 是 |
| 讨论 UI 模块 | 呈现多角色讨论过程 | 是 |
| LLM 调用模块 | 统一对接模型 Provider | 是 |
| 本地存储模块 | 保存会话、模板、设置 | 是 |
| 配置模块 | 模板、模型、角色配置 | 后置 |
| 模板运营模块 | 服务端模板下发、版本更新 | Phase 2 |
| 监控分析模块 | 埋点、错误监控、转化指标 | Phase 2 |

### 6.2 模板模块

模板是产品的内容资产，也是多角色讨论质量的基础。

**模板应包含：**

- 模板 ID、名称、分类、描述。
- 主题风格和视觉变量。
- 世界观设定。
- 用户身份设定。
- 主持人角色。
- 多个参与角色。
- 事件规则。
- 节奏配置。
- 推荐免费模型。

**MVP 模板：**

- 三国军师团。

**Phase 2 模板：**

- 创业公司董事会。
- 白雪公主智囊。

### 6.3 角色模块

角色不是装饰，而是 Agent 的产品化表达。

**角色字段建议：**

| 字段 | 说明 |
|---|---|
| id | 唯一标识 |
| name | 角色名称 |
| char | 角色简称或头像字符 |
| isHost | 是否主持人 |
| color | 角色颜色 |
| personality | 性格描述 |
| tags | 能力标签 |
| catchphrase | 口头禅 |
| attitude | 对用户或议题的默认态度 |
| systemPrompt | 角色系统提示词 |
| model | 可选专属模型 |
| temperature | 角色输出随机性 |
| preview | 角色预览文案 |

### 6.4 讨论引擎模块

讨论引擎是产品核心壁垒。

```text
DiscussionEngine
  ├─ StateMachine
  ├─ IntentRecognizer
  ├─ Scheduler
  ├─ Director
  ├─ RhythmController
  └─ SparkleEventDetector
```

它应当独立于 UI，UI 只消费引擎输出的事件和消息，不直接承担调度逻辑。

### 6.5 消息模块

消息类型应区分不同来源与渲染方式。

| 消息类型 | 来源 | 展示方式 |
|---|---|---|
| host | 主持人 | 左侧、主持人样式、可斜体 |
| character | 角色 | 左侧、角色颜色边框 |
| user | 用户 | 右侧 |
| system | 系统 | 居中、弱化 |
| event | 爽点事件 | 事件卡 |
| invite | 主持人邀请 | 邀请卡 |

### 6.6 LLM 调用模块

LLM 调用层必须统一封装，不允许业务组件直接调用 Provider API。

**支持 Provider：**

- OpenAI。
- Anthropic。
- Gemini。
- DeepSeek。
- Custom Provider。

**Custom Provider 必须支持：**

- BaseURL。
- API Key。
- ModelList。
- Headers。

---

## 7. 技术架构

### 7.1 技术栈

| 层级 | 技术选型 | 说明 |
|---|---|---|
| 前端框架 | Next.js 14 App Router | 页面路由与前端工程基础 |
| 语言 | TypeScript 5.x | 严格类型约束 |
| 样式 | Tailwind CSS + CSS Variables | 快速开发与主题切换 |
| 状态管理 | Zustand | 客户端状态管理 |
| 本地存储 | IndexedDB + idb | 会话、模板、设置持久化 |
| LLM SDK | Vercel AI SDK | 流式输出和多 Provider 调用基础 |
| 表单 | React Hook Form | 配置页后续使用 |
| 服务端 | Vercel Functions | Phase 2 模板接口与健康检查 |
| 监控 | Sentry | Phase 2 产品化 |
| 部署 | Vercel | 前端和函数部署 |

### 7.2 客户端优先架构

Phase 1 采用客户端优先架构：

```text
Browser
  ├─ Next.js UI
  ├─ Zustand Store
  ├─ Discussion Engine
  ├─ LLM Client
  └─ IndexedDB
```

**优点：**

- MVP 开发快。
- 服务端成本低。
- 数据先本地闭环。
- 模板可先内置。

**限制：**

- 多设备同步暂不支持。
- API Key 需要用户自行配置或本地保存。
- 模板运营能力弱。
- Prompt 和模板较容易被复制。

### 7.3 目标目录结构

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── chat/page.tsx
│   ├── templates/page.tsx
│   ├── llm/page.tsx
│   ├── roles/page.tsx
│   └── api/                    # Phase 2
│       ├── templates/route.ts
│       ├── templates/[id]/route.ts
│       ├── models/route.ts
│       └── health/route.ts
│
├── components/
│   ├── ui/
│   ├── chat/
│   ├── template/
│   ├── llm/
│   └── role/
│
├── engine/
│   ├── types.ts
│   ├── state.ts
│   ├── intent.ts
│   ├── scheduler.ts
│   ├── director.ts
│   ├── rhythm.ts
│   ├── events.ts
│   └── semantic.ts             # Phase 2
│
├── llm/
│   ├── client.ts
│   └── prompt-adapter.ts        # Phase 2
│
├── store/
│   ├── template.ts
│   ├── llm.ts
│   ├── role.ts
│   ├── chat.ts
│   └── theme.ts
│
├── db/
│   ├── index.ts
│   ├── sessions.ts
│   ├── templates.ts
│   └── settings.ts
│
├── data/
│   └── templates/
│       ├── sanguo.ts
│       ├── boardroom.ts         # Phase 2
│       └── snowwhite.ts         # Phase 2
│
├── types/
│   ├── template.ts
│   ├── role.ts
│   ├── message.ts
│   ├── llm.ts
│   └── engine.ts
│
├── styles/
│   ├── globals.css
│   └── themes/
│
└── lib/
    ├── analytics.ts             # Phase 2
    └── sentry.ts                # Phase 2
```

### 7.4 模块调用关系

```text
ChatContainer
  ↓ user input
chatStore
  ↓
DiscussionEngine.onUserMessage()
  ↓
IntentRecognizer.classify()
  ↓
Director.decide()
  ↓
Scheduler.selectNextSpeaker()
  ↓
LLMClient.generate()
  ↓
chatStore.appendMessage()
  ↓
Chat UI render
  ↓
IndexedDB persist
```

---

## 8. 讨论引擎设计

### 8.1 引擎职责

讨论引擎负责“讨论如何发生”，不负责“页面如何展示”。

**输入：**

- 用户消息。
- 当前 Session。
- 当前 EngineState。
- 当前 Template。
- 历史消息。

**输出：**

- 下一位发言角色。
- 是否邀请用户。
- 是否触发事件。
- 是否收束。
- 需要展示的消息或 UI 事件。

### 8.2 状态机

```text
idle
  ↓
opening
  ↓
developing
  ↓
climax
  ↓
closing
```

| Phase | 产品含义 | 进入条件 | 退出条件 |
|---|---|---|---|
| idle | 尚未开始 | 新建会话 | 用户输入议题 |
| opening | 开场 | 主持人介绍场景 | 第一轮角色开始表态 |
| developing | 展开讨论 | 角色开始多轮发言 | 轮次过半或出现明显冲突 |
| climax | 高潮争论 | 明显分歧、打脸、站队、反转 | 用户最终表态或达到最大轮次 |
| closing | 收束 | 用户要求结束或系统判断应总结 | 主持人输出总结 |

### 8.3 意图识别

| 意图 | 含义 | 示例 |
|---|---|---|
| passive | 普通输入，系统自然推进 | “我觉得可以继续讨论” |
| interrupt | 用户插话，表达观点或补充信息 | “我不同意这个判断” |
| command | 用户指挥系统或角色 | “让诸葛亮反驳一下” |

Phase 1 使用 LLM 分类，失败时 fallback 到 passive。

### 8.4 角色调度

调度器决定谁应该说话。

| 场景 | 调度策略 |
|---|---|
| 第一轮 | 主持人先发言 |
| 普通讨论 | 按队列或 round robin 发言 |
| 用户点名 | 优先目标角色 |
| 用户要求反驳 | 选择立场相反或相关角色 |
| 事件触发后 | 根据事件类型选择角色 |
| 即将收束 | 主持人优先 |

### 8.5 导演决策

Director 输出统一决策：

```ts
interface DirectorDecision {
  action: 'continue' | 'invite_user' | 'trigger_event' | 'conclude'
  reason: string
  eventType?: 'slap' | 'camp' | 'vote' | 'reverse'
  targetRoleId?: string
}
```

**判断依据：**

- 当前 phase。
- 当前 turn。
- 最大轮次。
- 最近消息内容。
- 是否出现分歧关键词。
- 是否出现用户结束信号。
- 是否连续多轮无反对。
- 是否已经触发过某类事件。

### 8.6 节奏控制

| 参数 | 默认值 | 说明 |
|---|---:|---|
| maxCharsPerTurn | 200 | 单次发言最大字数 |
| minCharsPerTurn | 30 | 单次发言最小字数 |
| speakerDelay | 800ms | 发言间隔 |
| maxTurnsPerRole | 4 | 单个角色最多发言轮次 |

climax 阶段可适当加快节奏，避免拖沓。

---

## 9. 数据模型

### 9.1 Template

```ts
interface Template {
  id: string
  name: string
  category: string
  description: string
  theme: string
  userIdentity: string
  worldview: string
  roles: Role[]
  events: EventRule[]
  rhythm: RhythmConfig
  freeModels: string[]
  version?: string
}
```

### 9.2 Role

```ts
interface Role {
  id: string
  name: string
  char: string
  isHost: boolean
  color: string
  personality: string
  tags: string[]
  catchphrase?: string
  attitude?: string
  systemPrompt: string
  model?: string
  temperature?: number
  preview?: string
}
```

### 9.3 Message

```ts
interface Message {
  id: string
  sessionId: string
  role: 'host' | 'character' | 'user' | 'system'
  characterId?: string
  content: string
  createdAt: number
  metadata?: {
    phase?: Phase
    eventType?: EventType
    intent?: IntentType
    isStreaming?: boolean
  }
}
```

### 9.4 EngineState

```ts
interface EngineState {
  sessionId: string
  templateId: string
  topic: string
  phase: Phase
  currentTurn: number
  maxTurns: number
  lastSpeakerId: string | null
  speakingQueue: string[]
  slapCount: number
  campFormed: boolean
  voteTriggered: boolean
  reverseTriggered: boolean
  inviteCount: number
  pendingInvite: boolean
  messageHistory: Message[]
}
```

### 9.5 LLMConfig

```ts
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'custom'
  model: string
  apiKey: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
  stream?: boolean
  headers?: Record<string, string>
  customModels?: string[]
}
```

---

## 10. 页面与交互架构

### 10.1 MVP 页面

| 页面 | 路由 | MVP 需求 |
|---|---|---|
| 启动页 | `/` | 展示产品名称、输入议题、进入讨论 |
| 讨论页 | `/chat` | 展示完整多角色讨论体验 |

### 10.2 后续配置页

| 页面 | 路由 | 阶段 |
|---|---|---|
| 模板选择页 | `/templates` | 后置 |
| LLM 配置页 | `/llm` | 后置 |
| 角色配置页 | `/roles` | 后置 |

### 10.3 讨论主界面组件

```text
TopBar
RosterBar
ChatContainer
  ├─ MessageBubble
  ├─ EventCard
  ├─ InviteCard
  └─ TypingIndicator
InputArea
```

### 10.4 输入模式

| 模式 | 含义 | 示例 |
|---|---|---|
| 插话 | 用户表达观点 | “我觉得这个方案风险太高” |
| 指挥 | 用户要求角色或系统动作 | “让曹操反驳一下” |
| 定夺 | 用户要求总结或做决定 | “总结一下，给出最终建议” |

---

## 11. 服务端与 Phase 2 架构

Phase 1 可不依赖服务端业务接口。Phase 2 增加服务端能力，用于模板动态下发、模型推荐和健康检查。

### 11.1 API 规划

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/templates` | GET | 返回模板列表和版本号 |
| `/api/templates/[id]` | GET | 返回完整模板，支持 ETag |
| `/api/models` | GET | 返回推荐免费模型列表 |
| `/api/health` | GET | 健康检查 |

### 11.2 错误响应格式

```json
{
  "code": "TEMPLATE_NOT_FOUND",
  "message": "Template not found",
  "details": {}
}
```

### 11.3 模板同步策略

```text
应用启动
  ↓
读取本地模板缓存
  ↓
请求 /api/templates 获取版本
  ↓
比较版本或 ETag
  ↓
有更新则拉取完整模板
  ↓
写入 IndexedDB
  ↓
离线时使用本地缓存
```

---

## 12. 迭代蓝图

### 12.1 迭代总览

| 迭代 | 名称 | 核心目标 |
|---|---|---|
| 迭代 0 | 项目脚手架与基础代码框架 | 建立工程结构、目录边界、基础类型和模块占位 |
| 迭代 1 | 最小讨论入口 | 用户能基于固定模板发起第一场讨论 |
| 迭代 2 | 多 Agent 讨论架构 | 多个角色能围绕同一议题发言 |
| 迭代 3 | 讨论状态机 | 讨论具备 opening / developing / climax / closing 阶段 |
| 迭代 4 | 用户介入机制 | 用户可以插话、指挥、定夺 |
| 迭代 5 | 导演逻辑 | 系统能控制继续、邀请、事件和收束 |
| 迭代 6 | 爽点机制 | 实现打脸、站队、投票、反转 |
| 迭代 7 | 讨论主界面 | 完整呈现多角色讨论体验 |
| 迭代 8 | 模板扩展与会话闭环 | 支持多模板、本地会话保存和恢复 |

### 12.2 迭代依赖关系

```text
迭代 0
  ↓
迭代 1
  ↓
迭代 2
  ↓
迭代 3
  ↓
迭代 4
  ↓
迭代 5
  ↓
迭代 6
  ↓
迭代 7
  ↓
迭代 8
```

### 12.3 Phase 2 规划

| 周期 | 目标 | 内容 |
|---|---|---|
| Week 13-14 | 爽点机制升级 | 从关键词检测升级到语义检测，调优触发频率 |
| Week 15-16 | 模板动态下发 | 服务端模板接口、ETag、离线缓存、新模板 |
| Week 17-18 | 产品化 | 多模型 Prompt 适配、性能、移动端、Sentry、埋点 |

---

## 13. 需求评审基线

后续每个迭代进入开发前，都必须回答以下问题。

### 13.1 产品评审问题

| 问题 | 说明 |
|---|---|
| 本迭代解决哪个用户问题？ | 避免为了技术而技术 |
| 是否增强多角色讨论体验？ | 不增强核心体验的需求应后置 |
| 是否影响用户参与感？ | 用户应能介入、指挥或定夺 |
| 是否能形成更好的结论？ | 讨论必须能收束 |
| 是否引入不必要前置配置？ | MVP 阶段避免过重配置链路 |

### 13.2 技术评审问题

| 问题 | 说明 |
|---|---|
| 是否破坏 engine 与 UI 边界？ | UI 不应承担调度逻辑 |
| 是否破坏 LLM 调用封装？ | 业务组件不得直接调 Provider |
| 是否保留状态机？ | 讨论推进必须有阶段控制 |
| 是否可测试？ | 关键判断逻辑应可单测 |
| 是否可降级？ | LLM 分类失败时应 fallback |
| 是否可扩展？ | 不能写死单模板、单角色、单模型 |

### 13.3 验收评审问题

| 问题 | 说明 |
|---|---|
| 用户能否完成完整流程？ | 从输入议题到总结结束 |
| 讨论是否明显不同于普通 Chatbot？ | 需要多角色、冲突、主持人收束 |
| 角色是否有差异？ | 角色不能同质化 |
| 引擎是否稳定？ | 不应卡死、无限循环或无法收束 |
| 数据是否能保存？ | 会话不应刷新即丢失 |

---

## 14. 关键风险与应对

| 风险 | 等级 | 表现 | 应对 |
|---|---|---|---|
| 导演逻辑不稳定 | P0 | 讨论跑偏、无法收束 | 规则优先 + LLM 辅助，Director 决策可测试 |
| 爽点机制触发不准 | P0 | 事件生硬或误触发 | Phase 1 关键词规则，Phase 2 语义升级 |
| 角色同质化 | P1 | 多角色像一个人在说话 | 强化角色职责、Prompt 差异和调度策略 |
| LLM 成本和延迟高 | P1 | 多角色发言响应慢 | Phase 1 串行少角色，后续再并行优化 |
| 用户不知道如何介入 | P1 | 用户只旁观 | 邀请卡、输入模式、快捷指令 |
| 配置流程过重 | P1 | 用户未体验核心就流失 | MVP 内置模板和默认配置 |
| 本地数据丢失 | P2 | 会话不可恢复 | IndexedDB 持久化 |
| 模型差异导致效果波动 | P2 | 不同模型遵循能力不同 | Prompt Adapter 和模型推荐 |

---

## 15. 设计决策记录

| 决策 | 结论 | 原因 |
|---|---|---|
| 多 Agent 编排 | 自研轻量 Orchestrator | 产品核心是讨论体验，复杂开源 Agent 框架前期不可控 |
| 意图识别 | Phase 1 使用 LLM 分类 | 体验优先，关键词作为 fallback |
| LLM 调用 | 使用 Vercel AI SDK | 减少底层流式调用开发成本 |
| Provider 支持 | 必须支持 Custom Provider | 兼容自定义 BaseURL、Key、ModelList |
| API Key 加密 | Phase 1 暂不做 | 客户端优先，先验证核心体验 |
| 爽点机制 | Phase 1 全部实现但规则简化 | 保留产品完整性，降低技术难度 |
| 服务端能力 | Phase 2 增加 | MVP 先本地闭环 |
| 配置 UI | 后置 | 不是核心壁垒，避免拖慢开发 |

---

## 16. 开发交付标准

### 16.1 每个迭代必须交付

| 交付物 | 说明 |
|---|---|
| 需求说明 | 产品需求、技术需求、范围边界 |
| 技术方案 | 架构、模块、数据结构、关键流程 |
| 代码实现 | 符合目录和模块边界 |
| 验收清单 | 产品验收和技术验收 |
| 风险记录 | 本迭代遗留问题和后续处理 |

### 16.2 代码层完成定义

| 项目 | 标准 |
|---|---|
| 可启动 | `npm run dev` 正常 |
| 可构建 | `npm run build` 通过 |
| 类型检查 | TypeScript 无阻断错误 |
| 代码规范 | ESLint 无阻断错误 |
| 模块边界 | UI、engine、llm、store、db 边界清晰 |
| 状态持久化 | 关键会话数据可恢复 |
| 异常处理 | LLM 失败、分类失败、无角色等场景可降级 |

---

## 17. 后续文档体系建议

为了保证开发不偏离蓝图，建议维护以下文档：

```text
docs/
├── 00-product-blueprint.md
├── 01-prd.md
├── 02-architecture.md
├── 03-development-plan.md
├── 04-prompt-design.md
├── 05-template-spec.md
├── 06-engine-spec.md
├── 07-acceptance-checklist.md
└── iterations/
    ├── iteration-0-scaffold-requirements.md
    ├── iteration-1-minimal-discussion-entry.md
    ├── iteration-2-multi-agent-architecture.md
    ├── iteration-3-discussion-state-machine.md
    ├── iteration-4-user-intervention.md
    ├── iteration-5-director-logic.md
    ├── iteration-6-sparkle-events.md
    ├── iteration-7-discussion-main-ui.md
    └── iteration-8-template-session-loop.md
```

当前蓝图文档是最高层依据。后续任何迭代需求、技术方案或开发实现，如果与本蓝图冲突，需要先进行需求评审和设计变更记录。

---

## 18. 项目成功标准

### 18.1 MVP 成功标准

| 指标 | 标准 |
|---|---|
| 完整闭环 | 用户能从输入议题到获得总结 |
| 多角色感知 | 用户能明显感知不同角色有不同立场 |
| 讨论可读性 | 消息节奏清晰，不冗长、不混乱 |
| 参与感 | 用户能自然插话、指挥、定夺 |
| 戏剧性 | 至少能触发打脸、站队、投票、反转中的部分事件 |
| 稳定性 | 讨论不会无限循环、卡死或无法收束 |

### 18.2 产品化成功标准

| 指标 | 目标 |
|---|---:|
| 完成率 | 用户观看 80% 以上消息的会话占比 > 80% |
| 继续率 | 用户完成一轮后继续讨论比例 > 30% |
| 主动发言率 | 用户主动插话或指挥比例 > 40% |
| 次日回访率 | > 20% |
| 模板扩展 | 至少 3 个高质量模板 |

---

## 19. 总结

智囊团项目的核心不是页面配置，也不是普通聊天能力，而是一个可控的 **AI 多角色讨论引擎**。

后续所有开发应围绕以下核心判断展开：

```text
用户输入一个议题后，系统是否能组织一场有角色、有冲突、有节奏、有参与、有结论的 AI 讨论？
```

只要某个需求不能增强这条主线，就应后置；只要某个技术实现破坏这条主线，就应重新评审。

本蓝图作为项目从立项到正式开发的总依据，用于约束后续迭代、需求评审、技术方案和验收标准。
