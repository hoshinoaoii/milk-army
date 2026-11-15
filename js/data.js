/* =========================================================================
 * 奶家军 · 抓奶仔  —  数据层
 *
 * v3 改动：
 *   - 角色直接用从参考图抠出来的 PNG（14 个，不含豆奶）
 *   - 去掉奶系 / 去掉混编奶阵：只剩「同族 ×3」
 *   - 奶槽固定 8 格，不再用槽位长度当难度杠杆
 *   - 每关内部有难度递进：上层牌型简单，越往下种类越多
 * ========================================================================= */
(function (root) {
  var MA = (root.MA = root.MA || {});

  MA.VIEW = { W: 750, H: 1334 };

  /* ---------- 奶家军 13 个成员（img 对应 assets/chars/<id>.png） ---------- */
  var CHARS = [
    { id: 'dan',   name: '奶蛋',       intro: '码得整整齐齐的圆蛋' },
    { id: 'shu',   name: '奶鼠',       intro: '偷奶盖的仓库小贼' },
    { id: 'dou',   name: '奶豆',       intro: '体型最小的豆豆兵' },
    { id: 'gou',   name: '奶狗',       intro: '一直在笑的傻狗' },
    { id: 'fen',   name: '奶粉',       intro: '粉红色的奶粉罐罐' },
    { id: 'ji',    name: '奶鸡',       intro: '能下奶蛋的鸡妈妈' },
    { id: 'mao',   name: '奶猫',       intro: '比较冷门的奶酪猫' },
    { id: 'shi',   name: '奶屎',       intro: '造型有争议，但真的可爱' },
    { id: 'tu',    name: '奶兔',       intro: '耳朵比谁都长的兔子' },
    { id: 'yu',    name: '奶鱼',       intro: '在奶缸里咕噜的鱼' },
    { id: 'cha',   name: '奶茶',       intro: '捧着珍珠的奶茶杯' },
    { id: 'ping',  name: '奶瓶',       intro: '装满温奶的补给兵' },
    { id: 'sigma', name: '西格玛奶蛙', intro: '抱臂而立的练家子' }
  ];

  var CHAR_MAP = {};
  CHARS.forEach(function (c) { CHAR_MAP[c.id] = c; });

  /* ---------- 道具（整局共用） ---------- */
  var PROPS = [
    {
      id: 'scoop', name: '奶勺', icon: 'scoop', color: '#7FD3FF',
      desc: '从奶槽里捞出一张奶仔，放回奶仓最上层，重新抓。'
    },
    {
      id: 'bell', name: '奶铃', icon: 'bell', color: '#FFCF5C',
      desc: '摇铃后，奶仓里数量最多的一种奶仔全部浮到最上层，方便连续抓取。'
    },
    {
      id: 'lid', name: '奶盖', icon: 'lid', color: '#9EF0C4',
      desc: '给奶槽加装奶盖，本关奶槽永久 +2 格。'
    },
    {
      id: 'blast', name: '奶爆', icon: 'blast', color: '#FF8E8E',
      desc: '引爆奶槽里数量最多的那一类，炸掉最多 3 张。'
    }
  ];
  var PROP_MAP = {};
  PROPS.forEach(function (p) { PROP_MAP[p.id] = p; });

  var POOL_START = { scoop: 3, bell: 3, lid: 3, blast: 3 };

  /* ---------- 常用角色池（共 13 个角色，按难度递增） ---------- */
  var P3 = ['dan', 'shu', 'gou'];
  var P4 = ['dan', 'shu', 'gou', 'dou'];
  var P5 = ['dan', 'shu', 'dou', 'gou', 'ji'];
  var P6 = ['dan', 'shu', 'dou', 'gou', 'ji', 'mao'];
  var P7 = ['dan', 'shu', 'dou', 'fen', 'gou', 'ji', 'mao'];
  var P9 = ['dan', 'shu', 'dou', 'fen', 'gou', 'ji', 'mao', 'tu', 'yu'];
  var P10 = ['dan', 'shu', 'dou', 'fen', 'gou', 'ji', 'mao', 'tu', 'yu', 'cha'];
  var P12 = ['dan', 'shu', 'dou', 'fen', 'gou', 'ji', 'mao', 'tu', 'yu', 'cha', 'ping', 'sigma'];
  var P13 = ['dan', 'shu', 'dou', 'gou', 'fen', 'ji', 'mao', 'shi', 'tu', 'yu', 'cha', 'ping', 'sigma'];

  /* ---------- 关卡 ----------
   * groups : 三张一组的组数 → 总牌数 = groups * 3
   * ramp   : [[组数, 角色池], ...] —— 按"从上到下"的顺序分配，
   *          越靠前的组越少种类 = 越简单，越往后越杂 = 越难
   * slots  : 奶槽格数（固定 8）
   * layers : 堆叠层数
   */
  /* 奶力 = 时间条：每关的时长（秒） */
  var LEVELS = [
    {
      id: 1, name: '初识奶家军',
      groups: 9, layers: 3, slots: 8, minFree: 7, spread: 0.94,
      ramp: [[9, P3]], time: 60,
      tag: '入门'
    },
    {
      id: 2, name: '奶家军扩张',
      groups: 12, layers: 4, slots: 8, minFree: 6, spread: 0.98,
      ramp: [[5, P3], [7, P6]], time: 120,
      tag: '进阶'
    },
    {
      id: 3, name: '奶家军混战',
      groups: 18, layers: 5, slots: 8, minFree: 5, spread: 1.0,
      ramp: [[5, P4], [6, P9], [7, P12]], time: 120,
      tag: '陡增'
    },
    {
      id: 4, name: '奶家军暴走',
      groups: 50, layers: 6, slots: 7, minFree: 4, spread: 1.02,
      ramp: [[6, P5], [10, P10], [34, P13]], time: 300,
      tag: '地狱'
    },
    {
      id: 5, name: '奶家军试炼',
      groups: 80, layers: 7, slots: 7, minFree: 2, spread: 1.04,
      ramp: [[4, P4], [10, P9], [66, P13]], time: 360,
      banned: ['lid'],
      tag: '不可能'
    }
  ];

  /* 奶力（时间）掉到下一段时，随机角色跳出来说的话 */
  var ENCOURAGE = [
    '加油，还来得及！',
    '别慌，慢慢来。',
    '稳住，你可以的！',
    '再快一点点！',
    '奶家军相信你！',
    '还差一点点，冲！',
    '手感来了，继续！',
    '别停，接着抓！'
  ];
  var WARNING = [
    '奶力快枯竭了，加把劲！',
    '奶力不多了，加速！',
    '快没奶力了，冲啊！'
  ];

  /* 新手教学用的迷你关卡 */
  var TUTORIAL = {
    id: 0, name: '新手教学', tutorial: true,
    groups: 3, layers: 3, slots: 8, minFree: 6, spread: 0.66,
    ramp: [[3, ['dan', 'shu', 'gou']]]
  };

  /* ---------- 全局手感参数 ---------- */
  MA.CONF = {
    trayBase: 8,
    lidBonus: 2,
    lidMax: 2,
    scoreTriple: 100,
    timePerTriple: 1,      // 每消一组 +1 秒
    milkMax: 100,
    comboWindow: 6.0,
    comboMax: 8,
    sourPenalty: 120,
    flyTime: 0.26
  };

  MA.DATA = {
    CHARS: CHARS,
    CHAR_MAP: CHAR_MAP,
    PROPS: PROPS,
    PROP_MAP: PROP_MAP,
    LEVELS: LEVELS,
    TUTORIAL: TUTORIAL,
    ENCOURAGE: ENCOURAGE,
    WARNING: WARNING,
    POOL_START: POOL_START,
    chr: function (id) { return CHAR_MAP[id]; }
  };

  /* 工具函数 */
  MA.util = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    easeOutCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    easeOutBack: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    easeInOutQuad: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    randInt: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    shuffle: function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    },
    clone: function (o) {
      var r = {};
      for (var k in o) r[k] = o[k];
      return r;
    }
  };
})(typeof window !== 'undefined' ? window : (typeof GameGlobal !== 'undefined' ? GameGlobal : this));
