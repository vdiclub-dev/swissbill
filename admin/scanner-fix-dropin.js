(function () {
  'use strict';

  let qrDetectorCache = undefined;

  function log() {
    try { console.log.apply(console, ['[scanner-fix]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  function warn() {
    try { console.warn.apply(console, ['[scanner-fix]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  async function getQrDetector() {
    if (qrDetectorCache !== undefined) return qrDetectorCache;

    qrDetectorCache = null;

    if (!('BarcodeDetector' in window)) {
      warn('BarcodeDetector absent');
      return null;
    }

    try {
      if (typeof BarcodeDetector.getSupportedFormats === 'function') {
        const formats = await BarcodeDetector.getSupportedFormats();
        log('Formats supportés:', formats);
        if (!Array.isArray(formats) || !formats.includes('qr_code')) {
          warn('qr_code non supporté par BarcodeDetector');
          return null;
        }
      }

      qrDetectorCache = new BarcodeDetector({ formats: ['qr_code'] });
      log('BarcodeDetector activé');
      return qrDetectorCache;
    } catch (e) {
      warn('Impossible d\'initialiser BarcodeDetector:', e);
      qrDetectorCache = null;
      return null;
    }
  }

  function ensureGetUserMediaPolyfill() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) return;
    if (!navigator.mediaDevices) navigator.mediaDevices = {};
    navigator.mediaDevices.getUserMedia = function (constraints) {
      var g = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
      if (!g) return Promise.reject(new Error('getUserMedia indisponible'));
      return new Promise(function (resolve, reject) {
        g.call(navigator, constraints, resolve, reject);
      });
    };
  }

  function getCameraStreamWithFallbacks() {
    ensureGetUserMediaPolyfill();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('no-api'));
    }
    var g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    var attempts = [
      { video: { facingMode: 'environment' }, audio: false },
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      { video: true, audio: false },
      { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: { facingMode: 'user' }, audio: false }
    ];
    return attempts.reduce(function (prev, constraint) {
      return prev.catch(function () { return g(constraint); });
    }, Promise.reject(new Error('start')));
  }

  function clearScanFileInputs() {
    ['scanInputCamera'].forEach(function (id) {
      const el = getEl(id);
      if (el) el.value = '';
    });
  }

  function triggerNativeCameraFallback(reason) {
    const input = getEl('scanInputCamera');
    const statusEl = getEl('scanStatus');
    if (statusEl) {
      statusEl.style.color = 'var(--yellow)';
      statusEl.textContent = reason || '📸 Utilisez le bouton rouge pour ouvrir la caméra du téléphone.';
    }
    return input;
  }

  function stopLiveScanTracksSafe() {
    try {
      if (typeof window.stopLiveScanTracks === 'function') {
        window.stopLiveScanTracks();
        return;
      }
    } catch (e) {}

    try {
      if (window.scanInterval) {
        clearInterval(window.scanInterval);
        window.scanInterval = null;
      }
    } catch (e) {}

    try {
      if (window.scanStream) {
        window.scanStream.getTracks().forEach(function (t) { t.stop(); });
        window.scanStream = null;
      }
    } catch (e) {}

    const v = getEl('qrVideo');
    if (v) {
      try { v.srcObject = null; } catch (e) {}
    }

    try { window.scanning = false; } catch (e) {}
  }

  function attachVideoPlayThenScan(video, statusEl) {
    function startDecodeLoop() {
      window.scanning = false;

      if (window.scanInterval) clearInterval(window.scanInterval);

      window.scanInterval = setInterval(function () {
        if (typeof window.decodeFrame === 'function') {
          window.decodeFrame();
        }
      }, 250);

      if (statusEl) {
        statusEl.style.color = 'var(--green)';
        statusEl.textContent = '📷 Caméra active — pointez un QR dans le cadre';
      }

      log('Boucle de scan démarrée', {
        readyState: video.readyState,
        width: video.videoWidth,
        height: video.videoHeight
      });
    }

    video.defaultMuted = true;
    video.muted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.playsInline = true;

    video.style.display = 'block';
    video.style.visibility = 'visible';
    video.style.objectFit = 'cover';
    video.style.background = '#000';
    video.style.width = '100%';
    video.style.height = '100%';

    const tryPlay = function () {
      return video.play()
        .then(function () {
          if (video.videoWidth > 0) {
            startDecodeLoop();
          } else {
            setTimeout(function () {
              if (video.videoWidth > 0) {
                startDecodeLoop();
              } else if (statusEl) {
                statusEl.style.color = 'var(--yellow)';
                statusEl.textContent = '📷 Caméra démarrée mais image pas encore prête…';
              }
            }, 300);
          }
        })
        .catch(function (err) {
          warn('video.play() a échoué:', err);
          if (statusEl) {
            statusEl.style.color = 'var(--yellow)';
            statusEl.textContent = '📷 Démarrage caméra… réessayez si besoin';
          }
        });
    };

    if (video.readyState >= 2 && video.videoWidth > 0) {
      return tryPlay();
    }

    return new Promise(function (resolve) {
      let started = false;

      function launch() {
        if (started) return;
        started = true;
        tryPlay().finally(resolve);
      }

      video.addEventListener('loadedmetadata', launch, { once: true });
      video.addEventListener('loadeddata', launch, { once: true });
      video.addEventListener('canplay', launch, { once: true });

      setTimeout(launch, 600);
    });
  }

  async function decodeFrameFixed() {
    if (window.scanning) return;

    const video = getEl('qrVideo');
    const canvas = getEl('qrCanvas');

    if (!video || !canvas) return;
    if (!video.videoWidth || video.readyState < 2) return;

    window.scanning = true;

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let rawValue = null;

      const detector = await getQrDetector();
      if (detector) {
        try {
          const codes = await detector.detect(canvas);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            rawValue = codes[0].rawValue;
            log('Détecté par BarcodeDetector:', rawValue);
          }
        } catch (e) {
          warn('detect() natif a échoué:', e);
        }
      }

      if (!rawValue && window.jsQR) {
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'attemptBoth'
          });
          if (code && code.data) {
            rawValue = code.data;
            log('Détecté par jsQR:', rawValue);
          }
        } catch (e) {
          warn('jsQR a échoué:', e);
        }
      }

      if (!rawValue && window.jsQR) {
        try {
          const cropW = Math.round(canvas.width * 0.72);
          const cropH = Math.round(canvas.height * 0.52);
          const sx = Math.round((canvas.width - cropW) / 2);
          const sy = Math.round((canvas.height - cropH) / 2);

          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = cropW;
          cropCanvas.height = cropH;
          const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
          cropCtx.drawImage(canvas, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

          const imgData2 = cropCtx.getImageData(0, 0, cropW, cropH);
          const code2 = window.jsQR(imgData2.data, imgData2.width, imgData2.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (code2 && code2.data) {
            rawValue = code2.data;
            log('Détecté par jsQR (crop centre):', rawValue);
          }
        } catch (e) {
          warn('jsQR crop a échoué:', e);
        }
      }

      if (rawValue) {
        if (typeof window.handleQRResult === 'function') {
          window.handleQRResult(rawValue);
        }
        return;
      }
    } finally {
      window.scanning = false;
    }
  }

  function startLiveScanFixed(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();

    const statusEl = getEl('scanStatus');
    const video = getEl('qrVideo');
    const resultEl = getEl('scanResult');

    stopLiveScanTracksSafe();

    if (resultEl) resultEl.style.display = 'none';

    if (!video) {
      if (statusEl) {
        statusEl.style.color = 'var(--red)';
        statusEl.textContent = '❌ Élément vidéo introuvable';
      }
      if (typeof window.toast === 'function') window.toast('error', 'Élément vidéo manquant');
      return;
    }

    if (typeof window.isSecureContext !== 'undefined' && !window.isSecureContext) {
      if (statusEl) {
        statusEl.style.color = 'var(--red)';
        statusEl.textContent = 'HTTPS requis pour utiliser la caméra';
      }
      if (typeof window.toast === 'function') window.toast('error', 'Ouvrez le site en HTTPS');
      return;
    }

    if (statusEl) {
      statusEl.style.color = 'var(--yellow)';
      statusEl.textContent = '🔄 Ouverture de la caméra…';
    }

    video.style.display = 'block';
    video.style.visibility = 'visible';
    video.style.background = '#000';

    getCameraStreamWithFallbacks()
      .then(function (stream) {
        window.scanStream = stream;
        video.srcObject = stream;

        return new Promise(function (resolve) {
          let done = false;

          function ready() {
            if (done) return;
            done = true;
            attachVideoPlayThenScan(video, statusEl).finally(resolve);
          }

          if (video.readyState >= 2 && video.videoWidth > 0) {
            ready();
            return;
          }

          video.addEventListener('loadedmetadata', ready, { once: true });
          video.addEventListener('loadeddata', ready, { once: true });
          video.addEventListener('canplay', ready, { once: true });

          setTimeout(ready, 700);
        });
      })
      .catch(function (err) {
        warn('caméra erreur:', err);

        let msg = 'Caméra indisponible — utilisez la photo du QR plus bas.';
        if (err && err.name === 'NotAllowedError') {
          msg = 'Caméra refusée — autorisez la caméra dans les permissions du navigateur.';
        } else if (err && err.name === 'NotFoundError') {
          msg = 'Aucune caméra détectée.';
        } else if (err && err.name === 'NotReadableError') {
          msg = 'Caméra occupée par une autre application.';
        } else if (err && err.name === 'OverconstrainedError') {
          msg = 'Contrainte caméra non compatible.';
        } else if (err && err.message === 'no-api') {
          msg = 'Navigateur incompatible ou caméra non disponible.';
        }

        if (statusEl) {
          statusEl.style.color = 'var(--red)';
          statusEl.textContent = msg;
        }

        if (typeof window.toast === 'function') window.toast('error', msg);
        triggerNativeCameraFallback('📸 Utilisez le bouton rouge ou la photo du QR ci-dessous.');
      });
  }

  function openOrderFixed(id) {
    try {
      if (typeof window.stopScan === 'function') window.stopScan();
    } catch (e) {}

    const missionList = Array.isArray(window.missions) ? window.missions : [];
    const mission = missionList.find(function (m) { return m.id === id; });

    if (mission) {
      window.curMission = mission;
      if (typeof window.showScreen === 'function') window.showScreen('missions');
      setTimeout(function () {
        if (typeof window.navMission === 'function') {
          window.navMission(id);
        }
      }, 150);
    } else {
      if (typeof window.toast === 'function') {
        window.toast('info', 'Transport trouvé, mais pas encore chargé dans la liste des missions');
      }
      if (typeof window.showScreen === 'function') window.showScreen('missions');
      if (typeof window.loadMissions === 'function') window.loadMissions();
    }
  }

  function applyFixes() {
    window.decodeFrame = decodeFrameFixed;
    window.startLiveScan = startLiveScanFixed;
    window.openOrder = openOrderFixed;

    log('Correctifs scanner appliqués');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFixes);
  } else {
    applyFixes();
  }
})();
