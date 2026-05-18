const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function cors(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);

    // Stripe endpoints
    if (request.method === 'POST' && url.pathname === '/create-checkout')    return handleCreateCheckout(request, env);
    if (request.method === 'POST' && url.pathname === '/webhook')             return handleWebhook(request, env);
    if (request.method === 'POST' && url.pathname === '/verify')              return handleVerify(request, env);
    if (request.method === 'POST' && url.pathname === '/activate')            return handleActivate(request, env);
    if (request.method === 'POST' && url.pathname === '/cancel-subscription') return handleCancelSubscription(request, env);

    // Points & Referral endpoints
    if (request.method === 'GET'  && url.pathname === '/user/init')           return handleUserInit(request, env);
    if (request.method === 'GET'  && url.pathname === '/points/me')           return handlePointsMe(request, env);
    if (request.method === 'POST' && url.pathname === '/referral/register')   return handleReferralRegister(request, env);

    // X (Twitter) endpoints
    if (request.method === 'GET'  && url.pathname === '/x/status')            return handleXStatus(request, env);
    if (request.method === 'POST' && url.pathname === '/x/tweet')             return handleXTweet(request, env);
    if (request.method === 'POST' && url.pathname === '/x/disconnect')        return handleXDisconnect(request, env);

    return cors(JSON.stringify({ error: 'not found' }), 404);
  },
};

// ── /create-checkout ──────────────────────────────────────────────────────────
async function handleCreateCheckout(request, env) {
  let body;
  try { body = await request.json(); } catch { return cors(JSON.stringify({ error: 'invalid json' }), 400); }

  const email = (body.email || '').trim().toLowerCase();
  if (!email) return cors(JSON.stringify({ error: 'email required' }), 400);

  const successUrl = body.successUrl || 'https://habio.pages.dev/?premium=success';
  const cancelUrl  = body.cancelUrl  || 'https://habio.pages.dev/?premium=cancel';

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': env.STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    'subscription_data[trial_period_days]': '7',
    'subscription_data[metadata][email]': email,
    customer_email: email,
    success_url: successUrl,
    cancel_url: cancelUrl,
    'metadata[email]': email,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = await res.json();
  if (!res.ok) return cors(JSON.stringify({ error: session.error?.message || 'stripe error' }), 500);

  return cors(JSON.stringify({ url: session.url }));
}

// ── /webhook ──────────────────────────────────────────────────────────────────
async function handleWebhook(request, env) {
  const sig = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  let event;
  try {
    event = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return new Response('Bad signature', { status: 400 });
  }

  const type = event.type;

  if (type === 'checkout.session.completed') {
    const email = extractEmail(event);
    if (email) {
      await setPremium(env, email, true);
      await recordPremiumStart(env, email);
    }
  }

  // invoice.paid fires for every successful payment (trial end + monthly renewals)
  if (type === 'invoice.paid') {
    const email = extractEmail(event);
    if (email) {
      await setPremium(env, email, true);
      await checkAndAwardPremiumReferral(env, email);
    }
  }

  if (type === 'customer.subscription.deleted' || type === 'invoice.payment_failed') {
    const email = extractEmail(event);
    if (email) await setPremium(env, email, false);
  }

  return new Response('ok', { status: 200 });
}

// ── /verify ───────────────────────────────────────────────────────────────────
async function handleVerify(request, env) {
  let body;
  try { body = await request.json(); } catch { return cors(JSON.stringify({ error: 'invalid json' }), 400); }

  const email = (body.email || '').trim().toLowerCase();
  if (!email) return cors(JSON.stringify({ error: 'email required' }), 400);

  const val = await env.PREMIUM_KV.get(`premium:${email}`);
  return cors(JSON.stringify({ premium: val === '1' }));
}

// ── /activate ─────────────────────────────────────────────────────────────────
async function handleActivate(request, env) {
  let body;
  try { body = await request.json(); } catch { return cors(JSON.stringify({ error: 'invalid json' }), 400); }

  const sessionId = (body.session_id || '').trim();
  if (!sessionId) return cors(JSON.stringify({ error: 'session_id required' }), 400);

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const session = await res.json();
  if (!res.ok) return cors(JSON.stringify({ error: 'stripe error' }), 500);

  const paid = session.payment_status === 'paid' || session.status === 'complete';
  if (!paid) return cors(JSON.stringify({ premium: false }));

  const email = (session.customer_email || session.metadata?.email || '').toLowerCase();
  if (!email) return cors(JSON.stringify({ error: 'no email in session' }), 500);

  await setPremium(env, email, true);
  await recordPremiumStart(env, email);
  return cors(JSON.stringify({ premium: true, email }));
}

