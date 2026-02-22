import fs from 'node:fs/promises'
import YAML from 'yaml'
import { appConfigSchema, type AppConfig } from './schema.js'
import { PATHS } from '../data/paths.js'
import { fileExists } from '../data/loader.js'

export async function loadConfig(): Promise<AppConfig> {
  if (await fileExists(PATHS.config)) {
    const content = await fs.readFile(PATHS.config, 'utf-8')
    const parsed = YAML.parse(content) ?? {}
    return appConfigSchema.parse(parsed)
  }
  return appConfigSchema.parse({})
}
