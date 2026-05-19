# 迭代 2 PRD：多 Agent 运行时基础架构

> 迭代目标：建立产品核心智能架构——多 Agent 讨论运行时。完成 Host、Expert、Critic Agent 基础抽象，实现多个角色围绕同一议题串行发言。
>
> 本迭代重点在后端/API/引擎能力，前端只做运行时验证页/基础联动，不做完整消息流高级体验。

---

## 功能概述

本迭代包含以下功能点：

1. **多 Agent 运行时引擎**：实现 DiscussionOrchestrator、Scheduler、AgentRuntime、ContextBuilder 四个核心模块，支持 Host / Expert / Critic 三类 Agent 串行发言。
2. **LLM 客户端封装**：统一 LLM 调用入口，支持 MockLLM（测试）和真实 Provider 两种模式。
3. **讨论 API**：提供获取会话详情、获取消息列表、发送用户消息并触发 Agent 发言三个接口。
4. **讨论页前端基础联动**：展示会话信息、角色栏、消息流，支持用户发消息和基础状态反馈。
5. **Agent 调用日志**：每次 Agent 生成都记录调用元数据，支撑调试和后续复盘。

---

## Functional Requirements

### FR-A 多 Agent 运行时引擎

| 编号 | 功能点 | 优先级 |
|------|--------|--------|
| FR-A-001 | 实现 `AgentProfile`：包含角色身份（roleId/agentType）、人设（persona）、系统提示词（systemPrompt）、模型（model）、温度（temperature）。**输入**：来自模板配置。**输出**：供 AgentRuntime 使用的角色上下文。 | P0 |
| FR-A-002 | 实现 `AgentRuntime`：接收上下文（topic、role prompt、message history），调用 LLMClient，返回 `AgentOutput`（角色 ID、消息类型、内容、元数据）。**异常**：调用失败时抛出可捕获错误，触发 AgentCallLog 失败记录。 | P0 |
| FR-A-003 | 实现 `DiscussionOrchestrator`：统一调度 HostAgent、ExpertAgent、CriticAgent，串行协调一轮讨论。**输入**：sessionId + 用户消息（或空消息触发开场）。**输出**：产生的 Agent 消息列表。**异常**：无可调度角色时返回 `NO_AVAILABLE_AGENT` 错误。 | P0 |
| FR-A-004 | 实现 `Scheduler`（基础串行轮转）：默认规则——新会话时 HostAgent 优先开场；避免同一角色连续发言；一轮讨论至少覆盖 3 个非主持角色；默认串行，一次选一个 speaker。**扩展口**：提供 `selectSpeakers(input: SpeakerSelectionInput): SpeakerSelectionResult` 接口，后续可接入状态机/意图/Director。 | P0 |
| FR-A-005 | 实现 `ContextBuilder`：拼接 topic、template 名称、role systemPrompt、message history，并限制最大历史消息数和最大字符数，防止 token 无限增长。**约束**：Prompt 构造必须在 Engine/Service 层完成，UI 层不得拼接 Prompt。 | P0 |

### FR-B LLM 客户端封装

| 编号 | 功能点 | 优先级 |
|------|--------|--------|
| FR-B-001 | 实现统一 `LLMClient` 入口，支持切换到真实 Provider（OpenAI 兼容接口）。 | P0 |
| FR-B-002 | 实现 `MockLLMClient`：测试环境默认使用，不依赖真实 API Key。对相同输入返回稳定、可预测结果；Host / Expert / Critic 三类 Agent 输出语气和观点有差异；支持模拟失败，验证错误提示和重试流程。 | P0 |

### FR-C 讨论 API

| 编号 | 功能点 | 优先级 |
|------|--------|--------|
| FR-C-001 | `GET /api/sessions/:sessionId`：获取会话详情。**输出**：sessionId、topic、template（id+name）、status、roles 列表（含 agentType/avatar/model）、activeSpeakerId、时间戳。**异常**：会话不存在返回 `SESSION_NOT_FOUND`。 | P0 |
| FR-C-002 | `GET /api/discussions/:sessionId/messages`：获取消息列表。**参数**：limit（默认 50）、before（分页游标）。**输出**：messages 列表（含 messageId/type/roleId/agentType/content/status/createdAt/metadata）、activeSpeakerId、hasMore。**异常**：会话不存在返回 `SESSION_NOT_FOUND`。 | P0 |
| FR-C-003 | `POST /api/discussions/:sessionId/messages`：提交用户消息并触发下一轮 Agent 发言。**输入**：content（用户消息文本）、clientMessageId（幂等 ID）。**输出**：userMessage（已保存的用户消息）、agentMessages（本次触发的 Agent 消息列表）、activeSpeakerId。**异常**：内容为空返回 `MESSAGE_EMPTY`；模板不存在返回 `TEMPLATE_NOT_FOUND`；无可用角色返回 `NO_AVAILABLE_AGENT`；Provider 失败返回 `LLM_PROVIDER_ERROR`；Agent 生成失败返回 `AGENT_GENERATION_FAILED`。 | P0 |

