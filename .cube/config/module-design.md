# consilium — Module Design

## Module List
| Module | Path | Purpose | Key Files |
|--------|------|---------|-----------|
| home | `src/modules/home/` | 首页 — 发起讨论入口 | index.tsx, StartDiscussion |
| discussion | `src/modules/discussion/` | 讨论主界面 — 消息流、角色栏、输入区 | index.tsx, MessageList, RoleBar, InputArea |
| sessions | `src/modules/sessions/` | 会话管理 — 列表、搜索、筛选 | index.tsx, SessionList |
| templates | `src/modules/templates/` | 模板详情 — 角色列表、事件规则 | index.tsx, TemplateDetail, RoleList |
| settings | `src/modules/settings/` | 设置 — Provider、模型、Prompt、安全 | index.tsx, ProviderSettings |

## Engine Module
| Component | Path | Purpose |
|-----------|------|---------|
| orchestrator | `src/engine/orchestrator.ts` | 总调度器，协调各子引擎 |
| scheduler | `src/engine/scheduler.ts` | 角色调度，决定下一个发言角色 |
| state-machine | `src/engine/state-machine.ts` | 讨论阶段状态机 (opening→developing→climax→closing) |
| director | `src/engine/director.ts` | 导演逻辑，判断继续/邀请/收束/事件 |
| intent | `src/engine/intent.ts` | 用户意图识别 (interrupt/command/passive) |
| events | `src/engine/events.ts` | 爽点事件检测与触发 (打脸/站队/投票/反转) |
| rhythm | `src/engine/rhythm.ts` | 节奏控制 |

## Server Module
| Component | Path | Purpose |
|-----------|------|---------|
| services | `src/server/services/` | 服务层接口 |
| repositories | `src/server/repositories/` | 仓储层接口 (Mock → 真实 DB) |

## Module Dependencies
```
app/pages → modules/* → engine/* → llm/*
app/api/* → server/services/* → server/repositories/*
modules/* → types/* (shared types)
engine/* → types/* (shared types)
```

## Data Model
| Entity | Purpose | Key Fields |
|--------|---------|------------|
| Template | 讨论模板 | id, name, worldview, roles[], events[], rhythmConfig |
| Role | 角色 | id, name, persona, isHost, systemPrompt |
| Session | 讨论会话 | id, templateId, topic, state, messages[], createdAt |
| Message | 消息 | id, sessionId, roleId, content, type, timestamp |
| DiscussionState | 状态机状态 | stage, turnCount, lastSpeaker, eventFlags |
| LLMConfig | LLM配置 | provider, model, apiKey, baseUrl, temperature |
