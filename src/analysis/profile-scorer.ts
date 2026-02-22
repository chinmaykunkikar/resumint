import type { JdAnalysis, Profile, MasterResume } from '../data/schema.js'

export interface ProfileScore {
  readonly profileName: string
  readonly totalScore: number
  readonly skillCoverage: number
  readonly tagOverlap: number
  readonly bulletRelevance: number
  readonly breakdown: string
}

export function scoreProfile(
  profile: Profile,
  analysis: JdAnalysis,
  master: MasterResume,
): ProfileScore {
  // 1. Skill coverage: how many JD skills match the profile's included skill items
  const profileSkillIds = new Set(profile.skills)
  const profileSkillItems = master.skills
    .filter(s => profileSkillIds.has(s.id))
    .flatMap(s => s.items.map(i => i.toLowerCase()))

  const jdSkillNames = analysis.skills
    .filter(s => s.category === 'EXACT' || s.category === 'ADJACENT')
    .map(s => s.skill.toLowerCase())

  const skillMatches = jdSkillNames.filter(jdSkill =>
    profileSkillItems.some(ps => ps.includes(jdSkill) || jdSkill.includes(ps)),
  )
  const skillCoverage = jdSkillNames.length > 0
    ? Math.round((skillMatches.length / jdSkillNames.length) * 100)
    : 0

  // 2. Tag overlap: how many JD emphasis areas match bullet tags in profile
  const profileBulletTags = new Set<string>()
  for (const expRef of profile.experience) {
    const masterExp = master.experience.find(e => e.id === expRef.id)
    if (!masterExp) continue
    const bulletIds = new Set(expRef.bullets)
    for (const bullet of masterExp.bullets) {
      if (bulletIds.has(bullet.id)) {
        bullet.tags.forEach(t => profileBulletTags.add(t.toLowerCase()))
      }
    }
  }

  const emphasisLower = analysis.emphasisAreas.map(e => e.toLowerCase())
  const tagMatches = emphasisLower.filter(e =>
    [...profileBulletTags].some(t => t.includes(e) || e.includes(t)),
  )
  const tagOverlap = emphasisLower.length > 0
    ? Math.round((tagMatches.length / emphasisLower.length) * 100)
    : 0

  // 3. Bullet relevance: percentage of profile bullets with matching tags
  let totalBullets = 0
  let relevantBullets = 0
  const keyTermsLower = analysis.keyTerminology.map(t => t.toLowerCase())

  for (const expRef of profile.experience) {
    const masterExp = master.experience.find(e => e.id === expRef.id)
    if (!masterExp) continue
    const bulletIds = new Set(expRef.bullets)
    for (const bullet of masterExp.bullets) {
      if (bulletIds.has(bullet.id)) {
        totalBullets++
        const bulletLower = bullet.text.toLowerCase()
        const hasTermMatch = keyTermsLower.some(t => bulletLower.includes(t))
        const hasTagMatch = bullet.tags.some(t =>
          jdSkillNames.some(s => t.toLowerCase().includes(s) || s.includes(t.toLowerCase())),
        )
        if (hasTermMatch || hasTagMatch) {
          relevantBullets++
        }
      }
    }
  }
  const bulletRelevance = totalBullets > 0
    ? Math.round((relevantBullets / totalBullets) * 100)
    : 0

  // Weighted total
  const totalScore = Math.round(
    skillCoverage * 0.4 +
    tagOverlap * 0.3 +
    bulletRelevance * 0.3,
  )

  const breakdown = [
    `Skills: ${skillCoverage}%`,
    `Emphasis: ${tagOverlap}%`,
    `Bullets: ${bulletRelevance}%`,
  ].join(' | ')

  return {
    profileName: profile.name,
    totalScore,
    skillCoverage,
    tagOverlap,
    bulletRelevance,
    breakdown,
  }
}
