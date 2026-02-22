import type { JdAnalysis, JdSkill } from '../data/schema.js'
import chalk from 'chalk'
import { trophyIcon } from '../utils/terminal.js'

export interface SkillReport {
  readonly exact: readonly JdSkill[]
  readonly adjacent: readonly JdSkill[]
  readonly learnable: readonly JdSkill[]
  readonly domainChange: readonly JdSkill[]
  readonly matchScore: number
}

export function buildSkillReport(analysis: JdAnalysis): SkillReport {
  const exact = analysis.skills.filter(s => s.category === 'EXACT')
  const adjacent = analysis.skills.filter(s => s.category === 'ADJACENT')
  const learnable = analysis.skills.filter(s => s.category === 'LEARNABLE')
  const domainChange = analysis.skills.filter(s => s.category === 'DOMAIN_CHANGE')

  const mustHaves = analysis.skills.filter(s => s.priority === 'must-have')
  const mustHaveMatches = mustHaves.filter(
    s => s.category === 'EXACT' || s.category === 'ADJACENT',
  )

  const matchScore = mustHaves.length > 0
    ? Math.round((mustHaveMatches.length / mustHaves.length) * 100)
    : 0

  return { exact, adjacent, learnable, domainChange, matchScore }
}

export function displaySkillReport(report: SkillReport): void {
  console.log('')

  const formatSkill = (s: JdSkill) => {
    const icon = trophyIcon(s.category)
    const priority = s.priority === 'must-have'
      ? chalk.bold('(must-have)')
      : chalk.dim('(nice-to-have)')
    return `  ${icon} ${s.skill} ${priority} ${chalk.dim(`— ${s.reason}`)}`
  }

  if (report.exact.length > 0) {
    console.log(chalk.green.bold('\n  Exact Matches:'))
    report.exact.forEach(s => console.log(formatSkill(s)))
  }

  if (report.adjacent.length > 0) {
    console.log(chalk.blue.bold('\n  Adjacent Skills (auto-add):'))
    report.adjacent.forEach(s => console.log(formatSkill(s)))
  }

  if (report.learnable.length > 0) {
    console.log(chalk.yellow.bold('\n  Learnable (needs confirmation):'))
    report.learnable.forEach(s => console.log(formatSkill(s)))
  }

  if (report.domainChange.length > 0) {
    console.log(chalk.red.bold('\n  Domain Change (reject):'))
    report.domainChange.forEach(s => console.log(formatSkill(s)))
  }

  console.log('')
  const scoreColor = report.matchScore >= 70
    ? chalk.green
    : report.matchScore >= 40
      ? chalk.yellow
      : chalk.red

  console.log(`  Match Score: ${scoreColor.bold(`${report.matchScore}%`)} (must-have skills coverage)`)
}