// ── /cancel-subscription ──────────────────────────────────────────────────────
async function handleCancelSubscription(request, env) {
  let body;
  try { body = await request.json(); } catch { return cors(JSON.stringify({ error: 'invalid json' }), 400); }

  const email = (body.email || '').trim().toLowerCase();
  if (!email) return cors(JSON.stringify({ error: 'email required' }), 400);

  const custRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const custData = await custRes.json();
  const customer = custData.data?.[0];

  if (customer) {
    for (const status of ['active', 'trialing']) {
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=${status}&limit=1`,
        { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
      );
      const subData = await subRes.json();
      const sub = subData.data?.[0];
      if (sub) {
        const cancelRes = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.id}/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        if (!cancelRes.ok) {
          const err = await cancelRes.json();
          return cors(JSON.stringify({ error: err.error?.message || 'stripe cancel failed' }), 500);
        }
        break;
      }
    }
  }

  await setPremium(env, email, false);
  return cors(JSON.stringify({ success: true }));
}

// ── /user/init ────────────────────────────────────────────────────────────────
async function handleUserInit(request, env) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return cors(JSON.stringify({ error: 'email required' }), 400);

  const user = await getOrCreateUser(env.PREMIUM_KV, email);
  const hash = await hashEmail(email);
  const refList = (await env.PREMIUM_KV.get(`refs:by:${hash}`, 'json')) || [];
  const premiumCount = refList.filter(r => r.premium_rewarded).length;

  return cors(JSON.stringify({
    referral_code: user.referral_code,
    referral_url: `https://habio.pages.dev/app?ref=${user.referral_code}`,
    total_points: user.total_points || 0,
    referred_by: user.referred_by || null,
    referral_count: refList.length,
    premium_referral_count: premiumCount,
  }));
}

// ── /points/me ────────────────────────────────────────────────────────────────
async function handlePointsMe(request, env) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return cors(JSON.stringify({ error: 'email required' }), 400);

  // getOrCreateUser で必ず招待コードを生成・返却する
  const user = await getOrCreateUser(env.PREMIUM_KV, email);
  const hash = user.hash;

  const log = (await env.PREMIUM_KV.get(`pts:log:${hash}`, 'json')) || [];
  const refList = (await env.PREMIUM_KV.get(`refs:by:${hash}`, 'json')) || [];

  return cors(JSON.stringify({
    total_points: user.total_points || 0,
    log: log.slice(0, 20),
    referral_count: refList.length,
    premium_referral_count: refList.filter(r => r.premium_rewarded).length,
    referral_code: user.referral_code,
    referral_url: `https://habio.pages.dev/app?ref=${user.referral_code}`,
  }));
}

