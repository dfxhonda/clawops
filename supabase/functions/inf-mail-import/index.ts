// SPEC-INF-MAIL-IMPORT-01 (D-086): インフィニティ案内メール取込 Edge Function (GAS滅 Phase1)。
// inf_main@8infinity.jp の案内メールを無人で prize_announcements に溜める。案内=発注前の生データ。品名無加工。
// verify_jwt=false (cron invoke、SGP系と同様)。secrets: GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN。
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { parseInfinityAnnouncement, isOrderMail, filterNewAnnouncements, announcementKey } from "./parseInfinity.ts"

const INF_FROM = "inf_main@8infinity.jp"
const SUPPLIER_ID = "INF"
const BUCKET = "announcements";

Deno.serve(async (_req: Request) => {
  const startedAt = Date.now()
  const log = {
    run_at: new Date().toISOString(),
    records_fetched: 0,
    records_inserted: 0,
    records_updated: 0,
    records_skipped: 0,
    skipped_msg_ids: [] as string[],
    images_uploaded: 0,
    errors: [] as string[],
    duration_ms: 0,
  }

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("CLAWOPS_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const supabase = createClient(url, serviceKey)

  const writeLog = async () => {
    log.duration_ms = Date.now() - startedAt
    // inf_import_logs は未作成の可能性 (chat が DDL 適用)。best-effort で本体を壊さない。
    try {
      await supabase.from("inf_import_logs").insert({
        run_at: log.run_at,
        records_fetched: log.records_fetched,
        records_inserted: log.records_inserted,
        records_updated: log.records_updated,
        records_skipped: log.records_skipped,
        skipped_msg_ids: log.skipped_msg_ids,
        errors: log.errors,
        duration_ms: log.duration_ms,
      })
    } catch (_e) { /* テーブル未作成/権限は無視 */ }
  }

  try {
    // 1) Gmail OAuth: refresh_token → access_token (毎 invoke)。
    const accessToken = await getGmailAccessToken()

    // 2) list: from:INF。処理済 msgId は DB 側で除外。
    const msgIds = await gmailListMessageIds(accessToken, `from:${INF_FROM}`)
    log.records_fetched = msgIds.length

    for (const msgId of msgIds) {
      try {
        const msg = await gmailGetMessage(accessToken, msgId)
        const { bodyText, attachmentNames, imageParts, internalDate } = extractMessage(msg)

        // 3) isOrder gate: 請書xlsx添付あり = 発注(Phase2) → 案内として処理しない (GAS L640 事故回避)。
        if (isOrderMail(attachmentNames)) {
          log.records_skipped++
          log.skipped_msg_ids.push(msgId)
          continue
        }

        // 4) パース (品名無加工)。
        const items = parseInfinityAnnouncement(bodyText)
        if (items.length === 0) { log.records_skipped++; continue }

        // 5) dedup: 既存 source_ref(msgId)+prize_name を除外。
        const { data: existing } = await supabase
          .from("prize_announcements")
          .select("source_ref, prize_name")
          .eq("source_ref", msgId)
        const existingKeys = (existing ?? []).map((r) => announcementKey(r.source_ref, r.prize_name))
        const fresh = filterNewAnnouncements(items, msgId, existingKeys)
        if (fresh.length === 0) { log.records_skipped++; continue }

        // 6) 画像: 添付/インライン image を Storage へ (先頭1枚を代表として全 fresh に紐付け)。
        let imageUrl: string | null = null
        if (imageParts.length > 0) {
          try {
            imageUrl = await uploadFirstImage(supabase, accessToken, msgId, imageParts, log)
          } catch (imgErr) {
            log.errors.push(`image ${msgId}: ${String((imgErr as Error)?.message ?? imgErr)}`)
          }
        }

        // 7) insert (email_received_at = Gmail internalDate)。
        const rows = fresh.map((it) => ({
          supplier_id: SUPPLIER_ID,
          prize_name: it.prize_name,
          unit_cost: it.unit_cost,
          case_quantity: it.case_quantity,
          source_type: "email",
          source_ref: msgId,
          status: "unread",
          notes: it.notes || null,
          image_url: imageUrl,
          email_received_at: internalDate ? new Date(Number(internalDate)).toISOString() : null,
        }))
        const { error: insErr } = await supabase.from("prize_announcements").insert(rows)
        if (insErr) {
          if (String(insErr.message ?? "").includes("duplicate")) { log.records_skipped++ }
          else { log.errors.push(`insert ${msgId}: ${insErr.message}`) }
        } else {
          log.records_inserted += rows.length
        }
      } catch (msgErr) {
        log.errors.push(`msg ${msgId}: ${String((msgErr as Error)?.message ?? msgErr)}`)
      }
    }

    await writeLog()
    return new Response(JSON.stringify(log), { headers: { "Content-Type": "application/json" } })
  } catch (e) {
    log.errors.push(String((e as Error)?.message ?? e))
    await writeLog()
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e), log }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

// ─── Gmail helpers ───────────────────────────────────────────────────────────
async function getGmailAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: Deno.env.get("GMAIL_CLIENT_ID") ?? "",
    client_secret: Deno.env.get("GMAIL_CLIENT_SECRET") ?? "",
    refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN") ?? "",
    grant_type: "refresh_token",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
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

// base64url → text / bytes
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

function extractMessage(msg: any): { bodyText: string; attachmentNames: string[]; imageParts: ImagePart[]; internalDate: string | null } {
  let bodyText = ""
  const attachmentNames: string[] = []
  const imageParts: ImagePart[] = []

  const walk = (part: any) => {
    if (!part) return
    const mime = part.mimeType ?? ""
    if (mime === "text/plain" && part.body?.data && !bodyText) {
      bodyText = b64urlToText(part.body.data)
    }
    if (part.filename) attachmentNames.push(part.filename)
    if (mime.startsWith("image/")) {
      imageParts.push({ attachmentId: part.body?.attachmentId, data: part.body?.data, mimeType: mime })
    }
    for (const p of part.parts ?? []) walk(p)
  }
  walk(msg.payload)

  // text/plain が無い場合の保険 (稀)。
  if (!bodyText && msg.payload?.body?.data) bodyText = b64urlToText(msg.payload.body.data)

  return { bodyText, attachmentNames, imageParts, internalDate: msg.internalDate ?? null }
}

async function uploadFirstImage(supabase: any, accessToken: string, msgId: string, imageParts: ImagePart[], log: any): Promise<string | null> {
  const part = imageParts[0]
  let bytes: Uint8Array | null = null
  if (part.data) {
    bytes = b64urlToBytes(part.data)
  } else if (part.attachmentId) {
    const u = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${part.attachmentId}`
    const res = await fetch(u, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`gmail attachment ${res.status}`)
    const json = await res.json()
    if (json.data) bytes = b64urlToBytes(json.data)
  }
  if (!bytes) return null
  const ext = part.mimeType.split("/")[1]?.split("+")[0] || "jpg"
  const path = `inf/${msgId}_0.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: part.mimeType, upsert: true })
  if (error && !String(error.message ?? "").toLowerCase().includes("exists")) throw error
  log.images_uploaded++
  // sgp 系踏襲: 相対パスを image_url に保存 (frontend 側で URL 構築)。
  return path
}
