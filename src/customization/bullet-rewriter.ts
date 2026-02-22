import { callLlm } from '../utils/claude.js'
import { bulletRewritePrompt, summaryRefinementPrompt } from '../analysis/prompts.js'

export async function rewriteBullet(
  originalText: string,
  terminology: readonly string[],
  emphasisAreas: readonly string[],
): Promise<string> {
  const prompt = bulletRewritePrompt(originalText, [...terminology], [...emphasisAreas])
  return callLlm(prompt, { maxTokens: 1024 })
}

export async function refineSummary(
  currentSummary: string,
  jdTitle: string,
  emphasisAreas: readonly string[],
  terminology: readonly string[],
): Promise<string> {
  const prompt = summaryRefinementPrompt(currentSummary, jdTitle, [...emphasisAreas], [...terminology])
  return callLlm(prompt, { maxTokens: 1024 })
}
