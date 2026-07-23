# AI Rank

**SEO tools tell you your Google rank. Nobody tells you your AI rank.** AI Rank measures your *share of AI voice* — whether AI answer engines cite or even name your product when your customers ask — and closes the loop by finding the live Reddit threads where those same questions are being asked, with agent-drafted replies queued for human approval.

Built at the GTM Hackathon (2026-07-22) on the Simular stack.

## How it works

```
┌─────────────────────┐     ┌──────────────┐     ┌─────────────────────────┐
│ Simulang scan        │     │ score.mjs    │     │ SAI cloud agent          │
│ drives a dedicated   │ ──▶ │ share of AI  │ ──▶ │ hunts live Reddit threads│
│ browser through      │     │ voice, gaps, │     │ for losing queries,      │
│ Perplexity queries   │     │ leaderboard  │     │ drafts replies (SSE)     │
│ via the OS a11y tree │     └──────────────┘     └────────────┬────────────┘
└─────────────────────┘                                        │
                      ┌────────────────────────────────────────┘
                      ▼
            out/report.html — scorecard + human-approval queue
```

1. **Scan (Simulang, load-bearing).** `scripts/scan-visibility.ts` launches a *dedicated* Chromium instance (own profile — your browser stays untouched), runs each ICP query through Perplexity, waits for the answer to finish streaming, **clicks the "N sources" panel via the accessibility tree** (no selectors, no API — none exists for this), and records every cited URL/domain plus a window screenshot as proof.
2. **Score.** `src/score.mjs` computes share of AI voice: per query, is your domain **cited** as a source, merely **mentioned** by name, or absent — plus a citation leaderboard of who actually owns your niche's AI answers.
3. **Close the loop (SAI, load-bearing).** `run.mjs` sends the losing queries to your **SAI cloud agent** (`POST /v1/agents/message`, SSE) which researches live Reddit threads asking those exact questions and drafts genuinely-helpful replies. Reddit 403s scripted clients — the SAI agent drives a real browser, which is exactly the point. Fallback: DuckDuckGo `site:reddit.com` search (drafts left empty, clearly labeled).
4. **Report.** `out/report.html` — self-contained scorecard: share-of-voice tiles, citation leaderboard, query-by-query proof table with screenshots, and the Reddit approval queue. **Nothing auto-posts — every reply requires human review.**

## Quick start

```powershell
npm install -g @simular-ai/simulang   # Simulang CLI (installs simulang-js)
Copy-Item .env.example .env           # then put your sapi_ key in .env
node run.mjs                          # scan -> score -> SAI agent -> report
Start-Process out\report.html
```

Useful variants:

```powershell
node run.mjs --limit 2      # smoke test: only the first 2 queries
node run.mjs --no-scan      # reuse the last scan, rebuild queue + report
node run.mjs --no-sai       # skip the SAI agent, use the search fallback
```

## Configuration

| Surface | What it controls |
|---|---|
| `config.json` | target domain/name/pitch, competitor domains, the ICP queries, answer engine URL, ignored domains |
| `.env` → `SAI_API_KEY` | SAI API key (`sapi_...`) — **required** for the agent leg |
| `.env` → `SAI_API_BASE` | SAI API host. Default hits the Cloud Run host directly because `api.sai.simular.ai` currently serves a mismatched TLS cert |
| `.env` → `SAI_MACHINE_ID` | pin a specific SAI machine; defaults to the first from `GET /v1/agents/machines` |
| `SCAN_LIMIT` / `SCAN_DEBUG` / `SCAN_BROWSER` (env) | cap query count / dump a11y labels to `out/debug-q*.txt` / override browser exe path |

## Repository map

```
scripts/scan-visibility.ts   Simulang scan (a11y-tree driving, citation extraction)
src/sai.mjs                  SAI API client: machines, SSE task streaming, prompt
src/reddit.mjs               fallback thread finder (DuckDuckGo site:reddit.com)
src/score.mjs                share-of-AI-voice scoring
src/report.mjs               self-contained HTML report renderer
run.mjs                      orchestrator
config.json                  target, competitors, queries
out/                         (gitignored) scan results, screenshots, report
```

## Status

| Piece | State |
|---|---|
| Simulang Perplexity scan (dedicated browser, sources-panel click) | working, validated live |
| Scoring + report | working |
| SAI agent Reddit hunt | wired; falls back to DDG search on timeout/failure |
| ChatGPT/Google AI engines | roadmap — `config.json` already parameterizes the engine |

## Notes & constraints

- Windows-first (window binding uses UIA; browser discovery checks Chrome/Edge paths). macOS would need `simulang setup` and small tweaks.
- The scan machine's *screen* is captured for proof screenshots — leave the scan window unobstructed for pretty shots; extraction itself is a11y-based and works even when covered.
- Logged-out Perplexity answers cite fewer sources than logged-in ones; the scan profile persists in `out/scan-profile` so you can sign in once to enrich results.
- Rate limits: SAI messages 60/hour. Scan pacing is ~40–60s per query.
- No license file is currently checked in.
