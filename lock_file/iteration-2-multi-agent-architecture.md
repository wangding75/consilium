# 迭代 2：多 Agent 讨论架构

## 1. 迭代目标

在迭代 1 的最小讨论入口基础上，建立产品核心能力：多个 AI 角色围绕同一议题进行结构化讨论。

本迭代重点是确定多 Agent 的技术架构与代码边界，让角色不只是“不同名字的 Prompt”，而是具备明确职责、上下文、发言规则和调度机制。

核心目标：

```text
用户议题 -> Host Agent 开场 -> Expert Agents 分别发言 -> Scheduler 控制发言顺序 -> 上下文持续累积
```

---

## 2. 迭代范围

### 2.1 本迭代包含

| 范围 | 说明 |
|---|---|
| Agent 抽象 | 定义 Host Agent、Expert Agent、可扩展 Agent 接口 |
| 多角色发言 | 多个角色可围绕同一议题轮流发言 |
| 角色上下文 | 每个角色根据自己的设定和历史消息生成发言 |
| 基础调度器 | 实现最小 Scheduler，控制下一位发言角色 |
| 讨论轮次 | 支持一轮或多轮角色发言 |
| Host 汇总 | 主持人可以在一轮讨论后做简短整理 |
| 自研轻量编排 | Phase 1 采用自研轻量 Orchestrator，不直接依赖复杂 Agent 框架 |

### 2.2 本迭代不包含

| 不包含内容 | 原因 |
|---|---|
| 复杂状态机 | 迭代 3 处理 opening/developing/climax/closing |
| 用户意图识别 | 迭代 4 处理用户插话、指挥、定夺 |
| 高级导演逻辑 | 迭代 5 处理邀请用户、收束、流程推进 |
| 爽点事件 | 迭代 6 处理打脸、站队、投票、反转 |
| 并行 Agent | Phase 1 可预留接口，默认串行，降低成本和复杂度 |
| 开源 Agent 框架落地 | 本迭代只评估，不作为默认实现 |

---

## 3. 产品需求

### PRD-2.1：多个 AI 角色参与讨论

**需求说明**  
作为用户，我希望看到多个角色从不同角度讨论同一个议题，而不是只有单个 AI 给答案。

| 编号 | 需求 |
|---|---|
| PRD-2.1.1 | 一个讨论会话中至少包含 1 个主持人和 3 个讨论角色 |
| PRD-2.1.2 | 不同角色需要有明显不同的观点风格或职责 |
| PRD-2.1.3 | 角色发言必须围绕当前议题和前文上下文 |
| PRD-2.1.4 | 角色不能重复前一个角色的表达，应有观点增量 |

---

### PRD-2.2：主持人负责组织讨论

**需求说明**  
作为用户，我需要主持人帮助组织讨论，避免多角色发言变成无序堆叠。

| 编号 | 需求 |
|---|---|
| PRD-2.2.1 | 主持人负责开场，说明本轮讨论议题 |
| PRD-2.2.2 | 主持人可以在一轮讨论后做简短整理 |
| PRD-2.2.3 | 主持人发言应明显区别于普通角色观点输出 |
| PRD-2.2.4 | 主持人不应频繁抢占所有发言轮次 |

---

### PRD-2.3：角色具备职责分工

**需求说明**  
作为用户，我希望不同角色不只是语气不同，而是承担不同讨论职责。

| 编号 | 需求 |
|---|---|
| PRD-2.3.1 | 每个角色需要有明确定位，例如战略型、风险型、执行型、反对型 |
| PRD-2.3.2 | 角色发言需要体现自身定位 |
| PRD-2.3.3 | 同一议题下，不同角色应输出不同视角 |
| PRD-2.3.4 | 角色信息应来自模板数据，而不是写死在调度逻辑中 |

---

### PRD-2.4：讨论可以持续多轮

**需求说明**  
作为用户，我希望讨论不是一次性生成，而是可以按照轮次推进。

| 编号 | 需求 |
|---|---|
| PRD-2.4.1 | 系统支持发起下一轮讨论 |
| PRD-2.4.2 | 下一轮发言需要参考上一轮消息 |
| PRD-2.4.3 | 系统需要控制每轮最多发言角色数量 |
| PRD-2.4.4 | 系统需要避免同一角色连续多次发言 |

