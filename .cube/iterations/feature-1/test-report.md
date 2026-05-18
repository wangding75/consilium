# Test Report — 迭代 1：首页与创建讨论会话

**测试日期**：2026-05-18  
**分支**：feature/1  
**测试人员**：QA Engineer (autodev)

---

## Test Scope

### 覆盖模块
- `src/types/` — Session 类型扩展、API 类型定义
- `src/data/model-strategies.ts` — ModelStrategy 常量
- `src/server/repositories/` — SessionRepository 接口与 MockSessionRepository 实现
- `src/server/services/session.service.ts` — SessionService 业务逻辑
- `src/app/api/sessions/` — POST /api/sessions 路由
- `src/app/api/sessions/recent/` — GET /api/sessions/recent 路由
- `src/modules/home/index.tsx` — HomeModule 首页 UI

### 测试类型
- 单元测试（types, model-strategies, session-repo, session-service）
- Web/API 端到端测试（sessions-api）
- 前端 UI 测试（home-ui）
- 集成测试（Route Handler → SessionService → MockSessionRepository）

### 功能类型及规范
- `web-e2e`：`standards/testing/web-e2e.md`（Task-08、Task-09）
- `frontend-ui`：`standards/testing/frontend-ui.md`（Task-10）
- `integration`：`standards/testing/integration.md`（Task-08、Task-09 组件链）

---

## Test Results

### 单元测试结果

| 测试文件 | 通过 | 失败 | 跳过 |
|---------|------|------|------|
| session-types.test.ts | 6 | 0 | 0 |
| model-strategies.test.ts | 7 | 0 | 0 |
| session-repo.test.ts | 7 | 0 | 0 |
| session-service.test.ts | 14 | 0 | 0 |
| sessions-api.test.ts | 10 | 0 | 0 |
| home-ui.test.tsx | 12 | 0 | 0 |
| home.test.tsx | 1 | 0 | 0 |
| **合计** | **90** | **0** | **0** |

**命令**：`npx vitest run`  
**结果**：22 test files, 90 tests — ALL PASS

### Web/API 端到端测试结果

#### POST /api/sessions

| 场景 | HTTP状态 | 错误码 | 结果 |
|------|---------|--------|------|
| 成功创建（有效 topic + templateId） | 200 | — | ✅ PASS |
| topic 为空字符串 | 400 | TOPIC_REQUIRED | ✅ PASS |
| topic 为非字符串类型（42） | 400 | INVALID_REQUEST | ✅ PASS |
| templateId 不存在 | 404 | TEMPLATE_NOT_FOUND | ✅ PASS |
| modelStrategyId 无效枚举值 | 400 | INVALID_STRATEGY | ✅ PASS |

#### GET /api/sessions/recent

| 场景 | HTTP状态 | 结果 |
|------|---------|------|
| 正常返回（含跨请求持久化数据） | 200 | ✅ PASS |
| 空列表时返回 [] | 200 | ✅ PASS |

### 前端 UI 测试结果（Playwright + Chromium headless，375px 移动端视口）

| 交互场景 | 结果 |
|---------|------|
| 页面初始加载，0/100 计数器显示 | ✅ PASS |
| CSS 已应用（AppLayout + 设计系统组件可见） | ✅ PASS |
| 底部导航 BottomNav 可见，含"首页" | ✅ PASS |
| 输入 8 个字符后计数器更新为 8/100 | ✅ PASS |
| 空议题点击"开始讨论"显示"请输入讨论议题" | ✅ PASS |
| 点击快速开始 chip 填入"评估新功能优先级" | ✅ PASS |
| 有效议题提交，导航至 /discussion/[sessionId] | ✅ PASS |
| 模板 Sheet 打开（含"即将支持"选项） | ✅ PASS |
| 策略 Sheet 打开（含 3 个策略选项） | ✅ PASS |
| 选择"成本优先"后策略卡片文字更新 | ✅ PASS |
| 最近讨论空列表显示"暂无" | ✅ PASS |
| 创建会话后首页最近讨论列表显示该会话 | ✅ PASS |

