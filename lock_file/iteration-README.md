# 迭代需求文档目录

本文档包用于后续逐个迭代进行需求评审和开发落地。

## 迭代列表

| 迭代 | 文档 | 核心目标 |
|---|---|---|
| 迭代 0 | `iteration-0-scaffold-requirements.md` | 项目脚手架与基础代码框架 |
| 迭代 1 | `iteration-1-minimal-discussion-entry.md` | 最小讨论入口 |
| 迭代 2 | `iteration-2-multi-agent-architecture.md` | 多 Agent 讨论架构 |
| 迭代 3 | `iteration-3-discussion-state-machine.md` | 讨论状态机 |
| 迭代 4 | `iteration-4-user-intervention.md` | 用户介入机制 |
| 迭代 5 | `iteration-5-director-logic.md` | 导演逻辑 |
| 迭代 6 | `iteration-6-sparkle-events.md` | 爽点机制 |
| 迭代 7 | `iteration-7-discussion-main-ui.md` | 讨论主界面 |
| 迭代 8 | `iteration-8-template-session-loop.md` | 模板扩展与会话闭环 |

## 使用方式

每个迭代开发前，建议按以下顺序评审：

1. 确认本迭代目标是否仍然成立。
2. 确认产品需求是否需要删减或调整。
3. 确认技术需求是否符合当前代码现状。
4. 确认验收标准是否可测试、可演示。
5. 明确本迭代不做什么，避免范围膨胀。
6. 评审通过后再进入开发。

## 当前阶段边界

当前文档刻意排除了以下内容：

| 暂不纳入 | 原因 |
|---|---|
| 复杂配置 UI | 用户已明确先不考虑配置 UI |
| Sentry、埋点、性能优化 | 属于非功能或产品化阶段 |
| 服务端模板动态下发 | Phase 2 再实现 |
| 多设备同步 | 后续根据用户价值再判断 |
| 用户账号体系 | MVP 阶段不需要 |

## 推荐主线

```text
迭代 0：项目脚手架
-> 迭代 1：固定模板最小讨论
-> 迭代 2：多 Agent 架构
-> 迭代 3：状态机
-> 迭代 4：用户介入
-> 迭代 5：导演逻辑
-> 迭代 6：爽点机制
-> 迭代 7：讨论主界面
-> 迭代 8：模板扩展与会话闭环
```
