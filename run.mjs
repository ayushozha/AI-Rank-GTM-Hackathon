// AI Rank orchestrator:
//   node run.mjs               scan -> score -> SAI reddit hunt -> report
//   node run.mjs --no-scan     reuse out/scan-results.json
//   node run.mjs --no-sai      skip the SAI agent, use reddit search fallback
//   node run.mjs --limit 2     scan only the first N queries (smoke test)
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from './src/env.mjs'
import { score } from './src/score.mjs'
import { renderReport } from './src/report.mjs'
import { runAgentTask, extractJson, redditHuntPrompt } from './src/sai.mjs'
import { findThreadsForQueries } from './src/reddit.mjs'

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const OUT = resolve(ROOT, 'out')
mkdirSync(OUT, { recursive: true })
const resultsPath = resolve(OUT, 'scan-results.json')

// 1. Scan (Simulang drives the browser)
if (!has('--no-scan')) {
  const limitIdx = args.indexOf('--limit')
  const env = { ...process.env }
  if (limitIdx !== -1) env.SCAN_LIMIT = args[limitIdx + 1]
  console.log('▶ scanning AI answers via Simulang…')
  const r = spawnSync('simulang', ['run', 'scripts/scan-visibility.ts'], { cwd: ROOT, stdio: 'inherit', shell: true, env })
  if (r.status !== 0) console.error('scan exited non-zero — continuing with whatever was written')
}
if (!existsSync(resultsPath)) {
  console.error('No out/scan-results.json. Run without --no-scan first.')
  process.exit(1)
}

// 2. Score
const scan = JSON.parse(readFileSync(resultsPath, 'utf8'))
const s = score(scan)
console.log(`▶ share of AI voice for ${s.target}: ${s.shareOfVoice}% (cited ${s.citedCount}/${s.scannedQueries})`)
console.log(`▶ losing queries: ${s.losingQueries.length}`)

// 3. Reddit queue — SAI cloud agent first, public search fallback
let queue = []
const losing = s.losingQueries.slice(0, 5)
if (losing.length) {
  if (!has('--no-sai')) {
    try {
      console.log('▶ sending research task to SAI cloud agent…')
      const { text } = await runAgentTask(redditHuntPrompt({ target: scan.config.target, losingQueries: losing }), {
        onProgress: (t) => t && process.stdout.write('.'),
      })
      console.log()
      queue = extractJson(text)
      if (!Array.isArray(queue)) throw new Error('agent returned non-array')
      console.log(`▶ SAI agent returned ${queue.length} threads with drafts`)
    } catch (e) {
      console.error(`SAI agent leg failed (${e.message}) — falling back to reddit search`)
    }
  }
  if (!queue.length) {
    queue = await findThreadsForQueries(losing)
    console.log(`▶ reddit search fallback found ${queue.length} threads`)
  }
  writeFileSync(resolve(OUT, 'reddit-queue.json'), JSON.stringify(queue, null, 2))
}

// 4. Report
const html = renderReport(s, queue, { generatedAt: new Date().toLocaleString() })
const reportPath = resolve(OUT, 'report.html')
writeFileSync(reportPath, html)
console.log(`\n✔ report: ${reportPath}`)
