# 迭代 6：导演逻辑、邀请与收束

> 评审日期：2026-05-20  
> 评审结论：通过。导演逻辑继续作用于当前 session 的讨论详情页；本修订移除对“讨论”一级 Tab 的依赖，并明确阶段变化以轻量提示/主持人消息体现。  
> 修订来源：底部导航架构调整评审。  
> 导航基线：底部一级导航为 `首页 / 会话 / 模板 / 设置`；讨论页保留为 `/discussion/[sessionId]` 会话详情页，不作为一级 Tab。  
> 复评日期：2026-05-22  
> 复评结论：通过。最终需求与项目蓝图、当前导航基线及迭代 0-5 已完成能力无方向背离；本次补充 Director API 契约、邀请响应结构、收束状态规则、trigger_event 边界和测试要求，无需更新蓝图。

---

## 迭代目标

实现导演逻辑，使系统能主动控制讨论节奏：判断何时继续、何时邀请用户、何时制造冲突、何时收束总结。

本迭代解决“角色机械轮流发言”的问题。

## 前置依赖与入口约束

| 约束 | 说明 |
|---|---|
| 路由形态 | 邀请、收束、总结全部发生在 `/discussion/[sessionId]` 当前会话内 |
| 入口来源 | 首页创建/最近讨论或会话页恢复后进入，不存在独立“讨论”Tab |
| 状态来源 | Director 决策必须绑定当前 session state 和 message history |
| 返回路径 | 总结完成后的“查看会话”返回会话页，“继续追问”停留在当前讨论详情页 |

## 原型映射

| 原型区域 | 本迭代要求 |
|---|---|
| 邀请卡 | 展示主持人邀请用户参与 |
| 讨论详情页更多操作 | 支持当前 session 总结当前结论 |
| 角色栏 | 体现主持人控场和当前发言人 |
| 消息流 | 主持人可开场、转场、总结 |
| 会话状态 | 收束后会话可进入 completed |

## 前端需求

| 编号 | 需求 |
|---|---|
| FE-001 | 实现 InviteCard，展示邀请说明和操作按钮 |
| FE-002 | 用户可选择回应邀请或跳过 |
| FE-003 | 主持人消息支持开场、转场、总结样式 |
| FE-004 | 讨论收束时展示最终总结卡或主持人总结消息 |
| FE-005 | 更多操作中“总结当前结论”可真实触发总结 |
| FE-006 | 讨论阶段变化通过主持人转场/总结消息或轻量系统提示体现，不新增独立阶段评估面板 |
| FE-007 | 邀请用户后输入区高亮提示 |
| FE-008 | 用户跳过邀请后讨论继续推进 |
| FE-009 | 主持人总结完成后提供返回首页、查看会话页、继续追问当前 session 入口 |
| FE-010 | 导演动作失败时有明确错误反馈 |

## 后端/API/引擎需求

| 编号 | 需求 |
|---|---|
| BE-001 | 实现 DirectorService / director.ts |
| BE-002 | Director 输出动作：continue、invite_user、conclude、trigger_event |
| BE-003 | 支持邀请判断：出现分歧、角色质疑用户、讨论分叉、接近收束 |
| BE-004 | 支持收束判断：达到轮次上限、用户要求总结、角色达成共识 |
| BE-005 | 支持主持人总结生成 |
| BE-006 | 支持 `POST /api/discussions/:sessionId/director/next` |
| BE-007 | 支持 `POST /api/discussions/:sessionId/invitations/:id/respond` |
| BE-008 | 保存 DirectorDecision 记录，包含 reasoning 和 action |
| BE-009 | Director 与 StateMachine 集成，状态推进符合规则 |
| BE-010 | Director 与 Scheduler 集成，决定是否继续生成角色发言 |

## Director 决策矩阵

| 条件 | 动作 |
|---|---|
| 开场消息少于阈值 | continue |
| 最近消息存在明显分歧 | invite_user 或 trigger_event |
| 用户发出总结/结束信号 | conclude |
| 讨论轮次达到上限 | conclude |
| 角色连续同意，无明显新信息 | conclude |
| 出现分叉方案 | invite_user |

## 验收标准

