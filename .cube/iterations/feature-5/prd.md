# 迭代 5：用户介入与快捷指令系统 PRD

## 1. 功能概述

本迭代在有效会话详情页 `/discussion/[sessionId]` 内实现用户主动介入讨论的能力。用户可以输入普通观点，也可以通过快捷工具栏或快捷指令 Sheet 填入指令，要求指定角色回应、反驳、阶段性总结、识别投票意图或记录结束信号。

本迭代的核心目标是让用户从“旁观者”变成“可影响讨论进程的决策者”：用户输入需要被识别为结构化意图，并真实影响后续 Scheduler 调度，而不是只改变前端展示。

本迭代包含以下功能点：

1. 讨论页 Composer 普通输入与快捷指令填入。
2. 快捷指令 Sheet 展示并填入常用指令。
3. 用户输入意图识别，覆盖 interrupt、command、decide、passive。
4. `POST /api/discussions/:sessionId/intent` 返回结构化 IntentResult。
5. Scheduler 消费 `schedulerHint`，优先调度目标角色或主持人。
6. 消息流区分普通用户发言与指令型用户消息。
7. 解析 Loading、不可识别/失败提示、目标角色高亮与调试模式摘要。
8. 直接刷新或访问 `/discussion/[sessionId]` 时恢复当前会话上下文后再允许介入。

## 2. Functional Requirements

### 2.1 入口与会话约束

#### FR-001 有效 session 入口约束（P0）

- 功能点描述：所有用户介入能力必须发生在有效 `/discussion/[sessionId]` 内。
- 输入：用户从首页创建会话、首页最近讨论、会话页会话卡片，或直接访问 `/discussion/[sessionId]`。
- 输出：系统加载当前 session 的模板、角色、消息、状态机状态和当前 active speaker；BottomNav 固定为 `首页 / 会话 / 模板 / 设置`。
- 异常处理：
  - sessionId 不存在时展示“会话不存在”提示，并引导返回首页或会话页。
  - session 状态不可操作时展示“当前会话不可继续操作或需要恢复”的提示。
  - 不允许通过无 sessionId 的一级“讨论”入口进入默认讨论页；必须移除 BottomNav 中的“讨论”一级 Tab。

#### FR-002 会话隔离（P0）

- 功能点描述：用户输入、意图识别结果、角色高亮和调度结果必须绑定当前 sessionId。
- 输入：当前 sessionId 与用户输入内容。
- 输出：仅当前会话的消息流、activeSpeaker 与调度上下文被更新。
- 异常处理：如果请求中的 sessionId 与当前加载会话不一致，系统不得更新 UI 或调度状态，并提示会话上下文异常。

### 2.2 Composer 输入与快捷指令

#### FR-003 普通观点输入（P0）

- 功能点描述：用户可在讨论页 Composer 输入普通观点、补充信息或问题。
- 输入：用户输入的非空文本。
- 输出：用户原文作为 user message 进入当前消息流；系统识别为 interrupt 或 passive 后自然调度下一位角色回应。
- 异常处理：输入为空时不提交，提示“请输入内容”。

#### FR-004 @ 快捷点名角色指令（P0）

- 功能点描述：用户点击工具栏 @ 后，可快速填入“让某角色回应/反驳”的指令。
- 输入：点击 @ 或从快捷指令中选择点名角色类命令，例如“让诸葛亮反驳一下”。
- 输出：输入框填入对应指令，用户仍需点击发送；发送后系统识别目标角色和动作。
- 异常处理：如果目标角色不存在，提示“当前模板无该角色”；如果目标角色歧义，提示用户明确角色。

#### FR-005 # 投票意图快捷指令（P1）

- 功能点描述：用户点击工具栏 # 后，可填入投票类指令。
- 输入：点击 # 或选择“触发投票 / 现在投票，并说明各自理由”。
- 输出：输入框填入投票类指令；发送后系统识别 `eventType=vote`，并返回 deferred 执行状态。
- 异常处理：本迭代不创建真实投票卡、不记录票数；如果指令超出当前能力，提示“投票事件将在后续迭代完整支持”。

#### FR-006 总结快捷指令（P0）

- 功能点描述：用户点击工具栏总结按钮后，可填入“总结当前结论”类指令。
- 输入：点击总结按钮或选择“总结一下，给出最终建议”。
- 输出：输入框填入总结指令；发送后系统统一识别为 `type=decide` + `target.action=summarize`，并优先调度主持人进行阶段性总结回应。
- 异常处理：如果当前会话消息不足以总结，提示“当前信息不足，请先继续讨论”。

