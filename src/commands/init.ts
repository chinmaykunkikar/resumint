import fs from 'node:fs/promises'
import YAML from 'yaml'
import { PATHS } from '../data/paths.js'
import { fileExists } from '../data/loader.js'
import { success, warn, heading } from '../utils/terminal.js'

const SAMPLE_MASTER_RESUME = {
  name: 'Your Name',
  email: 'you@example.com',
  phone: '+1-555-0100',
  linkedin: 'linkedin.com/in/yourname',
  github: 'github.com/yourname',
  summary: [
    {
      id: 'summary-frontend',
      text: 'Frontend engineer with X years of experience building performant, accessible web applications with React, TypeScript, and modern tooling.',
      tags: ['frontend', 'react'],
    },
    {
      id: 'summary-fullstack',
      text: 'Full-stack engineer with X years of experience across React frontends and Node.js backends, with a focus on developer experience and system design.',
      tags: ['fullstack', 'backend'],
    },
  ],
  experience: [
    {
      id: 'exp-company-a',
      company: 'Company A',
      title: 'Senior Frontend Engineer',
      location: 'San Francisco, CA',
      startDate: 'Jan 2022',
      endDate: 'Present',
      bullets: [
        {
          id: 'exp-a-1',
          text: 'Led migration of legacy jQuery codebase to React 18, reducing bundle size by 40% and improving page load times by 2s',
          tags: ['react', 'performance', 'migration', 'leadership'],
        },
        {
          id: 'exp-a-2',
          text: 'Built component library with 50+ accessible components using TypeScript and Storybook, adopted by 3 product teams',
          tags: ['react', 'typescript', 'design-system', 'accessibility'],
        },
        {
          id: 'exp-a-3',
          text: 'Implemented real-time collaboration features using WebSockets and CRDT, serving 10K concurrent users',
          tags: ['websockets', 'real-time', 'architecture'],
        },
      ],
    },
    {
      id: 'exp-company-b',
      company: 'Company B',
      title: 'Frontend Engineer',
      location: 'Remote',
      startDate: 'Jun 2020',
      endDate: 'Dec 2021',
      bullets: [
        {
          id: 'exp-b-1',
          text: 'Developed customer-facing dashboard processing $2M daily transactions with React and GraphQL',
          tags: ['react', 'graphql', 'dashboard', 'fintech'],
        },
        {
          id: 'exp-b-2',
          text: 'Reduced API response times by 60% through implementing Redis caching layer and query optimization',
          tags: ['backend', 'performance', 'redis', 'optimization'],
        },
      ],
    },
  ],
  projects: [
    {
      id: 'proj-oss',
      name: 'Open Source Project',
      technologies: 'React, TypeScript, Vite',
      url: 'github.com/you/project',
      bullets: [
        {
          id: 'proj-oss-1',
          text: 'Created a popular open-source React component library with 500+ GitHub stars',
          tags: ['react', 'open-source', 'typescript'],
        },
      ],
    },
  ],
  education: [
    {
      id: 'edu-university',
      institution: 'University Name',
      degree: 'B.S. Computer Science',
      location: 'City, State',
      startDate: 'Aug 2016',
      endDate: 'May 2020',
      details: ['Relevant Coursework: Data Structures, Algorithms, Web Development'],
    },
  ],
  skills: [
    {
      id: 'skills-languages',
      category: 'Languages',
      items: ['TypeScript', 'JavaScript', 'Python', 'HTML/CSS', 'SQL'],
    },
    {
      id: 'skills-frameworks',
      category: 'Frameworks',
      items: ['React', 'Next.js', 'Node.js', 'Express', 'Tailwind CSS'],
    },
    {
      id: 'skills-tools',
      category: 'Tools',
      items: ['Git', 'Docker', 'AWS', 'PostgreSQL', 'Redis', 'Figma'],
    },
  ],
}

const SAMPLE_FRONTEND_PROFILE = {
  name: 'frontend-heavy',
  description: 'Emphasizes React, UI/UX, component systems, frontend architecture',
  summary: 'summary-frontend',
  sections: ['education', 'experience', 'projects', 'skills'],
  experience: [
    { id: 'exp-company-a', bullets: ['exp-a-1', 'exp-a-2', 'exp-a-3'] },
    { id: 'exp-company-b', bullets: ['exp-b-1'] },
  ],
  projects: [
    { id: 'proj-oss', bullets: ['proj-oss-1'] },
  ],
  skills: ['skills-languages', 'skills-frameworks', 'skills-tools'],
  education: ['edu-university'],
}

const SAMPLE_FULLSTACK_PROFILE = {
  name: 'fullstack-leaning',
  description: 'Emphasizes API work, databases, backend alongside frontend',
  summary: 'summary-fullstack',
  sections: ['education', 'experience', 'projects', 'skills'],
  experience: [
    { id: 'exp-company-a', bullets: ['exp-a-1', 'exp-a-3'] },
    { id: 'exp-company-b', bullets: ['exp-b-1', 'exp-b-2'] },
  ],
  projects: [
    { id: 'proj-oss', bullets: ['proj-oss-1'] },
  ],
  skills: ['skills-languages', 'skills-frameworks', 'skills-tools'],
  education: ['edu-university'],
}

const SAMPLE_CONFIG = {
  anthropicModel: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  latexCommand: 'pdflatex',
  defaultProfile: 'frontend-heavy',
  outputDir: 'data/output',
}

export async function initCommand(): Promise<void> {
  heading('Resume CLI - Initialize')

  const dirs = [PATHS.data, PATHS.profiles, PATHS.companies, PATHS.output]
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true })
  }
  success('Created data directories')

  if (await fileExists(PATHS.masterResume)) {
    warn('master-resume.yaml already exists, skipping')
  } else {
    await fs.writeFile(
      PATHS.masterResume,
      YAML.stringify(SAMPLE_MASTER_RESUME, { lineWidth: 120 }),
      'utf-8',
    )
    success('Created sample master-resume.yaml')
  }

  if (await fileExists(PATHS.profile('frontend-heavy'))) {
    warn('frontend-heavy profile already exists, skipping')
  } else {
    await fs.writeFile(
      PATHS.profile('frontend-heavy'),
      YAML.stringify(SAMPLE_FRONTEND_PROFILE, { lineWidth: 120 }),
      'utf-8',
    )
    success('Created frontend-heavy profile')
  }

  if (await fileExists(PATHS.profile('fullstack-leaning'))) {
    warn('fullstack-leaning profile already exists, skipping')
  } else {
    await fs.writeFile(
      PATHS.profile('fullstack-leaning'),
      YAML.stringify(SAMPLE_FULLSTACK_PROFILE, { lineWidth: 120 }),
      'utf-8',
    )
    success('Created fullstack-leaning profile')
  }

  if (await fileExists(PATHS.config)) {
    warn('config.yaml already exists, skipping')
  } else {
    await fs.writeFile(
      PATHS.config,
      YAML.stringify(SAMPLE_CONFIG, { lineWidth: 120 }),
      'utf-8',
    )
    success('Created config.yaml')
  }

  console.log('')
  success('Initialization complete!')
  console.log(
    '\nNext steps:\n' +
    '  1. Edit data/master-resume.yaml with your real resume data\n' +
    '  2. Edit data/profiles/ to curate which items each profile includes\n' +
    '  3. Set ANTHROPIC_API_KEY environment variable\n' +
    '  4. Run: resume quick\n',
  )
}
