function initSignaturePad(canvasId, clearBtnId, checkboxId, submitBtnId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  const clearBtn = document.getElementById(clearBtnId);
  const checkbox = document.getElementById(checkboxId);
  const submitBtn = document.getElementById(submitBtnId);

  let drawing = false;
  let hasSignature = false;

  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  function resizeCanvasForDevicePixelRatio() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    const oldImage = canvas.toDataURL("image/png");

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (oldImage && hasSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = oldImage;
    }
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top
    };
  }

  function updateButton() {
    submitBtn.disabled = !(checkbox.checked && hasSignature);
  }

  function startDraw(e) {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    e.preventDefault();
  }

  function draw(e) {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasSignature = true;
    updateButton();
    e.preventDefault();
  }

  function stopDraw() {
    drawing = false;
  }

  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
    updateButton();
  });

  checkbox.addEventListener("change", updateButton);

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  window.addEventListener("mouseup", stopDraw);

  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stopDraw);

  window.addEventListener("resize", resizeCanvasForDevicePixelRatio);

  resizeCanvasForDevicePixelRatio();
  updateButton();

  return {
    getSignatureDataUrl() {
      if (!hasSignature) return null;
      return canvas.toDataURL("image/png");
    },
    hasSignature() {
      return hasSignature;
    }
  };
}

async function getClientIp() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || null;
  } catch (e) {
    console.warn("IP non récupérée", e);
    return null;
  }
}
