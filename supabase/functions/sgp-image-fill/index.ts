import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SGP_IMG_BASE = "https://kings-man.info/stock/item_image/";
const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

Deno.serve(async (req: Request) => {
  const start = Date.now();
  const url = new URL(req.url);
  const imgLimit = Math.min(parseInt(url.searchParams.get("img_limit") || "200"), 500);

  const serviceKey = Deno.env.get("CLAWOPS_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const log = {
    records_fetched: 0, records_inserted: 0, records_updated: 0, records_skipped: 0,
    img_searched: 0, img_hit: 0, img_miss: 0, images_linked: 0, images_uploaded: 0,
    errors: [] as string[], duration_ms: 0,
  };

  try {
    // 1. Orphan prize_masters: SGP, image_url null or empty, LIMIT img_limit
    const { data: orphans, error: orphanErr } = await supabase
      .from("prize_masters")
      .select("prize_id")
      .eq("supplier_id", "SGP")
      .or("image_url.is.null,image_url.eq.")
      .limit(imgLimit);

    if (orphanErr) throw new Error(`orphan fetch: ${orphanErr.message}`);
    if (!orphans || orphans.length === 0) {
      log.duration_ms = Date.now() - start;
      await supabase.from("sgp_import_logs").insert(logRow(log));
      return new Response(JSON.stringify({ message: "no orphans", log }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const orphanIds = orphans.map((o: { prize_id: string }) => o.prize_id);

    // 2. Resolve item_codes via prize_orders.import_meta->>'item_code'
    const { data: orderRows, error: orderErr } = await supabase
      .from("prize_orders")
      .select("prize_id, import_meta")
      .in("prize_id", orphanIds)
      .not("import_meta", "is", null);

    if (orderErr) throw new Error(`order fetch: ${orderErr.message}`);

    // item_code -> Set<prize_id> for direct orphan ids
    const itemCodeMap = new Map<string, Set<string>>();
    for (const row of (orderRows || [])) {
      const code = (row.import_meta as Record<string, string> | null)?.item_code;
      if (!code) continue;
      if (!itemCodeMap.has(code)) itemCodeMap.set(code, new Set());
      itemCodeMap.get(code)!.add(row.prize_id);
    }

    // 3. Process each distinct item_code — 8s AbortController on EVERY external call
    for (const [itemCode, directPids] of itemCodeMap) {
      log.img_searched++;
      const storagePath = `sgp/${itemCode}.jpg`;

      // Storage-exist shortcut: already uploaded → just link
      try {
        const { data: ls } = await supabase.storage
          .from("announcements")
          .list("sgp", { search: `${itemCode}.jpg` });
        if (ls && ls.length > 0) {
          for (const pid of directPids) {
            const { error } = await supabase
              .from("prize_masters")
              .update({ image_url: storagePath, updated_at: new Date().toISOString() })
              .eq("prize_id", pid)
              .or("image_url.is.null,image_url.eq.");
            if (!error) log.images_linked++;
          }
          log.img_hit++;
          continue;
        }
      } catch { /* storage list error; fall through to fetch */ }

      // Fetch image from SGP with 8s timeout
      let imgBlob: Blob | null = null;
      try {
        const res = await fetchWithTimeout(`${SGP_IMG_BASE}${itemCode}.jpg`);
        if (res.ok) {
          imgBlob = await res.blob();
        } else {
          log.img_miss++;
          continue;
        }
      } catch {
        // AbortError (timeout) or network error → count miss and continue
        log.img_miss++;
        continue;
      }

      // Upload to storage
      const { error: upErr } = await supabase.storage
        .from("announcements")
        .upload(storagePath, imgBlob, { contentType: "image/jpeg", upsert: false });

      if (upErr) {
        if (!upErr.message.includes("already exist") && !upErr.message.includes("Duplicate")) {
          log.errors.push(`upload ${itemCode}: ${upErr.message}`);
        }
        log.img_miss++;
        continue;
      }
      log.images_uploaded++;

      // Link to ALL prize_masters sharing this item_code (broader than direct orphans)
      const { data: linked } = await supabase
        .from("prize_orders")
        .select("prize_id")
        .eq("import_meta->>item_code", itemCode)
        .not("prize_id", "is", null);

      if (linked && linked.length > 0) {
        const allPids = [...new Set(linked.map((r: { prize_id: string }) => r.prize_id))];
        for (const pid of allPids) {
          const { error } = await supabase
            .from("prize_masters")
            .update({ image_url: storagePath, updated_at: new Date().toISOString() })
            .eq("prize_id", pid)
            .or("image_url.is.null,image_url.eq.");
          if (!error) log.images_linked++;
        }
      }
      log.img_hit++;
    }

    log.duration_ms = Date.now() - start;
    await supabase.from("sgp_import_logs").insert(logRow(log));
    return new Response(JSON.stringify(log), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.errors.push(msg);
    log.duration_ms = Date.now() - start;
    await supabase.from("sgp_import_logs").insert(logRow(log));
    return new Response(JSON.stringify({ error: msg, log }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function logRow(log: { [k: string]: unknown }) {
  return {
    records_fetched: 0,
    records_inserted: 0,
    records_updated: 0,
    records_skipped: 0,
    img_searched: log.img_searched ?? 0,
    img_hit: log.img_hit ?? 0,
    img_miss: log.img_miss ?? 0,
    images_linked: log.images_linked ?? 0,
    images_uploaded: log.images_uploaded ?? 0,
    errors: (log.errors as string[]).length > 0 ? log.errors : [],
    duration_ms: log.duration_ms ?? 0,
  };
}
