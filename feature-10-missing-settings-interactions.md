# 设置页交互功能需求文档

> 状态：需求梳理完成，待排入后续迭代
> 关联迭代：feature/9（骨架已实现，本文档定义需补全的交互层）
> 日期：2026-06-05

---

## 1. 背景

feature/9 迭代完成了设置页骨架布局（Provider 状态展示、模型配置展示）、全部后端 API 路由、以及单元/集成测试。以下前端交互功能在 feature/9 中保留为占位状态：

| 分组 | feature/9 状态 | 实际交付 |
|---|---|---|
| Provider 厂商与连接 | 骨架已展示 | 仅状态卡片，无配置 Sheet |
| 模型配置 | 骨架已展示 | 仅只读展示，无编辑 Sheet |
| 模板管理 | 占位 | 仅"后续迭代实现"文案 |
| Prompt 提示词配置 | 占位 | 仅"后续迭代实现"文案 |
| 数据与安全 | 占位 | 仅"后续迭代实现"文案 |

本文档定义上述占位部分的完整需求，作为后续迭代的输入。

---

## 2. 可复用后端能力

以下 API 已由 feature/9 实现，新迭代无需重复开发后端：

| API | 方法 | 能力 |
|---|---|---|
| `/api/llm/providers` | GET | 获取所有 Provider 配置状态（含 maskedKey、lastTestStatus） |
| `/api/llm/providers` | PUT | 保存/更新 Provider 配置（write-only） |
| `/api/llm/providers/test` | POST | 测试 Provider 连接，返回状态+延迟 |
| `/api/settings/model-defaults` | GET/PUT | 全局默认模型读写 |
| `/api/settings/role-models` | GET/PUT | 角色专属模型覆盖读写 |
| `/api/settings/prompts` | GET/PUT | Prompt 配置读写（含 reset 标志恢复默认） |
| `/api/settings/clear` | POST | 数据清理（scope: sessions/settings/all） |

---

## 3. 功能需求

### 3.1 Provider 配置 Sheet

#### FR-01 打开与展示
- 触发：用户点击设置页任意 Provider 状态卡片
- 展示底部 Sheet，字段包括：
  - providerId（只读）
  - enabled（开关）
  - baseUrl（文本输入）
  - maskedKey（脱敏展示，如 `sk-***1234`）
  - apiKey（write-only 输入框，输入后覆盖原值）
  - modelList（文本域，逗号分隔）
  - customHeaders（文本域，JSON 格式）
  - lastTestStatus、lastTestedAt（只读状态）
- 提供"取消"和"保存"按钮

#### FR-02 字段校验
- providerId 非空
- baseUrl 为有效 URL 格式
- modelList 非空
- 校验失败时，对应字段下方展示红色错误提示，按钮禁用

#### FR-03 保存行为
- 调用 `PUT /api/llm/providers`
- 成功后 Sheet 关闭，设置页 Provider 卡片状态刷新
- 新的 apiKey 提交后前端只展示更新后的 maskedKey

#### FR-04 测试连接
- Sheet 内提供"测试连接"按钮
- 调用 `POST /api/llm/providers/test`
- 按钮进入 Loading 态，禁止重复点击
- 成功：底部展示绿色提示`连接正常 · xxx ms`，lastTestStatus 更新为 `success`
- 失败：底部展示红色可读错误摘要

#### FR-05 错误映射
| 错误码 | 用户提示 |
|---|---|
| PROVIDER_NOT_CONFIGURED | Provider 未配置（缺少 baseUrl 或 API Key） |
| PROVIDER_AUTH_FAILED | 鉴权失败，请检查 API Key |
| PROVIDER_TIMEOUT | 连接超时，请检查网络或 baseUrl |
| PROVIDER_MODEL_NOT_FOUND | 指定模型在该 Provider 上不可用 |
| PROVIDER_TEST_FAILED | 测试失败，请稍后重试 |

#### FR-06 未配置 Provider 展示
- 设置页 Provider 列表始终展示全部 5 种 Provider（OpenAI、Anthropic、Gemini、DeepSeek、Custom）
- 未配置的 Provider 卡片展示：providerId + "未配置" + 禁用状态 + "点击配置"
- 点击后进入 Sheet，enabled 默认为 false，baseUrl 预填充 Provider 默认 URL

