# 迭代 10 PRD：设置页缺失交互补全

## 1. 功能概述

本次迭代聚焦设置页交互层补全，基于 feature/9 已完成的设置页骨架和后端 API，补齐用户可实际操作的前端能力，包含以下 5 个功能点：

1. Provider 配置 Sheet：支持查看、编辑、保存 Provider 配置并测试连接。
2. 模型配置 Sheet：支持编辑全局默认模型与角色专属模型覆盖。
3. Prompt 配置：支持查看、编辑、保存和恢复默认 Prompt。
4. 本地数据清理：支持按范围清理会话、设置或全部本地数据。
5. 模板管理占位优化：保留占位状态，但提供更明确的产品说明。

本次迭代只补齐设置页前端交互与状态联动，不新增后端路由，不扩展模板管理真实能力，不改动已通过的 feature/9 后端与既有测试契约。

## 2. Functional Requirements

### 功能点 A：Provider 配置与连接测试

**FR-001（P0）打开 Provider 配置 Sheet**  
用户点击设置页任意 Provider 状态卡片后，系统应从底部滑出 Provider 配置 Sheet，展示 providerId、enabled、baseUrl、maskedKey、apiKey、modelList、customHeaders、lastTestStatus、lastTestedAt 等字段，其中 providerId、maskedKey、lastTestStatus、lastTestedAt 为只读。  
输入：用户点击 Provider 卡片。  
输出：展示对应 Provider 的配置 Sheet。  
异常处理：若 Provider 当前无配置，仍应可打开 Sheet，并以默认值展示可编辑初始状态。

**FR-002（P0）展示未配置 Provider 的默认状态**  
设置页必须始终展示 OpenAI、Anthropic、Gemini、DeepSeek、Custom 共 5 种 Provider。未配置 Provider 卡片应展示 providerId、未配置状态、禁用标识和“点击配置”提示；进入 Sheet 后 enabled 默认为 false，baseUrl 预填对应 Provider 默认 URL。  
输入：用户进入设置页或点击未配置 Provider。  
输出：卡片展示未配置状态，Sheet 提供默认初始值。  
异常处理：若默认 URL 缺失，前端应以可读错误提示阻止保存并提示重新检查配置来源。

**FR-003（P0）校验 Provider 配置字段**  
Provider 配置 Sheet 中 providerId 不能为空，baseUrl 必须是有效 URL，modelList 不能为空。校验失败时，应在对应字段下方展示红色错误提示，并禁用保存按钮。  
输入：用户编辑表单字段。  
输出：实时校验结果和按钮可用状态。  
异常处理：非法输入不得提交；若 customHeaders 不是合法 JSON，前端应提示格式错误并阻止保存。

**FR-004（P0）保存 Provider 配置**  
用户点击保存后，系统应调用 `PUT /api/llm/providers` 保存或更新当前 Provider 配置；保存成功后关闭 Sheet，并刷新设置页中的 Provider 卡片状态。若用户提交了新的 apiKey，前端后续只展示更新后的 maskedKey，不展示明文 Key。  
输入：当前 Sheet 中的 Provider 配置表单。  
输出：保存成功反馈、Sheet 关闭、Provider 列表刷新。  
异常处理：保存失败时，Sheet 保持打开，显示可读错误信息，并保留用户当前输入内容。

**FR-005（P0）测试 Provider 连接**  
Provider 配置 Sheet 中应提供“测试连接”按钮。点击后调用 `POST /api/llm/providers/test`，按钮进入 Loading 态并禁止重复点击。测试成功时展示绿色结果提示（例如“连接正常 · xxx ms”），并刷新 lastTestStatus 为 success；失败时展示红色错误摘要。  
输入：用户点击“测试连接”。  
输出：连接测试结果、按钮状态变化、测试状态刷新。  
异常处理：当缺少 baseUrl 或 API Key 等必填项时，不得发起测试，并提示用户先完成配置。

**FR-006（P0）映射连接测试错误提示**  
对于 `PROVIDER_NOT_CONFIGURED`、`PROVIDER_AUTH_FAILED`、`PROVIDER_TIMEOUT`、`PROVIDER_MODEL_NOT_FOUND`、`PROVIDER_TEST_FAILED` 等错误码，前端必须映射为面向用户的可读提示，不得直接暴露底层错误细节。  
输入：测试连接接口返回的错误码。  
输出：统一的用户提示文案。  
异常处理：若返回未知错误码，前端应展示通用失败提示，且不回显敏感信息。

### 功能点 B：模型配置

**FR-007（P0）编辑全局默认模型**  
用户点击“模型配置”分组中的“编辑”按钮后，系统应展示模型配置 Sheet。上半区展示“全局默认模型”表单，包含 Provider 下拉框、模型输入框、temperature 滑块、maxTokens 数字输入框；Provider 下拉框仅展示 enabled=true 的已配置 Provider。保存时调用 `PUT /api/settings/model-defaults`。  
输入：用户点击编辑并修改全局默认模型配置。  
输出：更新后的全局默认模型配置。  
异常处理：若当前没有任何已启用 Provider，应展示空状态提示并禁用保存。

