import { CliError } from './errors.js'

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024 // 2 MB
const FETCH_TIMEOUT_MS = 15_000

export interface ScrapeResult {
  readonly url: string
  readonly text: string
  readonly title: string
}

export function isUrl(value: string): boolean {
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return false
  }
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function isLinkedInUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')
  } catch {
    return false
  }
}

interface JinaResponse {
  readonly data: {
    readonly url: string
    readonly title: string
    readonly content: string
  }
}

async function scrapeWithJina(url: string, signal: AbortSignal): Promise<ScrapeResult> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'X-Engine': 'browser',
    'X-No-Cache': 'true',
  }
  if (process.env.JINA_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`
  }

  const response = await fetch(`https://r.jina.ai/${url}`, { signal, headers })

  if (!response.ok) {
    throw new CliError(
      `Jina Reader failed (HTTP ${response.status})`,
      'Paste the content manually instead',
    )
  }

  const json = (await response.json()) as JinaResponse
  const text = json.data?.content?.trim()

  if (!text) {
    throw new CliError(
      'No text content returned by Jina Reader',
      'Paste the content manually instead',
    )
  }

  return { url, text, title: json.data.title ?? '' }
}

export function stripHtml(html: string): string {
  return html
    // Remove script, style, and noscript blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Convert block elements to newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article|header|footer|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match
    ? match[1]!.replace(/\s+/g, ' ').trim()
    : ''
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  if (isLinkedInUrl(url)) {
    try {
      return await scrapeWithJina(url, controller.signal)
    } catch (error) {
      if (error instanceof CliError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CliError(
          'Request timed out after 15 seconds',
          'Paste the content manually instead',
        )
      }
      throw new CliError(
        'Could not fetch LinkedIn page',
        'Paste the content manually instead',
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResumeCliBot/1.0)',
        'Accept': 'text/html, text/plain',
      },
    })

    if (!response.ok) {
      throw new CliError(
        `Failed to fetch URL (HTTP ${response.status})`,
        'Check the URL and try again, or paste the content manually',
      )
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new CliError(
        `Unexpected content type: ${contentType}`,
        'URL must return HTML or plain text',
      )
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
      throw new CliError(
        'Response too large (over 2 MB)',
        'Try a direct link to the job posting',
      )
    }

    const html = await response.text()

    if (html.length > MAX_RESPONSE_BYTES) {
      throw new CliError(
        'Response too large (over 2 MB)',
        'Try a direct link to the job posting',
      )
    }

    const isPlainText = contentType.includes('text/plain')
    const text = isPlainText ? html.trim() : stripHtml(html)
    const title = isPlainText ? '' : extractTitle(html)

    if (!text) {
      throw new CliError(
        'No text content found on the page',
        'The page may require JavaScript — paste the content manually instead',
      )
    }

    return { url, text, title }
  } catch (error) {
    if (error instanceof CliError) {
      throw error
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new CliError(
        'Request timed out after 15 seconds',
        'Check your connection or paste the content manually',
      )
    }
    throw new CliError(
      'Failed to fetch URL',
      error instanceof Error ? error.message : 'Unknown error',
    )
  } finally {
    clearTimeout(timeout)
  }
}
