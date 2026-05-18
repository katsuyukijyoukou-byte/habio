const ALLOWED_ORIGIN = 'https://habio.pages.dev';

// Affiliate products catalog — ORDER MATTERS: first match wins, specific before generic
const PRODUCTS = [
  // コーヒー系（ダイエットより先に当てる）
  { keywords: ['コーヒー','クロロゲン','スリモア'], name: 'スリモアコーヒー（機能性表示食品）', url: 'https://a.r10.to/hkkSnq' },
  // 食品・間食系
  { keywords: ['ラーメン','麺','こんにゃく'], name: 'こんにゃくラーメン24食', url: 'https://a.r10.to/h5hfA1' },
  { keywords: ['おから','クッキー','間食','お菓子'], name: 'おからクッキー', url: 'https://a.r10.to/hghgvc' },
  { keywords: ['スムージー','青汁','野菜ジュース'], name: 'バンビウォータースムージー', url: 'https://a.r10.to/hg54gR' },
  // プロテイン系
  { keywords: ['プロテインシェイク','シェイク'], name: 'バンビウォータープロテインシェイク', url: 'https://a.r10.to/hkQ9vF' },
  { keywords: ['プロテイン','タンパク質','置き換え'], name: 'わたしのプロテインダイエット', url: 'https://a.r10.to/hkx6Or' },
  // 運動・器具系
  { keywords: ['EMS','腹筋'], name: 'RELX EMSベルト（腹筋ベルト）', url: 'https://a.r10.to/hPblsN' },
  { keywords: ['振動','ぶるぶる'], name: 'NADLE振動マシン', url: 'https://a.r10.to/hRZZie' },
  { keywords: ['筋肉','筋膜','マッサージ','コリ','疲れ','ほぐ'], name: '筋膜リリースガン ミニ', url: 'https://a.r10.to/h5yeu5' },
  { keywords: ['バーナー','燃焼','引き締め','キラー'], name: 'キラーバーナー2（倖田來未監修）', url: 'https://a.r10.to/hFz0dn' },
  { keywords: ['サウナ','発汗','温活','ウォーキング'], name: '発汗サウナベルト', url: 'https://a.r10.to/h5qSXb' },
  // 夜・睡眠系
  { keywords: ['夜','睡眠','生活習慣','リズム','スリム'], name: 'スリムマネージ', url: 'https://a.r10.to/h5BVog' },
  // 活力系
  { keywords: ['活力','精力','マカ','亜鉛','アルギニン','シトルリン'], name: 'シトルリン・アルギニン・マカ・亜鉛', url: 'https://a.r10.to/hgZsnR' },
  // 食欲系（ダイエット前）
  { keywords: ['食欲','朝食','朝ごはん'], name: 'C COFFEE ダイエットコーヒー', url: 'https://a.r10.to/hkvUAU' },
  // ストレッチ・ヨガ系
  { keywords: ['ヨガ','ヨガマット','ストレッチ','ピラティス','柔軟'], name: 'ヨガマット 厚手（ストレッチ・ピラティス用）', url: 'https://a.r10.to/hYHpdt' },
  { keywords: ['バランスボール','ヨガボール','骨盤'], name: 'バランスボール（エクササイズ・骨盤矯正）', url: 'https://a.r10.to/TKQpY0' },
  { keywords: ['フォームローラー','ストレッチポール','ヨガポール'], name: 'フォームローラー（筋膜リリース）', url: 'https://a.r10.to/h5joGu' },
  { keywords: ['ローラー','筋膜ローラー','ふくらはぎ'], name: '筋膜ローラー（全身・ふくらはぎ）', url: 'https://a.r10.to/hkWjYV' },
  // 首・ネック系
  { keywords: ['首','首コリ','ネック','低周波'], name: 'NIPLUX NECK RELAX（EMS×温熱 首ケア）', url: 'https://a.r10.to/hg5Car' },
  // 睡眠グッズ系
  { keywords: ['枕','まくら','いびき','抱き枕'], name: 'ハグモッチ（快眠まくら）', url: 'https://a.r10.to/hPTr4I' },
  { keywords: ['アイマスク','遮光','目隠し'], name: 'Suyamee アイマスク（遮光99.99%）', url: 'https://a.r10.to/hoQX5R' },
  { keywords: ['ピローミスト','アロマスプレー','ラベンダー','アロマ'], name: 'ピローミスト（安眠アロマスプレー）', url: 'https://a.r10.to/hg5iyi' },
  // 睡眠サプリ系
  { keywords: ['GABA','ギャバ','テアニン','不眠','寝つき'], name: 'ネルカラ 睡眠サポートサプリ（GABA・テアニン）', url: 'https://a.r10.to/hgImdS' },
  { keywords: ['グリシン','ストレス緩和','ラフマ'], name: 'グッドネル 睡眠サプリ（GABA・グリシン）', url: 'https://a.r10.to/h5vcJf' },
  { keywords: ['COQ10','クワンソウ','休息'], name: 'しずみん（休息・睡眠ケアサプリ）', url: 'https://a.r10.to/hPT7Dj' },
  // 腸活・乳酸菌系
  { keywords: ['乳酸菌','ヨーグルト','腸活','善玉菌','便秘','ビフィズス菌'], name: '美粉屋ちょーぐると（乳酸菌・腸活）', url: 'https://a.r10.to/hYNToN' },
  { keywords: ['酪酸菌','腸内フローラ'], name: '酪酸菌サプリ（腸活・ダイエット）', url: 'https://a.r10.to/h5PL44' },
  { keywords: ['フォルスコリ','イヌリン','フォルスコリン'], name: 'コレウスフォルスコリ ダイエットサプリ', url: 'https://a.r10.to/hPeSlb' },
  { keywords: ['デリケートゾーン','フェムケア','妊活','フェミニン'], name: 'ココラクト フェムケアサプリ（乳酸菌）', url: 'https://a.r10.to/h5mWuT' },
  // 美容・コラーゲン系
  { keywords: ['コラーゲン','スッポン','すっぽん','美肌'], name: 'すっぽん小町（コラーゲンサプリ）', url: 'https://a.r10.to/hP9EeO' },
  { keywords: ['ヒアルロン酸','乾燥肌','うるおい','潤い'], name: 'キユーピー ヒアロモイスチャー240', url: 'https://a.r10.to/h8spxf' },
  { keywords: ['ビタミンC','リポソーム','肌荒れ','美白'], name: 'エルリス リポソームビタミンC', url: 'https://a.r10.to/hkixIX' },
  { keywords: ['酵素','ファスティング','断食','酵素ダイエット'], name: '美粉屋みらいのこうそ（酵素ドリンク）', url: 'https://a.r10.to/hgJSqN' },
  { keywords: ['モリンガ','スーパーフード','マルンガイ'], name: 'モリンガ100% タブレット（国産・農薬不使用）', url: 'https://a.r10.to/h5JBSk' },
  // 血糖・コレステロール系
  { keywords: ['血糖値','血糖','菊芋','サラシア','ナットウキナーゼ'], name: 'サラリッチEX（血糖値ケアサプリ）', url: 'https://a.r10.to/hFYNLh' },
  { keywords: ['コレステロール','LDL','中性脂肪'], name: '大正製薬 コレステロール・中性脂肪ケアタブレット', url: 'https://a.r10.to/hgP81Y' },
  { keywords: ['プーアール','プアール','ダイエット茶','烏龍'], name: 'プーアール茶（機能性表示食品・ダイエット）', url: 'https://a.r10.to/h5BItn' },
  // ビタミン・アミノ酸・栄養系
  { keywords: ['ビタミンB','葉酸','パントテン酸','ビオチン'], name: 'FANCL ビタミンBサプリ', url: 'https://a.r10.to/h5vTP4' },
  { keywords: ['アミノ酸','BCAA','EAA','必須アミノ酸'], name: 'バランスアミノ酸サプリ（EAA・BCAA）', url: 'https://a.r10.to/h5tp51' },
  // 冷え・むくみ系
  { keywords: ['ヒハツ','むくみ','足のむくみ','ピペリン'], name: 'ヒハツサプリ（むくみ・冷え 機能性表示食品）', url: 'https://a.r10.to/h5MjW9' },
  { keywords: ['むくみ解消','カリウム','クランベリー'], name: 'むくMix-ZERO（むくみケアサプリ）', url: 'https://a.r10.to/h5qE2k' },
  { keywords: ['腹巻き','はらまき','冷え性'], name: '美温活 はらまき（吸湿発熱・日本製）', url: 'https://a.r10.to/hY3zlx' },
  { keywords: ['生姜','しょうが','ショウガ','ジンジャー'], name: '金時生姜サプリ（温活・冷え対策）', url: 'https://a.r10.to/h5FqwK' },
  // 入浴・バスケア系
  { keywords: ['バスソルト','岩塩','入浴剤'], name: 'ヒマラヤ岩塩 魔法のバスソルト', url: 'https://a.r10.to/hgg5Vf' },
  { keywords: ['重炭酸','ホットタブ','炭酸浴'], name: 'ホットタブ 重炭酸入浴剤（医薬部外品）', url: 'https://a.r10.to/hPe6Lt' },
  // ウォーキング・スポーツ系
  { keywords: ['ウォーキングシューズ','ランニングシューズ','運動靴'], name: 'ウォーキングシューズ（軽量・男女兼用）', url: 'https://a.r10.to/h5Ez9n' },
  { keywords: ['スマートウォッチ','万歩計','歩数計','ウェアラブル'], name: 'HUAWEI WATCH FIT 4 Pro（スマートウォッチ）', url: 'https://a.r10.to/h5pcyJ' },
  { keywords: ['スポーツドリンク','クエン酸水','粉末ドリンク'], name: 'TARZAアミノ酸クエン酸ウォーター', url: 'https://a.r10.to/h8Nw0I' },
  // ストレス・メンタル系
  { keywords: ['アシュワガンダ','ストレス','不安','リラックスサプリ'], name: 'アシュワガンダオイル（ストレスケア）', url: 'https://a.r10.to/h50OMY' },
  // 食事・宅配系
  { keywords: ['宅配弁当','減塩弁当','カロリー制限食','制限食'], name: 'カロリー・塩分調整食 冷凍弁当10食', url: 'https://a.r10.to/hPlorJ' },
  // 汎用ダイエット（最後にマッチ）
  { keywords: ['体重','体脂肪','脂肪','太','カロリ','痩せ','ダイエット'], name: 'カロリンピュア（機能性表示食品・エラグ酸配合）', url: 'https://a.r10.to/hgTpBU' },
];

