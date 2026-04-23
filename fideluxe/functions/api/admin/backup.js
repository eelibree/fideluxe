// functions/api/admin/backup.js
// GET  /api/admin/backup           → esporta JSON completo
// POST /api/admin/backup?mode=...  → importa JSON (mode=merge|replace)

const CARDS_KEY = 'cards:index';
const CATS_KEY = 'categories:index';

export const onRequestGet = async ({ env }) => {
  const [cardsRaw, catsRaw] = await Promise.all([
    env.FIDELUXE_KV.get(CARDS_KEY),
    env.FIDELUXE_KV.get(CATS_KEY),
  ]);
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: cardsRaw ? JSON.parse(cardsRaw) : [],
    categories: catsRaw ? JSON.parse(catsRaw) : [],
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="fideluxe-backup-${Date.now()}.json"`,
    },
  });
};

export const onRequestPost = async ({ request, env }) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'merge';
  if (!['merge', 'replace'].includes(mode)) {
    return json({ error: 'invalid_mode' }, 400);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_body' }, 400); }
  if (!body || !Array.isArray(body.cards) || !Array.isArray(body.categories)) {
    return json({ error: 'invalid_backup_format' }, 400);
  }

  if (mode === 'replace') {
    await Promise.all([
      env.FIDELUXE_KV.put(CARDS_KEY, JSON.stringify(body.cards)),
      env.FIDELUXE_KV.put(CATS_KEY, JSON.stringify(body.categories)),
    ]);
    return json({ ok: true, mode, cards: body.cards.length, categories: body.categories.length });
  }

  // merge: per ID, i nuovi sovrascrivono i vecchi
  const [cardsRaw, catsRaw] = await Promise.all([
    env.FIDELUXE_KV.get(CARDS_KEY),
    env.FIDELUXE_KV.get(CATS_KEY),
  ]);
  const existingCards = cardsRaw ? JSON.parse(cardsRaw) : [];
  const existingCats = catsRaw ? JSON.parse(catsRaw) : [];

  const mergedCards = mergeById(existingCards, body.cards);
  const mergedCats = mergeById(existingCats, body.categories);

  await Promise.all([
    env.FIDELUXE_KV.put(CARDS_KEY, JSON.stringify(mergedCards)),
    env.FIDELUXE_KV.put(CATS_KEY, JSON.stringify(mergedCats)),
  ]);
  return json({ ok: true, mode, cards: mergedCards.length, categories: mergedCats.length });
};

function mergeById(existing, incoming) {
  const map = new Map(existing.map(x => [x.id, x]));
  for (const item of incoming) {
    if (item && item.id) map.set(item.id, item);
  }
  return Array.from(map.values());
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
