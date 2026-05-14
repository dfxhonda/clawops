export const config = { runtime: 'edge' }

const PROMPT = `この画像のメーター数値を読み取ってください。
数値のみ返し、bounding_boxも付けてください。
JSON形式のみ: {"value": 12345, "bounding_box": {"x": 0.1, "y": 0.3, "w": 0.8, "h": 0.2}}
値が読めない場合: {"value": null, "bounding_box": null}`

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

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 64,
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
      value: null,
      bounding_box: null,
    }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }

  const data = await resp.json()
  const raw = data.content?.[0]?.text ?? ''

  try {
    const parsed = JSON.parse(raw)
    return new Response(JSON.stringify({ ...parsed, raw_text: raw }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    const match = raw.match(/\d+/)
    return new Response(JSON.stringify({ value: match ? parseInt(match[0], 10) : null, bounding_box: null, raw_text: raw }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