#### FR-007 快捷指令 Sheet（P1）

- 功能点描述：讨论页更多按钮可打开快捷指令 Sheet，展示常用指令。
- 输入：用户打开 Sheet 并点击任一快捷指令。
- 输出：Sheet 关闭，指令文本填入 Composer 输入框并聚焦。
- 异常处理：如果当前会话不可操作，快捷指令不可发送，并提示当前状态不可继续介入。

### 2.3 意图识别与 API

#### FR-008 Intent API（P0）

- 功能点描述：系统提供 `POST /api/discussions/:sessionId/intent`，识别用户输入并返回结构化结果。
- 输入：
  - `content`：用户输入原文。
  - `clientMessageId`：客户端消息 ID，可选但推荐传入。
  - `debug`：是否返回调试摘要。
- 输出：统一 API 响应格式，data 内包含 sessionId、clientMessageId、intent、activeSpeakerId。
- 异常处理：
  - session 不存在返回 `SESSION_NOT_FOUND`。
  - content 为空返回 `MESSAGE_EMPTY`。
  - 分类失败返回 `INTENT_CLASSIFICATION_FAILED`，前端必须提示用户，并提供“改写指令”或“按普通发言继续”两个显式选择，不自动降级为普通发言。

#### FR-009 Intent 类型识别（P0）

- 功能点描述：IntentClassifier 识别用户输入为 interrupt、command、decide 或 passive。
- 输入：用户文本、当前模板角色列表、当前 session 上下文。
- 输出：IntentResult 包含 type、confidence、rawText、target、schedulerHint、execution。
- 异常处理：LLM 分类失败时使用关键词/角色别名/动作词规则兜底；兜底仍失败时允许降级为普通 interrupt 或返回可解释错误。

#### FR-010 命令目标识别（P0）

- 功能点描述：command/decide 类输入需要识别目标角色、目标动作、目标事件或参考角色。
- 输入：例如“让诸葛亮反驳一下曹操的增长优先观点”“触发投票”“结束讨论”。
- 输出：CommandTarget 包含 roleId、action、eventType、referenceRoleId。
- 异常处理：
  - 未找到角色返回 `ROLE_NOT_FOUND`。
  - 目标角色或动作歧义返回 `AMBIGUOUS_TARGET`。
  - 指令超出当前能力返回 `UNSUPPORTED_COMMAND`。

#### FR-011 Mock 与 LLM 分类模式（P1）

- 功能点描述：IntentClassifier 支持 Mock 模式和 LLM 模式，自动化测试默认使用 Mock 模式。
- 输入：分类模式配置与用户输入。
- 输出：Mock 模式对常见指令稳定返回；LLM 模式可在配置可用时启用。
- 异常处理：LLM 请求失败、超时或返回不可解析结果时，系统切换到规则兜底，不阻塞用户继续讨论。

#### FR-012 调试模式摘要（P2）

- 功能点描述：调试模式下，用户可查看意图识别摘要。
- 输入：Intent API 请求 `debug=true` 或前端开启调试模式。
- 输出：展示 classifierMode、matchedRule、confidence、intent type、target 与 schedulerHint 摘要。
- 异常处理：调试信息不得返回完整 Prompt、API Key、Provider 请求体或敏感日志。

### 2.4 消息流与用户反馈

#### FR-013 用户消息入流（P0）

- 功能点描述：用户原文发送后仍作为 user message 进入当前消息流。
- 输入：用户发送的普通观点或指令文本。
- 输出：消息流追加用户消息；指令型消息通过 metadata.intent 标记并展示“指令”标签或等价视觉区分。
- 异常处理：消息追加失败时展示发送失败提示，并允许重试。

#### FR-014 解析 Loading 状态（P1）

- 功能点描述：用户发送输入后，系统在意图识别期间展示 Loading 状态。
- 输入：用户点击发送。
- 输出：Composer 或消息流展示“正在识别意图/正在解析指令”等状态，完成后消失。
- 异常处理：识别失败时 Loading 结束并展示可解释错误，不静默失败。

#### FR-015 不可识别指令提示（P0）

- 功能点描述：当用户输入看起来像指令但系统无法识别时，必须明确提示。
- 输入：无法匹配的指令文本。
- 输出：提示用户当前支持的基础指令，并提供“改写指令”或“按普通发言继续”两个显式操作；系统不得自动降级为普通发言。
- 异常处理：不得丢弃用户原文；不得让用户误以为指令已经生效。