### FR-D Agent 调用日志

| 编号 | 功能点 | 优先级 |
|------|--------|--------|
| FR-D-001 | 每次 Agent 生成（无论成功或失败）都写入 `AgentCallLog`，至少记录：sessionId、runId、agentId、roleId、provider、model、inputSummary、output、durationMs、status（success/failed）、errorCode、errorMessage。 | P0 |

### FR-E 讨论页前端（运行时验证页）

| 编号 | 功能点 | 优先级 |
|------|--------|--------|
| FR-E-001 | 讨论页通过 `sessionId` 加载会话详情（调用 FR-C-001），展示会话标题、模板名称、角色栏（主持人 + 至少 3 个角色）。 | P0 |
| FR-E-002 | 展示消息流：Host 开场消息、多个角色的发言消息（调用 FR-C-002）。消息气泡区分主持人（host）、角色（character）、用户（user）样式。 | P0 |
| FR-E-003 | 当前发言角色在角色栏高亮显示（基于 activeSpeakerId）。 | P1 |
| FR-E-004 | 用户可在输入框发送消息（调用 FR-C-003），发送后展示用户消息和系统生成的 Agent 回应。 | P0 |
| FR-E-005 | Agent 生成中显示 Loading 或 Typing 状态（基础提示即可）。 | P1 |
| FR-E-006 | LLM 或运行时失败时展示明确错误提示，并提供重试入口。 | P1 |
| FR-E-007 | 页面预留 EventCard 和 InviteCard 容器（Mock 占位，不要求真实触发）。 | P2 |
| FR-E-008 | 前端不得直接调用 LLM Provider，必须通过 API / Service / Engine。 | P0 |

---

## Non-Functional Requirements

- **测试隔离**：测试环境默认使用 MockLLM，不依赖真实 API Key，测试结果必须稳定可预测。
- **上下文长度控制**：ContextBuilder 必须限制输入 token，防止超限和无限增长。
- **消息隔离**：消息必须按 sessionId 正确隔离，不同会话数据不互串。
- **可扩展性**：Scheduler 调度接口必须保持可扩展形态，不可把轮转策略写死在 UI 或业务流程中。
- **自研架构**：本迭代默认自研轻量 Agent 编排，不引入 LangGraph / AutoGen / CrewAI 作为主依赖。

---

## 验收标准

| 类型 | 验收条件 |
|------|----------|
| 产品 | 一个会话中能看到主持人和至少 3 个角色 |
| 产品 | 点击开始讨论后，主持人能发出开场消息 |
| 产品 | 多个角色能围绕同一议题输出不同观点（不能全部像同一个人） |
| 产品 | 用户发送消息后，系统能继续生成角色回应 |
| 产品 | Critic 角色能作为可见的风险/反对型角色提出质疑 |
| 产品 | Agent 生成中用户能看到 Loading 或 Typing 状态 |
| 产品 | 生成失败时用户可看到明确错误提示并可重试 |
| 技术 | Orchestrator、Scheduler、AgentRuntime、ContextBuilder 模块存在且职责清晰 |
| 技术 | UI 不直接调用 LLM，必须通过 API / Service / Engine |
| 技术 | 支持 MockLLM 模式，测试环境无需真实 API Key |
| 技术 | MockLLM 输出稳定、可预测，并体现 Host / Expert / Critic 角色差异 |
| 技术 | 消息按 sessionId 正确隔离 |
| 技术 | 每次 Agent 生成都有 AgentCallLog 记录 |
| 技术 | Scheduler 避免同一角色连续发言 |
| 技术 | ContextBuilder 有上下文长度限制 |
| 技术 | 3 个核心 API 返回结构符合需求文档契约 |
| 技术 | 单元测试覆盖 Scheduler 调度逻辑、ContextBuilder、MockLLM 输出、Orchestrator 基础流程 |

---

## Out of Scope

| 不包含 | 说明 |
|--------|------|
| 完整讨论状态机 | 迭代 3 实现 |
| 用户意图识别 | 迭代 4 实现 |
| 导演逻辑 | 迭代 5 实现 |
| 爽点事件真实触发 | 迭代 6 实现 |
| 正式 EventCard / InviteCard 交互 | 迭代 6/7 实现 |
| 讨论页完整消息流高级体验 | 迭代 3 实现 |
| 模板配置 UI / Provider 配置 UI | 后续迭代实现 |
| 隐藏裁判 / 质量评分 Agent | Critic 本迭代只作为可见风险/反对型角色 |
| 并行 Agent 执行 | 仅预留接口，本迭代默认串行 |
