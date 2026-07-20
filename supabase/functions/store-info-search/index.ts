// SPEC-STORE-INFO-WEBSEARCH-01 (D-105): 店舗情報 Web検索 Edge。
// model-spec-search の完全横展開。店名(+任意の住所ヒント)から web_search で公式情報を探し構造化JSONを返す。
// dfx_api_key 再利用 (新規Secret不要)。verify_jwt は model-spec-search と同設定 (dashboard) に合わせる。
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { storeName, address } = await req.json();

    if (!storeName) {
      return new Response(
        JSON.stringify({ error: '店舗名が必要です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicKey = Deno.env.get('dfx_api_key');
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'APIキーが設定されていません（dfx_api_key）' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const addressHint = address ? `\n住所ヒント（任意・精度向上用）: 「${address}」` : '';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `日本の店舗「${storeName}」の公式情報を web_search で調べてください。${addressHint}\n` +
            `以下の情報をJSONのみで返してください（説明文・コードブロック不要）:\n` +
            `{\n` +
            `  "store_name_official": "正式名称またはnull",\n` +
            `  "brand_name": "ブランド名またはnull",\n` +
            `  "address": "住所（都道府県から）またはnull",\n` +
            `  "phone": "電話番号またはnull",\n` +
            `  "region": "地方（例: 九州）またはnull",\n` +
            `  "locality": "市区町村またはnull",\n` +
            `  "locality_kana": "市区町村のカタカナまたはnull",\n` +
            `  "lat": 緯度の数値またはnull,\n` +
            `  "lng": 経度の数値またはnull\n` +
            `}\n` +
            `重要: lat/lng は数値のみ。日本国内なので lat はおおよそ 24〜46、lng はおおよそ 123〜146 の範囲。` +
            `この範囲外になる場合や確証がない場合は lat/lng を null にしてください。不明な項目は全て null。`,
        }],
      }),
    });

    const data = await response.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text') as { text: string } | undefined;
    let store = null;

    if (textBlock?.text) {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          store = JSON.parse(jsonMatch[0]);
          // 日本国内座標の妥当性チェック (範囲外は null 化。巡回ナビ誤植防止)
          if (store && typeof store === 'object') {
            const lat = Number(store.lat);
            const lng = Number(store.lng);
            store.lat = (store.lat != null && Number.isFinite(lat) && lat >= 24 && lat <= 46) ? lat : null;
            store.lng = (store.lng != null && Number.isFinite(lng) && lng >= 123 && lng <= 146) ? lng : null;
          }
        } catch {
          store = null;
        }
      }
    }

    return new Response(
      JSON.stringify({ store }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
