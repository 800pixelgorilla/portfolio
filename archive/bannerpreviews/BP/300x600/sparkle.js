/*!
 * Sparkle — animated glints + a holographic sheen over jewelry/nails.
 * Requires GSAP 3 (global `gsap`).
 *
 * SETUP
 *   const sparkle = Sparkle.setup({
 *     container: '#handWrap',          // the element the effect sits on (moves with it)
 *     mask: 'nails_mask.png',          // full-canvas PNG: white where the sheen may show
 *     spots: [[x, y], [x, y, 'gold']]  // glint positions in container px; optional colour
 *   });
 *
 * START
 *   master.add(sparkle.start(), '-=0.2');   // inside your GSAP timeline
 *   sparkle.start();                         // or on its own
 *
 *   With `duration` set, start() returns a timeline that long, so anything you add after
 *   it in your master timeline comes in when the sparkle winds down.
 *
 * END
 *   sparkle.end();    // graceful: no new glints/sweeps, the ones playing finish
 *   sparkle.stop();   // instant: everything gone
 *
 * Put the effect on a wrapper div around your hand PNG and animate the wrapper,
 * so the glints and sheen move with the hand:
 *   <div id="handWrap"><img src="hands.png"></div>
 *
 * OPTIONS (all optional)
 *   duration      seconds the effect runs before winding down (null = forever)
 *
 *   glintMode     'random' (default): each spot pops on its own random timing
 *                 'sheen': spots pop as the sheen passes over them — light catching
 *                 glossy highlights. Good for food/product shots.
 *   sheenGlintChance  in 'sheen' mode, chance a spot pops when the light passes (0.7)
 *   glintSpeed    speed of each glint pop, multiplier (1). 2 = twice as snappy
 *   glintGap      [min, max] seconds between pops for each spot ([0.6, 3])
 *   glintsAtOnce  max glints visible at once (4)
 *   glintSize     glint size in px (22)
 *   heroChance    chance a pop is a bigger "hero" flare, 0–1 (0.2)
 *
 *   colors        glint colours for spots with no colour of their own (pastels)
 *   tones         named colours spots can use: { gold, pink, blue, lavender }
 *   tint          how much colour goes into a coloured star itself, 0–1 (0.2);
 *                 the colour shows mainly in its glow
 *   colorChance   chance a coloured spot shows its colour on a pop, 0–1 (0.3);
 *                 otherwise it pops white
 *
 *   sheen         true/false (true)
 *   sheenDuration seconds per sweep (1.6) — lower = faster sweep
 *   sheenGap      seconds between sweeps (2.2)
 *   sheenDelay    seconds after start before the first sweep (0.4)
 *   sheenAngle    band angle in degrees (25)
 *   sheenWidth    band width as a fraction of the container diagonal (0.35)
 *   sheenOpacity  0–1 (0.6)
 *   sheenColors   colours across the band (holographic by default; warm whites for a gloss)
 *   sheenBlend    CSS blend mode for the sheen: 'normal' (default) or 'screen' (brightens only)
 *
 * Works opened straight from disk: the mask is drawn into a canvas (never read back),
 * so it avoids the file:// blocking that breaks CSS mask-image and SVG filters.
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    container: null, spots: [], mask: null, duration: null,
    glintMode: 'random', sheenGlintChance: 0.7, sheenBlend: 'normal',
    glintSpeed: 1, glintGap: [0.6, 3], glintsAtOnce: 4, glintSize: 22, heroChance: 0.2,
    colors: ['#ffffff', '#ffd6f0', '#b8f4ff', '#ffe9a8', '#e2ccff'],
    tones: { gold: '#ffd24a', pink: '#ff6fd0', blue: '#4fd2ff', lavender: '#b98cff' },
    tint: 0.2, colorChance: 0.3,
    sheen: true, sheenDuration: 1.6, sheenGap: 2.2, sheenDelay: 0.4,
    sheenAngle: 25, sheenWidth: 0.35, sheenOpacity: 0.6,
    sheenColors: ['#ffc4e8', '#c9b8ff', '#a8eeff', '#c8ffd8', '#fff2b0']
  };

  // 4-point star with long thin arms, centred on 0,0 in a 100×100 box
  var STAR = 'M0-50C3-12 12-3 50 0C12 3 3 12 0 50C-3 12-12 3-50 0C-12-3-3-12 0-50Z';
  var NS = 'http://www.w3.org/2000/svg';

  // mix a hex colour toward white; amt 0 = white, 1 = full colour
  function towardWhite(hex, amt) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16);
    return 'rgb(' + [16, 8, 0].map(function (sh) {
      var c = (n >> sh) & 255; return Math.round(255 + (c - 255) * amt);
    }).join(',') + ')';
  }

  function setup(options) {
    if (!root.gsap) throw new Error('Sparkle needs GSAP loaded first.');
    var o = Object.assign({}, DEFAULTS, options);
    o.tones = Object.assign({}, DEFAULTS.tones, options && options.tones);
    var box = typeof o.container === 'string' ? document.querySelector(o.container) : o.container;
    if (!box) throw new Error('Sparkle: container not found.');
    if (box.tagName === 'IMG') throw new Error('Sparkle: container must be a div (wrap your image in one).');
    var W = box.clientWidth, H = box.clientHeight;
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';

    var layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H +
                          'px;pointer-events:none;overflow:hidden';
    box.appendChild(layer);

    var running = false, live = [];   // every tween/delayedCall we start, so stop() can kill them
    function track(t) {
      if (live.length > 150) live = live.filter(function (x) { return x.progress() < 1; });  // drop finished
      live.push(t); return t;
    }

    // ---------- sheen: gradient band drawn into a canvas, cut to the mask
    var ctx = null, maskImg = null, sheenP = { t: 0 };
    if (o.sheen && o.mask) {
      var canvas = document.createElement('canvas');
      var dpr = Math.min(2, root.devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H +
                             'px;mix-blend-mode:' + o.sheenBlend;
      ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      layer.appendChild(canvas);
      maskImg = new Image();
      maskImg.src = o.mask;
    }

    var sa = o.sheenAngle * Math.PI / 180, sdx = Math.cos(sa), sdy = Math.sin(sa);
    function bandCentre(t) {   // band centre along the sweep axis, from corner to corner
      var diag = Math.hypot(W, H), band = diag * o.sheenWidth;
      return -diag / 2 - band + t * (diag + band * 2);
    }

    function drawSheen(t) {
      if (!ctx) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      if (t <= 0 || t >= 1 || !maskImg.complete) return;
      var a = o.sheenAngle * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
      var diag = Math.hypot(W, H), band = diag * o.sheenWidth;
      var c = bandCentre(t);
      var cx = W / 2 + dx * c, cy = H / 2 + dy * c;
      var g = ctx.createLinearGradient(cx - dx * band / 2, cy - dy * band / 2,
                                       cx + dx * band / 2, cy + dy * band / 2);
      var n = o.sheenColors.length;
      g.addColorStop(0, 'rgba(255,255,255,0)');
      o.sheenColors.forEach(function (col, i) { g.addColorStop(0.15 + 0.7 * i / (n - 1), col); });
      g.addColorStop(0.5, 'rgba(255,255,255,0.95)');     // bright core
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = o.sheenOpacity;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-in';   // keep only where the mask is
      ctx.drawImage(maskImg, 0, 0, W, H);
    }

    function sweep() {
      if (!running) return;
      var prevC = bandCentre(0);
      track(gsap.fromTo(sheenP, { t: 0 }, {
        t: 1, duration: o.sheenDuration, ease: 'power1.inOut',
        onUpdate: function () {
          drawSheen(sheenP.t);
          if (o.glintMode === 'sheen') {
            // pop any spot the band centre just passed over
            var c = bandCentre(sheenP.t);
            glints.forEach(function (g) {
              if (g._proj > prevC && g._proj <= c && Math.random() < o.sheenGlintChance) pop(g);
            });
            prevC = c;
          }
        },
        onComplete: function () {
          drawSheen(0);
          if (running) track(gsap.delayedCall(o.sheenGap, sweep));
        }
      }));
    }

    // ---------- glints
    var visible = 0;
    var glints = o.spots.map(function (pt) {
      var s = document.createElementNS(NS, 'svg');
      s.setAttribute('viewBox', '-50 -50 100 100');
      s.innerHTML = '<path d="' + STAR + '" fill="currentColor"/><circle r="9" fill="#fff"/>';
      var sz = o.glintSize;
      s.style.cssText = 'position:absolute;left:' + (pt[0] - sz / 2) + 'px;top:' + (pt[1] - sz / 2) +
                        'px;width:' + sz + 'px;height:' + sz + 'px;overflow:visible;' +
                        'filter:drop-shadow(0 0 2px currentColor) drop-shadow(0 0 5px currentColor)';
      layer.appendChild(s);
      gsap.set(s, { scale: 0, transformOrigin: '50% 50%' });
      s._color = pt[2] ? (o.tones[pt[2]] || pt[2]) : null;
      s._proj = (pt[0] - W / 2) * sdx + (pt[1] - H / 2) * sdy;   // position along the sweep
      return s;
    });

    function popLater(g) {
      if (running && o.glintMode !== 'sheen') track(gsap.delayedCall(gsap.utils.random(o.glintGap[0], o.glintGap[1]), pop, [g]));
    }
    function pop(g) {
      if (!running) return;
      if (visible >= o.glintsAtOnce || g._busy) { popLater(g); return; }
      g._busy = true;
      visible++;
      var path = g.firstChild;
      if (g._color && Math.random() < o.colorChance) {
        // coloured pop: mostly-white star, colour in the glow. Drawn normally,
        // since screen blending would lose the tint over bright jewelry.
        g.style.color = g._color;
        g.style.mixBlendMode = 'normal';
        path.setAttribute('fill', towardWhite(g._color, o.tint));
      } else {
        g.style.color = g._color ? '#fff' : gsap.utils.random(o.colors);
        g.style.mixBlendMode = 'screen';
        path.setAttribute('fill', 'currentColor');
      }
      var hero = Math.random() < o.heroChance, sp = o.glintSpeed;
      track(gsap.timeline({ onComplete: function () { visible--; g._busy = false; popLater(g); } })
        .fromTo(g, { scale: 0, rotation: gsap.utils.random(-20, 20) },
                   { scale: hero ? gsap.utils.random(1.4, 1.9) : gsap.utils.random(0.6, 1.1),
                     rotation: '+=45', duration: (hero ? 0.25 : 0.16) / sp, ease: 'power2.out' })
        .to(g, { scale: 0, rotation: '+=45', duration: (hero ? 0.5 : 0.32) / sp, ease: 'power2.in' }));
    }

    // ---------- controls
    function begin() {
      stop();
      running = true;
      if (o.glintMode !== 'sheen') glints.forEach(function (g, i) {
        track(gsap.delayedCall(i * 0.12 / o.glintSpeed + Math.random() * 0.6, pop, [g]));
      });
      track(gsap.delayedCall(o.sheenDelay, sweep));
    }

    function end() { running = false; }   // nothing new starts; what's playing finishes

    function stop() {
      running = false;
      live.forEach(function (t) { t.kill(); });
      live = [];
      visible = 0;
      glints.forEach(function (g) { g._busy = false; });
      gsap.set(glints, { scale: 0 });
      drawSheen(0);
    }

    function start() {
      var tl = gsap.timeline();
      tl.call(begin);
      if (o.duration != null) tl.call(end, null, o.duration);
      return tl;
    }

    return { start: start, end: end, stop: stop, layer: layer };
  }

  root.Sparkle = { setup: setup };
})(window);
