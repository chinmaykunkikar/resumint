import fs from 'node:fs/promises'
import { input, confirm } from '@inquirer/prompts'
import { callLlm } from './claude.js'
import { spinner, warn } from './terminal.js'
import { renderDiff } from './terminal.js'
import { compilePdf } from '../latex/compiler.js'
import chalk from 'chalk'

interface ReviseOptions {
  readonly texPath: string
  readonly pdfPath: string
  readonly jd?: string
}

const REVISE_PROMPT = (tex: string, instructions: string, jd?: string) => `You are a resume LaTeX editor. You will receive a resume in LaTeX format and the user's revision instructions.

Make ONLY the changes the user requested. Do not alter formatting, layout commands, or any content the user didn't mention. NEVER use em-dashes (—) in the content. The only acceptable use of dashes is en-dashes (–) for date ranges (e.g., "2022–2024"). Use commas, semicolons, colons, or restructure sentences instead. Return the complete revised LaTeX document, nothing else, no markdown fences, no explanation.

${jd ? `Job description context:\n---\n${jd.slice(0, 3000)}\n---\n` : ''}
Current resume LaTeX:
---
${tex}
---

User's revision instructions: ${instructions}`

export async function revisionLoop(options: ReviseOptions): Promise<string> {
  let { texPath, pdfPath } = options
  const { jd } = options

  while (true) {
    const instructions = await input({
      message: 'Revisions (or press Enter to finish):',
    })

    if (!instructions.trim()) {
      break
    }

    const currentTex = await fs.readFile(texPath, 'utf-8')

    const spin = spinner('Revising with Claude...')
    let revisedTex: string
    try {
      revisedTex = await callLlm(REVISE_PROMPT(currentTex, instructions, jd))
    } catch (error) {
      spin.fail('Revision failed')
      warn(error instanceof Error ? error.message : 'Unknown error')
      continue
    }
    spin.succeed('Revision complete')

    // Show diff summary
    const oldLines = currentTex.split('\n')
    const newLines = revisedTex.split('\n')
    const changes = diffLines(oldLines, newLines)

    if (changes.length === 0) {
      warn('No changes detected')
      continue
    }

    console.log(chalk.bold('\n  Changes:'))
    for (const change of changes) {
      console.log(`  ${renderDiff(change.old, change.new)}`)
    }
    console.log()

    const accept = await confirm({ message: 'Accept these changes?', default: true })
    if (!accept) {
      continue
    }

    // Write revised tex and recompile
    await fs.writeFile(texPath, revisedTex, 'utf-8')

    const compileSpin = spinner('Recompiling PDF...')
    try {
      pdfPath = await compilePdf(texPath)
      compileSpin.succeed(`PDF updated: ${pdfPath}`)
    } catch (error) {
      compileSpin.fail('PDF compilation failed — reverting')
      await fs.writeFile(texPath, currentTex, 'utf-8')
      warn('Reverted to previous version. The revision may have broken LaTeX syntax.')
      continue
    }
  }

  return pdfPath
}

interface LineDiff {
  readonly old: string
  readonly new: string
}

function diffLines(oldLines: readonly string[], newLines: readonly string[]): LineDiff[] {
  const diffs: LineDiff[] = []
  const maxLen = Math.max(oldLines.length, newLines.length)

  for (let i = 0; i < maxLen; i++) {
    const oldLine = (oldLines[i] ?? '').trim()
    const newLine = (newLines[i] ?? '').trim()

    // Skip empty and LaTeX boilerplate lines
    if (!oldLine && !newLine) continue
    if (oldLine === newLine) continue

    // Skip pure formatting/command changes
    if (oldLine.startsWith('\\') && newLine.startsWith('\\') && !containsText(oldLine) && !containsText(newLine)) {
      continue
    }

    diffs.push({ old: oldLine, new: newLine })
  }

  return diffs
}

function containsText(line: string): boolean {
  // Check if a LaTeX line has meaningful text content (not just commands)
  const stripped = line
    .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, '')
    .replace(/[{}\\%&$#_^~]/g, '')
    .trim()
  return stripped.length > 5
}
