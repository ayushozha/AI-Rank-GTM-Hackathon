// Renders the AI Rank report — a dark "signal intelligence briefing".
// Self-contained single file: inline CSS/JS, system font stacks, no external
// requests. Chart colors are the dataviz-validated dark-mode palette.

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function verdictLine(s) {
  const name = s.targetName ?? s.target
  if (s.scannedQueries === 0) return `No signal yet for ${name}.`
  if (s.shareOfVoice === 0) return `The AI doesn't know ${name} exists.`
  if (s.shareOfVoice < 40) return `${name} is barely on the AI's radar.`
  if (s.shareOfVoice < 75) return `${name} is in the conversation — not owning it.`
  return `${name} owns its niche's AI answers.`
}

export function renderReport(s, queue, meta = {}) {
  const maxCount = Math.max(1, ...s.leaderboard.map((d) => d.count))
  const bars = s.leaderboard
    .slice(0, 14)
    .map((d, i) => {
      const w = Math.max(2, Math.round((100 * d.count) / maxCount))
      return `<div class="bar-row reveal" style="animation-delay:${0.55 + i * 0.06}s" data-tip="${esc(d.domain)} — cited in ${d.count} of ${s.scannedQueries} answers">
        <span class="bar-label">${esc(d.domain)}</span>
        <span class="bar-track"><span class="bar-fill ${d.kind}" style="--w:${w}%"></span></span>
        <span class="bar-value">${d.count}</span>
      </div>`
    })
    .join('\n')

  const rows = s.perQuery
    .map((r, i) => {
      const state = r.warning ? 'na' : r.targetCited ? 'win' : r.targetMentioned ? 'mention' : 'loss'
      const label = r.warning ? 'NO DATA' : r.targetCited ? 'CITED' : r.targetMentioned ? 'MENTIONED' : 'ABSENT'
      return `<tr class="reveal" style="animation-delay:${0.7 + i * 0.05}s">
      <td class="q">“${esc(r.query)}”</td>
      <td><span class="stamp ${state}">${label}</span></td>
      <td class="mono dim">${r.competitorsCited.map(esc).join(', ') || '—'}</td>
      <td class="mono dim">${r.citedDomains.slice(0, 5).map(esc).join(', ')}${r.citedDomains.length > 5 ? ` <span class="more">+${r.citedDomains.length - 5}</span>` : ''}</td>
      <td>${r.screenshot ? `<a href="${esc(r.screenshot)}" target="_blank">proof ↗</a>` : '—'}</td>
    </tr>`
    })
    .join('\n')

  const queueCards = (queue ?? [])
    .map(
      (t, i) => `<article class="card reveal" style="animation-delay:${0.4 + i * 0.08}s">
      <header>
        <span class="sub mono">${esc(t.subreddit ?? '')}</span>
        <span class="stamp ${t.source === 'reddit-search-fallback' ? 'na' : 'agent'}">${t.source === 'reddit-search-fallback' ? 'SEARCH FALLBACK' : 'DRAFTED BY SAI AGENT'}</span>
      </header>
      <h3><a href="${esc(t.url)}" target="_blank">${esc(t.thread_title)}</a></h3>
      <p class="why">${esc(t.why_relevant ?? '')} <em>— found for “${esc(t.query)}”</em></p>
      ${
        t.draft_reply
          ? `<textarea id="d${i}" rows="5" spellcheck="false">${esc(t.draft_reply)}</textarea>
             <div class="card-actions">
               <button data-copy="d${i}">copy draft</button>
               <span class="hint">human-in-the-loop — review, edit, post yourself. Nothing auto-posts.</span>
             </div>`
          : `<span class="hint">no draft — write a genuinely helpful reply in the thread.</span>`
      }
    </article>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Rank · ${esc(s.target)}</title>
<style>
  :root {
    color-scheme: dark;
    --page: #0c0c0b; --surface: #161614; --surface-2: #1d1d1a;
    --ink: #f4f2ea; --ink-2: #b8b5a6; --muted: #7c7a70;
    --hairline: #2b2b27; --border: rgba(255,255,255,.08);
    --target: #3987e5; --competitor: #d95926; --other: #3b3b37;
    --win: #0ca30c; --loss: #e66767;
    --serif: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
    --mono: 'Cascadia Mono', Consolas, 'SF Mono', 'Courier New', monospace;
  }
  * { box-sizing: border-box; margin: 0; }
  html { scroll-behavior: smooth; }
  body {
    font: 16px/1.55 var(--serif); background: var(--page); color: var(--ink);
    background-image:
      radial-gradient(1100px 480px at 75% -10%, rgba(57,135,229,.10), transparent 60%),
      radial-gradient(700px 380px at 8% 12%, rgba(217,89,38,.05), transparent 55%),
      repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,255,255,.006) 3px 4px);
    padding: 0 20px 96px;
  }
  main { max-width: 920px; margin: 0 auto; }

  .strip {
    display: flex; flex-wrap: wrap; gap: 8px 22px; padding: 14px 0;
    border-bottom: 1px solid var(--hairline);
    font: 11px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--muted);
  }
  .strip .live { color: var(--win); }
  .strip .live::before { content: "●"; margin-right: 6px; animation: pulse 2.4s infinite; }
  @keyframes pulse { 50% { opacity: .3; } }

  header.masthead { padding: 56px 0 34px; border-bottom: 1px solid var(--hairline); }
  .brand { font: 12px var(--mono); letter-spacing: .34em; color: var(--target); text-transform: uppercase; }
  h1 { font-size: clamp(34px, 5.4vw, 56px); line-height: 1.06; font-weight: 500; letter-spacing: -.01em; margin: 14px 0 10px; max-width: 17ch; }
  .dek { color: var(--ink-2); font-size: 17px; max-width: 58ch; font-style: italic; }

  .tiles { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 1px; background: var(--hairline); border: 1px solid var(--hairline); margin: 40px 0; }
  @media (max-width: 700px) { .tiles { grid-template-columns: 1fr; } }
  .tile { background: var(--surface); padding: 26px 24px 22px; }
  .tile .num { font: 600 56px/1 var(--mono); font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
  .tile.hero .num { font-size: 92px; color: var(--target); }
  .tile .num .den { font-size: .45em; color: var(--muted); font-weight: 400; }
  .tile .cap { margin-top: 10px; color: var(--ink-2); font-size: 13.5px; }
  .tile .word { font: 500 26px/1.15 var(--serif); overflow-wrap: anywhere; }

  section { margin: 54px 0; }
  h2 { font: 11px var(--mono); letter-spacing: .22em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--hairline); padding-bottom: 10px; margin-bottom: 22px; }
  h2 b { color: var(--ink); font-weight: 400; }

  .bar-row { display: grid; grid-template-columns: 200px 1fr 40px; gap: 12px; align-items: center; padding: 4px 0; }
  .bar-label { font: 13px var(--mono); color: var(--ink-2); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { border-left: 1px solid var(--hairline); height: 18px; }
  .bar-fill { display: block; height: 12px; margin-top: 3px; border-radius: 0 4px 4px 0; width: var(--w); animation: grow .8s cubic-bezier(.2,.7,.2,1) backwards; }
  @keyframes grow { from { width: 0; } }
  .bar-fill.target { background: var(--target); box-shadow: 0 0 18px rgba(57,135,229,.35); }
  .bar-fill.competitor { background: var(--competitor); }
  .bar-fill.other { background: var(--other); }
  .bar-value { font: 13px var(--mono); color: var(--ink-2); font-variant-numeric: tabular-nums; }
  .legend { display: flex; gap: 20px; margin-top: 16px; font: 12px var(--mono); color: var(--ink-2); }
  .legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 7px; vertical-align: -1px; }
  .legend .l-t::before { background: var(--target); } .legend .l-c::before { background: var(--competitor); } .legend .l-o::before { background: var(--other); }

  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th { font: 10px var(--mono); letter-spacing: .18em; text-transform: uppercase; color: var(--muted); text-align: left; font-weight: 400; padding: 0 14px 10px 0; border-bottom: 1px solid var(--hairline); }
  td { padding: 12px 14px 12px 0; border-bottom: 1px solid var(--hairline); vertical-align: top; }
  td.q { font-style: italic; max-width: 30ch; }
  .mono { font-family: var(--mono); font-size: 12px; } .dim { color: var(--ink-2); } .more { color: var(--muted); }
  a { color: var(--target); text-decoration: none; border-bottom: 1px solid rgba(57,135,229,.35); }
  a:hover { border-bottom-color: var(--target); }

  .stamp { font: 10px var(--mono); letter-spacing: .16em; padding: 4px 8px; border: 1px solid; border-radius: 3px; white-space: nowrap; }
  .stamp.win { color: var(--win); border-color: rgba(12,163,12,.5); }
  .stamp.mention { color: var(--ink-2); border-color: var(--border); }
  .stamp.loss { color: var(--loss); border-color: rgba(230,103,103,.45); }
  .stamp.na { color: var(--muted); border-color: var(--border); }
  .stamp.agent { color: var(--target); border-color: rgba(57,135,229,.5); }

  .card { background: var(--surface); border: 1px solid var(--border); border-left: 2px solid var(--competitor); padding: 20px 22px; margin-bottom: 14px; }
  .card header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 8px; }
  .card .sub { font-size: 12px; color: var(--competitor); }
  .card h3 { font-weight: 500; font-size: 19px; line-height: 1.3; margin-bottom: 6px; }
  .card h3 a { border-bottom-color: transparent; color: var(--ink); } .card h3 a:hover { color: var(--target); }
  .card .why { color: var(--ink-2); font-size: 13.5px; margin-bottom: 12px; }
  textarea { width: 100%; font: 13px/1.6 var(--mono); color: var(--ink); background: var(--page); border: 1px solid var(--hairline); border-radius: 4px; padding: 12px; resize: vertical; }
  textarea:focus { outline: 1px solid var(--target); }
  .card-actions { display: flex; align-items: center; gap: 14px; margin-top: 10px; }
  button { font: 11px var(--mono); letter-spacing: .12em; text-transform: uppercase; padding: 8px 14px; border-radius: 3px; border: 1px solid var(--target); background: transparent; color: var(--target); cursor: pointer; transition: background .15s, color .15s; }
  button:hover { background: var(--target); color: var(--page); }
  .hint { color: var(--muted); font-size: 12px; font-style: italic; }

  footer { border-top: 1px solid var(--hairline); padding-top: 18px; font: 12px/1.7 var(--mono); color: var(--muted); }

  .reveal { animation: rise .6s cubic-bezier(.2,.7,.2,1) backwards; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } }
  @media (prefers-reduced-motion: reduce) { .reveal, .bar-fill, .strip .live::before { animation: none !important; } }

  #tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--page); font: 12px var(--mono); padding: 5px 9px; border-radius: 4px; display: none; z-index: 9; }
</style></head><body>
<div id="tip"></div>
<main>
  <div class="strip reveal">
    <span class="live">live scan</span>
    <span>${esc(s.engine?.name ?? s.engine ?? 'AI engine')}</span>
    <span>${s.scannedQueries}/${s.totalQueries} queries</span>
    <span>accessibility-tree capture · simulang</span>
    <span>${esc(meta.generatedAt ?? '')}</span>
  </div>

  <header class="masthead">
    <div class="brand reveal" style="animation-delay:.08s">AI Rank · share of AI voice</div>
    <h1 class="reveal" style="animation-delay:.16s">${esc(verdictLine(s))}</h1>
    <p class="dek reveal" style="animation-delay:.24s">When buyers ask ${esc(s.engine?.name ?? s.engine ?? 'an AI engine')} the ${s.scannedQueries} questions that define this niche, this is who the answers actually send them to — measured in a live browser session, with receipts.</p>
  </header>

  <div class="tiles">
    <div class="tile hero reveal" style="animation-delay:.32s"><div class="num">${s.shareOfVoice}<span class="den">%</span></div><div class="cap">share of AI voice — answers citing or naming <b>${esc(s.target)}</b></div></div>
    <div class="tile reveal" style="animation-delay:.40s"><div class="num">${s.citedCount}<span class="den">/${s.scannedQueries}</span></div><div class="cap">answers citing ${esc(s.target)} as a source</div></div>
    <div class="tile reveal" style="animation-delay:.48s"><div class="word">${esc(s.leaderboard[0]?.domain ?? '—')}</div><div class="cap">most-cited domain in the niche (${s.leaderboard[0]?.count ?? 0} citations)</div></div>
  </div>

  <section>
    <h2>Citation leaderboard — <b>who owns this niche's AI answers</b></h2>
    ${bars || '<p class="hint">No citations captured — run the scan first.</p>'}
    <div class="legend reveal" style="animation-delay:.9s"><span class="l-t">${esc(s.target)} (you)</span><span class="l-c">competitor</span><span class="l-o">other sources</span></div>
  </section>

  <section>
    <h2>Query ledger — <b>every answer, with proof</b></h2>
    <div class="scroll"><table>
      <thead><tr><th>buyer question</th><th>you</th><th>competitors cited</th><th>cited domains</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>

  <section>
    <h2>Close the gap — <b>${(queue ?? []).length} live reddit threads asking these exact questions</b></h2>
    ${queueCards || '<p class="hint">No queue yet — the SAI agent step has not run.</p>'}
  </section>

  <footer>
    scan: simulang drives a dedicated browser through real ${esc(s.engine?.name ?? s.engine ?? '')} sessions and reads answers via the OS accessibility tree — no selectors, no API.<br>
    queue: SAI cloud agent research over live reddit (or search fallback, labeled). every reply requires human review — nothing is posted automatically.
  </footer>
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
  document.querySelectorAll('button[data-copy]').forEach((b) => {
    b.addEventListener('click', () => {
      navigator.clipboard.writeText(document.getElementById(b.dataset.copy).value)
      const old = b.textContent
      b.textContent = 'copied ✓'
      setTimeout(() => (b.textContent = old), 1400)
    })
  })
</script>
</body></html>`
}
