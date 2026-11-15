/* =========================================================================
 * 奶家军 · 抓奶仔  —  入口与主循环
 * ========================================================================= */
(function (root) {
  var MA = (root.MA = root.MA || {});

  var P = MA.Platform.init();
  MA.Game.init();
  // 先把两首 BGM 挂上开始下载，避免进关卡才开始加载
  try { MA.Audio.preload(); } catch (e) {}

  /* 先把 13 张角色贴图加载完，加载过程中 render 会画进度条 */
  MA.Art.load(null, function () {
    // 首页拼贴背景需要贴图，加载完重建一次缓存
    if (MA.Render && MA.Render.onResize) MA.Render.onResize();
  });

  var lastT = P.now();
  var elapsed = 0;
  var audioChecked = false;

  function step(now) {
    var dt = (now - lastT) / 1000;
    lastT = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.06) dt = 0.06;   // 切后台回来不要一跳
    elapsed += dt;

    var G = MA.Game.state;
    // 推进卡片飞行时间
    for (var i = 0; i < G.tray.length; i++) {
      var c = G.tray[i];
      if (c.anim && c.anim.t < 1) {
        c.anim.t = Math.min(1, c.anim.t + dt / MA.CONF.flyTime);
      }
    }
    MA.Game.update(dt);
    MA.Render.draw(P.ctx, P, elapsed, dt);
    P.raf(step);
  }

  P.onPointer(function (type, x, y) {
    if (type === 'down') {
      MA.Audio.unlock();
      // 首次点击 2 秒后检查：还是没声音就提示用户点一下
      if (!audioChecked) {
        audioChecked = true;
        setTimeout(function () {
          if (!MA.Audio.bgmPlaying() || !MA.Audio.isRunning()) {
            MA.Game.state.audioHint = true;
          }
        }, 2000);
      }
    }
    MA.Render.onPointer(type, x, y);
  });

  /* 调试 / 自动化测试用 */
  root.__MILK = {
    game: MA.Game,
    render: MA.Render,
    platform: P,
    tap: function (x, y) {
      P._emit('down', x * P.view.scale + P.view.ox, y * P.view.scale + P.view.oy);
      P._emit('up', x * P.view.scale + P.view.ox, y * P.view.scale + P.view.oy);
    },
    free: function () {
      return MA.Pile.freeCards(MA.Game.state.pile).map(function (c) { return { x: c.x, y: c.y, ch: c.ch }; });
    }
  };

  P.raf(step);

  // 首屏立刻画一帧，避免白屏
  try { MA.Render.draw(P.ctx, P, 0, 0); } catch (e) {}
})(typeof window !== 'undefined' ? window : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
