/* =========================================================================
 * 奶家军 · 抓奶仔  —  美术层
 * 角色 = 从参考图抠出来的 PNG（assets/chars/*.png），不再手绘。
 * 图标（奶勺/奶铃/奶盖/奶爆/静音/锁）仍是矢量绘制。
 * ========================================================================= */
(function (root) {
  var MA = (root.MA = root.MA || {});
  var TAU = Math.PI * 2;
  var G = root;
  var hasWX = (typeof G.wx !== 'undefined' && typeof G.wx.createCanvas === 'function');

  var BASE = 'assets/chars/';
  var sprites = {};
  var loaded = 0;
  var total = 0;

  function rrPath(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loadOne(id, cb) {
    var img;
    if (hasWX) {
      img = G.wx.createImage();
    } else {
      img = new Image();
    }
    img.onload = function () { loaded++; cb(id, img); };
    img.onerror = function () {
      loaded++;
      console.error('贴图加载失败:', BASE + id + '.png');
      cb(id, null);
    };
    img.src = BASE + id + '.png';
  }

  function load(onProgress, onDone) {
    var ids = MA.DATA.CHARS.map(function (c) { return c.id; });
    total = ids.length;
    loaded = 0;
    if (!ids.length) { if (onDone) onDone(); return; }

    ids.forEach(function (id) {
      loadOne(id, function (cid, img) {
        if (img) sprites[cid] = img;
        if (onProgress) onProgress(loaded / total);
        if (loaded >= total && onDone) onDone();
      });
    });
  }

  /* 把贴图等比塞进 size×size 的方框 */
  function spriteBox(id, size) {
    var img = sprites[id];
    if (!img) return { w: size, h: size };
    var im = (img.width > 0 || img.height > 0) ? img : null;
    var w0 = im ? img.width : 224;
    var h0 = im ? img.height : 224;
    var k = Math.min(size / w0, size / h0);
    return { w: w0 * k, h: h0 * k };
  }

  function drawSprite(ctx, id, x, y, size, alpha, opt) {
    var img = sprites[id];
    if (!img) {
      // 还没加载完：画个占位圆
      ctx.save();
      ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.35, 0, TAU);
      ctx.fillStyle = '#FFE9A8';
      ctx.fill();
      ctx.restore();
      return;
    }
    var b = spriteBox(id, size);
    ctx.save();
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    if (opt && opt.scale && opt.scale !== 1) {
      ctx.translate(x, y);
      ctx.scale(opt.scale, opt.scale);
      ctx.drawImage(img, -b.w / 2, -b.h / 2, b.w, b.h);
    } else {
      ctx.drawImage(img, x - b.w / 2, y - b.h / 2, b.w, b.h);
    }
    ctx.restore();
  }

  /* 把贴图压成纯黑剪影，用来画投影 */
  var shadows = {};
  function shadowOf(id, img) {
    if (shadows[id]) return shadows[id];
    if (!img) return null;
    var w = img.width, h = img.height;
    var cv = MA.Platform.createCanvas(w, h);
    if (!cv) return null;
    var c = MA.Platform.patchCtx(cv.getContext('2d'));
    c.drawImage(img, 0, 0, w, h);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = '#000000';
    c.fillRect(0, 0, w, h);
    shadows[id] = cv;
    return cv;
  }

  function drawShadow(ctx, id, x, y, size, alpha, offY) {
    var img = sprites[id];
    if (!img) return;
    var sh = shadowOf(id, img);
    if (!sh) return;
    var b = spriteBox(id, size);
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.3 : alpha;
    // 画三遍做出柔和边缘
    var oy = offY === undefined ? 7 : offY;
    for (var i = 0; i < 3; i++) {
      var k = 1 + i * 0.035;
      ctx.drawImage(sh, x - b.w * k / 2, y - b.h * k / 2 + oy + i, b.w * k, b.h * k);
    }
    ctx.restore();
  }

  /* 压在底下的牌：做成"变暗版"，不用透明度，避免多层叠加糊成一片 */
  var darks = {};
  function darkOf(id, img, amount) {
    var key = id + '#' + amount;
    if (darks[key]) return darks[key];
    if (!img) return null;
    var w = img.width, h = img.height;
    var cv = MA.Platform.createCanvas(w, h);
    if (!cv) return null;
    var c = MA.Platform.patchCtx(cv.getContext('2d'));
    c.drawImage(img, 0, 0, w, h);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(18,8,26,' + amount + ')';
    c.fillRect(0, 0, w, h);
    darks[key] = cv;
    return cv;
  }

  function drawDim(ctx, id, x, y, size, alpha) {
    var img = sprites[id];
    if (!img) { drawSprite(ctx, id, x, y, size, alpha); return; }
    var d = darkOf(id, img, 0.55);
    if (!d) { drawSprite(ctx, id, x, y, size, alpha); return; }
    var b = spriteBox(id, size);
    ctx.save();
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(d, x - b.w / 2, y - b.h / 2, b.w, b.h);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* 矢量图标                                                            */
  /* ------------------------------------------------------------------ */
  function drawIcon(ctx, name, s, color) {
    var c = color || '#FFFFFF';
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    ctx.lineWidth = s * 0.10;

    if (name === 'scoop') {
      ctx.beginPath();
      ctx.ellipse(-0.06 * s, 0.16 * s, 0.26 * s, 0.19 * s, -0.35, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0.10 * s, 0.02 * s);
      ctx.lineTo(0.36 * s, -0.34 * s);
      ctx.lineWidth = s * 0.13;
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(-0.09 * s, 0.17 * s, 0.13 * s, 0.08 * s, -0.35, 0, TAU);
      ctx.fill();
    } else if (name === 'bell') {
      ctx.beginPath();
      ctx.moveTo(-0.36 * s, 0.22 * s);
      ctx.quadraticCurveTo(-0.30 * s, -0.10 * s, -0.20 * s, -0.16 * s);
      ctx.quadraticCurveTo(-0.12 * s, -0.20 * s, -0.12 * s, -0.30 * s);
      ctx.lineTo(0.12 * s, -0.30 * s);
      ctx.quadraticCurveTo(0.12 * s, -0.20 * s, 0.20 * s, -0.16 * s);
      ctx.quadraticCurveTo(0.30 * s, -0.10 * s, 0.36 * s, 0.22 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-0.06 * s, 0.34 * s);
      ctx.quadraticCurveTo(0, 0.44 * s, 0.06 * s, 0.34 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -0.38 * s);
      ctx.lineTo(0, -0.30 * s);
      ctx.lineWidth = s * 0.11;
      ctx.stroke();
    } else if (name === 'lid') {
      ctx.beginPath();
      ctx.moveTo(0, -0.42 * s);
      ctx.quadraticCurveTo(0.20 * s, -0.30 * s, 0.36 * s, -0.28 * s);
      ctx.quadraticCurveTo(0.36 * s, 0.16 * s, 0, 0.44 * s);
      ctx.quadraticCurveTo(-0.36 * s, 0.16 * s, -0.36 * s, -0.28 * s);
      ctx.quadraticCurveTo(-0.20 * s, -0.30 * s, 0, -0.42 * s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(-0.18 * s, 0.02 * s);
      ctx.lineTo(-0.03 * s, 0.16 * s);
      ctx.lineTo(0.20 * s, -0.12 * s);
      ctx.stroke();
    } else if (name === 'blast') {
      var spikes = 10;
      ctx.beginPath();
      for (var i = 0; i < spikes * 2; i++) {
        var a = (i / (spikes * 2)) * TAU - Math.PI / 2;
        var rr = (i % 2 === 0) ? 0.46 * s : 0.19 * s;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(0, 0, 0.12 * s, 0, TAU);
      ctx.fill();
    } else if (name === 'sound' || name === 'mute') {
      ctx.beginPath();
      ctx.moveTo(-0.40 * s, -0.12 * s);
      ctx.lineTo(-0.20 * s, -0.12 * s);
      ctx.lineTo(0.00 * s, -0.34 * s);
      ctx.lineTo(0.00 * s, 0.34 * s);
      ctx.lineTo(-0.20 * s, 0.12 * s);
      ctx.lineTo(-0.40 * s, 0.12 * s);
      ctx.closePath();
      ctx.fill();
      if (name === 'sound') {
        ctx.lineWidth = s * 0.09;
        ctx.beginPath(); ctx.arc(0.02 * s, 0, 0.22 * s, -0.9, 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(0.02 * s, 0, 0.38 * s, -0.9, 0.9); ctx.stroke();
      } else {
        ctx.lineWidth = s * 0.11;
        ctx.beginPath();
        ctx.moveTo(0.20 * s, -0.20 * s); ctx.lineTo(0.44 * s, 0.20 * s);
        ctx.moveTo(0.44 * s, -0.20 * s); ctx.lineTo(0.20 * s, 0.20 * s);
        ctx.stroke();
      }
    } else if (name === 'lock') {
      ctx.beginPath();
      ctx.arc(0, -0.10 * s, 0.22 * s, Math.PI, 0);
      ctx.lineWidth = s * 0.11;
      ctx.stroke();
      rrPath(ctx, -0.32 * s, -0.10 * s, 0.64 * s, 0.50 * s, 0.12 * s);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(0, 0.12 * s, 0.07 * s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  MA.Art = {
    rrPath: rrPath,
    load: load,
    sprite: function (id) { return sprites[id]; },
    box: spriteBox,
    draw: drawSprite,
    drawDim: drawDim,
    shadow: drawShadow,
    icon: drawIcon,
    isReady: function () { return total > 0 && loaded >= total; },
    progress: function () { return total ? loaded / total : 0; },
    /* 测试用：直接塞贴图 / 跳过加载 */
    setSprite: function (id, img) { sprites[id] = img; },
    forceReady: function () { total = 1; loaded = 1; }
  };
})(typeof window !== 'undefined' ? window : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
