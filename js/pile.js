/* =========================================================================
 * 奶家军 · 抓奶仔  —  奶仓（牌堆）
 * 负责：随机生成层叠牌堆 / 计算遮挡 / 查询可抓取的卡片 / 局内难度递进
 * ========================================================================= */
(function (root) {
  var MA = (root.MA = root.MA || {});
  var U = MA.util;

  var LAYOUT = {
    cardSize: 132,        // 贴图方框尺寸（也是不可见的点击判定框）
    cx: 375,
    cy: 530,
    rx: 306,
    ry: 268,
    blockRatio: 0.26,     // 遮挡面积占比超过它就算被压住（和"看起来被压住"保持一致）
    rotRange: 0.10
  };

  function overlapRatio(a, b, s) {
    var ox = s - Math.abs(a.x - b.x);
    var oy = s - Math.abs(a.y - b.y);
    if (ox <= 0 || oy <= 0) return 0;
    return (ox * oy) / (s * s);
  }

  /* ---------------- 位置采样 ---------------- */
  function samplePositions(total, level) {
    var cx = LAYOUT.cx, cy = LAYOUT.cy;
    var scaleF = U.clamp(Math.sqrt(total / 72), 0.80, 1.0);
    var jx = U.rand(0.95, 1.05), jy = U.rand(0.95, 1.05);
    var rx = LAYOUT.rx * level.spread * scaleF * jx;
    var ry = LAYOUT.ry * level.spread * scaleF * jy;
    var area = Math.PI * rx * ry;
    var minDist = Math.sqrt(area / total) * 0.62;
    var pts = [];
    var tries = 0;
    var maxTries = total * 260;

    while (pts.length < total && tries < maxTries) {
      tries++;
      var a = Math.random() * Math.PI * 2;
      var r = Math.sqrt(Math.random()) * 0.985;
      var x = cx + Math.cos(a) * rx * r;
      var y = cy + Math.sin(a) * ry * r;

      var ok = true;
      for (var i = 0; i < pts.length; i++) {
        var dx = pts[i].x - x, dy = pts[i].y - y;
        if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; }
      }
      if (ok) pts.push({ x: x, y: y });
    }

    var guard = 0;
    while (pts.length < total && guard < 6000) {
      guard++;
      minDist *= 0.985;
      var a2 = Math.random() * Math.PI * 2;
      var r2 = Math.sqrt(Math.random()) * 0.985;
      var x2 = cx + Math.cos(a2) * rx * r2;
      var y2 = cy + Math.sin(a2) * ry * r2;
      var ok2 = true;
      for (var j = 0; j < pts.length; j++) {
        var ddx = pts[j].x - x2, ddy = pts[j].y - y2;
        if (ddx * ddx + ddy * ddy < 34 * 34) { ok2 = false; break; }
      }
      if (ok2) pts.push({ x: x2, y: y2 });
    }
    return { pts: pts, rx: rx, ry: ry, scaleF: scaleF };
  }

  /* ---------------- 层高分配 ---------------- */
  function assignLayers(pts, layers, rx, ry) {
    var cx = LAYOUT.cx, cy = LAYOUT.cy;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var nx = (p.x - cx) / rx;
      var ny = (p.y - cy) / ry;
      var rr = Math.min(1, Math.sqrt(nx * nx + ny * ny));
      var h = (1 - rr) * layers * 1.02 + U.rand(-0.42, 0.42);
      p.layer = U.clamp(Math.floor(h), 0, layers - 1);
    }
  }

  /* ---------------- 牌型分配（局内难度递进） ----------------
   * 把卡牌按"剥离顺序"排序（越上层越先被抓走），
   * 再把 ramp 里的每一段依次分配给这个顺序的前一段。
   * 段内位置打乱 —— 保证同一组的 3 张不会挨在一起，但都落在同一深度带里。
   */
  function assignChars(cards, level) {
    var cx = LAYOUT.cx, cy = LAYOUT.cy;
    var order = cards.slice().sort(function (a, b) {
      if (b.layer !== a.layer) return b.layer - a.layer;
      var da = (a.x - cx) * (a.x - cx) + (a.y - cy) * (a.y - cy);
      var db = (b.x - cx) * (b.x - cx) + (b.y - cy) * (b.y - cy);
      return da - db;
    });

    var ramp = level.ramp && level.ramp.length ? level.ramp : [[level.groups, ['dan', 'shu', 'gou']]];
    var cursor = 0;
    var totalGroups = Math.floor(cards.length / 3);

    for (var ri = 0; ri < ramp.length; ri++) {
      var n = Math.min(ramp[ri][0], totalGroups - cursor);
      if (n <= 0) break;
      var pool = ramp[ri][1];

      var typeList = [];
      for (var g = 0; g < n; g++) typeList.push(pool[g % pool.length]);
      U.shuffle(typeList);

      var slot = order.slice(cursor * 3, (cursor + n) * 3);
      U.shuffle(slot);
      for (var k = 0; k < slot.length; k++) {
        slot[k].ch = typeList[Math.floor(k / 3)];
      }
      cursor += n;
    }

    // 兜底：ramp 没覆盖完的部分用最后一个池子
    if (cursor < totalGroups) {
      var lastPool = ramp[ramp.length - 1][1];
      var rest = order.slice(cursor * 3);
      U.shuffle(rest);
      for (var q = 0; q < rest.length; q++) {
        rest[q].ch = rest[q].ch || lastPool[Math.floor(q / 3) % lastPool.length];
      }
    }
  }

  /* ---------------- 生成 ---------------- */
  function build(level) {
    var total = level.groups * 3;
    var samp = samplePositions(total, level);
    var pts = samp.pts;
    assignLayers(pts, level.layers, samp.rx, samp.ry);

    var cards = [];
    for (var i = 0; i < pts.length; i++) {
      cards.push({
        id: i,
        ch: 'dan',
        x: pts[i].x,
        y: pts[i].y,
        layer: pts[i].layer,
        rot: U.rand(-LAYOUT.rotRange, LAYOUT.rotRange),
        alive: true,
        blocked: true,
        phase: Math.random() * Math.PI * 2
      });
    }
    assignChars(cards, level);

    var pile = {
      cards: cards,
      level: level,
      size: LAYOUT.cardSize,
      maxLayer: level.layers,
      dirty: true
    };
    refresh(pile);
    ensureFree(pile, level.minFree || 6);
    return pile;
  }

  /* 保证开局至少有 minFree 张能抓 */
  function ensureFree(pile, minFree) {
    var guard = 0;
    while (guard++ < 12) {
      var free = freeCards(pile);
      var need = minFree - free.length;
      if (need <= 0) return;

      var cands = [];
      for (var i = 0; i < pile.cards.length; i++) {
        var c = pile.cards[i];
        if (c.alive && c.blocked) cands.push(c);
      }
      if (!cands.length) return;
      cands.sort(function (a, b) {
        if (b.layer !== a.layer) return b.layer - a.layer;
        return a.blockers - b.blockers;
      });

      pile.maxLayer += 1;
      var top = pile.maxLayer;
      for (var k = 0; k < need && k < cands.length; k++) {
        cands[k].layer = top;
        cands[k].rot = U.rand(-0.09, 0.09);
      }
      refresh(pile);
    }
  }

  /* ---------------- 刷新遮挡关系 ---------------- */
  function refresh(pile) {
    var cards = pile.cards;
    var s = LAYOUT.cardSize;
    var i, j;

    for (i = 0; i < cards.length; i++) {
      cards[i].z = cards[i].layer * 10000 + cards[i].y;
      cards[i].blockers = 0;
    }

    for (i = 0; i < cards.length; i++) {
      var a = cards[i];
      if (!a.alive) continue;
      var blocked = false;
      for (j = 0; j < cards.length; j++) {
        if (i === j) continue;
        var b = cards[j];
        if (!b.alive) continue;
        if (b.layer <= a.layer) continue;
        if (overlapRatio(a, b, s) > LAYOUT.blockRatio) {
          blocked = true;
          a.blockers++;
        }
      }
      a.blocked = blocked;
    }
    pile.dirty = false;
    pile.drawOrder = cards.filter(function (c) { return c.alive; })
      .sort(function (p, q) { return p.z - q.z; });
    return pile;
  }

  function alive(pile) {
    var n = 0;
    for (var i = 0; i < pile.cards.length; i++) if (pile.cards[i].alive) n++;
    return n;
  }

  function freeCards(pile) {
    var out = [];
    for (var i = 0; i < pile.cards.length; i++) {
      var c = pile.cards[i];
      if (c.alive && !c.blocked) out.push(c);
    }
    return out;
  }

  /* 返回点击位置最上面的那张牌（不管能不能抓），由调用方判断 */
  function pickAt(pile, x, y) {
    var s = LAYOUT.cardSize;
    var best = null;
    for (var i = 0; i < pile.cards.length; i++) {
      var c = pile.cards[i];
      if (!c.alive) continue;
      if (Math.abs(c.x - x) < s * 0.44 && Math.abs(c.y - y) < s * 0.46) {
        if (!best || c.z > best.z) best = c;
      }
    }
    return best;
  }

  function topSpot(pile) {
    var s = LAYOUT.cardSize;
    for (var t = 0; t < 40; t++) {
      var x = LAYOUT.cx + U.rand(-110, 110);
      var y = LAYOUT.cy + U.rand(-70, 70);
      var hit = false;
      for (var i = 0; i < pile.cards.length; i++) {
        var c = pile.cards[i];
        if (!c.alive || c.layer < pile.maxLayer) continue;
        if (Math.abs(c.x - x) < s * 0.55 && Math.abs(c.y - y) < s * 0.55) { hit = true; break; }
      }
      if (!hit) return { x: x, y: y };
    }
    return { x: LAYOUT.cx + U.rand(-80, 80), y: LAYOUT.cy + U.rand(-50, 50) };
  }

  function returnCard(pile, card) {
    var spot = topSpot(pile);
    card.x = spot.x;
    card.y = spot.y;
    card.layer = pile.maxLayer + 1;
    card.rot = U.rand(-0.12, 0.12);
    card.alive = true;
    if (pile.cards.indexOf(card) < 0) pile.cards.push(card);
    refresh(pile);
  }

  function floatFamily(pile, charId) {
    var list = [];
    for (var i = 0; i < pile.cards.length; i++) {
      var c = pile.cards[i];
      if (c.alive && c.ch === charId) list.push(c);
    }
    if (!list.length) return [];
    var n = list.length;
    var gap = Math.min(74, 560 / Math.max(n, 1));
    var topLayer = pile.maxLayer + 1;
    for (var k = 0; k < n; k++) {
      var off = (k - (n - 1) / 2);
      list[k].x = LAYOUT.cx + off * gap;
      list[k].y = LAYOUT.cy + Math.abs(off) * 12 - 40;
      list[k].layer = topLayer;
      list[k].rot = U.rand(-0.08, 0.08);
    }
    refresh(pile);
    return list;
  }

  function countByChar(pile) {
    var m = {};
    for (var i = 0; i < pile.cards.length; i++) {
      var c = pile.cards[i];
      if (!c.alive) continue;
      m[c.ch] = (m[c.ch] || 0) + 1;
    }
    return m;
  }

  MA.Pile = {
    LAYOUT: LAYOUT,
    build: build,
    refresh: refresh,
    alive: alive,
    freeCards: freeCards,
    pickAt: pickAt,
    returnCard: returnCard,
    floatFamily: floatFamily,
    countByChar: countByChar,
    overlapRatio: overlapRatio
  };
})(typeof window !== 'undefined' ? window : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
