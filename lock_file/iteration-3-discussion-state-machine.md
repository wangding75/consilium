# 迭代 3：讨论状态机

## 1. 迭代目标

在迭代 2 的多 Agent 讨论架构基础上，为讨论过程加入明确阶段，使讨论从“角色轮流发言”升级为“有节奏、有推进、有收束的讨论”。

本迭代核心是实现讨论状态机：

```text
idle -> opening -> developing -> climax -> closing
```

状态机负责维护当前讨论阶段、轮次、发言历史、阶段切换条件，为后续用户介入、导演逻辑和爽点机制提供基础。

---

## 2. 迭代范围

### 2.1 本迭代包含

| 范围 | 说明 |
|---|---|
| Phase 定义 | 定义 idle、opening、developing、climax、closing 阶段 |
| EngineState 完整化 | 扩展讨论状态数据结构 |
| 状态转换规则 | 实现基础阶段切换逻辑 |
| 轮次管理 | 管理 currentTurn、maxTurns、lastSpeakerId |
| 历史消息管理 | 统一维护 messageHistory |
| 阶段提示 | 给 Agent Prompt 注入当前阶段要求 |
| 基础结束判断 | 根据轮次上限或用户结束信号进入 closing |

### 2.2 本迭代不包含

| 不包含内容 | 原因 |
|---|---|
| 复杂用户意图识别 | 迭代 4 实现 |
| Director 高级决策 | 迭代 5 实现 |
| 爽点事件触发 | 迭代 6 实现 |
| 完整 UI 阶段动画 | 迭代 7 处理 |
| 语义级冲突检测 | Phase 2 再升级 |

---

## 3. 产品需求

### PRD-3.1：讨论具备阶段感

**需求说明**  
作为用户，我希望讨论不是无休止的轮流发言，而是能经历开场、展开、高潮和总结。

| 编号 | 需求 |
|---|---|
| PRD-3.1.1 | 讨论开始时进入 opening 阶段 |
| PRD-3.1.2 | 主持人完成开场后进入 developing 阶段 |
| PRD-3.1.3 | 讨论出现明显分歧或达到中段后进入 climax 阶段 |
| PRD-3.1.4 | 达到结束条件后进入 closing 阶段 |
| PRD-3.1.5 | closing 阶段由主持人输出总结 |

---

### PRD-3.2：不同阶段有不同发言目标

**需求说明**  
作为用户，我希望角色在不同讨论阶段有不同表达重点。

| 阶段 | 产品表现 |
|---|---|
| opening | 主持人介绍议题、说明讨论目标 |
| developing | 多角色展开观点、提出建议、补充信息 |
| climax | 角色之间产生更强冲突、分歧或关键判断 |
| closing | 主持人收束争议、输出结论和建议 |

---

### PRD-3.3：讨论不会无限持续

**需求说明**  
作为用户，我希望讨论有自然结束机制，避免一直生成。

| 编号 | 需求 |
|---|---|
| PRD-3.3.1 | 系统应有最大轮次限制 |
| PRD-3.3.2 | 用户表达“总结/结束/决定了”等信号时，系统可以进入 closing |
| PRD-3.3.3 | 进入 closing 后，不再继续普通角色发散讨论 |
| PRD-3.3.4 | closing 阶段输出应简洁、有结论感 |

---

### PRD-3.4：当前讨论状态可被感知

**需求说明**  
作为用户或开发者，我需要能知道当前讨论处于哪个阶段。

| 编号 | 需求 |
|---|---|
| PRD-3.4.1 | 当前 phase 保存在会话状态中 |
| PRD-3.4.2 | 页面可展示当前讨论阶段的基础文本标识 |
| PRD-3.4.3 | 每次阶段变化可记录为 system message 或状态日志 |

---

## 4. 技术需求

### TECH-3.1：状态机模块

建议新增或完善：

```text
src/engine/state.ts
src/engine/types.ts
```

Phase 定义：

```ts
export type Phase = 'idle' | 'opening' | 'developing' | 'climax' | 'closing'
```

| 编号 | 技术需求 |
|---|---|
| TECH-3.1.1 | 状态转换逻辑必须集中在 `state.ts` |
| TECH-3.1.2 | 页面组件不能直接判断 phase 如何转换 |
| TECH-3.1.3 | Orchestrator 每轮结束后调用状态机判断下一阶段 |
| TECH-3.1.4 | 状态机函数应尽量保持纯函数，便于测试 |

---

### TECH-3.2：EngineState 完整化

建议 EngineState 至少包含：

```ts
export interface EngineState {
  sessionId: string
  templateId: string
  topic: string
  phase: Phase
  currentTurn: number
  maxTurns: number
  lastSpeakerId: string | null
  speakingQueue: string[]
  messageHistory: Message[]
}
```

| 编号 | 技术需求 |
|---|---|
| TECH-3.2.1 | currentTurn 在每次有效角色发言后递增 |
| TECH-3.2.2 | lastSpeakerId 用于避免连续发言 |
| TECH-3.2.3 | speakingQueue 用于记录待发言角色 |
| TECH-3.2.4 | messageHistory 作为上下文构建和阶段判断输入 |
| TECH-3.2.5 | maxTurns 可来自模板 rhythm 配置或系统默认配置 |

