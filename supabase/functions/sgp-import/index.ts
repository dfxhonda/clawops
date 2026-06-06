import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SGP_API = "https://kings-man.info/stock/php/ajax.php";
const SGP_IMG_BASE = "https://kings-man.info/stock/item_image/";
const SGP_ID = "442";
const SGP_NAME = "【フォロー】achieve（アミューズ）";
const SGP_PASS = "yJKSciScG34sYW";

const SHOP_DEST: Record<number, string> = {
  1557: "久留米", 1572: "飯塚", 1550: "飯塚",
  2170: "田崎", 1466: "田崎", 1923: "田崎",
  1927: "鹿児島", 2184: "鹿児島",
};

const ABBREVS: [string, string][] = [
  ["ぬいぐるみ","NG"],["マスコット","MC"],["ボールチェーン","BC"],
  ["キーホルダー","KH"],["キーケース","KC"],["スクイーズ","SQ"],
  ["ワイヤレスイヤホン","TWS"],["ブレスレット","BLT"],
  ["ミニゲーム機","MNGM"],["スマートウォッチ","SW"],
  ["モバイルバッテリー","MBT"],["コントローラー","CTRL"],
  ["クッション","CSHN"],["ブランケット","BLKT"],["スピーカー","SPK"],
  ["フラッシュボタン","FLBT"],["ダストBOX","DTBX"],
  ["ジャグラー","ジャグ"],["ディズニー","DN"],["アソート","AS"],
];

function shortenPrizeName(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  let t = s.replace(/【[^】]*】/g, "").trim();
  if (t) s = t;
  t = s.replace(/\[[^\]]*\]/g, "").trim();
  if (t) s = t;
  s = s.replace(/\((?:ハーフ|クォーター)[^)]*円\)/g, "");
  s = s.replace(/\(送料[^)]*\)/g, "");
  s = s.replace(/●[\d\/]+〆切?\s*/g, "");
  s = s.replace(/●\s*\d+\s*/g, "");
  s = s.replace(/\/?[\d\/]+〆切/g, "");
  s = s.replace(/[\d\/]+〆\s*/g, "");
  s = s.replace(/〆切/g, "");
  s = s.replace(/商品名[:：]\s*/g, "");
  s = s.trim();
  s = s.replace(/^\d{3,4}\s+/, "");
  s = s.replace(/アミューズ不可|アミューズメント専用|即納|緊急入荷|発注|価格改定/g, "");
  s = s.replace(/バンダイ|ピーナッツクラブ|ケーツー/g, "");
  s = s.replace(/再販|再入荷/g, "");
  s = s.replace(/おそらく[^\s]*/g, "");
  s = s.replace(/\d+月発売/g, "");
  s = s.replace(/\d+月下旬/g, "");
  s = s.replace(/商品サイズ.*$/g, "");
  s = s.replace(/カラーBOX入り|ウィンドウBOX入|BOX入|箱入/g, "");
  s = s.replace(/約?\d+(\.\d+)?[cｃ][mｍ]/g, "");
  s = s.replace(/\d+×\d+(×\d+)?[mｍ㎝㎞]/g, "");
  s = s.replace(/袋\d+×\d+/g, "");
  s = s.replace(/\d+入\s?[@＠]\d+/g, "");
  s = s.replace(/\d+個入り\d*[cｃ]?[mｍ]?/g, "");
  s = s.replace(/\d+入\(.*$/g, "");
  s = s.replace(/\d+入$/g, "");
  s = s.replace(/(\d+種)\d+[cｃ][mｍ]?/g, "$1");
  s = s.replace(/\d+種(?!\s*AS)/g, "");
  s = s.replace(/\*.*$/g, "");
  s = s.replace(/～/g, "");
  s = s.replace(/品番\S*/g, "");
  s = s.replace(/CuriousGeorgeTOYSTYLE/g, "ジョージ");
  s = s.replace(/^\/+/, "");
  for (const [from, to] of ABBREVS) s = s.replaceAll(from, to);
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 25) s = s.substring(0, 25);
  return s;
}

