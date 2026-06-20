import type { NormalizedIssue } from './types.ts'

function escapeLine(value: string | undefined) {
  return value && value.length > 0 ? value : '-'
}

function renderIssue(issue: NormalizedIssue, comments: number) {
  const lines: string[] = [
    `### ${issue.key}: ${issue.summary}`,
    `Status: ${issue.status}`,
    `Priority: ${escapeLine(issue.priority)}`,
    `URL: ${issue.url}`,
    `Updated: ${issue.updated}`,
  ]

  if (issue.assignee) {
    lines.push(`Assignee: ${issue.assignee}`)
  }
  if (issue.reporter) {
    lines.push(`Reporter: ${issue.reporter}`)
  }
  if (issue.dueDate) {
    lines.push(`Due: ${issue.dueDate}`)
  }
  if (issue.labels.length > 0) {
    lines.push(`Labels: ${issue.labels.join(', ')}`)
  }

  lines.push('')

  if (issue.descriptionMarkdown && issue.descriptionMarkdown.length > 0) {
    lines.push('Description:')
    lines.push(issue.descriptionMarkdown)
    lines.push('')
  }

  if (issue.recentComments.length > 0 && comments > 0) {
    lines.push('Recent comments:')
    for (const comment of issue.recentComments.slice(0, comments)) {
      lines.push(`- ${comment.created} ${comment.author}: ${comment.bodyMarkdown.replace(/\n+/g, ' ').trim()}`)
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

export function renderMarkdown(issues: NormalizedIssue[], options: { comments: number; jql: string }) {
  const byProfile = new Map<string, NormalizedIssue[]>()

  for (const issue of issues) {
    const existing = byProfile.get(issue.profile)
    if (existing) {
      existing.push(issue)
      continue
    }
    byProfile.set(issue.profile, [issue])
  }

  const lines: string[] = [
    '# Jira assigned issues',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `JQL: ${options.jql}`,
    '',
  ]

  for (const entry of byProfile.entries()) {
    const [profile, profileIssues] = entry
    const first = profileIssues[0]
    if (!first) {
      continue
    }

    lines.push(`## Profile: ${profile}`)
    lines.push(`Site: ${first.siteUrl}`)
    lines.push(`Issues: ${profileIssues.length}`)
    lines.push('')

    for (const issue of profileIssues) {
      lines.push(renderIssue(issue, options.comments))
      lines.push('')
      lines.push('---')
      lines.push('')
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}
