import { input, confirm, editor } from '@inquirer/prompts'
import { isUrl, isLinkedInUrl, scrapeUrl } from './scraper.js'
import { getCachedScrape, cacheScrape } from './url-cache.js'
import { spinner, warn, info } from './terminal.js'
import chalk from 'chalk'

interface CollectTextInputOptions {
  readonly editorMessage: string
  readonly urlPromptMessage?: string
  readonly inputLabel?: string
  readonly required?: boolean
  readonly url?: string
}

export interface TextInputResult {
  readonly text: string
  readonly sourceUrl?: string
}

function previewLines(text: string, maxLines: number): string {
  const lines = text.split('\n').filter(l => l.trim())
  const preview = lines.slice(0, maxLines)
  const suffix = lines.length > maxLines ? chalk.dim(`\n  ... (${lines.length - maxLines} more lines)`) : ''
  return preview.map(l => `  ${l.trim()}`).join('\n') + suffix
}

export async function collectTextInput(options: CollectTextInputOptions): Promise<TextInputResult | undefined> {
  const {
    editorMessage,
    urlPromptMessage = 'Job posting URL (or press Enter to paste manually):',
    url: preSuppliedUrl,
  } = options

  const urlInput = preSuppliedUrl ?? await input({
    message: urlPromptMessage,
  })

  if (urlInput.trim() && isUrl(urlInput.trim())) {
    const trimmedUrl = urlInput.trim()

    // Check cache first
    const cached = await getCachedScrape(trimmedUrl)
    if (cached) {
      const titleDisplay = cached.title ? `"${cached.title}"` : trimmedUrl
      info(`Using cached content from ${titleDisplay}`)
      return { text: cached.text, sourceUrl: trimmedUrl }
    }

    // Fetch fresh
    const spinMessage = isLinkedInUrl(trimmedUrl)
      ? 'Fetching via Jina Reader (browser rendering)...'
      : 'Fetching content from URL...'
    const spin = spinner(spinMessage)
    try {
      const result = await scrapeUrl(trimmedUrl)
      const titleDisplay = result.title ? `"${result.title}"` : result.url
      spin.succeed(`Fetched from ${titleDisplay}`)

      console.log(chalk.dim('\n  Preview:'))
      console.log(chalk.dim(previewLines(result.text, 8)))
      console.log()

      const useIt = await confirm({ message: 'Use this content?', default: true })
      if (useIt) {
        await cacheScrape(trimmedUrl, result.text, result.title)
        return { text: result.text, sourceUrl: trimmedUrl }
      }
      // User rejected — fall through to editor
    } catch (error) {
      spin.fail('Failed to fetch URL')
      const message = error instanceof Error ? error.message : 'Unknown error'
      warn(message)
    }
  }

  // Fall through: open editor
  const text = await editor({
    message: editorMessage,
    waitForUserInput: false,
  })

  const trimmed = text.trim()
  if (!trimmed) {
    return undefined
  }

  return { text: trimmed }
}
