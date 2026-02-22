import { spawn } from 'node:child_process'
import Anthropic from '@anthropic-ai/sdk'
import { loadConfig } from '../config/loader.js'

type LlmBackend = 'claude-code' | 'api'

function detectBackend(): LlmBackend {
  if (process.env['ANTHROPIC_API_KEY']) {
    return 'api'
  }
  return 'claude-code'
}

async function callViaClaudeCode(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'text'], {
      timeout: 120000,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []

    child.stdout.on('data', (data: Buffer) => chunks.push(data))
    child.stderr.on('data', (data: Buffer) => errChunks.push(data))

    child.on('close', (code) => {
      const stdout = Buffer.concat(chunks).toString('utf-8').trim()
      const stderr = Buffer.concat(errChunks).toString('utf-8').trim()

      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr || stdout}`))
        return
      }
      resolve(stdout)
    })

    child.on('error', reject)

    child.stdin.write(prompt)
    child.stdin.end()
  })
}

async function callViaApi(prompt: string, maxTokens: number): Promise<string> {
  const config = await loadConfig()
  const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })

  const response = await client.messages.create({
    model: config.anthropicModel,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude API')
  }

  return textBlock.text.trim()
}

export async function callLlm(
  prompt: string,
  options?: { maxTokens?: number },
): Promise<string> {
  const backend = detectBackend()
  const maxTokens = options?.maxTokens ?? 4096

  if (backend === 'api') {
    return callViaApi(prompt, maxTokens)
  }

  return callViaClaudeCode(prompt)
}
