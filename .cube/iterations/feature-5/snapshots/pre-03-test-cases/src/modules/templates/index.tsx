export function TemplatesModule() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-text-primary mb-2">模板</h1>
      <p className="text-text-secondary text-sm mb-6">查看和管理讨论模板</p>

      <div className="space-y-3 mb-6">
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          模板详情占位
        </div>
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          角色列表占位
        </div>
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          事件规则占位
        </div>
      </div>

      <p className="text-text-muted text-xs text-center">迭代 8 将实现：模板详情 / 角色列表 / 事件规则</p>
    </div>
  )
}
