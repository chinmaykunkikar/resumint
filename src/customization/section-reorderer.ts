import type { JdAnalysis } from '../data/schema.js'

const SECTION_WEIGHTS: Record<string, Record<string, number>> = {
  experience: {
    'Frontend Web Development': 3,
    'Full-Stack': 3,
    'Backend': 2,
    default: 3,
  },
  projects: {
    'Frontend Web Development': 2,
    'Full-Stack': 2,
    'Backend': 1,
    default: 2,
  },
  skills: {
    default: 1,
  },
  education: {
    default: 0,
  },
}

export function suggestSectionOrder(
  currentSections: readonly string[],
  analysis: JdAnalysis,
): readonly string[] {
  const domain = analysis.domain

  const scored = currentSections.map(section => {
    const weights = SECTION_WEIGHTS[section] ?? { default: 0 }
    const weight = weights[domain] ?? weights['default'] ?? 0

    // Boost if JD emphasis matches section type
    const emphasisBoost = analysis.emphasisAreas.some(e => {
      const lower = e.toLowerCase()
      return (
        (section === 'experience' && (lower.includes('experience') || lower.includes('track record'))) ||
        (section === 'projects' && (lower.includes('project') || lower.includes('portfolio'))) ||
        (section === 'skills' && (lower.includes('skill') || lower.includes('technical'))) ||
        (section === 'education' && (lower.includes('degree') || lower.includes('education')))
      )
    }) ? 1 : 0

    // Seniority: senior+ roles emphasize experience more
    const seniorityBoost =
      section === 'experience' &&
      ['senior', 'staff', 'principal'].includes(analysis.seniority)
        ? 1
        : 0

    return { section, score: weight + emphasisBoost + seniorityBoost }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .map(s => s.section)
}