| 类型 | 标准 |
|---|---|
| 产品 | 讨论过程中系统能主动邀请用户参与 |
| 产品 | 用户回应邀请后，讨论围绕用户输入继续 |
| 产品 | 用户跳过邀请后，讨论可继续推进 |
| 产品 | 用户要求总结时，主持人能输出阶段总结 |
| 产品 | 讨论达到收束条件后，主持人输出最终结论 |
| 产品 | 讨论不再只是固定轮转发言 |
| 技术 | Director 决策模块独立存在 |
| 技术 | DirectorDecision 结构化输出 |
| 技术 | Director 与 StateMachine 集成正确 |
| 技术 | Director 与 Scheduler 集成正确 |
| 技术 | 邀请记录可保存和响应 |
| 技术 | 单元测试覆盖 continue、invite_user、conclude |
| 技术 | e2e 覆盖系统邀请用户和用户回应 |
| 技术 | e2e 覆盖从会话页进入当前 session 后触发邀请和总结 |

## 不包含范围

| 不包含 | 说明 |
|---|---|
| 完整爽点事件检测 | 迭代 7 |
| 复杂语义冲突判断 | 后续 Phase 2 |
| 高级 Prompt 调优 | 后续优化 |

## 需求评审关注点

1. Director 是否有清晰可测试规则。
2. 邀请用户是否不会过度打断。
3. 收束条件是否避免讨论无限循环。
4. 主持人总结是否稳定输出结构化结论。

---

## 需求评审记录（Iteration 6）

> 评审日期：2026-05-22  
> 评审结论：通过。最终需求与项目蓝图、当前导航基线及迭代 0-5 已完成能力无方向背离；无需更新蓝图。  
> 本次评审重点：确认 Director 是讨论节奏控制模块，不直接替代 LLM 生成、IntentClassifier 或 SparkleEventDetector；邀请、收束和总结均绑定有效 `/discussion/[sessionId]`；`trigger_event` 在本迭代只输出事件触发建议，不创建真实 EventRecord，不实现投票交互；最终总结生成成功后再推进 `closing` 和 `completed` 状态，避免“状态已完成但总结失败”。

### Step 3｜初步对齐检查

| 检查项 | 初始需求描述 | 蓝图 / 当前计划定义 | 状态 |
|---|---|---|---|
| 产品主线 | 系统主动判断继续、邀请、制造冲突、收束总结 | 蓝图明确导演逻辑负责继续讨论、邀请用户、触发事件和收束总结 | ✅ 对齐 |
| 导航架构 | 邀请、总结、收束发生在 `/discussion/[sessionId]` 当前会话内 | 当前导航基线为 `首页 / 会话 / 模板 / 设置`，讨论页是携带 sessionId 的会话详情页 | ✅ 对齐 |
| 迭代顺序 | 承接状态机、消息流、用户介入，进入导演控制 | 重拆版计划定义迭代 6 为“导演逻辑、邀请与收束”，位于用户介入之后、爽点事件之前 | ✅ 对齐 |
| Director 职责 | 输出 continue / invite_user / conclude / trigger_event | 蓝图要求 DirectorDecision 结构化输出，基于 phase、turn、messageHistory、分歧关键词、用户结束信号判断 | ✅ 对齐 |
| 与 StateMachine 集成 | Director 决策推进 phase，收束后会话可 completed | 迭代 4 已定义 phase：idle / opening / developing / climax / closing，且 closing 后可标记 completed | ✅ 对齐 |
| 与 IntentClassifier 集成 | 用户要求总结或结束时触发 conclude | 迭代 5 已识别 decide / command，但不实现最终收束；迭代 6 承接该结束信号 | ✅ 对齐 |
| 与 Scheduler 集成 | Director 决定继续发言、邀请用户或主持人总结 | 迭代 2 已预留 Scheduler 扩展口，迭代 5 已要求 Scheduler 消费结构化 hint | ✅ 对齐 |
| 邀请卡 | 系统主动邀请用户参与，用户可回应或跳过 | 蓝图讨论 UI 包含 InviteCard，用户可跳过主持人邀请 | ✅ 对齐 |
| 事件触发 | Director 可输出 trigger_event | 真实事件检测、EventCard、投票提交在迭代 7 | ⚠️ 需限定为“事件建议 / 待处理事件”，不创建真实 EventRecord |
| 总结生成 | 主持人输出阶段总结或最终结论 | 蓝图要求主持人最终收束为可理解、可执行的结论 | ✅ 对齐 |

