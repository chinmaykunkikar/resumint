import { input, confirm } from '@inquirer/prompts'
import { loadCompany, listCompanies } from '../data/loader.js'
import { saveCompany, deleteCompany } from '../data/writer.js'
import { collectTextInput } from '../utils/input.js'
import { heading, success, errorMsg, info, table } from '../utils/terminal.js'
import chalk from 'chalk'

interface CompanyAddOptions {
  readonly url?: string
}

export async function companyAddCommand(opts: CompanyAddOptions = {}): Promise<void> {
  heading('Add Target Company')

  const name = await input({ message: 'Company name:' })
  const role = await input({ message: 'Role/position:' })
  const slug = await input({
    message: 'Slug (short identifier):',
    default: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  })

  const result = await collectTextInput({
    editorMessage: 'Paste the job description (opens editor):',
    url: opts.url,
  })

  if (!result) {
    errorMsg('No job description provided')
    return
  }

  const now = new Date().toISOString()
  await saveCompany({
    slug,
    name,
    role,
    jd: result.text,
    versions: [],
    createdAt: now,
    updatedAt: now,
  })

  success(`Company "${name}" saved as "${slug}"`)
  info('Run "resume customize --company ' + slug + '" to generate a resume')
}

export async function companyListCommand(): Promise<void> {
  heading('Saved Companies')

  const slugs = await listCompanies()

  if (slugs.length === 0) {
    info('No companies saved yet. Run "resume company add" to add one.')
    return
  }

  const rows: string[][] = [
    [chalk.bold('Slug'), chalk.bold('Company'), chalk.bold('Role'), chalk.bold('Versions')],
  ]

  for (const slug of slugs) {
    const company = await loadCompany(slug)
    rows.push([
      slug,
      company.name,
      company.role,
      String(company.versions.length),
    ])
  }

  table(rows)
}

export async function companyShowCommand(slug: string): Promise<void> {
  heading(`Company: ${slug}`)

  try {
    const company = await loadCompany(slug)

    console.log(`  ${chalk.bold('Name:')} ${company.name}`)
    console.log(`  ${chalk.bold('Role:')} ${company.role}`)
    console.log(`  ${chalk.bold('Created:')} ${company.createdAt}`)
    console.log(`  ${chalk.bold('Updated:')} ${company.updatedAt}`)

    if (company.analysis) {
      console.log(`\n  ${chalk.bold('Analysis:')}`)
      console.log(`    Domain: ${company.analysis.domain}`)
      console.log(`    Fit: ${company.analysis.domainFit}`)
      console.log(`    Seniority: ${company.analysis.seniority}`)
    }

    if (company.versions.length > 0) {
      console.log(chalk.bold('\n  Resume Versions:'))
      for (const v of company.versions) {
        console.log(`    v${v.version} — ${v.createdAt} — Profile: ${v.profileUsed}${v.outputFile ? ` — ${v.outputFile}` : ''}`)
      }
    } else {
      info('No resume versions generated yet')
    }

    console.log(chalk.bold('\n  JD Preview:'))
    const preview = company.jd.slice(0, 300)
    console.log(chalk.dim(`    ${preview}${company.jd.length > 300 ? '...' : ''}`))
  } catch {
    errorMsg(`Company "${slug}" not found`)
  }
}

export async function companyRemoveCommand(slug: string): Promise<void> {
  heading(`Remove Company: ${slug}`)

  try {
    const company = await loadCompany(slug)
    console.log(`  ${company.name} — ${company.role}`)
    console.log(`  ${company.versions.length} resume version(s)`)

    const confirmed = await confirm({
      message: `Delete "${slug}" and all its data?`,
      default: false,
    })

    if (confirmed) {
      await deleteCompany(slug)
      success(`Company "${slug}" removed`)
    } else {
      info('Cancelled')
    }
  } catch {
    errorMsg(`Company "${slug}" not found`)
  }
}
