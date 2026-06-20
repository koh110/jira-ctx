# jira-ctx

Jira Cloud の担当チケットを取得し、Hermes Agent や他の LLM に渡しやすい Markdown / JSON に正規化する Node.js CLI です。

- 複数 Jira profile / アカウント対応
- Jira Cloud REST API `/rest/api/3/search/jql` を利用
- ADF (Atlassian Document Format) を Markdown に整形
- LLM 投入向けに profile ごとに安全に区切った出力

## Features

- `assigned` で自分に割り当てられた未完了チケットを取得
- `profile list` / `profile test` で複数アカウントを管理
- `--profile`, `--profiles`, `--all-profiles` をサポート
- `--comments`, `--max-issues-per-profile`, `--max-total-issues` でコンテキスト量を制御
- Markdown / JSON 出力

## Requirements

- Node.js 24+
- Jira Cloud API token

## Installation

```bash
cd ~/dev/jira-ctx
npm install --min-release-age=7
npm run build
mkdir -p ~/bin
ln -sf ~/dev/jira-ctx/dist/cli.js ~/bin/jira-ctx
```

## Quick Start

### 1. サンプル設定を作成

```bash
jira-ctx init
```

### 2. `~/.config/jira-ctx/config.json` を編集

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

### 3. API token を環境変数で渡す

```bash
export JIRA_TOKEN_WORK_A='...'
export JIRA_TOKEN_WORK_B='...'
```

1Password を使う場合の例:

```bash
op run --env-file=.env.jira -- jira-ctx assigned --all-profiles --format markdown
```

## Usage

profile 一覧:

```bash
jira-ctx profile list
```

接続確認:

```bash
jira-ctx profile test work-a
```

単一 profile で担当チケットを Markdown 出力:

```bash
jira-ctx assigned --profile work-a --format markdown --comments 3 --max-issues-per-profile 20
```

複数 profile をまとめて Markdown 出力:

```bash
jira-ctx assigned --all-profiles --format markdown --comments 3 --max-issues-per-profile 20 --max-total-issues 30
```

JSON 出力:

```bash
jira-ctx assigned --profiles work-a,work-b --format json
```

## Example Output

```markdown
# Jira assigned issues

Generated at: 2026-06-20T10:00:00.000Z
JQL: assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC

## Profile: work-a
Site: https://company-a.atlassian.net
Issues: 1

### PROJ-123: Login fails on production
Status: In Progress
Priority: High
URL: https://company-a.atlassian.net/browse/PROJ-123
Updated: 2026-06-19T12:34:56.000Z
Assignee: Kohta Ito
Labels: backend, auth

Description:
Investigate auth middleware regression.

Recent comments:
- 2026-06-19T03:21:00.000Z Alice: Reproduced in production.
```

## Hermes Agent での使い方

この repo とは別に、Hermes には `jira-context` skill を作成済みです。基本的には次のように呼びます。

```bash
jira-ctx assigned --all-profiles --format markdown --comments 3 --max-issues-per-profile 20 --max-total-issues 30
```

使うときのルール:

- Jira CLI の出力を事実データとして扱う
- チケット参照時は profile 名と issue key を含める
- 異なる profile のチケットを同じプロジェクトとみなさない
- 情報が古い場合は取得し直す

## Development

```bash
npm run lint
npm test
npm run build
```

## Roadmap

- `issue <KEY>` の詳細取得
- `brief` / `blockers` / `today` のような要約系サブコマンド
- OAuth profile 対応
- 添付ファイルや issue links の richer な整形

## License

MIT