### Step 4｜需求评审意见

#### 1. 完整性

| 问题 | 评审意见 | 修订建议 |
|---|---|---|
| Director API 契约不足 | 原始需求只列出 `POST /director/next`，没有请求、响应和错误码 | 补充请求字段、`DirectorDecision` 响应结构、生成消息、邀请记录和状态更新结果 |
| 邀请记录结构不明确 | FE 要求 InviteCard，BE 要求保存邀请，但未定义 invitation 数据 | 新增 `InvitationRecord`，包含状态 `pending / responded / skipped / expired`、reason、createdAt、respondedAt |
| 收束状态顺序有风险 | 如果先把 session 标记 completed，再生成总结失败，会造成不可恢复状态 | 规定先生成主持人总结消息，成功后推进 phase 到 `closing`，再标记 session `completed` |
| trigger_event 易越界 | `trigger_event` 容易提前实现迭代 7 的事件检测和投票 | 本迭代只返回 `eventCandidate`，可插入主持人解释或系统提示；真实 EventRecord / Vote API 后置到迭代 7 |
| “继续追问”语义不清 | 总结完成后仍允许继续追问，可能与 completed 冲突 | 继续追问视为显式 resume：保留总结为 checkpoint，将 session 状态恢复为 running，并由 StateMachine 从合适 phase 继续 |
| 邀请频率缺少限制 | 频繁邀请会打断讨论，降低体验 | 增加节流规则：同一 session 连续 N 条消息内不得重复邀请，pending 邀请未处理时不得新建邀请 |

#### 2. 合理性

| 检查点 | 结论 |
|---|---|
| 技术可行性 | 可行。迭代 2 已有 Orchestrator / Scheduler / AgentRuntime，迭代 4 已有 StateMachine，迭代 5 已有 Intent 结果；迭代 6 可以在 engine/service 层新增 DirectorService 并复用既有消息链路。 |
| 产品范围 | 合理。邀请与收束是导演逻辑的最小可见闭环，但必须避免提前实现迭代 7 的真实事件机制。 |
| API 范围 | 可控。新增 `POST /api/discussions/:sessionId/director/next` 与 `POST /api/discussions/:sessionId/invitations/:id/respond` 即可覆盖核心链路。 |
| UI 复杂度 | 中等。InviteCard、输入区高亮、总结卡、继续追问入口都必须复用 DiscussionStore，不能形成组件局部状态。 |
| 测试稳定性 | 需要 MockDirector。自动化测试中 Director 决策必须可预测，不能依赖真实 LLM 的随机判断。 |

#### 3. 一致性

| 对象 | 结论 |
|---|---|
| 与迭代 0 | 对齐。迭代 0 已预留 `engine/director.ts`、讨论页 InviteCard / EventCard 容器和模块边界。 |
| 与迭代 1 | 对齐。所有 Director 行为都发生在创建后的有效 session 内。 |
| 与迭代 2 | 对齐。Director 不重写 AgentRuntime，只通过 Orchestrator / Scheduler 决定后续发言或主持人总结。 |
| 与迭代 3 | 对齐。消息流已预留 InviteCard / EventCard 插槽，本迭代开始产生真实邀请和总结消息。 |
| 与迭代 4 | 对齐。Director 消费 StateMachine phase，并在总结成功后推进 closing / completed。 |
| 与迭代 5 | 对齐。IntentClassifier 负责识别用户“总结 / 结束 / 跳过”等意图，Director 负责执行节奏决策。 |
| 与迭代 7 | 有潜在重叠。trigger_event 只输出候选事件，不创建真实事件卡和投票接口。 |
| 与迭代 8-9 | 对齐。模板事件规则、Provider 设置、导出能力均不进入本迭代。 |

#### 4. 风险点

