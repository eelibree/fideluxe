// functions/api/auth/session.js
// GET /api/auth/session → verifica il cookie di sessione e restituisce il ruolo
import { verifySession } from '../../_middleware.js';

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export const onRequestGet = async ({ request, env }) => {
  const token = getCookie(request, 'fideluxe_session');
  const session = await verifySession(env.SESSION_SECRET, token);

  if (!session) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, role: session.role }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
