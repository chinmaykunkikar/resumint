import { callLlm } from '../utils/claude.js'
import { jdAnalysisSchema, type JdAnalysis } from '../data/schema.js'
import { jdAnalysisPrompt, extractAllSkills } from './prompts.js'
import { loadMasterResume } from '../data/loader.js'
import { CliError } from '../utils/errors.js'

export async function analyzeJd(jd: string): Promise<JdAnalysis> {
  const master = await loadMasterResume()
  const userSkills = extractAllSkills(master)

  const raw = await callLlm(jdAnalysisPrompt(jd, userSkills))

  // Handle potential markdown code block wrapping
  const cleaned = raw.startsWith('```')
    ? raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    : raw

  try {
    const parsed = JSON.parse(cleaned)
    return jdAnalysisSchema.parse(parsed)
  } catch (error) {
    throw new CliError(
      'Failed to parse JD analysis response',
      error instanceof Error ? error.message : 'Invalid JSON from Claude',
    )
  }
}
