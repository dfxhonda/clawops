# Agentic Poll Bridge (J-INFRA-08)

macOS LaunchAgent として 15 分ごとに specs/M1 を polling し、`status: ready_for_implementation` の spec を自動実装するブリッジ。

## アーキテクチャ

```
launchd (StartInterval=900)
  └─ scripts/agentic-poll.sh
       ├─ A: mkdir lock (/tmp/agentic-poll.lockdir)
       ├─ C: CLAUDE_CONFIG_DIR=/Users/dfx/.claude-dfx (keychain auth)
       ├─ D: claude -p "specs/M1 pickup prompt" --dangerously-skip-permissions
       └─ F: logs + ntfy
```

## 認証 (C_claude_auth_solution)

`claude -p` (non-interactive) は `CLAUDE_CONFIG_DIR` 環境変数でキーチェーンの認証情報を参照する。launchd のデフォルト環境には `CLAUDE_CONFIG_DIR` が含まれないため、plist の `EnvironmentVariables` に明示指定する。

```
CLAUDE_CONFIG_DIR=/Users/dfx/.claude-dfx
```

LaunchAgent (LaunchDaemon ではない) はユーザーのログインセッションで動作し、login keychain に自動でアクセスできる。

## インストール

```bash
bash scripts/install-agentic-poll.sh
```

- pre_install_cleanup 実行 (旧プロセス/cron/lock 削除)
- `~/Library/LaunchAgents/com.dfx.clawops.agentic-poll.plist` に配置
- `launchctl load -w` で即時起動

## アンインストール

```bash
bash scripts/uninstall-agentic-poll.sh
```

## ログ

| ファイル | 内容 |
|--------|------|
| `logs/agentic-poll.stdout.log` | launchd が捕捉する stdout |
| `logs/agentic-poll.stderr.log` | launchd が捕捉する stderr |
| `logs/agentic-poll-YYYYMMDD.log` | スクリプトが直接書く日次ローテーションログ |

## ntfy 通知

| イベント | 通知 |
|---------|------|
| pickup + done | `agentic-poll done commit=<hash>` |
| failure | `agentic-poll failure exit=<code>` |
| no_pickup | silent |
| lock_conflict | silent |

## ロック機構 (A)

```bash
LOCKDIR=/tmp/agentic-poll.lockdir
mkdir "$LOCKDIR" 2>/dev/null || exit 0
trap 'rm -rf "$LOCKDIR"' EXIT INT TERM
```

`mkdir` はアトミック操作 (POSIX 保証)。macOS 互換の実装。

## pickup 検出

claude 実行前後で `git rev-parse HEAD` を比較し、HEAD が変化した場合を pickup と判定して ntfy を送信。

## pickup プロンプト (D)

```
specs/M1 https://www.notion.so/3586440a374b81a6a7d4e8ef8daade60 を mcp__notion fetch、
status:ready_for_implementation の最初の spec を pickup、spec 通り実装、push origin main、
status を done に更新、status_log.entries に各 phase YAML 追記。
pickup なし or 全 done なら exit 0 silently。
```