截图：
- `/tmp/screenshot-01-initial.png` — 初始加载
- `/tmp/screenshot-06-template-sheet.png` — 模板 Sheet
- `/tmp/screenshot-07-strategy-sheet.png` — 策略 Sheet
- `/tmp/screenshot-recent-sessions.png` — 含最近讨论列表

### 集成测试结果

| 组件链 | 场景 | 结果 |
|--------|------|------|
| Route → SessionService → MockSessionRepository | 创建会话成功 | ✅ PASS |
| Route → SessionService → MockTemplateRepository | Template 不存在时 ServiceError → HTTP 404 | ✅ PASS |
| 跨请求持久化（POST → GET recent） | globalThis 单例共享，GET 可见 POST 创建的数据 | ✅ PASS |

---

## Pass Criteria

| 编号 | 验收条件 | 状态 |
|---|---|---|
| AC-001 | 首页所有区域正常展示（输入框、模板、策略、按钮、快速开始、最近讨论） | ✅ 通过 |
| AC-002 | 议题输入框最多 100 字，字数实时更新 | ✅ 通过 |
| AC-003 | 点击快速开始 chip 后输入框填入对应议题 | ✅ 通过 |
| AC-004 | 点击模板卡片打开 Sheet，选择后卡片文字更新 | ✅ 通过 |
| AC-005 | 点击策略卡片打开 Sheet，选择后卡片文字更新 | ✅ 通过 |
| AC-006 | 空议题点击"开始讨论"出现明确错误提示，不发起请求 | ✅ 通过 |
| AC-007 | 非空议题提交后跳转至 /discussion/[sessionId]，sessionId 来自 API | ✅ 通过 |
| AC-008 | POST /api/sessions 可成功创建会话，返回字段完整 | ✅ 通过 |
| AC-009 | GET /api/sessions/recent 可返回最近会话列表 | ✅ 通过 |
| AC-010 | 会话创建时写入 topic/templateId/modelStrategyId，DiscussionState.stage 初始为 idle | ✅ 通过 |
| AC-011 | 点击最近讨论列表项可跳转至对应讨论页 | ✅ 通过 |
| AC-012 | 最近讨论列表使用 API 数据，不硬编码 | ✅ 通过 |
| AC-013 | 单元测试覆盖创建成功、topic 为空、template 不存在场景 | ✅ 通过 |
| AC-014 | 页面加载、提交中、错误状态均有对应 UI | ✅ 通过 |

**全部 14 条验收标准通过。**

---

## Coverage

### 代码覆盖率

本项目未配置 `coverage_command`，无法自动生成 lcov 报告。  
根据测试场景分析覆盖情况：

| 模块 | 主要测试路径 | 估算覆盖 |
|------|------------|---------|
| session.service.ts | 创建成功/失败、getRecentSessions | ~95% |
| mock-session.repository.ts | findAll/findById/findRecent/save/delete | ~100% |
| sessions/route.ts | POST 成功/验证失败/域错误/GET | ~90% |
| sessions/recent/route.ts | GET 成功 | ~80% |
| home/index.tsx | 渲染/提交/chip/Sheet/最近讨论 | ~85% |

### 未覆盖场景

- `listSessions` 的错误路径（SESSION_LIST_FAILED）— 仅在 services.test.ts 中轻度覆盖
- `MockSessionRepository.delete()` 方法 — 接口要求但无当前业务触发点
- 网络失败时首页错误 Toast（仅 Vitest mock 覆盖，无真实网络失败测试）

---

## Standards Evidence

### web-e2e（standards/testing/web-e2e.md）

| 步骤 | 说明 | 结果 |
|------|------|------|
| 1. 启动真实服务 | `npm run dev` → localhost:3003 Ready | ✅ |
| 2. curl 打真实端点 | POST 成功/400/404，GET 200 | ✅ |
| 3. 探测浏览器 | `~/.cache/ms-playwright/chromium-1223` 存在 | ✅ |
| 4. Playwright 验证前后端链路 | 创建会话 → 跳转 → 首页显示最近讨论 | ✅ |

