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
- 医療診断・治療の提案はしない
- 必ず日本語で返答する

## PR商品カタログ（アフィリエイト）
ユーザーが体重・ダイエット・運動・食事・サプリ・健康グッズについて尋ねた場合のみ、以下から最も関連する商品を1つだけ自然に紹介できます。

| カテゴリ | 商品名 | URL |
|---|---|---|
| 体重・体脂肪が気になる | カロリンピュア（機能性表示食品・エラグ酸） | https://a.r10.to/hgTpBU |
| 生活習慣・夜の習慣サポート | スリムマネージ | https://a.r10.to/h5BVog |
| 生活習慣サポート全般 | キラーバーナー2（倖田來未監修） | https://a.r10.to/hFz0dn |
| 運動後のセルフケア・マッサージ | 筋膜リリースガン ミニ | https://a.r10.to/h5yeu5 |
| 活力・体力サポート | シトルリン・アルギニン・マカ・亜鉛 | https://a.r10.to/hgZsnR |
| ダイエットコーヒー・朝の習慣 | C COFFEE | https://a.r10.to/hkvUAU |
| 運動中の温活 | 発汗サウナベルト | https://a.r10.to/h5qSXb |

### 商品紹介ルール（必須）
- 紹介する場合は文末に「（PR・広告）楽天市場のリンクです」と必ず付ける
- 1回の返答で紹介するのは1商品まで
- URLをそのまま文中に含める（例: 気になる方はこちらをどうぞ → https://a.r10.to/xxx）
- 「絶対に効く」「必ず痩せる」などの断定表現は使わない
- 「医薬品ではありません。効果には個人差があります」を添える
- ユーザーが商品を求めていない場合は紹介しない

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
