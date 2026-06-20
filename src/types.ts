export type JiraApiTokenProfile = {
  authType?: 'apiToken'
  baseUrl: string
  email: string
  tokenEnv: string
}

export type JiraProfile = JiraApiTokenProfile & {
  name: string
}

export type JiraConfig = {
  defaultProfile?: string
  profiles: Record<string, JiraApiTokenProfile>
}

export type JiraComment = {
  author: string
  created: string
  bodyMarkdown: string
}

export type NormalizedIssue = {
  profile: string
  siteUrl: string
  key: string
  url: string
  summary: string
  status: string
  priority?: string
  updated: string
  created?: string
  dueDate?: string
  assignee?: string
  reporter?: string
  labels: string[]
  descriptionMarkdown?: string
  recentComments: JiraComment[]
}

export type AssignedOptions = {
  profile?: string
  profiles?: string[]
  allProfiles: boolean
  format: 'markdown' | 'json'
  comments: number
  maxIssuesPerProfile: number
  maxTotalIssues?: number
  jql?: string
}

export type ParsedCommand = {
  command?: string
  args: string[]
}
