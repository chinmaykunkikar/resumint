import type { MasterResume, Profile } from '../data/schema.js'
import { assembleResumeData, type ResumeData } from '../latex/renderer.js'

export function assembleFromProfile(
  master: MasterResume,
  profile: Profile,
  options?: {
    readonly bulletOverrides?: ReadonlyMap<string, string>
    readonly additionalSkills?: ReadonlyMap<string, readonly string[]>
    readonly summaryOverride?: string
  },
): ResumeData {
  const summaryItem = master.summary.find(s => s.id === profile.summary)
  const summary = options?.summaryOverride ?? summaryItem?.text

  const experienceBullets = new Map<string, readonly string[]>()
  for (const expRef of profile.experience) {
    experienceBullets.set(expRef.id, expRef.bullets)
  }

  const projectBullets = new Map<string, readonly string[]>()
  for (const projRef of profile.projects) {
    projectBullets.set(projRef.id, projRef.bullets)
  }

  const data = assembleResumeData(master, {
    summary,
    sections: profile.sections,
    experienceIds: profile.experience.map(e => e.id),
    experienceBullets,
    projectIds: profile.projects.map(p => p.id),
    projectBullets,
    educationIds: profile.education,
    skillIds: profile.skills,
    bulletOverrides: options?.bulletOverrides,
  })

  // Append additional skills to first skill category if provided
  if (options?.additionalSkills && options.additionalSkills.size > 0) {
    const updatedSkills = data.skills.map(cat => {
      const extra = options.additionalSkills!.get(cat.id)
      return extra ? { ...cat, items: [...cat.items, ...extra] } : cat
    })
    return { ...data, skills: updatedSkills }
  }

  return data
}
