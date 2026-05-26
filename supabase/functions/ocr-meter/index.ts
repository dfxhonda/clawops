import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT = `画像から6-7桁の数字メーターを全て抽出。JSONのみ返却 (他のテキスト不要):
{"meters":[{"label":"画像内ラベル原文","value":整数,"type":"in/out/out_a/out_b/out_c/yen1000_in/yen500_in/yen100_in/change_in/change_out/capsule_out/prize_out/unknown","confidence":0.0-1.0}],"confidence":0.0-1.0}

ルール:
- 機種(クレーン/ガチャ/両替)問わず数字メーター全部を対象にする
- label: 画像内の文字をそのまま記載 (例: 左IN, 右OUT, ¥1000 IN, CAPSULE OUT)
- type: ラベルから推定。IN系=in/yen1000_in/yen500_in/yen100_in/change_in、OUT系=out/out_a/out_b/out_c/capsule_out/prize_out/change_out、不明=unknown
  - out: 単純OUT (1段機。label が「OUT」のみで A段/B段区別なし)
  - out_a/out_b/out_c: 段別OUT (2-3段機で A段/B段/C段が明示されている場合のみ)
- value は整数のみ (ラベル・単位・ステッカーの文字を数値として読まない)
- confidence: 0.0-1.0、鮮明で確実=0.95、読み取りギリギリ=0.4
- 見つからない場合 meters:[]`;

const IN_TYPES = new Set(['in','yen1000_in','yen500_in','yen100_in','change_in']);
const isIn = (m: { type: string }) => IN_TYPES.has(m.type);
const isOut = (m: { type: string }) => /out/i.test(m.type);
const isLeft = (m: { label?: string }) => /左|left|\bL\b/i.test(m.label ?? '');
const isRight = (m: { label?: string }) => /右|right|\bR\b/i.test(m.label ?? '');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { image_base64, media_type = 'image/jpeg' } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'image_base64 は必須です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('dfx_api_key');
    if (!apiKey) {
      console.error('dfx_api_key が設定されていません');
      return new Response(
        JSON.stringify({ error: 'サーバー設定エラー' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 768,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type, data: image_base64 },
            },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errText);
      return new Response(
        JSON.stringify({ error: 'OCR処理に失敗しました', detail: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData?.content?.[0]?.text ?? '';
    const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    let parsed: { meters?: Array<{ label?: string; value: number; type: string; confidence?: number }>; confidence?: number } = { meters: [] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('JSON parse failed:', rawText);
      return new Response(
        JSON.stringify({ error: 'OCR結果の解析に失敗しました', raw_text: rawText, meters: [], left_in: null, left_out: null, right_in: null, right_out: null }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const meters = parsed.meters ?? [];
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;

    // Derive left/right for backward compat with OcrCaptureScreen
    const leftMs = meters.filter(isLeft);
    const rightMs = meters.filter(isRight);
    const unclIn = meters.filter(m => isIn(m) && !isLeft(m) && !isRight(m));
    const unclOut = meters.filter(m => isOut(m) && !isLeft(m) && !isRight(m));

    const left_in = leftMs.find(isIn)?.value ?? unclIn[0]?.value ?? null;
    const left_out = leftMs.find(isOut)?.value ?? unclOut[0]?.value ?? null;
    const right_in = rightMs.find(isIn)?.value ?? unclIn[1]?.value ?? null;
    const right_out = rightMs.find(isOut)?.value ?? unclOut[1]?.value ?? null;

    return new Response(
      JSON.stringify({ meters, confidence, raw_text: rawText, left_in, left_out, right_in, right_out }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: '予期しないエラーが発生しました', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
