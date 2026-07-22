// SPEC-MAIL-IMPORT-ENGINE-01 (D-090): 汎用メール取込ルールエンジン Edge Function (mail-import)。
// mail_import_rules 駆動でマーカー非依存に案内を取り込む。供給元が増えてもコード改修ゼロ。
// verify_jwt=false (cron/手動叩き前提。dashboard で false を設定。inf-mail-import と同じ)。
// secrets: SUPABASE_URL / CLAWOPS_SECRET_KEY(or SUPABASE_SERVICE_ROLE_KEY) / GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN。
//
// ★安全設計: DRY_RUN 必須工程。?dry_run=1 のとき prize_announcements への insert と Gmail 既読化を一切行わず、
//   判定内訳/抽出品名/サンプル/抽出0件subject を JSON で返すだけ。既読化は不可逆ゆえルール欠陥のまま走らせない
//   (★依存で120行落とした事故の再発防止)。本実行は dry_run 結果をヒロ+chat が確認してから。
//
// dedup: 行番号込みキー。DB 側は prize_announcements.source_line (int) 列を前提 (DDL は chat が適用)。
//   列が無い環境では insert 前にフォールバック (source_line を除いた行で insert、re-run 重複は source_line 列導入で解消)。
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import {
  parseAnnouncements,
  isAnnouncement,
  dedupKey,
  filterNewAnnouncements,
  type MailRule,
} from "./ruleEngine.ts"

