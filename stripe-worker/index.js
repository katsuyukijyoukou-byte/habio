const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function cors(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/create-checkout') {
      return handleCreateCheckout(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/webhook') {
      return handleWebhook(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/verify') {
      return handleVerify(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/activate') {
      return handleActivate(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/cancel-subscription') {
      return handleCancelSubscription(request, env);
    }

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

  if (type === 'checkout.session.completed' || type === 'invoice.payment_succeeded') {
    const email = extractEmail(event);
    if (email) await setPremium(env, email, true);
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
  const isPremium = val === '1';

  return cors(JSON.stringify({ premium: isPremium }));
}

// ── /activate ─────────────────────────────────────────────────────────────────
// Called immediately after Stripe redirects to success URL.
// Retrieves the checkout session directly from Stripe (bypasses webhook timing).
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
  return cors(JSON.stringify({ premium: true, email }));
}

// ── /cancel-subscription ──────────────────────────────────────────────────────
async function handleCancelSubscription(request, env) {
  let body;
  try { body = await request.json(); } catch { return cors(JSON.stringify({ error: 'invalid json' }), 400); }

  const email = (body.email || '').trim().toLowerCase();
  if (!email) return cors(JSON.stringify({ error: 'email required' }), 400);

  // Stripe でメールアドレスからカスタマーを検索
  const custRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const custData = await custRes.json();
  const customer = custData.data?.[0];

  if (customer) {
    // active / trialing 両方を確認
    for (const status of ['active', 'trialing']) {
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=${status}&limit=1`,
        { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
      );
      const subData = await subRes.json();
      const sub = subData.data?.[0];
      if (sub) {
        // Stripe サブスクリプションをすぐにキャンセル（次回請求なし）
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

  // KV からプレミアム権限を削除
  await setPremium(env, email, false);
  return cors(JSON.stringify({ success: true }));
}

// ── helpers ───────────────────────────────────────────────────────────────────
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
  // checkout.session has customer_email or metadata.email
  if (obj.customer_email) return obj.customer_email.toLowerCase();
  if (obj.metadata?.email) return obj.metadata.email.toLowerCase();
  // invoice has customer_email
  if (obj.customer_email) return obj.customer_email.toLowerCase();
  return null;
}

// Stripe signature verification using Web Crypto (no Node.js required)
async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) throw new Error('no signature');

  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) throw new Error('malformed signature');

  // Reject if timestamp is more than 5 minutes old
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
