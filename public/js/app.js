// public/js/app.js — logica principale app
(function () {
  'use strict';

  const state = {
    role: null,            // 'user' | 'admin' | null
    cards: [],
    categories: [],
    filter: { search: '', category: null, favOnly: false },
    selectedId: null,
  };

  const app = {
    get cards()      { return state.cards; },
    set cards(v)     { state.cards = v; },
    get categories() { return state.categories; },
    set categories(v){ state.categories = v; },
    renderCards,
    renderCategories,
    showApp,
    reloadData,
    toast,
  };

  // ============ INIT ============
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // Service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    bindGlobalEvents();
    Admin.init(app);

    // Prova a recuperare sessione
    try {
      const s = await API.session();
      if (s.ok) {
        state.role = s.role;
        await reloadData();
        showApp();
      } else {
        showLogin();
      }
    } catch {
      showLogin();
    }
  }

  // ============ NAVIGATION ============
  function showLogin() {
    hide('screen-app'); hide('screen-admin');
    show('screen-login');
    document.getElementById('login-password').focus();
  }

  function showApp() {
    hide('screen-login'); hide('screen-admin');
    show('screen-app');
    // il pulsante Admin è sempre visibile quando si è loggati:
    // apre il pannello se già admin, altrimenti mostra il prompt password
    document.getElementById('btn-admin').style.display = '';
    renderCategories();
    renderCards();
  }

  function showAdmin() {
    hide('screen-app'); hide('screen-login');
    show('screen-admin');
    Admin.render(app);
  }

  // ============ EVENTS ============
  function bindGlobalEvents() {
    // Login
    document.getElementById('form-login').addEventListener('submit', onLogin);

    // Admin login modale
    document.getElementById('btn-admin').addEventListener('click', onAdminBtn);
    document.getElementById('form-admin-login').addEventListener('submit', onAdminLogin);

    // Logout
    document.getElementById('btn-logout').addEventListener('click', onLogout);

    // Search + filtri
    document.getElementById('search-input').addEventListener('input', (e) => {
      state.filter.search = e.target.value.toLowerCase();
      renderCards();
    });
    document.getElementById('btn-filter-fav').addEventListener('click', () => {
      state.filter.favOnly = !state.filter.favOnly;
      document.getElementById('btn-filter-fav').setAttribute('aria-pressed', state.filter.favOnly);
      renderCards();
    });

    // Azioni nel dettaglio
    document.getElementById('detail-fav').addEventListener('click', onToggleFavFromDetail);
    document.getElementById('detail-copy').addEventListener('click', onCopyNumber);
    document.getElementById('detail-cassa').addEventListener('click', onCassaOpen);

    // Chiusura modali (backdrop + tasto X)
    document.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', (e) => {
        const modal = e.currentTarget.closest('.modal');
        if (modal) {
          modal.hidden = true;
          // ferma scanner se chiuso
          if (modal.id === 'modal-scanner') Scanner.stop();
        }
      });
    });

    // Chiusura cassa cliccando sul barcode container (UX semplice)
    document.getElementById('modal-cassa').addEventListener('click', (e) => {
      if (!e.target.closest('.cassa__barcode') && !e.target.closest('.cassa__close')) {
        hide('modal-cassa');
      }
    });
  }

  // ============ LOGIN ============
  async function onLogin(e) {
    e.preventDefault();
    const pwd = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.hidden = true;
    try {
      const res = await API.login(pwd);
      state.role = res.role;
      document.getElementById('login-password').value = '';
      await reloadData();
      showApp();
    } catch (err) {
      errEl.textContent = err.status === 401 ? 'Password errata.' : 'Errore di accesso.';
      errEl.hidden = false;
    }
  }

  function onAdminBtn() {
    if (state.role === 'admin') {
      showAdmin();
    } else {
      show('modal-admin-login');
      document.getElementById('admin-password').focus();
    }
  }

  async function onAdminLogin(e) {
    e.preventDefault();
    const pwd = document.getElementById('admin-password').value;
    const errEl = document.getElementById('admin-login-error');
    errEl.hidden = true;
    try {
      const res = await API.login(pwd);
      if (res.role !== 'admin') throw new Error('not_admin');
      state.role = 'admin';
      document.getElementById('admin-password').value = '';
      hide('modal-admin-login');
      await reloadData();
      showAdmin();
    } catch (err) {
      errEl.textContent = err.message === 'not_admin' ? 'Questa password non dà accesso admin.' : 'Password errata.';
      errEl.hidden = false;
    }
  }

  async function onLogout() {
    try { await API.logout(); } catch {}
    state.role = null;
    state.cards = []; state.categories = [];
    showLogin();
  }

  // ============ DATA ============
  async function reloadData() {
    try {
      const [cards, cats] = await Promise.all([API.listCards(), API.listCategories()]);
      state.cards = cards;
      state.categories = cats;
    } catch (e) {
      console.error('reloadData', e);
    }
  }

  // ============ RENDER: categorie ============
  function renderCategories() {
    const bar = document.getElementById('categories-bar');
    bar.innerHTML = '';

    const allChip = document.createElement('button');
    allChip.className = 'cat-chip' + (state.filter.category === null ? ' active' : '');
    allChip.textContent = 'Tutte';
    allChip.addEventListener('click', () => { state.filter.category = null; renderCategories(); renderCards(); });
    bar.appendChild(allChip);

    state.categories.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'cat-chip' + (state.filter.category === cat.id ? ' active' : '');
      chip.innerHTML = `<span class="cat-chip__dot" style="background:${cat.colore}"></span>${escapeHtml(cat.nome)}`;
      chip.addEventListener('click', () => {
        state.filter.category = state.filter.category === cat.id ? null : cat.id;
        renderCategories(); renderCards();
      });
      bar.appendChild(chip);
    });
  }

  // ============ RENDER: tessere ============
  function renderCards() {
    const list = document.getElementById('cards-list');
    const empty = document.getElementById('empty-state');
    list.innerHTML = '';

    const catsById = new Map(state.categories.map(c => [c.id, c]));

    const filtered = state.cards.filter(card => {
      if (state.filter.favOnly && !card.preferita) return false;
      if (state.filter.category && card.categoria !== state.filter.category) return false;
      const q = state.filter.search;
      if (q) {
        const cat = catsById.get(card.categoria);
        const hay = `${card.nome} ${card.numero} ${cat?.nome || ''} ${card.note || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // ordine: preferite prime, poi alfabetico
    filtered.sort((a, b) => {
      if (a.preferita !== b.preferita) return a.preferita ? -1 : 1;
      return a.nome.localeCompare(b.nome, 'it');
    });

    if (!filtered.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    filtered.forEach(card => {
      const cat = catsById.get(card.categoria);
      const color = cat?.colore || '#B08D57';
      const tile = document.createElement('article');
      tile.className = 'card-tile';
      tile.style.setProperty('--tile-color', color);
      tile.setAttribute('role', 'listitem');
      tile.innerHTML = `
        <div class="card-tile__logo">
          ${card.logo
            ? `<img src="${card.logo}" alt="${escapeAttr(card.nome)}"/>`
            : `<span>${escapeHtml(card.nome.charAt(0).toUpperCase())}</span>`}
        </div>
        <div>
          <div class="card-tile__name">${escapeHtml(card.nome)}</div>
          <div class="card-tile__cat">${escapeHtml(cat?.nome || '—')}</div>
        </div>
        <button class="card-tile__fav ${card.preferita ? 'active' : ''}" aria-label="Preferita" aria-pressed="${card.preferita}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="${card.preferita ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6C19 16.5 12 21 12 21z"/>
          </svg>
        </button>`;

      tile.addEventListener('click', (e) => {
        if (e.target.closest('.card-tile__fav')) return;
        openDetail(card.id);
      });
      tile.querySelector('.card-tile__fav').addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleFav(card.id, !card.preferita);
      });

      list.appendChild(tile);
    });
  }

  // ============ DETAIL MODAL ============
  function openDetail(id) {
    const card = state.cards.find(c => c.id === id);
    if (!card) return;
    state.selectedId = id;

    const cat = state.categories.find(c => c.id === card.categoria);
    document.getElementById('detail-name').textContent = card.nome;
    const catPill = document.getElementById('detail-cat');
    if (cat) {
      catPill.textContent = cat.nome;
      catPill.style.background = cat.colore;
      catPill.style.display = '';
    } else {
      catPill.style.display = 'none';
    }

    const logoEl = document.getElementById('detail-logo');
    logoEl.innerHTML = card.logo
      ? `<img src="${card.logo}" alt="${escapeAttr(card.nome)}"/>`
      : `<span>${escapeHtml(card.nome.charAt(0).toUpperCase())}</span>`;

    Barcode.render(document.getElementById('detail-barcode'), card, { large: false });

    document.getElementById('detail-number').textContent = card.numero || '—';
    document.getElementById('detail-note').textContent = card.note || '';
    document.getElementById('detail-date').textContent = card.dataInserimento
      ? 'Aggiunta il ' + new Date(card.dataInserimento).toLocaleDateString('it-IT')
      : '';

    const favBtn = document.getElementById('detail-fav');
    favBtn.setAttribute('aria-pressed', card.preferita);

    show('modal-detail');
  }

  async function onToggleFavFromDetail() {
    if (!state.selectedId) return;
    const card = state.cards.find(c => c.id === state.selectedId);
    if (!card) return;
    await toggleFav(card.id, !card.preferita);
    document.getElementById('detail-fav').setAttribute('aria-pressed', card.preferita);
  }

  async function toggleFav(id, value) {
    try {
      const updated = await API.toggleFav(id, value);
      state.cards = state.cards.map(c => c.id === id ? updated : c);
      renderCards();
    } catch (e) { toast('Errore: ' + e.message, true); }
  }

  // ============ CASSA ============
  function onCassaOpen() {
    // La cassa si apre dal dettaglio → usa la tessera attualmente aperta
    if (!state.selectedId) { toast('Nessuna tessera selezionata'); return; }
    const card = state.cards.find(c => c.id === state.selectedId);
    if (!card) { toast('Tessera non trovata', true); return; }

    document.getElementById('cassa-name').textContent = card.nome;
    Barcode.render(document.getElementById('cassa-barcode'), card, { large: true });
    document.getElementById('cassa-number').textContent = card.numero || '';

    // Chiudo prima la modal dettaglio per un'animazione pulita
    hide('modal-detail');
    show('modal-cassa');

    // luminosità massima: tenta di richiedere wake lock
    try {
      if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(() => {});
    } catch {}
  }

  // ============ COPIA NUMERO ============
  async function onCopyNumber() {
    if (!state.selectedId) return;
    const card = state.cards.find(c => c.id === state.selectedId);
    if (!card) return;
    const num = card.numero || card.barcode || '';
    if (!num) { toast('Nessun numero da copiare'); return; }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(num);
      } else {
        // fallback per browser vecchi / contesti non sicuri
        const ta = document.createElement('textarea');
        ta.value = num;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast('Numero copiato: ' + num);
    } catch (e) {
      toast('Impossibile copiare', true);
    }
  }

  // ============ UTILS ============
  function show(id) { document.getElementById(id).hidden = false; }
  function hide(id) { document.getElementById(id).hidden = true;  }

  function toast(msg, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.toggle('toast--error', isError);
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.hidden = true, 2400);
  }

  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function escapeAttr(s) { return escapeHtml(s); }
})();
