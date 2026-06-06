import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ABBREV_TABLE = 'ぬいぐるみ→NG, マスコット→MC, ボールチェーン→BC, キーホルダー→KH, キーケース→KC, スクイーズ→SQ, ワイヤレスイヤホン→TWS, ブレスレット→BLT, ミニゲーム機→MNGM, スマートウォッチ→SW, モバイルバッテリー→MBT, コントローラー→CTRL, クッション→CSHN, ブランケット→BLKT, スピーカー→SPK, フラッシュボタン→FLBT, ダストBOX→DTBX, ジャグラー→ジャグ, ディズニー→DN, アソート→AS';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { prize_name } = await req.json();
    if (!prize_name) {
      return new Response(JSON.stringify({ error: 'prize_name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('dfx_api_key');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'サーバー設定エラー' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `景品名を25文字以内の短縮名に変換してください。
略称テーブル: ${ABBREV_TABLE}
ルール: 商品カテゴリ・ブランド名は残す。サイズ情報(約Xcm等)は省略。
短縮名のみ返す(他のテキスト不要、必ず25文字以内)。

景品名: ${prize_name}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 64,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Anthropic API error:', res.status, errText);
      return new Response(JSON.stringify({ error: 'haiku呼び出し失敗' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const rawText = (data?.content?.[0]?.text ?? '').trim();
    const shortName = rawText.slice(0, 25);

    return new Response(JSON.stringify({ short_name: shortName }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: '予期しないエラー', detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
