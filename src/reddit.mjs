// Fallback Reddit thread finder.
// Reddit's public JSON API 403s scripted clients (which is exactly why the
// primary path is the SAI agent driving a real browser). Fallback: DuckDuckGo
// HTML results scoped to site:reddit.com. Drafts are left empty and clearly
// labeled — agent-written drafts only come from the SAI leg.

export async function findThreads(query, { limit = 2 } = {}) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:reddit.com ${query}`)}`
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ai-rank-hackathon/0.1' },
  })
  if (!r.ok) return []
  const html = await r.text()
  const out = []
  for (const m of html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    let href = m[1]
    const uddg = href.match(/uddg=([^&]+)/)
    if (uddg) href = decodeURIComponent(uddg[1])
    if (!/reddit\.com\/r\/[^/]+\/comments\//.test(href)) continue
    const title = m[2].replace(/<[^>]+>/g, '').trim()
    const sub = href.match(/reddit\.com\/(r\/[^/]+)/)?.[1] ?? ''
    out.push({
      query,
      thread_title: title,
      url: href,
      subreddit: sub,
      why_relevant: 'Top web result for this exact question on reddit',
      draft_reply: null,
      source: 'reddit-search-fallback',
    })
    if (out.length >= limit) break
  }
  return out
}

export async function findThreadsForQueries(queries, opts) {
  const out = []
  for (const q of queries) {
    try {
      out.push(...(await findThreads(q, opts)))
    } catch (e) {
      console.error(`thread search failed for "${q}":`, e.message)
    }
  }
  return out
}
