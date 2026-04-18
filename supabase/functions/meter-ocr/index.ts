import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const tStart = Date.now();

  try {
    const { image_base64, hint_machine_type } = await req.json();

    if (!image_base64) {
      return json({ error: 'image_base64 is required' }, 400);
    }

    const apiKey = Deno.env.get('dfx_api_key');
    if (!apiKey) return json({ error: 'API key not configured' }, 500);

    const prompt = buildPrompt(hint_machine_type);

    const tApi = Date.now();
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Haiku 4.5で高速化
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image_base64 }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });
    const apiMs = Date.now() - tApi;

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error', anthropicRes.status, errText);
      return json({ error: `Anthropic ${anthropicRes.status}`, detail: errText }, 502);
    }

    const data = await anthropicRes.json();
    const textContent = data.content?.[0]?.text || '';

    const cleaned = textContent
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const s = cleaned.indexOf('{');
      const e = cleaned.lastIndexOf('}');
      if (s !== -1 && e !== -1) {
        try { parsed = JSON.parse(cleaned.slice(s, e + 1)); } catch {}
      }
    }

    if (!parsed) {
      return json({ error: 'JSON解析失敗', raw: textContent }, 502);
    }

    // 計測情報を付けて返す（管理画面で傾向が見れる）
    parsed._timing = { total_ms: Date.now() - tStart, api_ms: apiMs };

    console.log(`meter-ocr OK total=${Date.now() - tStart}ms api=${apiMs}ms`);

    return json(parsed, 200);
  } catch (err) {
    console.error('meter-ocr exception', err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' }
  });
}

function buildPrompt(hintType: string | null): string {
  return `クレーンゲーム機の画像からJSONのみを返してください。前後のテキストやコードフェンス禁止。

フィールド:
- machine_code: ラベル/QRから読み取る。形式は英大文字3桁+数字2桁+"-M"+数字2桁（例 KKY01-M03, KOS01-M04, MNK01-M05）。読めなければnull
- machine_type_guess: BUZZ_CRANE_4 / BUZZ_CRANE_SLIM / BUZZ_CRANE_MINI / SESAME_W / TRI_DECK / BARBER_R1014 / HIGH_GACHA / 500_GACHA / null${hintType ? `（参考: ${hintType}）` : ''}
- meters: 2ブース機なら {"left_in","left_out","right_in","right_out"}、1ブース機なら {"in_meter","out_meter"}。ドラム繰り上がり途中は下側の数字を採用。読めない項目はnull
- confidence: 0.0〜1.0

返す形: {"machine_code":...,"machine_type_guess":...,"meters":{...},"confidence":...}`;
}
