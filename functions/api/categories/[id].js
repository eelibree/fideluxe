// functions/api/categories/[id].js
const CATS_KEY = 'categories:index';

async function getCategories(env) {
  const raw = await env.FIDELUXE_KV.get(CATS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
async function saveCategories(env, cats) {
  await env.FIDELUXE_KV.put(CATS_KEY, JSON.stringify(cats));
}

export const onRequestPut = async ({ request, params, env, data }) => {
  if (data.session.role !== 'admin') return json({ error: 'forbidden' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_body' }, 400); }

  const cats = await getCategories(env);
  const idx = cats.findIndex(c => c.id === params.id);
  if (idx === -1) return json({ error: 'not_found' }, 404);

  if (body.nome !== undefined) cats[idx].nome = String(body.nome).trim();
  if (body.colore !== undefined) cats[idx].colore = String(body.colore).trim();

  await saveCategories(env, cats);
  return json(cats[idx]);
};

export const onRequestDelete = async ({ params, env, data }) => {
  if (data.session.role !== 'admin') return json({ error: 'forbidden' }, 403);
  const cats = await getCategories(env);
  const filtered = cats.filter(c => c.id !== params.id);
  if (filtered.length === cats.length) return json({ error: 'not_found' }, 404);
  await saveCategories(env, filtered);
  return json({ ok: true });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
