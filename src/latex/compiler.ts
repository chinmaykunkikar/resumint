import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs/promises'
import { loadConfig } from '../config/loader.js'
import { CliError } from '../utils/errors.js'

const execFileAsync = promisify(execFile)

export async function compilePdf(texPath: string): Promise<string> {
  const config = await loadConfig()
  const dir = path.dirname(texPath)
  const basename = path.basename(texPath, '.tex')
  const pdfPath = path.join(dir, `${basename}.pdf`)

  try {
    await execFileAsync(config.latexCommand, [
      '-interaction=nonstopmode',
      '-halt-on-error',
      `-output-directory=${dir}`,
      texPath,
    ], {
      timeout: 30000,
      cwd: dir,
    })
  } catch (error) {
    const logPath = path.join(dir, `${basename}.log`)
    let logTail = ''
    try {
      const logContent = await fs.readFile(logPath, 'utf-8')
      const lines = logContent.split('\n')
      const errorLines = lines.filter(l => l.startsWith('!') || l.includes('Error'))
      logTail = errorLines.slice(0, 10).join('\n')
    } catch {
      // log file may not exist
    }

    throw new CliError(
      `LaTeX compilation failed`,
      logTail || (error instanceof Error ? error.message : 'Unknown error'),
    )
  }

  // Clean up auxiliary files
  const auxExtensions = ['.aux', '.log', '.out']
  for (const ext of auxExtensions) {
    try {
      await fs.unlink(path.join(dir, `${basename}${ext}`))
    } catch {
      // ignore cleanup errors
    }
  }

  return pdfPath
}
