// GET /api/auth/x/callback?code=xxx&state=xxx
// X OAuth 2.0 認証コールバック: コード交換 → トークン保存 → /app へリダイレクト

export async function onRequestGet({ request, env }) {
  const url   = new URL(request.url);
  const code  = url.searchParams.get('code')  || '';
  const state = url.searchParams.get('state') || '';
  const error = url.searchParams.get('error') || '';

  const APP_URL = 'https://habio.pages.dev/app';

  if (error) {
    return Response.redirect(`${APP_URL}?x_error=${encodeURIComponent(error)}`, 302);
  }

  if (!code || !state) {
    return Response.redirect(`${APP_URL}?x_error=missing_params`, 302);
  }

  // KV から state を検証 + verifier を取得
  const stored = await env.PREMIUM_KV.get(`x_state:${state}`, 'json');
  if (!stored) {
    return Response.redirect(`${APP_URL}?x_error=invalid_state`, 302);
  }

  // 使用済みの state を即削除（リプレイ攻撃防止）
  await env.PREMIUM_KV.delete(`x_state:${state}`);

  const { email, code_verifier } = stored;

  const redirectUri = env.X_REDIRECT_URI || 'https://habio.pages.dev/api/auth/x/callback';

  // Authorization Code → Access Token 交換
  let tokenData;
  try {
    tokenData = await exchangeCodeForToken({
      code,
      code_verifier,
      redirect_uri: redirectUri,
      client_id:     env.X_CLIENT_ID,
      client_secret: env.X_CLIENT_SECRET,
    });
  } catch (err) {
    console.error('Token exchange failed:', err);
    return Response.redirect(`${APP_URL}?x_error=token_exchange_failed`, 302);
  }

  if (tokenData.error) {
    return Response.redirect(
      `${APP_URL}?x_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`,
      302
    );
  }

  // ユーザー情報取得 (username / id)
  let xUser;
  try {
    xUser = await fetchXUser(tokenData.access_token);
  } catch (err) {
    console.error('User fetch failed:', err);
    return Response.redirect(`${APP_URL}?x_error=user_fetch_failed`, 302);
  }

  // emailのハッシュ（stripe-workerと同じロジック）
  const hash = await hashEmail(email);

  // X連携情報を KV に保存（7日TTLで refresh_token もセット）
  const xRecord = {
    x_user_id:     xUser.id,
    x_username:    xUser.username,
    access_token:  tokenData.access_token,
    refresh_token: tokenData.refresh_token || null,
    connected_at:  new Date().toISOString(),
  };

  // アクセストークンの有効期限（2時間）
  const tokenTtl = tokenData.expires_in ? Number(tokenData.expires_in) : 7200;

  await Promise.all([
    // x_token:{hash} にアクセストークン（有効期限+バッファ）
    env.PREMIUM_KV.put(
      `x_token:${hash}`,
      JSON.stringify(xRecord),
      { expirationTtl: tokenTtl + 300 }
    ),
    // x_refresh:{hash} にリフレッシュトークン（30日）
    tokenData.refresh_token
      ? env.PREMIUM_KV.put(
          `x_refresh:${hash}`,
          JSON.stringify({ refresh_token: tokenData.refresh_token, x_user_id: xUser.id, x_username: xUser.username }),
          { expirationTtl: 30 * 24 * 3600 }
        )
      : Promise.resolve(),
    // x_user:{hash} にユーザー基本情報（30日）
    env.PREMIUM_KV.put(
      `x_user:${hash}`,
      JSON.stringify({ x_user_id: xUser.id, x_username: xUser.username, connected_at: xRecord.connected_at }),
      { expirationTtl: 30 * 24 * 3600 }
    ),
  ]);

  return Response.redirect(
    `${APP_URL}?x_connected=1&x_username=${encodeURIComponent(xUser.username)}`,
    302
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function exchangeCodeForToken({ code, code_verifier, redirect_uri, client_id, client_secret }) {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri,
    code_verifier,
    client_id,
  });

  // Basic認証ヘッダー (client_id:client_secret の Base64)
  const credentials = btoa(`${client_id}:${client_secret}`);

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

async function fetchXUser(accessToken) {
  const res = await fetch('https://api.twitter.com/2/users/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!data.data) throw new Error('No user data returned');
  return data.data; // { id, name, username }
}

async function hashEmail(email) {
  const enc    = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(email));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
