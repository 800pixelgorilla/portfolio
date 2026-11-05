/*!
 * BurnTransition — burns one banner frame away to reveal the next.
 * Requires GSAP 3 (global `gsap`).
 *
 * SETUP
 *   const burn = BurnTransition.setup({ from: '#frame1' });
 *
 * START
 *   master.add(burn.start(), '+=1');   // inside your GSAP timeline
 *   burn.start();                       // or on its own: plays immediately
 *
 * HOW IT WORKS
 *   When the burn begins, it snapshots `from` into an SVG copy (every <img> with its current
 *   opacity/transform, plus background colours), hides the real element, and burns the copy.
 *   Your frame 2 just needs to sit underneath. The frame's parent is treated as the canvas,
 *   so `from` should be a direct child of your banner (like #frame1 in a normal setup).
 *   Text nodes are not copied — export copy as PNGs, as usual.
 *   Replaying / restarting your master timeline restores the frame automatically.
 *
 * OPTIONS (all optional)
 *   angle      direction the burn travels, degrees. -90 = straight up,
 *              -115 = up and left (enters bottom-right, default), -65 = up and right.
 *   origin     [x, y] exact ignition point instead of `angle` (can be off canvas)
 *   flow       which way the flame licks stretch and stream:
 *              'up' (default) flames always rise; 'travel' = along the burn direction
 *              (use for sideways burns); or a number in degrees (-90 = up, 180 = left)
 *   speed      wipe speed in px per second (average). Overrides duration when set —
 *              handy because different banner sizes cover very different distances
 *   duration   seconds (1.6), used when speed isn't set
 *   ease       GSAP ease ('power1.in')
 *   size       overall scale of the effect (1.8). 1 = finer, 2.5+ = huge
 *   flameSpeed how fast the flame licks stream, px per second (110). 0 = static
 *   noise      optional path to a custom noise texture, e.g. 'burn-noise.jpg'. Default is
 *              the built-in one. NOTE: an external file only works when the banner is served
 *              (ad server, local dev server). Opened from disk, browsers block it and the edge
 *              goes flat. Any seamless tileable image works; red pushes sideways, green along.
 *   noiseScaleX width of the flame licks (1). Bigger = wider shapes
 *   noiseScaleY length of the flame licks (2.5). Bigger = longer, more stretched licks
 *              (X/Y are relative to the flame direction, so they follow `flow`)
 *   fps        burn redraw rate (30); the rest of your animation is unaffected
 *   char       width of the scorched band (18, scaled by size)
 *   glow       width of the orange glow (7, scaled by size)
 *   sparks     true/false (true)
 *   sparkRate  sparks per second (90)
 *   colors     { char, glow, core, spark }
 */
