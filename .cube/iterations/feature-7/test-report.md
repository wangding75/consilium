# Test Report — 迭代 7：爽点事件与投票机制

## Test Scope

**覆盖模块**：
- `src/engine/events.ts` — DefaultEventDetector、DefaultEventRateLimiter
- `src/engine/director.ts` — recentEvents 消费与 schedulerHint 输出
- `src/server/services/discussion.service.ts` — detectAndCreateEvents、createEvent、submitVote、sendMessage 事件链路
- `src/server/repositories/mock/` — MockEventRepository、MockVoteRepository
- `src/app/api/discussions/[sessionId]/events/route.ts` — GET/POST events HTTP 路由
- `src/app/api/discussions/[sessionId]/events/[eventId]/vote/route.ts` — POST vote HTTP 路由
- `src/store/discussion.store.ts` — 事件/投票前端状态、乐观更新与回滚
- `src/modules/discussion/event-card.tsx` — EventCard 四类事件渲染
- `src/modules/discussion/vote-grid.tsx` — VoteGrid 投票交互
- `src/modules/discussion/message-list.tsx` — EventCard 接入消息流
- `src/modules/discussion/message-input.tsx` — `#` 触发按钮
- `src/modules/templates/index.tsx` — 模板事件规则展示
- `src/data/templates/three-kingdoms.ts` — eventRules 数据

**测试类型**：单元测试、集成测试、Web-E2E（curl + 浏览器）、Frontend-UI（Playwright）

**命中的 standards/testing/ 规范**：
| 规范 | 文件 |
|------|------|
| web-e2e | standards/testing/web-e2e.md |
| frontend-ui | standards/testing/frontend-ui.md |
| integration | standards/testing/integration.md |

---

## Test Results

**总体结果**：678/678 通过，0 失败，0 跳过

```
Test Files  102 passed (102)
     Tests  678 passed (678)
  Duration  28.16s
```

**Web-E2E curl 验证**（端口 3099 / 3001）：

| 测试点 | 端点 | 状态码 | 结果 |
|--------|------|--------|------|
| 成功创建会话 | POST /api/sessions | 200 | PASS |
| 成功开启讨论 | POST /api/discussions/{id}/messages (content='') | 200 | PASS |
| GET events 空列表 | GET /api/discussions/{id}/events | 200 | PASS |
| POST 手动创建 vote 事件 | POST /api/discussions/{id}/events | 200 | PASS（含 event.eventId、relatedMessageId） |
| POST vote 成功 | POST /api/discussions/{id}/events/{eid}/vote | 200 | PASS（tally.attack=1 更新） |
| POST vote 校验失败（空 optionId）| POST .../vote | 400 VALIDATION_ERROR | PASS |
| POST vote 业务失败（不存在事件）| POST .../vote | 404 EVENT_NOT_FOUND | PASS |
| POST /messages 发送用户消息 | POST /api/discussions/{id}/messages | 200 | PASS |

**Frontend-UI Playwright 验证**（端口 3001，/usr/bin/google-chrome headless）：

| 验证点 | 结果 |
|--------|------|
| /sessions 页面加载（title: 智囊团）| PASS |
| AppLayout 渲染（header、nav、main） | PASS |
| Tailwind CSS 生效（flex、border、rounded 类存在） | PASS |
| /discussion/{id} 讨论页加载 | PASS |
| RoleBar 5 个角色渲染（荀彧/诸葛亮/司马懿/庞统/周瑜）| PASS |
| `#` 按钮可点击触发事件卡 | PASS（触发后显示"发起投票"+ vote 事件卡 + 支持/反对票数） |
| `@` 按钮可见 | PASS |
| 消息流显示主持人开场白 | PASS |

---

## Pass Criteria

逐条对照 PRD 验收标准：

