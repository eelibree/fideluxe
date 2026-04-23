// functions/api/categories/index.js
// GET  /api/categories  → lista
// POST /api/categories  → crea (admin)

const CATS_KEY = 'categories:index';

const DEFAULT_CATEGORIES = [
  { id: 'supermercato', nome: 'Supermercato', colore: '#8A9A5B' },
  { id: 'abbigliamento', nome: 'Abbigliamento', colore: '#B08D57' },
  { id: 'farmacia', nome: 'Farmacia', colore: '#C97B63' },
  { id: 'ristorazione', nome: 'Ristorazione', colore: '#A67B5B' },
  { id: 'altro', nome: 'Altro', colore: '#9B9B9B' },
];

async function getCategories(env) {
  const raw = await env.FIDELUXE_KV.get(CATS_KEY);
  if (!raw) {
    await env.FIDELUXE_KV.put(CATS_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES;
  }
  try { return JSON.parse(raw); } catch { return DEFAULT_CATEGORIES; }
}
async function saveCategories(env, cats) {
  await env.FIDELUXE_KV.put(CATS_KEY, JSON.stringify(cats));
}

export const onRequestGet = async ({ env }) => {
  const cats = await getCategories(env);
  return json(cats);
};

export const onRequestPost = async ({ request, env, data }) => {
  if (data.session.role !== 'admin') return json({ error: 'forbidden' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_body' }, 400); }

  const nome = String(body.nome || '').trim();
  const colore = String(body.colore || '#9B9B9B').trim();
  if (!nome) return json({ error: 'nome_required' }, 400);

  const cats = await getCategories(env);
  const id = slugify(nome) + '-' + Math.random().toString(36).slice(2, 6);
  const newCat = { id, nome, colore };
  cats.push(newCat);
  await saveCategories(env, cats);
  return json(newCat, 201);
};

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cat';
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
