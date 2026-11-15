/* =========================================================================
 * 奶家军 · 抓奶仔  —  特效层（粒子 / 飘字 / 光波 / 震屏）
 * ========================================================================= */
(function (root) {
  var MA = (root.MA = root.MA || {});
  var U = MA.util;
  var TAU = Math.PI * 2;

  var parts = [];
  var texts = [];
  var rings = [];
  var shakeAmp = 0, shakeT = 0;

  function burst(x, y, color, n, opt) {
    opt = opt || {};
    n = n || 12;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU;
      var sp = U.rand(opt.minSpeed || 90, opt.maxSpeed || 360);
      parts.push({
        x: x + U.rand(-8, 8),
        y: y + U.rand(-8, 8),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opt.up || 60),
        g: opt.gravity === undefined ? 620 : opt.gravity,
        life: 0,
        max: U.rand(0.42, 0.85) * (opt.lifeScale || 1),
        r: U.rand(3, 8) * (opt.sizeScale || 1),
        color: color,
        kind: opt.kind || 'dot',
        rot: Math.random() * TAU,
        vr: U.rand(-8, 8)
      });
    }
  }

  function milkBurst(x, y, n) {
    for (var i = 0; i < (n || 10); i++) {
      var a = -Math.PI / 2 + U.rand(-1.1, 1.1);
      var sp = U.rand(140, 420);
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: 900,
        life: 0,
        max: U.rand(0.5, 0.9),
        r: U.rand(4, 9),
        color: 'rgba(255,255,255,0.95)',
        kind: 'milk',
        rot: 0, vr: 0
      });
    }
  }

  function text(x, y, str, color, size, opt) {
    opt = opt || {};
    texts.push({
      x: x, y: y,
      vy: opt.vy === undefined ? -78 : opt.vy,
      vx: opt.vx || 0,
      life: 0,
      max: opt.dur || 0.95,
      str: str,
      color: color || '#FFFFFF',
      size: size || 34,
      stroke: opt.stroke || 'rgba(60,30,80,0.55)',
      pop: opt.pop === undefined ? 1 : opt.pop
    });
  }

  function ring(x, y, color, r0, r1, dur, lw) {
    rings.push({ x: x, y: y, color: color, r0: r0, r1: r1, life: 0, max: dur || 0.5, lw: lw || 6 });
  }

  function shake(amp, dur) {
    shakeAmp = Math.max(shakeAmp, amp);
    shakeT = Math.max(shakeT, dur || 0.25);
  }

  function update(dt) {
    var i, p;
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.vx *= (1 - 1.6 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (i = texts.length - 1; i >= 0; i--) {
      var t = texts[i];
      t.life += dt;
      if (t.life >= t.max) { texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.x += t.vx * dt;
      t.vy *= (1 - 1.2 * dt);
    }
    for (i = rings.length - 1; i >= 0; i--) {
      var r = rings[i];
      r.life += dt;
      if (r.life >= r.max) rings.splice(i, 1);
    }
    if (shakeT > 0) {
      shakeT -= dt;
      if (shakeT <= 0) { shakeT = 0; shakeAmp = 0; }
    }
  }

  function shakeOffset(t) {
    if (shakeT <= 0) return { x: 0, y: 0 };
    var k = shakeT > 0 ? Math.min(1, shakeT / 0.25) : 0;
    var a = shakeAmp * k;
    return {
      x: Math.sin(t * 61) * a,
      y: Math.cos(t * 47) * a
    };
  }

  function draw(ctx) {
    var i;
    // 光波
    for (i = 0; i < rings.length; i++) {
      var r = rings[i];
      var k = r.life / r.max;
      var rad = U.lerp(r.r0, r.r1, U.easeOutCubic(k));
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.lineWidth = r.lw * (1 - k * 0.6);
      ctx.strokeStyle = r.color;
      ctx.stroke();
      ctx.restore();
    }
    // 粒子
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      var kk = p.life / p.max;
      var alpha = 1 - kk * kk;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      if (p.kind === 'star') {
        ctx.rotate(p.rot);
        ctx.beginPath();
        for (var s = 0; s < 5; s++) {
          var a1 = (s / 5) * TAU - Math.PI / 2;
          var a2 = a1 + TAU / 10;
          ctx.lineTo(Math.cos(a1) * p.r * 2.1, Math.sin(a1) * p.r * 2.1);
          ctx.lineTo(Math.cos(a2) * p.r * 0.85, Math.sin(a2) * p.r * 0.85);
        }
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (p.kind === 'milk') {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 0.72, p.r, 0, 0, TAU);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r * (1 - kk * 0.45), 0, TAU);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.restore();
    }
    // 飘字
    for (i = 0; i < texts.length; i++) {
      var t = texts[i];
      var k2 = t.life / t.max;
      var sc = t.pop ? (1 + 0.35 * Math.sin(Math.min(1, k2 * 4) * Math.PI * 0.5)) * (k2 > 0.75 ? 1 - (k2 - 0.75) * 1.6 : 1) : 1;
      ctx.save();
      ctx.globalAlpha = k2 > 0.7 ? (1 - (k2 - 0.7) / 0.3) : 1;
      ctx.font = '900 ' + t.size + 'px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 防止飘字跑出屏幕
      var tw = ctx.measureText(t.str).width * sc;
      var tx = t.x;
      var HALF = 375;
      if (tx - tw / 2 < 14) tx = 14 + tw / 2;
      if (tx + tw / 2 > HALF * 2 - 14) tx = HALF * 2 - 14 - tw / 2;
      ctx.translate(tx, t.y);
      ctx.scale(sc, sc);
      ctx.lineWidth = t.size * 0.22;
      ctx.strokeStyle = t.stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(t.str, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, 0, 0);
      ctx.restore();
    }
  }

  MA.FX = {
    burst: burst,
    milkBurst: milkBurst,
    text: text,
    ring: ring,
    shake: shake,
    shakeOffset: shakeOffset,
    update: update,
    draw: draw,
    clear: function () { parts.length = 0; texts.length = 0; rings.length = 0; shakeT = 0; shakeAmp = 0; },
    count: function () { return parts.length + texts.length + rings.length; }
  };
})(typeof window !== 'undefined' ? window : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