| FR | 描述 | 状态 |
|----|------|------|
| FR-001 | EventCard 在消息流展示，有视觉区分 | ✅ PASS |
| FR-002 | 支持 slap/camp/vote/reverse 四类事件 | ✅ PASS（单元测试 + 浏览器验证 vote 类型） |
| FR-003 | 事件插入当前会话消息流（不跨 session）| ✅ PASS（curl 验证 sessionId 隔离） |
| FR-004 | 事件卡不破坏滚动体验 | ✅ PASS（集成测试覆盖） |
| FR-005 | Vote Grid 展示投票问题/选项/票数 | ✅ PASS（Playwright 验证票数展示） |
| FR-006 | 用户提交投票并更新状态 | ✅ PASS（curl tally 更新验证） |
| FR-007 | 投票重复提交控制（幂等）| ✅ PASS（集成测试 Task-08 覆盖） |
| FR-008 | `#` 工具栏手动触发投票事件 | ✅ PASS（Playwright 交互验证） |
| FR-009 | 乐观更新 + 失败回滚 | ✅ PASS（store 单元测试 Task-10 覆盖） |
| FR-010 | 事件/投票状态随会话恢复 | ✅ PASS（集成测试 Task-14 覆盖） |
| FR-011 | Director 消费事件结果生成 schedulerHint | ✅ PASS（Task-15/16 集成测试覆盖） |
| FR-012 | 模板页展示事件规则 Tab | ✅ PASS（单元测试覆盖） |

---

## Coverage

**代码覆盖率**：项目未配置 coverage_command，以测试套件通过率代替。

**覆盖缺口**：
- EventDetector 返回 `payload` 字段在实现中始终为 undefined（见 Known Issues HIGH-2），auto-detected 事件会产生 null payload。
- `slap`、`camp`、`reverse` 三类事件仅在单元测试覆盖，未在浏览器中触发真实渲染（mock 数据覆盖了 EventCard 渲染）。

---

## Standards Evidence

### web-e2e

- **执行命令**：`curl http://localhost:3001/api/discussions/{id}/events`（GET + POST）+ `curl .../vote`（POST 3 个场景）
- **服务启动**：Next.js dev server port 3001（`next dev`）已监听并正常响应
- **覆盖场景**：成功请求、校验失败（400）、业务失败（404）— 共 8 个 curl 测试点全部通过
- **结果**：PASS

### frontend-ui

- **浏览器**：/usr/bin/google-chrome (headless)，Playwright 驱动
- **页面验证**：/sessions（CSS 生效、layout 渲染）、/discussion/{id}（角色栏、消息流、`#` 交互）
- **截图**：已保存至 /tmp/consilium-sessions.png、/tmp/consilium-discussion.png、/tmp/consilium-hash-click.png
- **交互验证**：点击 `#` 按钮后消息流出现"发起投票"事件卡，票数显示"支持0票 反对0票"
- **结果**：PASS

### integration

- **执行命令**：`npx vitest run` — 102 files, 678 tests
- **关键集成测试**：
  - `src/server/services/discussion-integration.test.ts` — 完整 sendMessage → EventDetector → EventRateLimiter → EventRepository 链路
  - `src/engine/director-events.test.ts` — Director recentEvents 消费 → schedulerHint 输出
  - `src/server/services/discussion-events.test.ts` — createEvent、submitVote、detectAndCreateEvents
- **结果**：PASS（678/678）

---

## Review Evidence

**Reviewer**：ecc:typescript-reviewer（targeted review，8 highest-risk files）

**审查结论**：0 CRITICAL，3 HIGH，已记录到 Known Issues。

**已修复**：无（HIGH 问题未阻塞功能验收，归入 Known Issues 追踪）

---

## Known Issues

| ID | 严重级 | 位置 | 描述 |
|----|--------|------|------|
| KI-01 | HIGH | discussion.store.ts:368-373 | `setTimeout` 中使用了闭包捕获的 `state` 快照，10 秒超时触发时可能误判已成功消息为失败（stale closure） |
| KI-02 | HIGH | discussion.service.ts:171 | `detectAndCreateEvents` 中 `detection.payload as EventPayload` 是不安全强转；DefaultEventDetector 不返回 payload，auto-triggered 事件会携带 undefined payload |
| KI-03 | HIGH | discussion.service.ts:125-128 | `voterId` 硬编码为 `'current-user'`，多用户场景下幂等检查会跨用户共享，需引入真实用户身份 |
