# DFX ClawOps - Codex Memory (AI Machine-Readable YAML)

```yaml
project: dfx_clawops
purpose: "Codex 起動時に project root から自動読込される memory file。Discord/Channels 経由で実装する Sonnet は本ルールに必ず従う。"
format_principle: "AI 機械可読 YAML 1ブロック化、装飾/絵文字/敬体全廃 (Notion v5.0 specs/INFRA 思想と一貫)"
principles:
  - ヒロさん直指示も spec ベースで実装
  - 全実装依頼を YAML 形式で spec.status_log に履歴化
  - 軽いレイアウト調整も commit message に対象 spec ID 含める
  - 進捗は対応 spec の status_log.entries に YAML 追記、Discord はサマリのみ
  - ntfy.sh 廃止、Discord 直返答に一本化
ad_hoc_yaml_logging_rule:
  added: 2026-05-10
  added_by: ヒロさん要望
  purpose: "ヒロ Discord 直指示も全て spec.yaml 形式で履歴化、伝言ゲームゼロ、司令塔Opus が Notion polling だけで完全把握可能"
  procedure:
    step_1_check_existing_spec:
      action: "直指示受領時、specs/M1, specs/M2, specs/M4 等に該当 spec が存在するか notion-fetch"
    step_2_when_related_spec_exists:
      - 既存 spec の status_log.entries に依頼内容を YAML 追記
      - 実装 → push
      - status_log に impl_done / push_done 追記
    step_3_when_no_related_spec:
      - specs/M1 末尾に新規 spec yaml 物理化
      - "id 形式: J-PATROL-NN_adhoc_<short_desc>"
      - 実装 → push → status_log 追記
    step_4_discord_response:
      format: "<short_desc> done: commit=<hash> (status_log @ specs/<module>)"
  example_existing_spec_status_log_entry:
    target_spec: J-PATROL-15
    entry:
      timestamp: "2026-05-10T12:30:00+09:00"
      phase: ad_hoc_request_received
      source: discord_dm_from_hiro
      request_yaml:
        title: chip 色を amber-100 から green-100 に変更
        scope_inferred: src/clawsupport/components/MachineRow.jsx
        rationale: "ヒロさん指示「chip もっと派手に」"
        related_spec: J-PATROL-15
  example_new_spec_in_specs_M1:
    target_location: specs/M1 末尾追記
    spec_yaml_template:
      id: "J-PATROL-99_adhoc_<short_desc>"
      title: "<ヒロさん指示の要約>"
      parent_module: M1_patrol
      status: in_progress
      hiro_approved_at: "<ISO 8601 +09:00>"
      source: discord_dm_from_hiro
      ad_hoc: true
      request_text: "<ヒロさん Discord 原文>"
      scope:
        write: ["<推測した対象ファイル>"]
        forbidden:
          - src/services/patrolCore.js
          - supabase/migrations/
          - scripts/eval/
      forbidden_patterns:
        - "test.skip("
        - "test.only("
        - "@ts-nocheck"
        - "console.log("
      status_log:
        entries: []
  exception_minor_fixes:
    skip_spec_for: [typo, comment, dependency_minor_bump]
    requirement: "commit message に「typo fix」「comment」等明示"
  command_tower_division_of_labor:
    natural_language_planned: "ヒロ → 司令塔Opus (web Codex.ai 別チャット) が spec 物理化 → Discord 投げで実装"
    discord_ad_hoc: "ヒロ Discord 直指示 → Sonnet が本ルール適用 → 自動 spec/status_log 物理化 → 実装"
commit_message:
  format: |
    <type>(<scope>): <subject>
    [詳細説明]
    Co-Authored-By: Codex Sonnet 4.6 <noreply@anthropic.com>
  rules:
    spec_based_implementation:
      tag: "[approved-by command-tower] を subject 末尾に付与必須"
    ad_hoc_or_derivative:
      tag: 省略可
      requirement: "spec ID または「派生修正」「ad-hoc」と明記"
  types: [feat, fix, chore, refactor, docs, test]
  scopes: [patrol-ui, admin-ui, infra, db]
forbidden_patterns:
  detection: "CI/lint で検出、検出時即停止 + push 拒否"
  patterns:
    - "test.skip("
    - "test.only("
    - "@ts-nocheck"
    - "TODO: skip"
    - "console.log("
db_schema_actual_columns:
  description: "列名違いの事故防止、spec 内表記と DB 実列名の差分対応必須"
  meter_readings:
    pk: "reading_id (text, gen_random_uuid)"
    NOT_id: "PK は reading_id、id ではない"
    optimistic_lock: [updated_at, updated_by]
    restock_stock: "prize_restock_count (int), prize_stock_count (int)"
    NOT_restock_stock: "restock / stock ではない"
    note: "note (text, 単数形)"
    NOT_notes: "notes ではない"
    organization_id: "uuid NOT NULL = 必須"
    booth_id: "text NOT NULL"
    booth_code: "text 別列存在"
    locker_columns: "ロッカー型は同レコード内 _2 _3 列で複数景品口 (out_meter_2, prize_name_2, stock_2, restock_2 等)"
  audit_logs:
    action: "text (action_type ではない)"
    before_data: "jsonb (before_json ではない)"
    after_data: "jsonb (after_json ではない)"
    staff_id: "text (actor_id ではない)"
    target_id: text
    target_table: text
    detail: "text (source_page を保存)"
    organization_id: "uuid NOT NULL = 必須"
  staff:
    columns: [name, "role (text, nullable)"]
    pk: "実装時 information_schema.columns で再確認"
  reference: "prize_masters 37列 / machines 30列 / stores 21列の詳細は specs/INFRA 末尾の implementation_hints.J-INFRA-04_zod_schemas.full_column_reference 参照"
notion_status_log_format:
  required: "実装中の各マイルストーンで対応 spec.status_log.entries に YAML 追記"
  phases:
    start: "spec を notion-fetch、scope 確認開始"
    scope_confirmed: "files_to_touch リスト"
    db_schema_verified: "schema_diff (spec の id を reading_id に修正等)"
    impl_in_progress: "impl 中 (files_done/files_remaining)"
    impl_done: "commit hash"
    test_done: "vitest/playwright 結果"
    push_done: "commit + deploy_url"
    post_done_adjustment: "直指示派生修正 (commit + reason)"
    ad_hoc_request_received: "ヒロ直指示受信 (source + request_yaml)"
    failed: "error + retry_plan"
  example_entry:
    timestamp: "2026-05-10T11:00:00+09:00"
    phase: impl_done
    commit: abc1234
  micro_commit_rule:
    added: 2026-05-10
    purpose: ヒロさん iPhone Notion で specs ページ開きっぱなし → 手動リロードで詳細進捗見える化
    when_to_write:
      - 各 phase 開始時 (即 entry 追加)
      - 各 phase 完了時 (entry 更新 or 新 entry)
      - 5 分以上待機中で進捗あれば中間 entry
    mandatory_entries:
      - "phase: start (タスク開始)"
      - "phase: scope_confirmed (files_to_touch リスト付き)"
      - "phase: db_schema_verified (該当する場合のみ)"
      - "phase: impl_in_progress (impl 中、files_done/files_remaining)"
      - "phase: impl_done (commit hash)"
      - "phase: test_done (vitest/playwright 結果)"
      - "phase: push_done (commit + deploy_url)"
    example_micro_commits:
      - timestamp: "2026-05-10T14:05:00+09:00"
        phase: scope_confirmed
        files_to_touch: [src/admin/AdminLayout.jsx, "..."]
      - timestamp: "2026-05-10T14:10:00+09:00"
        phase: impl_in_progress
        files_done: [AdminLayout.jsx, AdminSidebar.jsx]
        files_remaining: [AdminBreadcrumb.jsx, "..."]
      - timestamp: "2026-05-10T14:18:00+09:00"
        phase: impl_done
        commit: "<hash>"
scope_constraint:
  rule: "spec.scope.write 内のファイルだけ touch"
  on_violation: "即停止して Discord 報告、push しない"
  always_forbidden_unless_explicit:
    - migrations/
    - supabase.d.ts
    - src/services/patrolCore.js
    - "各モジュール跨ぎ import (eslint-plugin-boundaries で検出)"
discord_notification:
  on_done: "J-XXX done: commit=<hash> (サマリのみ)"
  on_failure: "J-XXX fail: <reason> (詳細は status_log)"
  no_intermediate: "中間進捗は Discord に流さない、status_log で司令塔Opus 把握"
  on_ad_hoc_done: "<short_desc> done: commit=<hash> (status_log @ specs/<module>)"
discord_heartbeat_rule:
  added: 2026-05-10
  purpose: 長時間タスク (5 分以上) の固まり判別、iPhone Discord で動作確認可能化
  interval_minutes: 5
  format: "J-XXX progress: phase=<name>, elapsed=<n>m, <key_metric>"
  example_messages:
    - "J-ADMIN-02 progress: phase=impl, elapsed=8m, files_touched=4/8"
    - "J-ADMIN-02 progress: phase=test, elapsed=15m, vitest 200/285"
    - "J-ADMIN-02 progress: phase=push, elapsed=18m, build green"
  when_to_send:
    - タスク開始時 (J-XXX start)
    - 各 phase 長期化 5 分超えたら 5 分間隔で elapsed 付き
    - phase 遷移時 (scope_confirmed, impl_done, test_done, push_done)
    - 失敗時 (J-XXX fail: <reason>)
  when_to_skip:
    - タスク全体 5 分以内完了見込み
    - 軽い ad-hoc 修正 (1 ファイルだけ等)
design_charter:
  goals:
    - アルバイト初日の分かりやすさ
    - 熟練者の爆速入力
    - 両立必須
  not_goals:
    - 機能追加が目的ではない
    - 業務効率が目的
  ui:
    patrol: "text-base 16px (熟練者向け)"
    navigation: Progressive Disclosure
    setting_o: "段分け w-full"
    numpad: "画面下 fixed footer panel (close 機構なし)"
    active_field: "ring-2 ring-blue-500 + bg-blue-50 + numpad 上ラベル"
  chips:
    visible: [IN差, OUT差]
    not_visible: [売上, 粗利]
    color_positive: green-100 bg
    color_negative: red-100 bg
    style: "text-base font-bold"
command_tower_collaboration:
  flow:
    step_1: "ヒロ自然言語(計画的) → 司令塔Opus (web Codex.ai)"
    step_2: "司令塔Opus が spec.yaml 物理化 (Notion specs/M1, specs/INFRA 等)"
    step_3: "ヒロ iPhone Discord で「specs/M1 末尾の J-XXX 実装して」短文 DM"
    step_4: "Sonnet (Codex) が notion-fetch → AGENTS.md ルール適用 → 実装 → status_log 追記 → push → Discord サマリ"
    step_5: "ヒロ Discord 直指示(軽い派生) → Sonnet が ad_hoc_yaml_logging_rule 適用 → status_log or 新規 spec 物理化 → 実装 → 司令塔Opus が Notion polling 把握"
  command_tower_observability_routes:
    vercel_api: "commit hash + diff + deploy state"
    supabase_mcp: "DB 直クエリ"
    notion_specs: "spec status + status_log entries (ad-hoc 直指示も全部ここに集約)"
    github_actions: "HTML scrape (CI fail 検出)"
upstream_first_debugging:
  source: "INC-005 教訓 (2026-04-27)"
  rule: "実機テスト失敗時は下流から疑うのは無駄足、最上流から疑う"
  first_questions:
    - 上流の SELECT/fetch 列に必要なフィールド入ってるか
    - キャッシュキーは新仕様に上がったか
  example: |
    prize_id=null 連発 → selectPrize / setPatrolOut / _buildPayload を 3 commit 修正したが全て無駄
    根本は getPrizeMasters の SELECT 列に prize_id が入ってなかっただけ
escalation_to_command_tower:
  triggers:
    - DB スキーマ変更 (migrations/ 追加) が必要
    - spec の scope.forbidden を変える必要
    - "業務ルール (JST 日付、業務日基準等) の判定基準が不明"
    - 同一 spec で 3 回以上 test fail
    - 既存 spec の structure を破壊する変更
    - ヒロさん直指示が複雑すぎて scope 推測困難
  on_complex_ad_hoc: |
    Discord で「司令塔に spec 物理化を依頼してください」と返答してヒロさんから司令塔Opus 経由ルートに誘導
jst_date_handling:
  forbidden: "toISOString().split / toISOString().slice"
  required: |
    toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
    or ローカルコンポーネント手組み
  business_rule:
    patrol_carry_forward_date: 前日付け
    replace_date: 当日付け
    same_booth_same_day: "巡回 + 入替レコード共存は正常"
    edit_mode_select: "created_at DESC LIMIT 1 で最新編集対象"
multi_tenant_isolation:
  pattern: 44店舗マルチテナント前提
  anon_fetch_rule: "organization_id フィルタ禁止 (RLS で担保)"
  reason: "anon 画面 fetch で organization_id 絞ると空配列になるバグ実績 (2026-04-26 ログイン v4)"
  on_new_table: RLS ポリシー必ず同時投入
```
