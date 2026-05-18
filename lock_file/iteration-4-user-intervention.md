# 迭代 4：用户介入机制

## 1. 迭代目标

在已有多 Agent 架构和状态机基础上，让用户不只是旁观 AI 角色讨论，而是可以随时介入讨论，改变讨论走向。

本迭代实现三类用户介入方式：

```text
interrupt：插话表达观点
command：指挥某个角色或要求执行动作
decide/passive：定夺、确认、继续或普通输入
```

产品目标是让用户真正成为讨论的主导者，而不是只消费 AI 生成内容。

---

## 2. 迭代范围

### 2.1 本迭代包含

| 范围 | 说明 |
|---|---|
| 用户输入接入 | 讨论过程中用户可继续输入内容 |
| 意图分类 | 将用户输入识别为插话、指挥、普通参与等意图 |
| 角色指令 | 用户可以点名某个角色发言、反驳、补充 |
| 讨论继续 | 用户普通输入后，系统根据输入继续推进讨论 |
| 结束信号 | 用户要求总结或结束时，系统进入收束流程 |
| 调度集成 | Scheduler 根据用户意图调整下一位发言角色 |
| fallback 规则 | LLM 分类失败时使用规则兜底 |

### 2.2 本迭代不包含

| 不包含内容 | 原因 |
|---|---|
| 复杂导演决策 | 迭代 5 处理 |
| 爽点事件触发 | 迭代 6 处理 |
| 完整输入模式 UI | 迭代 7 处理，当前可先用普通输入框 |
| 多模态输入 | 不在当前阶段 |
| 权限系统 | 不在当前阶段 |

---

## 3. 产品需求

### PRD-4.1：用户可以在讨论中插话

**需求说明**  
作为用户，我希望在 AI 角色讨论过程中表达自己的观点，让后续讨论参考我的输入。

| 编号 | 需求 |
|---|---|
| PRD-4.1.1 | 讨论过程中用户可以继续输入消息 |
| PRD-4.1.2 | 用户消息应加入当前讨论上下文 |
| PRD-4.1.3 | 后续角色发言需要回应或参考用户最新输入 |
| PRD-4.1.4 | 用户插话不应导致讨论状态丢失 |

---

### PRD-4.2：用户可以指挥指定角色

**需求说明**  
作为用户，我希望可以点名某个角色，让该角色进行解释、反驳、补充或总结。

| 编号 | 需求 |
|---|---|
| PRD-4.2.1 | 用户可以通过角色名点名角色发言 |
| PRD-4.2.2 | 用户可以要求某个角色反驳另一观点 |
| PRD-4.2.3 | 被点名角色应优先成为下一位发言者 |
| PRD-4.2.4 | 如果角色名无法识别，系统应退回普通讨论流程 |

示例：

```text
让诸葛亮分析一下风险
曹操反驳一下这个观点
主持人总结一下
```

---

### PRD-4.3：用户可以要求总结或结束

**需求说明**  
作为用户，我希望在讨论足够时，可以要求系统总结并结束当前讨论。

| 编号 | 需求 |
|---|---|
| PRD-4.3.1 | 用户输入“总结一下”“结束”“决定了”等内容时，系统识别为收束信号 |
| PRD-4.3.2 | 系统进入 closing 或准备进入 closing |
| PRD-4.3.3 | 主持人输出最终总结 |
| PRD-4.3.4 | 总结后不应继续自动发散普通讨论 |

---

### PRD-4.4：用户介入影响后续讨论

**需求说明**  
作为用户，我希望我的输入对讨论真的有影响，而不是被简单追加到历史消息中。

| 编号 | 需求 |
|---|---|
| PRD-4.4.1 | 用户提出新观点后，后续角色需要回应该观点 |
| PRD-4.4.2 | 用户点名角色后，下一个发言角色应尽量匹配指令 |
| PRD-4.4.3 | 用户要求反驳时，角色输出应体现反驳动作 |
| PRD-4.4.4 | 用户要求继续时，系统按正常讨论流程推进 |

---

## 4. 技术需求

### TECH-4.1：Intent 类型定义

建议定义：

```ts
export type UserIntent = 'interrupt' | 'command' | 'passive' | 'conclude'

export interface IntentResult {
  intent: UserIntent
  reasoning?: string
  targetRoleId?: string
  action?: 'speak' | 'refute' | 'summarize' | 'vote' | 'continue'
  confidence: number
}
```

| 编号 | 技术需求 |
|---|---|
| TECH-4.1.1 | Intent 类型定义放在 engine 或 types 中 |
| TECH-4.1.2 | intent 结果必须可被 Scheduler 和 State Machine 使用 |
| TECH-4.1.3 | targetRoleId 应与模板中的 role id 匹配 |

---

### TECH-4.2：LLM 意图识别

建议新增：

```text
src/engine/intent.ts
```

| 编号 | 技术需求 |
|---|---|
| TECH-4.2.1 | 使用 LLM 对用户输入进行分类 |
| TECH-4.2.2 | 分类 Prompt 要求输出稳定 JSON |
| TECH-4.2.3 | JSON parse 失败时走 fallback 规则 |
| TECH-4.2.4 | 分类输入包含用户消息、角色列表、当前 phase |
| TECH-4.2.5 | 分类输出包含 intent、targetRoleId、action |

