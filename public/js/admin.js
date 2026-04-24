// public/js/admin.js — pannello amministrazione
(function (global) {

  const state = {
    editing: null, // id tessera in modifica, null se nuova
  };

  // ============ INIT ============
  function init(app) {
    // Tabs
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.tab));
    });

    // Pulsante indietro
    document.getElementById('btn-admin-back').addEventListener('click', () => {
      app.showApp();
    });

    // Nuova tessera
    document.getElementById('btn-new-card').addEventListener('click', () => openCardForm(null, app));

    // Form tessera
    document.getElementById('form-card').addEventListener('submit', (e) => onCardSubmit(e, app));
    document.getElementById('btn-card-delete').addEventListener('click', () => onCardDelete(app));

    // Barcode type change
    document.getElementById('f-barcode-type').addEventListener('change', onBarcodeTypeChange);
    document.getElementById('f-barcode').addEventListener('input', updateBarcodePreview);
    document.getElementById('f-barcode-image').addEventListener('change', onBarcodeImageUpload);
    document.getElementById('f-logo').addEventListener('change', onLogoUpload);

    // Scanner
    document.getElementById('btn-scan').addEventListener('click', () => openScanner());

    // Categorie
    document.getElementById('form-new-cat').addEventListener('submit', (e) => onCatSubmit(e, app));

    // Backup
    document.getElementById('btn-export').addEventListener('click', onExport);
    document.getElementById('btn-import').addEventListener('click', () => onImport(app));

    // Espone la funzione openCardForm così il FAB nella home può aprirla direttamente
    app.openCardForm = (id) => openCardForm(id, app);
  }

  // ============ TABS ============
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.hidden = (p.dataset.panel !== name));
  }

  // ============ RENDER ADMIN LISTS ============
  function render(app) {
    renderAdminCards(app);
    renderAdminCats(app);
  }

  function renderAdminCards(app) {
    const list = document.getElementById('admin-cards-list');
    list.innerHTML = '';
    if (!app.cards.length) {
      list.innerHTML = '<p class="hint">Nessuna tessera. Aggiungine una col pulsante qui sopra.</p>';
      return;
    }
    const catsById = new Map(app.categories.map(c => [c.id, c]));
    app.cards.forEach(card => {
      const cat = catsById.get(card.categoria);
      const item = document.createElement('div');
      item.className = 'admin-item';
      item.innerHTML = `
        <div class="admin-item__info">
          <span class="admin-item__swatch" style="background:${cat?.colore || '#9B9B9B'}"></span>
          <div>
            <div class="admin-item__name">${escapeHtml(card.nome)}</div>
            <div class="admin-item__sub">${escapeHtml(cat?.nome || '—')} · ${escapeHtml(card.numero || 'no num')}</div>
          </div>
        </div>
        <div class="admin-item__actions">
          <button data-edit="${card.id}" title="Modifica">✎</button>
          <button data-del="${card.id}" class="danger" title="Elimina">🗑</button>
        </div>`;
      item.querySelector('[data-edit]').addEventListener('click', () => openCardForm(card.id, app));
      item.querySelector('[data-del]').addEventListener('click', async () => {
        if (!confirm(`Eliminare "${card.nome}"?`)) return;
        try {
          await API.deleteCard(card.id);
          app.cards = app.cards.filter(c => c.id !== card.id);
          render(app); app.renderCards();
          app.toast('Tessera eliminata');
        } catch (e) { app.toast('Errore: ' + e.message, true); }
      });
      list.appendChild(item);
    });
  }

  function renderAdminCats(app) {
    const list = document.getElementById('admin-cats-list');
    list.innerHTML = '';
    if (!app.categories.length) {
      list.innerHTML = '<p class="hint">Nessuna categoria.</p>';
      return;
    }
    app.categories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'admin-item';
      item.innerHTML = `
        <div class="admin-item__info">
          <input type="color" value="${cat.colore}" data-color="${cat.id}" style="width:36px;height:36px;padding:2px;" />
          <input type="text" value="${escapeAttr(cat.nome)}" data-name="${cat.id}" />
        </div>
        <div class="admin-item__actions">
          <button data-save="${cat.id}" title="Salva">✓</button>
          <button data-del="${cat.id}" class="danger" title="Elimina">🗑</button>
        </div>`;
      item.querySelector('[data-save]').addEventListener('click', async () => {
        const nome = item.querySelector(`[data-name="${cat.id}"]`).value.trim();
        const colore = item.querySelector(`[data-color="${cat.id}"]`).value;
        try {
          await API.updateCategory(cat.id, { nome, colore });
          cat.nome = nome; cat.colore = colore;
          app.renderCategories(); app.renderCards();
          app.toast('Categoria aggiornata');
        } catch (e) { app.toast('Errore: ' + e.message, true); }
      });
      item.querySelector('[data-del]').addEventListener('click', async () => {
        if (!confirm(`Eliminare la categoria "${cat.nome}"?`)) return;
        try {
          await API.deleteCategory(cat.id);
          app.categories = app.categories.filter(c => c.id !== cat.id);
          render(app); app.renderCategories(); app.renderCards();
          app.toast('Categoria eliminata');
        } catch (e) { app.toast('Errore: ' + e.message, true); }
      });
      list.appendChild(item);
    });
  }

  // ============ CARD FORM ============
  function openCardForm(id, app) {
    state.editing = id;
    const title = document.getElementById('card-form-title');
    const deleteBtn = document.getElementById('btn-card-delete');
    const form = document.getElementById('form-card');
    form.reset();

    // Reset COMPLETO delle preview: HTML, dataset.imageData e input file.
    // Senza questo, dataset.imageData persiste tra aperture del form e
    // una nuova tessera eredita il logo/barcode della precedente.
    const barcodePreview = document.getElementById('f-barcode-preview');
    const logoPreview = document.getElementById('f-logo-preview');
    barcodePreview.innerHTML = '';
    logoPreview.innerHTML = '';
    delete barcodePreview.dataset.imageData;
    delete logoPreview.dataset.imageData;
    document.getElementById('f-logo').value = '';
    document.getElementById('f-barcode-image').value = '';

    // popola categorie
    const sel = document.getElementById('f-categoria');
    sel.innerHTML = app.categories.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('');

    if (id) {
      const card = app.cards.find(c => c.id === id);
      title.textContent = 'Modifica tessera';
      deleteBtn.hidden = false;
      deleteBtn.onclick = () => onCardDelete(app);
      document.getElementById('f-nome').value = card.nome || '';
      document.getElementById('f-numero').value = card.numero || '';
      document.getElementById('f-categoria').value = card.categoria || '';
      document.getElementById('f-barcode').value = card.barcode || '';
      document.getElementById('f-barcode-type').value = card.barcodeType || 'CODE128';
      document.getElementById('f-preferita').checked = !!card.preferita;
      document.getElementById('f-note').value = card.note || '';

      // preview logo esistente (solo visualizzazione — NON settiamo dataset.imageData
      // perché l'imageData va valorizzato solo quando l'utente carica un nuovo file)
      if (card.logo) {
        logoPreview.innerHTML = `<img src="${card.logo}" alt="logo"/>`;
      }
      Barcode.render(barcodePreview, card);
    } else {
      title.textContent = 'Nuova tessera';
      deleteBtn.hidden = true;
    }

    onBarcodeTypeChange();
    showModal('modal-card-form');
  }

  function onBarcodeTypeChange() {
    const type = document.getElementById('f-barcode-type').value;
    document.getElementById('f-barcode-image-row').hidden = (type !== 'IMAGE');
    document.getElementById('f-barcode').disabled = (type === 'IMAGE');
    updateBarcodePreview();
  }

  function updateBarcodePreview() {
    const type = document.getElementById('f-barcode-type').value;
    const val = document.getElementById('f-barcode').value;
    const preview = document.getElementById('f-barcode-preview');
    if (type !== 'IMAGE' && val) {
      Barcode.render(preview, { barcode: val, barcodeType: type });
    } else if (type !== 'IMAGE') {
      preview.innerHTML = '';
    }
  }

  function onBarcodeImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById('f-barcode-preview');
      preview.innerHTML = `<img src="${ev.target.result}" alt="barcode"/>`;
      preview.dataset.imageData = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function onLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      // Compressione leggera: ridimensioniamo su canvas
      const img = new Image();
      img.onload = () => {
        const maxSize = 256;
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const preview = document.getElementById('f-logo-preview');
        preview.innerHTML = `<img src="${dataUrl}" alt="logo"/>`;
        preview.dataset.imageData = dataUrl;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function onCardSubmit(e, app) {
    e.preventDefault();
    const type = document.getElementById('f-barcode-type').value;
    const data = {
      nome: document.getElementById('f-nome').value.trim(),
      numero: document.getElementById('f-numero').value.trim(),
      categoria: document.getElementById('f-categoria').value,
      barcode: type === 'IMAGE' ? '' : document.getElementById('f-barcode').value.trim(),
      barcodeType: type,
      barcodeImage: type === 'IMAGE' ? (document.getElementById('f-barcode-preview').dataset.imageData || null) : null,
      logo: document.getElementById('f-logo-preview').dataset.imageData || (state.editing ? app.cards.find(c => c.id === state.editing)?.logo : null),
      note: document.getElementById('f-note').value.trim(),
      preferita: document.getElementById('f-preferita').checked,
    };

    if (!data.nome) { app.toast('Il nome è obbligatorio', true); return; }

    try {
      if (state.editing) {
        const updated = await API.updateCard(state.editing, data);
        app.cards = app.cards.map(c => c.id === updated.id ? updated : c);
      } else {
        const created = await API.createCard(data);
        app.cards.push(created);
      }
      hideModal('modal-card-form');
      render(app); app.renderCards();
      app.toast('Salvata');
    } catch (e) { app.toast('Errore: ' + e.message, true); }
  }

  async function onCardDelete(app) {
    if (!state.editing) return;
    if (!confirm('Eliminare questa tessera?')) return;
    try {
      await API.deleteCard(state.editing);
      app.cards = app.cards.filter(c => c.id !== state.editing);
      hideModal('modal-card-form');
      render(app); app.renderCards();
      app.toast('Eliminata');
    } catch (e) { app.toast('Errore: ' + e.message, true); }
  }

  // ============ CATEGORIE ============
  async function onCatSubmit(e, app) {
    e.preventDefault();
    const nome = document.getElementById('new-cat-name').value.trim();
    const colore = document.getElementById('new-cat-color').value;
    if (!nome) return;
    try {
      const created = await API.createCategory({ nome, colore });
      app.categories.push(created);
      document.getElementById('form-new-cat').reset();
      document.getElementById('new-cat-color').value = '#B08D57';
      render(app); app.renderCategories();
      app.toast('Categoria creata');
    } catch (e) { app.toast('Errore: ' + e.message, true); }
  }

  // ============ SCANNER ============
  async function openScanner() {
    showModal('modal-scanner');

    // Reset messaggio errore eventuale da aperture precedenti
    const errEl = document.getElementById('scanner-error');
    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }

    // iOS/Safari ha bisogno di un frame per applicare il layout alla modal
    // prima che html5-qrcode possa calcolare le dimensioni del video.
    // Usiamo due rAF (primo frame: layout, secondo frame: paint completato).
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      await Scanner.start('scanner-box', (text, format) => {
        document.getElementById('f-barcode').value = text;
        const mapped = Scanner.mapFormat(format);
        document.getElementById('f-barcode-type').value = mapped;
        Scanner.stop();
        hideModal('modal-scanner');
        onBarcodeTypeChange();
      });
    } catch (e) {
      // Non chiudiamo la modal: mostriamo l'errore lì dentro così
      // l'utente può leggerlo e chiudere a scelta, oppure inserire manualmente.
      if (errEl) {
        errEl.textContent = e.message || 'Impossibile avviare la camera.';
        errEl.hidden = false;
      } else {
        alert('Impossibile aprire la camera: ' + e.message);
      }
    }
  }

  // ============ BACKUP ============
  async function onExport() {
    try {
      const res = await API.exportBackup();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fideluxe-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Errore export: ' + e.message); }
  }

  async function onImport(app) {
    const fileInput = document.getElementById('import-file');
    const mode = document.querySelector('input[name="import-mode"]:checked').value;
    const resultEl = document.getElementById('import-result');
    resultEl.textContent = '';
    resultEl.classList.remove('hint--error');

    const file = fileInput.files[0];
    if (!file) { resultEl.textContent = 'Seleziona un file.'; resultEl.classList.add('hint--error'); return; }
    if (mode === 'replace' && !confirm('Sostituire tutti i dati attuali?')) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await API.importBackup(data, mode);
      resultEl.textContent = `OK — ${res.cards} tessere, ${res.categories} categorie.`;
      // ricarica dati
      await app.reloadData();
      render(app);
    } catch (e) {
      resultEl.textContent = 'Errore: ' + e.message;
      resultEl.classList.add('hint--error');
    }
  }

  // ============ UTILS ============
  function showModal(id) { document.getElementById(id).hidden = false; }
  function hideModal(id) { document.getElementById(id).hidden = true; }
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function escapeAttr(s) { return escapeHtml(s); }

  global.Admin = { init, render };
})(window);