---

## 4. 技术需求

### TECH-2.1：Agent 抽象

建议新增：

```text
src/engine/agent.ts
src/engine/orchestrator.ts
src/engine/scheduler.ts
src/engine/context.ts
```

Agent 基础接口建议：

```ts
export interface Agent {
  id: string
  roleId: string
  type: 'host' | 'expert' | 'critic' | 'synthesizer'
  generate(input: AgentInput): Promise<AgentOutput>
}
```

| 编号 | 技术需求 |
|---|---|
| TECH-2.1.1 | Agent 必须从 Role 派生，不能和角色数据割裂 |
| TECH-2.1.2 | Host Agent 和普通 Expert Agent 需要区分 type |
| TECH-2.1.3 | Agent 输入必须包含 topic、role、messageHistory、round 信息 |
| TECH-2.1.4 | Agent 输出必须统一转换为 Message |
| TECH-2.1.5 | Agent 不能直接操作 UI 状态 |

---

### TECH-2.2：自研轻量 Orchestrator

本迭代建议采用自研轻量编排，而不是直接引入 LangGraph、AutoGen、CrewAI 等框架。

原因：

| 判断项 | 说明 |
|---|---|
| 产品核心 | 当前核心是讨论体验，不是自动化任务执行 |
| 可控性 | 自研 Scheduler 和 Director 更容易控制节奏 |
| 调试成本 | 开源 Agent 框架会增加状态、消息、工具链复杂度 |
| 验收难度 | 自研轻量流程更容易写清验收标准 |
| 后续兼容 | 可以预留接口，未来再接入图式工作流或工具 Agent |

Orchestrator 最小流程：

```text
runDiscussionRound(state)
  -> scheduler.selectSpeakers(state)
  -> context.buildForAgent(agent, state)
  -> agent.generate(context)
  -> append message
  -> return updated state
```

| 编号 | 技术需求 |
|---|---|
| TECH-2.2.1 | 新增 `orchestrator.ts` 统一编排一轮讨论 |
| TECH-2.2.2 | Orchestrator 负责调用 Scheduler、Context Builder、Agent |
| TECH-2.2.3 | Orchestrator 不直接包含复杂阶段转换逻辑，阶段转换放到迭代 3 |
| TECH-2.2.4 | 默认采用串行执行，预留并行执行扩展点 |

---

### TECH-2.3：Scheduler 基础调度

| 编号 | 技术需求 |
|---|---|
| TECH-2.3.1 | 实现 `scheduler.selectNextSpeaker()` 或 `selectSpeakers()` |
| TECH-2.3.2 | 第一轮优先由主持人发言 |
| TECH-2.3.3 | 普通角色按轮转或模板顺序发言 |
| TECH-2.3.4 | 同一角色不能连续发言，除非后续 Director 明确要求 |
| TECH-2.3.5 | 每轮最多发言人数可配置 |
| TECH-2.3.6 | Scheduler 不负责判断讨论是否结束，结束判断留给后续 Director |

---

### TECH-2.4：上下文构建

| 编号 | 技术需求 |
|---|---|
| TECH-2.4.1 | 新增 `context.ts` 负责构建 Agent 输入上下文 |
| TECH-2.4.2 | 上下文应包含用户议题、角色设定、最近消息、当前轮次 |
| TECH-2.4.3 | 上下文长度需要有基础限制，避免消息无限膨胀 |
| TECH-2.4.4 | 不同角色看到的 systemPrompt 应包含自身职责 |
| TECH-2.4.5 | 角色输出需被要求“补充新观点，避免重复前文” |

---

### TECH-2.5：串行与并行策略

| 阶段 | 策略 |
|---|---|
| Phase 1 默认 | 串行 Agent，便于控制上下文和成本 |
| 技术预留 | Orchestrator 支持后续切换为 parallel generate |
| 不建议当前实现 | 每轮全角色并行 + 裁判综合，因为成本和延迟较高 |