| 风险 | 等级 | 影响 | 应对 |
|---|---|---|---|
| Director 直接生成所有内容 | P0 | 架构退化，AgentRuntime / HostAgent 职责被绕过 | Director 只输出决策；主持人总结仍通过 HostAgent / AgentRuntime 生成 |
| 收束状态提前完成 | P0 | 总结失败但 session 已 completed | 总结消息生成成功后再更新 phase / session status |
| 邀请过度打断 | P1 | 讨论体验碎片化，用户被频繁打扰 | pending 邀请唯一、邀请冷却、每 session 邀请次数上限 |
| trigger_event 越界 | P1 | 迭代 6 吞掉迭代 7 范围 | 仅返回 eventCandidate，不持久化 EventRecord，不渲染真实投票交互 |
| 与 Intent 结果重复判断 | P1 | “总结当前结论”在 Intent 和 Director 两处重复实现 | Intent 只给 `decide` / `schedulerHint`，Director 做最终 action 判断 |
| Mock 不稳定 | P1 | e2e 难以复现邀请和收束 | 新增 MockDirector，按 message count / phase / explicit signal 返回固定 decision |
| 继续追问状态混乱 | P2 | completed 会话继续发消息后列表状态不一致 | 继续追问必须调用 resume 逻辑，记录 resumedFromSummaryId |

### Step 5｜最终需求修订摘要

| 变更项 | 最终需求 | 原因 |
|---|---|---|
| Director API 契约 | 补充 `POST /api/discussions/:sessionId/director/next` 请求、响应、错误码 | 支撑前后端并行开发、自动化测试和失败处理 |
| DirectorDecision 结构 | 明确 action、reason、confidence、phaseTransition、schedulerHint、eventCandidate | 保证 Director 能被 StateMachine、Scheduler 和 UI 稳定消费 |
| InvitationRecord | 新增邀请记录结构和响应状态 | 支撑 InviteCard、跳过、回应、过期和幂等处理 |
| 收束顺序 | 主持人总结生成成功后，才推进 `closing` 并标记 session `completed` | 避免状态与消息不一致 |
| trigger_event 边界 | 本迭代只产生事件候选，不创建真实 EventRecord / Vote | 避免与迭代 7 范围重叠 |
| 继续追问 | 总结后继续追问视为显式 resume，当前 session 保留 summary checkpoint | 保持“继续追问当前 session”入口可用，同时不丢失已完成结论 |
| 测试要求 | 增加 MockDirector、邀请节流、收束状态顺序、session 隔离、e2e 覆盖 | 保证 Director 不是不可测黑盒 |

### 补充 API 契约

#### `POST /api/discussions/:sessionId/director/next`

用于让 Director 基于当前 session state、message history、intent result 和最近调度结果，决定下一步动作。

**Request**

```json
{
  "trigger": "after_agent_message",
  "clientRequestId": "client_director_001",
  "intentResultId": "intent_001",
  "lastMessageId": "msg_123",
  "debug": false
}
```

**Response：continue**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "decisionId": "director_001",
    "decision": {
      "action": "continue",
      "reason": "讨论仍处于 developing 阶段，且至少两个角色尚未充分回应用户新观点。",
      "confidence": 0.82,
      "phaseTransition": null,
      "schedulerHint": {
        "preferredSpeakerId": "simayi",
        "preferredAction": "challenge",
        "reason": "需要补充风险视角"
      },
      "eventCandidate": null
    },
    "activeSpeakerId": "simayi",
    "createdMessages": [],
    "invitation": null,
    "sessionStatus": "running"
  },
  "error": null,
  "requestId": "req_director_001"
}
```

**Response：invite_user**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "decisionId": "director_002",
    "decision": {
      "action": "invite_user",
      "reason": "角色已形成两种路线，继续争论前需要用户选择优先方向。",
      "confidence": 0.87,
      "phaseTransition": {
        "from": "developing",
        "to": "climax"
      },
      "schedulerHint": {
        "preferredSpeakerId": "host",
        "preferredAction": "invite_user",
        "reason": "由主持人发起邀请"
      },
      "eventCandidate": null
    },
    "activeSpeakerId": "host",
    "createdMessages": [
      {
        "messageId": "msg_invite_host_001",
        "type": "host",
        "roleId": "host",
        "content": "目前出现两种路线：本地化合作优先，或快速增长优先。你更希望团队优先讨论哪一个方向？",
        "status": "completed"
      }
    ],
    "invitation": {
      "invitationId": "inv_001",
      "status": "pending",
      "reason": "出现分叉方案",
      "prompt": "请选择优先方向，或补充你的判断。"
    },
    "sessionStatus": "running"
  },
  "error": null,
  "requestId": "req_director_002"
}
```

