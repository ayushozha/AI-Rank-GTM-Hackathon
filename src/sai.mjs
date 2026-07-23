// SAI (Simular) cloud agent client.
// Same REST surface as the sai CLI: Bearer sapi_ key, SSE task streaming.
import { requireEnv } from './env.mjs'

const BASE = process.env.SAI_API_BASE || 'https://api.sai.simular.ai'

function headers() {
  return { Authorization: `Bearer ${requireEnv('SAI_API_KEY')}` }
}

export async function listMachines() {
  const r = await fetch(`${BASE}/v1/agents/machines`, { headers: headers() })
  if (!r.ok) throw new Error(`SAI machines: HTTP ${r.status} ${await r.text()}`)
  const { machines } = await r.json()
  return machines
}

/**
 * Send a task to the SAI agent and stream the run until finish.
 * Returns { text, events } where text is the agent's final response text.
 */
export async function runAgentTask(message, { machineId, timeoutMs = 480_000, onProgress } = {}) {
  if (!machineId) {
    machineId = process.env.SAI_MACHINE_ID || (await listMachines())[0]?.machineId
    if (!machineId) throw new Error('No SAI machine available for this account')
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('SAI task timeout')), timeoutMs)
  try {
    const r = await fetch(`${BASE}/v1/agents/message`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId, message, attachments: [] }),
      signal: ctrl.signal,
    })
    if (!r.ok) throw new Error(`SAI message: HTTP ${r.status} ${await r.text()}`)

    let text = ''
    const events = []
    const decoder = new TextDecoder()
    let buf = ''
    for await (const chunk of r.body) {
      buf += decoder.decode(chunk, { stream: true })
      let nl
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        let ev
        try {
          ev = JSON.parse(payload)
        } catch {
          continue
        }
        events.push(ev.type)
        if (ev.type === 'text-delta') text += ev.delta ?? ev.textDelta ?? ''
        if (ev.type === 'reasoning-delta' && onProgress) onProgress(ev.delta ?? '')
        if (ev.type === 'data-approval-request' && onProgress) onProgress('[agent asked for approval]')
        if (ev.type === 'error') throw new Error(`SAI agent error: ${JSON.stringify(ev)}`)
        if (ev.type === 'finish') return { text, events }
      }
    }
    return { text, events }
  } finally {
    clearTimeout(timer)
  }
}

/** Pull the first JSON array/object out of agent text (handles ```json fences). */
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.search(/[[{]/)
  if (start === -1) throw new Error('No JSON found in agent response')
  return JSON.parse(candidate.slice(start))
}

export function redditHuntPrompt({ target, losingQueries }) {
  return [
    `You are doing GTM research. RESEARCH ONLY — do not post, reply, vote, or log in to anything.`,
    `Product: ${target.name} (${target.domain}) — ${target.pitch}`,
    `For each question below, search reddit.com for recent (last 12 months), active threads where someone is asking this or a closely related question.`,
    `Questions:`,
    ...losingQueries.map((q, i) => `${i + 1}. ${q}`),
    ``,
    `Return ONLY a JSON array (no prose) where each element is:`,
    `{"query": "...", "thread_title": "...", "url": "https://www.reddit.com/...", "subreddit": "...", "why_relevant": "...", "draft_reply": "..."}`,
    `Rules for draft_reply: genuinely helpful first, answer the person's actual question, mention ${target.name} once naturally with a disclosure ("I work on..."), no marketing language, under 120 words.`,
    `Find at most 2 threads per question. If you cannot find a good thread for a question, omit it.`,
  ].join('\n')
}
