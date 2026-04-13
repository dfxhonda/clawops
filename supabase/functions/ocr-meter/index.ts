import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT = `あなたはクレーンゲーム機のメーターパネルを読み取る専門家です。
この画像はクレーンゲーム機の操作パネルで、左右2ブース分のメーターが表示されています。

【読み取り対象】
- 左側IN（コイン投入数、左ブース）
- 左側OUT（排出数/払い出し数、左ブース）
- 右側IN（コイン投入数、右ブース）
- 右側OUT（排出数/払い出し数、右ブース）

【メーターの特徴】
- 通常は5〜8桁の数値カウンター（LCD/LED表示または機械式）
- 値は累積カウンターなので基本的に大きな数値（数千〜数百万）
- INの値はOUTより大きいことが多い
- 「IN」「OUT」「LEFT」「RIGHT」などのラベルが近くにある場合がある

【判断基準】
- 数字が明確に読み取れる場合: その値を返す
- 数字が不鮮明・ぼやけている場合: nullを返す（推測しない）
- 桁数が曖昧な場合: nullを返す

他のテキストは一切含めず、以下のJSONのみ返してください：
{
  "left_in": 数値またはnull,
  "left_out": 数値またはnull,
  "right_in": 数値またはnull,
  "right_out": 数値またはnull,
  "confidence": 0.0から1.0の数値（全体的な読み取り確信度）
}`;

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
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: media_type,
                data: image_base64,
              },
            },
            {
              type: 'text',
              text: PROMPT,
            },
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
    const rawText = anthropicData?.content?.[0]?.text || '';

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('JSON not found in response:', rawText);
      return new Response(
        JSON.stringify({ error: 'OCR結果の解析に失敗しました', raw: rawText }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({
        left_in: result.left_in ?? null,
        left_out: result.left_out ?? null,
        right_in: result.right_in ?? null,
        right_out: result.right_out ?? null,
        confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
      }),
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