#### FR-016 目标角色高亮（P0）

- 功能点描述：当用户点名某角色并识别成功后，角色栏高亮目标角色。
- 输入：IntentResult 中的 `schedulerHint.preferredSpeakerId` 或 activeSpeakerId。
- 输出：角色栏中对应角色进入 active/highlight 状态，用户能感知下一轮由该角色回应。
- 异常处理：如果 preferredSpeakerId 不属于当前 session 模板角色，不高亮并提示会话角色不匹配。

### 2.5 Scheduler 调度影响

#### FR-017 Scheduler 消费 schedulerHint（P0）

- 功能点描述：Scheduler 必须消费 IntentResult.schedulerHint，决定下一位发言角色或主持人。
- 输入：当前 session 状态、角色列表、消息历史、IntentResult.schedulerHint。
- 输出：点名角色时优先调度该角色；总结/投票/结束类指令优先调度主持人或返回 deferred/unsupported 执行状态。
- 异常处理：如果目标角色不可用，Scheduler 不应盲目调度，应返回可解释错误或回退到普通调度策略。

#### FR-018 普通观点自然调度（P0）

- 功能点描述：用户发送普通观点后，系统根据当前讨论状态选择合适角色回应。
- 输入：普通观点文本与当前 session 上下文。
- 输出：Intent 类型为 interrupt 或 passive，Scheduler 选择相关角色或按既有策略推进。
- 异常处理：如果无法判断最佳角色，回退到现有调度策略，而不是阻塞讨论。

#### FR-019 总结与结束边界（P0）

- 功能点描述：总结/结束类指令只在本迭代完成识别和基础调度，不实现最终 Director 收束。
- 输入：“总结当前结论”“结束讨论”等文本。
- 输出：“总结当前结论”触发主持人阶段性总结回应；“结束讨论”记录结束信号或返回可解释执行状态。
- 异常处理：不得直接把 session 标记为 completed；不得替代迭代 6 Director 终局收束职责。

#### FR-020 投票边界（P0）

- 功能点描述：投票类指令只识别投票意图和生成调度提示。
- 输入：“触发投票”“现在投票”等文本。
- 输出：IntentResult target.eventType 为 vote，execution.status 为 deferred；消息流追加轻量 system message：`已识别投票意图；本迭代暂不创建真实投票卡，将由主持人先回应并继续讨论。`；Scheduler 可让主持人解释投票请求。
- 异常处理：不得创建真实 EventCard、投票接口、票数状态或 EventRecord。

## 3. Non-Functional Requirements

### NFR-001 可测试性（P0）

IntentClassifier、规则兜底、Scheduler 消费 schedulerHint、session 隔离必须独立于 React UI，可通过单元测试和 API 测试验证。

### NFR-002 稳定性（P0）

LLM 分类失败、超时或返回异常时，不得阻塞用户继续讨论；系统必须使用规则兜底或允许按普通发言继续。

### NFR-003 安全与隐私（P0）

调试模式不得返回完整 Prompt、API Key、Provider 请求体、系统提示词或敏感日志。用户输入展示在消息流中时必须避免 HTML 注入风险。

### NFR-004 会话一致性（P0）

IntentResult、消息、activeSpeaker、高亮状态和 Scheduler 调度必须绑定同一 sessionId，避免跨会话串扰。

### NFR-005 兼容性（P1）

刷新或直接访问 `/discussion/[sessionId]` 时，系统应恢复会话上下文，并在恢复完成后允许用户继续输入和发送快捷指令。

### NFR-006 体验反馈（P1）

意图解析应有明确 Loading 与成功/失败反馈；失败提示应可理解，并给出用户下一步可执行动作。

## 4. 验收标准

### FR-001 / FR-002 验收

- 从首页创建会话后进入 `/discussion/[sessionId]`，可发送普通观点和快捷指令。
- 从首页最近讨论或会话页会话卡片进入 `/discussion/[sessionId]`，可恢复当前会话上下文并继续介入。
- 直接访问不存在的 sessionId 时，展示会话不存在提示，不进入默认讨论。
- BottomNav 固定为 `首页 / 会话 / 模板 / 设置`，不存在“讨论”一级 Tab。
- A 会话的指令结果不会改变 B 会话的 activeSpeaker 或消息流。

### FR-003 验收

- 用户输入普通观点并发送后，消息流出现 user message。
- 普通观点不会展示为指令标签。
- 系统选择合适角色或按既有调度策略回应。
- 空输入不发送，并提示“请输入内容”。

