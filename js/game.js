/* =========================================================================
 * 奶家军 · 抓奶仔  —  核心玩法
 *
 * 规则：
 *   1. 奶槽固定 8 格，可用「奶盖」扩到 10 格
 *   2. 消除：同一角色 ×3（只有这一条）
 *   3. 抓空奶仓即通关，剩下的散牌「酸败」扣分
 *   4. 四个道具：奶勺 / 奶铃 / 奶盖 / 奶爆 —— 整局共用
 *   5. 奶力条：消除攒奶力，攒满往总池里补一次道具
 * ========================================================================= */
(function (root) {
  var MA = (root.MA = root.MA || {});
  var U = MA.util;
  var CONF = MA.CONF;
  var D = MA.DATA;

  /* ---------------- 奶槽几何 ---------------- */
  var TRAY_BOX = { x: 18, y: 900, w: 714, h: 100 };

  function trayLayout(cap) {
    var gap = 8;
    var inner = TRAY_BOX.w - 26;
    var slot = Math.min(76, (inner - (cap - 1) * gap) / cap);
    var total = cap * slot + (cap - 1) * gap;
    return {
      slot: slot, gap: gap,
      x0: 375 - total / 2,
      y: TRAY_BOX.y + (TRAY_BOX.h - slot) / 2,
      total: total
    };
  }

  function traySlot(i, cap) {
    var L = trayLayout(cap);
    return {
      x: L.x0 + i * (L.slot + L.gap) + L.slot / 2,
      y: L.y + L.slot / 2,
      size: L.slot
    };
  }

  /* ---------------- 游戏状态 ---------------- */
  var G = {
    scene: 'menu',
    levelIdx: 0,
    level: null,
    pile: null,

    tray: [],
    capacity: CONF.trayBase,

    pool: {},
    poolSnapshot: {},
    levelPropsUsed: 0,
    lidUsed: 0,

    score: 0,
    combo: 0,
    comboTimer: 0,
    milk: 0,

    dies: [],
    pendingProp: null,
    ending: false,
    endTimer: 0,
    win: false,
    stars: 0,
    leftover: 0,
    penalty: 0,
    reason: '',

    time: 0,
    started: false,
    best: {},
    unlocked: 1,
    muted: false,
    mixFlash: 0,
    introT: 1,
    hl: null,           // 点击确认圈 {x,y,ok,t}
    lastPick: null,

    timeLeft: 0,        // 奶力 = 剩余时间（秒）
    timeMax: 60,
    milkStage: 6,
    maxCombo: 0,
    timeBonus: 0,
    comboBonus: 0,
    scoreBase: 0,
    notice: null,       // 关卡开场提示 {text, t}

    inTutorial: false,
    tut: 0,             // 教学步骤：-1 规则弹窗 0 抓第一张 1 抓第二张 2-5 四个道具 6 通关说明 7 结束
    tutorialDone: false,
    milkPop: null,      // 奶力满时的角色弹幕 {ch, text, t}
    endT: 0,            // 结局演出计时
    beatAll: false
  };

  function loadSave() {
    var s = MA.Platform.storage.get('save7', null);
    if (s && typeof s === 'object') {
      G.best = s.best || {};
      G.unlocked = s.unlocked || 1;
      G.tutorialDone = !!s.tutorialDone;
    }
  }
  function writeSave() {
    MA.Platform.storage.set('save7', {
      best: G.best, unlocked: G.unlocked, tutorialDone: G.tutorialDone
    });
  }

  /* ---------------- 开局 ---------------- */
  function startRun() {
    G.pool = U.clone(D.POOL_START);
    if (!G.tutorialDone) startTutorial();
    else startLevel(0);
  }

  /* 新手教学：迷你牌堆 + 分步指引 */
  function startTutorial() {
    var lv = D.TUTORIAL;
    G.pool = U.clone(D.POOL_START);
    G.levelIdx = -1;
    G.level = lv;
    G.inTutorial = true;
    G.tut = -1;          // 先弹规则说明
    G.milkPop = null;
    G.pile = MA.Pile.build(lv);
    resetBoard(lv);
    MA.FX.clear();
    MA.Audio.unlock();
    MA.Audio.bgm('level');
  }

  function startLevel(idx) {
    idx = U.clamp(idx, 0, D.LEVELS.length - 1);
    var lv = D.LEVELS[idx];

    if (!G.pool) G.pool = U.clone(D.POOL_START);

    G.levelIdx = idx;
    G.level = lv;
    G.inTutorial = false;
    G.pile = MA.Pile.build(lv);
    resetBoard(lv);
    // 第四关提前告知：第五关禁用奶盖
    if (idx === D.LEVELS.length - 2) {
      G.notice = { text: '提示：奶盖在第 5 关将无法使用', t: 0 };
    }
    MA.FX.clear();
    MA.Audio.unlock();
    MA.Audio.bgm('level');
  }

  function resetBoard(lv) {
    G.tray = [];
    G.capacity = lv.slots || CONF.trayBase;
    G.lidUsed = 0;
    G.levelPropsUsed = 0;
    G.poolSnapshot = U.clone(G.pool);

    G.score = 0;
    G.combo = 0;
    G.comboTimer = 0;
    G.maxCombo = 0;
    G.milk = 0;
    G.timeMax = lv.time || 60;
    G.timeLeft = G.timeMax;
    G.milkStage = 6;
    G.milkPop = null;
    G.timeBonus = 0;
    G.comboBonus = 0;
    G.scoreBase = 0;
    G.notice = null;
    G.dies = [];
    G.pendingProp = null;
    G.ending = false;
    G.endTimer = 0;
    G.win = false;
    G.stars = 0;
    G.leftover = 0;
    G.penalty = 0;
    G.reason = '';
    G.started = true;
    G.time = 0;
    G.introT = 0;
    G.mixFlash = 0;
    G.hl = null;
    G.scene = 'play';
  }

  /* 重打本关：退还本关用掉的道具 */
  function retryLevel() {
    G.pool = U.clone(G.poolSnapshot);
    if (G.inTutorial) { startTutorial(); return; }
    startLevel(G.levelIdx);
  }

  function nextLevel() {
    var n = G.levelIdx + 1;
    if (n < D.LEVELS.length) startLevel(n);
    else G.scene = 'menu';
  }

  /* 中途离开：没通关就把本关用掉的道具退回去 */
  function abandon(target) {
    if (G.started && !G.win && G.poolSnapshot) G.pool = U.clone(G.poolSnapshot);
    if (G.inTutorial) { G.inTutorial = false; G.pool = U.clone(D.POOL_START); }
    G.scene = target === 'levels' ? 'levels' : 'menu';
    MA.Audio.bgm('menu');
    MA.FX.clear();
  }

  /* ---------------- 抓卡 ---------------- */
  function canPick() {
    return G.scene === 'play' && !G.ending && !G.pendingProp;
  }

  function pick(card) {
    if (!canPick() || !card || !card.alive || card.blocked) return false;
    if (G.tray.length >= G.capacity) return false;
    // 教学里弹出说明时，先别让玩家抓牌
    if (G.inTutorial && (G.tut < 0 || (G.tut >= 2 && G.tut <= 6))) return false;

    card.alive = false;
    card.inTray = true;
    card.anim = { fromX: card.x, fromY: card.y, t: 0 };

    insertToTray(card);
    MA.Audio.pick(G.tray.length);
    if (G.inTutorial && G.tut === 0) G.tut = 1;
    else if (G.inTutorial && G.tut === 1) G.tut = 2;

    MA.Pile.refresh(G.pile);

    resolve();
    checkEnd();
    return true;
  }

  function insertToTray(card) {
    var idx = -1;
    for (var i = 0; i < G.tray.length; i++) {
      if (G.tray[i].ch === card.ch) idx = i;
    }
    if (idx < 0) G.tray.push(card);
    else G.tray.splice(idx + 1, 0, card);
  }

  /* ---------------- 消除：只有同族 ×3 ---------------- */
  function resolve() {
    var guard = 0;
    while (guard++ < 30) {
      var counts = {};
      var i;
      for (i = 0; i < G.tray.length; i++) counts[G.tray[i].ch] = (counts[G.tray[i].ch] || 0) + 1;

      var done = false;
      for (var ch in counts) {
        if (counts[ch] >= 3) {
          var idxs = [];
          for (i = 0; i < G.tray.length && idxs.length < 3; i++) {
            if (G.tray[i].ch === ch) idxs.push(i);
          }
          doTriple(ch, idxs);
          done = true;
          break;
        }
      }
      if (!done) break;
    }
  }

  function comboBonus() {
    return 1 + Math.min(G.combo, CONF.comboMax - 1) * 0.15;
  }

  function doTriple(ch, idxs) {
    var L = trayLayout(G.capacity);
    var positions = [];
    for (var k = 0; k < idxs.length; k++) positions.push(traySlot(idxs[k], G.capacity));

    var sorted = idxs.slice().sort(function (a, b) { return b - a; });
    var removed = [];
    for (var s = 0; s < sorted.length; s++) {
      removed.unshift(G.tray[sorted[s]]);
      G.tray.splice(sorted[s], 1);
    }

    G.combo++;
    if (G.combo > G.maxCombo) G.maxCombo = G.combo;
    G.comboTimer = CONF.comboWindow;
    if (G.inTutorial && G.tut === 1) G.tut = 2;
    var mult = comboBonus();
    var gain = Math.round(CONF.scoreTriple * mult);
    G.score += gain;
    // 消一组回 1 秒奶力（不弹提示，只加条）
    G.timeLeft = Math.min(G.timeMax, G.timeLeft + CONF.timePerTriple);

    var cx = 0, cy = 0;
    for (var p = 0; p < positions.length; p++) {
      cx += positions[p].x; cy += positions[p].y;
      G.dies.push({
        ch: removed[p] ? removed[p].ch : ch,
        x: positions[p].x, y: positions[p].y,
        t: 0, dur: 0.42, kind: 'triple', size: L.slot,
        delay: p * 0.045
      });
    }
    cx /= positions.length; cy /= positions.length;
    cx = U.clamp(cx, 190, 560);

    MA.FX.burst(cx, cy, '#FFF1A8', 16, { maxSpeed: 300, kind: 'star', sizeScale: 0.75 });
    MA.FX.milkBurst(cx, cy, 8);
    MA.FX.ring(cx, cy, 'rgba(255,240,170,0.95)', 10, 110, 0.45, 7);
    MA.FX.text(cx, cy - 78, '+' + gain, '#FFE27A', 40);
    if (G.combo > 1) MA.FX.text(cx, cy - 126, 'x' + G.combo + ' 连击', '#FFB0E0', 28);
    MA.FX.shake(6, 0.18);
    MA.Audio.triple(G.combo);

    vibrate(12);
  }

  function vibrate(ms) {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
      else if (typeof wx !== 'undefined' && wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    } catch (e) {}
  }

  /* 奶力（时间）每掉过 1/6，随机一个奶家军跳出来说句话 */
  function milkStageTick() {
    var stage = Math.max(0, Math.ceil(G.timeLeft / G.timeMax * 6));
    if (stage >= G.milkStage) return;
    G.milkStage = stage;
    if (G.inTutorial) return;

    var chr = U.pick(D.CHARS);
    var last = stage <= 1;
    G.milkPop = {
      ch: chr.id,
      text: U.pick(last ? D.WARNING : D.ENCOURAGE),
      last: last,
      t: 0
    };
    MA.Audio.voice();          // 随机一条奶蛙语音
    if (last) MA.Audio.deny();
  }

  /* ---------------- 胜负 ---------------- */
  function checkEnd() {
    if (G.ending) return;
    var pileAlive = MA.Pile.alive(G.pile);
    if (pileAlive === 0) return finish(true, '');
    if (G.tray.length >= G.capacity) return finish(false, '奶槽塞满了');
  }

  function finish(win, reason) {
    G.ending = true;
    G.win = win;
    G.reason = reason;
    G.endTimer = win ? 0.95 : 1.0;

    if (win && G.inTutorial) {
      G.tutorialDone = true;
      writeSave();
      G.endTimer = 0.7;
      MA.Audio.win();
      return;
    }

    if (win) {
      var leftover = G.tray.length;
      G.leftover = leftover;
      G.penalty = leftover * CONF.sourPenalty;
      G.score = Math.max(0, G.score - G.penalty);

      var L = trayLayout(G.capacity);
      for (var i = 0; i < G.tray.length; i++) {
        var pos = traySlot(i, G.capacity);
        G.dies.push({
          ch: G.tray[i].ch, x: pos.x, y: pos.y,
          t: 0, dur: 0.6, kind: 'rot', size: L.slot, delay: i * 0.05
        });
      }
      G.tray = [];

      G.stars = 1;
      if (leftover === 0 && G.levelPropsUsed <= 1) G.stars = 3;
      else if (leftover === 0 || (leftover <= 2 && G.levelPropsUsed <= 1)) G.stars = 2;

      // 最终分数 = 基础分 + 剩余时间 + 最高连击
      G.scoreBase = G.score;
      G.timeBonus = Math.round(G.timeLeft) * 12;
      G.comboBonus = G.maxCombo * 60;
      G.score += G.timeBonus + G.comboBonus;

      var key = String(G.levelIdx);
      if (!G.best[key] || G.score > G.best[key]) G.best[key] = G.score;
      if (G.levelIdx + 1 >= G.unlocked) {
        G.unlocked = Math.min(D.LEVELS.length, G.levelIdx + 2);
      }
      if (G.levelIdx === D.LEVELS.length - 1) G.beatAll = true;
      writeSave();
      MA.Audio.win();
      for (var b = 0; b < 6; b++) {
        setTimeout(function () {
          MA.FX.burst(U.rand(120, 630), U.rand(300, 700), U.pick(['#FFE27A', '#FFB0E0', '#9EF0C4', '#7FD3FF']),
            14, { maxSpeed: 420, kind: 'star' });
        }, b * 130);
      }
      MA.FX.shake(6, 0.4);
    } else {
      MA.Audio.fail();
      MA.FX.shake(14, 0.4);
      MA.FX.text(375, 400, reason, '#FF9D9D', 40);
    }
  }

  /* ---------------- 道具 ---------------- */
  function useProp(pid) {
    if (G.scene !== 'play' || G.ending) return false;
    if (G.level.banned && G.level.banned.indexOf(pid) >= 0) {
      MA.Audio.deny();
      MA.FX.text(375, 720, '本关禁用「' + D.PROP_MAP[pid].name + '」', '#FF9D9D', 30);
      MA.FX.shake(8, 0.25);
      return false;
    }
    if (!G.pool[pid] || G.pool[pid] <= 0) {
      MA.Audio.deny();
      MA.FX.text(375, 760, '这个道具用完了', '#FFB0B0', 30);
      return false;
    }

    if (pid === 'scoop') {
      if (!G.tray.length) {
        MA.Audio.deny();
        MA.FX.text(375, 760, '奶槽是空的', '#FFB0B0', 30);
        return false;
      }
      G.pendingProp = 'scoop';
      MA.Audio.ui();
      MA.FX.text(375, 760, '点奶槽里的一张奶仔，放回奶仓', '#7FD3FF', 28);
      return true;
    }

    if (pid === 'bell') {
      var cnt = MA.Pile.countByChar(G.pile);
      var bestCh = null, bestN = 0;
      for (var ch in cnt) if (cnt[ch] > bestN) { bestN = cnt[ch]; bestCh = ch; }
      if (!bestCh) { MA.Audio.deny(); return false; }
      var list = MA.Pile.floatFamily(G.pile, bestCh);
      G.pool[pid]--;
      G.levelPropsUsed++;
      MA.Audio.bell();
      var chr = D.CHAR_MAP[bestCh];
      MA.FX.text(375, 232, '叮～' + chr.name + ' 全体上浮', '#FFD86B', 32);
      MA.FX.ring(375, 522, 'rgba(255,225,140,0.9)', 40, 260, 0.75, 10);
      for (var i = 0; i < list.length; i++) {
        MA.FX.burst(list[i].x, list[i].y, '#FFE9A8', 6, { maxSpeed: 150, sizeScale: 0.5 });
      }
      MA.FX.shake(4, 0.2);
      return true;
    }

    if (pid === 'lid') {
      var capMax = (G.level.slots || CONF.trayBase) + CONF.lidBonus * CONF.lidMax;
      if (G.capacity >= capMax) {
        MA.Audio.deny();
        MA.FX.text(375, 760, '奶槽已经最大了', '#FFB0B0', 30);
        return false;
      }
      G.capacity += CONF.lidBonus;
      G.lidUsed++;
      G.pool[pid]--;
      G.levelPropsUsed++;
      MA.Audio.lid();
      MA.FX.text(375, 836, '奶槽 +' + CONF.lidBonus + ' 格！', '#9EF0C4', 34);
      MA.FX.ring(375, 940, 'rgba(158,240,196,0.9)', 40, 380, 0.6, 8);
      checkEnd();
      return true;
    }

    if (pid === 'blast') {
      if (!G.tray.length) { MA.Audio.deny(); return false; }
      var chCount = {};
      var j;
      for (j = 0; j < G.tray.length; j++) {
        var c = G.tray[j].ch;
        chCount[c] = (chCount[c] || 0) + 1;
      }
      var bestC = null, bestCN = -1;
      for (var cc in chCount) if (chCount[cc] > bestCN) { bestCN = chCount[cc]; bestC = cc; }
      var idxs = [];
      for (j = 0; j < G.tray.length; j++) {
        if (G.tray[j].ch === bestC) idxs.push(j);
      }
      idxs = idxs.slice(0, 3);
      var positions = idxs.map(function (k) { return traySlot(k, G.capacity); });
      var sorted = idxs.slice().sort(function (a, b) { return b - a; });
      var removed = [];
      for (var s = 0; s < sorted.length; s++) {
        removed.unshift(G.tray[sorted[s]]);
        G.tray.splice(sorted[s], 1);
      }
      for (var p = 0; p < positions.length; p++) {
        G.dies.push({
          ch: removed[p] ? removed[p].ch : 'dan',
          x: positions[p].x, y: positions[p].y,
          t: 0, dur: 0.5, kind: 'blast', size: trayLayout(G.capacity).slot,
          delay: p * 0.04
        });
        MA.FX.burst(positions[p].x, positions[p].y, '#FFD27A', 12, { maxSpeed: 320, kind: 'star' });
        MA.FX.milkBurst(positions[p].x, positions[p].y, 4);
      }
      G.pool[pid]--;
      G.levelPropsUsed++;
      MA.Audio.blast();
      MA.FX.ring(375, 940, 'rgba(255,140,140,0.9)', 20, 300, 0.45, 9);
      MA.FX.shake(12, 0.3);
      vibrate(20);
      resolve();
      checkEnd();
      return true;
    }
    return false;
  }

  function scoopCard(index) {
    if (G.pendingProp !== 'scoop') return false;
    var card = G.tray[index];
    if (!card) return false;

    G.tray.splice(index, 1);
    G.pendingProp = null;
    G.pool.scoop--;
    G.levelPropsUsed++;

    MA.Pile.returnCard(G.pile, card);
    card.inTray = false;
    card.anim = null;

    MA.Audio.scoop();
    MA.FX.ring(card.x, card.y, 'rgba(127,211,255,0.95)', 10, 150, 0.5, 7);
    MA.FX.burst(card.x, card.y, '#BFEBFF', 12, { maxSpeed: 260 });
    MA.FX.text(card.x, card.y - 40, '捞回来啦', '#7FD3FF', 30);
    return true;
  }

  function cancelPending() {
    if (G.pendingProp) { G.pendingProp = null; return true; }
    return false;
  }

  /* ---------------- 每帧更新 ---------------- */
  function update(dt) {
    G.time += dt;
    if (G.introT < 1) G.introT = Math.min(1, G.introT + dt * 1.6);
    if (G.mixFlash > 0) G.mixFlash = Math.max(0, G.mixFlash - dt * 2.2);
    if (G.hl) {
      G.hl.t += dt;
      if (G.hl.t > 0.45) G.hl = null;
    }

    if (G.scene === 'play') {
      if (G.comboTimer > 0) {
        G.comboTimer -= dt;
        if (G.comboTimer <= 0) { G.comboTimer = 0; G.combo = 0; }
      }
      for (var i = G.dies.length - 1; i >= 0; i--) {
        var d = G.dies[i];
        d.t += dt;
        if (d.t > d.dur + (d.delay || 0) + 0.1) G.dies.splice(i, 1);
      }

      if (G.ending) {
        G.endTimer -= dt;
        if (G.endTimer <= 0 && G.scene === 'play') {
          if (G.inTutorial) startLevel(0);
          else if (G.win && G.levelIdx === D.LEVELS.length - 1) beginEnding();
          else G.scene = 'result';
        }
      }
    }

    // 奶力 = 时间条，一路往下掉
    if (G.scene === 'play' && G.started && !G.ending && !G.inTutorial) {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) {
        G.timeLeft = 0;
        finish(false, '奶力枯竭');
      } else {
        milkStageTick();
      }
    }

    if (G.scene === 'ending') G.endT += dt;
    if (G.milkPop) {
      G.milkPop.t += dt;
      if (G.milkPop.t > 2.4) G.milkPop = null;
    }
    if (G.notice) {
      G.notice.t += dt;
      if (G.notice.t > 4.8) G.notice = null;
    }

    MA.FX.update(dt);
  }

  /* 教学：点一下继续 */
  function tutNext() {
    if (!G.inTutorial) return false;
    if (G.tut === -1) { G.tut = 0; return true; }
    if (G.tut >= 2 && G.tut <= 6) { G.tut++; return true; }
    return false;
  }

  /* 进入通关结局 */
  function beginEnding() {
    G.scene = 'ending';
    G.endT = 0;
    MA.FX.clear();
    MA.Audio.bgm('menu');
    MA.Audio.win();
    MA.Audio.milk();
  }

  /* ---------------- 对外 ---------------- */
  MA.Game = {
    state: G,
    trayLayout: trayLayout,
    traySlot: traySlot,
    TRAY_BOX: TRAY_BOX,
    init: function () {
      loadSave();
      MA.Audio.init();
      G.muted = MA.Audio.isMuted();
      G.pool = U.clone(D.POOL_START);
    },
    startRun: startRun,
    startTutorial: startTutorial,
    startLevel: startLevel,
    tutNext: tutNext,
    beginEnding: beginEnding,
    retryLevel: retryLevel,
    nextLevel: nextLevel,
    abandon: abandon,
    pick: pick,
    useProp: useProp,
    scoopCard: scoopCard,
    cancelPending: cancelPending,
    update: update,
    canPick: canPick,
    gotoMenu: function () { G.scene = 'menu'; G.started = false; MA.Audio.bgm('menu'); MA.FX.clear(); },
    gotoLevels: function () { G.scene = 'levels'; MA.Audio.bgm('menu'); },
    toggleMute: function () {
      G.muted = !G.muted;
      MA.Audio.setMuted(G.muted);
    }
  };
})(typeof window !== 'undefined' ? window : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
