import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown } from '../src/render.ts'

const issues = [
  {
    profile: 'work-a',
    siteUrl: 'https://company-a.atlassian.net',
    key: 'PROJ-1',
    url: 'https://company-a.atlassian.net/browse/PROJ-1',
    summary: 'Login fails',
    status: 'In Progress',
    priority: 'High',
    updated: '2026-06-20T00:00:00.000Z',
    labels: ['backend'],
    descriptionMarkdown: 'Investigate auth middleware',
    recentComments: [
      {
        author: 'Kohta',
        created: '2026-06-19',
        bodyMarkdown: 'Looks reproducible in production',
      },
    ],
  },
  {
    profile: 'work-b',
    siteUrl: 'https://company-b.atlassian.net',
    key: 'APP-2',
    url: 'https://company-b.atlassian.net/browse/APP-2',
    summary: 'Update billing copy',
    status: 'To Do',
    priority: 'Medium',
    updated: '2026-06-18T00:00:00.000Z',
    labels: [],
    recentComments: [],
  },
]

test('renderMarkdown groups issues by profile', function () {
  const markdown = renderMarkdown(issues, {
    comments: 3,
    jql: 'assignee = currentUser()',
  })

  assert.match(markdown, /## Profile: work-a/)
  assert.match(markdown, /## Profile: work-b/)
  assert.match(markdown, /### PROJ-1: Login fails/)
  assert.match(markdown, /Recent comments:/)
})
