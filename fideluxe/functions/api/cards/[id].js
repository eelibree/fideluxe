// functions/api/cards/[id].js
// GET    /api/cards/:id        → leggi tessera (user+admin)
// PUT    /api/cards/:id        → aggiorna tessera (admin; user può solo toggle preferita)
// DELETE /api/cards/:id        → elimina tessera (admin)

const CARDS_KEY = 'cards:index';

async function getCards(env) {
  const raw = await env.FIDELUXE_KV.get(CARDS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
async function saveCards(env, cards) {
  await env.FIDELUXE_KV.put(CARDS_KEY, JSON.stringify(cards));
}

export const onRequestGet = async ({ params, env }) => {
  const cards = await getCards(env);
  const card = cards.find(c => c.id === params.id);
  if (!card) return json({ error: 'not_found' }, 404);
  return json(card);
};

export const onRequestPut = async ({ request, params, env, data }) => {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_body' }, 400); }

  const cards = await getCards(env);
  const idx = cards.findIndex(c => c.id === params.id);
  if (idx === -1) return json({ error: 'not_found' }, 404);

  // user: può aggiornare SOLO il flag preferita
  if (data.session.role !== 'admin') {
    if (typeof body.preferita !== 'boolean' || Object.keys(body).length !== 1) {
      return json({ error: 'forbidden' }, 403);
    }
    cards[idx].preferita = body.preferita;
    await saveCards(env, cards);
    return json(cards[idx]);
  }

  // admin: aggiornamento completo
  cards[idx] = {
    ...cards[idx],
    nome: body.nome !== undefined ? String(body.nome).trim() : cards[idx].nome,
    numero: body.numero !== undefined ? String(body.numero).trim() : cards[idx].numero,
    barcode: body.barcode !== undefined ? String(body.barcode).trim() : cards[idx].barcode,
    barcodeType: body.barcodeType !== undefined ? body.barcodeType : cards[idx].barcodeType,
    barcodeImage: body.barcodeImage !== undefined ? body.barcodeImage : cards[idx].barcodeImage,
    categoria: body.categoria !== undefined ? String(body.categoria).trim() : cards[idx].categoria,
    logo: body.logo !== undefined ? body.logo : cards[idx].logo,
    note: body.note !== undefined ? String(body.note).trim() : cards[idx].note,
    preferita: body.preferita !== undefined ? Boolean(body.preferita) : cards[idx].preferita,
  };
  await saveCards(env, cards);
  return json(cards[idx]);
};

export const onRequestDelete = async ({ params, env, data }) => {
  if (data.session.role !== 'admin') return json({ error: 'forbidden' }, 403);
  const cards = await getCards(env);
  const filtered = cards.filter(c => c.id !== params.id);
  if (filtered.length === cards.length) return json({ error: 'not_found' }, 404);
  await saveCards(env, filtered);
  return json({ ok: true });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
