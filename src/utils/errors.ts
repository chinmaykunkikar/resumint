import chalk from 'chalk'
import { ZodError } from 'zod'

export class CliError extends Error {
  constructor(
    message: string,
    public readonly hint?: string,
  ) {
    super(message)
    this.name = 'CliError'
  }
}

export function formatError(error: unknown): string {
  if (error instanceof CliError) {
    const msg = chalk.red(`Error: ${error.message}`)
    return error.hint ? `${msg}\n${chalk.dim(error.hint)}` : msg
  }

  if (error instanceof ZodError) {
    const issues = error.issues
      .map(i => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    return chalk.red(`Validation error:\n${issues}`)
  }

  if (error instanceof Error) {
    return chalk.red(`Error: ${error.message}`)
  }

  return chalk.red(`Unknown error: ${String(error)}`)
}

export function handleError(error: unknown): never {
  console.error(formatError(error))
  process.exit(1)
}
