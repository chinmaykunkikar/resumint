import { renderDiff } from '../utils/terminal.js'
import chalk from 'chalk'

export interface BulletChange {
  readonly bulletId: string
  readonly original: string
  readonly rewritten: string
  readonly accepted: boolean
}

export function displayBulletDiff(original: string, rewritten: string): void {
  console.log(chalk.dim('  Original: ') + chalk.dim(original))
  console.log(chalk.dim('  Rewrite:  ') + renderDiff(original, rewritten))
}

export function displayChangeSummary(changes: readonly BulletChange[]): void {
  const accepted = changes.filter(c => c.accepted)
  const rejected = changes.filter(c => !c.accepted)

  console.log(chalk.bold('\n  Change Summary:'))
  console.log(`  ${chalk.green(`${accepted.length} accepted`)} | ${chalk.red(`${rejected.length} rejected`)}`)

  if (accepted.length > 0) {
    console.log(chalk.green.bold('\n  Accepted changes:'))
    for (const change of accepted) {
      console.log(chalk.dim(`  [${change.bulletId}]`))
      displayBulletDiff(change.original, change.rewritten)
      console.log('')
    }
  }
}
