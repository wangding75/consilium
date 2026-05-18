export function HomeModule() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-text-primary mb-2">首页</h1>
      <p className="text-text-secondary text-sm mb-6">发起一场多角色 AI 讨论，获得更全面的决策参考</p>

      <div className="rounded-xl border border-border border-dashed p-6 flex flex-col items-center gap-3 text-center">
        <span className="text-4xl">💬</span>
        <p className="text-text-secondary text-sm">功能开发中</p>
        <p className="text-text-muted text-xs">迭代 1 将实现：发起讨论 / 选择模板 / 创建会话</p>
      </div>
    </div>
  )
}
