// functions/_middleware.js
// Verifica la sessione su tutte le rotte /api/* tranne /api/auth/login

const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/logout', '/api/auth/session'];

// ---- helpers HMAC per session token firmato ----
async function hmacSign(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createSession(secret, role) {
  // Token: base64url(JSON{role,exp}).signature — valido 30 giorni
  const payload = {
    role,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
}

export async function verifySession(secret, token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = await hmacSign(secret, body);
  if (expected !== sig) return null;
  try {
    const pad = '='.repeat((4 - body.length % 4) % 4);
    const json = atob(body.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const payload = JSON.parse(json);
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export const onRequest = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Solo le rotte /api/* passano da qui (le altre sono statiche)
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  // Rotte pubbliche
  if (PUBLIC_PATHS.includes(url.pathname)) {
    return next();
  }

  const token = getCookie(request, 'fideluxe_session');
  const session = await verifySession(env.SESSION_SECRET, token);

  if (!session) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rotte admin: richiedono role === 'admin'
  if (url.pathname.startsWith('/api/admin/') && session.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Allego la sessione al context per le rotte downstream
  context.data = { ...context.data, session };
  return next();
};