---

### 3.2 模型配置 Sheet

#### FR-07 全局默认编辑
- 触发：用户点击"模型配置"分组的"编辑"按钮
- 展示 Sheet，上半区为"全局默认模型"：
  - Provider 下拉框（只显示 enabled=true 的已配置 Provider）
  - 模型输入框
  - temperature 滑块（范围 0~2，步长 0.1）
  - maxTokens 数字输入框（范围 128~8192）
- 保存调用 `PUT /api/settings/model-defaults`

#### FR-08 角色专属模型覆盖
- Sheet 下半区为折叠面板"角色专属模型覆盖"
- 展开后展示当前所有角色列表
- 每个角色可独立设置：Provider / model / temperature / maxTokens
- 未覆盖的角色展示"使用全局默认"
- 每个角色旁提供"清除覆盖"按钮
- 保存调用 `PUT /api/settings/role-models`

#### FR-09 优先级说明
- 模型配置分组页面（Sheet 外）展示生效优先级：
  ```
  角色专属 > 会话 runtimeConfig（创建时固化）> 模板/策略默认 > 全局默认 > Provider 默认
  ```
- 文案简洁，可点击展开简要说明

---

### 3.3 Prompt 配置

#### FR-10 列表与查看
- 触发：用户点击"Prompt 提示词配置"分组
- 展示 Sheet，列表分为两栏：全局 Prompt、角色 Prompt
- 每个 Prompt 项展示：
  - promptId
  - scope（global / role）
  - targetId（角色名，scope=role 时显示）
  - version
  - updatedAt
  - isDefault 标记（系统默认版显示"默认"标签）
- 点击某条切换为编辑态：textarea 展示 content，下方显示 meta 信息

#### FR-11 编辑与保存
- 编辑态提供"保存"按钮
- 点击后弹出二次确认弹窗：
  - 标题：确认覆盖当前 Prompt？
  - 内容：此操作不可撤销，历史会话中的 Prompt 不受影响。
  - 按钮：取消 / 确认保存
- 确认后调用 `PUT /api/settings/prompts`，body 含 promptId + content
- 成功后刷新列表，version 和 updatedAt 更新，isDefault 变为 false

#### FR-12 恢复默认
- 编辑态提供"恢复默认"按钮
- 点击后弹出确认弹窗：
  - 标题：确认恢复为系统默认版本？
  - 内容：当前自定义内容将丢失。
  - 按钮：取消 / 确认恢复
- 确认后调用 `PUT /api/settings/prompts`，body 含 promptId + reset: true
- 成功后列表刷新，version 递增，updatedAt 更新，isDefault 变为 true

---

### 3.4 本地数据清理

#### FR-13 清理入口展示
- 触发：用户点击"数据与安全"分组
- 展示 Sheet，三种清理入口：
  - 清理会话 — 删除所有会话、消息、事件、投票记录
  - 清理设置 — 删除所有 Provider 配置、模型默认、角色覆盖、Prompt 配置
  - 清理全部 — 删除以上所有数据
- 每个入口旁展示当前数据量（如"当前 12 个会话"）

#### FR-14 通用二次确认
- 点击"清理会话"或"清理设置"后：
  - 弹窗标题：`确认清理{范围}？`
  - 弹窗内容：影响范围明细
  - 按钮：取消 / 确认清理
- 点击确认后调用 `POST /api/settings/clear`

#### FR-15 Provider 设置清理额外警告
- 当清理范围包含 Provider 设置时（即"清理设置"或"清理全部"）：
  - 弹窗顶部展示红色警告：清理后真实模型将不可用，直到重新配置 Provider

#### FR-16 清理全部三步确认
- 点击"清理全部"后需经过三步：
  - 第一步：展示总影响范围（会话数、设置项数），按钮为"下一步"
  - 第二步：要求输入确认词 `"确认删除"` 或勾选"我已了解此操作不可撤销"，按钮为"下一步"
  - 第三步：最终确认，按钮为"确认清理全部数据"
- 三步全部完成后调用 `POST /api/settings/clear?scope=all`
- 清理完成后关闭 Sheet，设置页所有分组展示空状态

---

### 3.5 模板管理占位优化

