// functions/api/cards/index.js
// GET  /api/cards       → lista tessere
// POST /api/cards       → crea nuova tessera

const CARDS_KEY = 'cards:index';

async function getCards(env) {
  const raw = await env.FIDELUXE_KV.get(CARDS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function saveCards(env, cards) {
  await env.FIDELUXE_KV.put(CARDS_KEY, JSON.stringify(cards));
}

export const onRequestGet = async ({ env }) => {
  const cards = await getCards(env);
  return json(cards);
};

export const onRequestPost = async ({ request, env, data }) => {
  if (data.session.role !== 'admin') return json({ error: 'forbidden' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_body' }, 400); }

  const card = normalizeCard(body);
  if (!card.nome) return json({ error: 'nome_required' }, 400);

  card.id = crypto.randomUUID();
  card.dataInserimento = new Date().toISOString();

  const cards = await getCards(env);
  cards.push(card);
  await saveCards(env, cards);

  return json(card, 201);
};

function normalizeCard(input) {
  return {
    nome: String(input.nome || '').trim(),
    numero: String(input.numero || '').trim(),
    barcode: String(input.barcode || '').trim(),
    barcodeType: input.barcodeType || 'CODE128', // CODE128, EAN13, QR, IMAGE
    barcodeImage: input.barcodeImage || null,    // data URL se uploaded
    categoria: String(input.categoria || '').trim(),
    logo: input.logo || null,                     // data URL
    note: String(input.note || '').trim(),
    preferita: Boolean(input.preferita),
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
