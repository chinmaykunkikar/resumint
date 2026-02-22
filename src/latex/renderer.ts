import { LATEX_PREAMBLE } from './template.js'
import { escapeLatex, escapeUrl } from './escaper.js'
import type { MasterResume, Experience, Project, Education, SkillCategory } from '../data/schema.js'

export interface ResumeData {
  readonly name: string
  readonly email: string
  readonly phone: string
  readonly linkedin?: string
  readonly github?: string
  readonly website?: string
  readonly summary?: string
  readonly sections: readonly string[]
  readonly experience: readonly Experience[]
  readonly projects: readonly Project[]
  readonly education: readonly Education[]
  readonly skills: readonly SkillCategory[]
}

function renderHeader(data: ResumeData): string {
  const name = escapeLatex(data.name)
  const contactParts: string[] = []

  if (data.phone) {
    contactParts.push(`\\small ${escapeLatex(data.phone)}`)
  }
  if (data.email) {
    contactParts.push(`\\href{mailto:${data.email}}{\\underline{${escapeLatex(data.email)}}}`)
  }
  if (data.linkedin) {
    const url = data.linkedin.startsWith('http') ? data.linkedin : `https://${data.linkedin}`
    contactParts.push(`\\href{${escapeUrl(url)}}{\\underline{${escapeLatex(data.linkedin)}}}`)
  }
  if (data.github) {
    const url = data.github.startsWith('http') ? data.github : `https://${data.github}`
    contactParts.push(`\\href{${escapeUrl(url)}}{\\underline{${escapeLatex(data.github)}}}`)
  }
  if (data.website) {
    const url = data.website.startsWith('http') ? data.website : `https://${data.website}`
    contactParts.push(`\\href{${escapeUrl(url)}}{\\underline{${escapeLatex(data.website)}}}`)
  }

  return [
    '\\begin{center}',
    `    {\\Huge \\scshape ${name}} \\\\ \\vspace{1pt}`,
    `    ${contactParts.join(' $|$ \n    ')}`,
    '\\end{center}',
  ].join('\n')
}

function renderSummary(text: string): string {
  return [
    '\\section{Summary}',
    `  ${escapeLatex(text)}`,
  ].join('\n')
}

function renderExperience(experiences: readonly Experience[]): string {
  const items = experiences.map(exp => {
    const bullets = exp.bullets
      .map(b => `      \\resumeItem{${escapeLatex(b.text)}}`)
      .join('\n')

    return [
      `    \\resumeSubheading`,
      `      {${escapeLatex(exp.title)}}{${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}}`,
      `      {${escapeLatex(exp.company)}}{${escapeLatex(exp.location)}}`,
      `      \\resumeItemListStart`,
      bullets,
      `      \\resumeItemListEnd`,
    ].join('\n')
  })

  return [
    '\\section{Experience}',
    '  \\resumeSubHeadingListStart',
    ...items,
    '  \\resumeSubHeadingListEnd',
  ].join('\n')
}

function renderProjects(projects: readonly Project[]): string {
  const items = projects.map(proj => {
    const heading = proj.url
      ? `\\textbf{${escapeLatex(proj.name)}} $|$ \\emph{\\small ${escapeLatex(proj.technologies)}}`
      : `\\textbf{${escapeLatex(proj.name)}} $|$ \\emph{\\small ${escapeLatex(proj.technologies)}}`

    const dateStr = proj.startDate && proj.endDate
      ? `${escapeLatex(proj.startDate)} -- ${escapeLatex(proj.endDate)}`
      : ''

    const bullets = proj.bullets
      .map(b => `      \\resumeItem{${escapeLatex(b.text)}}`)
      .join('\n')

    return [
      `    \\resumeProjectHeading`,
      `      {${heading}}{${dateStr}}`,
      `      \\resumeItemListStart`,
      bullets,
      `      \\resumeItemListEnd`,
    ].join('\n')
  })

  return [
    '\\section{Projects}',
    '  \\resumeSubHeadingListStart',
    ...items,
    '  \\resumeSubHeadingListEnd',
  ].join('\n')
}

