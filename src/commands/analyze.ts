import { analyzeJd } from '../analysis/jd-parser.js'
import { buildSkillReport, displaySkillReport } from '../analysis/skill-matcher.js'
import { collectTextInput } from '../utils/input.js'
import { getCachedAnalysis, cacheAnalysis } from '../utils/url-cache.js'
import { heading, errorMsg, spinner, info, domainFitBadge } from '../utils/terminal.js'
import chalk from 'chalk'

interface AnalyzeOptions {
  readonly url?: string
}

export async function analyzeCommand(opts: AnalyzeOptions = {}): Promise<void> {
  heading('JD Analysis (Debug)')

  const result = await collectTextInput({
    editorMessage: 'Paste the job description (opens editor):',
    url: opts.url,
  })

  if (!result) {
    errorMsg('No job description provided')
    return
  }

  // Check URL analysis cache
  const cachedAnalysis = result.sourceUrl ? await getCachedAnalysis(result.sourceUrl) : undefined
  let analysis
  if (cachedAnalysis) {
    info('Using cached analysis')
    analysis = cachedAnalysis
  } else {
    const spin = spinner('Analyzing with Claude...')
    analysis = await analyzeJd(result.text)
    spin.succeed('Analysis complete')

    if (result.sourceUrl) {
      await cacheAnalysis(result.sourceUrl, analysis)
    }
  }

  console.log(`\n  ${chalk.bold('Title:')} ${analysis.title}`)
  console.log(`  ${chalk.bold('Company:')} ${analysis.company}`)
  console.log(`  ${chalk.bold('Seniority:')} ${analysis.seniority}`)
  console.log(`  ${chalk.bold('Domain:')} ${analysis.domain}`)
  console.log(`  ${chalk.bold('Domain Fit:')} ${domainFitBadge(analysis.domainFit)}`)
  console.log(`  ${chalk.dim(analysis.domainFitReason)}`)

  const report = buildSkillReport(analysis)
  displaySkillReport(report)

  console.log(chalk.bold('\n  Key Terminology:'))
  for (const term of analysis.keyTerminology) {
    console.log(`    ${chalk.cyan('•')} ${term}`)
  }

  console.log(chalk.bold('\n  Emphasis Areas:'))
  for (const area of analysis.emphasisAreas) {
    console.log(`    ${chalk.cyan('•')} ${area}`)
  }

  console.log(chalk.bold('\n  Summary Recommendation:'))
  console.log(`    ${chalk.dim(analysis.summaryRecommendation)}`)
}
