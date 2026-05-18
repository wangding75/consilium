# 智囊团迭代需求文档包（基于移动端原型重拆版）

本包用于后续正式开发和每个迭代前的需求评审。

## 原型基线

移动端原型包含 5 个主 Tab：`首页 / 讨论 / 会话 / 模板 / 设置`。

| Tab | 原型定位 | 对应迭代 |
|---|---|---|
| 首页 | 发起讨论、填写议题、选择模板、模型策略、最近讨论 | 迭代 1 |
| 讨论 | 多角色讨论流、角色栏、事件卡、邀请卡、输入区 | 迭代 2、3、5、6、7 |
| 会话 | 会话列表、搜索、筛选、恢复、归档、导出 | 迭代 4、9 |
| 模板 | 模板详情、角色列表、事件规则、节奏配置 | 迭代 8 |
| 设置 | Provider、默认模型、角色模型、模板管理、Prompt、安全 | 迭代 9 |

## 文档列表

| 文件 | 内容 |
|---|---|
| `00-revised-iteration-plan.md` | 重新拆分后的迭代总览 |
| `iteration-0-scaffold-module-skeleton.md` | 项目脚手架与模块骨架代码 |
| `iteration-1-home-session-creation.md` | 首页与创建讨论会话 |
| `iteration-2-multi-agent-runtime-baseline.md` | 多 Agent 运行时基础架构 |
| `iteration-3-discussion-message-ui.md` | 讨论页消息流与前后端联动 |
| `iteration-4-discussion-state-session-lifecycle.md` | 状态机与会话生命周期 |
| `iteration-5-user-intervention-command-system.md` | 用户介入与快捷指令 |
| `iteration-6-director-invitation-conclusion.md` | 导演逻辑、邀请与收束 |
| `iteration-7-sparkle-events-voting.md` | 爽点事件、投票与冲突机制 |
| `iteration-8-template-role-model-strategy.md` | 模板、角色与模型策略 |
| `iteration-9-settings-provider-data-closure.md` | 设置、Provider、数据闭环 |

## 使用方式

每进入一个迭代前，先基于对应文档做需求评审：

1. 产品范围是否仍与原型一致。
2. 前端页面是否覆盖原型关键交互。
3. 后端/API/引擎能力是否满足页面联动。
4. 验收标准是否可测试。
5. 是否有超出本迭代范围的功能被误加入。

## 开发原则

- 迭代 0 必须先完成模块骨架，不只做空项目。
- 后续迭代必须在既有模块上补充能力，不能重新散落实现。
- 前端需求、后端/API需求、引擎需求必须同步评审。
- 原型中的页面结构和关键交互是 UI 验收基线。
- 多 Agent 讨论能力是核心，不允许被配置页开发挤占主线。