#### FR-17 占位展示
- 模板管理分组保持为占位状态（本迭代不实现模板管理功能）
- 展示文案：`模板管理将在后续迭代中提供`
- 可放置一个 disabled 样式的"了解更多"按钮
- 不调用任何 API

---

## 4. UI/UX 规范

- **Sheet 样式**：统一从底部滑出，高度 80% 视口，圆角顶部，背景遮罩可点击关闭
- **表单布局**：字段垂直排列，标签在输入框上方，间距紧凑适合移动端
- **按钮位置**：Sheet 底部固定按钮区（取消 | 保存），避免键盘遮挡
- **加载态**：按钮显示 Loading Spinner，禁用点击
- **错误提示**：表单校验错误内联展示；API 错误以底部 Toast 或 Sheet 内横幅展示
- **键盘适配**：Sheet 内输入框聚焦时自动上推，避免被软键盘遮挡

---

## 5. 组件拆分建议

为保持代码可维护性（单文件 < 800 行），建议按以下结构拆分：

```
src/modules/settings/
  index.tsx                 # SettingsModule 主组件（追加 Sheet 状态管理）
  provider-sheet.tsx        # Provider 配置 Sheet
  model-sheet.tsx           # 模型配置 Sheet
  prompt-sheet.tsx          # Prompt 配置 Sheet
  data-sheet.tsx            # 数据清理 Sheet
  components/
    confirm-dialog.tsx      # 通用二次确认弹窗
```

---

## 6. 测试要求

每个 Sheet 组件应有独立的测试文件，最小覆盖：

| 组件 | 测试文件 | 最少用例数 | 必测场景 |
|---|---|---|---|
| ProviderSheet | provider-sheet.test.tsx | 8 | 表单渲染、字段校验、保存成功、保存失败、测试连接成功、测试连接失败、未配置 Provider、脱敏展示 |
| ModelSheet | model-sheet.test.tsx | 6 | 全局默认编辑、角色覆盖列表、temperature 滑块、保存成功、优先级说明文案、角色清除覆盖 |
| PromptSheet | prompt-sheet.test.tsx | 6 | 列表渲染、编辑态切换、保存二次确认、恢复默认确认、保存后 isDefault=false、恢复后 isDefault=true |
| DataSheet | data-sheet.test.tsx | 6 | 三种入口渲染、清理会话确认、清理设置警告、清理全部三步、取消不执行、清理后刷新 |
| ConfirmDialog | confirm-dialog.test.tsx | 4 | 渲染、确认回调、取消回调、danger 变体样式 |
| Settings集成 | settings-integration.test.tsx | 4 | 各 Sheet 打开/关闭、数据联动刷新 |

---

## 7. 开发约束

- **不新增后端路由**：所有 API 调用复用 feature/9 已实现的路由
- **不修改已有通过测试的代码**：feature/9 的 `settings-module.test.tsx` 及所有后端测试保持原样
- **前端状态管理**：使用 React useState + useEffect，不引入新状态管理库
- **Sheet 组件复用**：统一使用自定义 Sheet 组件，不引入新 UI 库
- **单文件 < 800 行**：Sheet 组件独立成文件，避免 index.tsx 膨胀

---

## 8. 安全风险清单（开发时需逐条确认）

- [ ] 前端不缓存明文 API Key（apiKey 输入框值不存入 localStorage/sessionStorage）
- [ ] 测试连接失败时，错误信息不暴露明文 Key 或完整请求体
- [ ] Prompt 编辑弹窗的确认文案明确告知"历史会话不受影响"
- [ ] 数据清理确认弹窗不可通过脚本自动绕过（需用户真实交互）
- [ ] 清理全部的三步确认中至少有一步需要用户输入确认词或显式勾选

---

## 9. 关联文档

- `docs/requirements/iteration-9-settings-provider-data-closure.md` — feature/9 原始需求
- `.cube/iterations/feature-9/prd.md` — feature/9 PRD
- `.cube/iterations/feature-9/design.md` — feature/9 技术设计（含 API 契约、数据模型）
- `.cube/iterations/feature-9/test-map.yaml` — feature/9 测试用例映射（已完成测试不应修改）
- `src/modules/settings/index.tsx` — 当前设置页骨架代码
