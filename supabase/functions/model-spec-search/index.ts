import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { modelName } = await req.json();

    if (!modelName) {
      return new Response(
        JSON.stringify({ error: '機種名が必要です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicKey = Deno.env.get('dfx_api_key');
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'APIキーが設定されていません（dfx_api_key）' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `アーケードゲーム機「${modelName}」の製品仕様を調べてください。\n以下の情報をJSONのみで返してください（説明文・コードブロック不要）:\n{\n  "manufacturer": "メーカー名",\n  "size_info": "W×D×H mm形式",\n  "weight_kg": 数値またはnull,\n  "power_w": 数値またはnull,\n  "image_url": "製品画像の直接URLまたはnull"\n}`,
        }],
      }),
    });

    const data = await response.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text') as { text: string } | undefined;
    let spec = null;

    if (textBlock?.text) {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          spec = JSON.parse(jsonMatch[0]);
        } catch {
          spec = null;
        }
      }
    }

    return new Response(
      JSON.stringify({ spec }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
