import { confirm, select, checkbox } from '@inquirer/prompts'
import { analyzeJd } from '../analysis/jd-parser.js'
import { buildSkillReport, displaySkillReport } from '../analysis/skill-matcher.js'
import { scoreProfile } from '../analysis/profile-scorer.js'
import { assembleFromProfile } from '../customization/resume-assembler.js'
import { rewriteBullet, refineSummary } from '../customization/bullet-rewriter.js'
import { suggestSectionOrder } from '../customization/section-reorderer.js'
import { displayBulletDiff, displayChangeSummary, type BulletChange } from '../customization/diff.js'
import { renderResume } from '../latex/renderer.js'
import { compilePdf } from '../latex/compiler.js'
import { writeTexFile, saveCompany } from '../data/writer.js'
import {
  loadMasterResume,
  loadProfile,
  loadCompany,
  listProfiles,
} from '../data/loader.js'
import type { Company, JdAnalysis } from '../data/schema.js'
import { collectTextInput } from '../utils/input.js'
import { getCachedAnalysis, cacheAnalysis } from '../utils/url-cache.js'
import { revisionLoop } from '../utils/revise.js'
import { isParallelSafe } from '../utils/claude.js'
import { heading, success, warn, errorMsg, spinner, info, domainFitBadge } from '../utils/terminal.js'
import chalk from 'chalk'

interface CustomizeOptions {
  readonly company?: string
  readonly url?: string
}

