const h = Math.PI / 180;
function Pt(t, s) {
  let o, a;
  return s >= 1 ? (o = t, a = t / s) : (a = t, o = t * s), {
    fovWidth: o,
    fovHeight: a,
    scaleX: Math.sin(o * 0.5),
    scaleY: Math.sin(a * 0.5)
  };
}
function Jt(t) {
  let s = 1e-3 * h, o = Math.PI;
  for (let a = 0; a < 40; a++) {
    const i = (s + o) * 0.5, { scaleX: r, scaleY: u } = Pt(i, t);
    Math.hypot(r, u) <= 1 + 1e-9 ? s = i : o = i;
  }
  return s;
}
function Qt(t, s, o, a, i, r = 0) {
  if (!(t != null && t.pix2world) || s < 2 || o < 2) return null;
  if (a == null || i == null) {
    const [e, I] = t.getRaDec();
    a = e * h, i = I * h;
  }
  const u = s * 0.5, l = o * 0.5, d = Math.max(4, s * 0.02), g = Math.max(4, o * 0.02), v = Math.cos(r), E = Math.sin(r);
  function b(e, I) {
    const [q, X] = t.pix2world(e, I), { l: y, m: J } = Kt(q * h, X * h, a, i);
    return r === 0 ? { l0: y, m0: J } : { l0: y * v - J * E, m0: y * E + J * v };
  }
  const C = b(u + d, l), Y = b(u - d, l), O = b(u, l - g), H = b(u, l + g), R = 4 * d / s, W = 4 * g / o, x = Math.abs(C.l0 - Y.l0) / R, P = Math.abs(O.m0 - H.m0) / W;
  return !Number.isFinite(x) || !Number.isFinite(P) || x < 1e-15 || P < 1e-15 ? null : { scaleX: x, scaleY: P };
}
function jt(t, s, o) {
  return (o == null ? void 0 : o.scaleX) > 0 && (o == null ? void 0 : o.scaleY) > 0 ? o : Pt(t, s);
}
function te(t, s, o, a, i = 0) {
  const r = -t * o, u = s * a;
  if (i === 0) return { l: r, m: u };
  const l = Math.cos(i), d = Math.sin(i);
  return {
    l: r * l + u * d,
    m: -r * d + u * l
  };
}
function ee(t, s, o, a, i = 0) {
  let r = t, u = s;
  if (i !== 0) {
    const l = Math.cos(i), d = Math.sin(i);
    r = t * l - s * d, u = t * d + s * l;
  }
  return { x: -r / o, y: u / a };
}
function Kt(t, s, o, a) {
  const i = t - o, r = Math.sin(s), u = Math.cos(s), l = Math.sin(a), d = Math.cos(a), g = Math.cos(i), v = r * l + u * d * g, E = u * Math.sin(i), b = r * d - u * l * g;
  return { l: E, m: b, visible: v > 0 };
}
function ne(t, s, o, a) {
  const i = Math.sqrt(t * t + s * s);
  if (i > 1) return null;
  const r = Math.sin(a), u = Math.cos(a);
  let l, d;
  if (i === 0)
    l = a, d = o;
  else {
    const g = Math.sqrt(1 - i * i);
    l = Math.asin(g * r + s * u / i * i);
    const v = i;
    l = Math.asin(g * r + s * u * v / i), d = o + Math.atan2(t * v, i * u * g - s * r * v);
  }
  return { ra: d, dec: l };
}
function gt(t, s, o, a, i, r, u = null, l = 0) {
  const { scaleX: d, scaleY: g } = jt(i, r, u), { l: v, m: E } = te(t, s, d, g, l);
  return Math.hypot(v, E) > 1 ? null : ne(v, E, o, a);
}
function oe(t, s, o, a, i, r, u = null, l = 0) {
  const { l: d, m: g, visible: v } = Kt(t, s, o, a);
  if (!v) return null;
  const { scaleX: E, scaleY: b } = jt(i, r, u);
  if (E < 1e-15 || b < 1e-15) return { x: 0, y: 0 };
  const { x: C, y: Y } = ee(d, g, E, b, l);
  return Math.hypot(d, g) > 1 + 1e-12 ? null : { x: C, y: Y };
}
function re(t, s, o, a, i, r, u, l, d = {}) {
  const g = d.scales ?? null, v = d.rotationRad ?? 0, E = gt(t, s, i, r, u, l, g, v), b = gt(o, a, i, r, u, l, g, v);
  if (!E || !b) return null;
  let C = E.ra - b.ra;
  C > Math.PI && (C -= 2 * Math.PI), C < -Math.PI && (C += 2 * Math.PI);
  const Y = d.invertHorizontalPan === !1 ? 1 : -1, O = -Math.PI / 2 + 1e-3, H = Math.PI / 2 - 1e-3;
  return {
    viewRA: i + Y * C,
    viewDec: Math.max(O, Math.min(H, r + E.dec - b.dec))
  };
}
function ae() {
  const t = [
    [0, 0, 0, 4],
    [32, 31, 2, 67],
    [64, 84, 3, 104],
    [96, 136, 17, 90],
    [128, 186, 54, 58],
    [160, 227, 100, 26],
    [192, 250, 150, 6],
    [224, 253, 205, 41],
    [255, 252, 255, 164]
  ], s = new Uint8Array(256 * 4);
  for (let o = 0; o < 256; o++) {
    let a = 0;
    for (let l = 0; l < t.length - 1; l++) o >= t[l][0] && (a = l);
    const i = Math.min(a + 1, t.length - 1), r = t[i][0] - t[a][0] || 1, u = (o - t[a][0]) / r;
    s[o * 4] = t[a][1] + u * (t[i][1] - t[a][1]) | 0, s[o * 4 + 1] = t[a][2] + u * (t[i][2] - t[a][2]) | 0, s[o * 4 + 2] = t[a][3] + u * (t[i][3] - t[a][3]) | 0, s[o * 4 + 3] = 255;
  }
  return s;
}
const ie = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0, 1); }
`, ce = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform sampler2D u_cmap;
uniform vec2 u_crval, u_cdelt, u_crpix, u_imageSize, u_viewCenter, u_resolution;
uniform vec2 u_viewScale;
uniform float u_viewRotation, u_fov, u_opacity;
uniform int u_stretch, u_showGrid;
uniform vec2 u_crosshairScreen;  // NDC; x < -900 = hidden
out vec4 fragColor;

// Auto-scale grid interval based on FOV
float gridInterval(float fovDeg) {
    if (fovDeg > 90.0) return 30.0;
    if (fovDeg > 30.0) return 10.0;
    if (fovDeg > 10.0) return 5.0;
    if (fovDeg > 3.0) return 1.0;
    if (fovDeg > 1.0) return 0.5;
    return 0.1;
}

void main() {
    vec2 screen = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
    float scaleX = u_viewScale.x;
    float scaleY = u_viewScale.y;
    float l0 = -screen.x * scaleX;
    float m0 = screen.y * scaleY;
    float cr = cos(u_viewRotation);
    float sr = sin(u_viewRotation);
    float lV = l0 * cr + m0 * sr;
    float mV = -l0 * sr + m0 * cr;
    float r = sqrt(lV*lV + mV*mV);
    if (r > 1.0) {
        fragColor = vec4(0, 0, 0, 0);
        return;
    }
    float c = asin(clamp(r, 0.0, 1.0));
    float sc = sin(c), cc = cos(c);
    float sd0 = sin(u_viewCenter.y), cd0 = cos(u_viewCenter.y);
    float dec, ra;
    if (r < 1e-10) { dec = u_viewCenter.y; ra = u_viewCenter.x; }
    else {
        dec = asin(cc*sd0 + mV*sc*cd0/r);
        ra = u_viewCenter.x + atan(lV*sc, r*cd0*cc - mV*sd0*sc);
    }

    // Convert to degrees for grid computation
    float raDeg = ra * 57.29577951;
    float decDeg = dec * 57.29577951;
    float fovDeg = u_fov * 57.29577951;

    // SIN projection: (RA, Dec) -> (l, m) from phase center
    float dra = ra - u_crval.x;
    float sdP = sin(dec), cdP = cos(dec);
    float sd0P = sin(u_crval.y), cd0P = cos(u_crval.y);
    float cdra = cos(dra);
    float cosAng = sdP*sd0P + cdP*cd0P*cdra;

    // --- Coordinate grid overlay ---
    float gridAlpha = 0.0;
    if (u_showGrid == 1) {
        float interval = gridInterval(fovDeg);
        // Line thickness in degrees (scales with FOV for consistent screen width)
        float lineWidth = fovDeg * 0.002;

        // RA grid lines (normalize RA to [0, 360))
        float raNorm = mod(raDeg, 360.0);
        float raRem = mod(raNorm, interval);
        if (raRem < lineWidth || raRem > interval - lineWidth) gridAlpha = 0.35;

        // Dec grid lines
        float decRem = mod(decDeg + 90.0, interval);
        if (decRem < lineWidth || decRem > interval - lineWidth) gridAlpha = 0.35;
    }

    // --- Horizon circle (SIN projection boundary) ---
    float horizonAlpha = 0.0;
    if (abs(cosAng) < 0.008) horizonAlpha = 0.5;

    // Outside the visible hemisphere
    if (cosAng <= 0.0) {
        // Show grid even outside image (on the "sky" background)
        if (gridAlpha > 0.0) {
            fragColor = vec4(1.0, 1.0, 1.0, gridAlpha * 0.5);
        } else {
            fragColor = vec4(0,0,0,0);
        }
        return;
    }

    float l = cdP * sin(dra);
    float m = sdP*cd0P - cdP*sd0P*cdra;
    float px = l/u_cdelt.x + u_crpix.x - 1.0;
    float py = m/u_cdelt.y + u_crpix.y - 1.0;
    vec2 uv = vec2(px/u_imageSize.x, py/u_imageSize.y);

    // Outside image bounds
    if (uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) {
        if (gridAlpha > 0.0 || horizonAlpha > 0.0) {
            float a = max(gridAlpha, horizonAlpha);
            fragColor = vec4(1.0, 1.0, 1.0, a * 0.5);
        } else {
            fragColor = vec4(0,0,0,0);
        }
        return;
    }

    vec4 texel = texture(u_image, uv);
    if (texel.a < 0.5) { fragColor = vec4(0,0,0,0); return; }

    float norm = texel.r;
    if (u_stretch==1) norm = log(norm*99.0+1.0)/log(100.0);
    else if (u_stretch==2) norm = sqrt(norm);
    else if (u_stretch==3) norm = log(norm*10.0+sqrt(norm*norm*100.0+1.0))/log(10.0+sqrt(101.0));

    fragColor = texture(u_cmap, vec2(norm, 0.5));
    fragColor.a *= u_opacity;

    // Overlay grid lines on top of image
    if (gridAlpha > 0.0) {
        fragColor.rgb = mix(fragColor.rgb, vec3(1.0), gridAlpha);
    }
    // Overlay horizon circle
    if (horizonAlpha > 0.0) {
        fragColor.rgb = mix(fragColor.rgb, vec3(0.0, 1.0, 0.5), horizonAlpha);
    }
    // Crosshair at clicked position (fixed screen size in NDC)
    if (u_crosshairScreen.x > -900.0) {
        float dx = abs(screen.x - u_crosshairScreen.x);
        float dy = abs(screen.y - u_crosshairScreen.y);
        float crossArm = 0.035;
        float crossHair = 0.003;
        bool onH = dy < crossHair && dx < crossArm;
        bool onV = dx < crossHair && dy < crossArm;
        if (onH || onV) {
            fragColor.rgb = vec3(0.0, 1.0, 1.0);
            fragColor.a = 1.0;
        }
    }
    // Premultiply alpha for correct compositing with background
    fragColor.rgb *= fragColor.a;
}
`;
function Ht(t, s, o) {
  const a = t.createShader(s);
  if (t.shaderSource(a, o), t.compileShader(a), !t.getShaderParameter(a, t.COMPILE_STATUS)) {
    const i = t.getShaderInfoLog(a);
    throw t.deleteShader(a), new Error("Shader: " + i);
  }
  return a;
}
function se(t) {
  const s = Ht(t, t.VERTEX_SHADER, ie), o = Ht(t, t.FRAGMENT_SHADER, ce), a = t.createProgram();
  if (t.attachShader(a, s), t.attachShader(a, o), t.linkProgram(a), !t.getProgramParameter(a, t.LINK_STATUS))
    throw new Error("Link: " + t.getProgramInfoLog(a));
  return a;
}
function le(t, s, o) {
  const a = t.length, i = new Uint8Array(a * 4), r = o - s || 1e-30;
  for (let u = 0; u < a; u++) {
    const l = t[u];
    if (l !== l || !isFinite(l)) {
      i[u * 4 + 3] = 0;
      continue;
    }
    let d = (l - s) / r;
    d = d < 0 ? 0 : d > 1 ? 1 : d, i[u * 4] = d * 255 + 0.5 | 0, i[u * 4 + 3] = 255;
  }
  return i;
}
const Mt = {
  DSS: "CDS/P/DSS2/color",
  "2MASS": "CDS/P/2MASS/color",
  WISE: "CDS/P/allWISE/color",
  Planck: "CDS/P/PLANCK/R2/HFI/color",
  SDSS: "CDS/P/SDSS9/color",
  Mellinger: "CDS/P/Mellinger/color",
  Fermi: "CDS/P/Fermi/color",
  Haslam408: "CDS/P/HI4PI/NHI"
}, Wt = {
  projection: "SIN",
  showCooGrid: !1,
  showFrame: !1,
  showCooGridControl: !1,
  showSimbadPointerControl: !1,
  showFullscreenControl: !1,
  showLayersControl: !1,
  showGotoControl: !1,
  showShareControl: !1,
  showSettingsControl: !1,
  showZoomControl: !1,
  showCooLocation: !1,
  showProjectionControl: !1,
  showFov: !1,
  showStatusBar: !1,
  showReticle: !1,
  showContextMenu: !1
}, ue = [
  ".aladin-projection-control",
  ".aladin-location",
  ".aladin-fov",
  ".aladin-cooFrame",
  ".aladin-status-bar",
  ".aladin-fullScreen-control",
  ".aladin-fullscreen",
  ".aladin-zoomControl",
  ".aladin-gotoControl",
  ".aladin-layersControl",
  ".aladin-widgets-toolbar",
  ".aladin-logo-container",
  ".aladin-table"
].join(", ");
function fe(t) {
  const s = "astrowidget-aladin-control-layer";
  if (t.querySelector(`#${s}`)) return;
  const o = document.createElement("style");
  o.id = s, o.textContent = `
    .astrowidget-aladin-bg ${ue} {
      z-index: 0 !important;
      pointer-events: none !important;
    }
  `, t.appendChild(o);
}
function qt(t, s) {
  t.classList.add("astrowidget-aladin-bg"), fe(s);
}
async function me({ model: t, el: s }) {
  function o(x) {
    console.log("[astrowidget]", x);
  }
  function a() {
    const x = t.get("background_cut_min"), P = t.get("background_cut_max");
    if (!r || !Number.isFinite(x) || !Number.isFinite(P)) return;
    let e = 0;
    function I() {
      var q;
      e += 1;
      try {
        const X = (q = r.getBaseImageLayer) == null ? void 0 : q.call(r);
        if (X != null && X.setCuts) {
          X.setCuts(x, P), o("Background cuts: " + x + " .. " + P);
          return;
        }
      } catch (X) {
        o("Background setCuts pending: " + X.message);
      }
      e < 25 && setTimeout(I, Math.min(100 * e, 1e3));
    }
    I();
  }
  let i = null, r = null;
  const u = t.get("background_survey");
  if (u)
    try {
      i = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await i.init, o("Aladin Lite loaded");
    } catch (x) {
      o("Aladin Lite load failed: " + x.message);
    }
  const l = document.createElement("div");
  l.style.cssText = "position:relative;width:100%;height:600px;background:" + (u && i ? "transparent" : "#000"), s.appendChild(l);
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:0", u && i && (qt(d, l), l.appendChild(d));
  const g = document.createElement("canvas");
  g.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:1", l.appendChild(g);
  const v = document.createElement("div");
  v.style.cssText = "position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:4px", l.appendChild(v);
  const E = "padding:4px 10px;font:12px sans-serif;border:1px solid #888;border-radius:3px;cursor:pointer;color:#fff;background:rgba(0,0,0,0.6)", b = E + ";background:rgba(70,130,255,0.8);border-color:#7af";
  function C(x, P) {
    const e = document.createElement("button");
    return e.textContent = x, e.title = P, e.style.cssText = E, v.appendChild(e), e;
  }
  const Y = C("↺", "Reset view to initial position"), O = C("✥", "Pan mode (drag to rotate)"), H = C("⬚", "Box zoom (drag to select region)"), R = document.createElement("div");
  R.style.cssText = "position:absolute;border:2px dashed #7af;background:rgba(70,130,255,0.15);pointer-events:none;z-index:2;display:none", l.appendChild(R);
  const W = document.createElement("div");
  W.style.cssText = "position:absolute;bottom:8px;left:8px;color:#fff;font:13px monospace;text-shadow:0 0 4px #000;pointer-events:none;z-index:2", l.appendChild(W);
  try {
    let Tt = function(n) {
      vt = n, O.style.cssText = n === "pan" ? b : E, H.style.cssText = n === "boxzoom" ? b : E, g.style.cursor = n === "pan" ? "grab" : "crosshair";
    }, Et = function() {
      if (!ot) return;
      const n = le(ot, Xt, Ft);
      e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, It), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, et, nt, 0, e.RGBA, e.UNSIGNED_BYTE, n);
    }, K = function() {
      const n = r == null ? void 0 : r.view, f = (n == null ? void 0 : n.width) ?? g.clientWidth, c = (n == null ? void 0 : n.height) ?? g.clientHeight;
      return f / Math.max(c, 1);
    }, ct = function() {
      return rt || Pt(p, K());
    }, At = function(n) {
      const f = 1e-3 * h, c = r ? Jt(K()) : Math.PI;
      return Math.max(f, Math.min(c, n));
    }, bt = function() {
      if (!(r != null && r.getRaDec)) return;
      const [n, f] = r.getRaDec();
      if (w = n * h, T = f * h, typeof r.getFov == "function") {
        const c = r.getFov(), m = Array.isArray(c) ? c[0] : c, _ = Array.isArray(c) ? c[1] : m;
        p = Math.max(m, _) * h;
      }
      st();
    }, st = function() {
      if (!(r != null && r.getRotation)) {
        N = 0;
        return;
      }
      N = -r.getRotation() * h;
    }, Z = function() {
      if (!r) {
        rt = null;
        return;
      }
      bt();
      const n = r.view, f = (n == null ? void 0 : n.width) ?? d.clientWidth, c = (n == null ? void 0 : n.height) ?? d.clientHeight;
      rt = Qt(
        r,
        f,
        c,
        w,
        T,
        N
      ) ?? null;
    }, A = function() {
      r && (st(), Z()), e.viewport(0, 0, g.width, g.height), e.clearColor(0, 0, 0, 0), e.clear(e.COLOR_BUFFER_BIT), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE_MINUS_SRC_ALPHA), e.useProgram(I), e.uniform1i(y.u_image, 0), e.uniform1i(y.u_cmap, 1), e.uniform2f(y.u_crval, j[0], j[1]), e.uniform2f(y.u_cdelt, mt[0], mt[1]), e.uniform2f(y.u_crpix, pt[0], pt[1]), e.uniform2f(y.u_imageSize, et, nt), e.uniform2f(y.u_viewCenter, w, T);
      const n = ct();
      e.uniform2f(y.u_viewScale, n.scaleX, n.scaleY), st(), e.uniform1f(y.u_viewRotation, N), e.uniform1f(y.u_fov, p), e.uniform1f(y.u_opacity, Lt), e.uniform1i(y.u_stretch, kt), e.uniform1i(y.u_showGrid, Ut);
      let f = -999, c = -999;
      if (_t > -900) {
        const m = oe(
          _t,
          Bt,
          w,
          T,
          p,
          K(),
          n,
          N
        );
        m && (f = m.x, c = m.y);
      }
      e.uniform2f(y.u_crosshairScreen, f, c), e.uniform2f(y.u_resolution, g.width, g.height), e.drawArrays(e.TRIANGLES, 0, 6);
    }, lt = function() {
      const n = t.get("image_data"), f = t.get("image_shape");
      if (!n || !f || f[0] === 0) return;
      const c = n.byteLength || n.length;
      c !== 0 && (nt = f[0], et = f[1], ot = new Float32Array(n.buffer.slice(n.byteOffset, n.byteOffset + c)), o("Image: " + et + "x" + nt + ", " + ot.length + " floats"), Et());
    }, $ = function() {
      const n = t.get("crval"), f = t.get("cdelt"), c = t.get("crpix");
      n && (j = [n[0] * h, n[1] * h]), f && (mt = [f[0] * h, f[1] * h]), c && (pt = [c[0], c[1]]);
    }, Q = function() {
      F || (w = (t.get("view_ra") || 0) * h, T = (t.get("view_dec") || 0) * h, p = (t.get("view_fov") || 180) * h);
    }, V = function() {
      Xt = t.get("vmin") || 0, Ft = t.get("vmax") || 1, Lt = t.get("opacity") ?? 1, kt = Zt[t.get("stretch")] || 0, Ut = t.get("show_grid") === !1 ? 0 : 1;
    }, Nt = function() {
      V(), lt(), $(), Q(), A();
    }, U = function(n = !0) {
      if (!r) return;
      p = At(p);
      const f = p / h;
      if (n) {
        const c = (w / h % 360 + 360) % 360, m = T / h;
        r.gotoRaDec(c, m);
      }
      r.setFoV(f), bt(), Z();
    }, Vt = function(n, f) {
      const c = d.getBoundingClientRect(), m = r.view, _ = (m == null ? void 0 : m.width) ?? c.width, D = (m == null ? void 0 : m.height) ?? c.height;
      return {
        x: (n - c.left) * (_ / c.width),
        y: (f - c.top) * (D / c.height)
      };
    }, $t = function(n, f, c, m) {
      var ht;
      const _ = (ht = r == null ? void 0 : r.view) == null ? void 0 : ht.wasm;
      if (!(_ != null && _.goFromTo)) return !1;
      let { x: D, y: M } = Vt(n, f), { x: S, y: k } = Vt(c, m);
      t.get("invert_horizontal_pan") === !1 && ([D, S] = [S, D]), _.goFromTo(D, M, S, k), r.view.updateCenter();
      const [B, tt] = r.getRaDec();
      return w = B * h, T = tt * h, st(), !0;
    }, zt = function() {
      ut++, Nt();
      const n = t.get("image_data");
      if (n && (n.byteLength || n.length) > 0) {
        o("Data arrived after " + ut + " poll(s)"), requestAnimationFrame(A), U(), xt = w, yt = T, wt = p;
        return;
      }
      ut < Yt ? setTimeout(zt, Math.min(100 * Math.pow(1.5, ut - 1), 1e3)) : (o("No image data after " + Yt + " polls — waiting for change event"), U(), xt = w, yt = T, wt = p);
    }, Ct = function(n, f) {
      const c = g.getBoundingClientRect();
      return {
        x: (n - c.left) / c.width * 2 - 1,
        y: -((f - c.top) / c.height * 2 - 1)
      };
    }, Gt = function(n, f) {
      const { x: c, y: m } = Ct(n, f);
      return gt(
        c,
        m,
        w,
        T,
        p,
        K(),
        ct(),
        N
      );
    };
    const x = l.getBoundingClientRect(), P = window.devicePixelRatio || 1;
    g.width = (x.width || 800) * P, g.height = (x.height || 600) * P;
    const e = g.getContext("webgl2", { alpha: !0, premultipliedAlpha: !0, preserveDrawingBuffer: !0 });
    if (!e) {
      o("FAIL: No WebGL2");
      return;
    }
    o("WebGL2: " + e.getParameter(e.RENDERER));
    const I = se(e);
    o("Shader compiled OK"), e.useProgram(I);
    const q = e.createBuffer();
    e.bindBuffer(e.ARRAY_BUFFER, q), e.bufferData(e.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), e.STATIC_DRAW);
    const X = e.getAttribLocation(I, "a_pos");
    e.enableVertexAttribArray(X), e.vertexAttribPointer(X, 2, e.FLOAT, !1, 0, 0);
    const y = {};
    [
      "u_image",
      "u_cmap",
      "u_crval",
      "u_cdelt",
      "u_crpix",
      "u_imageSize",
      "u_viewCenter",
      "u_viewScale",
      "u_viewRotation",
      "u_fov",
      "u_opacity",
      "u_stretch",
      "u_showGrid",
      "u_crosshairScreen",
      "u_resolution"
    ].forEach(
      (n) => y[n] = e.getUniformLocation(I, n)
    );
    const J = e.createTexture();
    e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, J), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 256, 1, 0, e.RGBA, e.UNSIGNED_BYTE, ae()), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), o("Colormap texture OK");
    const It = e.createTexture();
    e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, It), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 1, 1, 0, e.RGBA, e.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE);
    let et = 1, nt = 1, ot = null, j = [0, 0], mt = [1, 1], pt = [0, 0], w = 0, T = 0, p = Math.PI, rt = null, N = 0, Xt = 0, Ft = 1, Lt = 1, kt = 0, Ut = 1, at = !1, F = !1, L = null, _t = -999, Bt = -999;
    const Zt = { linear: 0, log: 1, sqrt: 2, asinh: 3 };
    let vt = "pan", xt = 0, yt = 0, wt = Math.PI, z = 0, G = 0, it = !1;
    if (Tt("pan"), O.addEventListener("click", () => Tt("pan")), H.addEventListener("click", () => Tt("boxzoom")), Y.addEventListener("click", () => {
      F = !0, w = xt, T = yt, p = wt, t.set("view_ra", w / h), t.set("view_dec", T / h), t.set("view_fov", p / h), t.save_changes(), U(), A(), L && clearTimeout(L), L = setTimeout(() => {
        F = !1;
      }, 500);
    }), t.on("change:image_data", () => {
      V(), lt(), $();
    }), t.on("change:image_shape", () => {
      lt();
    }), t.on("change:crval", () => {
      $();
    }), t.on("change:cdelt", () => {
      $();
    }), t.on("change:crpix", () => {
      $();
    }), t.on("change:vmin", () => {
      V(), Et();
    }), t.on("change:vmax", () => {
      V(), Et();
    }), t.on("change:image_revision", () => {
      V(), lt(), $(), Q(), A();
    }), t.on("change:view_ra", () => {
      Q(), A(), F || U();
    }), t.on("change:view_dec", () => {
      Q(), A(), F || U();
    }), t.on("change:view_fov", () => {
      Q(), A(), F || U();
    }), t.on("change:opacity", () => {
      V(), A();
    }), t.on("change:stretch", () => {
      V(), A();
    }), t.on("change:show_grid", () => {
      V(), A();
    }), t.on("change:background_survey", () => {
      const n = t.get("background_survey");
      l.style.background = n ? "transparent" : "#000", A();
    }), i && u) {
      const n = Mt[u] || u, f = (w / h % 360 + 360) % 360, c = T / h, m = p / h;
      r = i.aladin(d, {
        fov: m || 180,
        target: f + " " + c,
        survey: n,
        ...Wt
      }), o("Aladin viewer created: " + u), a(), Z();
    }
    t.on("change:background_survey", async () => {
      const n = t.get("background_survey");
      if (n && r) {
        const f = Mt[n] || n;
        r.setBaseImageLayer(f), l.style.background = "transparent", a();
      } else if (n && !r && !i)
        try {
          i = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await i.init, qt(d, l), l.appendChild(d), l.style.background = "transparent";
          const c = Mt[n] || n;
          r = i.aladin(d, {
            fov: p / h || 180,
            target: (w / h % 360 + 360) % 360 + " " + T / h,
            survey: c,
            ...Wt
          }), o("Aladin loaded on demand: " + n), a(), Z();
        } catch (f) {
          o("Aladin load failed: " + f.message);
        }
      else n || (l.style.background = "#000", d.style.display = "none");
      A();
    }), t.on("change:background_cut_min", () => {
      a();
    }), t.on("change:background_cut_max", () => {
      a();
    }), Nt();
    let ut = 0;
    const Yt = 30;
    setTimeout(zt, 50);
    let ft = 0, dt = 0, Dt = 0, Rt = 0, St = !1;
    g.style.cursor = "grab", g.addEventListener("mousedown", (n) => {
      if (F = !0, L && (clearTimeout(L), L = null), Dt = n.clientX, Rt = n.clientY, St = !1, vt === "boxzoom") {
        it = !0;
        const f = l.getBoundingClientRect();
        z = n.clientX - f.left, G = n.clientY - f.top, R.style.left = z + "px", R.style.top = G + "px", R.style.width = "0", R.style.height = "0", R.style.display = "block";
      } else
        at = !0, ft = n.clientX, dt = n.clientY, g.style.cursor = "grabbing";
    }), window.addEventListener("mousemove", (n) => {
      if (it) {
        const _ = l.getBoundingClientRect(), D = n.clientX - _.left, M = n.clientY - _.top, S = Math.min(z, D), k = Math.min(G, M), B = Math.abs(D - z), tt = Math.abs(M - G);
        R.style.left = S + "px", R.style.top = k + "px", R.style.width = B + "px", R.style.height = tt + "px", St = !0;
        return;
      }
      if (!at) {
        const _ = g.getBoundingClientRect(), D = (n.clientX - _.left) / _.width * 2 - 1, M = -((n.clientY - _.top) / _.height * 2 - 1), S = K(), k = gt(
          D,
          M,
          w,
          T,
          p,
          S,
          ct(),
          N
        );
        if (k) {
          const B = (k.ra / h % 360 + 360) % 360;
          W.textContent = de(B) + "  " + he(k.dec / h);
        } else
          W.textContent = "";
        return;
      }
      const f = K(), c = ct();
      if (!$t(ft, dt, n.clientX, n.clientY)) {
        const _ = Ct(ft, dt), D = Ct(n.clientX, n.clientY), M = re(
          _.x,
          _.y,
          D.x,
          D.y,
          w,
          T,
          p,
          f,
          {
            invertHorizontalPan: t.get("invert_horizontal_pan") !== !1,
            scales: c,
            rotationRad: N
          }
        );
        M && (w = M.viewRA, T = M.viewDec), U();
      }
      ft = n.clientX, dt = n.clientY, St = !0, requestAnimationFrame(A);
    }), window.addEventListener("mouseup", (n) => {
      if (it) {
        if (it = !1, R.style.display = "none", L = setTimeout(() => {
          F = !1;
        }, 500), Math.sqrt((n.clientX - Dt) ** 2 + (n.clientY - Rt) ** 2) < 5) return;
        const c = l.getBoundingClientRect(), m = n.clientX - c.left, _ = n.clientY - c.top, D = (z + m) / 2 / c.width * 2 - 1, M = -((G + _) / 2 / c.height * 2 - 1), S = Gt(
          c.left + (z + m) / 2,
          c.top + (G + _) / 2
        );
        if (!S) return;
        w = S.ra, T = S.dec;
        const k = Math.max(
          Math.abs(m - z) / c.width,
          Math.abs(_ - G) / c.height
        ), B = p * 0.5;
        p = 2 * Math.asin(Math.min(1, k * Math.sin(B))), p = At(p), t.set("view_ra", w / h), t.set("view_dec", T / h), t.set("view_fov", p / h), t.save_changes(), U(), A();
        return;
      }
      if (at)
        if (at = !1, g.style.cursor = vt === "pan" ? "grab" : "crosshair", L = setTimeout(() => {
          F = !1;
        }, 500), Math.sqrt((n.clientX - Dt) ** 2 + (n.clientY - Rt) ** 2) < 3) {
          const c = Gt(n.clientX, n.clientY);
          if (!c) return;
          const m = (c.ra / h % 360 + 360) % 360, _ = c.dec / h;
          t.set("clicked_coord", [m, _]);
          const D = c.ra - j[0], M = Math.sin(c.dec), S = Math.cos(c.dec), k = Math.sin(j[1]), B = Math.cos(j[1]), tt = S * Math.sin(D), ht = M * B - S * k * Math.cos(D);
          t.set("clicked_lm", [tt, ht]);
          const Ot = t.get("click_tick");
          t.set("click_tick", (Ot ?? 0) + 1), t.save_changes(), _t = c.ra, Bt = c.dec, requestAnimationFrame(A);
        } else
          t.set("view_ra", w / h), t.set("view_dec", T / h), t.save_changes(), U();
    }), g.addEventListener("wheel", (n) => {
      n.preventDefault(), F = !0, L && clearTimeout(L), p *= n.deltaY > 0 ? 1.1 : 1 / 1.1, p = At(p), t.set("view_fov", p / h), t.save_changes(), r ? (r.setFoV(p / h), requestAnimationFrame(() => {
        bt(), Z(), A();
      })) : requestAnimationFrame(A), L = setTimeout(() => {
        F = !1;
      }, 500);
    }, { passive: !1 }), new ResizeObserver(() => {
      const n = l.getBoundingClientRect(), f = window.devicePixelRatio || 1;
      g.width = n.width * f, g.height = n.height * f, Z(), A();
    }).observe(l);
  } catch (x) {
    o("ERROR: " + x.message), o(x.stack);
  }
}
function de(t) {
  const s = t / 15, o = Math.floor(s), a = Math.floor((s - o) * 60), i = ((s - o) * 60 - a) * 60;
  return o + "h" + String(a).padStart(2, "0") + "m" + i.toFixed(1).padStart(4, "0") + "s";
}
function he(t) {
  const s = t >= 0 ? "+" : "-", o = Math.abs(t), a = Math.floor(o), i = Math.floor((o - a) * 60), r = ((o - a) * 60 - i) * 60;
  return s + a + "°" + String(i).padStart(2, "0") + "'" + r.toFixed(1).padStart(4, "0") + '"';
}
export {
  me as render
};
//# sourceMappingURL=widget.js.map
