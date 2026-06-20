# jira-ctx

> GitHub repo を作る前提のローカル開発向け CLI プロジェクトです。

Jira Cloud の担当チケットを取得し、LLM に渡しやすい Markdown / JSON に正規化する Node.js CLI です。

## できること

- `Jira Cloud REST API /rest/api/3/search/jql` を使って自分の担当チケットを取得
- 複数 profile を切り替え、またはまとめて取得
- ADF (Atlassian Document Format) の description / comment を Markdown に整形
- Hermes Agent からそのまま読み込める Markdown を stdout に出力

## セットアップ

```bash
cd ~/dev/jira-ctx
npm install --min-release-age=7
npm run build
mkdir -p ~/bin
ln -sf ~/dev/jira-ctx/dist/cli.js ~/bin/jira-ctx
```

設定ファイルのひな形を作ります。

```bash
jira-ctx init
```

作成される `~/.config/jira-ctx/config.json` を編集します。

```json
{
  "defaultProfile": "work-a",
  "profiles": {
    "work-a": {
      "baseUrl": "https://company-a.atlassian.net",
      "email": "you@example.com",
      "tokenEnv": "JIRA_TOKEN_WORK_A"
    },
    "work-b": {
      "baseUrl": "https://company-b.atlassian.net",
      "email": "you@example.jp",
      "tokenEnv": "JIRA_TOKEN_WORK_B"
    }
  }
}
```

API token は config に直接書かず、環境変数で渡します。

```bash
export JIRA_TOKEN_WORK_A='...'
export JIRA_TOKEN_WORK_B='...'
```

1Password を使うなら例えばこうです。

```bash
op run --env-file=.env.jira -- jira-ctx assigned --all-profiles --format markdown
```

## 使い方

profile 一覧:

```bash
jira-ctx profile list
```

接続確認:

```bash
jira-ctx profile test work-a
```

担当チケットを Markdown で取得:

```bash
jira-ctx assigned --profile work-a --format markdown --comments 3 --max-issues-per-profile 20
```

複数アカウントをまとめて取得:

```bash
jira-ctx assigned --all-profiles --format markdown --comments 3 --max-issues-per-profile 20 --max-total-issues 30
```

JSON 出力:

```bash
jira-ctx assigned --profiles work-a,work-b --format json
```

## Hermes Skill 例

```markdown
Use this skill when the user asks about their current Jira tickets, blockers, priorities, or next actions.

Run:

`jira-ctx assigned --all-profiles --format markdown --comments 3 --max-issues-per-profile 20 --max-total-issues 30`

Rules:
- Treat Jira context as source data.
- Always include profile name and issue key when referring to tickets.
- Do not assume issues from different profiles belong to the same project.
- If context is missing or stale, ask the user to refresh Jira context.
```
