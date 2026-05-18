// GET /api/auth/x/start?email=xxx
// PKCEコード生成 → X認証URLへリダイレクト

export async function onRequestGet({ request, env }) {
  const url   = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('email required', { status: 400 });
  }

  if (!env.X_CLIENT_ID) {
    return new Response('X_CLIENT_ID not configured', { status: 500 });
  }

  // PKCE + state 生成（すべてサーバー側で生成してKVに保存）
  const verifier   = generateVerifier();
  const challenge  = await generateChallenge(verifier);
  const state      = generateState();

  // state と verifier を10分間 KV に保存
  await env.PREMIUM_KV.put(
    `x_state:${state}`,
    JSON.stringify({ email, code_verifier: verifier }),
    { expirationTtl: 600 }
  );

  const redirectUri = env.X_REDIRECT_URI || 'https://habio.pages.dev/api/auth/x/callback';
  const scopes      = env.X_SCOPES       || 'tweet.read tweet.write users.read offline.access';

  // X OAuth 2.0 認証URL構築
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type',          'code');
  authUrl.searchParams.set('client_id',              env.X_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri',           redirectUri);
  authUrl.searchParams.set('scope',                  scopes);
  authUrl.searchParams.set('state',                  state);
  authUrl.searchParams.set('code_challenge',         challenge);
  authUrl.searchParams.set('code_challenge_method',  'S256');

  return Response.redirect(authUrl.toString(), 302);
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateChallenge(verifier) {
  const enc    = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateState() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
