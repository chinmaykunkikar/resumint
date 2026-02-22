import { listProfiles, loadProfile } from '../data/loader.js'
import { heading, info } from '../utils/terminal.js'
import chalk from 'chalk'

export async function profilesCommand(): Promise<void> {
  heading('Resume Profiles')

  const names = await listProfiles()

  if (names.length === 0) {
    info('No profiles found. Run "resume init" to create sample profiles.')
    return
  }

  for (const name of names) {
    const profile = await loadProfile(name)
    console.log(`  ${chalk.bold(profile.name)}`)
    console.log(`    ${chalk.dim(profile.description)}`)
    console.log(`    Sections: ${profile.sections.join(', ')}`)
    console.log(`    Experience: ${profile.experience.length} entries`)
    console.log(`    Projects: ${profile.projects.length} entries`)
    console.log(`    Skills: ${profile.skills.length} categories`)
    console.log('')
  }
}
