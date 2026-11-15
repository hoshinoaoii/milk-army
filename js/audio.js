/* =========================================================================
 * 奶家军 · 抓奶仔  —  音效层
 * 全部用 WebAudio 实时合成，不加载任何音频文件（包体 0 成本）。
 * ========================================================================= */
(function (root) {
  var MA = (root.MA = root.MA || {});
  var G = root;

  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var muted = false;

  function createCtx() {
    if (ctx) return ctx;
    var AC = null;
    if (typeof G.AudioContext !== 'undefined') AC = G.AudioContext;
    else if (typeof G.webkitAudioContext !== 'undefined') AC = G.webkitAudioContext;
    else if (typeof G.wx !== 'undefined' && G.wx.createWebAudioContext) {
      try { AC = function () { return G.wx.createWebAudioContext(); }; } catch (e) { AC = null; }
    }
    if (!AC) return null;
    try {
      ctx = (AC.prototype ? new AC() : AC());
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function getNoise() {
    if (noiseBuf || !ctx) return noiseBuf;
    var len = Math.floor(ctx.sampleRate * 0.7);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return noiseBuf;
  }

  function tone(opt) {
    var c = createCtx();
    if (!c || muted) return;
    var t0 = c.currentTime + (opt.delay || 0);
    var dur = opt.dur || 0.15;
    var o = c.createOscillator();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(opt.freq, t0);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t0 + dur);
    var g = c.createGain();
    var peak = (opt.gain === undefined ? 0.18 : opt.gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opt.attack || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function noise(opt) {
    var c = createCtx();
    if (!c || muted) return;
    var src = c.createBufferSource();
    src.buffer = getNoise();
    var f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(opt.freq || 1800, c.currentTime);
    if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, c.currentTime + (opt.dur || 0.3));
    var g = c.createGain();
    var peak = opt.gain === undefined ? 0.2 : opt.gain;
    g.gain.setValueAtTime(peak, c.currentTime + (opt.delay || 0));
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (opt.delay || 0) + (opt.dur || 0.3));
    src.connect(f); f.connect(g); g.connect(master);
    src.start(c.currentTime + (opt.delay || 0));
    src.stop(c.currentTime + (opt.delay || 0) + (opt.dur || 0.3) + 0.02);
  }

  /* ------------------------------------------------------------------ */
  /* 奶蛙语音：奶力掉一格时随机播一条                                    */
  /* ------------------------------------------------------------------ */
  var VOICES = [
    'v0_laugh', 'v1_andi', 'v2_shrimp',
    'v3_wule', 'v4_ganbadie', 'v5_jiucai'
  ];
  var VOICE_DIR = 'assets/audio/voice/';
  var voiceEls = [null, null, null, null, null, null];
  var lastVoice = -1;
  var warmed = false;

  function voiceURL(i) {
    var p = VOICE_DIR + VOICES[i] + '.mp3';
    // 浏览器里相对路径也能用；小游戏必须是包内相对路径
    return p;
  }

  function getVoice(i) {
    if (voiceEls[i]) return voiceEls[i];
    var el = null;
    try {
      if (typeof wx !== 'undefined' && wx.createInnerAudioContext) {
        el = wx.createInnerAudioContext();
        el.src = voiceURL(i);
        el.volume = 0.85;
      } else if (root && root.Audio) {
        el = new root.Audio(voiceURL(i));
        el.preload = 'auto';
        el.volume = 0.85;
      }
    } catch (e) { el = null; }
    voiceEls[i] = el;
    return el;
  }

  /* iOS 允许"用户手势里播放过一次"的元素之后随时播放，这里先静音预热一遍 */
  function warmVoices() {
    // 只预热 1 个：iOS 同时播多个媒体元素会占满配额，反而把 BGM 挤掉
    var el = getVoice(0);
    if (!el || typeof el.play !== 'function') return;
    try {
      el.volume = 0;
      var pr = el.play();
      if (pr && pr.then) pr.then(function () { }, function () { });
      if (typeof el.pause === 'function') el.pause();
    } catch (e) {}
  }

  function playVoice() {
    if (muted) return;
    var n = VOICES.length;
    var i = Math.floor(Math.random() * n);
    if (n > 1 && i === lastVoice) i = (i + 1) % n;   // 避免连着放同一条
    lastVoice = i;

    var el = getVoice(i);
    if (!el) return;
    try {
      el.volume = 0.85;
      // wx.InnerAudioContext 有 stop()；HTMLAudioElement 只有 pause()
      if (typeof el.stop === 'function') el.stop();
      else if (typeof el.pause === 'function') el.pause();
      if (el.currentTime !== undefined) el.currentTime = 0;
      var pr = el.play();
      if (pr && pr.then) pr.then(function () { }, function () { });
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  /* 背景音乐：界面 1 首 + 每关各 1 首，循环播放                          */
  /* ------------------------------------------------------------------ */
  var BGM_DIR = 'assets/audio/bgm/';
  var BGM_IDS = ['menu', 'level'];
  var BGM_VOL = 0.30;
  var bgmEls = {};
  var bgmCur = null;

  function getBgm(id) {
    if (bgmEls[id]) return bgmEls[id];
    var el = null;
    var url = BGM_DIR + id + '.mp3';
    try {
      if (typeof wx !== 'undefined' && wx.createInnerAudioContext) {
        el = wx.createInnerAudioContext();
        el.src = url;
        el.loop = true;
        el.volume = 0;
      } else if (root && root.Audio) {
        el = new root.Audio(url);
        el.loop = true;
        el.preload = 'auto';
        el.volume = 0;
      }
    } catch (e) { el = null; }
    bgmEls[id] = el;
    return el;
  }

  function fadeTo(el, target, ms) {
    if (!el) return;
    if (el._fade) { clearInterval(el._fade); el._fade = null; }
    var from = el.volume || 0;
    var t0 = Date.now();
    el._fade = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      try { el.volume = Math.max(0, Math.min(1, from + (target - from) * k)); } catch (e) {}
      if (k >= 1) { clearInterval(el._fade); el._fade = null; }
    }, 40);
  }

  function playBgm(id) {
    if (bgmCur === id) {
      // 已经在放这首，确保音量正确
      var cur = bgmEls[id];
      if (cur) fadeTo(cur, muted ? 0 : BGM_VOL, 200);
      return;
    }

    var el = getBgm(id);
    if (!el) return;

    var prev = bgmCur ? bgmEls[bgmCur] : null;
    bgmCur = id;

    // 新曲子先叫起来，它一旦真的出声，再把旧的停掉 ——
    // 这样即使新曲子还在缓冲，也不会出现一段"完全没声音"的空档
    try {
      if (el.currentTime !== undefined) el.currentTime = 0;
      el.volume = 0;
      var pr = el.play();
      if (pr && pr.then) pr.then(function () { }, function () { });
      fadeTo(el, muted ? 0 : BGM_VOL, 600);
    } catch (e) {}

    var handoff = function () {
      try { el.removeEventListener('playing', handoff); } catch (e) {}
      if (prev && prev !== el) {
        fadeTo(prev, 0, 220);
        setTimeout(function () { try { prev.pause(); } catch (e) {} }, 280);
      }
    };

    try {
      el.addEventListener('playing', handoff);
      // 兜底：2.5 秒还没等到 playing 也把旧的停掉，避免两首叠在一起
      setTimeout(function () {
        try { el.removeEventListener('playing', handoff); } catch (e) {}
        if (prev && prev !== el && el.paused === false) handoff();
      }, 2500);
    } catch (e) {
      if (prev && prev !== el) { fadeTo(prev, 0, 220); }
    }
  }

  function stopBgm() {
    if (!bgmCur) return;
    var el = bgmEls[bgmCur];
    bgmCur = null;
    if (el) { fadeTo(el, 0, 220); }
  }

  function applyMuteToBgm() {
    if (!bgmCur) return;
    var el = bgmEls[bgmCur];
    if (el) fadeTo(el, muted ? 0 : BGM_VOL, 150);
  }

  var Audio = {    unlock: function () {
      var c = createCtx();
      if (c && c.state === 'suspended' && c.resume) c.resume();
      if (!warmed) { warmed = true; warmVoices(); }

      // 该响的 BGM 没响（iOS / 微信里的常见情况），每次点击都补一次
      if (bgmCur && bgmEls[bgmCur]) {
        var e0 = bgmEls[bgmCur];
        try {
          if (e0.paused && typeof e0.play === 'function') {
            var p0 = e0.play();
            if (p0 && p0.then) p0.then(function () { }, function () { });
          }
        } catch (e1) {}
      } else if (!bgmCur) {
        // 首次用户手势里把背景音乐拉起来；延后一点，避免刚开局就闪一下界面曲
        setTimeout(function () { if (!bgmCur) playBgm('menu'); }, 350);
      }
    },
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.55;
      applyMuteToBgm();
      MA.Platform.storage.set('muted', muted);
    },
    isMuted: function () { return muted; },
    init: function () {
      muted = !!MA.Platform.storage.get('muted', false);
    },

    /* ---------- 状态自检 ---------- */
    isRunning: function () { var c = createCtx(); return !!(c && c.state === 'running'); },
    bgmPlaying: function () {
      var e = bgmCur ? bgmEls[bgmCur] : null;
      return !!(e && !e.paused && e.currentTime > 0);
    },
    bgmId: function () { return bgmCur; },

    /* ---------- 背景音乐 ---------- */
    /* 页面一打开就把两首曲子挂上开始缓冲，等玩家点进关卡时就不用等下载 */
    preload: function () {
      for (var i = 0; i < BGM_IDS.length; i++) {
        var el = getBgm(BGM_IDS[i]);
        if (!el) continue;
        try {
          if (typeof el.load === 'function') el.load();
        } catch (e) {}
      }
    },
    bgmReady: function (id) {
      var el = bgmEls[id];
      if (!el) return 0;
      try { return el.readyState; } catch (e) { return 0; }
    },
    bgm: function (id) { playBgm(id); },
    bgmStop: function () { stopBgm(); },
    bgmScene: function (scene) {
      if (scene === 'play') playBgm('level');
      else playBgm('menu');
    },

    /* ---------- 奶蛙语音包 ---------- */
    voice: function () { playVoice(); },

    /* ---------- 具体音效 ---------- */
    ui: function () {
      tone({ freq: 620, dur: 0.07, type: 'triangle', gain: 0.10 });
    },
    pick: function (idx) {
      var f = 480 + (idx || 0) * 34;
      tone({ freq: f, dur: 0.11, type: 'sine', gain: 0.16, to: f * 1.7 });
      tone({ freq: f * 2, dur: 0.06, type: 'triangle', gain: 0.05, delay: 0.01 });
    },
    deny: function () {
      tone({ freq: 190, dur: 0.13, type: 'square', gain: 0.10, to: 120 });
    },
    triple: function (combo) {
      var base = 523.25;
      var steps = [0, 4, 7, 12];
      for (var i = 0; i < steps.length; i++) {
        tone({
          freq: base * Math.pow(2, steps[i] / 12),
          dur: 0.22, type: 'triangle', gain: 0.13,
          delay: i * 0.055
        });
      }
      if (combo > 1) {
        tone({ freq: 300, dur: 0.35, type: 'sine', gain: 0.10, delay: 0.02, to: 600 });
      }
    },
    mix: function () {
      var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      for (var i = 0; i < notes.length; i++) {
        tone({ freq: notes[i], dur: 0.55, type: 'sine', gain: 0.11, delay: i * 0.045 });
        tone({ freq: notes[i] * 2, dur: 0.3, type: 'triangle', gain: 0.03, delay: i * 0.045 });
      }
      noise({ freq: 4000, to: 900, dur: 0.5, gain: 0.06 });
    },
    bell: function () {
      tone({ freq: 1174.7, dur: 0.9, type: 'sine', gain: 0.13 });
      tone({ freq: 1760, dur: 0.7, type: 'sine', gain: 0.07, delay: 0.01 });
      tone({ freq: 2349.3, dur: 0.5, type: 'sine', gain: 0.04, delay: 0.02 });
      tone({ freq: 587.3, dur: 1.0, type: 'sine', gain: 0.06 });
    },
    blast: function () {
      noise({ freq: 2600, to: 160, dur: 0.45, gain: 0.24 });
      tone({ freq: 160, dur: 0.4, type: 'sawtooth', gain: 0.14, to: 45 });
    },
    scoop: function () {
      noise({ freq: 700, to: 3200, dur: 0.24, gain: 0.10 });
      tone({ freq: 330, dur: 0.16, type: 'sine', gain: 0.09, to: 660 });
    },
    lid: function () {
      tone({ freq: 660, dur: 0.10, type: 'triangle', gain: 0.12 });
      tone({ freq: 990, dur: 0.14, type: 'triangle', gain: 0.10, delay: 0.08 });
    },
    milk: function () {
      tone({ freq: 880, dur: 0.2, type: 'sine', gain: 0.10, to: 1320 });
      tone({ freq: 1320, dur: 0.3, type: 'sine', gain: 0.08, delay: 0.09, to: 1760 });
    },
    fail: function () {
      var seq = [392, 329.6, 261.6, 196];
      for (var i = 0; i < seq.length; i++) {
        tone({ freq: seq[i], dur: 0.3, type: 'sawtooth', gain: 0.09, delay: i * 0.11 });
      }
      noise({ freq: 900, to: 200, dur: 0.6, gain: 0.08, delay: 0.1 });
    },
    win: function () {
      var seq = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < seq.length; i++) {
        tone({ freq: seq[i], dur: 0.28, type: 'triangle', gain: 0.12, delay: i * 0.09 });
      }
      tone({ freq: 1046.5, dur: 0.9, type: 'sine', gain: 0.10, delay: 0.42 });
      tone({ freq: 1568, dur: 0.9, type: 'sine', gain: 0.05, delay: 0.42 });
    }
  };

  MA.Audio = Audio;
})(typeof window !== 'undefined' ? window : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
