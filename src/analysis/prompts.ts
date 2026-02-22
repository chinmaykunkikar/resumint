import type { MasterResume, VoiceProfile, JdAnalysis } from '../data/schema.js'

export function jdAnalysisPrompt(jd: string, userSkills: string[]): string {
  return `You are a resume optimization expert. Analyze this job description and return structured JSON.

The candidate has these skills: ${userSkills.join(', ')}

Job Description:
---
${jd}
---

Return ONLY valid JSON matching this exact schema:
{
  "title": "string - job title",
  "company": "string - company name (or 'Unknown' if not found)",
  "seniority": "junior|mid|senior|staff|principal|unknown",
  "domain": "string - primary domain (e.g., 'Frontend Web Development', 'Full-Stack', 'Backend')",
  "domainFit": "strong|moderate|weak|mismatch",
  "domainFitReason": "string - brief explanation of domain fit assessment",
  "skills": [
    {
      "skill": "string - skill name from JD",
      "category": "EXACT|ADJACENT|LEARNABLE|DOMAIN_CHANGE",
      "reason": "string - why this classification",
      "priority": "must-have|nice-to-have"
    }
  ],
  "keyTerminology": ["string - key terms/phrases from JD to mirror in resume"],
  "emphasisAreas": ["string - what the JD emphasizes most"],
  "summaryRecommendation": "string - recommended focus for resume summary"
}

Classification rules for skills:
- EXACT: Candidate already has this exact skill
- ADJACENT: Same ecosystem, trivially learnable (e.g., React dev → Next.js, Zustand)
- LEARNABLE: Same domain, reasonable stretch (e.g., React → Vue.js)
- DOMAIN_CHANGE: Completely different stack (e.g., Frontend → Java/Spring Boot)

Be thorough - extract ALL skills mentioned. Mark clearly whether must-have or nice-to-have.`
}

export function bulletRewritePrompt(
  originalBullet: string,
  terminology: string[],
  emphasisAreas: string[],
): string {
  return `You are a resume bullet point optimizer. Rewrite this bullet to better match the target job.

Original bullet:
"${originalBullet}"

Key terminology to incorporate (where naturally fitting): ${terminology.join(', ')}
Emphasis areas: ${emphasisAreas.join(', ')}

Rules:
1. NEVER fabricate experience - only rephrase existing accomplishments
2. Keep quantified metrics (numbers, percentages) exactly as-is
3. Mirror the JD's language where it naturally fits
4. Maintain the STAR format (Situation/Task → Action → Result)
5. Keep it to 1-2 lines max
6. Start with a strong action verb
7. NEVER use em-dashes (—) in the text. The only acceptable use of dashes is en-dashes (–) for date ranges (e.g., "2022–2024"). Use commas, semicolons, colons, or restructure the sentence instead.

Return ONLY the rewritten bullet text, nothing else.`
}

export function summaryRefinementPrompt(
  currentSummary: string,
  jdTitle: string,
  emphasisAreas: string[],
  terminology: string[],
): string {
  return `Refine this resume summary for a "${jdTitle}" position.

Current summary:
"${currentSummary}"

Key emphasis: ${emphasisAreas.join(', ')}
Terminology to mirror: ${terminology.join(', ')}

Rules:
1. Keep it to 2-3 sentences
2. Mirror JD language naturally
3. Never claim experience you don't have
4. Focus on the strongest relevant qualifications
5. NEVER use em-dashes (—). Use commas, semicolons, colons, or restructure the sentence instead. En-dashes (–) are only acceptable for date ranges.

Return ONLY the refined summary text.`
}

export function extractAllSkills(master: MasterResume): string[] {
  const skills = new Set<string>()

  for (const cat of master.skills) {
    for (const item of cat.items) {
      skills.add(item)
    }
  }

  for (const exp of master.experience) {
    for (const bullet of exp.bullets) {
      for (const tag of bullet.tags) {
        skills.add(tag)
      }
    }
  }

  return [...skills]
}

// ── Shared Helpers ──

