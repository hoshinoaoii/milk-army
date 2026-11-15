/* =========================================================================
 * 奶家军 · 抓奶仔  —  平台层
 * 屏蔽浏览器 / 微信小游戏 / 抖音小游戏的差异：
 *   - 画布创建
 *   - 分辨率与缩放
 *   - 指针 / 触摸事件
 *   - 本地存储
 *   - requestAnimationFrame
 * ========================================================================= */
(function (root) {
  var MA = (root.MA = root.MA || {});

  var G = root;
  var hasWX = (typeof G.wx !== 'undefined' && typeof G.wx.createCanvas === 'function');

  var Platform = {
    isWX: hasWX,
    canvas: null,
    ctx: null,
    dpr: 1,
    view: { scale: 1, ox: 0, oy: 0, cw: 0, ch: 0 },

    /* ---------- 创建离屏画布 ---------- */
    createCanvas: function (w, h) {
      var cv;
      if (hasWX) {
        cv = G.wx.createCanvas();
        if (cv) { cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h)); return cv; }
        return null;
      }
      cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w));
      cv.height = Math.max(1, Math.round(h));
      return cv;
    },

    /* ---------- 兼容补丁：小游戏等环境可能缺 ellipse ---------- */
    patchCtx: function (c) {
      if (!c) return c;
      if (!c.ellipse) {
        c.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) {
          this.save();
          this.translate(x, y);
          this.rotate(rot || 0);
          this.scale(Math.abs(rx) || 0.0001, Math.abs(ry) || 0.0001);
          this.arc(0, 0, 1, a0 || 0, a1 === undefined ? Math.PI * 2 : a1, !!ccw);
          this.restore();
        };
      }
      if (!c.setLineDash) c.setLineDash = function () {};
      return c;
    },

    /* ---------- 主画布初始化 ---------- */
    init: function () {
      var V = MA.VIEW;
      if (hasWX) {
        this.canvas = G.wx.createCanvas();
        this.ctx = this.patchCtx(this.canvas.getContext('2d'));
        var info = (G.wx.getSystemInfoSync ? G.wx.getSystemInfoSync() : {});
        this.dpr = info.pixelRatio || 1;
        this.canvas.width = Math.round(info.windowWidth * this.dpr);
        this.canvas.height = Math.round(info.windowHeight * this.dpr);
        this.view.cw = info.windowWidth;
        this.view.ch = info.windowHeight;
        this._bindWXTouch();
      } else {
        this.canvas = document.getElementById('game');
        this.ctx = this.patchCtx(this.canvas.getContext('2d'));
        this._resize();
        var self = this;
        window.addEventListener('resize', function () { self._resize(); });
        window.addEventListener('orientationchange', function () { setTimeout(function () { self._resize(); }, 120); });
        this._bindDOMInput();
      }
      this._applyTransform();
      return this;
    },

    _resize: function () {
      var cw = window.innerWidth || 750;
      var ch = window.innerHeight || 1334;
      // 宽屏时限制画布本身的像素数量，避免超宽屏浪费
      this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.view.cw = cw;
      this.view.ch = ch;
      this.canvas.width = Math.round(cw * this.dpr);
      this.canvas.height = Math.round(ch * this.dpr);
      this.canvas.style.width = cw + 'px';
      this.canvas.style.height = ch + 'px';
      this._applyTransform();
      if (MA.Game && MA.Game.onResize) MA.Game.onResize();
      if (MA.Render && MA.Render.onResize) MA.Render.onResize();
    },

    _applyTransform: function () {
      var V = MA.VIEW, v = this.view;
      v.scale = Math.min(v.cw / V.W, v.ch / V.H);
      v.ox = (v.cw - V.W * v.scale) / 2;
      v.oy = (v.ch - V.H * v.scale) / 2;
    },

    /* 客户区坐标 → 逻辑坐标 */
    toLogical: function (cx, cy) {
      var v = this.view;
      return { x: (cx - v.ox) / v.scale, y: (cy - v.oy) / v.scale };
    },

    /* ---------- 输入 ---------- */
    _handlers: [],
    onPointer: function (fn) { this._handlers.push(fn); },

    _emit: function (type, cx, cy) {
      var p = this.toLogical(cx, cy);
      for (var i = 0; i < this._handlers.length; i++) this._handlers[i](type, p.x, p.y);
    },

    _bindDOMInput: function () {
      var self = this;
      var cv = this.canvas;
      var down = false;

      function pos(e) {
        var r = cv.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }

      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        down = true;
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        var p = pos(e);
        self._emit('down', p.x, p.y);
      }, { passive: false });

      cv.addEventListener('pointermove', function (e) {
        var p = pos(e);
        self._emit('move', p.x, p.y);
      }, { passive: true });

      cv.addEventListener('pointerup', function (e) {
        if (!down) return;
        down = false;
        var p = pos(e);
        self._emit('up', p.x, p.y);
      }, { passive: true });

      cv.addEventListener('pointercancel', function () { down = false; self._emit('up', -1, -1); }, { passive: true });

      // 阻止双击缩放 / 长按选择
      cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    },

    _bindWXTouch: function () {
      var self = this;
      if (!G.wx.onTouchStart) return;
      G.wx.onTouchStart(function (e) {
        var t = e.touches && e.touches[0];
        if (t) self._emit('down', t.clientX, t.clientY);
      });
      G.wx.onTouchMove(function (e) {
        var t = e.touches && e.touches[0];
        if (t) self._emit('move', t.clientX, t.clientY);
      });
      G.wx.onTouchEnd(function (e) {
        var t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
        if (t) self._emit('up', t.clientX, t.clientY);
        else self._emit('up', -1, -1);
      });
    },

    /* ---------- 存储 ---------- */
    storage: {
      get: function (k, def) {
        try {
          var v;
          if (hasWX && G.wx.getStorageSync) v = G.wx.getStorageSync('milkArmy_' + k);
          else v = window.localStorage.getItem('milkArmy_' + k);
          if (v === '' || v === null || v === undefined) return def;
          return typeof v === 'string' ? JSON.parse(v) : v;
        } catch (e) { return def; }
      },
      set: function (k, val) {
        try {
          var s = JSON.stringify(val);
          if (hasWX && G.wx.setStorageSync) G.wx.setStorageSync('milkArmy_' + k, s);
          else window.localStorage.setItem('milkArmy_' + k, s);
        } catch (e) {}
      }
    },

    /* ---------- 时间 ---------- */
    now: function () {
      if (G.performance && G.performance.now) return G.performance.now();
      return Date.now();
    },

    raf: function (fn) {
      if (G.requestAnimationFrame) return G.requestAnimationFrame(fn);
      return setTimeout(function () { fn(Date.now()); }, 16);
    }
  };

  MA.Platform = Platform;
})(typeof window !== 'undefined' ? window : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