// ── /referral/register ────────────────────────────────────────────────────────
async function handleReferralRegister(request, env) {
  let body;
  try { body = await request.json(); } catch { return cors(JSON.stringify({ error: 'invalid json' }), 400); }

  const email   = (body.email    || '').trim().toLowerCase();
  const refCode = (body.ref_code || '').trim().toUpperCase();
  if (!email || !refCode) return cors(JSON.stringify({ error: 'email and ref_code required' }), 400);

  // Validate referral code
  const refData = await env.PREMIUM_KV.get(`rc:${refCode}`, 'json');
  if (!refData) return cors(JSON.stringify({ ok: false, reason: 'invalid_code' }), 400);

  const referrerEmail = refData.owner_email;
  if (referrerEmail === email) return cors(JSON.stringify({ ok: false, reason: 'self_referral' }));

  const referredHash = await hashEmail(email);
  const referrerHash = await hashEmail(referrerEmail);

  // Check: already used any referral code
  const existingUser = await env.PREMIUM_KV.get(`u:${referredHash}`, 'json');
  if (existingUser?.referred_by) return cors(JSON.stringify({ ok: false, reason: 'already_used_referral' }));

  // Check: same pair already registered
  const existingRef = await env.PREMIUM_KV.get(`ref:${referrerHash}:${referredHash}`, 'json');
  if (existingRef) return cors(JSON.stringify({ ok: false, reason: 'already_referred' }));

  // Get or create both users
  await getOrCreateUser(env.PREMIUM_KV, referrerEmail);
  const referredUser = await getOrCreateUser(env.PREMIUM_KV, email);

  const now = new Date().toISOString();

  // Create referral record
  const refRecord = {
    referrer_email: referrerEmail,
    referred_email: email,
    ref_code: refCode,
    status: 'registered',
    signup_rewarded: false,
    premium_rewarded: false,
    created_at: now,
    premium_started_at: null,
    premium_qualified_at: null,
  };
  await env.PREMIUM_KV.put(`ref:${referrerHash}:${referredHash}`, JSON.stringify(refRecord));

  // Add to referrer's list
  const listKey = `refs:by:${referrerHash}`;
  const list = (await env.PREMIUM_KV.get(listKey, 'json')) || [];
  list.push({ referred_email: email, referred_hash: referredHash, created_at: now, premium_rewarded: false });
  await env.PREMIUM_KV.put(listKey, JSON.stringify(list));

  // Mark referred user with referrer info
  referredUser.referred_by = referrerEmail;
  referredUser.referred_at = now;
  await env.PREMIUM_KV.put(`u:${referredHash}`, JSON.stringify(referredUser));

  // Award signup points (both parties)
  await addPoints(env.PREMIUM_KV, referrerEmail, 'referral_signup_referrer', 10, `${email} さんを紹介`, email);
  await addPoints(env.PREMIUM_KV, email,          'referral_signup_referred',   5, `招待コードで登録`,   referrerEmail);

  // Mark signup as rewarded
  refRecord.signup_rewarded = true;
  await env.PREMIUM_KV.put(`ref:${referrerHash}:${referredHash}`, JSON.stringify(refRecord));

  return cors(JSON.stringify({ ok: true, bonus: { referrer: 10, referred: 5 } }));
}

// ── /x/status ─────────────────────────────────────────────────────────────────
async function handleXStatus(request, env) {
  const url   = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return cors(JSON.stringify({ error: 'email required' }), 400);

  const hash    = await hashEmail(email);
  const xUser   = await env.PREMIUM_KV.get(`x_user:${hash}`, 'json');
  const hasToken = !!(await env.PREMIUM_KV.get(`x_token:${hash}`)) ||
                   !!(await env.PREMIUM_KV.get(`x_refresh:${hash}`));

  if (!xUser || !hasToken) {
    return cors(JSON.stringify({ connected: false }));
  }

  // 今日のシェア数（JST）
  const jstDate  = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const dayCount = parseInt(await env.PREMIUM_KV.get(`x_share_day:${hash}:${jstDate}`) || '0', 10);

  return cors(JSON.stringify({
    connected:   true,
    x_username:  xUser.x_username,
    x_user_id:   xUser.x_user_id,
    today_count: dayCount,
    daily_limit: 3,
  }));
}