export async function customizeCommand(opts: CustomizeOptions): Promise<void> {
  heading('Deep Customization')

  let jd: string
  let companySlug: string | undefined
  let existingCompany: Company | undefined
  let sourceUrl: string | undefined

  // 1. Get JD
  if (opts.company) {
    existingCompany = await loadCompany(opts.company)
    jd = existingCompany.jd
    companySlug = existingCompany.slug
    info(`Using saved JD for ${existingCompany.name} — ${existingCompany.role}`)
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
    sourceUrl = jdResult.sourceUrl
  }

  // 2. Analyze JD (check company cache, then URL cache)
  const spin = spinner('Deep analysis with Claude...')
  let analysis: JdAnalysis
  const cachedAnalysis = existingCompany?.analysis
    ?? (sourceUrl ? await getCachedAnalysis(sourceUrl) : undefined)

  if (cachedAnalysis) {
    analysis = cachedAnalysis
    spin.succeed('Using cached analysis')
  } else {
    analysis = await analyzeJd(jd)
    spin.succeed('JD analyzed')

    if (sourceUrl) {
      await cacheAnalysis(sourceUrl, analysis)
    }
  }

  // 3. Display analysis
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

  // 5. Handle learnable skills
  let additionalSkills: string[] = []
  if (report.learnable.length > 0) {
    additionalSkills = await checkbox({
      message: 'Include these learnable skills?',
      choices: report.learnable.map(s => ({
        name: `${s.skill} — ${s.reason}`,
        value: s.skill,
      })),
    })
  }

  // 6. Choose profile
  const master = await loadMasterResume()
  const profileNames = await listProfiles()

  if (profileNames.length === 0) {
    errorMsg('No profiles found. Run "resume init" first.')
    return
  }

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

  const selectedProfileName = await select({
    message: 'Use profile:',
    choices: scores.map(s => ({
      name: `${s.profileName} (${s.totalScore}%)`,
      value: s.profileName,
    })),
    default: scores[0]!.profileName,
  })

  const profile = await loadProfile(selectedProfileName)

  // 7. Bullet rewriting
  const bulletOverrides = new Map<string, string>()
  const changes: BulletChange[] = []

  const doBulletRewrite = await confirm({ message: 'Rewrite bullets to match JD language?', default: true })

  if (doBulletRewrite) {
    // Collect all bullets to rewrite
    const bulletsToRewrite: Array<{
      readonly bulletId: string
      readonly original: string
      readonly company: string
      readonly title: string
    }> = []

    for (const expRef of profile.experience) {
      const masterExp = master.experience.find(e => e.id === expRef.id)
      if (!masterExp) continue
      for (const bulletId of expRef.bullets) {
        const bullet = masterExp.bullets.find(b => b.id === bulletId)
        if (!bullet) continue
        bulletsToRewrite.push({ bulletId, original: bullet.text, company: masterExp.company, title: masterExp.title })
      }
    }

    // Generate rewrites — parallel for API backend, sequential for claude-code
    // (claude-code spawns child processes that can open /dev/tty for auth,
    //  corrupting terminal raw mode and hanging the checkbox prompt)
    const rewriteSpin = spinner(`Rewriting ${bulletsToRewrite.length} bullets...`)
    let rewrites: Array<{ bulletId: string; original: string; company: string; title: string; rewritten: string }>

    if (isParallelSafe()) {
      rewrites = await Promise.all(
        bulletsToRewrite.map(b =>
          rewriteBullet(b.original, analysis.keyTerminology, analysis.emphasisAreas)
            .then(rewritten => ({ ...b, rewritten })),
        ),
      )
    } else {
      rewrites = []
      for (const b of bulletsToRewrite) {
        const rewritten = await rewriteBullet(b.original, analysis.keyTerminology, analysis.emphasisAreas)
        rewrites.push({ ...b, rewritten })
      }
    }
    rewriteSpin.succeed(`Rewrote ${rewrites.length} bullets`)

    // Print all diffs grouped by company
    let lastCompany = ''
    for (const r of rewrites) {
      if (r.company !== lastCompany) {
        console.log(chalk.bold(`\n  ${r.company} — ${r.title}`))
        lastCompany = r.company
      }
      displayBulletDiff(r.original, r.rewritten)
    }

    // Single multiselect: pre-checked = accept, unchecked = reject
    const kept = await checkbox({
      message: 'Keep these rewrites? (uncheck to discard)',
      choices: rewrites.map(r => ({
        name: `[${r.company}] ${r.original.slice(0, 55)}… → ${r.rewritten.slice(0, 55)}…`,
        value: r.bulletId,
        checked: true,
      })),
    })

    const keptSet = new Set(kept)
    for (const r of rewrites) {
      if (keptSet.has(r.bulletId)) {
        bulletOverrides.set(r.bulletId, r.rewritten)
      }
      changes.push({
        bulletId: r.bulletId,
        original: r.original,
        rewritten: r.rewritten,
        accepted: keptSet.has(r.bulletId),
      })
    }
  }

  // 8. Section reordering
  const suggestedOrder = suggestSectionOrder(profile.sections, analysis)
  const currentOrderStr = profile.sections.join(' → ')
  const suggestedOrderStr = [...suggestedOrder].join(' → ')

  if (currentOrderStr !== suggestedOrderStr) {
    console.log(`\n  Current order:   ${chalk.dim(currentOrderStr)}`)
    console.log(`  Suggested order: ${chalk.cyan(suggestedOrderStr)}`)

    const reorder = await confirm({ message: 'Use suggested section order?', default: true })
    if (!reorder) {
      // keep current
    }
    // suggestedOrder used for assembly
  }

  // 9. Summary refinement
  const summaryItem = master.summary.find(s => s.id === profile.summary)
  let summaryText = summaryItem?.text

  if (summaryText) {
    const refineSummaryOpt = await confirm({ message: 'Refine summary for this role?', default: true })
    if (refineSummaryOpt) {
      const sumSpin = spinner('Refining summary...')
      const refined = await refineSummary(
        summaryText,
        analysis.title,
        analysis.emphasisAreas,
        analysis.keyTerminology,
      )
      sumSpin.stop()

      displayBulletDiff(summaryText, refined)
      const acceptSummary = await confirm({ message: 'Accept refined summary?', default: true })
      if (acceptSummary) {
        summaryText = refined
      }
    }
  }

  // 10. Final review
  if (changes.length > 0) {
    displayChangeSummary(changes)
  }

  const proceedToGenerate = await confirm({ message: 'Generate PDF?', default: true })
  if (!proceedToGenerate) return

  // 11. Generate
  // Build additional skills map — add confirmed learnable + adjacent skills to first skill category
  const additionalSkillsMap = new Map<string, readonly string[]>()
  const adjacentSkillNames = report.adjacent.map(s => s.skill)
  const allExtraSkills = [...adjacentSkillNames, ...additionalSkills]
  if (allExtraSkills.length > 0 && profile.skills.length > 0) {
    additionalSkillsMap.set(profile.skills[0]!, allExtraSkills)
  }

  const resumeData = assembleFromProfile(master, profile, {
    bulletOverrides,
    summaryOverride: summaryText,
    additionalSkills: additionalSkillsMap,
  })
  const tex = renderResume(resumeData)

  const slug = companySlug ?? analysis.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const texPath = await writeTexFile(slug, master.name, tex)
  success(`LaTeX written: ${texPath}`)

  const compileSpin = spinner('Compiling PDF...')
  try {
    let pdfPath = await compilePdf(texPath)
    compileSpin.succeed(`PDF generated: ${pdfPath}`)

    // 12. Revision loop
    pdfPath = await revisionLoop({ texPath, pdfPath, jd })

    // 13. Save company record
    if (!existingCompany) {
      const saveIt = await confirm({ message: 'Save this company for future use?', default: true })
      if (saveIt) {
        const now = new Date().toISOString()
        await saveCompany({
          slug,
          name: analysis.company,
          role: analysis.title,
          jd,
          analysis,
          versions: [{
            version: 1,
            createdAt: now,
            profileUsed: selectedProfileName,
            outputFile: pdfPath,
          }],
          createdAt: now,
          updatedAt: now,
        })
        success(`Company saved as "${slug}"`)
      }
    } else {
      const nextVersion = (existingCompany.versions.length) + 1
      const now = new Date().toISOString()
      await saveCompany({
        ...existingCompany,
        analysis,
        versions: [
          ...existingCompany.versions,
          {
            version: nextVersion,
            createdAt: now,
            profileUsed: selectedProfileName,
            outputFile: pdfPath,
          },
        ],
        updatedAt: now,
      })
      success(`Version ${nextVersion} saved for "${slug}"`)
    }
  } catch (error) {
    compileSpin.fail('PDF compilation failed')
    throw error
  }
}
