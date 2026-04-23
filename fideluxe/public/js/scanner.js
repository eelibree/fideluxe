// public/js/scanner.js — scansione codici con la camera
(function (global) {
  let instance = null;

  async function start(containerId, onResult) {
    stop(); // pulizia eventuale

    const box = document.getElementById(containerId);
    if (!box || !global.Html5Qrcode) {
      throw new Error('Scanner non disponibile');
    }

    instance = new Html5Qrcode(containerId);

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 160 },
      aspectRatio: 1.3,
    };

    try {
      await instance.start(
        { facingMode: 'environment' },
        config,
        (decodedText, decodedResult) => {
          const format = decodedResult?.result?.format?.formatName || 'CODE128';
          onResult(decodedText, format);
        },
        () => {} // errori per-frame ignorati
      );
    } catch (err) {
      throw new Error('Impossibile avviare la camera: ' + err.message);
    }
  }

  async function stop() {
    if (!instance) return;
    try {
      if (instance.isScanning) await instance.stop();
      await instance.clear();
    } catch {}
    instance = null;
  }

  /**
   * Decodifica il formato da html5-qrcode al formato JsBarcode.
   */
  function mapFormat(format) {
    if (!format) return 'CODE128';
    const f = format.toUpperCase();
    if (f.includes('QR')) return 'QR';
    if (f.includes('EAN_13') || f.includes('EAN13')) return 'EAN13';
    if (f.includes('EAN_8') || f.includes('EAN8')) return 'EAN8';
    if (f.includes('UPC')) return 'UPC';
    if (f.includes('CODE_128') || f.includes('CODE128')) return 'CODE128';
    if (f.includes('CODE_39') || f.includes('CODE39')) return 'CODE39';
    return 'CODE128';
  }

  global.Scanner = { start, stop, mapFormat };
})(window);