// ── /x/tweet ──────────────────────────────────────────────────────────────────
async function handleXTweet(request, env) {
  let body;
  try { body = await request.json(); } catch { return cors(JSON.stringify({ error: 'invalid json' }), 400); }

  const email = (body.email || '').trim().toLowerCase();
  const text  = (body.text  || '').trim();
  if (!email)   return cors(JSON.stringify({ error: 'email required' }), 400);
  if (!text)    return cors(JSON.stringify({ error: 'text required' }),  400);
  if (text.length > 280) return cors(JSON.stringify({ error: 'tweet too long' }), 400);

  const hash = await hashEmail(email);

  // 今日のシェア数チェック（JST）
  const jstDate  = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const dayKey   = `x_share_day:${hash}:${jstDate}`;
  const dayCount = parseInt(await env.PREMIUM_KV.get(dayKey) || '0', 10);
  if (dayCount >= 3) {
    return cors(JSON.stringify({ ok: false, reason: 'daily_limit_reached', today_count: dayCount, daily_limit: 3 }), 429);
  }

  // アクセストークン取得（有効期限切れの場合はリフレッシュ）
  let accessToken = null;
  const tokenRecord = await env.PREMIUM_KV.get(`x_token:${hash}`, 'json');
  if (tokenRecord) {
    accessToken = tokenRecord.access_token;
  } else {
    // トークン期限切れ → リフレッシュを試みる
    const refreshRecord = await env.PREMIUM_KV.get(`x_refresh:${hash}`, 'json');
    if (!refreshRecord) {
      return cors(JSON.stringify({ ok: false, reason: 'not_connected' }), 401);
    }
    const refreshed = await refreshXToken(refreshRecord.refresh_token, env.X_CLIENT_ID, env.X_CLIENT_SECRET);
    if (!refreshed || refreshed.error) {
      return cors(JSON.stringify({ ok: false, reason: 'token_refresh_failed', reconnect_required: true }), 401);
    }
    accessToken = refreshed.access_token;
    // 新しいトークンを保存
    await env.PREMIUM_KV.put(`x_token:${hash}`, JSON.stringify({
      x_user_id:    refreshRecord.x_user_id,
      x_username:   refreshRecord.x_username,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || refreshRecord.refresh_token,
    }), { expirationTtl: (refreshed.expires_in || 7200) + 300 });
    if (refreshed.refresh_token) {
      await env.PREMIUM_KV.put(`x_refresh:${hash}`, JSON.stringify({
        ...refreshRecord,
        refresh_token: refreshed.refresh_token,
      }), { expirationTtl: 30 * 24 * 3600 });
    }
  }

  // ツイート投稿
  const tweetRes = await fetch('https://api.twitter.com/2/tweets', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (tweetRes.status === 401) {
    // アクセストークンが無効 → 再接続を促す
    await env.PREMIUM_KV.delete(`x_token:${hash}`);
    return cors(JSON.stringify({ ok: false, reason: 'auth_failed', reconnect_required: true }), 401);
  }

  const tweetData = await tweetRes.json();
  if (!tweetRes.ok || !tweetData.data?.id) {
    const errMsg = tweetData.detail || tweetData.errors?.[0]?.message || 'tweet failed';
    return cors(JSON.stringify({ ok: false, reason: errMsg }), 500);
  }

  const tweetId = tweetData.data.id;

  // 今日のカウントを更新
  await env.PREMIUM_KV.put(dayKey, String(dayCount + 1), { expirationTtl: 48 * 3600 });

  // ポイント付与（1pt/ツイート）
  await addPoints(env.PREMIUM_KV, email, 'x_share', 1, `Xでシェア (${jstDate})`, null);

  return cors(JSON.stringify({
    ok:             true,
    tweet_id:       tweetId,
    tweet_url:      `https://x.com/i/web/status/${tweetId}`,
    points_awarded: 1,
    today_count:    dayCount + 1,
    daily_limit:    3,
  }));
}

// ── /x/disconnect ─────────────────────────────────────────────────────────────
async function handleXDisconnect(request, env) {
  let body;
  try { body = await request.json(); } catch { return cors(JSON.stringify({ error: 'invalid json' }), 400); }

  const email = (body.email || '').trim().toLowerCase();
  if (!email) return cors(JSON.stringify({ error: 'email required' }), 400);

  const hash = await hashEmail(email);
  await Promise.all([
    env.PREMIUM_KV.delete(`x_token:${hash}`),
    env.PREMIUM_KV.delete(`x_refresh:${hash}`),
    env.PREMIUM_KV.delete(`x_user:${hash}`),
  ]);

  return cors(JSON.stringify({ ok: true }));
}

// ── X token refresh helper ────────────────────────────────────────────────────
async function refreshXToken(refreshToken, clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     clientId,
  });
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: body.toString(),
  });
  return res.json();
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function hashEmail(email) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(email.toLowerCase().trim()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

async function makeRefCode(email) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode('habio-ref-v1:' + email.toLowerCase().trim()));
  const arr = Array.from(new Uint8Array(buf));
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  return 'HABIO-' + Array.from({ length: 6 }, (_, i) => chars[arr[i] % chars.length]).join('');
}