async function ensurePrizeMaster(
  supabase: SupabaseClient,
  shortName: string,
  rawName: string,
  unitCost: number | null,
  supplierName: string | null,
  orderDate: string | null,
  masterCache: Map<string, string>
): Promise<{ prize_id: string | null; backfilled: number }> {
  if (!shortName) return { prize_id: null, backfilled: 0 };

  const cached = masterCache.get(shortName);
  if (cached) return { prize_id: cached, backfilled: 0 };

  const { data: existing } = await supabase
    .from("prize_masters")
    .select("prize_id, prize_name")
    .eq("short_name", shortName)
    .limit(1);

  if (existing && existing.length > 0) {
    let backfilled = 0;
    if (existing[0].prize_name === shortName && rawName !== shortName) {
      await supabase
        .from("prize_masters")
        .update({ prize_name: rawName, updated_at: new Date().toISOString() })
        .eq("prize_id", existing[0].prize_id);
      backfilled = 1;
    }
    masterCache.set(shortName, existing[0].prize_id);
    return { prize_id: existing[0].prize_id, backfilled };
  }

  const { data: maxRow } = await supabase
    .from("prize_masters")
    .select("prize_id")
    .order("prize_id", { ascending: false })
    .limit(1);

  const maxNum = maxRow && maxRow.length > 0
    ? parseInt(maxRow[0].prize_id.replace("PZ-", "")) + 1
    : 1;
  const newId = `PZ-${String(maxNum).padStart(5, "0")}`;

  const { error } = await supabase.from("prize_masters").insert({
    prize_id: newId,
    prize_name: rawName,
    short_name: shortName,
    original_cost: unitCost,
    supplier_id: "SGP",
    supplier_name: supplierName || "景品フォーム",
    category: "クレーン景品",
    status: "active",
    latest_order_date: orderDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    const { data: retry } = await supabase
      .from("prize_masters")
      .select("prize_id, prize_name")
      .eq("short_name", shortName)
      .limit(1);
    if (retry && retry.length > 0) {
      let backfilled = 0;
      if (retry[0].prize_name === shortName && rawName !== shortName) {
        await supabase
          .from("prize_masters")
          .update({ prize_name: rawName, updated_at: new Date().toISOString() })
          .eq("prize_id", retry[0].prize_id);
        backfilled = 1;
      }
      masterCache.set(shortName, retry[0].prize_id);
      return { prize_id: retry[0].prize_id, backfilled };
    }
    return { prize_id: null, backfilled: 0 };
  }

  masterCache.set(shortName, newId);
  return { prize_id: newId, backfilled: 0 };
}

// SGPの発送ステータスをClawOps内部ステータスにマッピング
// 発送完了/出荷完了 → shipped（発送済み）とする。
// arrived（入荷済み）は現地での荷受確認後に手動登録する。
function mapStatus(s: string): string {
  if (!s) return "ordered";
  if (s.includes("キャンセル")) return "cancelled";
  if (s.includes("発送完了") || s.includes("出荷完了")) return "shipped";
  return "ordered";
}

function getImgFile(n: string): string | null {
  if (!n?.trim()) return null;
  const p = n.split(",").filter(Boolean);
  return p[0] || p[1] || null;
}

function resolveDestination(orderShop: number, shopConv: Record<string, string>): string | null {
  if (SHOP_DEST[orderShop]) return SHOP_DEST[orderShop];
  const name = shopConv[String(orderShop)];
  return name || null;
}

Deno.serve(async (req: Request) => {
  const start = Date.now();
  const url = new URL(req.url);
  const withImages = url.searchParams.get("images") === "1";
  const page = parseInt(url.searchParams.get("page") || "0");
  const pageSize = 500;
  const pos = page * pageSize;

  const serviceKey = Deno.env.get('CLAWOPS_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey
  );

  const log = { records_fetched: 0, records_inserted: 0, records_updated: 0, records_skipped: 0, masters_created: 0, images_uploaded: 0, backfilled: 0, errors: [] as string[], duration_ms: 0, page };

  try {
    const body = new URLSearchParams({
      id: SGP_ID, name: SGP_NAME, password: SGP_PASS, role_id: "3",
      pos: String(pos), order: "1",
      ROWS_PER_PAGE: String(pageSize), ROWS_PER_PAGE_RECORD: String(pageSize),
      command: "My_Order_Group.Serch",
      group_type: "all", delivery_month: "",
      ship_comp_my_record_view: "1",
    });

    const sgpRes = await fetch(SGP_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!sgpRes.ok) throw new Error(`SGP API: ${sgpRes.status}`);
    const sgpData = await sgpRes.json();
    const records = sgpData.record || [];
    const shopConv: Record<string, string> = sgpData.shop_conv || {};
    log.records_fetched = records.length;

    if (records.length === 0) {
      log.duration_ms = Date.now() - start;
      await supabase.from("sgp_import_logs").insert({ ...logRow(log) });
      return new Response(JSON.stringify(log), { headers: { "Content-Type": "application/json" } });
    }

    const { data: existing } = await supabase
      .from("prize_orders")
      .select("raw_import_id, status, notes")
      .eq("order_source", "sgp_api");

    const exMap = new Map<string, { status: string; notes: string }>();
    if (existing) for (const r of existing) exMap.set(r.raw_import_id, { status: r.status, notes: r.notes });

    const masterCache = new Map<string, string>();
    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; data: Record<string, unknown> }[] = [];
    const imgs: { file: string; code: string }[] = [];

    for (const r of records) {
      const rawId = `sgp_${r.order_id}`;
      const newStatus = mapStatus(r.ship_status);
      const notes = (r.ship_status || "").replace(/\n/g, " ").substring(0, 100);
      const ex = exMap.get(rawId);
      const destination = resolveDestination(r.order_shop, shopConv);
      const prizeName = r.name?.substring(0, 200) || "";
      const shortName = shortenPrizeName(prizeName);

      // SGP APIフィールドマッピング (実機データ検証済み):
      // r.unit_cost  = 個当たり単価（税別） 例: 198
      // r.order_price = ケース合計金額（税別） 例: 57024 (= unit_cost * 入り数)
      // r.number     = SGP内部管理数（受注数ではない）
      // 入り数 = order_price / unit_cost で算出
      const unitCost = r.unit_cost || null;
      const caseCost = Math.abs(r.order_price) || null;
      const caseQty = (unitCost && caseCost && unitCost > 0)
        ? Math.round(caseCost / unitCost)
        : null;

      if (!ex) {
        const od = r.order_date?.substring(0, 10) || null;
        const ed = r.delivery_comp_month && !r.delivery_comp_month.startsWith("0000")
          ? r.delivery_comp_month.substring(0, 10) : null;

        const { prize_id: prizeId, backfilled: bf } = await ensurePrizeMaster(
          supabase, shortName, prizeName,
          unitCost, r.supplier || null, od, masterCache
        );
        log.backfilled += bf;
        if (prizeId && !masterCache.has(shortName + "_counted")) {
          masterCache.set(shortName + "_counted", "1");
        }

        // prize_mastersのdefault_case_quantityも更新（未設定の場合）
        if (prizeId && caseQty && caseQty > 1) {
          await supabase
            .from("prize_masters")
            .update({ default_case_quantity: caseQty })
            .eq("prize_id", prizeId)
            .is("default_case_quantity", null);
        }

        toInsert.push({
          prize_name_raw: prizeName,
          prize_name_short: shortName,
          prize_id: prizeId,
          supplier_id: "SGP", order_source: "sgp_api",
          order_date: od, expected_date: ed,
          case_count: Math.abs(r.number) || null,
          case_quantity: caseQty,
          unit_cost: unitCost,
          case_cost: caseCost,
          shipping_cost: r.price_ship || null,
          status: newStatus, notes,
          destination,
          source_file: "sgp_api_import",
          raw_import_id: rawId,
          import_meta: { sgp_order_id: r.order_id, item_code: r.item_code, supplier_name: r.supplier, cart_id: r.cart_id, order_shop: r.order_shop },
        });
      } else {
        // ordered < shipped < arrived < cancelled の順序で進行のみ容許。
        // arrived（手動確認済み）はダウングレードしない。
        const lvl: Record<string, number> = { ordered: 0, shipped: 1, arrived: 2, cancelled: 3 };
        if ((lvl[newStatus] ?? 0) > (lvl[ex.status] ?? 0) || ex.notes !== notes) {
          toUpdate.push({ id: rawId, data: {
            status: (lvl[newStatus] ?? 0) > (lvl[ex.status] ?? 0) ? newStatus : ex.status,
            notes, updated_at: new Date().toISOString(),
          }});
          log.records_updated++;
        } else {
          log.records_skipped++;
        }
      }

      if (withImages) {
        const f = getImgFile(r.img_name);
        if (f) imgs.push({ file: f, code: r.item_code });
      }
    }

    let actualInserted = 0;
    for (const row of toInsert) {
      const { error } = await supabase.from("prize_orders").insert(row);
      if (error) {
        if (!error.message.includes("duplicate")) {
          log.errors.push(`Ins ${row.raw_import_id}: ${error.message}`);
        }
      } else {
        actualInserted++;
      }
    }
    log.records_inserted = actualInserted;

    for (const u of toUpdate) {
      const { error } = await supabase.from("prize_orders").update(u.data).eq("raw_import_id", u.id);
      if (error) log.errors.push(`Upd ${u.id}: ${error.message}`);
    }

    if (withImages && imgs.length > 0) {
      const done = new Set<string>();
      for (const img of imgs) {
        if (done.size >= 20) break;
        if (done.has(img.code)) continue;
        done.add(img.code);
        try {
          const path = `sgp/${img.code}.jpg`;
          const { data: ls } = await supabase.storage.from("announcements").list("sgp", { search: `${img.code}.jpg` });
          if (ls && ls.length > 0) {
            await supabase
              .from("prize_masters")
              .update({ image_url: path })
              .is("image_url", null)
              .eq("supplier_id", "SGP")
              .filter("prize_id", "in",
                `(SELECT DISTINCT prize_id FROM prize_orders WHERE import_meta->>'item_code' = '${img.code}' AND prize_id IS NOT NULL)`
              );
            continue;
          }
          const res = await fetch(`${SGP_IMG_BASE}${img.file}`);
          if (!res.ok) continue;
          const blob = await res.blob();
          const { error } = await supabase.storage.from("announcements").upload(path, blob, { contentType: "image/jpeg", upsert: false });
          if (!error) {
            log.images_uploaded++;
            const { data: linked } = await supabase
              .from("prize_orders")
              .select("prize_id")
              .eq("import_meta->>item_code", img.code)
              .not("prize_id", "is", null);
            if (linked && linked.length > 0) {
              const prizeIds = [...new Set(linked.map((r: { prize_id: string }) => r.prize_id))];
              for (const pid of prizeIds) {
                await supabase
                  .from("prize_masters")
                  .update({ image_url: path })
                  .eq("prize_id", pid)
                  .is("image_url", null);
              }
            }
          }
        } catch { /* skip */ }
      }
    }

    log.duration_ms = Date.now() - start;
    await supabase.from("sgp_import_logs").insert({ ...logRow(log) });

    return new Response(JSON.stringify(log), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.errors.push(msg);
    log.duration_ms = Date.now() - start;
    await supabase.from("sgp_import_logs").insert({ ...logRow(log) });
    return new Response(JSON.stringify({ error: msg, log }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

function logRow(log: Record<string, unknown>) {
  return {
    records_fetched: log.records_fetched,
    records_inserted: log.records_inserted,
    records_updated: log.records_updated,
    records_skipped: log.records_skipped,
    errors: (log.errors as string[]).length > 0 ? log.errors : [],
    duration_ms: log.duration_ms,
  };
}
