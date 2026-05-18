# 迭代 5：导演逻辑

## 1. 迭代目标

在多 Agent、状态机、用户介入机制基础上，引入“导演逻辑”，让系统主动控制讨论节奏，而不是机械地按角色顺序发言。

Director 的职责是判断当前讨论应该：

```text
继续讨论 / 邀请用户 / 触发事件 / 进入总结
```

本迭代目标是让讨论具有“被组织过”的感觉，避免多 Agent 系统常见的问题：重复、拖沓、无重点、无收束。

---

## 2. 迭代范围

### 2.1 本迭代包含

| 范围 | 说明 |
|---|---|
| Director 模块 | 新增 `director.ts` 作为讨论流程决策中心 |
| 决策动作 | 支持 continue、invite_user、conclude、trigger_event |
| 邀请用户 | 判断何时邀请用户参与或表态 |
| 收束判断 | 判断何时进入 closing |
| 分歧判断 | 基于关键词和历史消息判断是否存在分歧 |
| 共识判断 | 基于连续轮次和角色表达判断是否接近共识 |
| 调度联动 | Director 决策影响 Scheduler 和状态机 |

### 2.2 本迭代不包含

| 不包含内容 | 原因 |
|---|---|
| 事件详细触发逻辑 | 迭代 6 处理打脸、站队、投票、反转 |
| 语义级判断 | 当前使用规则和关键词，Phase 2 再升级 |
| 复杂 UI 卡片 | 迭代 7 展示邀请卡、事件卡 |
| 用户画像或偏好学习 | 不在当前阶段 |

---

## 3. 产品需求

### PRD-5.1：系统能主动邀请用户参与

**需求说明**  
作为用户，我希望系统在关键分歧点、选择点或即将收束时主动问我，而不是只让 AI 角色一直说。

| 编号 | 需求 |
|---|---|
| PRD-5.1.1 | 当角色观点明显分歧时，系统可邀请用户表态 |
| PRD-5.1.2 | 当出现多个方案时，系统可邀请用户选择方向 |
| PRD-5.1.3 | 当讨论即将收束时，系统可询问用户是否需要总结 |
| PRD-5.1.4 | 邀请用户不应过于频繁，避免打断体验 |

---

### PRD-5.2：系统能判断继续还是收束

**需求说明**  
作为用户，我希望系统能在讨论充分后主动总结，而不是无限继续。

| 编号 | 需求 |
|---|---|
| PRD-5.2.1 | 达到最大轮次时，系统应进入收束 |
| PRD-5.2.2 | 用户明确要求结束时，系统应进入收束 |
| PRD-5.2.3 | 讨论已经形成明显共识时，系统可进入收束 |
| PRD-5.2.4 | 收束时应优先由主持人输出总结 |

---

### PRD-5.3：系统能识别讨论分歧

**需求说明**  
作为用户，我希望系统能捕捉角色之间的冲突点，并围绕冲突推进讨论。

| 编号 | 需求 |
|---|---|
| PRD-5.3.1 | 系统能识别“不同意、不对、但是、值得商榷”等分歧表达 |
| PRD-5.3.2 | 系统能在分歧出现后优先让相关角色继续讨论 |
| PRD-5.3.3 | 系统能把分歧作为邀请用户或进入高潮阶段的依据 |
| PRD-5.3.4 | 系统不要求当前实现语义级深度判断 |

---

### PRD-5.4：系统能避免机械轮流发言

**需求说明**  
作为用户，我希望讨论看起来像有人在控场，而不是角色按固定顺序重复发言。

| 编号 | 需求 |
|---|---|
| PRD-5.4.1 | Director 可以影响下一步动作 |
| PRD-5.4.2 | 如果讨论已经足够，应减少继续发散 |
| PRD-5.4.3 | 如果出现关键问题，应优先推进关键问题 |
| PRD-5.4.4 | 如果用户长时间未参与，可以适度邀请用户 |

---

## 4. 技术需求

### TECH-5.1：DirectorDecision 类型

建议定义：

```ts
export type DirectorAction = 'continue' | 'invite_user' | 'trigger_event' | 'conclude'

export interface DirectorDecision {
  action: DirectorAction
  reason: string
  targetRoleId?: string
  eventType?: 'face_slap' | 'camp' | 'vote' | 'reverse'
  priority: number
}
```

| 编号 | 技术需求 |
|---|---|
| TECH-5.1.1 | DirectorDecision 应作为 engine 内部标准决策结果 |
| TECH-5.1.2 | action 必须能被 Orchestrator 消费 |
| TECH-5.1.3 | reason 用于调试和后续产品体验解释 |
| TECH-5.1.4 | eventType 当前可预留，具体事件逻辑在迭代 6 实现 |

---

### TECH-5.2：Director 模块

建议新增：

```text
src/engine/director.ts
```

核心函数：

```ts
export function makeDirectorDecision(state: EngineState): DirectorDecision
```

| 编号 | 技术需求 |
|---|---|
| TECH-5.2.1 | Director 输入为当前 EngineState |
| TECH-5.2.2 | Director 输出标准 DirectorDecision |
| TECH-5.2.3 | Director 不直接调用 LLM，Phase 1 先使用规则判断 |
| TECH-5.2.4 | Director 不直接操作 React state |
| TECH-5.2.5 | Director 逻辑应可单元测试 |