**FR-008（P0）编辑角色专属模型覆盖**  
模型配置 Sheet 下半区应提供“角色专属模型覆盖”折叠面板。展开后展示当前所有角色列表，每个角色可独立设置 Provider、model、temperature、maxTokens；未覆盖状态应展示“使用全局默认”。每个角色均提供“清除覆盖”按钮。保存时调用 `PUT /api/settings/role-models`。  
输入：用户展开折叠面板并编辑角色覆盖配置。  
输出：角色级覆盖配置保存结果。  
异常处理：角色覆盖保存失败时，应保留当前编辑内容并提示失败原因。

**FR-009（P1）展示模型生效优先级说明**  
模型配置分组在 Sheet 外应展示简洁的优先级说明：`角色专属 > 会话 runtimeConfig（创建时固化）> 模板/策略默认 > 全局默认 > Provider 默认`，并支持点击展开简要说明。  
输入：用户查看模型配置分组。  
输出：可读的优先级说明文案。  
异常处理：若优先级说明展开失败，不影响模型编辑主流程。

### 功能点 C：Prompt 配置

**FR-010（P0）查看 Prompt 列表与详情**  
用户点击“Prompt 提示词配置”分组后，系统应展示 Prompt 配置 Sheet，列表按“全局 Prompt”和“角色 Prompt”两栏分组，单项展示 promptId、scope、targetId、version、updatedAt、isDefault 信息。用户点击某一项后切换为编辑态，在 textarea 中展示 content，并展示相关 meta 信息。  
输入：用户点击 Prompt 配置分组并选择某一条 Prompt。  
输出：Prompt 列表和对应编辑态内容。  
异常处理：若列表为空，应展示空状态说明，不显示无效编辑区。

**FR-011（P0）保存 Prompt 编辑结果**  
编辑态下应提供“保存”按钮。点击后弹出二次确认弹窗，明确提示当前覆盖操作不可撤销且历史会话不受影响。用户确认后调用 `PUT /api/settings/prompts`，请求体包含 promptId 和 content。保存成功后刷新列表，version 与 updatedAt 更新，isDefault 变为 false。  
输入：用户编辑 Prompt 内容并确认保存。  
输出：Prompt 新版本生效并刷新列表。  
异常处理：保存失败时，保留当前编辑内容并展示失败提示。

**FR-012（P0）恢复 Prompt 默认版本**  
编辑态下应提供“恢复默认”按钮。点击后弹出确认弹窗，明确提示当前自定义内容将丢失。用户确认后调用 `PUT /api/settings/prompts`，请求体包含 promptId 和 `reset: true`。成功后刷新列表，version 与 updatedAt 更新，isDefault 变为 true。  
输入：用户点击恢复默认并确认。  
输出：Prompt 恢复为系统默认版本。  
异常处理：恢复失败时，不应清空当前展示内容，并展示失败提示。

### 功能点 D：本地数据清理

**FR-013（P0）展示数据清理入口与数据量**  
用户点击“数据与安全”分组后，系统应展示数据清理 Sheet，提供“清理会话”“清理设置”“清理全部”三个入口。每个入口旁应展示当前数据量，例如当前会话数或设置项数量。  
输入：用户点击“数据与安全”分组。  
输出：展示三类清理入口与数据量信息。  
异常处理：若数据量暂时无法获取，应展示“暂无法统计”而不是空白。

**FR-014（P0）执行清理会话或清理设置的二次确认**  
用户点击“清理会话”或“清理设置”后，系统应弹出二次确认弹窗，说明影响范围；用户确认后调用 `POST /api/settings/clear` 执行对应范围清理。  
输入：用户点击清理入口并确认。  
输出：清理执行结果和界面刷新。  
异常处理：用户取消时不得执行清理；清理失败时应展示失败提示且保持当前界面状态。

**FR-015（P0）展示包含 Provider 设置的高风险警告**  
当清理范围包含 Provider 设置（即“清理设置”或“清理全部”）时，确认弹窗必须在顶部展示红色警告，明确说明清理后真实模型将不可用，直到重新配置 Provider。  
输入：用户发起包含 Provider 设置的清理操作。  
输出：高风险警告信息。  
异常处理：若警告信息未加载成功，应阻止继续操作，而不是静默放行。

**FR-016（P0）执行清理全部的三步确认**  
用户点击“清理全部”后，系统必须引导用户完成三步确认：第一步展示总影响范围；第二步要求输入确认词“确认删除”或勾选确认项；第三步进行最终确认。三步全部完成后，系统调用 `POST /api/settings/clear?scope=all`，成功后关闭 Sheet，并将设置页各分组刷新为空状态。  
输入：用户依次完成三步确认。  
输出：全量清理结果、Sheet 关闭、设置页刷新。  
异常处理：任一步骤未完成、校验失败或用户取消时，不得执行最终清理。

