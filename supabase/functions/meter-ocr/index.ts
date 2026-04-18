import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'content-type': 'application/json' }
    });
  }

  try {
    const { image_base64, hint_machine_type } = await req.json();

    if (!image_base64 || typeof image_base64 !== 'string') {
      return new Response(JSON.stringify({ error: 'image_base64 is required' }), {
        status: 400, headers: { ...CORS, 'content-type': 'application/json' }
      });
    }

    console.log('meter-ocr 受信 base64 length:', image_base64.length);

    const apiKey = Deno.env.get('dfx_api_key');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500, headers: { ...CORS, 'content-type': 'application/json' }
      });
    }

    const prompt = buildPrompt(hint_machine_type);

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image_base64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API エラー:', anthropicRes.status, errText);
      return new Response(JSON.stringify({
        error: `Anthropic API ${anthropicRes.status}`,
        detail: errText
      }), {
        status: 502, headers: { ...CORS, 'content-type': 'application/json' }
      });
    }

    const data = await anthropicRes.json();
    const textContent = data.content?.[0]?.text || '';
    console.log('Claude応答:', textContent);

    // フェンス除去 + 堅牢なJSON抽出
    const cleaned = textContent
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // フォールバック: 最初の { から対応する } までを抽出
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        try {
          parsed = JSON.parse(cleaned.slice(start, end + 1));
        } catch (e) {
          console.error('JSON解析失敗:', e, 'raw:', cleaned);
        }
      }
    }

    if (!parsed) {
      return new Response(JSON.stringify({
        error: 'JSON解析失敗',
        raw: textContent
      }), {
        status: 502, headers: { ...CORS, 'content-type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS, 'content-type': 'application/json' }
    });
  } catch (err) {
    console.error('meter-ocr 例外:', err);
    return new Response(JSON.stringify({
      error: String(err),
      stack: err.stack
    }), {
      status: 500, headers: { ...CORS, 'content-type': 'application/json' }
    });
  }
});

function buildPrompt(hintType: string | null): string {
  return `このクレーンゲーム機の画像から以下を読み取ってJSONのみで返してください。前後にテキストやコードフェンスを含めないこと。

1. machine_code: ラベルまたはQRコードから読み取る（形式: 英大文字3桁+数字2桁+'-M'+数字2桁、例 KIK01-M05 / KKY01-M03 / KOS01-M04 / MNK01-M05）。読めなければnull
2. machine_type_guess: BUZZ_CRANE_4 / BUZZ_CRANE_SLIM / BUZZ_CRANE_MINI / SESAME_W / TRI_DECK / BARBER_R1014 / HIGH_GACHA / 500_GACHA のいずれか、不明ならnull
   ${hintType ? `（参考: ${hintType} の可能性が高い）` : ''}
3. meters:
   - 2ブース機: { "left_in": n, "left_out": n, "right_in": n, "right_out": n }
   - 1ブース機: { "in_meter": n, "out_meter": n }
   - ドラムカウンターで数字が繰り上がり途中の場合は**下側の数字**を採用
   - 読めない項目はnull
4. confidence: 0.0〜1.0

{"machine_code":..., "machine_type_guess":..., "meters":{...}, "confidence":...}`;
}