---

### TECH-3.3：阶段转换规则

基础规则建议：

| 当前阶段 | 触发条件 | 下一阶段 |
|---|---|---|
| idle | 用户启动讨论 | opening |
| opening | 主持人开场完成 | developing |
| developing | 轮次过半或出现明显冲突关键词 | climax |
| developing | 达到最大轮次或用户要求结束 | closing |
| climax | 用户最终表态或达到最大轮次 | closing |
| closing | 总结完成 | closing |

| 编号 | 技术需求 |
|---|---|
| TECH-3.3.1 | 实现 `getNextPhase(state, latestMessage)` |
| TECH-3.3.2 | 实现 `shouldEnterClimax(state)` |
| TECH-3.3.3 | 实现 `shouldClose(state)` |
| TECH-3.3.4 | 关键词规则集中维护，不散落在多个文件 |
| TECH-3.3.5 | 当前使用规则判断，不要求语义判断 |

---

### TECH-3.4：阶段 Prompt 注入

| 编号 | 技术需求 |
|---|---|
| TECH-3.4.1 | Context Builder 需要包含当前 phase |
| TECH-3.4.2 | opening 阶段 Prompt 要求主持人开场 |
| TECH-3.4.3 | developing 阶段 Prompt 要求角色提出观点和依据 |
| TECH-3.4.4 | climax 阶段 Prompt 可要求角色指出分歧或关键判断 |
| TECH-3.4.5 | closing 阶段 Prompt 要求主持人总结，不再发散 |

---

### TECH-3.5：基础测试建议

| 编号 | 技术需求 |
|---|---|
| TECH-3.5.1 | 为 `getNextPhase` 编写单元测试 |
| TECH-3.5.2 | 覆盖 idle -> opening、opening -> developing、developing -> climax、climax -> closing |
| TECH-3.5.3 | 覆盖达到 maxTurns 的关闭逻辑 |
| TECH-3.5.4 | 覆盖用户结束关键词触发 closing |

---

## 5. 验收标准

### 5.1 产品验收

| 编号 | 验收项 | 验收标准 |
|---|---|---|
| AC-3.1 | 开场阶段 | 新讨论启动后进入 opening |
| AC-3.2 | 发展阶段 | 主持人开场完成后进入 developing |
| AC-3.3 | 高潮阶段 | 讨论中段或出现冲突后进入 climax |
| AC-3.4 | 收束阶段 | 达到结束条件后进入 closing |
| AC-3.5 | 阶段差异 | 不同阶段的 AI 发言目标有明显差异 |
| AC-3.6 | 不无限生成 | 达到最大轮次后系统进入总结而不是继续发散 |

---

### 5.2 技术验收

| 编号 | 验收项 | 验收标准 |
|---|---|---|
| AC-3.7 | 状态机模块 | `src/engine/state.ts` 存在并承载阶段转换逻辑 |
| AC-3.8 | EngineState | 当前状态包含 phase、turn、history、lastSpeaker 等字段 |
| AC-3.9 | 阶段切换 | `getNextPhase` 或等价函数可正常工作 |
| AC-3.10 | Prompt 注入 | Agent 生成时能获取当前 phase |
| AC-3.11 | 页面解耦 | 页面组件不直接写状态转换规则 |
| AC-3.12 | 单元测试 | 关键状态转换规则有测试覆盖 |
| AC-3.13 | 工程质量 | `npm run build` 和 `npm run lint` 通过 |

---

## 6. 交付物

| 交付物 | 说明 |
|---|---|
| state.ts | 状态机与阶段转换规则 |
| 完整 EngineState | 讨论状态数据结构 |
| 阶段 Prompt 注入 | 不同阶段影响角色发言要求 |
| 状态转换测试 | 覆盖主要 phase 转换 |
| 基础阶段展示 | 页面或日志能看到当前阶段 |

---

## 7. 需求评审关注点

进入本迭代开发前，需求评审需要确认：

| 评审项 | 需要确认的问题 |
|---|---|
| 阶段定义 | 是否采用 idle/opening/developing/climax/closing 五阶段 |
| 最大轮次 | 默认 maxTurns 是多少 |
| 高潮触发 | 轮次过半触发，还是必须检测到冲突才触发 |
| 结束信号 | 哪些用户表达应进入 closing |
| 阶段可见性 | 当前阶段是否需要展示给用户，还是仅内部使用 |
| 总结形式 | closing 阶段输出是短总结、行动建议，还是观点对照表 |

---

## 8. 迭代完成定义

满足以下条件时，迭代 3 可视为完成：

1. 讨论具备明确 phase。
2. phase 能按照规则自动流转。
3. 不同 phase 对 Agent 输出产生影响。
4. 达到结束条件后能进入 closing。
5. 状态机逻辑集中在 engine 层。
6. 关键转换规则有测试覆盖。
7. 工程构建和 Lint 通过。