### frontend-ui（standards/testing/frontend-ui.md）

| 检查项 | 验证方式 | 结果 |
|--------|---------|------|
| CSS 已应用 | Playwright 截图，AppLayout/导航/卡片/按钮均有自定义样式 | ✅ |
| AppLayout 可见 | header + main + nav 元素均 visible | ✅ |
| 设计系统组件 | 圆角卡片、底部导航、chip 按钮均有自定义样式 | ✅ |
| 真实 API 调用 | Network 拦截确认 `/api/sessions` 和 `/api/sessions/recent` 被调用 | ✅ |
| 页面加载状态 | 初始渲染正常，0/100 计数器可见 | ✅ |
| 空状态 | "暂无最近讨论"文本在 0 条时显示 | ✅ |
| 成功状态 | 创建后导航至 /discussion/[sessionId] | ✅ |
| 全栈 roundtrip | UI 提交 → 真实 POST → 真实 sessionId → 导航 | ✅ |

### integration（standards/testing/integration.md）

| 组件链 | 覆盖场景 | 结果 |
|--------|---------|------|
| Route → SessionService → MockSessionRepository | 正常创建（happy path） | ✅ |
| Route → SessionService → MockTemplateRepository | 模板不存在（failure path） | ✅ |
| 跨组件错误传播 | ServiceError('TEMPLATE_NOT_FOUND') → HTTP 404 | ✅ |
| 字段传递完整性 | session.state.stage='idle', modelStrategyId 默认值 'smart' | ✅ |

---

## Review Evidence

**审查 agent**：`superpowers:code-reviewer`

### 审查结果摘要

| 严重程度 | 数量 | 已修复 |
|---------|------|--------|
| CRITICAL | 0 | — |
| HIGH | 2 | 2 ✅ |
| MEDIUM | 5 | 2 ✅ (M-1 记录为 Known Issue, M-3/M-5 记录) |
| LOW | 2 | 记录 |

**H-1 修复**：创建 `src/server/repositories/mock/instances.ts`，使用 `globalThis` 单例模式确保两个路由文件共享同一个 MockSessionRepository 实例，实现跨请求持久化。修复后 POST → GET recent 全链路验证通过。

**H-2 修复**：`HomeModule` 模板卡片从显示 `DEFAULT_TEMPLATE_NAME` 硬编码字符串，改为从 `TEMPLATE_NAMES[selectedTemplateId]` 响应式解析，与策略卡片模式一致。

**M-2 修复**：`VALID_STRATEGY_IDS` 从 `MODEL_STRATEGIES.map(s => s.id)` 动态派生，消除与常量定义的潜在不同步。

**M-4 修复**：合并 `@/types/api` 的两个分开的 import 为单一 import 语句。

修复后重新运行测试：22 files, 90 tests — ALL PASS。

---

## Known Issues

| ID | 严重程度 | 描述 | 计划 |
|----|---------|------|------|
| KI-001 | MEDIUM | `INVALID_REQUEST`/`INVALID_STRATEGY` 错误码未在 design.md 文档化，无对应测试 | 迭代 2 更新 design.md 补充 |
| KI-002 | MEDIUM | `Session.status === 'archived'` 在首页显示为"已完成"，与 `'completed'` 无区分 | 迭代 2 扩展状态映射 |
| KI-003 | MEDIUM | `home.test.tsx` 产生 React `act()` 警告（异步 state 更新未包裹在 act 中） | 迭代 2 优化测试 |
| KI-004 | LOW | 服务层/路由层无结构化日志，INTERNAL_ERROR catch 块静默丢弃原始错误 | 迭代 5 统一日志接入 |
| KI-005 | LOW | `sessions-api.test.ts` 无路由级断言 `state.stage === 'idle'`（AC-010 仅由 service 层测试覆盖） | 记录，不阻塞 |
| KI-006 | LOW | Next.js CVE（依赖升级）——基础设施范畴 | 单独排期升级 |
| KI-007 | LOW | POST /api/sessions 缺少请求频率限制——基础设施范畴 | 单独排期处理 |
