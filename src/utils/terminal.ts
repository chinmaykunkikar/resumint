import chalk from 'chalk'
import ora, { type Ora } from 'ora'
import { diffWords } from 'diff'

export function heading(text: string): void {
  console.log(chalk.bold.cyan(`\n${text}`))
  console.log(chalk.dim('─'.repeat(text.length + 2)))
}

export function success(text: string): void {
  console.log(chalk.green(`✓ ${text}`))
}

export function warn(text: string): void {
  console.log(chalk.yellow(`⚠ ${text}`))
}

export function info(text: string): void {
  console.log(chalk.blue(`ℹ ${text}`))
}

export function errorMsg(text: string): void {
  console.log(chalk.red(`✗ ${text}`))
}

export function spinner(text: string): Ora {
  return ora({ text, color: 'cyan' }).start()
}

export function renderDiff(oldText: string, newText: string): string {
  const changes = diffWords(oldText, newText)
  return changes
    .map(part => {
      if (part.added) return chalk.green(part.value)
      if (part.removed) return chalk.red.strikethrough(part.value)
      return chalk.dim(part.value)
    })
    .join('')
}

export function trophyIcon(category: string): string {
  switch (category) {
    case 'EXACT': return chalk.green('●')
    case 'ADJACENT': return chalk.blue('●')
    case 'LEARNABLE': return chalk.yellow('●')
    case 'DOMAIN_CHANGE': return chalk.red('●')
    default: return chalk.dim('●')
  }
}

export function trophyLabel(category: string): string {
  switch (category) {
    case 'EXACT': return chalk.green('Exact Match')
    case 'ADJACENT': return chalk.blue('Adjacent')
    case 'LEARNABLE': return chalk.yellow('Learnable')
    case 'DOMAIN_CHANGE': return chalk.red('Domain Change')
    default: return chalk.dim('Unknown')
  }
}

export function domainFitBadge(fit: string): string {
  switch (fit) {
    case 'strong': return chalk.green.bold(' STRONG FIT ')
    case 'moderate': return chalk.blue.bold(' MODERATE FIT ')
    case 'weak': return chalk.yellow.bold(' WEAK FIT ')
    case 'mismatch': return chalk.red.bold(' MISMATCH ')
    default: return chalk.dim(' UNKNOWN ')
  }
}

export function table(rows: string[][]): void {
  const colWidths = rows[0]!.map((_, i) =>
    Math.max(...rows.map(r => (r[i] ?? '').length))
  )
  for (const row of rows) {
    const line = row
      .map((cell, i) => cell.padEnd(colWidths[i]!))
      .join('  ')
    console.log(`  ${line}`)
  }
}
