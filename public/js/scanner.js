// public/js/scanner.js — scansione codici con la camera
// Compatibilità iPhone/Safari:
//  - aspetta che il container abbia dimensioni prima di start
//  - tenta prima { facingMode: 'environment' }, poi getCameras() come fallback
//  - ferma davvero lo stream quando si chiude
(function (global) {
  let instance = null;
  let running = false;

  /**
   * Avvia lo scanner.
   * @param {string} containerId  id del <div> contenitore
   * @param {(text: string, format: string) => void} onResult
   */
  async function start(containerId, onResult) {
    await stop(); // pulizia eventuale di istanze precedenti

    const box = document.getElementById(containerId);
    if (!box) {
      throw new Error('Contenitore scanner non trovato.');
    }
    if (!global.Html5Qrcode) {
      throw new Error('Libreria scanner non caricata. Verifica la connessione.');
    }

    // Attende che il container abbia dimensioni reali (necessario su iOS Safari
    // dove una modal appena resa visibile può non avere ancora layout stabile).
    await waitForLayout(box);

    // Controllo HTTPS: getUserMedia richiede un contesto sicuro.
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      throw new Error('La camera è disponibile solo su HTTPS.');
    }

    instance = new Html5Qrcode(containerId, /* verbose */ false);

    // Config: qrbox relativo al container, fps contenuto per iPhone
    const config = {
      fps: 10,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const size = Math.max(160, Math.floor(minEdge * 0.75));
        return { width: size, height: Math.floor(size * 0.7) };
      },
      aspectRatio: 1.3,
    };

    const onSuccess = (decodedText, decodedResult) => {
      const format = decodedResult?.result?.format?.formatName || 'CODE128';
      try { onResult(decodedText, format); } catch (e) { console.error(e); }
    };
    const onScanError = () => {}; // rumore per-frame, ignorato

    // Tentativo 1: facingMode: environment (funziona sulla maggior parte dei device moderni)
    try {
      await instance.start({ facingMode: { exact: 'environment' } }, config, onSuccess, onScanError);
      running = true;
      return;
    } catch (err1) {
      // Alcuni device non supportano `exact` — proviamo senza
      try {
        await instance.start({ facingMode: 'environment' }, config, onSuccess, onScanError);
        running = true;
        return;
      } catch (err2) {
        // Fallback: enumero le camere e prendo quella posteriore se esiste
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras || cameras.length === 0) {
            throw new Error('Nessuna camera disponibile sul dispositivo.');
          }
          // Preferiamo una camera il cui label contiene "back"/"rear"/"environment"
          const back = cameras.find(c => /back|rear|environment|posteriore/i.test(c.label))
                    || cameras[cameras.length - 1]; // ultima spesso è la posteriore
          await instance.start(back.id, config, onSuccess, onScanError);
          running = true;
          return;
        } catch (err3) {
          // Ultimo tentativo: qualsiasi camera
          try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length > 0) {
              await instance.start(cameras[0].id, config, onSuccess, onScanError);
              running = true;
              return;
            }
          } catch {}

          // Tutto fallito: rilasciamo instance e propaghiamo un errore leggibile
          const msg = mapError(err3 || err2 || err1);
          instance = null;
          throw new Error(msg);
        }
      }
    }
  }

  /**
   * Ferma lo scanner e rilascia lo stream della camera.
   * Sempre safe: può essere chiamata anche se non è attivo.
   */
  async function stop() {
    if (!instance) { running = false; return; }
    try {
      if (running) {
        try { await instance.stop(); } catch {}
      }
      try { await instance.clear(); } catch {}
    } catch {}
    instance = null;
    running = false;
  }

  /**
   * Attende che il container abbia dimensioni reali.
   * Usa rAF + polling massimo 30 frame (~500ms a 60fps).
   */
  function waitForLayout(el) {
    return new Promise(resolve => {
      let tries = 0;
      const check = () => {
        const rect = el.getBoundingClientRect();
        if ((rect.width > 0 && rect.height > 0) || tries > 30) {
          resolve();
        } else {
          tries++;
          requestAnimationFrame(check);
        }
      };
      requestAnimationFrame(check);
    });
  }

  /**
   * Normalizza errori getUserMedia in messaggi leggibili.
   */
  function mapError(err) {
    if (!err) return 'Impossibile avviare la camera.';
    const name = err.name || '';
    const msg = err.message || String(err);
    if (name === 'NotAllowedError' || /permission|denied/i.test(msg)) {
      return 'Permesso camera negato. Abilitalo nelle impostazioni del browser e riprova.';
    }
    if (name === 'NotFoundError' || /not found|no camera/i.test(msg)) {
      return 'Nessuna camera trovata sul dispositivo.';
    }
    if (name === 'NotReadableError' || /in use|busy/i.test(msg)) {
      return 'La camera è in uso da un\'altra app. Chiudi le altre app e riprova.';
    }
    if (name === 'OverconstrainedError') {
      return 'Camera richiesta non disponibile. Inserisci il codice manualmente.';
    }
    if (name === 'SecurityError' || /secure context|https/i.test(msg)) {
      return 'La camera funziona solo su HTTPS.';
    }
    return 'Impossibile avviare la camera: ' + msg;
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
