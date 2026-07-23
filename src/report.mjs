// Renders out/report.html — Share-of-AI-Voice scorecard + Reddit approval queue.
// Self-contained single file: inline CSS/JS, no external requests.

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function renderReport(s, queue, meta = {}) {
  const maxCount = Math.max(1, ...s.leaderboard.map((d) => d.count))
  const bars = s.leaderboard
    .slice(0, 14)
    .map((d) => {
      const w = Math.round((100 * d.count) / maxCount)
      return `<div class="bar-row" data-tip="${esc(d.domain)} — cited in ${d.count} of ${s.scannedQueries} answers">
        <span class="bar-label">${esc(d.domain)}</span>
        <span class="bar-track"><span class="bar-fill ${d.kind}" style="width:${w}%"></span></span>
        <span class="bar-value">${d.count}</span>
      </div>`
    })
    .join('\n')

  const rows = s.perQuery
    .map(
      (r) => `<tr>
      <td>${esc(r.query)}</td>
      <td class="${r.warning ? 'na' : r.targetCited ? 'win' : r.targetMentioned ? 'mention' : 'loss'}">${r.warning ? 'n/a' : r.targetCited ? 'CITED' : r.targetMentioned ? 'mentioned' : 'absent'}</td>
      <td>${r.competitorsCited.map(esc).join(', ') || '—'}</td>
      <td class="domains">${r.citedDomains.slice(0, 6).map(esc).join(', ')}${r.citedDomains.length > 6 ? ` +${r.citedDomains.length - 6}` : ''}</td>
      <td><a href="${esc(r.screenshot)}" target="_blank">shot</a></td>
    </tr>`
    )
    .join('\n')

  const queueCards = (queue ?? [])
    .map(
      (t, i) => `<div class="card">
      <div class="card-head">
        <span class="sub">${esc(t.subreddit ?? '')}</span>
        <a href="${esc(t.url)}" target="_blank">${esc(t.thread_title)}</a>
      </div>
      <p class="why">${esc(t.why_relevant ?? '')} <em>· found for: “${esc(t.query)}”</em>${t.source === 'reddit-search-fallback' ? ' <em>· via reddit search (fallback)</em>' : ' · <strong>drafted by SAI agent</strong>'}</p>
      ${
        t.draft_reply
          ? `<textarea id="d${i}" rows="4">${esc(t.draft_reply)}</textarea>
             <button onclick="navigator.clipboard.writeText(document.getElementById('d${i}').value)">Copy draft</button>
             <span class="hint">Human-in-the-loop: review, edit, and post yourself. Nothing auto-posts.</span>`
          : `<span class="hint">No draft — write a genuinely helpful reply in the thread.</span>`
      }
    </div>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Rank — ${esc(s.target)}</title>
<style>
  :root {
    color-scheme: light;
    --surface: #fcfcfb; --page: #f9f9f7; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
    --grid: #e1e0d9; --border: rgba(11,11,11,.10);
    --target: #2a78d6; --competitor: #eb6834; --other: #c3c2b7;
    --win: #006300; --loss: #d03b3b;
  }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    color-scheme: dark;
    --surface: #1a1a19; --page: #0d0d0d; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --border: rgba(255,255,255,.10);
    --target: #3987e5; --competitor: #d95926; --other: #383835;
    --win: #0ca30c; --loss: #e66767;
  }}
  :root[data-theme="dark"] {
    color-scheme: dark;
    --surface: #1a1a19; --page: #0d0d0d; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --border: rgba(255,255,255,.10);
    --target: #3987e5; --competitor: #d95926; --other: #383835;
    --win: #0ca30c; --loss: #e66767;
  }
  * { box-sizing: border-box; margin: 0; }
  body { font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--page); color: var(--ink); padding: 32px 20px 80px; }
  main { max-width: 880px; margin: 0 auto; display: grid; gap: 20px; }
  header h1 { font-size: 22px; } header p { color: var(--ink-2); }
  section { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
  h2 { font-size: 15px; margin-bottom: 14px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .tile { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; }
  .tile .num { font-size: 34px; font-weight: 650; }
  .tile .cap { color: var(--ink-2); font-size: 13px; }
  .bar-row { display: grid; grid-template-columns: 190px 1fr 34px; gap: 10px; align-items: center; padding: 3px 0; position: relative; }
  .bar-label { font-size: 13px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }
  .bar-track { border-left: 1px solid var(--grid); height: 16px; }
  .bar-fill { display: block; height: 12px; margin-top: 2px; border-radius: 0 4px 4px 0; }
  .bar-fill.target { background: var(--target); } .bar-fill.competitor { background: var(--competitor); } .bar-fill.other { background: var(--other); }
  .bar-value { font-size: 13px; font-variant-numeric: tabular-nums; color: var(--ink-2); }
  .legend { display: flex; gap: 16px; margin-top: 12px; font-size: 13px; color: var(--ink-2); }
  .legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; }
  .legend .l-t::before { background: var(--target); } .legend .l-c::before { background: var(--competitor); } .legend .l-o::before { background: var(--other); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: var(--muted); font-weight: 500; padding: 6px 10px 6px 0; border-bottom: 1px solid var(--grid); }
  td { padding: 8px 10px 8px 0; border-bottom: 1px solid var(--grid); vertical-align: top; }
  td.win { color: var(--win); font-weight: 600; } td.loss { color: var(--loss); } td.na { color: var(--muted); }
  td.mention { color: var(--ink-2); font-weight: 600; }
  td.domains { color: var(--ink-2); }
  a { color: var(--target); }
  .card { border: 1px solid var(--border); border-radius: 8px; padding: 14px; margin-bottom: 12px; }
  .card-head a { font-weight: 600; text-decoration: none; } .card .sub { color: var(--muted); font-size: 12px; margin-right: 8px; }
  .card .why { color: var(--ink-2); font-size: 13px; margin: 6px 0 10px; }
  textarea { width: 100%; font: 13px/1.5 system-ui, sans-serif; color: var(--ink); background: var(--page); border: 1px solid var(--grid); border-radius: 6px; padding: 8px; }
  button { margin-top: 8px; font: 13px system-ui, sans-serif; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); cursor: pointer; }
  .hint { display: block; margin-top: 6px; color: var(--muted); font-size: 12px; }
  footer { color: var(--muted); font-size: 12px; }
  #tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--page); font-size: 12px; padding: 4px 8px; border-radius: 5px; display: none; z-index: 9; }
</style></head><body>
<div id="tip"></div>
<main>
  <header>
    <h1>AI Rank — share of AI voice for ${esc(s.target)}</h1>
    <p>${esc(s.engine?.name ?? s.engine ?? 'AI answer engine')} · ${s.scannedQueries} live queries scanned via Simulang (accessibility tree, no APIs) · ${esc(meta.generatedAt ?? '')}</p>
  </header>

  <div class="tiles">
    <div class="tile"><div class="num">${s.shareOfVoice}%</div><div class="cap">share of AI voice — answers citing or naming ${esc(s.targetName ?? s.target)}</div></div>
    <div class="tile"><div class="num">${s.citedCount}<span style="color:var(--muted)">/${s.scannedQueries}</span></div><div class="cap">answers citing ${esc(s.target)} as a source</div></div>
    <div class="tile"><div class="num">${esc(s.leaderboard[0]?.domain ?? '—')}</div><div class="cap">most-cited domain in your niche</div></div>
  </div>

  <section>
    <h2>Who AI answers actually cite (citations across ${s.scannedQueries} queries)</h2>
    ${bars || '<p class="hint">No citations captured — run the scan first.</p>'}
    <div class="legend"><span class="l-t">${esc(s.target)} (you)</span><span class="l-c">competitor</span><span class="l-o">other sources</span></div>
  </section>

  <section>
    <h2>Query-by-query results</h2>
    <div style="overflow-x:auto"><table>
      <thead><tr><th>ICP query</th><th>You</th><th>Competitors cited</th><th>Cited domains</th><th>Proof</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>

  <section>
    <h2>Fix the gap — live Reddit threads asking these exact questions (${(queue ?? []).length})</h2>
    ${queueCards || '<p class="hint">No queue yet — the SAI agent step has not run.</p>'}
  </section>

  <footer>Scan: Simulang drives a real browser session and reads the answer via the OS accessibility tree. Queue: SAI cloud agent research (or reddit search fallback). All replies require human review — nothing is posted automatically.</footer>
</main>
<script>
  const tip = document.getElementById('tip')
  document.querySelectorAll('[data-tip]').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      tip.textContent = el.dataset.tip
      tip.style.display = 'block'
      tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px'
      tip.style.top = e.clientY + 14 + 'px'
    })
    el.addEventListener('mouseleave', () => (tip.style.display = 'none'))
  })
</script>
</body></html>`
}
