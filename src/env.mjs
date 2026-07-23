import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

try {
  process.loadEnvFile(resolve(ROOT, '.env'))
} catch {
  // .env optional — variables may come from the environment
}

export function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var ${name} (see .env.example)`)
  return v
}
