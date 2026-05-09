# J-INFRA-10: Notion MCP Write Scope Recovery

## 症状

Claude Code から Notion MCP ツールを呼ぶと以下エラーが返る:

```
{"type":"permission_error","message":"OAuth token does not meet scope requirement user:mcp_servers"}
```

読み取り (`notion-fetch`) も書き込み (`notion-update-page`, `notion-create-pages`) も全て失敗する。

## 根本原因

claude.ai の Notion MCP 接続に使用されている OAuth トークンが `user:mcp_servers` スコープを持っていない。

- `claude mcp list` 上は "Connected" と表示されるが、実際のトークンスコープが不足
- ローカル設定 (`~/.claude/settings.local.json`) の問題ではない
- Notion 側の API キーの問題でもない

## 復旧手順

### Step 1: 再認証スクリプトを実行

```bash
bash scripts/notion-mcp-reauth.sh clawops-hiro-0328
```

再認証 URL と手順が ntfy 経由でヒロの iPhone に届く。

### Step 2: iPhone Safari で再認証

1. ntfy に届いた URL を開く: `https://claude.ai/settings/integrations`
2. "Notion" インテグレーションを見つける
3. 「切断」→「再接続」(または「再認証」ボタン)をタップ
4. 要求されるスコープ (including `user:mcp_servers`) を全て承認

### Step 3: 接続確認

Claude Code セッションを再起動後、MCP 接続を確認:

```bash
claude mcp list
```

### Step 4: 書き込みアクセス確認

```bash
NOTION_API_KEY=secret_xxx bash scripts/notion-mcp-verify.sh
```

Internal Integration Token を持っている場合は上記で確認可能。

MCP 経由での確認は Claude Code チャットから:

```
notion-fetch https://www.notion.so/3586440a374b815db98dff8b8e0a4493
```

エラーなく応答が返れば復旧完了。

## 恒久対策

- `~/.claude/settings.local.json` に `notion-create-pages` を allow list 追加済み (J-INFRA-10)
- Notion MCP 接続は定期的に claude.ai 側でトークン更新が必要な場合がある
- 接続が切れた際はこの手順を参照

## 関連ファイル

- `scripts/notion-mcp-reauth.sh` — 再認証 URL 送信スクリプト
- `scripts/notion-mcp-verify.sh` — 書き込みアクセス検証スクリプト
- `e2e/journey-infra-10.spec.js` — 自動テスト
