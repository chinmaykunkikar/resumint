import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import YAML from 'yaml'
import type { JdAnalysis } from '../data/schema.js'
import { PATHS } from '../data/paths.js'

interface CacheEntry {
  readonly url: string
  readonly text: string
  readonly title: string
  readonly analysis?: JdAnalysis
  readonly cachedAt: string
}

interface CacheStore {
  readonly [urlHash: string]: CacheEntry
}

function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Strip tracking params for better cache hits
    parsed.searchParams.delete('gh_src')
    parsed.searchParams.delete('source')
    parsed.searchParams.delete('utm_source')
    parsed.searchParams.delete('utm_medium')
    parsed.searchParams.delete('utm_campaign')
    parsed.searchParams.delete('utm_content')
    parsed.searchParams.delete('utm_term')
    return parsed.toString()
  } catch {
    return url
  }
}

async function loadCache(): Promise<CacheStore> {
  try {
    const content = await fs.readFile(PATHS.urlCache, 'utf-8')
    return (YAML.parse(content) as CacheStore) ?? {}
  } catch {
    return {}
  }
}

async function saveCache(store: CacheStore): Promise<void> {
  const content = YAML.stringify(store, { lineWidth: 120 })
  await fs.writeFile(PATHS.urlCache, content, 'utf-8')
}

export async function getCachedScrape(url: string): Promise<{ text: string; title: string } | undefined> {
  const store = await loadCache()
  const entry = store[hashUrl(normalizeUrl(url))]
  if (!entry) return undefined
  return { text: entry.text, title: entry.title }
}

export async function getCachedAnalysis(url: string): Promise<JdAnalysis | undefined> {
  const store = await loadCache()
  const entry = store[hashUrl(normalizeUrl(url))]
  return entry?.analysis
}

export async function cacheScrape(url: string, text: string, title: string): Promise<void> {
  const store = await loadCache()
  const normalized = normalizeUrl(url)
  const key = hashUrl(normalized)
  const existing = store[key]

  await saveCache({
    ...store,
    [key]: {
      ...existing,
      url: normalized,
      text,
      title,
      cachedAt: existing?.cachedAt ?? new Date().toISOString(),
    },
  })
}

export async function cacheAnalysis(url: string, analysis: JdAnalysis): Promise<void> {
  const store = await loadCache()
  const normalized = normalizeUrl(url)
  const key = hashUrl(normalized)
  const existing = store[key]

  if (!existing) return // only cache analysis if scrape was cached first

  await saveCache({
    ...store,
    [key]: {
      ...existing,
      analysis,
    },
  })
}
