// public/js/barcode.js — rendering barcode / QR / immagini caricate
(function (global) {

  /**
   * Renderizza un codice dentro un container.
   * @param {HTMLElement} container
   * @param {Object} card - {barcode, barcodeType, barcodeImage, numero}
   * @param {Object} opts - {large}
   */
  function render(container, card, opts = {}) {
    container.innerHTML = '';
    if (!card) return;

    const { barcodeType, barcodeImage, numero } = card;

    // Caso 1: immagine caricata (barcode da foto)
    if (barcodeType === 'IMAGE' && barcodeImage) {
      const img = document.createElement('img');
      img.src = barcodeImage;
      img.alt = 'Codice a barre';
      container.appendChild(img);
      return;
    }

    // Fallback sul numero tessera se il campo barcode è vuoto
    const value = (card.barcode && card.barcode.trim()) || (numero && String(numero).trim()) || '';

    if (!value) {
      container.textContent = '—';
      return;
    }

    // Caso 2: QR code
    if (barcodeType === 'QR') {
      renderQR(container, value, opts);
      return;
    }

    // Caso 3: barcode 1D con JsBarcode
    if (typeof JsBarcode === 'undefined') {
      container.textContent = value;
      return;
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    container.appendChild(svg);
    try {
      JsBarcode(svg, value, {
        format: barcodeType || 'CODE128',
        lineColor: '#2B2620',
        background: '#FFFBF4',
        width: opts.large ? 3 : 2,
        height: opts.large ? 110 : 70,
        displayValue: false,
        margin: 8,
      });
    } catch (e) {
      // valore non compatibile col formato → fallback CODE128
      container.innerHTML = '';
      const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      container.appendChild(svg2);
      try {
        JsBarcode(svg2, value, {
          format: 'CODE128',
          lineColor: '#2B2620',
          background: '#FFFBF4',
          width: opts.large ? 3 : 2,
          height: opts.large ? 110 : 70,
          displayValue: false,
          margin: 8,
        });
      } catch {
        container.textContent = value;
      }
    }
  }

  /**
   * Rendering QR via qrcodejs (libreria browser-first, global QRCode).
   * Produce un canvas/img dentro un wrapper.
   */
  function renderQR(container, text, opts) {
    if (typeof QRCode === 'undefined') {
      // libreria non ancora caricata (caso limite con defer): retry breve
      const retry = () => {
        if (typeof QRCode !== 'undefined') renderQR(container, text, opts);
        else setTimeout(retry, 80);
      };
      retry();
      return;
    }

    const size = opts.large ? 220 : 160;
    const holder = document.createElement('div');
    holder.className = 'qr-holder';
    container.appendChild(holder);

    try {
      new QRCode(holder, {
        text: String(text),
        width: size,
        height: size,
        colorDark: '#2B2620',
        colorLight: '#FFFBF4',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (e) {
      container.textContent = text;
    }
  }

  /**
   * Genera un numero tessera casuale (per uso fallback).
   */
  function generateNumber(length = 13) {
    let n = '';
    for (let i = 0; i < length; i++) n += Math.floor(Math.random() * 10);
    return n;
  }

  global.Barcode = { render, generateNumber };
})(window);
