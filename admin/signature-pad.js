// ============================================================
// signature-pad.js — Colixo Reusable Signature Pad
// Usage: var pad = ColixoSignaturePad.attach(canvasElement);
// ============================================================
(function(window) {
'use strict';

function Pad(canvas) {
    this.canvas   = canvas;
    this.ctx      = null;
    this._drawing = false;
    this._empty   = true;
    this.onChange = null; // optional callback(isEmpty)
    this._setup();
}

Pad.prototype._setup = function() {
    var self   = this;
    var canvas = this.canvas;
    var rect   = canvas.getBoundingClientRect();
    canvas.width  = rect.width  || 300;
    canvas.height = rect.height || 150;

    var ctx = this.ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    this._fillBg();

    function pos(e) {
        var r = canvas.getBoundingClientRect();
        var s = e.touches ? e.touches[0] : e;
        return { x: s.clientX - r.left, y: s.clientY - r.top };
    }

    function down(e) {
        self._drawing = true;
        var p = pos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    }
    function move(e) {
        if (!self._drawing) return;
        var p = pos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        if (self._empty) {
            self._empty = false;
            canvas.classList.add('signed');
            if (self.onChange) self.onChange(false);
        }
    }
    function up() { self._drawing = false; }

    canvas.addEventListener('mousedown',  down);
    canvas.addEventListener('mousemove',  move);
    canvas.addEventListener('mouseup',    up);
    canvas.addEventListener('mouseleave', up);

    canvas.addEventListener('touchstart', function(e) { e.preventDefault(); down(e); }, { passive: false });
    canvas.addEventListener('touchmove',  function(e) { e.preventDefault(); move(e); }, { passive: false });
    canvas.addEventListener('touchend',   function()  { up(); },                        { passive: false });
};

Pad.prototype._fillBg = function() {
    this.ctx.fillStyle = '#18181f';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
};

Pad.prototype.clear = function() {
    this._fillBg();
    this._empty = true;
    this.canvas.classList.remove('signed');
    if (this.onChange) this.onChange(true);
};

Pad.prototype.isEmpty = function() { return this._empty; };

Pad.prototype.toDataURL = function(type, quality) {
    return this.canvas.toDataURL(type || 'image/png', quality != null ? quality : 0.9);
};

Pad.prototype.toBlob = function(cb, type, quality) {
    this.canvas.toBlob(cb, type || 'image/png', quality != null ? quality : 0.9);
};

// ── PUBLIC API ────────────────────────────────────────────────────────────────

window.ColixoSignaturePad = {
    attach: function(canvasEl) {
        if (!canvasEl) return null;
        return new Pad(canvasEl);
    }
};

})(window);