示例输出：

```json
{
  "intent": "command",
  "targetRoleId": "zhuge-liang",
  "action": "refute",
  "confidence": 0.86
}
```

---

### TECH-4.3：规则 fallback

| 编号 | 技术需求 |
|---|---|
| TECH-4.3.1 | 识别角色名命中：判定为 command |
| TECH-4.3.2 | 识别“总结/结束/结论/决定了”：判定为 conclude |
| TECH-4.3.3 | 识别“反驳/怼/不同意/质疑”：判定 action 为 refute |
| TECH-4.3.4 | 无明显命中时默认为 passive 或 interrupt |
| TECH-4.3.5 | fallback 规则集中维护，便于后续优化 |

---

### TECH-4.4：Scheduler 集成

| 编号 | 技术需求 |
|---|---|
| TECH-4.4.1 | Scheduler 支持根据 IntentResult 选择下一位发言者 |
| TECH-4.4.2 | command + targetRoleId 时优先选择目标角色 |
| TECH-4.4.3 | conclude 时优先选择 Host Agent |
| TECH-4.4.4 | interrupt/passive 时按正常调度策略继续 |
| TECH-4.4.5 | 被点名角色不存在时退回默认调度 |

---

### TECH-4.5：用户消息处理流程

建议新增或完善：

```text
src/engine/user-message.ts
```

流程：

```text
onUserMessage(text)
  -> append user message
  -> classifyIntent(text, state)
  -> update state if needed
  -> scheduler.selectNextSpeaker(intent, state)
  -> orchestrator.runNext(intent, state)
  -> return updated messages/state
```

| 编号 | 技术需求 |
|---|---|
| TECH-4.5.1 | 用户消息先写入 messageHistory |
| TECH-4.5.2 | 意图识别结果可写入状态或调试日志 |
| TECH-4.5.3 | 后续 Agent Prompt 需要包含用户最新输入 |
| TECH-4.5.4 | 整个流程不应阻塞 UI 基础响应 |

---

## 5. 验收标准

### 5.1 产品验收

| 编号 | 验收项 | 验收标准 |
|---|---|---|
| AC-4.1 | 用户插话 | 用户在讨论中输入观点后，后续角色能回应该观点 |
| AC-4.2 | 点名角色 | 用户点名某角色后，该角色优先发言 |
| AC-4.3 | 反驳指令 | 用户要求反驳时，目标角色输出反驳性内容 |
| AC-4.4 | 总结指令 | 用户要求总结时，主持人输出总结 |
| AC-4.5 | 状态保持 | 用户介入后，历史消息和阶段状态不丢失 |
| AC-4.6 | 异常兜底 | 意图识别失败时，系统仍能继续讨论 |

---

### 5.2 技术验收

| 编号 | 验收项 | 验收标准 |
|---|---|---|
| AC-4.7 | Intent 模块 | `src/engine/intent.ts` 存在并可返回 IntentResult |
| AC-4.8 | LLM 分类 | 支持使用 LLM 分类 interrupt/command/passive/conclude |
| AC-4.9 | fallback 规则 | LLM 失败或 JSON 错误时有规则兜底 |
| AC-4.10 | Scheduler 集成 | 调度器能根据 intent 调整下一位发言人 |
| AC-4.11 | 用户消息流程 | 用户消息处理流程封装在 engine 层 |
| AC-4.12 | 工程质量 | `npm run build` 和 `npm run lint` 通过 |

---

## 6. 交付物

| 交付物 | 说明 |
|---|---|
| intent.ts | 用户意图识别模块 |
| IntentResult 类型 | 标准化意图识别输出 |
| fallback 规则 | 本地规则兜底 |
| user message handler | 用户消息处理流程 |
| Scheduler 集成 | 根据用户意图调整调度 |
| 基础交互验证 | 插话、点名、总结可用 |

---

## 7. 需求评审关注点

进入本迭代开发前，需求评审需要确认：

| 评审项 | 需要确认的问题 |
|---|---|
| 意图分类 | 是否使用 interrupt/command/passive/conclude 四类 |
| 点名规则 | 用户用角色名、别名、职位名是否都能识别 |
| 反驳动作 | 反驳是普通 Prompt 要求，还是后续事件机制处理 |
| 总结动作 | 用户要求总结后是否立即结束讨论 |
| LLM 分类成本 | 是否每次用户输入都调用一次分类模型 |
| fallback 优先级 | 角色名命中、结束词命中、动作词命中如何排序 |

---

## 8. 迭代完成定义

满足以下条件时，迭代 4 可视为完成：

1. 用户可以在讨论过程中继续输入。
2. 系统能识别用户插话、点名、总结等意图。
3. 点名角色可以影响下一位发言人。
4. 用户要求总结时能进入收束方向。
5. LLM 分类失败时有规则 fallback。
6. 相关逻辑集中在 engine 层。
7. 工程构建和 Lint 通过。
