// Share-of-AI-voice scoring over scan-results.json.
// "Cited" = the answer links the domain as a source (the GEO win).
// "Mentioned" = the brand name appears in the answer text without a link.

const hit = (domains, d) => domains.some((x) => x === d || x.endsWith('.' + d))
const stem = (domain) => domain.split('.')[0]

function mentioned(text, target) {
  const names = [target.name, stem(target.domain)].filter(Boolean)
  return names.some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text ?? ''))
}

export function score(scan) {
  const { results } = scan
  const target = scan.config.target.domain
  const competitors = scan.config.competitors

  const perQuery = results.map((r) => ({
    ...r,
    targetCited: hit(r.citedDomains, target),
    targetMentioned: mentioned(r.answerExcerpt, scan.config.target),
    competitorsCited: competitors.filter((c) => hit(r.citedDomains, c)),
  }))

  const counts = new Map()
  for (const r of results) for (const d of r.citedDomains) counts.set(d, (counts.get(d) ?? 0) + 1)
  const leaderboard = [...counts.entries()]
    .map(([domain, count]) => ({
      domain,
      count,
      kind: hit([domain], target) ? 'target' : competitors.some((c) => hit([domain], c)) ? 'competitor' : 'other',
    }))
    .sort((a, b) => b.count - a.count)

  const scanned = perQuery.filter((r) => !r.warning)
  const cited = perQuery.filter((r) => r.targetCited).length
  const visible = perQuery.filter((r) => r.targetCited || r.targetMentioned).length
  return {
    target,
    targetName: scan.config.target.name,
    competitors,
    engine: scan.config.engine,
    shareOfVoice: scanned.length ? Math.round((100 * visible) / scanned.length) : 0,
    citedCount: cited,
    visibleCount: visible,
    totalQueries: perQuery.length,
    scannedQueries: scanned.length,
    losingQueries: perQuery.filter((r) => !r.targetCited && !r.targetMentioned && !r.warning).map((r) => r.query),
    perQuery,
    leaderboard,
  }
}
