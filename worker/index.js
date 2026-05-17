const ALLOWED_ORIGIN = 'https://habio.pages.dev';

// Affiliate products catalog
const PRODUCTS = [
  { keywords: ['体重','体脂肪','脂肪','太','カロリ','痩せ','ダイエット'], name: 'カロリンピュア（機能性表示食品・エラグ酸配合）', url: 'https://a.r10.to/hgTpBU' },
  { keywords: ['夜','睡眠','生活習慣','リズム','スリム'], name: 'スリムマネージ', url: 'https://a.r10.to/h5BVog' },
  { keywords: ['バーナー','燃焼','引き締め','キラー'], name: 'キラーバーナー2（倖田來未監修）', url: 'https://a.r10.to/hFz0dn' },
  { keywords: ['筋肉','筋膜','マッサージ','コリ','疲れ','ほぐ'], name: '筋膜リリースガン ミニ', url: 'https://a.r10.to/h5yeu5' },
  { keywords: ['活力','精力','マカ','亜鉛','アルギニン','シトルリン'], name: 'シトルリン・アルギニン・マカ・亜鉛', url: 'https://a.r10.to/hgZsnR' },
  { keywords: ['コーヒー','朝','食事','食欲'], name: 'C COFFEE ダイエットコーヒー', url: 'https://a.r10.to/hkvUAU' },
  { keywords: ['サウナ','発汗','温活','ベルト','ウォーキング'], name: '発汗サウナベルト', url: 'https://a.r10.to/h5qSXb' },
];

const PRODUCT_TRIGGER = /サプリ|健康食品|おすすめ.*商品|商品.*おすすめ|何かいい|グッズ|アイテム|体重|痩せ|ダイエット|脂肪|筋肉|筋膜|マッサージ|活力|コーヒー|サウナ|温活|燃焼/;

function findProduct(msg) {
  for (const p of PRODUCTS) {
    if (p.keywords.some(k => msg.includes(k))) return p;
  }
  return null;
}

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
  let contextDesc = `時間帯：${timeDesc}`;
  if (streak > 0) contextDesc += `、${streak}日連続継続中`;
  if (todayMood) contextDesc += `、今日の気分：${todayMood}`;
  if (mealsCount > 0) contextDesc += `、食事ログ：${mealsCount}件`;

  return `あなたはHabioというアプリのAIアシスタントです。
ユーザー状況（参考）：${contextDesc}

ルール：
- ユーザーのメッセージに直接答える
- 1〜3文で簡潔に返す
- 絵文字を1〜2個使う
- やわらかく温かい言葉で話す
- 医療診断・治療の提案はしない
- 日本語で返答する`;
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

    // Detect product intent
    const product = PRODUCT_TRIGGER.test(message) ? findProduct(message) : null;
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
      let text = data.choices?.[0]?.message?.content?.trim()
        || 'うまく返信できませんでした。もう一度話しかけてみてください 🌿';

      // Append product recommendation block if product was detected
      if (product) {
        text += `\n\nひとつ選択肢としてご紹介します 🌿\n▶ ${product.name}\n${product.url}\n（PR・広告：楽天市場 ／ 医薬品ではありません。効果には個人差があります）`;
      }

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