export function formatResumeForPrompt(master: MasterResume): string {
  const lines: string[] = [
    `Name: ${master.name}`,
    '',
  ]

  if (master.summary.length > 0) {
    lines.push('Summary options:')
    for (const s of master.summary) {
      lines.push(`  - ${s.text}`)
    }
    lines.push('')
  }

  lines.push('Experience:')
  for (const exp of master.experience) {
    lines.push(`  ${exp.title} at ${exp.company} (${exp.startDate} – ${exp.endDate})`)
    for (const b of exp.bullets) {
      lines.push(`    • ${b.text}`)
    }
  }
  lines.push('')

  if (master.projects.length > 0) {
    lines.push('Projects:')
    for (const proj of master.projects) {
      lines.push(`  ${proj.name} [${proj.technologies}]`)
      for (const b of proj.bullets) {
        lines.push(`    • ${b.text}`)
      }
    }
    lines.push('')
  }

  lines.push('Skills:')
  for (const cat of master.skills) {
    lines.push(`  ${cat.category}: ${cat.items.join(', ')}`)
  }

  return lines.join('\n')
}

export function formatVoiceForPrompt(voice: VoiceProfile): string {
  const lines: string[] = [
    'VOICE PROFILE — Write in this exact style:',
    '',
    `Style: ${voice.style}`,
    `Tone: ${voice.tone}`,
    voice.description,
    '',
    'Structural signatures to use:',
    ...voice.signatures.map(s => `  - ${s}`),
    '',
    'HARD RULES — Never do these:',
    ...voice.antiPatterns.map(a => `  - ${a}`),
  ]
  return lines.join('\n')
}

// ── Reachout Prompt ──

export function reachoutPrompt(
  linkedinProfile: string,
  master: MasterResume,
  voice: VoiceProfile,
  jd?: string,
): string {
  const resumeContext = formatResumeForPrompt(master)
  const voiceBlock = formatVoiceForPrompt(voice)

  const jdBlock = jd
    ? `\nTarget Role JD (use for relevance, do NOT mention the job directly in the connection note):\n---\n${jd}\n---\n`
    : ''

  return `You are writing a LinkedIn outreach on behalf of a job seeker. Generate two pieces:

1. CONNECTION NOTE: ~300 characters max. This appears with the connection request. Must feel like a real human wrote it — no templates. Reference something specific from their profile that connects to the sender's experience. No ask, no pitch — just genuine professional interest.

2. FOLLOW-UP MESSAGE: ~150-250 words. Sent after they accept. More substantive — connect shared technical interests, mention a specific thing from their work that caught the sender's eye, and naturally segue into being interested in opportunities at their company. End with a low-pressure ask (coffee chat, not "please refer me").

${voiceBlock}

Sender's background:
---
${resumeContext}
---

Target person's LinkedIn profile:
---
${linkedinProfile}
---
${jdBlock}
Return ONLY valid JSON matching this exact schema:
{
  "connectionNote": "string - the connection request note (~300 chars)",
  "followUpMessage": "string - the follow-up DM (~150-250 words)"
}

IMPORTANT: NEVER use em-dashes (—) anywhere in the generated text. Use commas, semicolons, colons, or restructure sentences instead. En-dashes (–) are only acceptable for date ranges.`
}

// ── Cover Letter Prompt ──

export function coverLetterPrompt(
  jd: string,
  analysis: JdAnalysis,
  master: MasterResume,
  voice: VoiceProfile,
  talkingPoints?: string,
): string {
  const resumeContext = formatResumeForPrompt(master)
  const voiceBlock = formatVoiceForPrompt(voice)

  const talkingPointsBlock = talkingPoints
    ? `\nSpecific points the sender wants to address:\n---\n${talkingPoints}\n---\n`
    : ''

  return `Write a cover letter for this role. Not a template — a real letter that sounds like the sender actually wrote it.

${voiceBlock}

Role: ${analysis.title} at ${analysis.company}
Domain: ${analysis.domain}
Key emphasis areas: ${analysis.emphasisAreas.join(', ')}
Terminology to mirror: ${analysis.keyTerminology.join(', ')}
Summary recommendation: ${analysis.summaryRecommendation}

Job Description:
---
${jd}
---

Sender's background:
---
${resumeContext}
---
${talkingPointsBlock}
Rules:
1. 250-400 words. Not a word more.
2. Do NOT restate the resume — pick 2-3 experiences that directly map to what this role needs and explain WHY they matter for this specific team.
3. Show you understand what the company/team actually does. Reference specifics from the JD.
4. Address gaps honestly if the analysis shows weak/moderate fit — frame them as adjacent strengths.
5. Close with confidence, not desperation. No "I would be honored" or "thank you for considering."
6. No header/footer formatting — just the letter body.

Return ONLY valid JSON matching this exact schema:
{
  "coverLetter": "string - the full cover letter text"
}

IMPORTANT: NEVER use em-dashes (—) anywhere in the generated text. Use commas, semicolons, colons, or restructure sentences instead. En-dashes (–) are only acceptable for date ranges.`
}