**Response：conclude**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "decisionId": "director_003",
    "decision": {
      "action": "conclude",
      "reason": "用户要求总结当前结论，且主要角色观点已覆盖。",
      "confidence": 0.91,
      "phaseTransition": {
        "from": "climax",
        "to": "closing"
      },
      "schedulerHint": {
        "preferredSpeakerId": "host",
        "preferredAction": "final_summary",
        "reason": "由主持人收束"
      },
      "eventCandidate": null
    },
    "activeSpeakerId": "host",
    "createdMessages": [
      {
        "messageId": "msg_summary_001",
        "type": "host",
        "roleId": "host",
        "renderType": "final_summary",
        "content": "本轮结论：建议先以本地化合作建立信任，再用小规模增长实验验证获客成本……",
        "status": "completed",
        "metadata": {
          "summaryType": "final",
          "sections": ["共识", "分歧", "建议", "下一步"]
        }
      }
    ],
    "invitation": null,
    "sessionStatus": "completed"
  },
  "error": null,
  "requestId": "req_director_003"
}
```

**Response：trigger_event 边界**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "decisionId": "director_004",
    "decision": {
      "action": "trigger_event",
      "reason": "最近多轮讨论出现明显正反阵营，建议后续触发站队事件。",
      "confidence": 0.78,
      "phaseTransition": {
        "from": "developing",
        "to": "climax"
      },
      "schedulerHint": {
        "preferredSpeakerId": "host",
        "preferredAction": "explain_event_candidate",
        "reason": "本迭代只解释事件候选，不创建真实事件"
      },
      "eventCandidate": {
        "eventType": "camp",
        "title": "出现两派立场",
        "reason": "角色围绕增长优先与合规优先形成分歧",
        "status": "candidate"
      }
    },
    "activeSpeakerId": "host",
    "createdMessages": [
      {
        "messageId": "msg_event_hint_001",
        "type": "host",
        "roleId": "host",
        "content": "这里已经形成两派立场。下一轮我会先让双方各自补强理由，再推动你做选择。",
        "status": "completed"
      }
    ],
    "invitation": null,
    "sessionStatus": "running"
  },
  "error": null,
  "requestId": "req_director_004"
}
```

#### `POST /api/discussions/:sessionId/invitations/:id/respond`

用于回应或跳过当前 session 内的邀请。该接口必须幂等：同一个 invitation 已经 responded / skipped 后，重复提交不得创建重复消息。

**Request**

```json
{
  "action": "respond",
  "content": "我选择本地化合作优先，但希望保留一个快速增长实验。",
  "clientMessageId": "client_invite_reply_001"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_001",
    "invitation": {
      "invitationId": "inv_001",
      "status": "responded",
      "respondedAt": "2026-05-22T00:00:00.000Z"
    },
    "userMessage": {
      "messageId": "msg_user_invite_001",
      "type": "user",
      "content": "我选择本地化合作优先，但希望保留一个快速增长实验。",
      "status": "completed"
    },
    "directorFollowUp": {
      "action": "continue",
      "activeSpeakerId": "zhuge_liang",
      "reason": "用户已明确优先方向，继续让角色围绕该方向补充执行方案。"
    }
  },
  "error": null,
  "requestId": "req_invite_001"
}
```

**跳过邀请 Request**

```json
{
  "action": "skip",
  "clientMessageId": "client_invite_skip_001"
}
```

**错误码**

