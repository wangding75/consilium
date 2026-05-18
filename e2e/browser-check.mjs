// E2E browser chain verification for consilium iteration 0
// Run: PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright node e2e/browser-check.mjs

import { chromium } from 'playwright'
import path from 'path'
import os from 'os'

const BASE = 'http://localhost:3000'
const BROWSER_PATH = path.join(os.homedir(), '.cache/ms-playwright')

async function run() {
  const browser = await chromium.launch({
    executablePath: path.join(BROWSER_PATH, 'chromium-1223/chrome-linux64/chrome'),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },  // iPhone SE — AC-005
  })
  const page = await ctx.newPage()

  const results = []

  function check(name, pass, detail = '') {
    results.push({ name, pass, detail })
    console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
  }

  // AC-001 / AC-002: 首页渲染 — 等待 main 内的 h1 出现（排除 Next.js 内嵌的 404 fallback）
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')
  // Next.js 客户端水合后真实内容出现在 main 内
  await page.waitForSelector('main h1', { timeout: 5000 }).catch(() => {})

  const mainH1 = page.locator('main h1').first()
  check('AC-002 首页渲染',
    await mainH1.isVisible().catch(() => false),
    (await mainH1.textContent().catch(() => '(not found)')) ?? '')

  // App Shell 结构
  check('App Shell header 可见',
    await page.locator('header').isVisible())
  check('App Shell main 可见',
    await page.locator('main').isVisible())
  check('App Shell BottomNav 可见',
    await page.locator('nav').isVisible())

  // AC-004: 5 个 Tab 可点击跳转 — Next.js Link 是 SPA 导航，用 waitForURL 捕获
  const tabs = [
    { label: '首页',   href: '/' },
    { label: '会话',   href: '/sessions' },
    { label: '模板',   href: '/templates' },
    { label: '设置',   href: '/settings' },
  ]

  for (const tab of tabs) {
    await page.locator(`nav a[href="${tab.href}"]`).click()
    await page.waitForURL(`**${tab.href}`, { timeout: 5000 }).catch(() => {})
    const url = new URL(page.url()).pathname
    check(`AC-004 Tab "${tab.label}" 跳转`, url === tab.href, url)
  }

  // AC-003: 讨论页 (动态路由)
  await page.goto(`${BASE}/discussion/test-session`)
  await page.waitForLoadState('networkidle')
  const discussionVisible = await page.locator('main').isVisible()
  check('AC-003 讨论页骨架渲染', discussionVisible)

  // AC-005: 移动端宽度布局 — BottomNav 无溢出
  const navBox = await page.locator('nav').boundingBox()
  check('AC-005 移动端 BottomNav 宽度不超出 375px',
    navBox ? navBox.width <= 375 : false,
    navBox ? `实际宽度 ${navBox.width}px` : 'nav not found')

  // 控制台报错检查 — 只关注业务级 JS 错误，忽略 Next.js dev 模式 chunk 404
  const jsErrors = []
  page.on('pageerror', err => jsErrors.push(err.message))
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')
  check('页面无运行时 JS 异常', jsErrors.length === 0,
    jsErrors.length ? jsErrors.slice(0, 3).join(' | ') : '')

  await browser.close()

  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`\n总计: ${passed} 通过 / ${failed} 失败`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(err => {
  console.error('E2E 运行失败:', err.message)
  process.exit(1)
})
