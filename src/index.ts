#!/usr/bin/env node
import { Command } from 'commander'
import { handleError } from './utils/errors.js'
import { initCommand } from './commands/init.js'

const program = new Command()

program
  .name('resumint')
  .description('AI-powered resume tailoring CLI — analyze JDs, rewrite bullets, mint fresh PDFs')
  .version('1.0.0')

program
  .command('init')
  .description('Create data directories and sample YAML files')
  .action(async () => {
    try {
      await initCommand()
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('quick [url]')
  .description('Quick match: paste JD → best profile → PDF')
  .option('-p, --profile <name>', 'Use specific profile instead of auto-select')
  .action(async (url, opts) => {
    try {
      const { quickCommand } = await import('./commands/quick.js')
      await quickCommand({ ...opts, url })
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('customize [url]')
  .description('Deep customization: JD analysis → bullet rewriting → PDF')
  .option('-c, --company <slug>', 'Use saved company JD')
  .action(async (url, opts) => {
    try {
      const { customizeCommand } = await import('./commands/customize.js')
      await customizeCommand({ ...opts, url })
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('generate <company-slug>')
  .description('Re-generate PDF for a saved company')
  .action(async (slug) => {
    try {
      const { generateCommand } = await import('./commands/generate.js')
      await generateCommand(slug)
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('analyze [url]')
  .description('Standalone JD analysis (debug tool)')
  .action(async (url) => {
    try {
      const { analyzeCommand } = await import('./commands/analyze.js')
      await analyzeCommand({ url })
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('profiles')
  .description('List available resume profiles')
  .action(async () => {
    try {
      const { profilesCommand } = await import('./commands/profiles.js')
      await profilesCommand()
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('reachout [url]')
  .description('Generate personalized LinkedIn outreach messages')
  .option('-c, --company <slug>', 'Use saved company JD for context')
  .action(async (url, opts) => {
    try {
      const { reachoutCommand } = await import('./commands/reachout.js')
      await reachoutCommand({ ...opts, url })
    } catch (error) {
      handleError(error)
    }
  })

program
  .command('cover-letter [url]')
  .description('Generate a tailored cover letter')
  .option('-c, --company <slug>', 'Use saved company JD')
  .action(async (url, opts) => {
    try {
      const { coverLetterCommand } = await import('./commands/cover-letter.js')
      await coverLetterCommand({ ...opts, url })
    } catch (error) {
      handleError(error)
    }
  })

const companyCmd = program
  .command('company')
  .description('Manage target companies')

companyCmd
  .command('add [url]')
  .description('Add a new target company')
  .action(async (url) => {
    try {
      const { companyAddCommand } = await import('./commands/company.js')
      await companyAddCommand({ url })
    } catch (error) {
      handleError(error)
    }
  })

companyCmd
  .command('list')
  .description('List saved companies')
  .action(async () => {
    try {
      const { companyListCommand } = await import('./commands/company.js')
      await companyListCommand()
    } catch (error) {
      handleError(error)
    }
  })

companyCmd
  .command('show <slug>')
  .description('Show company details and resume versions')
  .action(async (slug) => {
    try {
      const { companyShowCommand } = await import('./commands/company.js')
      await companyShowCommand(slug)
    } catch (error) {
      handleError(error)
    }
  })

companyCmd
  .command('remove <slug>')
  .description('Remove a saved company')
  .action(async (slug) => {
    try {
      const { companyRemoveCommand } = await import('./commands/company.js')
      await companyRemoveCommand(slug)
    } catch (error) {
      handleError(error)
    }
  })

program.parse()
