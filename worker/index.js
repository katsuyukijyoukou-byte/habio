const ALLOWED_ORIGIN = 'https://habio.pages.dev';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function buildSystemPrompt(ctx) {
  const { streak = 0, hour = 12, todayMood = null, mealsCount = 0 } = ctx;
  const timeDesc = hour < 6 ? '深夜' : hour < 12 ? '午前' : hour < 18 ? '午後' : '夜';
  let contextDesc = `・現在の時間帯：${timeDesc}（${hour}時）\n`;
  if (streak > 0) contextDesc += `・${streak}日連続で習慣を継続中\n`;
  if (todayMood) contextDesc += `・今日の気分：${todayMood}\n`;
  if (mealsCount > 0) contextDesc += `・今日の食事ログ：${mealsCount}件\n`;

  return `あなたは「Habio」という健康習慣サポートアプリのAIアシスタントです。
ユーザーの毎日の小さな習慣をやさしくサポートします。

## キャラクター
- 責めない、比べない、押し付けない
- 温かく、簡潔に返答する
- 「また今日から」と言える存在
- 医療的なアドバイスはしない

## 返答ルール
- 1〜3文で簡潔に（長くしない）
- 絵文字を1〜2個使う
- やわらかい言葉を使う
- サプリ・商品の宣伝はしない
- 医療診断・治療の提案はしない
- 必ず日本語で返答する

## 現在のユーザー状況
${contextDesc}`;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const { message, context = {}, history = [] } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'No message' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = buildSystemPrompt(context);

    // Include last 6 messages (3 exchanges) as conversation history
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(m => ({
        role: m.me ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: message },
    ];

    try {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 180,
          temperature: 0.8,
        }),
      });

      if (!openaiRes.ok) {
        console.error('OpenAI error:', await openaiRes.text());
        throw new Error('OpenAI API error');
      }

      const data = await openaiRes.json();
      const text = data.choices?.[0]?.message?.content?.trim()
        || 'うまく返信できませんでした。もう一度話しかけてみてください 🌿';

      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({
        text: 'ちょっと考えすぎてしまいました 🍃 もう一度話しかけてみてください。',
      }), {
        status: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
  },
};
