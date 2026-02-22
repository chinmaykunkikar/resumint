import fs from 'node:fs/promises'
import { select } from '@inquirer/prompts'
import { loadCompany, loadMasterResume, loadProfile, listProfiles } from '../data/loader.js'
import { saveCompany, writeTexFile } from '../data/writer.js'
import { PATHS } from '../data/paths.js'
import { assembleFromProfile } from '../customization/resume-assembler.js'
import { renderResume } from '../latex/renderer.js'
import { compilePdf } from '../latex/compiler.js'
import { revisionLoop } from '../utils/revise.js'
import { heading, success, errorMsg, spinner, info } from '../utils/terminal.js'

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function generateCommand(slug: string): Promise<void> {
  heading(`Re-generate: ${slug}`)

  let company
  try {
    company = await loadCompany(slug)
  } catch {
    errorMsg(`Company "${slug}" not found`)
    return
  }

  info(`${company.name} — ${company.role}`)

  const master = await loadMasterResume()
  const texPath = PATHS.outputTex(slug, master.name)

  // If tex file already exists, just recompile it
  if (await fileExists(texPath)) {
    info(`Using existing LaTeX: ${texPath}`)

    const compileSpin = spinner('Compiling PDF...')
    try {
      const pdfPath = await compilePdf(texPath)
      compileSpin.succeed(`PDF generated: ${pdfPath}`)

      await revisionLoop({ texPath, pdfPath, jd: company.jd })
    } catch (error) {
      compileSpin.fail('PDF compilation failed')
      throw error
    }
    return
  }

  // No existing tex — generate fresh
  const profileNames = await listProfiles()

  const lastVersion = company.versions[company.versions.length - 1]
  const defaultProfile = lastVersion?.profileUsed ?? profileNames[0]

  const selectedProfile = await select({
    message: 'Profile:',
    choices: profileNames.map(n => ({ name: n, value: n })),
    default: defaultProfile,
  })

  const profile = await loadProfile(selectedProfile)
  const resumeData = assembleFromProfile(master, profile)
  const tex = renderResume(resumeData)

  const writtenTexPath = await writeTexFile(slug, master.name, tex)
  success(`LaTeX written: ${writtenTexPath}`)

  const compileSpin = spinner('Compiling PDF...')
  try {
    const pdfPath = await compilePdf(writtenTexPath)
    compileSpin.succeed(`PDF generated: ${pdfPath}`)

    await revisionLoop({ texPath: writtenTexPath, pdfPath, jd: company.jd })

    const nextVersion = company.versions.length + 1
    const now = new Date().toISOString()
    await saveCompany({
      ...company,
      versions: [
        ...company.versions,
        {
          version: nextVersion,
          createdAt: now,
          profileUsed: selectedProfile,
          outputFile: pdfPath,
        },
      ],
      updatedAt: now,
    })
    success(`Version ${nextVersion} saved`)
  } catch (error) {
    compileSpin.fail('PDF compilation failed')
    throw error
  }
}
