export function SettingsModule() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-text-primary mb-2">设置</h1>
      <p className="text-text-secondary text-sm mb-6">配置 LLM Provider 和模型参数</p>

      <div className="space-y-3 mb-6">
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          Provider 设置占位
        </div>
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          模型配置占位
        </div>
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          Prompt 配置占位
        </div>
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          安全设置占位
        </div>
      </div>

      <p className="text-text-muted text-xs text-center">迭代 9 将实现：Provider / 模型 / Prompt / 安全设置</p>
    </div>
  )
}