### 功能点 E：模板管理占位优化

**FR-017（P1）优化模板管理占位展示**  
模板管理分组在本迭代仍保持占位状态，但应展示更清晰的说明文案“模板管理将在后续迭代中提供”，并可展示一个 disabled 状态的“了解更多”按钮。该分组不调用任何 API。  
输入：用户查看模板管理分组。  
输出：明确的占位说明和禁用按钮样式。  
异常处理：无。

## 3. Non-Functional Requirements

**NFR-001（P0）移动端交互一致性**  
所有设置页 Sheet 必须统一采用底部滑出样式，高度约为视口的 80%，顶部圆角，遮罩层可点击关闭，适配移动端单列阅读与操作。

**NFR-002（P0）表单可用性**  
Sheet 内表单字段必须采用垂直布局，标签位于输入框上方；底部操作按钮区固定显示，避免被移动端软键盘遮挡。

**NFR-003（P0）加载与错误反馈明确**  
所有保存、测试、清理类操作在执行中必须展示 Loading 态并禁止重复提交；表单校验错误必须内联展示；接口错误必须通过 Toast 或 Sheet 内横幅给出清晰提示。

**NFR-004（P0）敏感信息安全展示**  
前端不得在页面、本地缓存或错误提示中暴露明文 API Key；测试失败提示中不得包含完整请求体、明文密钥或其他敏感字段。

**NFR-005（P0）破坏性操作防误触**  
清理设置和清理全部必须通过明确的确认流程完成，其中清理全部必须至少包含一次显式输入确认词或勾选确认，不得仅依赖单次按钮点击触发。

**NFR-006（P1）代码可维护性**  
设置页新增交互实现必须遵守单文件不超过 800 行的约束，Sheet 与通用确认弹窗应拆分为独立组件文件，避免主模块过度膨胀。

## 4. 验收标准

1. 用户可从设置页打开任一 Provider 卡片，查看并编辑 Provider 配置，保存成功后设置页状态同步刷新。
2. Provider 表单在 providerId 为空、baseUrl 非法、modelList 为空、customHeaders 非法 JSON 时，均能展示明确错误提示并阻止保存。
3. 用户可在 Provider Sheet 中发起连接测试，看到 Loading 态、成功延迟提示或失败错误摘要，且错误码映射符合需求。
4. 设置页始终展示 5 个 Provider，未配置 Provider 具有明确的“未配置/点击配置”状态，并可进入默认初始化的配置 Sheet。
5. 用户可在模型配置 Sheet 中修改全局默认模型并保存；未启用 Provider 时，界面展示空状态且不可提交。
6. 用户可为角色设置专属模型覆盖，查看“使用全局默认”状态，并可清除角色覆盖。
7. 模型配置分组能展示并展开模型优先级说明，文案与需求一致。
8. 用户可查看全局 Prompt 与角色 Prompt 列表，点击单项后进入编辑态并看到 content 与 meta 信息。
9. 用户保存 Prompt 时必须先经过二次确认；保存成功后 version、updatedAt、isDefault 状态正确刷新。
10. 用户恢复 Prompt 默认版本时必须经过二次确认；恢复成功后 isDefault 为 true，版本信息同步更新。
11. 用户可在数据与安全分组看到三类清理入口及对应数据量。
12. 清理会话与清理设置均需二次确认；取消时不执行，确认后调用对应清理接口并刷新界面。
13. 当清理范围包含 Provider 设置时，界面必须展示红色高风险警告。
14. 清理全部必须完成三步确认后才能执行；完成后关闭 Sheet，设置页各分组展示空状态。
15. 模板管理分组保持占位，不触发任何 API，仅展示明确说明文案与禁用按钮。

## 5. Out of Scope

1. 不新增任何后端 API 路由、服务能力或数据结构。
2. 不实现模板管理的真实增删改查、导入导出或模板编辑功能。
3. 不实现外观与通知分组的真实交互能力。
4. 不引入新的状态管理库、表单库或第三方 UI 组件库。
5. 不修改 feature/9 已通过的后端测试和既有设置页集成测试契约。
6. 不处理多设备同步、服务端持久化、API Key 加密存储等后续阶段能力。

## 6. 依赖说明

1. 复用 feature/9 已实现的设置相关 API：`/api/llm/providers`、`/api/llm/providers/test`、`/api/settings/model-defaults`、`/api/settings/role-models`、`/api/settings/prompts`、`/api/settings/clear`。
2. 依赖现有设置页骨架、Provider 状态展示和模型配置展示能力作为交互承载层。
3. 依赖当前角色列表、Provider 状态和 Prompt 数据的现有读取能力，以支撑 Sheet 初始化与刷新联动。