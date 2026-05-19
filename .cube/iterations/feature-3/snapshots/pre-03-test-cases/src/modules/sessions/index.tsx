export function SessionsModule() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-text-primary mb-2">会话</h1>
      <p className="text-text-secondary text-sm mb-6">管理你的讨论会话记录</p>

      <div className="space-y-3 mb-6">
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          搜索 / 筛选占位
        </div>
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          会话列表占位
        </div>
      </div>

      <p className="text-text-muted text-xs text-center">迭代 4 将实现：会话列表 / 恢复 / 归档</p>
    </div>
  )
}
