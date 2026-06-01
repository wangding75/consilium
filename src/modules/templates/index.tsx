import { threeKingdomsTemplate } from '@/data/templates/three-kingdoms'

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
        <div className="rounded-xl border border-border p-4 text-sm">
          <h2 className="mb-3 font-medium text-text-primary">事件规则</h2>
          <div className="space-y-2">
            {threeKingdomsTemplate.events.map((event) => (
              <div key={event.id} className="rounded-lg bg-background px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text-primary">{event.description}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">{event.type}</span>
                </div>
                <p className="mt-1 text-xs text-text-muted">{event.trigger}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-text-muted text-xs text-center">模板详情 / 角色列表将在后续迭代完善</p>
    </div>
  )
}
