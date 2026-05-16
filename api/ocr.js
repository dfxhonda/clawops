export const config = { runtime: 'edge' }

const PROMPT = `画像から6-7桁の数字メーターを全て抽出。JSONのみ返却 (他のテキスト不要):
{"meters":[{"label":"画像内ラベル原文","value":整数,"type":"in/out/out_a/out_b/out_c/yen1000_in/yen500_in/yen100_in/change_in/change_out/capsule_out/prize_out/unknown","confidence":0.0-1.0}]}

ルール:
- 機種(クレーン/ガチャ/両替)問わず数字メーター全部を対象にする
- label: 画像内の文字をそのまま記載 (例: ¥1000 IN, 左側IN, CAPSULE OUT, in)
- type: ラベルから推定。IN系=in/yen1000_in/yen500_in/yen100_in/change_in、OUT系=out/out_a/out_b/out_c/capsule_out/prize_out/change_out、不明=unknown
  - out: 単純OUT (1段機。label が「OUT」のみで A段/B段区別なし)
  - out_a/out_b/out_c: 段別OUT (2-3段機で A段/B段/C段が明示されている場合のみ)
- value は整数のみ (ラベル・単位・ステッカーの文字を数値として読まない)
- confidence: 0.0-1.0、鮮明で確実=0.95、読み取りギリギリ=0.4
- 見つからない場合 meters:[]`

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { image_base64, media_type = 'image/jpeg' } = body
  if (!image_base64) {
    return new Response(JSON.stringify({ error: 'image_base64 required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const image_size_bytes = Math.round(image_base64.length / 4 * 3)

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 768,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type, data: image_base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    return new Response(JSON.stringify({
      error: `Anthropic error: ${resp.status}`,
      anthropic_status: resp.status,
      anthropic_detail: text.slice(0, 500),
      raw_text: text.slice(0, 500),
      image_size_bytes,
      value: null,
    }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }

  const data = await resp.json()
  const raw = data.content?.[0]?.text ?? ''
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')

  try {
    const parsed = JSON.parse(cleaned)
    return new Response(JSON.stringify({ ...parsed, raw_text: raw, anthropic_status: 200, image_size_bytes }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ meters: [], value: null, raw_text: raw, anthropic_status: 200, image_size_bytes }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
