import { confirm } from '@inquirer/prompts'
import { loadMasterResume, loadCompany, loadVoiceProfile } from '../data/loader.js'
import { saveCompany } from '../data/writer.js'
import { reachoutPrompt } from '../analysis/prompts.js'
import { reachoutOutputSchema } from '../data/schema.js'
import type { Company } from '../data/schema.js'
import { callLlm } from '../utils/claude.js'
import { CliError } from '../utils/errors.js'
import { collectTextInput } from '../utils/input.js'
import { heading, success, info, spinner, errorMsg } from '../utils/terminal.js'
import chalk from 'chalk'

interface ReachoutOptions {
  readonly company?: string
  readonly url?: string
}

function cleanJsonResponse(raw: string): string {
  return raw.startsWith('```')
    ? raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    : raw
}

export async function reachoutCommand(opts: ReachoutOptions): Promise<void> {
  heading('LinkedIn Reachout Generator')

  const [voice, master] = await Promise.all([
    loadVoiceProfile(),
    loadMasterResume(),
  ])

  // Get LinkedIn profile text
  const profileResult = await collectTextInput({
    editorMessage: 'Paste the target person\'s LinkedIn profile text (opens editor):',
    urlPromptMessage: 'LinkedIn profile URL (or press Enter to paste manually):',
    url: opts.url,
  })

  if (!profileResult) {
    errorMsg('No LinkedIn profile provided')
    return
  }

  // Get JD context (optional)
  let jd: string | undefined
  let existingCompany: Company | undefined

  if (opts.company) {
    existingCompany = await loadCompany(opts.company)
    jd = existingCompany.jd
    info(`Using saved JD for ${existingCompany.name} — ${existingCompany.role}`)
  } else {
    const hasJd = await confirm({ message: 'Add a specific role/JD for context?', default: false })
    if (hasJd) {
      const jdResult = await collectTextInput({
        editorMessage: 'Paste the job description (opens editor):',
        required: false,
      })
      jd = jdResult?.text
    }
  }

  // Generate
  const spin = spinner('Crafting outreach with Claude...')
  const raw = await callLlm(reachoutPrompt(profileResult.text, master, voice, jd))
  const cleaned = cleanJsonResponse(raw)

  let result
  try {
    result = reachoutOutputSchema.parse(JSON.parse(cleaned))
  } catch (error) {
    spin.fail('Failed to parse response')
    throw new CliError(
      'Failed to parse reachout response',
      error instanceof Error ? error.message : 'Invalid JSON from Claude',
    )
  }
  spin.succeed('Outreach generated')

  // Display connection note
  console.log(chalk.bold('\n  Connection Note:'))
  console.log(`  ${result.connectionNote}`)
  console.log(chalk.dim(`  ${result.connectionNote.length} characters`))

  // Display follow-up message
  const wordCount = result.followUpMessage.split(/\s+/).length
  console.log(chalk.bold('\n  Follow-up DM:'))
  console.log(`  ${result.followUpMessage}`)
  console.log(chalk.dim(`  ${wordCount} words`))

  // Save to company record if applicable
  if (existingCompany) {
    const saveIt = await confirm({ message: 'Save reachout to company record?', default: true })
    if (saveIt) {
      await saveCompany({
        ...existingCompany,
        reachout: result,
        updatedAt: new Date().toISOString(),
      })
      success(`Reachout saved to "${existingCompany.slug}"`)
    }
  }
}
