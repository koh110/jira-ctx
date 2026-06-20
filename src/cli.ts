#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { loadConfig, resolveProfiles, writeSampleConfig } from './config.ts'
import { testProfile, searchAssignedIssues } from './jira.ts'
import { renderMarkdown } from './render.ts'
import type { AssignedOptions, ParsedCommand } from './types.ts'

const defaultAssignedJql = 'assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC'

function printHelp() {
  const lines = [
    'jira-ctx - Jira Cloud context formatter for Hermes/LLMs',
    '',
    'Commands:',
    '  jira-ctx init [--config path]',
    '  jira-ctx profile list [--config path]',
    '  jira-ctx profile test <name> [--config path]',
    '  jira-ctx assigned [--profile name | --profiles a,b | --all-profiles] [--format markdown|json]',
    '',
    'Examples:',
    '  jira-ctx init',
    '  jira-ctx profile list',
    '  jira-ctx profile test work-a',
    '  jira-ctx assigned --all-profiles --format markdown --comments 3 --max-issues-per-profile 20',
  ]
  console.log(lines.join('\n'))
}

function parseCommand(argv: string[]): ParsedCommand {
  const [command, ...args] = argv
  return { command, args }
}

function parseCommonOptions(args: string[]) {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: false,
  })

  return {
    configPath: typeof parsed.values.config === 'string' ? parsed.values.config : undefined,
    help: parsed.values.help,
    positionals: parsed.positionals,
  }
}

function parseAssignedOptions(args: string[]): AssignedOptions & { configPath?: string; help: boolean } {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
      profile: { type: 'string' },
      profiles: { type: 'string' },
      'all-profiles': { type: 'boolean', default: false },
      format: { type: 'string', default: 'markdown' },
      comments: { type: 'string', default: '3' },
      'max-issues-per-profile': { type: 'string', default: '20' },
      'max-total-issues': { type: 'string' },
      jql: { type: 'string', default: defaultAssignedJql },
    },
    strict: true,
  })

  const format = parsed.values.format
  if (format !== 'markdown' && format !== 'json') {
    throw new Error(`Unsupported format: ${format}`)
  }

  const profiles = typeof parsed.values.profiles === 'string'
    ? parsed.values.profiles.split(',').map(function trimValue(value) {
        return value.trim()
      }).filter(function nonEmpty(value) {
        return value.length > 0
      })
    : undefined

  const comments = Number(parsed.values.comments)
  const maxIssuesPerProfile = Number(parsed.values['max-issues-per-profile'])
  const maxTotalIssues = typeof parsed.values['max-total-issues'] === 'string'
    ? Number(parsed.values['max-total-issues'])
    : undefined

  if (!Number.isInteger(comments) || comments < 0) {
    throw new Error('--comments must be a non-negative integer')
  }
  if (!Number.isInteger(maxIssuesPerProfile) || maxIssuesPerProfile <= 0) {
    throw new Error('--max-issues-per-profile must be a positive integer')
  }
  if (maxTotalIssues !== undefined && (!Number.isInteger(maxTotalIssues) || maxTotalIssues <= 0)) {
    throw new Error('--max-total-issues must be a positive integer')
  }

  return {
    configPath: typeof parsed.values.config === 'string' ? parsed.values.config : undefined,
    help: parsed.values.help,
    profile: typeof parsed.values.profile === 'string' ? parsed.values.profile : undefined,
    profiles,
    allProfiles: parsed.values['all-profiles'],
    format,
    comments,
    maxIssuesPerProfile,
    maxTotalIssues,
    jql: typeof parsed.values.jql === 'string' ? parsed.values.jql : defaultAssignedJql,
  }
}

async function runInit(args: string[]) {
  const options = parseCommonOptions(args)
  const path = writeSampleConfig(options.configPath)
  console.log(`Wrote sample config to ${path}`)
  console.log('Set your JIRA_TOKEN_* environment variables before running jira-ctx assigned')
}

async function runProfile(args: string[]) {
  const options = parseCommonOptions(args)
  const [subcommand, profileName] = options.positionals
  if (options.help || !subcommand) {
    console.log('Usage: jira-ctx profile list | jira-ctx profile test <name>')
    return
  }

  const config = loadConfig(options.configPath)

  if (subcommand === 'list') {
    for (const [name, profile] of Object.entries(config.profiles)) {
      const marker = config.defaultProfile === name ? ' (default)' : ''
      console.log(`${name}${marker}\t${profile.baseUrl}\t${profile.email}\t${profile.tokenEnv}`)
    }
    return
  }

  if (subcommand === 'test') {
    if (!profileName) {
      throw new Error('Usage: jira-ctx profile test <name>')
    }
    const profiles = resolveProfiles(config, { profile: profileName })
    const firstProfile = profiles[0]
    if (!firstProfile) {
      throw new Error(`Unknown profile: ${profileName}`)
    }
    const result = await testProfile(firstProfile)
    console.log(JSON.stringify(result, null, 2))
    return
  }

  throw new Error(`Unknown profile subcommand: ${subcommand}`)
}

async function runAssigned(args: string[]) {
  const options = parseAssignedOptions(args)
  if (options.help) {
    console.log('Usage: jira-ctx assigned [--profile name | --profiles a,b | --all-profiles] [--format markdown|json]')
    return
  }

  const config = loadConfig(options.configPath)
  const profiles = resolveProfiles(config, options)
  const issues: Awaited<ReturnType<typeof searchAssignedIssues>> = []

  for (const profile of profiles) {
    const profileIssues = await searchAssignedIssues(profile, {
      comments: options.comments,
      maxIssuesPerProfile: options.maxIssuesPerProfile,
      jql: options.jql ?? defaultAssignedJql,
    })

    for (const issue of profileIssues) {
      issues.push(issue)
      if (options.maxTotalIssues !== undefined && issues.length >= options.maxTotalIssues) {
        break
      }
    }

    if (options.maxTotalIssues !== undefined && issues.length >= options.maxTotalIssues) {
      break
    }
  }

  if (options.format === 'json') {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      jql: options.jql ?? defaultAssignedJql,
      issues,
    }, null, 2))
    return
  }

  console.log(renderMarkdown(issues, {
    comments: options.comments,
    jql: options.jql ?? defaultAssignedJql,
  }))
}

async function main() {
  const parsed = parseCommand(process.argv.slice(2))

  if (!parsed.command || parsed.command === '--help' || parsed.command === '-h') {
    printHelp()
    return
  }

  if (parsed.command === 'init') {
    await runInit(parsed.args)
    return
  }

  if (parsed.command === 'profile') {
    await runProfile(parsed.args)
    return
  }

  if (parsed.command === 'assigned') {
    await runAssigned(parsed.args)
    return
  }

  throw new Error(`Unknown command: ${parsed.command}`)
}

main().catch(function onError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
