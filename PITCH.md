# AI Rank — 3-minute pitch

## 0:00–0:30 · The problem (one breath)

> "SEO tools tell you your Google rank. Nobody tells you your **AI rank**.
> Your customers stopped searching — they ask Perplexity and ChatGPT, and the
> AI names three of your competitors. You are invisible and you don't even know it."

- Every founder in this room feels this. Discovery moved; measurement didn't.
- There is **no API** for "what does the AI answer say" — the answer only exists inside a real browser session.

## 0:30–1:45 · Live demo (the report is already generated — walk it, don't run it)

Open `out/report.html`:

1. **Share-of-AI-voice tile** — "We pointed it at our own product, HiJenny, live tonight. This is our real number."
2. **Leaderboard** — "This is who actually owns our niche's AI answers. Note reddit.com and youtube.com on this list — AI answers cite Reddit threads. Remember that."
3. **Query table + screenshot** — click one proof screenshot. "Every row is a real Perplexity session **driven by Simulang through the OS accessibility tree** — it waits for the answer to stream, then literally clicks the '10 sources' panel and reads the citations. No selectors, no API, no scraping endpoint. This is what Simulang exists for."
4. **The loop-closer** — scroll to the Reddit queue. "For every query we lose, our **SAI cloud agent** goes and finds the live Reddit thread where someone is asking that exact question — Reddit 403s every scripted client, but SAI drives a real browser — and drafts a genuinely helpful, disclosed reply. **Human-in-the-loop: nothing auto-posts.** That's a feature — authenticity is the only thing that works on Reddit."

## 1:45–2:20 · Why this wins

- **Measure → fix → win**: not another dashboard; the same tool that finds the gap queues the action that closes it (being the good answer in the thread Google and the AIs both surface).
- **Simular is load-bearing twice**: Simulang for the scan (bonus points), SAI agent for the research leg.
- **Customer**: any founder whose site traffic died when discovery moved to AI answers. Pricing writes itself: per-niche monitoring subscription.

## 2:20–3:00 · Close

> "At 6 PM we didn't know our AI rank. Now we do — it's on screen, with the
> receipts. And we have N approved-ready Reddit drafts for the exact questions
> we're losing. AI Rank: find out if the AI knows you exist — and fix it."

## Q&A ammo

- *"Isn't this scraping?"* — It's a real browser session reading its own screen via the accessibility tree, the same surface a screen reader uses; rate = a human doing 8 searches.
- *"Reddit spam?"* — Draft-only queue, mandatory human review, replies must answer the question and disclose affiliation. We enforce the format in the agent prompt.
- *"Why not the Perplexity API?"* — The consumer answer page (what buyers actually see) differs from API output; citations and ranking only exist in the product surface.
- *"What's next?"* — ChatGPT + Google AI Mode engines (config is already engine-parameterized), scheduled re-scans for trend lines, alerting when a competitor displaces you.