---

### TECH-5.3：邀请用户判断

建议规则：

| 触发场景 | 规则 |
|---|---|
| 观点分歧 | 最近消息出现分歧关键词 |
| 角色提问 | 出现“你怎么看 / 主公以为 / 意下如何”等问句 |
| 方案分叉 | 出现“两条路 / 要么 / 两个方案”等表达 |
| 高潮阶段 | phase 为 climax，且用户近期未发言 |
| 收束前 | 即将进入 closing 前，邀请用户确认 |

技术要求：

| 编号 | 技术需求 |
|---|---|
| TECH-5.3.1 | 实现 `shouldInviteUser(state)` |
| TECH-5.3.2 | 控制 inviteCount，避免过度邀请 |
| TECH-5.3.3 | 记录 pendingInvite，避免重复邀请 |
| TECH-5.3.4 | 用户回应后清除 pendingInvite |

---

### TECH-5.4：收束判断

建议规则：

| 触发场景 | 规则 |
|---|---|
| 最大轮次 | currentTurn >= maxTurns |
| 用户结束信号 | 用户输入包含总结、结束、结论、决定了 |
| 共识形成 | 连续多轮无明显反对，且观点趋同 |
| 主持人请求总结 | 用户或系统指令要求 Host 总结 |

技术要求：

| 编号 | 技术需求 |
|---|---|
| TECH-5.4.1 | 实现 `shouldConclude(state)` |
| TECH-5.4.2 | conclude 决策应推动 phase 进入 closing |
| TECH-5.4.3 | closing 阶段调度 Host Agent |
| TECH-5.4.4 | 总结完成后不再自动继续普通发言 |

---

### TECH-5.5：Orchestrator 集成

流程建议：

```text
on engine step
  -> director.makeDecision(state)
  -> if conclude: run host summary
  -> if invite_user: append invite message / wait user
  -> if trigger_event: hand off to events module
  -> if continue: scheduler selects speaker
```

| 编号 | 技术需求 |
|---|---|
| TECH-5.5.1 | Orchestrator 每轮或每次用户输入后调用 Director |
| TECH-5.5.2 | Director 决策优先级高于普通 Scheduler |
| TECH-5.5.3 | invite_user 时不应继续自动生成大量角色消息 |
| TECH-5.5.4 | conclude 时优先进入 Host 总结流程 |

---

## 5. 验收标准

### 5.1 产品验收

| 编号 | 验收项 | 验收标准 |
|---|---|---|
| AC-5.1 | 主动邀请 | 分歧或选择点出现时，系统可邀请用户表态 |
| AC-5.2 | 邀请不过量 | 单次讨论不会频繁重复邀请用户 |
| AC-5.3 | 主动收束 | 达到结束条件后，系统进入总结 |
| AC-5.4 | 讨论不机械 | 发言流程不只是固定角色循环 |
| AC-5.5 | 分歧可感知 | 系统能基于分歧信号调整讨论推进 |
| AC-5.6 | 总结明确 | 收束时由主持人输出清晰总结 |

---

### 5.2 技术验收

| 编号 | 验收项 | 验收标准 |
|---|---|---|
| AC-5.7 | Director 模块 | `src/engine/director.ts` 存在并输出 DirectorDecision |
| AC-5.8 | 邀请规则 | `shouldInviteUser` 或等价逻辑可工作 |
| AC-5.9 | 收束规则 | `shouldConclude` 或等价逻辑可工作 |
| AC-5.10 | Orchestrator 集成 | Director 决策能影响后续发言流程 |
| AC-5.11 | 状态记录 | inviteCount、pendingInvite 等状态被正确维护 |
| AC-5.12 | 单元测试 | 关键 Director 判断有测试覆盖 |
| AC-5.13 | 工程质量 | `npm run build` 和 `npm run lint` 通过 |

---

## 6. 交付物

| 交付物 | 说明 |
|---|---|
| director.ts | 讨论导演决策模块 |
| DirectorDecision 类型 | 标准化导演输出 |
| 邀请用户规则 | shouldInviteUser |
| 收束规则 | shouldConclude |
| Orchestrator 集成 | Director 影响讨论推进 |
| 测试用例 | 覆盖邀请、收束、继续等核心场景 |

---

## 7. 需求评审关注点

进入本迭代开发前，需求评审需要确认：

| 评审项 | 需要确认的问题 |
|---|---|
| 邀请时机 | 哪些场景必须邀请用户，哪些只是可选 |
| 邀请频率 | 单次讨论最多邀请几次用户 |
| 收束时机 | 最大轮次、用户结束、共识形成的优先级如何 |
| 分歧判断 | Phase 1 使用哪些关键词判断分歧 |
| Director 权限 | Director 是否可以打断 Scheduler 的正常发言顺序 |
| 调试信息 | 是否需要在开发模式展示 Director 决策 reason |

---

## 8. 迭代完成定义

满足以下条件时，迭代 5 可视为完成：

1. Director 能根据当前状态输出 continue、invite_user、conclude 等决策。
2. 邀请用户和收束逻辑可被真实讨论流程触发。
3. Director 决策能影响 Scheduler 或 Orchestrator。
4. 邀请频率受控，不会重复打扰用户。
5. 规则逻辑集中在 director.ts，且有测试覆盖。
6. 工程构建和 Lint 通过。