Deno.serve(async (req: Request) => {
  const startedAt = Date.now()
  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1"

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("CLAWOPS_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const supabase = createClient(url, serviceKey)

  const summary = {
    dry_run: dryRun,
    rules: 0,
    mails_total: 0,
    announcements: 0,
    not_announcements: 0,
    parsed_names: 0,
    inserted: 0,
    marked_read: 0,
    samples: [] as unknown[],
    empty_parse_subjects: [] as string[],
    errors: [] as string[],
    duration_ms: 0,
  }

  try {
    // 1) active ルールを priority 昇順でロード。
    const { data: rules, error: rulesErr } = await supabase
      .from("mail_import_rules")
      .select("*")
      .eq("active", true)
      .order("priority", { ascending: true })
    if (rulesErr) throw rulesErr
    summary.rules = (rules ?? []).length

    const accessToken = await getGmailAccessToken()

    for (const rule of (rules ?? []) as MailRule[] & { from_pattern: string }[]) {
      const fromAddr = String((rule as MailRule).from_pattern ?? "").replace(/\\/g, "")
      const months = (rule as MailRule).freshness_months ?? 2
      // 2) Gmail 検索: from + is:unread + newer_than (H7 鮮度)。
      const q = `from:${fromAddr} is:unread newer_than:${months}m`
      const msgIds = await gmailListMessageIds(accessToken, q)

      for (const msgId of msgIds) {
        try {
          summary.mails_total++
          const msg = await gmailGetMessage(accessToken, msgId)
          const { bodyText, attachmentNames, imageParts, internalDate, subject, threadId, sender } = extractMessage(msg)
          const hasImage = imageParts.length > 0

          // 3) 案内判定 (H8 入口)。
          const announcement = isAnnouncement(rule as MailRule, { attachmentNames, hasImage })
          if (!announcement) {
            summary.not_announcements++
            // H8: 案内でないもの (受書xlsx等) は触らない = 未読維持。既読化しない。
            await logSample(supabase, rule, { msgId, threadId, sender, subject, internalDate, hasImage, attachmentNames, bodyText, detectedType: "not_announcement", parsed: [], imported: false })
            continue
          }
          summary.announcements++

          // 4-8) パース。
          const items = parseAnnouncements(rule as MailRule, bodyText)
          summary.parsed_names += items.length
          if (items.length === 0) {
            summary.empty_parse_subjects.push(subject ?? "(no subject)")
            await logSample(supabase, rule, { msgId, threadId, sender, subject, internalDate, hasImage, attachmentNames, bodyText, detectedType: "announcement_empty", parsed: [], imported: false })
            continue
          }

          // dry_run サンプル (最大20件)
          if (summary.samples.length < 20) {
            for (const it of items) {
              if (summary.samples.length >= 20) break
              summary.samples.push({ subject, prize_name: it.prize_name, unit_cost: it.unit_cost, case_quantity: it.case_quantity, notes: it.notes })
            }
          }

          // 9) dedup (source_ref + prize_name + source_line)。
          const { data: existing } = await supabase
            .from("prize_announcements")
            .select("source_ref, prize_name, source_line")
            .eq("source_ref", msgId)
          const existingKeys = (existing ?? []).map((r: { source_ref: string; prize_name: string; source_line: number | null }) =>
            dedupKey(r.source_ref, r.prize_name, r.source_line ?? null))
          const fresh = filterNewAnnouncements(items, msgId, existingKeys)

          // 10) 学習台帳: mail_parse_samples へ毎回蓄積 (dry_run でも副作用なしゆえ実行)。
          await logSample(supabase, rule, { msgId, threadId, sender, subject, internalDate, hasImage, attachmentNames, bodyText, detectedType: "announcement", parsed: items, imported: false })

          if (dryRun) continue // ★dry_run: 以降 (insert / 既読化) は一切行わない。

          // 11) 本実行のみ: 画像アップロード + insert + 既読化 (H8)。
          let imageUrl: string | null = null
          if (imageParts.length > 0) {
            try { imageUrl = await uploadFirstImage(supabase, accessToken, msgId, imageParts) } catch (e) { summary.errors.push(`image ${msgId}: ${String(e)}`) }
          }
          if (fresh.length > 0) {
            const rows = fresh.map((it) => ({
              supplier_id: (rule as MailRule).supplier_id,
              prize_name: it.prize_name,
              unit_cost: it.unit_cost,
              case_quantity: it.case_quantity,
              case_cost: it.case_cost,
              source_type: "email",
              source_ref: msgId,
              source_line: it.line_number,
              status: "unread",
              notes: it.notes || null,
              image_url: imageUrl,
              email_received_at: internalDate ? new Date(Number(internalDate)).toISOString() : null,
            }))
            const { error: insErr } = await supabase.from("prize_announcements").insert(rows)
            if (insErr) summary.errors.push(`insert ${msgId}: ${insErr.message}`)
            else summary.inserted += rows.length
          }
          // H8: 取込完遂 → 既読化 (dry_run では上で return 済みゆえ到達しない)。
          await gmailMarkRead(accessToken, msgId)
          summary.marked_read++
        } catch (msgErr) {
          summary.errors.push(`msg ${msgId}: ${String(msgErr)}`)
        }
      }
    }

    summary.duration_ms = Date.now() - startedAt
    return new Response(JSON.stringify(summary, null, 2), { headers: { "Content-Type": "application/json" } })
  } catch (e) {
    summary.errors.push(String(e))
    summary.duration_ms = Date.now() - startedAt
    return new Response(JSON.stringify({ error: String(e), summary }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})

// mail_parse_samples 蓄積 (学習台帳、best-effort。dry_run でも実行=副作用なし)。
async function logSample(supabase: any, rule: MailRule, m: {
  msgId: string; threadId: string | null; sender: string | null; subject: string | null; internalDate: string | null
  hasImage: boolean; attachmentNames: string[]; bodyText: string; detectedType: string; parsed: unknown[]; imported: boolean
}): Promise<void> {
  try {
    await supabase.from("mail_parse_samples").insert({
      supplier_id: rule.supplier_id,
      gmail_msg_id: m.msgId,
      thread_id: m.threadId,
      sender: m.sender,
      subject: m.subject,
      internal_date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
      has_image: m.hasImage,
      attachment_names: m.attachmentNames,
      body_head: (m.bodyText ?? "").slice(0, 2000),
      detected_type: m.detectedType,
      parsed_result: m.parsed,
      parsed_count: (m.parsed as unknown[]).length,
      imported: m.imported,
    })
  } catch (_e) { /* テーブル未作成/権限は本体を壊さない */ }
}

// ─── Gmail helpers (inf-mail-import 踏襲) ─────────────────────────────────────
async function getGmailAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: Deno.env.get("GMAIL_CLIENT_ID") ?? "",
    client_secret: Deno.env.get("GMAIL_CLIENT_SECRET") ?? "",
    refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN") ?? "",
    grant_type: "refresh_token",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  })
  if (!res.ok) throw new Error(`gmail token refresh ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (!json.access_token) throw new Error("gmail token refresh: no access_token")
  return json.access_token as string
}

async function gmailListMessageIds(accessToken: string, q: string): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const u = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages")
    u.searchParams.set("q", q)
    if (pageToken) u.searchParams.set("pageToken", pageToken)
    const res = await fetch(u, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`gmail list ${res.status}: ${await res.text()}`)
    const json = await res.json()
    for (const m of json.messages ?? []) ids.push(m.id)
    pageToken = json.nextPageToken
  } while (pageToken)
  return ids
}

async function gmailGetMessage(accessToken: string, msgId: string): Promise<any> {
  const u = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`
  const res = await fetch(u, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`gmail get ${res.status}: ${await res.text()}`)
  return await res.json()
}

// H8 既読化: UNREAD ラベル除去。★本実行時のみ呼ばれる (dry_run 経路からは到達しない)。
async function gmailMarkRead(accessToken: string, msgId: string): Promise<void> {
  const u = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/modify`
  const res = await fetch(u, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  })
  if (!res.ok) throw new Error(`gmail markRead ${res.status}`)
}

function b64urlToBytes(data: string): Uint8Array {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function b64urlToText(data: string): string {
  return new TextDecoder("utf-8").decode(b64urlToBytes(data))
}

interface ImagePart { attachmentId?: string; data?: string; mimeType: string }

function headerValue(msg: any, name: string): string | null {
  const h = (msg.payload?.headers ?? []).find((x: any) => (x.name ?? "").toLowerCase() === name.toLowerCase())
  return h?.value ?? null
}

function extractMessage(msg: any): {
  bodyText: string; attachmentNames: string[]; imageParts: ImagePart[]; internalDate: string | null
  subject: string | null; threadId: string | null; sender: string | null
} {
  let bodyText = ""
  const attachmentNames: string[] = []
  const imageParts: ImagePart[] = []
  const walk = (part: any) => {
    if (!part) return
    const mime = part.mimeType ?? ""
    if (mime === "text/plain" && part.body?.data && !bodyText) bodyText = b64urlToText(part.body.data)
    if (part.filename) attachmentNames.push(part.filename)
    if (mime.startsWith("image/")) imageParts.push({ attachmentId: part.body?.attachmentId, data: part.body?.data, mimeType: mime })
    for (const p of part.parts ?? []) walk(p)
  }
  walk(msg.payload)
  if (!bodyText && msg.payload?.body?.data) bodyText = b64urlToText(msg.payload.body.data)
  return {
    bodyText, attachmentNames, imageParts, internalDate: msg.internalDate ?? null,
    subject: headerValue(msg, "Subject"), threadId: msg.threadId ?? null, sender: headerValue(msg, "From"),
  }
}

async function uploadFirstImage(supabase: any, accessToken: string, msgId: string, imageParts: ImagePart[]): Promise<string | null> {
  const part = imageParts[0]
  let bytes: Uint8Array | null = null
  if (part.data) bytes = b64urlToBytes(part.data)
  else if (part.attachmentId) {
    const u = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${part.attachmentId}`
    const res = await fetch(u, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`gmail attachment ${res.status}`)
    const json = await res.json()
    if (json.data) bytes = b64urlToBytes(json.data)
  }
  if (!bytes) return null
  const ext = part.mimeType.split("/")[1]?.split("+")[0] || "jpg"
  const path = `mail/${msgId}_0.${ext}`
  const { error } = await supabase.storage.from("announcements").upload(path, bytes, { contentType: part.mimeType, upsert: true })
  if (error && !String(error.message ?? "").toLowerCase().includes("exists")) throw error
  return path
}