| code | 场景 | 前端处理 |
|---|---|---|
| `SESSION_NOT_FOUND` | 会话不存在 | 展示会话不存在，引导返回首页或会话页 |
| `DIRECTOR_DECISION_FAILED` | Director 无法产出有效决策 | 展示“暂时无法判断下一步”，允许重试或继续普通发言 |
| `INVALID_PHASE_TRANSITION` | Director 请求了非法 phase 变化 | 展示错误并保留当前消息流，不更新状态 |
| `INVITATION_NOT_FOUND` | 邀请不存在或不属于当前 session | 隐藏失效 InviteCard，并提示邀请已失效 |
| `INVITATION_ALREADY_HANDLED` | 邀请已回应或跳过 | 不重复提交，刷新当前邀请状态 |
| `SUMMARY_GENERATION_FAILED` | 主持人总结生成失败 | 不标记 completed，允许用户重试总结 |
| `NO_AVAILABLE_AGENT` | 无可调度角色 | 展示生成失败，允许主持人兜底回应 |

### 补充数据结构

#### `DirectorDecision`

```ts
interface DirectorDecision {
  decisionId: string
  sessionId: string
  action: 'continue' | 'invite_user' | 'trigger_event' | 'conclude'
  reason: string
  confidence: number
  phaseTransition?: {
    from: 'idle' | 'opening' | 'developing' | 'climax' | 'closing'
    to: 'idle' | 'opening' | 'developing' | 'climax' | 'closing'
  } | null
  schedulerHint?: {
    preferredSpeakerId?: string | null
    preferredAction: 'continue' | 'challenge' | 'invite_user' | 'stage_summary' | 'final_summary' | 'explain_event_candidate'
    reason: string
  } | null
  eventCandidate?: {
    eventType: 'slap' | 'camp' | 'vote' | 'reverse'
    title: string
    reason: string
    status: 'candidate'
  } | null
  createdAt: string
}
```

#### `InvitationRecord`

```ts
interface InvitationRecord {
  invitationId: string
  sessionId: string
  decisionId: string
  status: 'pending' | 'responded' | 'skipped' | 'expired'
  reason: string
  prompt: string
  createdAt: string
  respondedAt?: string
  responseMessageId?: string
}
```

#### `DiscussionSummaryMetadata`

```ts
interface DiscussionSummaryMetadata {
  summaryType: 'stage' | 'final'
  sections: Array<'背景' | '共识' | '分歧' | '风险' | '建议' | '下一步'>
  sourceMessageIds: string[]
  resumedFromSummaryId?: string
}
```

### 最终对齐验证

| 检查项 | 最终需求 | 蓝图 / 当前计划定义 | 状态 |
|---|---|---|---|
| Director 主线 | Director 输出 continue / invite_user / trigger_event / conclude | 蓝图要求导演逻辑判断继续、邀请、事件和收束 | ✅ 对齐 |
| UI / Engine 边界 | UI 展示 InviteCard / Summary，不执行调度决策 | 蓝图要求 DiscussionEngine 独立于 UI | ✅ 对齐 |
| 与 StateMachine | Director 通过合法 phaseTransition 推进状态 | 迭代 4 已定义状态机和非法转换校验 | ✅ 对齐 |
| 与 Intent | 用户总结 / 结束信号由 Intent 识别，Director 负责执行收束 | 迭代 5 明确总结 / 结束不替代 Director 终局收束 | ✅ 对齐 |
| 与 Scheduler | Director 输出 schedulerHint，由 Scheduler 决定下一位 speaker | 迭代 2 / 5 已要求 Scheduler 可扩展且消费结构化 hint | ✅ 对齐 |
| 邀请用户 | InviteCard 有记录、响应、跳过、幂等处理 | 蓝图支持邀请用户和用户跳过邀请 | ✅ 对齐 |
| 收束总结 | 主持人输出结构化总结，成功后 session completed | 蓝图要求主持人最终收束为可执行结论 | ✅ 对齐 |
| 事件候选 | trigger_event 只输出 candidate，不真实创建 EventRecord | 真实爽点事件在迭代 7 | ✅ 对齐 |
| 导航架构 | 所有能力绑定 `/discussion/[sessionId]` | 当前导航基线不包含“讨论”一级 Tab | ✅ 对齐 |

结论：最终需求与项目蓝图和当前导航基线无方向背离。本次只更新 `iteration-6-director-invitation-conclusion.md`，无需更新 `00-product-blueprint.md`。