function renderEducation(educations: readonly Education[]): string {
  const items = educations.map(edu => {
    return [
      `    \\resumeSubheading`,
      `      {${escapeLatex(edu.institution)}}{${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}}`,
      `      {${escapeLatex(edu.degree)}}{${escapeLatex(edu.location)}}`,
    ].join('\n')
  })

  return [
    '\\section{Education}',
    '  \\resumeSubHeadingListStart',
    ...items,
    '  \\resumeSubHeadingListEnd',
  ].join('\n')
}

function renderSkills(skills: readonly SkillCategory[]): string {
  const items = skills.map(cat =>
    `    \\textbf{${escapeLatex(cat.category)}}{: ${escapeLatex(cat.items.join(', '))}} \\\\`
  )

  return [
    '\\section{Technical Skills}',
    '  \\begin{itemize}[leftmargin=0.15in, label={}]',
    '    \\small{\\item{',
    ...items,
    '    }}',
    '  \\end{itemize}',
  ].join('\n')
}

const SECTION_RENDERERS: Record<string, (data: ResumeData) => string | undefined> = {
  summary: (data) => data.summary ? renderSummary(data.summary) : undefined,
  experience: (data) => renderExperience(data.experience),
  projects: (data) => renderProjects(data.projects),
  education: (data) => renderEducation(data.education),
  skills: (data) => renderSkills(data.skills),
}

export function renderResume(data: ResumeData): string {
  const parts = [
    LATEX_PREAMBLE,
    '\\begin{document}',
    '',
    renderHeader(data),
  ]

  for (const section of data.sections) {
    const renderer = SECTION_RENDERERS[section]
    if (renderer) {
      const rendered = renderer(data)
      if (rendered) {
        parts.push('', rendered)
      }
    }
  }

  parts.push('', '\\end{document}')

  return parts.join('\n')
}

export function assembleResumeData(master: MasterResume, options?: {
  readonly summary?: string
  readonly sections?: readonly string[]
  readonly experienceIds?: readonly string[]
  readonly experienceBullets?: ReadonlyMap<string, readonly string[]>
  readonly projectIds?: readonly string[]
  readonly projectBullets?: ReadonlyMap<string, readonly string[]>
  readonly educationIds?: readonly string[]
  readonly skillIds?: readonly string[]
  readonly bulletOverrides?: ReadonlyMap<string, string>
}): ResumeData {
  const sections = options?.sections ?? ['education', 'experience', 'projects', 'skills']

  const experience = options?.experienceIds
    ? master.experience
        .filter(e => options.experienceIds!.includes(e.id))
        .map(e => {
          const bulletIds = options?.experienceBullets?.get(e.id)
          const filteredBullets = bulletIds
            ? e.bullets.filter(b => bulletIds.includes(b.id))
            : e.bullets

          const overriddenBullets = options?.bulletOverrides
            ? filteredBullets.map(b => {
                const override = options.bulletOverrides!.get(b.id)
                return override ? { ...b, text: override } : b
              })
            : filteredBullets

          return { ...e, bullets: overriddenBullets }
        })
    : master.experience

  const projects = options?.projectIds
    ? master.projects
        .filter(p => options.projectIds!.includes(p.id))
        .map(p => {
          const bulletIds = options?.projectBullets?.get(p.id)
          const filteredBullets = bulletIds
            ? p.bullets.filter(b => bulletIds.includes(b.id))
            : p.bullets

          const overriddenBullets = options?.bulletOverrides
            ? filteredBullets.map(b => {
                const override = options.bulletOverrides!.get(b.id)
                return override ? { ...b, text: override } : b
              })
            : filteredBullets

          return { ...p, bullets: overriddenBullets }
        })
    : master.projects

  const education = options?.educationIds
    ? master.education.filter(e => options.educationIds!.includes(e.id))
    : master.education

  const skills = options?.skillIds
    ? master.skills.filter(s => options.skillIds!.includes(s.id))
    : master.skills

  return {
    name: master.name,
    email: master.email,
    phone: master.phone,
    linkedin: master.linkedin,
    github: master.github,
    website: master.website,
    summary: options?.summary,
    sections,
    experience,
    projects,
    education,
    skills,
  }
}
