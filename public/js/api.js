// public/js/api.js — wrapper minimale sulle Pages Functions
(function (global) {
  async function request(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
    const isJson = (res.headers.get('Content-Type') || '').includes('application/json');
    const payload = isJson ? await res.json().catch(() => null) : await res.text();
    if (!res.ok) {
      const msg = isJson && payload?.error ? payload.error : `HTTP ${res.status}`;
      const err = new Error(msg); err.status = res.status; err.payload = payload;
      throw err;
    }
    return payload;
  }

  const API = {
    // auth
    login:   (password) => request('/api/auth/login',   { method: 'POST', body: JSON.stringify({ password }) }),
    logout:  ()         => request('/api/auth/logout',  { method: 'POST' }),
    session: ()         => request('/api/auth/session'),

    // cards
    listCards:   ()      => request('/api/cards'),
    getCard:     (id)    => request(`/api/cards/${id}`),
    createCard:  (data)  => request('/api/cards',       { method: 'POST',   body: JSON.stringify(data) }),
    updateCard:  (id, d) => request(`/api/cards/${id}`, { method: 'PUT',    body: JSON.stringify(d) }),
    deleteCard:  (id)    => request(`/api/cards/${id}`, { method: 'DELETE' }),
    toggleFav:   (id, v) => request(`/api/cards/${id}`, { method: 'PUT',    body: JSON.stringify({ preferita: v }) }),

    // categories
    listCategories: ()      => request('/api/categories'),
    createCategory: (d)     => request('/api/categories',        { method: 'POST',   body: JSON.stringify(d) }),
    updateCategory: (id, d) => request(`/api/categories/${id}`,  { method: 'PUT',    body: JSON.stringify(d) }),
    deleteCategory: (id)    => request(`/api/categories/${id}`,  { method: 'DELETE' }),

    // backup
    exportBackup: ()          => fetch('/api/admin/backup', { credentials: 'same-origin' }),
    importBackup: (data, mode)=> request(`/api/admin/backup?mode=${mode}`, { method: 'POST', body: JSON.stringify(data) }),
  };

  global.API = API;
})(window);
