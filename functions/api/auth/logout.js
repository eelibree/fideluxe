// functions/api/auth/logout.js
export const onRequestPost = async () => {
  const cookie = [
    'fideluxe_session=',
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Max-Age=0',
  ].join('; ');
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
};