### FR-004 / FR-005 / FR-006 / FR-007 验收

- 点击 @ 可填入点名/反驳类指令。
- 点击 # 可填入投票类指令。
- 点击总结按钮可填入总结类指令。
- 打开快捷指令 Sheet 后，点击“让诸葛亮反驳一下”等指令会填入输入框并聚焦。
- 快捷指令填入不会自动发送，用户需要点击发送。

### FR-008 / FR-009 / FR-010 验收

- `POST /api/discussions/:sessionId/intent` 对有效输入返回统一响应格式。
- “我觉得应该先做欧美市场”被识别为 interrupt 或普通介入。
- “让诸葛亮反驳一下”被识别为 command，target.roleId 为诸葛亮对应角色，action 为 rebut。
- “总结当前结论”被识别为 `type=decide` + `target.action=summarize`。
- “触发投票”被识别为 command，target.eventType 为 vote，execution.status 为 deferred。
- 空输入、无效 session、角色不存在、目标歧义、不支持命令均返回可解释错误。

### FR-011 验收

- MockIntentClassifier 对点名、反驳、总结、投票、普通观点、不可识别输入稳定返回。
- LLM 分类失败时关键词规则兜底生效。
- 自动化测试默认不依赖真实 LLM。

### FR-012 验收

- debug=true 时返回 classifierMode、matchedRule、confidence 等摘要信息。
- debug=true 时不返回 Prompt、API Key、Provider 请求体或敏感日志。

### FR-013 / FR-014 / FR-015 验收

- 指令型用户输入作为 user message 进入消息流，并有“指令”类视觉区分。
- 意图识别期间有 Loading 状态。
- 不可识别指令展示明确提示，并提供“改写指令”或“按普通发言继续”两个显式操作；系统不会自动降级为普通发言。
- 指令失败不会静默失败，也不会让用户误以为已影响调度。

### FR-016 / FR-017 / FR-018 验收

- 发送“让诸葛亮反驳一下”后，诸葛亮成为下一位发言者，并在角色栏高亮。
- Scheduler 输入包含 intent / schedulerHint，而不是由 UI 直接指定 speaker。
- 普通观点发送后，系统自然选择相关角色或回退到既有调度策略。

### FR-019 / FR-020 验收

- 发送“总结当前结论”后，主持人进入阶段性总结响应。
- 发送“结束讨论”不会直接把 session 标记为 completed。
- 发送“触发投票”后，消息流追加轻量 system message：`已识别投票意图；本迭代暂不创建真实投票卡，将由主持人先回应并继续讨论。`，但不出现新的真实投票卡、不创建投票接口状态或 EventRecord。

### 端到端验收

- e2e 覆盖从首页创建会话进入 `/discussion/[sessionId]`，使用 @ 快捷指令点名角色回应。
- e2e 覆盖从会话页恢复 session 后发送“让诸葛亮反驳一下”，下一位发言角色高亮为诸葛亮。
- e2e 覆盖发送“触发投票”后展示投票意图已识别但不出现真实投票卡。
- e2e 覆盖不可识别指令提示，并提供“改写指令”或“按普通发言继续”两个显式操作。

## 5. Out of Scope

- 不实现邀请用户的自动时机判断，该能力属于迭代 6。
- 不实现 Director 最终收束、自动邀请、最终总结或 completed 状态变更，该能力属于迭代 6。
- 不实现真实投票事件、EventCard 创建、投票接口、票数状态或 EventRecord，该能力属于迭代 7。
- 不实现打脸、站队、反转等真实爽点事件触发，该能力属于迭代 7。
- 不实现 Provider 配置页面、模型配置 UI、Prompt 配置 UI 或 API Key 管理，该能力属于迭代 9。
- 不新增无 sessionId 的讨论一级 Tab；BottomNav 必须固定为 `首页 / 会话 / 模板 / 设置`，讨论详情页仍是携带 sessionId 的会话详情页。
- 不把 IntentClassifier 写入 React 组件；UI 不承担分类、Prompt 拼接或直接调度 speaker 的职责。

## 6. 依赖说明

- 依赖迭代 3 已完成的讨论页消息流、Composer、角色栏和消息发送链路。
- 依赖迭代 4 已完成的 session 生命周期、状态恢复和 `/discussion/[sessionId]` 会话详情入口。
- 依赖现有模板角色数据，至少包含主持人、诸葛亮、曹操、司马懿、荀彧等可被点名角色。
- 依赖现有 API 响应格式：`{ success, data, error, requestId }`。