const PRODUCT_TRIGGER = /サプリ|健康食品|おすすめ.*商品|商品.*おすすめ|何かいい|グッズ|アイテム|体重|痩せ|ダイエット|脂肪|筋肉|筋膜|マッサージ|活力|コーヒー|サウナ|温活|燃焼|EMS|腹筋|プロテイン|スムージー|シェイク|ラーメン|おから|振動|青汁|ヨガ|ストレッチ|バランスボール|フォームローラー|ローラー|首コリ|ネック|枕|アイマスク|睡眠|乳酸菌|腸活|便秘|コラーゲン|ヒアルロン酸|ビタミンC|ビタミンB|血糖|コレステロール|中性脂肪|アミノ酸|酵素|モリンガ|むくみ|冷え|腹巻き|生姜|バスソルト|入浴剤|ウォーキング|ストレス|宅配弁当|スマートウォッチ|万歩計|眠れ|だるい|肌荒|体が固|むくん|首が|疲れが|体の重|何かおすすめ|おすすめは|何がいい|どれがいい/;

// 「欲しい・探してる」など明示的な商品リクエストを検出 → 楽天リアルタイム検索に流す
const SEARCH_TRIGGER = /欲しい|ほしい|探して|探してる|何がおすすめ|おすすめある|どれがいい|紹介して|何かない|ありますか|教えてほしい|買いたい/;

