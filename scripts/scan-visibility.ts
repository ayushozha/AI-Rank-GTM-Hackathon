// AI Rank — visibility scan.
// Drives a DEDICATED browser instance (own profile, own process) through
// Perplexity queries via the OS accessibility tree (no selectors, no API) and
// records which domains each AI answer cites. The dedicated process means the
// user can keep working in their own browser while the scan runs.
//
// Run: simulang run scripts/scan-visibility.ts   (SCAN_LIMIT=N to cap queries)
// Output: out/scan-results.json + out/shots/qNN.png

import {
  AccessibilityTree,
  AriaRole,
  Direction,
  Key,
  KeyboardController,
  TraversalOrder,
  Window,
  screenshotCropped,
  type AccessibilityNodeJs,
} from '@simular-ai/simulang-js'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(readFileSync(resolve(ROOT, 'config.json'), 'utf8'))

// SCAN_LIMIT env var (the simulang CLI intercepts --flags before the script sees them)
const limit = Number(process.env.SCAN_LIMIT) || Infinity
const queries: string[] = config.queries.slice(0, limit)

const OUT = resolve(ROOT, 'out')
const SHOTS = resolve(OUT, 'shots')
mkdirSync(SHOTS, { recursive: true })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------- dedicated scan browser ----------
const BROWSER_CANDIDATES = [
  process.env.SCAN_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean) as string[]
const browserExe = BROWSER_CANDIDATES.find((p) => existsSync(p))
if (!browserExe) {
  console.error('No Chrome/Edge found. Set SCAN_BROWSER to a Chromium browser exe path.')
  process.exit(1)
}
const profileDir = resolve(OUT, 'scan-profile')
let browserPid = 0

function openUrl(url: string) {
  const args = [`--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check', '--start-maximized', url]
  const child = spawn(browserExe!, args, { detached: true, stdio: 'ignore' })
  child.unref()
}

// Chromium delegates to an existing process for the same profile and exits,
// so the spawned pid is unreliable. The authoritative pid is whichever live
// process has our profile dir on its command line.
function scanBrowserPids(): number[] {
  const r = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name like '%chrome%' or Name like '%msedge%'" | Where-Object { $_.CommandLine -like '*scan-profile*' } | Select-Object -ExpandProperty ProcessId`],
    { encoding: 'utf8' },
  )
  return (r.stdout ?? '').split(/\r?\n/).map((s) => Number(s.trim())).filter(Boolean)
}

function killScanBrowser() {
  for (const pid of scanBrowserPids()) {
    try {
      process.kill(pid)
    } catch {}
  }
}

// ---------- accessibility helpers ----------
function flatten(node: AccessibilityNodeJs, out: AccessibilityNodeJs[] = []): AccessibilityNodeJs[] {
  out.push(node)
  for (const c of node.children) flatten(c, out)
  return out
}

const labelOf = (n: AccessibilityNodeJs) =>
  [n.name, n.value, n.description, n.helpText].filter(Boolean).join(' ')

// Bind ONLY to our dedicated browser's windows (Chromium window titles follow
// the active tab; Perplexity titles the tab with the query text). No global
// fallback — snapshotting another window risks reading the user's apps.
function bindTree(query: string): { tree: AccessibilityTree; win: Window } | null {
  const probe = query.slice(0, 25).toLowerCase()
  const pool = Window.allForPid(browserPid)
  const win = pool.find((w) => w.title.toLowerCase().includes(probe)) ?? pool[0]
  return win ? { tree: AccessibilityTree.fromWindow(win), win } : null
}

