import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function buildPrompt(hintMachineType: string | null): string {
  const hintLine = hintMachineType
    ? `（参考: この機械は ${hintMachineType} の可能性が高い）`
    : '';

  return `あなたはクレーンゲーム機の管理ラベルとメーターパネルを読み取る専門家です。
以下の情報を画像から読み取り、JSONのみで返してください。

【1. machine_code】
機械に貼られたラベルまたはQRコードから機械コードを読み取ってください。
- 形式: 英大文字3〜5文字 + 数字2桁 + '-M' + 数字1〜2桁（例: KIK01-M05, KRM02-M03）
- ラベルの印字テキストが読めればそれを使う
- QRコードが写っている場合はQRの内容を優先
- どちらも読めない場合は null

【2. machine_type_guess】
パネルの外観・形状から機種カテゴリを推定してください。
選択肢: BUZZ_CRANE_4 / BUZZ_CRANE_SLIM / BUZZ_CRANE_MINI / SESAME_W / TRI_DECK / BARBER_R1014 / HIGH_GACHA / 500_GACHA / OTHER
${hintLine}
不明なら null

【3. meters】
メーターの数値を読み取ってください。
- 2ブース機（BUZZ_CRANE_4, BUZZ_CRANE_SLIM, SESAME_W, TRI_DECK）: 左右それぞれにIN/OUTがある
  → { "left_in": 数値, "left_out": 数値, "right_in": 数値, "right_out": 数値 }
- 1ブース機（BUZZ_CRANE_MINI, BARBER_R1014, HIGH_GACHA, 500_GACHA）: IN/OUTが1組
  → { "in_meter": 数値, "out_meter": 数値 }
- メーターは累積カウンター（通常は数千〜数百万の大きな数値）
- 読み取れない項目は null（推測しない）

【4. confidence】
全体の読み取り信頼度（0.0〜1.0）。
機械コード・メーター値が全て明確なら0.9以上、不明確なものが多ければ低い値にしてください。

以下のJSON形式のみで返してください（他のテキストは一切不要）:
{
  "machine_code": "KIK01-M05" または null,
  "machine_type_guess": "BUZZ_CRANE_4" または null,
  "meters": {
    "left_in": 数値 または null,
    "left_out": 数値 または null,
    "right_in": 数値 または null,
    "right_out": 数値 または null
  },
  "confidence": 0.0〜1.0
}
1ブース機の場合は meters を { "in_meter": ..., "out_meter": ... } 形式で返してください。`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { image_base64, hint_machine_type = null, media_type = 'image/jpeg' } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'image_base64 は必須です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('dfx_api_key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'APIキーが設定されていません' }),
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
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type, data: image_base64 },
            },
            {
              type: 'text',
              text: buildPrompt(hint_machine_type),
            },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errText);
      return new Response(
        JSON.stringify({ error: 'OCR処理に失敗しました' }),
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
    const meters = result.meters || {};

    return new Response(
      JSON.stringify({
        machine_code: result.machine_code ?? null,
        machine_type_guess: result.machine_type_guess ?? null,
        meters: {
          // 2ブース
          left_in:   meters.left_in   ?? null,
          left_out:  meters.left_out  ?? null,
          right_in:  meters.right_in  ?? null,
          right_out: meters.right_out ?? null,
          // 1ブース
          in_meter:  meters.in_meter  ?? null,
          out_meter: meters.out_meter ?? null,
        },
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
