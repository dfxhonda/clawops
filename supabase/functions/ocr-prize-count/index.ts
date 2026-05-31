// J-STOCK-OCR-COUNT-TEST-01-fix-03 (ヒロ Discord 5/31 ① 採用):
// 棚卸 景品個数カウント専用 Edge Function。ocr-meter は メーター数字読み取り用 prompt で
// 物体カウントできなかったため、Claude vision に「景品の個数を数えて JSON 返却」専用 prompt を投入。
// 戻り値: { value: 整数 | null, confidence: 0.0-1.0, items_breakdown: [{kind, count}], notes, raw_text }
// フロント側 (OcrCountCapture.jsx) は ocr-meter compatible に meters[] 形式 + 集計 value で扱える。
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT = `これは棚卸し用に撮影された景品 (クレーンゲーム/ガチャの当選景品ボックス、ぬいぐるみ、フィギュア、雑貨等) の写真です。
画像内の景品個数を正確に数えてください。JSON のみ返却 (他のテキスト不要):
{"value": 整数 or null, "confidence": 0.0-1.0, "items_breakdown": [{"kind": "見えるカテゴリ名", "count": 整数}], "notes": "短い補足、見えない/重なり等"}

数えるルール:
- 同じ景品が複数あれば全て個別に数える (重なり/積み上げ時は見えてる輪郭から推定)
- 一部しか見えない物体は数えない (推測しない)
- 包装紙/ビニール/値札等の付属品は数えない
- 異なる種類が混在する場合 items_breakdown に種類別で内訳、value は合計
- 個数が画像から確定できない (全体が映ってない/積みが高すぎる) 場合 value=null, confidence=0、notes に理由
- confidence: 全部見えて確定=0.95、一部推定=0.6、推測込み=0.3

例:
- 同種ガチャカプセル12個整列 → {"value":12,"confidence":0.95,"items_breakdown":[{"kind":"ガチャカプセル","count":12}],"notes":"全て可視"}
- ぬいぐるみ3+フィギュア5 → {"value":8,"confidence":0.9,"items_breakdown":[{"kind":"ぬいぐるみ","count":3},{"kind":"フィギュア","count":5}],"notes":""}
- 山積みで一部不可視 → {"value":null,"confidence":0,"items_breakdown":[],"notes":"山積みで底が見えない"}`;

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
            { type: 'image', source: { type: 'base64', media_type, data: image_base64 } },
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

    // J-STOCK-OCR-COUNT-TEST-01-fix-06: 旧 cleaned = trim + ``` 除去 だけだと Claude が
    //   "Here is my analysis...\n{...}\n..." 等 説明文を前後に付けた時に JSON parse 失敗 (422 多発)。
    // 改善: 文字列内の最初の { から バランスする } までを抽出 (string/escape 考慮)、その範囲を JSON.parse。
    function extractJsonObject(text: string): string | null {
      const noFences = text.replace(/```(?:json)?/gi, '');
      const firstBrace = noFences.indexOf('{');
      if (firstBrace < 0) return null;
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = firstBrace; i < noFences.length; i++) {
        const ch = noFences[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) return noFences.slice(firstBrace, i + 1);
        }
      }
      return null;
    }
    const cleaned = extractJsonObject(rawText) ?? rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    type ParsedShape = {
      value?: number | null;
      confidence?: number;
      items_breakdown?: Array<{ kind?: string; count?: number }>;
      notes?: string;
    };

    let parsed: ParsedShape = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // J-STOCK-OCR-COUNT-TEST-01-fix-06: 旧 422 だと Supabase JS client が 'non-2xx' エラーで投げ、
      // フロントが '画像大きすぎ' 誤メッセージ表示 (本当は Claude 出力が JSON 以外混入)。
      // 200 + value=null/confidence=0 + parse_failed フラグで返し、フロントは '?' 表示 + 手入力 を可能に。
      console.error('JSON parse failed:', rawText);
      return new Response(
        JSON.stringify({
          value: null,
          confidence: 0,
          items_breakdown: [],
          notes: 'OCR の応答が解析できませんでした。手入力してください',
          parse_failed: true,
          raw_text: rawText,
          meters: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const value = typeof parsed.value === 'number' ? parsed.value : null;
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
    const items_breakdown = Array.isArray(parsed.items_breakdown) ? parsed.items_breakdown : [];
    const notes = typeof parsed.notes === 'string' ? parsed.notes : '';

    // 後方互換: フロント (OcrCountCapture) は ocr-meter と同じ meters[].value/confidence 形式で扱える
    const meters = value != null
      ? [{ label: 'prize_count', value, type: 'prize_count', confidence }]
      : [];

    return new Response(
      JSON.stringify({
        value, confidence, items_breakdown, notes, meters,
        raw_text: rawText,
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