// Only the engine's Document subtree is the actual AI answer. NO fallback to
// other documents — grabbing the wrong tab is worse than grabbing nothing.
function contentNodes(root: AccessibilityNodeJs, engineHint: RegExp): AccessibilityNodeJs[] {
  const docs: { doc: AccessibilityNodeJs; nodes: AccessibilityNodeJs[] }[] = []
  ;(function walk(n: AccessibilityNodeJs) {
    if (n.role === AriaRole.Document) docs.push({ doc: n, nodes: flatten(n) })
    else for (const c of n.children) walk(c)
  })(root)
  const hinted = docs.filter((d) => engineHint.test(d.doc.name) || d.nodes.some((n) => engineHint.test(n.name)))
  if (!hinted.length) return []
  return hinted.reduce((a, b) => (a.nodes.length >= b.nodes.length ? a : b)).nodes
}

// ---------- citation extraction ----------
const IGNORE: string[] = config.ignoreDomains
const ignored = (d: string) => IGNORE.some((ig: string) => d === ig || d.endsWith('.' + ig))

// Chromium exposes each citation as a Link node whose accessible name includes
// the full href ("upkeepify https://upkeepify.com/blog/...") — parse those.
function extractCitations(nodes: AccessibilityNodeJs[]): { urls: string[]; domains: string[] } {
  const urls = new Set<string>()
  for (const n of nodes) {
    if (n.role !== AriaRole.Link) continue
    for (const m of labelOf(n).matchAll(/https?:\/\/[^\s"')\]]+/g)) urls.add(m[0])
  }
  const domains = new Set<string>()
  const keptUrls: string[] = []
  for (const u of urls) {
    try {
      const d = new URL(u).hostname.toLowerCase().replace(/^www\./, '')
      if (ignored(d)) continue
      domains.add(d)
      keptUrls.push(u)
    } catch {}
  }
  return { urls: keptUrls, domains: [...domains].sort() }
}

function extractAnswerText(nodes: AccessibilityNodeJs[]): string {
  return nodes
    .filter((n) => n.role === AriaRole.Text || n.role === AriaRole.ListItem)
    .map((n) => n.value || n.name)
    .filter((t) => t && t.length > 2 && !/^https?:/.test(t))
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 4000)
}

// ---------- scan loop ----------
type QueryResult = {
  query: string
  citedDomains: string[]
  citedUrls: string[]
  answerExcerpt: string
  screenshot: string
  scannedAt: string
  warning?: string
}

const results: QueryResult[] = []
const kb = new KeyboardController()
const engineHint = /perplexity/i

// Fresh start: kill any leftover scan browser, warm up the dedicated profile
// (first-run UI would swallow query 1), then resolve the real browser pid.
killScanBrowser()
await sleep(1500)
console.log('warming up scan browser…')
openUrl('about:blank')
await sleep(6000)
browserPid = scanBrowserPids()[0] ?? 0
if (!browserPid) {
  console.error('scan browser did not start')
  process.exit(1)
}
console.log(`scan browser pid: ${browserPid}`)

for (let i = 0; i < queries.length; i++) {
  const query = queries[i]
  const url = config.engine.searchUrl + encodeURIComponent(query)
  console.log(`[${i + 1}/${queries.length}] ${query}`)
  openUrl(url)
  await sleep(5000)

  let bound: { tree: AccessibilityTree; win: Window } | null = null
  for (let attempt = 0; attempt < 10 && !bound; attempt++) {
    bound = bindTree(query)
    if (!bound) await sleep(2000)
  }
  if (!bound) {
    console.log('  could not find the scan browser window — skipping')
    results.push({ query, citedDomains: [], citedUrls: [], answerExcerpt: '', screenshot: '', scannedAt: new Date().toISOString(), warning: 'browser window not found' })
    continue
  }
  const { tree, win } = bound

  // Phase A — wait for the answer to finish streaming. Done when a "N sources"
  // button appears (or text has been stable for a while). Inline citation
  // links, when present, are collected along the way.
  let prevLen = 0
  let stablePolls = 0
  let citations: { urls: string[]; domains: string[] } = { urls: [], domains: [] }
  let nodes: AccessibilityNodeJs[] = []
  let sourcesReady = false
  const started = Date.now()
  const deadline = started + 90_000
  while (Date.now() < deadline) {
    try {
      const root = tree.snapshot(false)
      nodes = contentNodes(root, engineHint)
      citations = extractCitations(nodes)
      const textLen = nodes.reduce((a, n) => a + labelOf(n).length, 0)
      sourcesReady = nodes.some((n) => /(\d+)\s*sources?|sources?\s*(\d+)/i.test(n.name))
      stablePolls = textLen === prevLen && textLen > 500 ? stablePolls + 1 : 0
      const dwell = Date.now() - started
      if ((sourcesReady || stablePolls >= 3) && dwell > 12_000) break
      prevLen = textLen
    } catch (e) {
      console.log('  snapshot retry:', e instanceof Error ? e.message : e)
    }
    await sleep(2500)
  }
  const answerNodes = nodes

  // Phase B — citations live behind the "N sources" button on some Perplexity
  // variants. Click it via the accessibility tree and read the drawer.
  if (sourcesReady) {
    try {
      const candidates = tree.find(TraversalOrder.DepthFirst, undefined, 'ources', false, 20, false)
      const btn = candidates.find((n) => /(\d+)\s*sources?|sources?\s*(\d+)/i.test(n.name) && n.refId != null)
      if (btn) {
        console.log(`  opening sources panel ("${btn.name.trim()}")`)
        tree.activate(btn.refId!)
        for (let attempt = 0; attempt < 6; attempt++) {
          await sleep(2000)
          nodes = contentNodes(tree.snapshot(false), engineHint)
          const drawer = extractCitations(nodes)
          if (drawer.domains.length > citations.domains.length) {
            citations = {
              urls: [...new Set([...citations.urls, ...drawer.urls])],
              domains: [...new Set([...citations.domains, ...drawer.domains])].sort(),
            }
            break
          }
        }
      }
    } catch (e) {
      console.log('  sources panel failed:', e instanceof Error ? e.message : e)
    }
  }

  if (process.env.SCAN_DEBUG) {
    const dump = (list: AccessibilityNodeJs[]) => list.map((n) => `${n.role}\t${labelOf(n)}`).join('\n')
    writeFileSync(resolve(OUT, `debug-q${String(i + 1).padStart(2, '0')}.txt`), dump(answerNodes) + '\n--- after sources click ---\n' + dump(nodes))
  }

  // screenshotCropped captures screen pixels, so our window must actually be
  // frontmost — focusElement raises it.
  const shotPath = resolve(SHOTS, `q${String(i + 1).padStart(2, '0')}.png`)
  try {
    const any = tree.find(TraversalOrder.DepthFirst, undefined, undefined, false, 1, false)[0]
    if (any?.refId != null) tree.focusElement(any.refId)
    await sleep(600)
    const b = win.boundingBox()
    screenshotCropped(b.left, b.top, b.right - b.left, b.bottom - b.top, true).save(shotPath)
  } catch (e) {
    console.log('  screenshot failed:', e instanceof Error ? e.message : e)
  }

  const result: QueryResult = {
    query,
    citedDomains: citations.domains,
    citedUrls: citations.urls,
    answerExcerpt: extractAnswerText(answerNodes),
    screenshot: `shots/q${String(i + 1).padStart(2, '0')}.png`,
    scannedAt: new Date().toISOString(),
  }
  if (citations.domains.length === 0) result.warning = 'no citations detected — page may not have finished loading or was blocked'
  results.push(result)
  console.log(`  cited: ${result.citedDomains.join(', ') || '(none)'}`)

  writeFileSync(
    resolve(OUT, 'scan-results.json'),
    JSON.stringify({ config: { target: config.target, competitors: config.competitors, engine: config.engine.name }, results }, null, 2),
  )
}

// Close the dedicated scan browser (the user's own browser is untouched).
killScanBrowser()

console.log(`\nDone. ${results.length} queries scanned -> out/scan-results.json`)