function findProduct(msg) {
  for (const p of PRODUCTS) {
    if (p.keywords.some(k => msg.includes(k))) return p;
  }
  return null;
}

// 楽天市場商品検索API — アフィリエイトURL付きで返す
async function searchRakuten(message, appId, affiliateId) {
  try {
    const apiAffiliateId = affiliateId.split('.').slice(0, 2).join('.');
    const keyword = message.replace(/[。、！？!?\s]+/g, ' ').trim().slice(0, 30);

    const params = new URLSearchParams({
      applicationId: appId,
      affiliateId: apiAffiliateId,
      keyword,
      hits: '1',
      sort: '-reviewCount',
      imageFlag: '1',
    });

    const res = await fetch(
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706?${params}`,
      { headers: { 'Referer': 'https://habio.pages.dev' } }
    );

    if (!res.ok) {
      console.error('Rakuten API error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const item = data.Items?.[0]?.Item;
    if (!item) {
      console.log('Rakuten: no items for keyword:', keyword);
      return null;
    }

    const name = item.itemName.length > 40
      ? item.itemName.slice(0, 40) + '…'
      : item.itemName;

    return {
      name,
      url: item.affiliateUrl || item.itemUrl,
      isRakutenSearch: true,
    };
  } catch (e) {
    console.error('Rakuten search exception:', e.message);
    return null;
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

const PRODUCT_BLOCK_MARKER = '\n\nひとつ選択肢としてご紹介します';

function buildSystemPrompt(ctx) {
  const { streak = 0, hour = 12, todayMood = null, mealsCount = 0, talkStyle = 'gentle', goal = '' } = ctx;
  const timeDesc = hour < 6 ? '深夜' : hour < 12 ? '午前' : hour < 18 ? '午後' : '夜';
  let contextDesc = `時間帯：${timeDesc}`;
  if (streak > 0) contextDesc += `、${streak}日連続継続中`;
  if (todayMood) contextDesc += `、今日の気分：${todayMood}`;
  if (mealsCount > 0) contextDesc += `、食事ログ：${mealsCount}件`;
  if (goal) contextDesc += `、ユーザーの目標：「${goal}」`;

  const STYLE_INSTRUCTIONS = {
    gentle: `【話し方】ふんわり優しく、そっと寄り添うトーンで話す。プレッシャーをかけない。絵文字を1〜2個使い、温かみを大切にする。`,
    normal: `【話し方】フレンドリーな友人のように自然に話す。丁寧だが適度な距離感。絵文字は1個程度。`,
    firm:   `【話し方】はっきりと、遠回しにせず明確に伝える。でも思いやりと温かさを持つ。絵文字は控えめに。語尾に「ですよ」「ましょう」より「です」「ます」を使う。`,
    sparta: `【話し方】容赦なく辛辣で、言い訳を即座に切り捨てる鬼コーチ口調。ため口。「甘い」「話にならない」「それで満足してるの？」など歯に衣着せない表現を使う。短く鋭い言葉でバッサリ切る。絵文字なし。ただし、傷つけるためでなく強くするための厳しさ。最後の1文だけ「まあ、諦めなかったのは認めてやる」程度の小さな承認を入れる。`,
    tsundere: `【話し方】最初から最後まで素っ気なく冷たく、ちょっと呆れた態度。「は？」「だから言ったじゃん」「別に褒めてないし」などの冷たいリアクションを使う。絵文字なし。ただし必ず最後の1文だけ、ぽつりと本音が漏れる温かい一言（「…まあ、ちょっとだけ心配したけど」「次はもっとうまくやれるって、信じてるから」など）を入れる。その1文が全ての救いになるようにする。`,
  };

  const styleInstruction = STYLE_INSTRUCTIONS[talkStyle] || STYLE_INSTRUCTIONS.gentle;

  return `あなたはHabioというアプリの「習慣サポートAI」です。ユーザーの健康・生活習慣に友人のように寄り添い、具体的なアドバイスと温かい励ましを届けます。

ユーザー状況（参考）：${contextDesc}

${styleInstruction}

【絶対に守ること】
- どんなスタイルでも、必ずユーザーに寄り添い、孤独にさせない
- ユーザーを傷つけたり、追い詰めたりしない
- 返答は2〜4文を目安に。深掘りが必要なときは質問で締める
- 日本語で返す

【サプリ・健康グッズ・食品の話題が出たとき】
- 「紹介できません」「わかりません」とは絶対に言わない
- 次のどちらかで返す：
  ① 目的や状況をさらに聞く
  ② 具体的な生活改善アドバイスをする
- 具体的な商品名・URL・値段は自分では出さない（別のシステムが紹介する）

【ダイエット・体型・運動の話題】
- 一緒に考える姿勢を示す。個人に寄り添う
- 無理な目標より小さな一歩を提案する

【医療・病気の話題】
- 医療診断・処方・治療の提案はしない
- 「医師や薬剤師への相談をおすすめします」と伝えた上で、生活習慣のアドバイスはOK`;
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

    // 1. ハードコード商品マッチ（現在のメッセージ → なければ直近会話の文脈で検索）
    const productTriggered = PRODUCT_TRIGGER.test(message);
    let product = productTriggered ? findProduct(message) : null;
    if (productTriggered && !product && history.length) {
      const recentContext = history.slice(-4).map(m => m.text || '').join(' ');
      product = findProduct(recentContext);
    }

    // 2. 明示的リクエスト（欲しい・探してる等）→ 楽天リアルタイム検索
    const searchTriggered = SEARCH_TRIGGER.test(message);
    if (searchTriggered && env.RAKUTEN_APP_ID && env.RAKUTEN_AFFILIATE_ID) {
      const rakutenProduct = await searchRakuten(message, env.RAKUTEN_APP_ID, env.RAKUTEN_AFFILIATE_ID);
      if (rakutenProduct) product = rakutenProduct; // 検索結果を優先
    }

    // アフィリエイト機会ログ
    if (productTriggered || searchTriggered) {
      console.log(JSON.stringify({
        type: 'affiliate_opportunity',
        ts: new Date().toISOString(),
        message,
        matched_product: product?.name ?? 'none',
        source: product?.isRakutenSearch ? 'rakuten_api' : 'hardcoded',
      }));
    }

    const systemPrompt = buildSystemPrompt(context);

    // Include last 6 messages (3 exchanges); strip product blocks from assistant history
    // to prevent the AI from replicating the product recommendation format
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(m => ({
        role: m.me ? 'user' : 'assistant',
        content: m.me ? m.text : m.text.split(PRODUCT_BLOCK_MARKER)[0].trim(),
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
        text += `${PRODUCT_BLOCK_MARKER} 🌿\n▶ ${product.name}\n${product.url}\n（PR・広告：楽天市場 ／ 医薬品ではありません。効果には個人差があります）`;
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
