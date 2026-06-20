import { Buffer } from 'node:buffer'
import { adfToMarkdown } from './adf.ts'
import { getProfileToken } from './config.ts'
import type { JiraComment, JiraProfile, NormalizedIssue } from './types.ts'

const requestedFields = [
  'summary',
  'status',
  'priority',
  'assignee',
  'reporter',
  'updated',
  'created',
  'duedate',
  'labels',
  'parent',
  'description',
  'comment',
  'issuelinks',
] as const

type JsonObject = Record<string, unknown>

function ensureObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ensureString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function ensureArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function getAuthHeader(profile: JiraProfile) {
  const token = getProfileToken(profile)
  const auth = Buffer.from(`${profile.email}:${token}`).toString('base64')
  return `Basic ${auth}`
}

async function jiraRequest(profile: JiraProfile, path: string, init?: RequestInit) {
  const response = await fetch(`${profile.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: getAuthHeader(profile),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`[${profile.name}] Jira API error ${response.status}: ${body}`)
  }

  return response.json()
}

function pickUserDisplayName(value: unknown) {
  if (!ensureObject(value)) {
    return undefined
  }
  return ensureString(value.displayName) ?? ensureString(value.emailAddress) ?? ensureString(value.accountId)
}

function normalizeComments(fields: unknown, maxComments: number): JiraComment[] {
  if (!ensureObject(fields) || !ensureObject(fields.comment)) {
    return []
  }

  const comments = ensureArray(fields.comment.comments)
  const normalized: JiraComment[] = []
  const start = Math.max(0, comments.length - maxComments)

  for (let index = start; index < comments.length; index += 1) {
    const comment = comments[index]
    if (!ensureObject(comment)) {
      continue
    }
    const author = pickUserDisplayName(comment.author) ?? 'Unknown'
    const created = ensureString(comment.created) ?? ''
    const bodyMarkdown = adfToMarkdown(comment.body)
    normalized.push({
      author,
      created,
      bodyMarkdown,
    })
  }

  return normalized
}

function normalizeIssue(profile: JiraProfile, issue: unknown, maxComments: number): NormalizedIssue {
  const issueObject = ensureObject(issue) ? issue : {}
  const fields = ensureObject(issueObject.fields) ? issueObject.fields : {}
  const key = ensureString(issueObject.key)
  if (!key) {
    throw new Error(`[${profile.name}] Issue is missing key`)
  }

  const summary = ensureString(fields.summary) ?? '(no summary)'
  const status = ensureObject(fields.status) ? (ensureString(fields.status.name) ?? 'Unknown') : 'Unknown'
  const priority = ensureObject(fields.priority) ? ensureString(fields.priority.name) : undefined
  const updated = ensureString(fields.updated) ?? ''
  const created = ensureString(fields.created)
  const dueDate = ensureString(fields.duedate)
  const labels = ensureArray(fields.labels).filter(function isString(value): value is string {
    return typeof value === 'string'
  })

  return {
    profile: profile.name,
    siteUrl: profile.baseUrl,
    key,
    url: `${profile.baseUrl}/browse/${key}`,
    summary,
    status,
    priority,
    updated,
    created,
    dueDate,
    assignee: pickUserDisplayName(fields.assignee),
    reporter: pickUserDisplayName(fields.reporter),
    labels,
    descriptionMarkdown: adfToMarkdown(fields.description),
    recentComments: normalizeComments(fields, maxComments),
  }
}

export async function testProfile(profile: JiraProfile) {
  const response = await jiraRequest(profile, '/rest/api/3/myself')
  if (!ensureObject(response)) {
    throw new Error(`[${profile.name}] Unexpected response from /myself`)
  }
  return {
    profile: profile.name,
    siteUrl: profile.baseUrl,
    accountId: ensureString(response.accountId) ?? '-',
    displayName: ensureString(response.displayName) ?? '-',
    emailAddress: ensureString(response.emailAddress) ?? '-',
  }
}

export async function searchAssignedIssues(profile: JiraProfile, options: { comments: number; maxIssuesPerProfile: number; jql: string }) {
  const issues: NormalizedIssue[] = []
  let nextPageToken: string | undefined

  do {
    const body = {
      jql: options.jql,
      maxResults: Math.min(50, Math.max(1, options.maxIssuesPerProfile - issues.length)),
      nextPageToken,
      fields: requestedFields,
    }

    const response = await jiraRequest(profile, '/rest/api/3/search/jql', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    const data = ensureObject(response) ? response : {}
    const rawIssues = ensureArray(data.issues)

    for (const rawIssue of rawIssues) {
      issues.push(normalizeIssue(profile, rawIssue, options.comments))
      if (issues.length >= options.maxIssuesPerProfile) {
        return issues
      }
    }

    nextPageToken = ensureString(data.nextPageToken)
  } while (nextPageToken)

  return issues
}
