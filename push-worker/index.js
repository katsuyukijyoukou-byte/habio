// Habio Push Notification Worker
// cron triggers (UTC): 23=朝8時JST / 3=昼12時JST / 11=夜20時JST / 12=おやすみ21時JST

const ALLOWED_ORIGIN = 'https://habio.pages.dev';

// ── 通知コンテンツ（各10件・日替わり） ───────────────────────
const NOTIF_CONTENT = {
  morning: [
    { title: 'Habio 🌿', body: 'おはようございます。まずは水を一杯、それだけでも十分です。' },
    { title: 'Habio 🌿', body: '今日も、あなたのペースで始めましょう。無理しなくていいですよ。' },
    { title: 'Habio 🌱', body: '朝の空気を少し深呼吸してみてください。それだけで少し整います。' },
    { title: 'Habio 🌿', body: '今日一つだけ、小さなことを整えてみませんか。' },
    { title: 'Habio 🌿', body: '無理しない一日でも、それはあなたのペース。おはようございます。' },
    { title: 'Habio 🌱', body: '体を動かすのが難しい日も、窓を開けるだけで違います。' },
    { title: 'Habio 🌿', body: '今日の朝ごはん、何か一口食べられましたか？それで十分です。' },
    { title: 'Habio 🌿', body: '昨日よりちょっとだけ、それで十分。おはようございます。' },
    { title: 'Habio 🌱', body: '朝の5分、ただぼーっとするだけでもいい時間です。' },
    { title: 'Habio 🌿', body: '今日はどんな日にしたいですか？どんな答えでも正解です。' },
  ],
  noon: [
    { title: 'Habio 🌿', body: 'ちょっと一息つけましたか？肩の力を抜いてみてください。' },
    { title: 'Habio 🌿', body: '少し深呼吸してみませんか？ゆっくり吐くだけでいいですよ。' },
    { title: 'Habio 🌱', body: 'お昼は野菜を一品だけ意識してみてください。それで十分です。' },
    { title: 'Habio 🌿', body: '午前中、お疲れさまでした。少し休んでもいいですよ。' },
    { title: 'Habio 🌿', body: '今日は"整える日"でもいいかもしれません。無理しないで。' },
    { title: 'Habio 🌱', body: 'お昼の後、少しだけ外を歩くと午後が変わります。' },
    { title: 'Habio 🌿', body: '水を飲んでいますか？一杯だけでも体が喜びます。' },
    { title: 'Habio 🌿', body: '今日の「できた」、まだゼロじゃないはずですよ。' },
    { title: 'Habio 🌱', body: '姿勢を少し正してみましょう。それだけで気持ちが変わります。' },
    { title: 'Habio 🌿', body: '今日の午後も、あなたのペースで大丈夫です。' },
  ],
  evening: [
    { title: 'Habio 🌿', body: '夕方になりましたね。少し体を伸ばすだけでも違いますよ。' },
    { title: 'Habio 🌱', body: '今日できたこと、一つ思い浮かべてみてください。' },
    { title: 'Habio 🌿', body: 'ゆっくり水を一杯飲んでみてください。少し整います。' },
    { title: 'Habio 🌿', body: '今日はどんな日でしたか？どんな日でも、あなたのペースで十分です。' },
    { title: 'Habio 🌙', body: '夜の時間、少しだけ自分を労ってあげてください。' },
    { title: 'Habio 🌿', body: '夕食は消化に良いものを一品だけ意識してみましょう。' },
    { title: 'Habio 🌱', body: '今日Habioに話しかけてみませんか？聞いていますよ。' },
    { title: 'Habio 🌿', body: '肩と首を軽くほぐしてみましょう。30秒でも変わります。' },
    { title: 'Habio 🌙', body: 'このまま夜を穏やかに過ごしましょう。焦らなくていいです。' },
    { title: 'Habio 🌱', body: '今日の習慣、少しだけ振り返ってみませんか。' },
  ],
  goodnight: [
    { title: 'Habio 🌙', body: 'お疲れさまでした。今日はここまでで十分です。' },
    { title: 'Habio 🌙', body: '少し肩の力を抜きましょう。よく一日過ごしました。' },
    { title: 'Habio 🌿', body: '今日できたこと、一つで十分。おやすみなさい。' },
    { title: 'Habio 🌙', body: 'ゆっくり休んでください。明日のことは、明日に。' },
    { title: 'Habio 🌙', body: '今日という日を、穏やかに終わらせましょう。おやすみなさい。' },
    { title: 'Habio 🌙', body: '寝る前に深呼吸を一回。それだけで体が緩みます。' },
    { title: 'Habio 🌿', body: '布団に入る前に、スマホを少し遠ざけてみましょう。' },
    { title: 'Habio 🌙', body: '今日もありがとうございました。ゆっくり眠れますように。' },
    { title: 'Habio 🌱', body: '完璧な一日じゃなくても、それで十分です。おやすみなさい。' },
    { title: 'Habio 🌙', body: '明日の自分のために、今夜はしっかり休んでください。' },
  ],
};

