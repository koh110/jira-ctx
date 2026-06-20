import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { JiraConfig, JiraProfile } from './types.ts'

const defaultConfigPath = join(homedir(), '.config', 'jira-ctx', 'config.json')

function getEnv(name: string) {
  return process.env[name]
}

type JsonObject = Record<string, unknown>

function ensureObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJson(path: string) {
  const raw = readFileSync(path, 'utf8')
  return JSON.parse(raw)
}

function normalizeConfig(value: unknown) {
  if (!ensureObject(value)) {
    throw new Error('Config must be a JSON object')
  }

  const profilesValue = value.profiles
  if (!ensureObject(profilesValue)) {
    throw new Error('Config must include a profiles object')
  }

  const profiles: JiraConfig['profiles'] = {}

  for (const [name, candidate] of Object.entries(profilesValue)) {
    if (!ensureObject(candidate)) {
      throw new Error(`Profile ${name} must be an object`)
    }

    const { baseUrl, email, tokenEnv, authType } = candidate
    if (typeof baseUrl !== 'string' || baseUrl.length === 0) {
      throw new Error(`Profile ${name} is missing baseUrl`)
    }
    if (typeof email !== 'string' || email.length === 0) {
      throw new Error(`Profile ${name} is missing email`)
    }
    if (typeof tokenEnv !== 'string' || tokenEnv.length === 0) {
      throw new Error(`Profile ${name} is missing tokenEnv`)
    }
    if (authType !== undefined && authType !== 'apiToken') {
      throw new Error(`Profile ${name} has unsupported authType`) 
    }

    profiles[name] = {
      authType: authType === 'apiToken' ? 'apiToken' : undefined,
      baseUrl: baseUrl.replace(/\/$/, ''),
      email,
      tokenEnv,
    }
  }

  const config: JiraConfig = {
    profiles,
  }

  if (typeof value.defaultProfile === 'string' && value.defaultProfile.length > 0) {
    config.defaultProfile = value.defaultProfile
  }

  return config
}

export function getDefaultConfigPath() {
  return defaultConfigPath
}

export function loadConfig(configPath = defaultConfigPath) {
  if (!existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}. Run jira-ctx init first.`)
  }

  return normalizeConfig(readJson(configPath))
}

export function resolveProfiles(config: JiraConfig, options: { profile?: string; profiles?: string[]; allProfiles?: boolean }) {
  if (options.allProfiles) {
    return Object.entries(config.profiles).map(function mapProfile([name, profile]) {
      return {
        ...profile,
        name,
      }
    })
  }

  if (options.profiles && options.profiles.length > 0) {
    return options.profiles.map(function mapName(name) {
      const profile = config.profiles[name]
      if (!profile) {
        throw new Error(`Unknown profile: ${name}`)
      }
      return {
        ...profile,
        name,
      }
    })
  }

  if (options.profile) {
    const profile = config.profiles[options.profile]
    if (!profile) {
      throw new Error(`Unknown profile: ${options.profile}`)
    }
    return [{
      ...profile,
      name: options.profile,
    }]
  }

  if (config.defaultProfile) {
    const profile = config.profiles[config.defaultProfile]
    if (!profile) {
      throw new Error(`defaultProfile does not exist: ${config.defaultProfile}`)
    }
    return [{
      ...profile,
      name: config.defaultProfile,
    }]
  }

  throw new Error('No profile selected. Use --profile, --profiles, --all-profiles, or set defaultProfile.')
}

export function getProfileToken(profile: JiraProfile) {
  const value = getEnv(profile.tokenEnv)
  if (!value) {
    throw new Error(`Environment variable ${profile.tokenEnv} is not set for profile ${profile.name}`)
  }
  return value
}

export function writeSampleConfig(configPath = defaultConfigPath) {
  const dir = dirname(configPath)
  mkdirSync(dir, { recursive: true })

  const sample = {
    defaultProfile: 'work-a',
    profiles: {
      'work-a': {
        baseUrl: 'https://company-a.atlassian.net',
        email: 'you@example.com',
        tokenEnv: 'JIRA_TOKEN_WORK_A',
      },
      'work-b': {
        baseUrl: 'https://company-b.atlassian.net',
        email: 'you@example.jp',
        tokenEnv: 'JIRA_TOKEN_WORK_B',
      },
    },
  }

  writeFileSync(configPath, `${JSON.stringify(sample, null, 2)}\n`, 'utf8')
  return configPath
}
