import { editor, confirm } from '@inquirer/prompts'
import { analyzeJd } from '../analysis/jd-parser.js'
import { coverLetterPrompt } from '../analysis/prompts.js'
import { loadMasterResume, loadCompany, loadVoiceProfile } from '../data/loader.js'
import { saveCompany, writeTextFile } from '../data/writer.js'
import { coverLetterOutputSchema } from '../data/schema.js'
import type { Company, JdAnalysis } from '../data/schema.js'
import { callLlm } from '../utils/claude.js'
import { CliError } from '../utils/errors.js'
import { collectTextInput } from '../utils/input.js'
import { getCachedAnalysis, cacheAnalysis } from '../utils/url-cache.js'
import { heading, success, info, spinner, errorMsg, domainFitBadge } from '../utils/terminal.js'
import chalk from 'chalk'

interface CoverLetterOptions {
  readonly company?: string
  readonly url?: string
}

function cleanJsonResponse(raw: string): string {
  return raw.startsWith('```')
    ? raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    : raw
}

export async function coverLetterCommand(opts: CoverLetterOptions): Promise<void> {
  heading('Cover Letter Generator')

  const [voice, master] = await Promise.all([
    loadVoiceProfile(),
    loadMasterResume(),
  ])

  // Get JD + analysis
  let jd: string
  let analysis: JdAnalysis
  let existingCompany: Company | undefined
  let companySlug: string | undefined

  if (opts.company) {
    existingCompany = await loadCompany(opts.company)
    jd = existingCompany.jd
    companySlug = existingCompany.slug
    info(`Using saved JD for ${existingCompany.name} — ${existingCompany.role}`)

    if (existingCompany.analysis) {
      analysis = existingCompany.analysis
      info('Using cached analysis')
    } else {
      const spin = spinner('Analyzing JD with Claude...')
      analysis = await analyzeJd(jd)
      spin.succeed('JD analyzed')
    }
  } else {
    const jdResult = await collectTextInput({
      editorMessage: 'Paste the job description (opens editor):',
      url: opts.url,
    })

    if (!jdResult) {
      errorMsg('No job description provided')
      return
    }
    jd = jdResult.text

    const cachedJdAnalysis = jdResult.sourceUrl ? await getCachedAnalysis(jdResult.sourceUrl) : undefined
    if (cachedJdAnalysis) {
      analysis = cachedJdAnalysis
      info('Using cached analysis')
    } else {
      const spin = spinner('Analyzing JD with Claude...')
      analysis = await analyzeJd(jd)
      spin.succeed('JD analyzed')

      if (jdResult.sourceUrl) {
        await cacheAnalysis(jdResult.sourceUrl, analysis)
      }
    }
  }

  // Brief analysis summary
  console.log(`\n  ${chalk.bold('Role:')} ${analysis.title} at ${analysis.company}`)
  console.log(`  ${chalk.bold('Domain:')} ${analysis.domain}`)
  console.log(`  ${chalk.bold('Fit:')} ${domainFitBadge(analysis.domainFit)}`)

  // Optional talking points
  let talkingPoints: string | undefined
  const addPoints = await confirm({ message: 'Add specific talking points?', default: false })
  if (addPoints) {
    const points = await editor({
      message: 'Enter talking points (opens editor):',
      waitForUserInput: false,
    })
    if (points.trim()) {
      talkingPoints = points
    }
  }

  // Generate
  const spin = spinner('Writing cover letter with Claude...')
  const raw = await callLlm(coverLetterPrompt(jd, analysis, master, voice, talkingPoints))
  const cleaned = cleanJsonResponse(raw)

  let result
  try {
    result = coverLetterOutputSchema.parse(JSON.parse(cleaned))
  } catch (error) {
    spin.fail('Failed to parse response')
    throw new CliError(
      'Failed to parse cover letter response',
      error instanceof Error ? error.message : 'Invalid JSON from Claude',
    )
  }
  spin.succeed('Cover letter generated')

  // Display
  const wordCount = result.coverLetter.split(/\s+/).length
  console.log(chalk.bold('\n  Cover Letter:'))
  console.log(`  ${result.coverLetter.split('\n').join('\n  ')}`)
  console.log(chalk.dim(`\n  ${wordCount} words`))

  // Save as text file
  const slug = companySlug ?? analysis.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const filePath = await writeTextFile(slug, master.name, 'CoverLetter', result.coverLetter)
  success(`Saved: ${filePath}`)

  // Save company record
  if (existingCompany) {
    if (!existingCompany.analysis) {
      await saveCompany({
        ...existingCompany,
        analysis,
        updatedAt: new Date().toISOString(),
      })
      success(`Analysis cached for "${existingCompany.slug}"`)
    }
  } else {
    const saveIt = await confirm({ message: 'Save this company for future use?', default: true })
    if (saveIt) {
      const now = new Date().toISOString()
      await saveCompany({
        slug,
        name: analysis.company,
        role: analysis.title,
        jd,
        analysis,
        versions: [],
        createdAt: now,
        updatedAt: now,
      })
      success(`Company saved as "${slug}"`)
    }
  }
}