const SLOT_TAB = { morning: 'home', noon: 'habits', evening: 'chat', goodnight: 'home' };

// 前回と同じインデックスを避けて日替わり選択（env があれば KV で永続化）
async function pickContent(slot, env = null) {
  const msgs = NOTIF_CONTENT[slot] || NOTIF_CONTENT.morning;
  const tab  = SLOT_TAB[slot] || 'home';

  let lastIdx = -1;
  if (env && msgs.length > 1) {
    lastIdx = (await env.PREMIUM_KV.get(`push_last_idx_${slot}`, 'json')) ?? -1;
  }

  let idx;
  if (msgs.length <= 1) {
    idx = 0;
  } else {
    do { idx = Math.floor(Math.random() * msgs.length); } while (idx === lastIdx);
  }

  if (env) {
    await env.PREMIUM_KV.put(`push_last_idx_${slot}`, JSON.stringify(idx), { expirationTtl: 8 * 24 * 3600 });
  }

  const msg = msgs[idx];
  return {
    ...msg,
    icon:  '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag:   `habio-${slot}`,
    data:  { url: `/app?tab=${tab}`, tab, type: slot },
  };
}

// ── CORS ──────────────────────────────────────────────────────
// Authorization を含めないと preflight が通らずブラウザがブロックする
function cors(origin) {
  return {
    'Access-Control-Allow-Origin':  origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ── VAPID 鍵管理（KV自動生成・永続化） ───────────────────────
async function getVapidKeys(env) {
  const stored = await env.PREMIUM_KV.get('push_vapid', 'json');
  if (stored) {
    const privateKey = await crypto.subtle.importKey(
      'jwk', stored.privateJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, ['sign']
    );
    return { privateKey, publicKeyBase64: stored.publicKeyBase64 };
  }

  const kp = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
  );
  const privateJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const publicJwk  = await crypto.subtle.exportKey('jwk', kp.publicKey);

  // uncompressed point: 0x04 || x(32) || y(32) = 65 bytes
  const x = b64uDecode(publicJwk.x);
  const y = b64uDecode(publicJwk.y);
  const uncompressed = concat(new Uint8Array([0x04]), x, y);
  const publicKeyBase64 = b64u(uncompressed);

  await env.PREMIUM_KV.put('push_vapid', JSON.stringify({ privateJwk, publicKeyBase64 }));
  return { privateKey: kp.privateKey, publicKeyBase64 };
}

// ── VAPID JWT 生成 ─────────────────────────────────────────────
async function vapidJWT(privateKey, audience, subject) {
  const header  = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64u(JSON.stringify({
    sub: subject,
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
  }));
  const toSign = `${header}.${payload}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      te(toSign)
    )
  );
  return `${toSign}.${b64u(sig)}`;
}

// ── Web Push 暗号化（RFC 8291 + aes128gcm） ───────────────────
async function encryptPayload(plaintext, dh_public_bytes, auth_bytes) {
  // 1. 送信者用エフェメラル ECDH 鍵ペア
  const eph = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const ephPubJwk  = await crypto.subtle.exportKey('jwk', eph.publicKey);
  const as_public  = concat(new Uint8Array([0x04]), b64uDecode(ephPubJwk.x), b64uDecode(ephPubJwk.y));

  // 2. 受信者の公開鍵（p256dh）をインポート
  const ua_key = await crypto.subtle.importKey(
    'raw', dh_public_bytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  // 3. ECDH 共有シークレット
  const ecdh_secret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: ua_key }, eph.privateKey, 256)
  );

  // 4. RFC 8291 IKM 導出
  // PRK = HMAC-SHA-256(auth_secret, ecdh_secret)
  // IKM = HMAC-SHA-256(PRK, "WebPush: info\0" || ua_public || as_public || 0x01)[0:32]
  const info = concat(te('WebPush: info\x00'), dh_public_bytes, as_public);
  const prk  = await hmac(auth_bytes, ecdh_secret);
  const ikm  = (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, 32);

  // 5. RFC 8188 コンテンツ暗号化鍵・ノンス導出
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk2 = await hmac(salt, ikm);
  const cek   = (await hmac(prk2, concat(te('Content-Encoding: aes128gcm\x00'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk2, concat(te('Content-Encoding: nonce\x00'),      new Uint8Array([1])))).slice(0, 12);

  // 6. AES-128-GCM 暗号化（最終レコード: 末尾に 0x02 パディング）
  const aes_key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const padded  = concat(te(plaintext), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aes_key, padded)
  );

  // 7. aes128gcm ボディ: salt(16) | rs(4 BE) | idl(1=65) | as_public(65) | ciphertext
  const hdr = new Uint8Array(21);
  hdr.set(salt, 0);
  new DataView(hdr.buffer).setUint32(16, 4096, false);
  hdr[20] = 65;
  return concat(hdr, as_public, ciphertext);
}

// ── Push 送信 ────────────────────────────────────────────────
async function sendPush(subscription, content, vapid, env) {
  const { endpoint, keys: { p256dh, auth } } = subscription;
  const audience = new URL(endpoint).origin;
  const subject  = `mailto:${env.VAPID_SUBJECT || 'habio@habio.app'}`;

  const jwt  = await vapidJWT(vapid.privateKey, audience, subject);
  const body = await encryptPayload(
    JSON.stringify(content),
    b64uDecode(p256dh),
    b64uDecode(auth)
  );

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization':    `vapid t=${jwt},k=${vapid.publicKeyBase64}`,
      'Content-Type':     'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL':              '86400',
      'Urgency':          'normal',
    },
    body,
  });

  const status     = res.status;
  const statusText = res.statusText || '';
  console.log(`[sendPush] endpoint=${endpoint.slice(0, 70)} status=${status}`);

  if (status === 410 || status === 404) return { result: 'expired', status, statusText };
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(`[sendPush] failed ${status}: ${errBody}`);
    throw new Error(`push service ${status}: ${errBody}`);
  }
  return { result: 'sent', status, statusText };
}

// ── ユーティリティ ────────────────────────────────────────────
function te(str) { return new TextEncoder().encode(str); }

function concat(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

async function hmac(key_bytes, data_bytes) {
  const k = await crypto.subtle.importKey('raw', key_bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data_bytes));
}

function b64u(bytes) {
  if (typeof bytes === 'string') bytes = new TextEncoder().encode(bytes);
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64uDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const p = s.padEnd(s.length + (4 - s.length % 4) % 4, '=');
  return new Uint8Array([...atob(p)].map(c => c.charCodeAt(0)));
}

// ── メインハンドラ ────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    // VAPID 公開鍵を返す（frontend が pushManager.subscribe に使用）
    if (url.pathname === '/push/vapid-key' && request.method === 'GET') {
      const vapid = await getVapidKeys(env);
      return Response.json({ publicKey: vapid.publicKeyBase64 }, { headers });
    }

    // subscription 保存 or 更新
    if (url.pathname === '/push/subscribe') {
      if (request.method === 'POST') {
        const { hash, subscription, prefs } = await request.json();
        if (!hash || !subscription?.endpoint) {
          return Response.json({ error: 'invalid body' }, { status: 400, headers });
        }
        await env.PREMIUM_KV.put(
          `push_sub:${hash}`,
          JSON.stringify({ subscription, prefs }),
          { expirationTtl: 90 * 24 * 3600 }
        );
        return Response.json({ ok: true }, { headers });
      }

      if (request.method === 'PATCH') {
        const { hash, prefs } = await request.json();
        const stored = await env.PREMIUM_KV.get(`push_sub:${hash}`, 'json');
        if (!stored) return Response.json({ error: 'not found' }, { status: 404, headers });
        stored.prefs = { ...stored.prefs, ...prefs };
        await env.PREMIUM_KV.put(`push_sub:${hash}`, JSON.stringify(stored), { expirationTtl: 90 * 24 * 3600 });
        return Response.json({ ok: true }, { headers });
      }

      if (request.method === 'DELETE') {
        const { hash } = await request.json();
        await env.PREMIUM_KV.delete(`push_sub:${hash}`);
        return Response.json({ ok: true }, { headers });
      }
    }

    // テスト送信（開発用）
    if (url.pathname === '/push/test' && request.method === 'POST') {
      const { hash, slot = 'morning' } = await request.json();
      console.log(`[push/test] hash=${hash}`);

      const stored = await env.PREMIUM_KV.get(`push_sub:${hash}`, 'json');
      console.log(`[push/test] subscriptionFound=${!!stored}`);

      if (!stored) {
        return Response.json({
          ok: false,
          debug: { hash, subscriptionFound: false },
          error: 'no subscription for hash',
        }, { status: 404, headers });
      }

      const endpointPrefix = stored.subscription?.endpoint?.slice(0, 70) || '(none)';
      console.log(`[push/test] endpoint=${endpointPrefix}`);

      const vapid = await getVapidKeys(env);
      let pushResult = null;
      let pushError  = null;
      let kvDeleted  = false;
      try {
        pushResult = await sendPush(stored.subscription, await pickContent(slot, env), vapid, env);
        console.log(`[push/test] pushResult=${JSON.stringify(pushResult)}`);
        // 410/404 → KV から即削除
        if (pushResult.result === 'expired') {
          await env.PREMIUM_KV.delete(`push_sub:${hash}`);
          kvDeleted = true;
          console.log(`[push/test] Deleted expired subscription: push_sub:${hash}`);
        }
      } catch (e) {
        pushError = e.message;
        console.error(`[push/test] pushError=${pushError}`);
      }

      return Response.json({
        ok: !pushError && pushResult?.result !== 'expired',
        debug: {
          hash,
          subscriptionFound: true,
          endpointPrefix,
          pushStatus:     pushResult?.status     ?? null,
          pushStatusText: pushResult?.statusText ?? null,
          pushResult:     pushResult?.result     ?? null,
          kvDeleted,
          error:          pushError,
        },
      }, { headers });
    }

    // A/B クリック記録
    if (url.pathname === '/push/ab-click' && request.method === 'POST') {
      const { testId, variant } = await request.json();
      if (!testId || !['A','B'].includes(variant)) {
        return Response.json({ error: 'invalid params' }, { status: 400, headers });
      }
      const key = `push_ab:${testId}`;
      const stats = (await env.PREMIUM_KV.get(key, 'json')) || { A: { sent:0, clicks:0 }, B: { sent:0, clicks:0 } };
      stats[variant].clicks = (stats[variant].clicks || 0) + 1;
      await env.PREMIUM_KV.put(key, JSON.stringify(stats), { expirationTtl: 90 * 24 * 3600 });
      return Response.json({ ok: true }, { headers });
    }

    // A/B 集計取得（管理者認証）
    if (url.pathname === '/push/ab-stats' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization') || '';
      const secret = env.ADMIN_SECRET || '';
      if (!secret) return Response.json({ error: 'ADMIN_SECRET not configured on Worker' }, { status: 500, headers });
      if (authHeader !== `Bearer ${secret}`) {
        return Response.json({ error: 'Unauthorized: invalid password' }, { status: 401, headers });
      }
      const testId = url.searchParams.get('testId') || '';
      if (!testId) return Response.json({ error: 'testId required' }, { status: 400, headers });
      const stats = (await env.PREMIUM_KV.get(`push_ab:${testId}`, 'json')) || { A: { sent:0, clicks:0 }, B: { sent:0, clicks:0 } };
      return Response.json(stats, { headers });
    }

    // 管理者一斉送信
    if (url.pathname === '/push/broadcast' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      const secret = env.ADMIN_SECRET || '';

      console.log(`[broadcast] ADMIN_SECRET set=${!!secret} authHeaderPrefix=${authHeader.slice(0,14)}...`);

      if (!secret) {
        console.error('[broadcast] ADMIN_SECRET is not set in Worker environment');
        return Response.json({ error: 'ADMIN_SECRET not configured on Worker' }, { status: 500, headers });
      }
      if (authHeader !== `Bearer ${secret}`) {
        console.error('[broadcast] Auth failed: header does not match ADMIN_SECRET');
        return Response.json({ error: 'Unauthorized: invalid password' }, { status: 401, headers });
      }

      const body_json = await request.json().catch(() => null);
      if (!body_json) return Response.json({ error: 'invalid JSON body' }, { status: 400, headers });

      const { title, body, tab = 'home', type = 'broadcast', variant = null, abTestId = null } = body_json;
      console.log(`[broadcast] title="${title}" body="${body?.slice(0,30)}" tab=${tab}`);
      if (!title || !body) return Response.json({ error: 'title and body are required' }, { status: 400, headers });

      // A/B テスト時は URL にパラメータを付与してクリックを追跡
      const abParams = (abTestId && variant)
        ? `&abTestId=${encodeURIComponent(abTestId)}&variant=${encodeURIComponent(variant)}`
        : '';
      const content = {
        title,
        body,
        icon:  '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg',
        tag:   'habio-broadcast',
        data:  { url: `/app?tab=${tab}${abParams}`, tab, type, variant, abTestId },
      };

      const vapid = await getVapidKeys(env);
      const list  = await env.PREMIUM_KV.list({ prefix: 'push_sub:' });
      console.log(`[broadcast] total subscriptions in KV: ${list.keys.length}`);

      let sent = 0, failed = 0, deleted = 0;
      await Promise.allSettled(
        list.keys.map(async ({ name }) => {
          const data = await env.PREMIUM_KV.get(name, 'json');
          if (!data) { console.warn(`[broadcast] ${name}: no data`); return; }
          try {
            const result = await sendPush(data.subscription, content, vapid, env);
            console.log(`[broadcast] ${name}: result=${result.result} status=${result.status}`);
            if (result.result === 'expired') {
              await env.PREMIUM_KV.delete(name);
              deleted++;
            } else {
              sent++;
            }
          } catch (e) {
            console.error(`[broadcast] ${name}: ERROR ${e.message}`);
            failed++;
          }
        })
      );

      // A/B sent カウントを記録
      if (abTestId && ['A','B'].includes(variant)) {
        const abKey = `push_ab:${abTestId}`;
        const abStats = (await env.PREMIUM_KV.get(abKey, 'json')) || { A:{sent:0,clicks:0}, B:{sent:0,clicks:0} };
        abStats[variant].sent = (abStats[variant].sent || 0) + sent;
        await env.PREMIUM_KV.put(abKey, JSON.stringify(abStats), { expirationTtl: 90 * 24 * 3600 });
      }

      console.log(`[broadcast] DONE sent=${sent} failed=${failed} deleted=${deleted} total=${list.keys.length}`);
      return Response.json({ ok: true, sent, failed, deleted, total: list.keys.length }, { headers });
    }

    return new Response('Not found', { status: 404, headers });
  },

  // cron ハンドラ — 各時間帯に通知を一斉送信
  async scheduled(event, env) {
    const utcHour = new Date(event.scheduledTime).getUTCHours();
    const slotMap = { 23: 'morning', 3: 'noon', 11: 'evening', 12: 'goodnight' };
    const slot = slotMap[utcHour];
    if (!slot) return;

    const vapid   = await getVapidKeys(env);
    const content = await pickContent(slot, env);
    const isGoodnight = slot === 'goodnight';

    const list = await env.PREMIUM_KV.list({ prefix: 'push_sub:' });
    const results = await Promise.allSettled(
      list.keys.map(async ({ name }) => {
        const data = await env.PREMIUM_KV.get(name, 'json');
        if (!data) return;
        const enabled = isGoodnight ? data.prefs?.sleep : data.prefs?.notif;
        if (!enabled) return;
        const result = await sendPush(data.subscription, content, vapid, env);
        if (result.result === 'expired') {
          await env.PREMIUM_KV.delete(name);
          console.log(`[push] Removed expired: ${name}`);
        } else {
          console.log(`[push] ${slot} → ${name} (${result.status})`);
        }
      })
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed) console.error(`[push] ${slot}: ${failed} failures`);
  },
};
