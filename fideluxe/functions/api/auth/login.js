// functions/api/auth/login.js
import { createSession } from '../../_middleware.js';

export const onRequestPost = async ({ request, env }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const { password } = body || {};
  if (!password || typeof password !== 'string') {
    return json({ error: 'missing_password' }, 400);
  }

  let role = null;
  if (password === env.ADMIN_PASSWORD) role = 'admin';
  else if (password === env.APP_PASSWORD) role = 'user';

  if (!role) {
    // piccolo delay per scoraggiare brute force
    await new Promise(r => setTimeout(r, 400));
    return json({ error: 'invalid_password' }, 401);
  }

  const token = await createSession(env.SESSION_SECRET, role);
  const cookie = [
    `fideluxe_session=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${30 * 24 * 60 * 60}`,
  ].join('; ');

  return new Response(JSON.stringify({ role }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
};

// GET restituisce stato sessione (è gestito dal middleware, quindi se
// arriviamo qui significa che la sessione è valida)
export const onRequestGet = async ({ data }) => {
  if (data?.session) {
    return json({ role: data.session.role });
  }
  return json({ role: null }, 401);
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