(function (root) {
  'use strict';

  // Built-in noise texture (seamless tile, same as burn-noise.jpg). Used by default because
  // browsers block external images in SVG filters when a banner is opened straight from
  // disk (file://), which leaves the edge as a flat line.
  var NOISE = 'data:image/jpeg;base64,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';

  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  var DEFAULTS = {
    from: null, angle: -115, origin: null, flow: 'up',
    speed: null, duration: 1.6, ease: 'power1.in', size: 1.8, fps: 30,
    flameSpeed: 110, noise: null, noiseScaleX: 1, noiseScaleY: 2.5,
    char: 18, glow: 7, core: 2.5,
    sparks: true, sparkRate: 90,
    colors: { char: '#170b03', glow: '#ff5a00', core: '#ffd23f', spark: '#ffcf5a' }
  };

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function setup(options) {
    if (!root.gsap) throw new Error('BurnTransition needs GSAP loaded first.');
    var o = Object.assign({}, DEFAULTS, options);
    o.colors = Object.assign({}, DEFAULTS.colors, options && options.colors);

    var from = typeof o.from === 'string' ? document.querySelector(o.from) : o.from;
    if (!from) throw new Error('BurnTransition: `from` element not found.');
    var canvas = from.parentNode;
    var W = canvas.clientWidth, H = canvas.clientHeight;
    var id = 'bt' + (++uid);

    // ---- scale everything by size
    var S = o.size, K = S / 1.8;
    var charW = o.char * S, glowW = o.glow * S, coreW = o.core * S;
    var disp = 46 * S;
    var pad = Math.ceil(disp / 2 + 6);
    if (o.rise != null && !(options && 'flameSpeed' in options)) o.flameSpeed = o.rise;  // old name
    var TW = 500 * K * o.noiseScaleX, TH = 500 * K * o.noiseScaleY;   // noise tile size

    // ---- ignition point: far off canvas along the angle, so the edge is a big, gentle arc
    var origin = o.origin;
    if (!origin) {
      var a = o.angle * Math.PI / 180, dist = Math.max(600, 1.6 * Math.hypot(W, H));
      origin = [W / 2 - Math.cos(a) * dist, H / 2 - Math.sin(a) * dist];
    }
    var ox = origin[0], oy = origin[1];
    var maxR = Math.max.apply(null, [[0, 0], [W, 0], [0, H], [W, H]].map(function (c) {
      return Math.hypot(c[0] - ox, c[1] - oy);
    })) + charW + disp;
    var nearest = Math.hypot(ox - Math.min(Math.max(ox, 0), W), oy - Math.min(Math.max(oy, 0), H));
    var startR = Math.max(0, nearest - charW - disp / 2);
    var dur = o.speed ? (maxR - startR) / o.speed : o.duration;

    // ---- build the SVG overlay
    var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none;overflow:hidden';
    var cs0 = getComputedStyle(from);
    if (cs0.zIndex !== 'auto') svg.style.zIndex = cs0.zIndex;

    var defs = el('defs', {}, svg);
    // ---- noise orientation. The noise is built for flames rising (stretched vertically,
    // scrolling up). For other directions the whole burn geometry is drawn in a rotated
    // space, which rotates the noise with it.
    var travelDeg = Math.atan2(H / 2 - oy, W / 2 - ox) * 180 / Math.PI;
    var flowDeg = o.flow === 'travel' ? travelDeg : (typeof o.flow === 'number' ? o.flow : -90);
    var rot = flowDeg + 90, rad = rot * Math.PI / 180, cx0 = W / 2, cy0 = H / 2;
    var rotT = 'rotate(' + rot + ' ' + cx0 + ' ' + cy0 + ')';
    function unrot(x, y) {
      var dx = x - cx0, dy = y - cy0, c = Math.cos(-rad), s = Math.sin(-rad);
      return [cx0 + dx * c - dy * s, cy0 + dx * s + dy * c];
    }
    var ro = unrot(ox, oy), rx = ro[0], ry = ro[1];
    var corners = [[0, 0], [W, 0], [0, H], [W, H]].map(function (c) { return unrot(c[0], c[1]); });
    var xs = corners.map(function (c) { return c[0]; }), ys = corners.map(function (c) { return c[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    // Filter regions: just the canvas (in rotated space) plus the displacement reach
    var region = { filterUnits: 'userSpaceOnUse', x: minX - pad, y: minY - pad,
                   width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };

    var fNoise = el('filter', Object.assign({ id: id + 'n', 'color-interpolation-filters': 'sRGB' }, region), defs);
    // One noise sheet that covers the whole filter area plus one tile of scroll travel.
    // (feTile can't be used: browsers clip a tile bigger than the filter area before
    // repeating it, which leaves blank bands where the edge goes flat.)
    var noiseImg = el('feImage', { x: region.x, y: region.y, width: region.width,
                                   height: region.height + TH, preserveAspectRatio: 'none',
                                   result: 'noise' }, fNoise);
    (function buildNoiseSheet() {
      var src = new Image();
      src.onload = function () {
        try {
          var D = 0.4;   // sheet pixels per unit; the noise is smooth, so low-res is plenty
          var c = document.createElement('canvas');
          c.width = Math.ceil(region.width * D);
          c.height = Math.ceil((region.height + TH) * D);
          var g = c.getContext('2d');
          var pat = g.createPattern(src, 'repeat');
          pat.setTransform(new DOMMatrix().scale(TW * D / src.width, TH * D / src.height));
          g.fillStyle = pat;
          g.fillRect(0, 0, c.width, c.height);
          noiseImg.setAttribute('href', c.toDataURL('image/jpeg', 0.9));
        } catch (e) {
          // A custom noise file opened from disk can't be read back; see the `noise` note above.
          console.warn('BurnTransition: could not prepare noise texture', e);
        }
      };
      src.src = o.noise || NOISE;
    })();
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'noise', scale: disp,
                              xChannelSelector: 'R', yChannelSelector: 'G' }, fNoise);

    var fSoft = el('filter', Object.assign({ id: id + 's' }, region), defs);
    el('feGaussianBlur', { stdDeviation: 3 * S }, fSoft);
    var fEdge = el('filter', Object.assign({ id: id + 'e' }, region), defs);
    el('feGaussianBlur', { stdDeviation: 1.2 * S }, fEdge);

    var mask = el('mask', { id: id + 'm', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
    el('rect', { width: W, height: H, fill: '#fff' }, mask);
    var hole = el('circle', { cx: rx, cy: ry, r: 0, fill: '#000' },
                  el('g', { filter: 'url(#' + id + 'n)' }, el('g', { transform: rotT }, mask)));

    var burning = el('g', { mask: 'url(#' + id + 'm)' }, svg);
    var snap = el('g', {}, burning);
    var fx = el('g', { filter: 'url(#' + id + 'n)' }, el('g', { transform: rotT }, burning));
    var charC = el('circle', { cx: rx, cy: ry, r: 0, fill: o.colors.char, opacity: 0.85 },
                   el('g', { filter: 'url(#' + id + 's)' }, fx));
    var glowC = el('circle', { cx: rx, cy: ry, r: 0, fill: o.colors.glow },
                   el('g', { filter: 'url(#' + id + 'e)' }, fx));
    var coreC = el('circle', { cx: rx, cy: ry, r: 0, fill: o.colors.core }, fx);
    var sparkLayer = el('g', {}, svg);

    canvas.insertBefore(svg, from.nextSibling);

    // ---- snapshot the frame into SVG
    function relPos(e, parent) {
      if (e.offsetParent === parent) return [e.offsetLeft, e.offsetTop];
      if (parent.offsetParent === e.offsetParent) return [e.offsetLeft - parent.offsetLeft, e.offsetTop - parent.offsetTop];
      return [e.offsetLeft, e.offsetTop];
    }
    function walk(e, parent, M, alpha) {
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      var pos = relPos(e, parent);
      var org = cs.transformOrigin.split(' ').map(parseFloat);
      var local = new DOMMatrix().translate(pos[0], pos[1]);
      if (cs.transform && cs.transform !== 'none') {
        local = local.translate(org[0], org[1]).multiply(new DOMMatrix(cs.transform)).translate(-org[0], -org[1]);
      }
      M = M.multiply(local);
      alpha *= parseFloat(cs.opacity);
      if (alpha <= 0.001) return;
      var tf = 'matrix(' + [M.a, M.b, M.c, M.d, M.e, M.f].join(',') + ')';
      var w = e.offsetWidth, h = e.offsetHeight;

      var bg = cs.backgroundColor;
      if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) {
        el('rect', { width: w, height: h, fill: bg, opacity: alpha, transform: tf }, snap);
      }
      if (e.tagName === 'IMG' && (e.currentSrc || e.src)) {
        el('image', { href: e.currentSrc || e.src, width: w, height: h, opacity: alpha,
                      transform: tf, preserveAspectRatio: 'none' }, snap);
      }
      for (var i = 0; i < e.children.length; i++) walk(e.children[i], e, M, alpha);
    }
    function snapshot() {
      while (snap.firstChild) snap.removeChild(snap.firstChild);
      walk(from, canvas, new DOMMatrix(), 1);
    }

    // ---- burn rendering
    var p = { t: 0 }, lastStep = -1;
    function radius() { return startR + p.t * (maxR - startR); }
    function draw(time) {
      var r = radius();
      hole.setAttribute('r', r);
      coreC.setAttribute('r', r + coreW);
      glowC.setAttribute('r', r + glowW);
      charC.setAttribute('r', r + charW);
      noiseImg.setAttribute('y', (region.y - ((time * o.flameSpeed) % TH)).toFixed(1));
    }
    function spawnSpark() {
      var r = radius();
      var toC = Math.atan2(H / 2 - oy, W / 2 - ox);
      var spread = Math.min(Math.PI, Math.hypot(W, H) / Math.max(r, 1));
      var x, y, tries = 0;
      do {
        var a = toC + (Math.random() - 0.5) * spread * 2;
        x = ox + Math.cos(a) * r; y = oy + Math.sin(a) * r;
      } while ((x < 0 || x > W || y < 0 || y > H) && ++tries < 8);
      if (tries >= 8) return;
      var s = el('circle', { cx: x, cy: y, r: gsap.utils.random(0.8, 2.2) * K,
                             fill: Math.random() < 0.3 ? o.colors.core : o.colors.spark }, sparkLayer);
      gsap.to(s, {
        x: gsap.utils.random(-18, 18) * K, y: gsap.utils.random(-80, -30) * K,
        opacity: 0, duration: gsap.utils.random(0.6, 1.3), ease: 'power1.out',
        onComplete: function () { s.remove(); }
      });
    }
    function clearSparks() {
      gsap.killTweensOf(sparkLayer.children);
      while (sparkLayer.firstChild) sparkLayer.removeChild(sparkLayer.firstChild);
    }

    function start() {
      var tl = gsap.timeline();
      tl.call(function () { snapshot(); clearSparks(); lastStep = -1; p.t = 0; draw(0); })
        .set(svg, { display: 'block', immediateRender: false })
        .set(from, { visibility: 'hidden', immediateRender: false })
        .fromTo(p, { t: 0 }, {
          t: 1, duration: dur, ease: o.ease, immediateRender: false,
          onUpdate: function () {
            var step = Math.floor(this.time() * o.fps);
            if (step === lastStep) return;      // redraw at o.fps only
            lastStep = step;
            draw(this.time());
            coreC.setAttribute('opacity', gsap.utils.random(0.75, 1));
            if (o.sparks && p.t < 0.97) {
              var n = o.sparkRate / o.fps;
              var count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
              for (var i = 0; i < count; i++) spawnSpark();
            }
          },
          onComplete: function () { draw(dur); }
        })
        .set(svg, { display: 'none' });   // burn finished: no filter cost from here on
      return tl;
    }

    function reset() {
      clearSparks();
      gsap.set(svg, { display: 'none' });
      gsap.set(from, { visibility: 'visible' });
    }

    function destroy() { reset(); svg.remove(); }

    return { start: start, reset: reset, destroy: destroy, svg: svg };
  }

  root.BurnTransition = { setup: setup };
})(window);
