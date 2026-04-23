// public/js/barcode.js — rendering barcode / QR / immagini caricate
(function (global) {

  /**
   * Renderizza un codice dentro un container.
   * @param {HTMLElement} container
   * @param {Object} card - {barcode, barcodeType, barcodeImage}
   * @param {Object} opts - {width, height, large}
   */
  function render(container, card, opts = {}) {
    container.innerHTML = '';
    if (!card) return;

    const { barcode, barcodeType, barcodeImage } = card;

    // Caso 1: immagine caricata
    if (barcodeType === 'IMAGE' && barcodeImage) {
      const img = document.createElement('img');
      img.src = barcodeImage;
      img.alt = 'Codice a barre';
      container.appendChild(img);
      return;
    }

    if (!barcode) {
      container.textContent = '—';
      return;
    }

    // Caso 2: QR
    if (barcodeType === 'QR') {
      renderQR(container, barcode, opts);
      return;
    }

    // Caso 3: barcode 1D con JsBarcode
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    container.appendChild(svg);
    try {
      JsBarcode(svg, barcode, {
        format: barcodeType || 'CODE128',
        lineColor: '#2B2620',
        background: 'transparent',
        width: opts.large ? 3 : 2,
        height: opts.large ? 110 : 70,
        displayValue: false,
        margin: 8,
      });
    } catch (e) {
      // fallback: testo
      container.textContent = barcode;
    }
  }

  /**
   * Genera un QR code renderizzato come SVG usando un semplice algoritmo.
   * Per semplicità usiamo una CDN di qrcode via canvas in un <img>.
   */
  function renderQR(container, text, opts) {
    // Usiamo il servizio di Google Charts non è più disponibile; usiamo una lib inline minima.
    // Strategia: generiamo un canvas con qrcode.js caricato on-demand.
    if (!global._qrLoaded) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      s.onload = () => { global._qrLoaded = true; drawQR(container, text, opts); };
      document.head.appendChild(s);
    } else {
      drawQR(container, text, opts);
    }
  }

  function drawQR(container, text, opts) {
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const size = opts.large ? 220 : 160;
    QRCode.toCanvas(canvas, text, {
      width: size, margin: 1,
      color: { dark: '#2B2620', light: '#FFFBF400' },
    });
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
