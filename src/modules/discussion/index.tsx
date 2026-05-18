interface DiscussionModuleProps {
  sessionId: string
}

export function DiscussionModule({ sessionId }: DiscussionModuleProps) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-text-primary mb-2">讨论</h1>
      <p className="text-text-secondary text-sm mb-2">会话 ID：{sessionId}</p>

      <div className="space-y-3 mb-6">
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          消息流占位
        </div>
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          角色栏占位
        </div>
        <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
          输入区占位
        </div>
      </div>

      <p className="text-text-muted text-xs text-center">迭代 2/3 将实现：多角色发言 / 消息流 / 用户输入</p>
    </div>
  )
}
