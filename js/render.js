/* =========================================================================
 * 奶家军 · 抓奶仔  —  渲染层（含所有界面与输入命中区）
 * 角色直接用 PNG 贴图，不再有卡片边框；点击判定用不可见的方框。
 * ========================================================================= */
(function (root) {
  var MA = (root.MA = root.MA || {});
  var U = MA.util;
  var D = MA.DATA;
  var FX = MA.FX;
  var TAU = Math.PI * 2;

  var V = MA.VIEW;
  var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';

  var THEME = {
    bg0: '#171029',
    gold: '#FFD86B',
    pink: '#FF9BC0',
    mint: '#9EF0C4',
    sky: '#7FD3FF',
    cream: '#FFF6E2'
  };

  var hotspots = [];
  var helpOpen = false;
  var bgCache = null, bgKey = '';

  /* ------------------------------------------------------------------ */
  /* 基础绘制                                                            */
  /* ------------------------------------------------------------------ */
  function txt(ctx, s, x, y, size, color, align, weight, stroke) {
    ctx.font = (weight || '900') + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    if (stroke) {
      ctx.lineWidth = size * 0.2;
      ctx.strokeStyle = stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }

  function panel(ctx, x, y, w, h, r, fill, line) {
    MA.Art.rrPath(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (line) { ctx.lineWidth = 2; ctx.strokeStyle = line; ctx.stroke(); }
  }

  function hot(x, y, w, h, action, data) {
    hotspots.push({ x: x, y: y, w: w, h: h, action: action, data: data });
  }

  function drawButton(ctx, r, label, opt) {
    opt = opt || {};
    var pressed = opt.pressed;
    ctx.save();
    ctx.globalAlpha = 0.35;
    MA.Art.rrPath(ctx, r.x, r.y + 6, r.w, r.h, opt.radius || r.h * 0.42);
    ctx.fillStyle = '#0B0616';
    ctx.fill();
    ctx.globalAlpha = 1;

    var g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, opt.c0 || '#FFE28A');
    g.addColorStop(1, opt.c1 || '#FFB84D');
    MA.Art.rrPath(ctx, r.x, r.y + (pressed ? 4 : 0), r.w, r.h, opt.radius || r.h * 0.42);
    ctx.fillStyle = opt.flat ? (opt.flatColor || 'rgba(255,255,255,0.10)') : g;
    ctx.fill();
    if (opt.line !== false) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = opt.flat ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.72)';
      ctx.stroke();
    }
    if (label) {
      txt(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + (pressed ? 3 : 0) + 1,
        opt.fontSize || r.h * 0.42,
        opt.textColor || '#4A2C10', 'center', '900',
        opt.textStroke || 'rgba(255,255,255,0.45)');
    }
    ctx.restore();
  }

  function star(ctx, cx, cy, r, filled, color) {
    ctx.save();
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var a1 = (i / 5) * TAU - Math.PI / 2;
      var a2 = a1 + TAU / 10;
      ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
      ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
    }
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = color || THEME.gold;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* 背景                                                                */
  /* ------------------------------------------------------------------ */
  function buildBg() {
    var cv = MA.Platform.createCanvas(V.W, V.H);
    if (!cv) return null;
    var c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, 0, V.H);
    g.addColorStop(0, '#3A2456');
    g.addColorStop(0.4, '#2A1B45');
    g.addColorStop(1, '#1A1130');
    c.fillStyle = g;
    c.fillRect(0, 0, V.W, V.H);

    var blobs = [
      { x: 120, y: 200, r: 320, c: 'rgba(127,211,255,0.15)' },
      { x: 640, y: 420, r: 340, c: 'rgba(255,155,192,0.14)' },
      { x: 375, y: 980, r: 420, c: 'rgba(255,216,107,0.10)' },
      { x: 80, y: 1150, r: 280, c: 'rgba(158,240,196,0.09)' }
    ];
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var rg = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      rg.addColorStop(0, b.c);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg;
      c.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }

    c.globalAlpha = 0.05;
    c.fillStyle = '#FFFFFF';
    for (var y = 0; y < V.H; y += 26) {
      for (var x = 0; x < V.W; x += 26) {
        c.beginPath();
        c.arc(x, y, 1.2, 0, TAU);
        c.fill();
      }
    }
    c.globalAlpha = 1;
    return cv;
  }

  function drawBg(ctx, t, kind) {
    var key = kind + V.W + 'x' + V.H;
    if (key !== bgKey) {
      bgCache = kind === 'play' ? buildTableBg() : buildMenuBg();
      bgKey = key;
    }
    if (bgCache) ctx.drawImage(bgCache, 0, 0, V.W, V.H);
    else { ctx.fillStyle = THEME.bg0; ctx.fillRect(0, 0, V.W, V.H); }

    if (kind === 'menu') {
      ctx.save();
      for (var i = 0; i < 14; i++) {
        var seed = i * 137.5;
        var px = (seed * 7.3 % V.W);
        var py = ((seed * 11.7 + t * (14 + i * 3)) % (V.H + 120)) - 60;
        var r = 4 + (i % 5) * 3;
        ctx.globalAlpha = 0.10 + (i % 3) * 0.04;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, TAU);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* 首页背景：把全部角色密密麻麻拼成一张图 */
  function buildMenuBg() {
    var cv = MA.Platform.createCanvas(V.W, V.H);
    if (!cv) return null;
    var c = cv.getContext('2d');

    c.fillStyle = '#150E26';
    c.fillRect(0, 0, V.W, V.H);

    var chars = D.CHARS;
    var s = 12345;
    var rnd = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

    var cell = 92;
    var idx = 0;
    for (var y = -60; y < V.H + 60; y += cell) {
      for (var x = -50; x < V.W + 50; x += cell) {
        var ch = chars[idx % chars.length];
        idx++;
        var ox = x + (rnd() - 0.5) * 46;
        var oy = y + (rnd() - 0.5) * 46;
        var sz = 104 + rnd() * 56;
        var rot = (rnd() - 0.5) * 0.7;
        var al = 0.34 + rnd() * 0.34;

        c.save();
        c.globalAlpha = al;
        c.translate(ox, oy);
        c.rotate(rot);
        MA.Art.draw(c, ch.id, 0, 0, sz, 1);
        c.restore();
      }
    }

    // 压暗 + 上下的深色渐变，保证文字和按钮读得清
    var dk = c.createLinearGradient(0, 0, 0, V.H);
    dk.addColorStop(0, 'rgba(12,6,24,0.86)');
    dk.addColorStop(0.35, 'rgba(12,6,24,0.72)');
    dk.addColorStop(0.72, 'rgba(12,6,24,0.78)');
    dk.addColorStop(1, 'rgba(10,5,20,0.94)');
    c.fillStyle = dk;
    c.fillRect(0, 0, V.W, V.H);

    return cv;
  }

  /* 木桌 + 大盆 + 上下压暗，往"真实场景抓东西"靠 */
  function buildTableBg() {
    var cv = MA.Platform.createCanvas(V.W, V.H);
    if (!cv) return null;
    var c = cv.getContext('2d');

    // ---- 木桌面 ----
    var base = c.createLinearGradient(0, 0, V.W * 0.4, V.H);
    base.addColorStop(0, '#9A6B3E');
    base.addColorStop(0.45, '#855A31');
    base.addColorStop(1, '#5E3D20');
    c.fillStyle = base;
    c.fillRect(0, 0, V.W, V.H);

    var seedRnd = (function () { var s = 12345; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();

    var y = -20, idx = 0;
    while (y < V.H) {
      var ph = 118 + Math.floor(seedRnd() * 46);
      var pg = c.createLinearGradient(0, y, 0, y + ph);
      pg.addColorStop(0, idx % 2 ? '#96663A' : '#8A5D33');
      pg.addColorStop(0.5, idx % 2 ? '#A4743F' : '#9A6B38');
      pg.addColorStop(1, idx % 2 ? '#7B5129' : '#6F4924');
      c.fillStyle = pg;
      c.fillRect(0, y, V.W, ph);

      // 木纹
      c.save();
      c.globalAlpha = 0.11;
      c.strokeStyle = '#3A2110';
      for (var gi = 0; gi < 5; gi++) {
        var gy = y + 14 + gi * (ph / 5.5) + seedRnd() * 8;
        c.beginPath();
        c.moveTo(-10, gy);
        for (var gx = 0; gx <= V.W + 40; gx += 120) {
          c.quadraticCurveTo(gx + 60, gy + (seedRnd() - 0.5) * 9, gx + 120, gy);
        }
        c.lineWidth = 1 + seedRnd() * 1.6;
        c.stroke();
      }
      c.restore();

      // 板缝
      c.fillStyle = 'rgba(48,26,10,0.55)';
      c.fillRect(0, y + ph - 4, V.W, 4);
      c.fillStyle = 'rgba(255,220,170,0.07)';
      c.fillRect(0, y + ph - 6, V.W, 2);

      y += ph;
      idx++;
    }

    // ---- 大盆 ----
    var bx = 375, by = MA.Pile.LAYOUT.cy, brx = 356, bry = 322;

    // 盆底投影
    c.save();
    c.globalAlpha = 0.34;
    c.beginPath();
    c.ellipse(bx + 6, by + 26, brx * 1.02, bry * 0.99, 0, 0, TAU);
    c.fillStyle = '#22110A';
    c.fill();
    c.restore();

    // 盆身
    var bgr = c.createRadialGradient(bx - 60, by - 90, 40, bx, by, brx * 1.05);
    bgr.addColorStop(0, '#6B6560');
    bgr.addColorStop(0.55, '#413B37');
    bgr.addColorStop(0.85, '#2A2523');
    bgr.addColorStop(1, '#191413');
    c.beginPath();
    c.ellipse(bx, by, brx, bry, 0, 0, TAU);
    c.fillStyle = bgr;
    c.fill();

    // 盆口内壁（上沿高光 + 下沿阴影）
    c.save();
    c.lineWidth = 9;
    c.strokeStyle = 'rgba(255,255,255,0.16)';
    c.beginPath();
    c.ellipse(bx, by, brx - 4, bry - 4, 0, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
    c.restore();

    // 盆内底部压暗
    var inner = c.createRadialGradient(bx, by + 60, 30, bx, by + 40, brx * 0.92);
    inner.addColorStop(0, 'rgba(0,0,0,0.42)');
    inner.addColorStop(0.6, 'rgba(0,0,0,0.18)');
    inner.addColorStop(1, 'rgba(0,0,0,0)');
    c.beginPath();
    c.ellipse(bx, by + 30, brx * 0.95, bry * 0.9, 0, 0, TAU);
    c.fillStyle = inner;
    c.fill();

    // ---- 整体压暗（顶部 HUD / 底部托盘 更好读） ----
    var top = c.createLinearGradient(0, 0, 0, 240);
    top.addColorStop(0, 'rgba(10,6,18,0.78)');
    top.addColorStop(1, 'rgba(10,6,18,0)');
    c.fillStyle = top;
    c.fillRect(0, 0, V.W, 240);

    var bot = c.createLinearGradient(0, 820, 0, V.H);
    bot.addColorStop(0, 'rgba(10,6,18,0)');
    bot.addColorStop(0.35, 'rgba(10,6,18,0.62)');
    bot.addColorStop(1, 'rgba(8,4,14,0.92)');
    c.fillStyle = bot;
    c.fillRect(0, 820, V.W, V.H - 820);

    return cv;
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */
  function drawHUD(ctx, G, t) {
    var lv = G.level;

    var backR = { x: 22, y: 28, w: 62, h: 62 };
    drawButton(ctx, backR, '‹', { flat: true, fontSize: 40, textColor: '#FFFFFF', radius: 22 });
    hot(backR.x, backR.y, backR.w, backR.h, 'back');

    if (G.inTutorial) {
      txt(ctx, '新手教学', 108, 52, 28, THEME.gold, 'left', '900');
    } else {
      txt(ctx, '第 ' + (G.levelIdx + 1) + ' 关', 108, 44, 26, THEME.gold, 'left', '900');
      txt(ctx, lv.name, 108, 74, 22, 'rgba(255,255,255,0.65)', 'left', '700');
    }

    var muteR = { x: V.W - 84, y: 28, w: 62, h: 62 };
    drawButton(ctx, muteR, null, { flat: true, radius: 22 });
    ctx.save();
    ctx.translate(muteR.x + 31, muteR.y + 31);
    MA.Art.icon(ctx, G.muted ? 'mute' : 'sound', 34, G.muted ? '#FF9D9D' : '#FFFFFF');
    ctx.restore();
    hot(muteR.x, muteR.y, muteR.w, muteR.h, 'mute');

    txt(ctx, String(G.score), 375, 50, 46, '#FFFFFF', 'center', '900', 'rgba(30,12,50,0.6)');
    txt(ctx, '分数', 375, 88, 18, 'rgba(255,255,255,0.45)', 'center', '700');

    /* 奶力 = 时间条，分 6 段，最后一段荧光闪烁 */
    var bx = 96, by = 150, bw = 552, bh = 18;
    var pct = G.timeMax > 0 ? U.clamp(G.timeLeft / G.timeMax, 0, 1) : 0;
    var danger = pct <= 1 / 6;

    panel(ctx, bx - 3, by - 3, bw + 6, bh + 6, (bh + 6) / 2, 'rgba(0,0,0,0.42)', 'rgba(255,255,255,0.16)');

    if (pct > 0.001) {
      var g2 = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      if (danger) {
        var fl = 0.55 + 0.45 * Math.sin(t * 11);
        g2.addColorStop(0, 'rgba(255,90,90,' + (0.65 + 0.35 * fl) + ')');
        g2.addColorStop(1, 'rgba(255,190,90,' + (0.65 + 0.35 * fl) + ')');
      } else {
        g2.addColorStop(0, '#7FD3FF');
        g2.addColorStop(0.5, '#9EF0C4');
        g2.addColorStop(1, '#FFE27A');
      }
      panel(ctx, bx, by, Math.max(bh, bw * pct), bh, bh / 2, g2, null);

      if (danger) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 11);
        ctx.shadowColor = 'rgba(255,90,90,0.95)';
        ctx.shadowBlur = 22;
        panel(ctx, bx, by, Math.max(bh, bw * pct), bh, bh / 2, 'rgba(255,120,90,0.35)', null);
        ctx.restore();
      }
    }

    // 6 段分隔线
    ctx.save();
    for (var i = 1; i < 6; i++) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bx + bw * i / 6, by + 2, 2, bh - 4);
    }
    ctx.restore();

    txt(ctx, '奶力', bx - 10, by + bh / 2, 18, danger ? '#FF9D9D' : 'rgba(255,255,255,0.55)', 'right', '700');

    var secs = Math.max(0, Math.ceil(G.timeLeft));
    var mm = Math.floor(secs / 60), ss = secs % 60;
    txt(ctx, mm + ':' + (ss < 10 ? '0' : '') + ss, bx + bw + 12, by + bh / 2, 18,
      danger ? '#FF9D9D' : 'rgba(255,255,255,0.5)', 'left', '800');

    if (G.combo > 1) {
      var k = Math.min(1, G.comboTimer / MA.CONF.comboWindow);
      var scale = 1 + 0.06 * Math.sin(t * 12);
      ctx.save();
      ctx.translate(168, 112);
      ctx.scale(scale, scale);
      txt(ctx, 'x' + G.combo + ' 连击', 0, 0, 24, '#FFB0E0', 'center', '900', 'rgba(40,10,60,0.7)');
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(110, 112, 11, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#FFB0E0';
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------ */
  /* 奶仓：分层透明度 + 可点光圈                                        */
  /* ------------------------------------------------------------------ */
  function layerAlpha(c) {
    if (!c.blocked) return 1;
    // 被压得越深越透一点点，但主体保持"实心发暗"，不会糊成一片
    var b = c.blockers | 0;
    if (b <= 1) return 1;
    if (b === 2) return 0.94;
    return 0.86;
  }

  function drawPile(ctx, G, t) {
    var pile = G.pile;
    var s = pile.size;
    var order = pile.drawOrder || [];
    var intro = G.introT;
    var maxL = Math.max(1, pile.maxLayer);

    // 可点光圈（每帧建一次，复用）
    var halo = ctx.createRadialGradient(0, 0, s * 0.16, 0, 0, s * 0.66);
    halo.addColorStop(0, 'rgba(255,232,150,' + (0.20 + 0.08 * Math.sin(t * 3.2)) + ')');
    halo.addColorStop(0.55, 'rgba(255,214,110,0.08)');
    halo.addColorStop(1, 'rgba(255,214,110,0)');

    for (var i = 0; i < order.length; i++) {
      var c = order[i];
      var appear = U.clamp(intro * 1.7 - c.layer * 0.06, 0, 1);
      if (appear <= 0) continue;

      var depthScale = 1 + (c.layer - maxL * 0.5) * 0.019;
      var sc = (0.78 + 0.22 * U.easeOutBack(appear)) * depthScale;
      var bob = c.blocked ? 0 : Math.sin(t * 2.4 + c.phase) * 1.3;
      var alpha = layerAlpha(c) * appear;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y + bob);
      ctx.rotate(c.rot * 0.7);
      ctx.scale(sc, sc);

      // 能抓的：底下一圈暖光，告诉你"这一张活着"
      if (!c.blocked && appear > 0.9) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.66, 0, TAU);
        ctx.fillStyle = halo;
        ctx.fill();
        ctx.restore();
      }

      MA.Art.shadow(ctx, c.ch, 0, 0, s, c.blocked ? 0.34 : 0.24, 9);
      if (c.blocked) MA.Art.drawDim(ctx, c.ch, 0, 0, s, 1);
      else MA.Art.draw(ctx, c.ch, 0, 0, s, 1);

      ctx.restore();
    }
  }

  /* 按下时的确认圈：能抓 = 金色，被压住 = 红色 */
  function drawTapFx(ctx, G) {
    var hl = G.hl;
    if (!hl) return;
    var k = U.clamp(hl.t / 0.42, 0, 1);
    var r = G.pile.size * (0.30 + 0.22 * U.easeOutCubic(k));
    ctx.save();
    ctx.globalAlpha = (1 - k) * (hl.ok ? 0.9 : 0.75);
    ctx.beginPath();
    ctx.arc(hl.x, hl.y, r, 0, TAU);
    ctx.lineWidth = hl.ok ? 7 : 5;
    if (hl.ok) {
      ctx.strokeStyle = '#FFE08A';
      ctx.shadowColor = 'rgba(255,220,120,0.9)';
      ctx.shadowBlur = 18;
    } else {
      ctx.strokeStyle = '#FF7A7A';
    }
    ctx.stroke();
    ctx.restore();

    // 被压住：画一个小小的"压"符号
    if (!hl.ok) {
      ctx.save();
      ctx.globalAlpha = 1 - k;
      txt(ctx, '✕', hl.x, hl.y, G.pile.size * 0.3, '#FF9D9D', 'center', '900', 'rgba(40,10,20,0.7)');
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------ */
  /* 奶槽（凹槽，不是方框）                                               */
  /* ------------------------------------------------------------------ */
  function drawTray(ctx, G, t) {
    var cap = G.capacity;
    var L = MA.Game.trayLayout(cap);
    var box = MA.Game.TRAY_BOX;
    var full = G.tray.length >= cap;

    // 奶槽底座：一条柔和的凹槽（不做方格）
    ctx.save();
    ctx.globalAlpha = 0.5;
    panel(ctx, box.x, box.y, box.w, box.h, 34, 'rgba(12,6,24,0.62)', null);
    ctx.restore();

    // 极淡的格位分隔线，只用来提示容量
    ctx.save();
    ctx.globalAlpha = full ? 0.55 * (0.6 + 0.4 * Math.sin(t * 8)) : 0.16;
    for (var d = 1; d < cap; d++) {
      var dx = L.x0 + d * (L.slot + L.gap) - L.gap / 2;
      ctx.beginPath();
      ctx.moveTo(dx, L.y + L.slot * 0.22);
      ctx.lineTo(dx, L.y + L.slot * 0.78);
      ctx.lineWidth = 3;
      ctx.strokeStyle = full ? '#FF6B6B' : '#FFFFFF';
      ctx.stroke();
    }
    ctx.restore();

    if (full) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 9);
      panel(ctx, box.x, box.y, box.w, box.h, 34, null, '#FF5C6E');
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    if (G.pendingProp === 'scoop') {
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 8);
      for (var j = 0; j < G.tray.length; j++) {
        var sp = MA.Game.traySlot(j, cap);
        MA.Art.rrPath(ctx, sp.x - sp.size / 2, sp.y - sp.size / 2, sp.size, sp.size, sp.size * 0.3);
        ctx.lineWidth = 3;
        ctx.strokeStyle = THEME.sky;
        ctx.stroke();
      }
      ctx.restore();
    }

    var k, c, pos;
    for (k = 0; k < G.tray.length; k++) {
      c = G.tray[k];
      if (c.anim && c.anim.t < 1) continue;
      pos = MA.Game.traySlot(k, cap);
      MA.Art.draw(ctx, c.ch, pos.x, pos.y, L.slot * 1.12, 1);
    }
    for (k = 0; k < G.tray.length; k++) {
      c = G.tray[k];
      if (!c.anim || c.anim.t >= 1) continue;
      pos = MA.Game.traySlot(k, cap);
      var e = U.easeOutCubic(c.anim.t);
      var x2 = U.lerp(c.anim.fromX, pos.x, e);
      var y2 = U.lerp(c.anim.fromY, pos.y, e) - Math.sin(e * Math.PI) * 60;
      var sc2 = U.lerp(1.55, 1, e);
      MA.Art.draw(ctx, c.ch, x2, y2, L.slot * 1.12 * sc2, 1);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 道具栏                                                              */
  /* ------------------------------------------------------------------ */
  function drawProps(ctx, G, t) {
    var list = D.PROPS;
    var bw = 154, bh = 122, gap = 16;
    var total = list.length * bw + (list.length - 1) * gap;
    var x0 = 375 - total / 2;
    var y = 1028;

    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var n = G.pool[p.id] || 0;
      var banned = !!(G.level && G.level.banned && G.level.banned.indexOf(p.id) >= 0);
      var x = x0 + i * (bw + gap);
      var disabled = n <= 0 || G.ending || banned;
      var active = G.pendingProp === 'scoop' && p.id === 'scoop';

      ctx.save();
      ctx.globalAlpha = disabled ? 0.3 : 1;

      MA.Art.rrPath(ctx, x, y + 5, bw, bh, 24);
      ctx.fillStyle = '#0B0616';
      ctx.fill();
      ctx.globalAlpha = disabled ? 0.34 : 1;

      var g = ctx.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0, 'rgba(255,255,255,0.17)');
      g.addColorStop(1, 'rgba(255,255,255,0.06)');
      MA.Art.rrPath(ctx, x, y, bw, bh, 24);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.lineWidth = active ? 4 : 2;
      ctx.strokeStyle = active ? THEME.sky : (n > 0 ? p.color + 'CC' : 'rgba(255,255,255,0.16)');
      ctx.stroke();

      ctx.save();
      ctx.translate(x + bw / 2, y + 44);
      MA.Art.icon(ctx, p.icon, 46, disabled ? '#9C93AE' : p.color);
      ctx.restore();

      txt(ctx, p.name, x + bw / 2, y + 92, 24, 'rgba(255,255,255,0.92)', 'center', '900');

      if (banned) {
        ctx.beginPath();
        ctx.arc(x + bw - 20, y + 20, 17, 0, TAU);
        ctx.fillStyle = '#FF6B6B';
        ctx.fill();
        txt(ctx, '禁', x + bw - 20, y + 21, 19, '#FFFFFF', 'center', '900');
        ctx.strokeStyle = 'rgba(255,107,107,0.85)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x + 16, y + bh - 16);
        ctx.lineTo(x + bw - 16, y + 16);
        ctx.stroke();
      } else if (n > 0) {
        ctx.beginPath();
        ctx.arc(x + bw - 20, y + 20, 17, 0, TAU);
        ctx.fillStyle = p.color;
        ctx.fill();
        txt(ctx, String(n), x + bw - 20, y + 21, 21, '#20142E', 'center', '900');
      }
      ctx.restore();

      if (!disabled) hot(x, y, bw, bh, 'prop', p.id);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 底部提示                                                            */
  /* ------------------------------------------------------------------ */
  function drawTip(ctx, G, t) {
    var y = 1205;
    if (G.pendingProp === 'scoop') {
      txt(ctx, '点奶槽里的奶仔 → 放回奶仓最上层', 375, y, 24, THEME.sky, 'center', '700');
    } else if (G.tray.length >= G.capacity - 1) {
      txt(ctx, '奶槽快满了！', 375, y, 26,
        0.5 + 0.5 * Math.sin(t * 6) > 0.5 ? '#FF9D9D' : '#FFD0D0', 'center', '900');
    } else {
      txt(ctx, '三个一样的奶仔自动消除  ·  抓空奶仓即通关', 375, y, 22, 'rgba(255,255,255,0.42)', 'center', '700');
    }
  }

  /* ------------------------------------------------------------------ */
  /* 消除动画                                                            */
  /* ------------------------------------------------------------------ */
  function drawDies(ctx, G) {
    for (var i = 0; i < G.dies.length; i++) {
      var d = G.dies[i];
      var k = (d.t - (d.delay || 0)) / d.dur;
      if (k < 0) continue;
      if (k > 1) k = 1;
      var e = U.easeOutCubic(k);
      var sc = 1 - 0.6 * e;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.translate(d.x, d.y - 46 * e);
      ctx.rotate(e * 0.35 * (i % 2 ? 1 : -1));
      ctx.scale(sc, sc);
      MA.Art.draw(ctx, d.ch, 0, 0, d.size * 1.12, 1);
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------ */
  /* 主菜单                                                              */
  /* ------------------------------------------------------------------ */
  function drawMenu(ctx, G, t) {
    ctx.save();
    var bob = Math.sin(t * 1.6) * 6;
    ctx.translate(375, 232 + bob);
    ctx.rotate(-0.02);
    txt(ctx, '奶家军', 0, 0, 116, THEME.cream, 'center', '900', 'rgba(60,20,90,0.55)');
    ctx.restore();

    txt(ctx, '· 抓 奶 仔 ·', 375, 320, 40, THEME.gold, 'center', '900', 'rgba(60,20,90,0.6)');

    // 点了之后还是没声音 → 给个提示（大多数是手机静音键 / 浏览器拦截）
    if (G.audioHint) {
      ctx.save();
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3);
      txt(ctx, '🔇 没有声音？把手机静音键关掉，或点一下屏幕', 375, 372, 19, '#FFC46B', 'center', '700');
      ctx.restore();
    }

    var cast = ['dan', 'shu', 'gou'];
    for (var i = 0; i < cast.length; i++) {
      var x = 375 + (i - 1) * 200;
      var y = 500 + Math.sin(t * 2 + i * 1.4) * 12;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.ellipse(x, y + 92, 58, 14, 0, 0, TAU);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.restore();
      MA.Art.draw(ctx, cast[i], x, y, 175, 1);
    }

    var b1 = { x: 375 - 190, y: 700, w: 380, h: 108 };
    drawButton(ctx, b1, '开始抓奶仔', { fontSize: 40 });
    hot(b1.x, b1.y, b1.w, b1.h, 'start');

    var b2 = { x: 375 - 180, y: 836, w: 170, h: 84 };
    var b3 = { x: 375 + 10, y: 836, w: 170, h: 84 };
    drawButton(ctx, b2, '选 关', { flat: true, fontSize: 32, textColor: '#FFFFFF' });
    drawButton(ctx, b3, '玩 法', { flat: true, fontSize: 32, textColor: '#FFFFFF' });
    hot(b2.x, b2.y, b2.w, b2.h, 'levels');
    hot(b3.x, b3.y, b3.w, b3.h, 'help');

    txt(ctx, '本游戏含AI制成部分，仅供娱乐', 375, 1210, 19, 'rgba(255,255,255,0.32)', 'center', '700');
  }

  /* ------------------------------------------------------------------ */
  /* 选关                                                                */
  /* ------------------------------------------------------------------ */
  function drawLevels(ctx, G, t) {
    var back = { x: 22, y: 28, w: 62, h: 62 };
    drawButton(ctx, back, '‹', { flat: true, fontSize: 40, textColor: '#FFFFFF', radius: 22 });
    hot(back.x, back.y, back.w, back.h, 'menu');

    txt(ctx, '选择关卡', 375, 62, 44, '#FFFFFF', 'center', '900', 'rgba(30,12,50,0.5)');

    var cols = 2, cw = 320, chh = 206, gx = 26, gy = 32;
    var y0 = 150;

    for (var i = 0; i < D.LEVELS.length; i++) {
      var lv = D.LEVELS[i];
      var col = i % cols, row = Math.floor(i / cols);
      var inRow = Math.min(cols, D.LEVELS.length - row * cols);
      var rowW = inRow * cw + (inRow - 1) * gx;
      var x = 375 - rowW / 2 + col * (cw + gx);
      var y = y0 + row * (chh + gy);
      var locked = (i + 1) > G.unlocked;

      ctx.save();
      ctx.globalAlpha = locked ? 0.55 : 1;
      var g = ctx.createLinearGradient(0, y, 0, y + chh);
      g.addColorStop(0, 'rgba(255,255,255,0.15)');
      g.addColorStop(1, 'rgba(255,255,255,0.05)');
      panel(ctx, x, y, cw, chh, 26, g, locked ? 'rgba(255,255,255,0.14)' : 'rgba(255,216,107,0.55)');

      txt(ctx, '第 ' + lv.id + ' 关', x + 22, y + 34, 21, THEME.gold, 'left', '900');
      txt(ctx, lv.name, x + 22, y + 84, 32, '#FFFFFF', 'left', '900');

      var tagColor = lv.id >= 5 ? '#FF7A7A' : (lv.id >= 3 ? '#FFB35C' : 'rgba(255,255,255,0.5)');
      txt(ctx, lv.tag, x + 22, y + 140, 18, tagColor, 'left', '800');

      if (locked) {
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.translate(x + cw - 42, y + 46);
        MA.Art.icon(ctx, 'lock', 34, '#FFFFFF');
        ctx.restore();
      } else {
        var prev = [];
        for (var pj = lv.ramp.length - 1; pj >= 0 && prev.length < 3; pj--) {
          var pl = lv.ramp[pj][1];
          for (var pk = 0; pk < pl.length && prev.length < 3; pk++) {
            if (prev.indexOf(pl[pk]) < 0) prev.push(pl[pk]);
          }
        }
        var th = 48, step = 28;
        var startX = x + cw - 20 - (th + (prev.length - 1) * step);
        for (var k = 0; k < prev.length; k++) {
          MA.Art.draw(ctx, prev[k], startX + k * step + th / 2, y + 10 + th / 2, th, 1);
        }
        var best = G.best[String(i)];
        if (best) txt(ctx, '★ ' + best, x + cw - 18, y + 172, 19, 'rgba(255,216,107,0.85)', 'right', '800');
      }
      ctx.restore();

      if (!locked) hot(x, y, cw, chh, 'level', i);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 玩法说明                                                            */
  /* ------------------------------------------------------------------ */
  function drawHelp(ctx, G, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,4,16,0.82)';
    ctx.fillRect(0, 0, V.W, V.H);

    var x = 44, y = 88, w = 662, h = 1158;
    panel(ctx, x, y, w, h, 34, 'rgba(38,25,62,0.99)', 'rgba(255,216,107,0.5)');

    txt(ctx, '玩法说明', 375, y + 50, 38, THEME.gold, 'center', '900');
    txt(ctx, '奶家军 · 抓奶仔', 375, y + 88, 20, 'rgba(255,255,255,0.4)', 'center', '700');

    var lines = [
      ['goal', '目标', '把奶仓抓空就通关；奶槽塞满立刻失败。共 5 关，越往后越难。'],
      ['tap', '抓取', '只有没被压住的奶仔能抓（暗掉的就是被压住的），点一下飞进奶槽。'],
      ['rule', '消除', '三个一样的奶仔（奶蛋×3）→ 自动消除，+100 分。只有这一条规则。'],
      ['ramp', '局内递进', '同一关里也是越玩越难：上层只有两三种奶仔，好凑；抓掉几组后种类变多，容错变低。'],
      ['sour', '散牌', '通关时奶槽里剩下的牌会酸败，每张 -120 分，也影响星级。'],
      ['pool', '整局共用', '道具是全 5 关一起用的，不是每关发。用之前想清楚。'],
      ['retry', '重打退还', '失败后点「再来一次」会退还本关用掉的道具；「从头再来」重置全部。'],
      ['scoop', '奶勺', '把奶槽里一张奶仔捞回奶仓最上层，重新整理。'],
      ['bell', '奶铃', '让奶仓里数量最多的那一类全部浮到最上层，方便连抓。'],
      ['lid', '奶盖', '本关奶槽永久 +2 格，容错神器（第 5 关禁用）。'],
      ['blast', '奶爆', '炸掉奶槽里最多的一类（最多 3 张），救急用。'],
      ['milk', '奶力', '消除攒奶力，攒满往总池里补一次随机道具。']
    ];

    var ACCENT = ['#7FD3FF', '#FFD86B', '#9EF0C4', '#FF9BC0', '#C6B5F0'];
    var ly = y + 112;
    var maxW = 486, lh = 25;
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      ctx.save();
      ctx.fillStyle = ACCENT[i % ACCENT.length];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x + 42, ly + 1, 6.5, 0, TAU);
      ctx.fill();
      ctx.restore();
      txt(ctx, L[1], x + 68, ly, 21, THEME.gold, 'left', '900');
      var n = drawWrapped(ctx, L[2], x + 68, ly + 28, 19, 'rgba(255,255,255,0.74)', maxW, lh);
      ly += 28 + n * lh + 6;
    }

    var b = { x: 375 - 150, y: y + h - 96, w: 300, h: 78 };
    drawButton(ctx, b, '知道啦', { flat: true, fontSize: 30, textColor: '#FFFFFF' });
    hot(b.x, b.y, b.w, b.h, 'closehelp');
    ctx.restore();
  }

  var NO_LINE_START = /^[。，、！？：；）】》」』…·%.,!?:;)\]]$/;

  function drawWrapped(ctx, s, x, y, size, color, maxW, lh) {
    ctx.font = '700 ' + size + 'px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    var cur = '', yy = y, lines = 1;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ctx.measureText(cur + ch).width > maxW && !NO_LINE_START.test(ch)) {
        ctx.fillText(cur, x, yy);
        yy += lh;
        cur = ch;
        lines++;
      } else cur += ch;
    }
    if (cur) ctx.fillText(cur, x, yy);
    return lines;
  }

  /* ------------------------------------------------------------------ */
  /* 结算                                                                */
  /* ------------------------------------------------------------------ */
  function drawResult(ctx, G, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,4,16,0.72)';
    ctx.fillRect(0, 0, V.W, V.H);

    var y = 270, h = 760, x = 70, w = 610;
    panel(ctx, x, y, w, h, 36, 'rgba(40,26,66,0.98)', G.win ? 'rgba(255,216,107,0.65)' : 'rgba(255,120,120,0.5)');

    txt(ctx, G.win ? '奶仓清空！' : '这局翻车了', 375, y + 68, 50,
      G.win ? THEME.gold : '#FF9D9D', 'center', '900', 'rgba(20,8,34,0.6)');

    var sub;
    if (G.win) {
      sub = '第 ' + (G.levelIdx + 1) + ' 关 · ' + G.level.name +
        (G.leftover > 0 ? ('　散牌酸败 ' + G.leftover + ' 张 -' + G.penalty) : '　完美清槽');
    } else {
      sub = G.reason;
    }
    txt(ctx, sub, 375, y + 122, 23, 'rgba(255,255,255,0.62)', 'center', '700');

    if (G.win) {
      for (var i = 0; i < 3; i++) {
        var sx = 375 + (i - 1) * 110;
        var pop = Math.max(0, Math.min(1, (t - 0.2 - i * 0.15) * 3));
        ctx.save();
        ctx.translate(sx, y + 218);
        ctx.scale(0.4 + 0.6 * pop, 0.4 + 0.6 * pop);
        star(ctx, 0, 0, 40, i < G.stars, THEME.gold);
        ctx.restore();
      }
    } else {
      MA.Art.draw(ctx, 'shi', 375, y + 218, 150, 1);
    }

    panel(ctx, 375 - 210, y + 292, 420, 132, 26, 'rgba(0,0,0,0.28)', 'rgba(255,255,255,0.12)');
    txt(ctx, '本局得分', 375, y + 316, 20, 'rgba(255,255,255,0.5)', 'center', '700');
    txt(ctx, String(G.score), 375, y + 360, 46, '#FFFFFF', 'center', '900');

    var best = G.best[String(G.levelIdx)];
    if (best) txt(ctx, '本关最高 ' + best, 375, y + 404, 18, 'rgba(255,255,255,0.42)', 'center', '700');

    txt(ctx, '剩余道具（整局共用）', 375, y + 452, 17, 'rgba(255,255,255,0.35)', 'center', '700');
    for (var pi = 0; pi < D.PROPS.length; pi++) {
      var pd = D.PROPS[pi];
      var pn = G.pool[pd.id] || 0;
      var bx0 = 375 - 190 + pi * 108;
      ctx.save();
      ctx.globalAlpha = pn > 0 ? 1 : 0.35;
      txt(ctx, pd.name + ' ' + pn, bx0 + 42, y + 484, 19,
        pn > 0 ? pd.color : 'rgba(255,255,255,0.5)', 'center', '800');
      ctx.restore();
    }

    var by = y + 512;
    var hasNext = G.levelIdx + 1 < D.LEVELS.length;
    var b1 = { x: 375 - 250, y: by, w: 220, h: 86 };
    var b2 = { x: 375 + 30, y: by, w: 220, h: 86 };

    if (G.win) {
      drawButton(ctx, b1, '再玩一次', { flat: true, fontSize: 28, textColor: '#FFFFFF' });
      drawButton(ctx, b2, hasNext ? '下一关' : '进入结局', { fontSize: 30 });
      hot(b1.x, b1.y, b1.w, b1.h, 'retry');
      hot(b2.x, b2.y, b2.w, b2.h, hasNext ? 'next' : 'ending');
    } else {
      drawButton(ctx, b1, '再来一次', { fontSize: 30 });
      drawButton(ctx, b2, '选关', { flat: true, fontSize: 28, textColor: '#FFFFFF' });
      hot(b1.x, b1.y, b1.w, b1.h, 'retry');
      hot(b2.x, b2.y, b2.w, b2.h, 'levels');
    }

    var b3 = { x: 375 - 120, y: by + 100, w: 240, h: 58 };
    drawButton(ctx, b3, '从头再来', { flat: true, fontSize: 23, textColor: 'rgba(255,255,255,0.7)' });
    hot(b3.x, b3.y, b3.w, b3.h, 'restart');

    txt(ctx, G.win ? '道具余量会带进下一关' : '「再来一次」退还本关用掉的道具',
      375, by + 182, 17, 'rgba(255,255,255,0.3)', 'center', '700');
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* 加载中                                                              */
  /* ------------------------------------------------------------------ */
  function drawLoading(ctx, t) {
    var p = MA.Art.progress();
    txt(ctx, '奶家军', 375, 560, 96, THEME.cream, 'center', '900', 'rgba(60,20,90,0.55)');
    txt(ctx, '抓 奶 仔', 375, 640, 34, THEME.gold, 'center', '900');

    var bx = 200, by = 740, bw = 350, bh = 14;
    panel(ctx, bx, by, bw, bh, bh / 2, 'rgba(255,255,255,0.12)', null);
    panel(ctx, bx, by, Math.max(bh, bw * p), bh, bh / 2, THEME.gold, null);
    txt(ctx, '奶仔入仓中 ' + Math.round(p * 100) + '%', 375, by + 48, 20, 'rgba(255,255,255,0.45)', 'center', '700');
  }

  /* ------------------------------------------------------------------ */
  /* 新手教学                                                            */
  /* ------------------------------------------------------------------ */
  var PROP_STEPS = [
    { id: 'scoop', name: '奶勺', desc: '从奶槽里捞出一张奶仔，放回奶仓最上面' },
    { id: 'bell', name: '奶铃', desc: '让奶仓里数量最多的那一类全部浮到最上面' },
    { id: 'lid', name: '奶盖', desc: '本关奶槽 +2 格，容错神器' },
    { id: 'blast', name: '奶爆', desc: '炸掉奶槽里最多的一类，最多 3 张' }
  ];

  var PROP_X0 = 43, PROP_BW = 154, PROP_GAP = 16, PROP_Y = 1028, PROP_BH = 122;

  function drawTutorial(ctx, G, t) {
    if (!G.inTutorial) return;
    var step = G.tut;

    /* 开场规则说明 */
    if (step === -1) {
      ctx.save();
      ctx.fillStyle = 'rgba(6,3,12,0.82)';
      ctx.fillRect(0, 0, V.W, V.H);
      var cx = 60, cy = 210, cw = 630, ch = 720;
      panel(ctx, cx, cy, cw, ch, 36, 'rgba(34,22,56,0.99)', 'rgba(255,216,107,0.6)');
      txt(ctx, '游戏规则', 375, cy + 62, 40, THEME.gold, 'center', '900');
      txt(ctx, '奶家军 · 抓奶仔', 375, cy + 104, 19, 'rgba(255,255,255,0.4)', 'center', '700');

      var rules = [
        ['①', '点奶仓里没被压住的奶仔', '它会飞进下面的奶槽'],
        ['②', '凑够 3 个一样的', '自动消除，加分'],
        ['③', '奶槽一共 8 格', '塞满还没消掉就失败'],
        ['④', '把奶仓抓空', '就通关啦']
      ];
      var ry = cy + 168;
      for (var i = 0; i < rules.length; i++) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        MA.Art.rrPath(ctx, cx + 46, ry - 26, cw - 92, 96, 22);
        ctx.fill();
        ctx.restore();
        txt(ctx, rules[i][0], cx + 84, ry + 22, 30, THEME.gold, 'center', '900');
        txt(ctx, rules[i][1], cx + 122, ry + 10, 24, '#FFFFFF', 'left', '800');
        txt(ctx, rules[i][2], cx + 122, ry + 44, 19, 'rgba(255,255,255,0.55)', 'left', '700');
        ry += 116;
      }

      var b = { x: 375 - 150, y: cy + ch - 116, w: 300, h: 86 };
      drawButton(ctx, b, '知道了，开始', { fontSize: 30 });
      hot(b.x, b.y, b.w, b.h, 'tutnext');
      ctx.restore();
      return;
    }

    /* 抓牌两步：只提示，不挡操作 */
    if (step === 0 || step === 1) {
      var msg0 = step === 0
        ? '① 点一个奶仔，它会飞进下面的奶槽'
        : '② 再点一个 —— 凑够 3 个一样的就会自动消除';
      panel(ctx, 52, 780, 646, 104, 30, 'rgba(24,14,40,0.95)', 'rgba(255,216,107,0.65)');
      txt(ctx, msg0, 375, 832, 24, '#FFF3D0', 'center', '800');
      if (step === 1) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 5);
        MA.Art.rrPath(ctx, 18, 892, 714, 112, 34);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#9EF0C4';
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    /* 四个道具 */
    if (step >= 2 && step <= 5) {
      var ps = PROP_STEPS[step - 2];
      var px = PROP_X0 + (step - 2) * (PROP_BW + PROP_GAP);

      ctx.save();
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 5);
      MA.Art.rrPath(ctx, px - 6, PROP_Y - 6, PROP_BW + 12, PROP_BH + 12, 30);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#FFD86B';
      ctx.stroke();
      ctx.restore();

      panel(ctx, 52, 764, 646, 120, 30, 'rgba(24,14,40,0.95)', 'rgba(255,216,107,0.65)');
      ctx.save();
      ctx.translate(118, 824);
      MA.Art.icon(ctx, D.PROP_MAP[ps.id].icon, 44, D.PROP_MAP[ps.id].color);
      ctx.restore();
      txt(ctx, '道具' + (step - 1) + ' / 4 · ' + ps.name, 158, 802, 25, '#FFE9A8', 'left', '900');
      txt(ctx, ps.desc, 158, 838, 20, 'rgba(255,255,255,0.8)', 'left', '700');
      txt(ctx, '（点这里继续）', 646, 868, 16, 'rgba(255,255,255,0.4)', 'right', '700');
      hot(52, 764, 646, 120, 'tutnext');
      return;
    }

    /* 通关说明 */
    if (step === 6) {
      panel(ctx, 52, 764, 646, 120, 30, 'rgba(24,14,40,0.95)', 'rgba(255,216,107,0.65)');
      txt(ctx, '⑤ 把奶仓里的奶仔全抓空就通关', 375, 806, 24, '#FFF3D0', 'center', '800');
      txt(ctx, '就这么简单，开始吧！', 375, 846, 20, 'rgba(255,255,255,0.6)', 'center', '700');
      hot(52, 764, 646, 120, 'tutnext');
    }
  }

  /* ------------------------------------------------------------------ */
  /* 奶力满了：随机一个奶仔跳出来夸你（只占左上角一小块）                   */
  /* ------------------------------------------------------------------ */
  function drawMilkPop(ctx, G, t) {
    var p = G.milkPop;
    if (!p) return;
    var k = p.t;
    var aIn = U.clamp(k / 0.22, 0, 1);
    var aOut = U.clamp((2.4 - k) / 0.45, 0, 1);
    var a = Math.min(aIn, aOut);
    var slide = (1 - U.easeOutCubic(aIn)) * -24;

    var x = 26 + slide, y = 172, w = 336, h = 68;
    var warn = !!p.last;
    ctx.save();
    ctx.globalAlpha = a;

    panel(ctx, x, y, w, h, 22,
      warn ? 'rgba(46,10,18,0.86)' : 'rgba(18,10,32,0.80)',
      warn ? 'rgba(255,110,110,0.75)' : 'rgba(158,240,196,0.55)');

    // 小气泡的小尖角
    ctx.beginPath();
    ctx.moveTo(x + 60, y + h);
    ctx.lineTo(x + 76, y + h + 14);
    ctx.lineTo(x + 92, y + h);
    ctx.closePath();
    ctx.fillStyle = warn ? 'rgba(46,10,18,0.86)' : 'rgba(18,10,32,0.80)';
    ctx.fill();

    MA.Art.draw(ctx, p.ch, x + 38, y + h / 2 + 2, 60, 1);
    txt(ctx, p.text, x + 74, y + h / 2, 20, warn ? '#FFD3D3' : '#FFF3D0', 'left', '800');

    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* 通关结局                                                            */
  /* ------------------------------------------------------------------ */
  function drawEnding(ctx, G, t) {
    var T = G.endT;

    ctx.fillStyle = 'rgba(10,5,18,0.88)';
    ctx.fillRect(0, 0, V.W, V.H);

    var g = ctx.createRadialGradient(375, 392, 30, 375, 392, 470);
    g.addColorStop(0, 'rgba(255,214,120,' + (0.20 + 0.07 * Math.sin(t * 2)) + ')');
    g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, V.W, V.H);

    var cx = 375, cy = 408;
    var others = [];
    for (var q = 0; q < D.CHARS.length; q++) {
      if (D.CHARS[q].id !== 'sigma') others.push(D.CHARS[q]);
    }
    var n = others.length;
    var RX = 272, RY = 272 * 0.66;

    // 成员围成一圈（牵手）
    var ringP = U.clamp((T - 2.0) / 1.0, 0, 1);
    if (ringP > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45 * ringP;
      ctx.beginPath();
      ctx.ellipse(cx, cy, RX, RY, 0, 0, TAU);
      ctx.setLineDash([2, 16]);
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#FFD86B';
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash && ctx.setLineDash([]);

      for (var i = 0; i < n; i++) {
        var ang = (i / n) * TAU - Math.PI / 2 + t * 0.10;
        var x = cx + Math.cos(ang) * RX;
        var y = cy + Math.sin(ang) * RY;
        var e = U.clamp((T - 2.0 - i * 0.055) / 0.65, 0, 1);
        var ee = U.easeOutCubic(e);
        var px = U.lerp(cx, x, ee);
        var py = U.lerp(cy, y, ee);
        var bob = e >= 1 ? Math.sin(t * 4.2 + i * 1.25) * 5 : 0;
        MA.Art.draw(ctx, others[i].id, px, py + bob, 82 * (0.4 + 0.6 * ee), e);
      }
    }

    // 中央的西格玛奶蛙
    var sp = U.clamp((T - 0.15) / 0.75, 0, 1);
    if (sp > 0) {
      var sc = 0.4 + 0.6 * U.easeOutBack(sp);
      MA.Art.draw(ctx, 'sigma', cx, cy + Math.sin(t * 2.2) * 5, 196 * sc, sp);
    }

    // 台词逐字打出
    var LINE1 = '恭喜你通过奶家军的试炼';
    var LINE2 = '正式成为一名奶人。';
    var T0 = 3.3, CPS = 11;
    var n1 = Math.floor((T - T0) * CPS);
    var t2 = T0 + LINE1.length / CPS + 0.35;
    var n2 = Math.floor((T - t2) * CPS);

    if (n1 > 0) {
      txt(ctx, LINE1.substring(0, Math.min(n1, LINE1.length)), 375, 698, 33,
        '#FFE9A8', 'center', '900', 'rgba(30,14,6,0.75)');
      if (n1 < LINE1.length) {
        txt(ctx, '▍', 375 + 165, 698, 30, 'rgba(255,233,168,' + (0.4 + 0.5 * Math.sin(t * 12)) + ')', 'left', '900');
      }
    }
    if (n2 > 0) {
      txt(ctx, LINE2.substring(0, Math.min(n2, LINE2.length)), 375, 748, 31,
        '#FFFFFF', 'center', '900', 'rgba(30,14,6,0.75)');
    }

    var hp = U.clamp((T - 6.4) / 0.8, 0, 1);
    if (hp > 0) {
      ctx.save();
      ctx.globalAlpha = hp * (0.55 + 0.35 * Math.sin(t * 3));
      txt(ctx, '点一下回到首页', 375, 900, 21, '#FFFFFF', 'center', '700');
      ctx.restore();
    }

    hot(0, 0, V.W, V.H, 'endingexit');
  }

  /* ------------------------------------------------------------------ */
  /* 开场提示条                                                          */
  /* ------------------------------------------------------------------ */
  function drawNotice(ctx, G, t) {
    var n = G.notice;
    if (!n) return;
    var aIn = U.clamp(n.t / 0.35, 0, 1);
    var aOut = U.clamp((4.8 - n.t) / 0.5, 0, 1);
    var a = Math.min(aIn, aOut);
    var dy = (1 - U.easeOutCubic(aIn)) * -16;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, dy);
    var w = 600, h = 58, x = (V.W - w) / 2, y = 836;
    panel(ctx, x, y, w, h, h / 2, 'rgba(52,24,10,0.92)', 'rgba(255,150,90,0.75)');
    txt(ctx, n.text, V.W / 2, y + h / 2, 23, '#FFD9A8', 'center', '800');
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* 主绘制                                                              */
  /* ------------------------------------------------------------------ */
  function draw(ctx, P, t, dt) {
    hotspots = [];
    var G = MA.Game.state;
    var v = P.view;
    var s = v.scale * P.dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0E0919';
    ctx.fillRect(0, 0, P.canvas.width, P.canvas.height);

    var sh = FX.shakeOffset(t);
    ctx.setTransform(s, 0, 0, s, P.dpr * v.ox + sh.x * s, P.dpr * v.oy + sh.y * s);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, V.W, V.H);
    ctx.clip();

    var playScene = (G.scene === 'play' || G.scene === 'result');
    drawBg(ctx, t, playScene ? 'play' : 'menu');

    if (!MA.Art.isReady()) {
      drawLoading(ctx, t);
      ctx.restore();
      return;
    }

    if (G.scene === 'play' || G.scene === 'result') {
      drawPile(ctx, G, t);
      drawTapFx(ctx, G);
      drawTray(ctx, G, t);
      drawDies(ctx, G);
      drawProps(ctx, G, t);
      drawHUD(ctx, G, t);
      drawTip(ctx, G, t);
      drawMilkPop(ctx, G, t);
      drawNotice(ctx, G, t);
      if (G.inTutorial) drawTutorial(ctx, G, t);
    }

    if (G.scene === 'play' && G.pendingProp === 'scoop') {
      ctx.save();
      ctx.globalAlpha = 0.8;
      panel(ctx, 150, 180, 450, 56, 28, 'rgba(127,211,255,0.18)', 'rgba(127,211,255,0.8)');
      txt(ctx, '奶勺：选一张奶仔捞回去', 375, 209, 24, '#D6F2FF', 'center', '800');
      ctx.restore();
    }

    FX.draw(ctx);

    if (G.scene === 'menu') drawMenu(ctx, G, t);
    if (G.scene === 'levels') drawLevels(ctx, G, t);
    if (G.scene === 'result') drawResult(ctx, G, t);
    if (G.scene === 'ending') drawEnding(ctx, G, t);
    if (helpOpen) drawHelp(ctx, G, t);

    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* 输入                                                                */
  /* ------------------------------------------------------------------ */
  function hit(x, y) {
    for (var i = hotspots.length - 1; i >= 0; i--) {
      var h = hotspots[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  }

  var pendingTap = null;   // 按下时选中的牌，抬手才真正抓

  function onPointer(type, x, y) {
    var G = MA.Game.state;

    if (type === 'up') { endTap(G, x, y); return; }
    if (type !== 'down') return;
    if (!MA.Art.isReady()) return;

    if (helpOpen) {
      var hh = hit(x, y);
      if (hh && hh.action === 'closehelp') { helpOpen = false; MA.Audio.ui(); return; }
      helpOpen = false;
      return;
    }

    var h = hit(x, y);
    if (h) {
      switch (h.action) {
        case 'back': MA.Audio.ui(); MA.Game.abandon('menu'); return;
        case 'menu': MA.Audio.ui(); MA.Game.abandon('menu'); return;
        case 'mute': MA.Game.toggleMute(); MA.Audio.ui(); return;
        case 'start': MA.Audio.unlock(); MA.Audio.ui(); MA.Game.startRun(); return;
        case 'levels': MA.Audio.ui(); MA.Game.abandon('levels'); return;
        case 'help': MA.Audio.ui(); helpOpen = true; return;
        case 'level': MA.Audio.unlock(); MA.Audio.ui(); MA.Game.startLevel(h.data); return;
        case 'retry': MA.Audio.ui(); MA.Game.retryLevel(); return;
        case 'restart': MA.Audio.ui(); MA.Game.startRun(); return;
        case 'next': MA.Audio.ui(); MA.Game.nextLevel(); return;
        case 'ending': MA.Audio.ui(); MA.Game.beginEnding(); return;
        case 'endingexit': MA.Audio.ui(); MA.Game.gotoMenu(); return;
        case 'tutnext': MA.Audio.ui(); MA.Game.tutNext(); return;
        case 'prop': MA.Game.useProp(h.data); return;
      }
    }

    if (G.scene !== 'play') return;

    // 教学说明弹出时，先别让玩家抓牌
    if (G.inTutorial && (G.tut < 0 || (G.tut >= 2 && G.tut <= 6))) return;

    if (G.pendingProp === 'scoop') {
      var cap = G.capacity;
      var L = MA.Game.trayLayout(cap);
      if (y >= L.y - 12 && y <= L.y + L.slot + 12) {
        for (var i = 0; i < G.tray.length; i++) {
          var sp = MA.Game.traySlot(i, cap);
          if (Math.abs(x - sp.x) < L.slot * 0.6 && Math.abs(y - sp.y) < L.slot * 0.6) {
            MA.Game.scoopCard(i);
            return;
          }
        }
      }
      MA.Game.cancelPending();
      MA.Audio.deny();
      return;
    }

    if (y > 175 && y < 845) {
      MA.Audio.unlock();
      // 先找手指下最上层"能抓"的
      var freeHit = cardAt(G, x, y, true);
      if (freeHit) {
        pendingTap = { card: freeHit, x: x, y: y };
        G.hl = { x: freeHit.x, y: freeHit.y, ok: true, t: 0 };
        MA.Audio.ui();
        return;
      }
      // 只有被压住的 → 直接给红圈和提示，抬手也不做动作
      var anyHit = cardAt(G, x, y, false);
      if (anyHit) {
        G.hl = { x: anyHit.x, y: anyHit.y, ok: false, t: 0 };
        MA.Audio.deny();
      }
    }
  }

  function endTap(G, x, y) {
    var p = pendingTap;
    pendingTap = null;
    if (!p) return;
    if (G.scene !== 'play' || G.ending || G.pendingProp) return;
    var c = p.card;
    if (!c || !c.alive) return;
    var s = G.pile.size;
    // 手指移开太远就取消
    if (Math.abs(c.x - x) > s * 0.62 || Math.abs(c.y - y) > s * 0.62) return;
    if (c.blocked) {
      MA.Audio.deny();
      FX.text(c.x, c.y - 46, '被压住了', '#FFC0C0', 26);
      FX.shake(3, 0.12);
      return;
    }
    if (!MA.Game.pick(c)) MA.Audio.deny();
  }

  function cardAt(G, x, y, freeOnly) {
    var s = G.pile.size;
    var best = null;
    for (var i = 0; i < G.pile.cards.length; i++) {
      var c = G.pile.cards[i];
      if (!c.alive) continue;
      if (freeOnly && c.blocked) continue;
      if (Math.abs(c.x - x) < s * 0.44 && Math.abs(c.y - y) < s * 0.46) {
        if (!best || c.z > best.z) best = c;
      }
    }
    return best;
  }

  MA.Render = {
    draw: draw,
    onPointer: onPointer,
    onResize: function () { bgKey = ''; },
    isHelpOpen: function () { return helpOpen; }
  };
})(typeof window !== 'undefined' ? window : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
