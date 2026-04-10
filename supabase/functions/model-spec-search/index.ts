import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { modelName } = await req.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `アーケードゲーム機「${modelName}」の製品仕様を調べてください。\n以下の情報をJSONのみで返してください（説明文不要）:\n{\n  "manufacturer": "メーカー名",\n  "size_info": "W×D×H mm形式",\n  "weight_kg": 数値またはnull,\n  "power_w": 数値またはnull,\n  "image_url": "製品画像URL またはnull"\n}`,
        }],
      }),
    })

    const data = await response.json()
    const textBlock = data.content?.find((b: any) => b.type === 'text')
    const jsonMatch = textBlock?.text?.match(/\{[\s\S]*\}/)
    const spec = jsonMatch ? JSON.parse(jsonMatch[0]) : null

    return new Response(JSON.stringify({ spec }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
