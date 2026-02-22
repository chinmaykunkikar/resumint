import { confirm, select } from '@inquirer/prompts'
import { analyzeJd } from '../analysis/jd-parser.js'
import { buildSkillReport, displaySkillReport } from '../analysis/skill-matcher.js'
import { scoreProfile } from '../analysis/profile-scorer.js'
import { assembleFromProfile } from '../customization/resume-assembler.js'
import { renderResume } from '../latex/renderer.js'
import { compilePdf } from '../latex/compiler.js'
import { writeTexFile } from '../data/writer.js'
import { loadMasterResume, loadProfile, listProfiles } from '../data/loader.js'
import { collectTextInput } from '../utils/input.js'
import { getCachedAnalysis, cacheAnalysis } from '../utils/url-cache.js'
import { revisionLoop } from '../utils/revise.js'
import { heading, success, warn, errorMsg, spinner, info, domainFitBadge } from '../utils/terminal.js'
import chalk from 'chalk'

interface QuickOptions {
  readonly profile?: string
  readonly url?: string
}

export async function quickCommand(opts: QuickOptions): Promise<void> {
  heading('Quick Match')

  // 1. Get JD
  const result = await collectTextInput({
    editorMessage: 'Paste the job description (opens editor):',
    url: opts.url,
  })

  if (!result) {
    errorMsg('No job description provided')
    return
  }

  // 2. Analyze JD (check cache first)
  const cachedAnalysis = result.sourceUrl ? await getCachedAnalysis(result.sourceUrl) : undefined
  let analysis
  if (cachedAnalysis) {
    info('Using cached analysis')
    analysis = cachedAnalysis
  } else {
    const spin = spinner('Analyzing job description...')
    analysis = await analyzeJd(result.text)
    spin.succeed('JD analyzed')

    if (result.sourceUrl) {
      await cacheAnalysis(result.sourceUrl, analysis)
    }
  }

  // 3. Show analysis summary
  console.log(`\n  ${chalk.bold('Role:')} ${analysis.title} at ${analysis.company}`)
  console.log(`  ${chalk.bold('Seniority:')} ${analysis.seniority}`)
  console.log(`  ${chalk.bold('Domain:')} ${analysis.domain}`)
  console.log(`  ${chalk.bold('Fit:')} ${domainFitBadge(analysis.domainFit)}`)

  if (analysis.domainFit === 'mismatch') {
    errorMsg(`Domain mismatch: ${analysis.domainFitReason}`)
    const proceed = await confirm({ message: 'Continue anyway?', default: false })
    if (!proceed) return
  } else if (analysis.domainFit === 'weak') {
    warn(`Weak fit: ${analysis.domainFitReason}`)
  }

  // 4. Trophy System
  const report = buildSkillReport(analysis)
  displaySkillReport(report)

  // 5. Profile scoring
  const master = await loadMasterResume()
  const profileNames = await listProfiles()

  if (profileNames.length === 0) {
    errorMsg('No profiles found. Run "resume init" first.')
    return
  }

  let selectedProfileName: string

  if (opts.profile) {
    if (!profileNames.includes(opts.profile)) {
      errorMsg(`Profile "${opts.profile}" not found. Available: ${profileNames.join(', ')}`)
      return
    }
    selectedProfileName = opts.profile
  } else {
    const scores = await Promise.all(
      profileNames.map(async (name) => {
        const profile = await loadProfile(name)
        return scoreProfile(profile, analysis, master)
      }),
    )

    scores.sort((a, b) => b.totalScore - a.totalScore)

    console.log(chalk.bold('\n  Profile Rankings:'))
    for (const score of scores) {
      const bar = '█'.repeat(Math.round(score.totalScore / 5))
      const color = score.totalScore >= 60 ? chalk.green : score.totalScore >= 30 ? chalk.yellow : chalk.red
      console.log(`  ${color(bar)} ${score.profileName} (${score.totalScore}%) — ${chalk.dim(score.breakdown)}`)
    }

    const bestScore = scores[0]!
    selectedProfileName = await select({
      message: 'Use profile:',
      choices: scores.map(s => ({
        name: `${s.profileName} (${s.totalScore}%)`,
        value: s.profileName,
      })),
      default: bestScore.profileName,
    })
  }

  // 6. Generate
  const profile = await loadProfile(selectedProfileName)
  const resumeData = assembleFromProfile(master, profile)
  const tex = renderResume(resumeData)

  const slug = `${analysis.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-quick`
  const texPath = await writeTexFile(slug, master.name, tex)
  success(`LaTeX written: ${texPath}`)

  const compileSpin = spinner('Compiling PDF...')
  try {
    const pdfPath = await compilePdf(texPath)
    compileSpin.succeed(`PDF generated: ${pdfPath}`)

    await revisionLoop({ texPath, pdfPath, jd: result.text })
  } catch (error) {
    compileSpin.fail('PDF compilation failed')
    throw error
  }
}