async function getOrCreateUser(kv, email) {
  const hash = await hashEmail(email);
  const key = `u:${hash}`;
  let user = await kv.get(key, 'json');
  if (!user) {
    const code = await makeRefCode(email);
    user = { email, hash, referral_code: code, total_points: 0, created_at: new Date().toISOString() };
    await kv.put(key, JSON.stringify(user));
    await kv.put(`rc:${code}`, JSON.stringify({ owner_email: email, owner_hash: hash }));
  }
  return user;
}

async function addPoints(kv, email, type, points, description, relatedEmail = null) {
  const hash = await hashEmail(email);
  const key = `u:${hash}`;
  const user = await kv.get(key, 'json');
  if (!user) return;

  user.total_points = (user.total_points || 0) + points;
  await kv.put(key, JSON.stringify(user));

  const logKey = `pts:log:${hash}`;
  const log = (await kv.get(logKey, 'json')) || [];
  log.unshift({ type, points, description, related_email: relatedEmail, created_at: new Date().toISOString() });
  await kv.put(logKey, JSON.stringify(log.slice(0, 50)));
}

async function recordPremiumStart(env, email) {
  const hash = await hashEmail(email);
  const key = `u:${hash}`;
  const user = await getOrCreateUser(env.PREMIUM_KV, email);
  if (!user.premium_started_at) {
    user.premium_started_at = new Date().toISOString();
    await env.PREMIUM_KV.put(key, JSON.stringify(user));
  }
}

async function checkAndAwardPremiumReferral(env, email) {
  const referredHash = await hashEmail(email);
  const referredUser = await env.PREMIUM_KV.get(`u:${referredHash}`, 'json');
  if (!referredUser?.referred_by || !referredUser?.premium_started_at) return;

  const referrerEmail = referredUser.referred_by;
  const referrerHash  = await hashEmail(referrerEmail);
  const refKey = `ref:${referrerHash}:${referredHash}`;
  const refRecord = await env.PREMIUM_KV.get(refKey, 'json');
  if (!refRecord || refRecord.premium_rewarded) return;

  // Condition 1: premium registered within 7 days of referral
  const referralAt = new Date(refRecord.created_at);
  const premiumAt  = new Date(referredUser.premium_started_at);
  if ((premiumAt - referralAt) / 86400000 > 7) return;

  // Condition 2: 7+ days have passed since premium started (first invoice.paid = trial end)
  const now = new Date();
  if ((now - premiumAt) / 86400000 < 7) return;

  // Award premium referral rewards
  await addPoints(env.PREMIUM_KV, referrerEmail, 'referral_premium_referrer', 100, `${email} さんがプレミアム7日間継続`, email);
  await addPoints(env.PREMIUM_KV, email,          'referral_premium_referred',  50, `プレミアム7日間継続ボーナス`,    referrerEmail);

  // Mark rewarded
  refRecord.premium_rewarded    = true;
  refRecord.premium_qualified_at = now.toISOString();
  refRecord.status               = 'premium_qualified';
  await env.PREMIUM_KV.put(refKey, JSON.stringify(refRecord));

  // Update referrer's list entry
  const listKey = `refs:by:${referrerHash}`;
  const list = (await env.PREMIUM_KV.get(listKey, 'json')) || [];
  const idx = list.findIndex(r => r.referred_hash === referredHash);
  if (idx >= 0) { list[idx].premium_rewarded = true; await env.PREMIUM_KV.put(listKey, JSON.stringify(list)); }
}

async function setPremium(env, email, active) {
  const key = `premium:${email.trim().toLowerCase()}`;
  if (active) {
    await env.PREMIUM_KV.put(key, '1', { expirationTtl: 60 * 60 * 24 * 400 });
  } else {
    await env.PREMIUM_KV.delete(key);
  }
}

function extractEmail(event) {
  const obj = event.data?.object;
  if (!obj) return null;
  if (obj.customer_email) return obj.customer_email.toLowerCase();
  if (obj.metadata?.email) return obj.metadata.email.toLowerCase();
  return null;
}

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) throw new Error('no signature');

  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) throw new Error('malformed signature');

  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) throw new Error('timestamp out of tolerance');

  const signedPayload = `${timestamp}.${payload}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (hex !== v1) throw new Error('signature mismatch');

  return JSON.parse(payload);
}