验收要求：当前代码结构应允许未来将：

```text
for speaker in speakers -> await generate
```

替换为：

```text
Promise.all(speakers.map(generate)) -> synthesize
```

但本迭代不要求实现并行。

---

## 5. 验收标准

### 5.1 产品验收

| 编号 | 验收项 | 验收标准 |
|---|---|---|
| AC-2.1 | 多角色参与 | 同一议题下至少 3 个角色参与讨论 |
| AC-2.2 | 主持人开场 | 第一轮由主持人组织开场 |
| AC-2.3 | 观点差异 | 不同角色输出能体现不同职责或立场 |
| AC-2.4 | 多轮推进 | 用户可以触发下一轮讨论 |
| AC-2.5 | 上下文连续 | 第二轮发言能参考第一轮内容 |
| AC-2.6 | 发言控制 | 不会出现同一角色无理由连续刷屏 |

---

### 5.2 技术验收

| 编号 | 验收项 | 验收标准 |
|---|---|---|
| AC-2.7 | Agent 抽象 | 存在清晰 Agent 接口或等价抽象 |
| AC-2.8 | Orchestrator | 一轮讨论由统一 Orchestrator 执行 |
| AC-2.9 | Scheduler | 发言选择逻辑从页面层剥离 |
| AC-2.10 | Context Builder | Prompt 上下文构建有独立模块 |
| AC-2.11 | 串行执行 | 当前多角色发言按可控顺序执行 |
| AC-2.12 | 架构预留 | 代码结构允许后续扩展并行 Agent 或 Synthesizer |
| AC-2.13 | 工程质量 | `npm run build` 和 `npm run lint` 通过 |

---

## 6. 开源技术与自研框架决策

本迭代默认结论：**Phase 1 自研轻量多 Agent 编排框架**。

| 选项 | 当前建议 | 原因 |
|---|---|---|
| LangGraph | 暂不引入 | 图式工作流能力强，但对 MVP 偏重 |
| AutoGen | 暂不引入 | 更适合复杂多 Agent 协作和工具任务 |
| CrewAI | 暂不引入 | 更偏任务型角色协作，不完全匹配讨论体验 |
| 自研轻量 Orchestrator | 采用 | 可控、简单、便于后续接 Director 和事件机制 |

后续如出现以下需求，可重新评估开源框架：

1. 需要复杂图式流程。
2. 每个 Agent 需要独立工具调用。
3. 需要长期任务执行和任务状态恢复。
4. 需要 Agent 间自动协商和反复重试。

---

## 7. 交付物

| 交付物 | 说明 |
|---|---|
| Agent 抽象 | Host / Expert 等基础 Agent 类型 |
| Orchestrator | 一轮多 Agent 讨论编排 |
| Scheduler | 基础发言调度器 |
| Context Builder | Agent 上下文构建模块 |
| 多角色讨论流程 | 多角色围绕同一议题多轮发言 |
| 架构说明 | 说明为何当前采用自研轻量方案 |

---

## 8. 需求评审关注点

进入本迭代开发前，需求评审需要确认：

| 评审项 | 需要确认的问题 |
|---|---|
| 角色数量 | MVP 默认几个角色参与一轮讨论 |
| 角色职责 | 是否需要固定“支持者/反对者/风险官/总结者”等职责 |
| 发言顺序 | 是否按模板顺序、轮询，还是根据角色职责选择 |
| 每轮长度 | 每轮最多几个角色发言，每个角色最多多少字 |
| Host 职责 | Host 是否每轮都总结，还是只在开场和收束时出现 |
| 框架选择 | 是否确认 Phase 1 自研轻量 Orchestrator |
| 并行能力 | 当前是否只预留，不实现并行 Agent |

---

## 9. 迭代完成定义

满足以下条件时，迭代 2 可视为完成：

1. 多角色能够围绕同一议题发言。
2. 角色发言体现不同职责或立场。
3. 发言调度逻辑从页面组件中剥离。
4. Agent、Scheduler、Context Builder、Orchestrator 边界清晰。
5. 当前采用串行可控执行，同时保留并行扩展点。
6. 工程构建和 Lint 通过。
