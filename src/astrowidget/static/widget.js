const h = Math.PI / 180;
function Ht(t, c) {
  let o, i;
  return c >= 1 ? (o = t, i = t / c) : (i = t, o = t * c), {
    fovWidth: o,
    fovHeight: i,
    scaleX: Math.sin(o * 0.5),
    scaleY: Math.sin(i * 0.5)
  };
}
function me(t) {
  let c = 1e-3 * h, o = Math.PI;
  for (let i = 0; i < 40; i++) {
    const a = (c + o) * 0.5, { scaleX: r, scaleY: f } = Ht(a, t);
    Math.hypot(r, f) <= 1 + 1e-9 ? c = a : o = a;
  }
  return c;
}
function ve(t, c, o, i, a, r = 0) {
  if (!(t != null && t.pix2world) || c < 2 || o < 2) return null;
  if (i == null || a == null) {
    const [e, X] = t.getRaDec();
    i = e * h, a = X * h;
  }
  const f = c * 0.5, s = o * 0.5, g = Math.max(4, c * 0.02), d = Math.max(4, o * 0.02), v = Math.cos(r), E = Math.sin(r);
  function D(e, X) {
    const [q, I] = t.pix2world(e, X), { l: y, m: Q } = le(q * h, I * h, i, a);
    return r === 0 ? { l0: y, m0: Q } : { l0: y * v - Q * E, m0: y * E + Q * v };
  }
  const C = D(f + g, s), V = D(f - g, s), z = D(f, s - d), H = D(f, s + d), R = 4 * g / c, W = 4 * d / o, x = Math.abs(C.l0 - V.l0) / R, P = Math.abs(z.m0 - H.m0) / W;
  return !Number.isFinite(x) || !Number.isFinite(P) || x < 1e-15 || P < 1e-15 ? null : { scaleX: x, scaleY: P };
}
function se(t, c, o) {
  return (o == null ? void 0 : o.scaleX) > 0 && (o == null ? void 0 : o.scaleY) > 0 ? o : Ht(t, c);
}
function xe(t, c, o, i, a = 0) {
  const r = -t * o, f = c * i;
  if (a === 0) return { l: r, m: f };
  const s = Math.cos(a), g = Math.sin(a);
  return {
    l: r * s + f * g,
    m: -r * g + f * s
  };
}
function ye(t, c, o, i, a = 0) {
  let r = t, f = c;
  if (a !== 0) {
    const s = Math.cos(a), g = Math.sin(a);
    r = t * s - c * g, f = t * g + c * s;
  }
  return { x: -r / o, y: f / i };
}
function le(t, c, o, i) {
  const a = t - o, r = Math.sin(c), f = Math.cos(c), s = Math.sin(i), g = Math.cos(i), d = Math.cos(a), v = r * s + f * g * d, E = f * Math.sin(a), D = r * g - f * s * d;
  return { l: E, m: D, visible: v > 0 };
}
function we(t, c, o, i) {
  const a = Math.sqrt(t * t + c * c);
  if (a > 1) return null;
  const r = Math.sin(i), f = Math.cos(i);
  let s, g;
  if (a === 0)
    s = i, g = o;
  else {
    const d = Math.sqrt(1 - a * a);
    s = Math.asin(d * r + c * f / a * a);
    const v = a;
    s = Math.asin(d * r + c * f * v / a), g = o + Math.atan2(t * v, a * f * d - c * r * v);
  }
  return { ra: g, dec: s };
}
function Tt(t, c, o, i, a, r, f = null, s = 0) {
  const { scaleX: g, scaleY: d } = se(a, r, f), { l: v, m: E } = xe(t, c, g, d, s);
  return Math.hypot(v, E) > 1 ? null : we(v, E, o, i);
}
function Te(t, c, o, i, a, r, f = null, s = 0) {
  const { l: g, m: d, visible: v } = le(t, c, o, i);
  if (!v) return null;
  const { scaleX: E, scaleY: D } = se(a, r, f);
  if (E < 1e-15 || D < 1e-15) return { x: 0, y: 0 };
  const { x: C, y: V } = ye(g, d, E, D, s);
  return Math.hypot(g, d) > 1 + 1e-12 ? null : { x: C, y: V };
}
function Ee(t, c, o, i, a, r, f, s, g = {}) {
  const d = g.scales ?? null, v = g.rotationRad ?? 0, E = Tt(t, c, a, r, f, s, d, v), D = Tt(o, i, a, r, f, s, d, v);
  if (!E || !D) return null;
  let C = E.ra - D.ra;
  C > Math.PI && (C -= 2 * Math.PI), C < -Math.PI && (C += 2 * Math.PI);
  const V = g.invertHorizontalPan === !1 ? 1 : -1, z = -Math.PI / 2 + 1e-3, H = Math.PI / 2 - 1e-3;
  return {
    viewRA: a + V * C,
    viewDec: Math.max(z, Math.min(H, r + E.dec - D.dec))
  };
}
function De(t, c, o, i, a) {
  if (o != null && o.pix2world) {
    const { x: r, y: f } = i(t, c), s = o.pix2world(r, f);
    if (!s || s.length < 2) return null;
    const g = s[0], d = s[1];
    return !Number.isFinite(g) || !Number.isFinite(d) ? null : { ra: g * h, dec: d * h };
  }
  return a(t, c);
}
function be() {
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
  ], c = new Uint8Array(256 * 4);
  for (let o = 0; o < 256; o++) {
    let i = 0;
    for (let s = 0; s < t.length - 1; s++) o >= t[s][0] && (i = s);
    const a = Math.min(i + 1, t.length - 1), r = t[a][0] - t[i][0] || 1, f = (o - t[i][0]) / r;
    c[o * 4] = t[i][1] + f * (t[a][1] - t[i][1]) | 0, c[o * 4 + 1] = t[i][2] + f * (t[a][2] - t[i][2]) | 0, c[o * 4 + 2] = t[i][3] + f * (t[a][3] - t[i][3]) | 0, c[o * 4 + 3] = 255;
  }
  return c;
}
const Re = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0, 1); }
`, Se = `#version 300 es
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

    // Screen-space crosshair (works with HiPS-only or overlay)
    if (u_crosshairScreen.x > -900.0) {
        float dx = abs(screen.x - u_crosshairScreen.x);
        float dy = abs(screen.y - u_crosshairScreen.y);
        float crossArm = 0.035;
        float crossHair = 0.003;
        bool onH = dy < crossHair && dx < crossArm;
        bool onV = dx < crossHair && dy < crossArm;
        if (onH || onV) {
            fragColor = vec4(0.0, 1.0, 1.0, 1.0);
            return;
        }
    }

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

    // Outside the visible hemisphere (image SIN tangent plane)
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
    // px/py are 0-based WCS axis 1/2; texture is (width=n_m, height=n_l) from numpy (l, m).
    float px = l/u_cdelt.x + u_crpix.x - 1.0;
    float py = m/u_cdelt.y + u_crpix.y - 1.0;
    vec2 uv = vec2(py/u_imageSize.x, px/u_imageSize.y);

    // Outside image bounds
    if (uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) {
        if (gridAlpha > 0.0) {
            fragColor = vec4(1.0, 1.0, 1.0, gridAlpha * 0.5);
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
    // Premultiply alpha for correct compositing with background
    fragColor.rgb *= fragColor.a;
}
`;
function ie(t, c, o) {
  const i = t.createShader(c);
  if (t.shaderSource(i, o), t.compileShader(i), !t.getShaderParameter(i, t.COMPILE_STATUS)) {
    const a = t.getShaderInfoLog(i);
    throw t.deleteShader(i), new Error("Shader: " + a);
  }
  return i;
}
function Ae(t) {
  const c = ie(t, t.VERTEX_SHADER, Re), o = ie(t, t.FRAGMENT_SHADER, Se), i = t.createProgram();
  if (t.attachShader(i, c), t.attachShader(i, o), t.linkProgram(i), !t.getProgramParameter(i, t.LINK_STATUS))
    throw new Error("Link: " + t.getProgramInfoLog(i));
  return i;
}
function Ce(t, c, o) {
  const i = t.length, a = new Uint8Array(i * 4), r = o - c || 1e-30;
  for (let f = 0; f < i; f++) {
    const s = t[f];
    if (s !== s || !isFinite(s)) {
      a[f * 4 + 3] = 0;
      continue;
    }
    let g = (s - c) / r;
    g = g < 0 ? 0 : g > 1 ? 1 : g, a[f * 4] = g * 255 + 0.5 | 0, a[f * 4 + 3] = 255;
  }
  return a;
}
const zt = {
  DSS: "CDS/P/DSS2/color",
  "2MASS": "CDS/P/2MASS/color",
  WISE: "CDS/P/allWISE/color",
  Planck: "CDS/P/PLANCK/R2/HFI/color",
  SDSS: "CDS/P/SDSS9/color",
  Mellinger: "CDS/P/Mellinger/color",
  Fermi: "CDS/P/Fermi/color",
  Haslam408: "CDS/P/HI4PI/NHI"
}, ae = {
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
}, Me = [
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
function Pe(t) {
  const c = "astrowidget-aladin-control-layer";
  if (t.querySelector(`#${c}`)) return;
  const o = document.createElement("style");
  o.id = c, o.textContent = `
    .astrowidget-aladin-bg ${Me} {
      z-index: 0 !important;
      pointer-events: none !important;
    }
  `, t.appendChild(o);
}
function ce(t, c) {
  t.classList.add("astrowidget-aladin-bg"), Pe(c);
}
async function Ne({ model: t, el: c }) {
  function o(x) {
    console.log("[astrowidget]", x);
  }
  function i() {
    const x = t.get("background_cut_min"), P = t.get("background_cut_max");
    if (!r || !Number.isFinite(x) || !Number.isFinite(P)) return;
    let e = 0;
    function X() {
      var q;
      e += 1;
      try {
        const I = (q = r.getBaseImageLayer) == null ? void 0 : q.call(r);
        if (I != null && I.setCuts) {
          I.setCuts(x, P), o("Background cuts: " + x + " .. " + P);
          return;
        }
      } catch (I) {
        o("Background setCuts pending: " + I.message);
      }
      e < 25 && setTimeout(X, Math.min(100 * e, 1e3));
    }
    X();
  }
  let a = null, r = null;
  const f = t.get("background_survey");
  if (f)
    try {
      a = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await a.init, o("Aladin Lite loaded");
    } catch (x) {
      o("Aladin Lite load failed: " + x.message);
    }
  const s = document.createElement("div");
  s.style.cssText = "position:relative;width:100%;height:600px;background:" + (f && a ? "transparent" : "#000"), c.appendChild(s);
  const g = document.createElement("div");
  g.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:0", f && a && (ce(g, s), s.appendChild(g));
  const d = document.createElement("canvas");
  d.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:1", s.appendChild(d);
  const v = document.createElement("div");
  v.style.cssText = "position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:4px", s.appendChild(v);
  const E = "padding:4px 10px;font:12px sans-serif;border:1px solid #888;border-radius:3px;cursor:pointer;color:#fff;background:rgba(0,0,0,0.6)", D = E + ";background:rgba(70,130,255,0.8);border-color:#7af";
  function C(x, P) {
    const e = document.createElement("button");
    return e.textContent = x, e.title = P, e.style.cssText = E, v.appendChild(e), e;
  }
  const V = C("↺", "Reset view to initial position"), z = C("✥", "Pan mode (drag to rotate)"), H = C("⬚", "Box zoom (drag to select region)"), R = document.createElement("div");
  R.style.cssText = "position:absolute;border:2px dashed #7af;background:rgba(70,130,255,0.15);pointer-events:none;z-index:2;display:none", s.appendChild(R);
  const W = document.createElement("div");
  W.style.cssText = "position:absolute;bottom:8px;left:8px;color:#fff;font:13px monospace;text-shadow:0 0 4px #000;pointer-events:none;z-index:2", s.appendChild(W);
  try {
    let Pt = function(n) {
      St = n, z.style.cssText = n === "pan" ? D : E, H.style.cssText = n === "boxzoom" ? D : E, d.style.cursor = n === "pan" ? "grab" : "crosshair";
    }, Ft = function() {
      if (!nt) return;
      const n = Ce(nt, Wt, qt);
      e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Et), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, tt, et, 0, e.RGBA, e.UNSIGNED_BYTE, n);
    }, $ = function() {
      const n = r == null ? void 0 : r.view, u = (n == null ? void 0 : n.width) ?? d.clientWidth, l = (n == null ? void 0 : n.height) ?? d.clientHeight;
      return u / Math.max(l, 1);
    }, ut = function() {
      return K || Ht(_, $());
    }, Xt = function(n) {
      const u = 1e-3 * h, l = r ? me($()) : Math.PI;
      return Math.max(u, Math.min(l, n));
    }, fe = function() {
      if (!(r != null && r.getRaDec)) return;
      const [n, u] = r.getRaDec();
      if (w = n * h, T = u * h, typeof r.getFov == "function") {
        const l = r.getFov(), p = Array.isArray(l) ? l[0] : l, m = Array.isArray(l) ? l[1] : p;
        _ = Math.max(p, m) * h;
      }
      ft();
    }, ft = function() {
      if (!(r != null && r.getRotation)) {
        U = 0;
        return;
      }
      U = -r.getRotation() * h;
    }, O = function() {
      if (!r) {
        K = null;
        return;
      }
      const n = r.view, u = (n == null ? void 0 : n.width) ?? g.clientWidth, l = (n == null ? void 0 : n.height) ?? g.clientHeight;
      K = ve(
        r,
        u,
        l,
        w,
        T,
        U
      ) ?? null;
    }, S = function() {
      r && (ft(), O()), e.viewport(0, 0, d.width, d.height), e.clearColor(0, 0, 0, 0), e.clear(e.COLOR_BUFFER_BIT), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE_MINUS_SRC_ALPHA), e.useProgram(X), e.uniform1i(y.u_image, 0), e.uniform1i(y.u_cmap, 1), e.uniform2f(y.u_crval, j[0], j[1]), e.uniform2f(y.u_cdelt, Dt[0], Dt[1]), e.uniform2f(y.u_crpix, bt[0], bt[1]), e.uniform2f(y.u_imageSize, tt, et), e.uniform2f(y.u_viewCenter, w, T);
      const n = ut();
      e.uniform2f(y.u_viewScale, n.scaleX, n.scaleY), ft(), e.uniform1f(y.u_viewRotation, U), e.uniform1f(y.u_fov, _), e.uniform1f(y.u_opacity, jt), e.uniform1i(y.u_stretch, Kt), e.uniform1i(y.u_showGrid, Zt);
      let u = -999, l = -999;
      if (st > -900)
        u = st, l = Rt;
      else if (rt > -900) {
        const p = Te(
          rt,
          ct,
          w,
          T,
          _,
          $(),
          n,
          U
        );
        p && (u = p.x, l = p.y);
      }
      e.uniform2f(y.u_crosshairScreen, u, l), e.uniform2f(y.u_resolution, d.width, d.height), e.drawArrays(e.TRIANGLES, 0, 6);
    }, he = function() {
      nt = null, tt = 1, et = 1, e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Et), e.texImage2D(
        e.TEXTURE_2D,
        0,
        e.RGBA,
        1,
        1,
        0,
        e.RGBA,
        e.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0])
      );
    }, ht = function() {
      const n = t.get("image_data"), u = t.get("image_shape"), l = n ? n.byteLength || n.length : 0;
      if (!n || !u || u[0] === 0 || l === 0) {
        he();
        return;
      }
      et = u[0], tt = u[1], nt = new Float32Array(n.buffer.slice(n.byteOffset, n.byteOffset + l)), o("Image: " + tt + "x" + et + ", " + nt.length + " floats"), Ft();
    }, J = function() {
      const n = t.get("crval"), u = t.get("cdelt"), l = t.get("crpix");
      n && (j = [n[0] * h, n[1] * h]), u && (Dt = [u[0] * h, u[1] * h]), l && (bt = [l[0], l[1]]);
    }, It = function() {
      w = (t.get("view_ra") || 0) * h, T = (t.get("view_dec") || 0) * h, _ = (t.get("view_fov") || 180) * h;
    }, ge = function() {
      L || It();
    }, B = function() {
      Wt = t.get("vmin") || 0, qt = t.get("vmax") || 1, jt = t.get("opacity") ?? 1, Kt = ue[t.get("stretch")] || 0, Zt = t.get("show_grid") === !1 ? 0 : 1;
    }, gt = function() {
      Nt || (Nt = !0, requestAnimationFrame(() => {
        Nt = !1, S();
      }));
    }, Lt = function() {
      const n = t.get("crosshair_ra"), u = t.get("crosshair_dec");
      typeof n != "number" || typeof u != "number" || n < -900 || u < -900 ? (rt = -999, ct = -999) : (rt = n * h, ct = u * h, st = -999, Rt = -999);
    }, $t = function() {
      B(), ht(), J(), ge(), Lt(), S();
    }, kt = function() {
      if (r && fe(), dt(), S(), t.get("overlay_view_lock")) {
        const n = t.get("view_gesture_revision") || 0;
        t.set("view_gesture_revision", n + 1), t.save_changes();
      }
    }, Ut = function() {
      L || (It(), K = null, dt(), gt());
    }, dt = function(n = !0) {
      if (!r) return;
      _ = Xt(_);
      const u = _ / h;
      if (n) {
        const l = (w / h % 360 + 360) % 360, p = T / h;
        r.gotoRaDec(l, p);
      }
      r.setFoV(u), O();
    }, pt = function(n, u) {
      const l = g.getBoundingClientRect(), p = r.view, m = (p == null ? void 0 : p.width) ?? l.width, b = (p == null ? void 0 : p.height) ?? l.height;
      return {
        x: (n - l.left) * (m / l.width),
        y: (u - l.top) * (b / l.height)
      };
    }, de = function(n, u, l, p) {
      var wt;
      const m = (wt = r == null ? void 0 : r.view) == null ? void 0 : wt.wasm;
      if (!(m != null && m.goFromTo)) return !1;
      let { x: b, y: A } = pt(n, u), { x: M, y: F } = pt(l, p);
      t.get("invert_horizontal_pan") === !1 && ([b, M] = [M, b]), m.goFromTo(b, A, M, F), r.view.updateCenter();
      const [k, it] = r.getRaDec();
      return w = k * h, T = it * h, ft(), !0;
    }, Qt = function() {
      _t++, $t();
      const n = t.get("image_data");
      if (n && (n.byteLength || n.length) > 0) {
        o("Data arrived after " + _t + " poll(s)"), requestAnimationFrame(S), At = w, Ct = T, Mt = _;
        return;
      }
      _t < Jt ? setTimeout(Qt, Math.min(100 * Math.pow(1.5, _t - 1), 1e3)) : (o("No image data after " + Jt + " polls — waiting for change event"), dt(), At = w, Ct = T, Mt = _);
    }, Vt = function(n, u) {
      const l = d.getBoundingClientRect();
      return {
        x: (n - l.left) / l.width * 2 - 1,
        y: -((u - l.top) / l.height * 2 - 1)
      };
    }, Yt = function(n, u) {
      const { x: l, y: p } = Vt(n, u);
      return Tt(
        l,
        p,
        w,
        T,
        _,
        $(),
        ut(),
        U
      );
    }, pe = function(n, u) {
      return De(
        n,
        u,
        r,
        pt,
        Yt
      );
    };
    const x = s.getBoundingClientRect(), P = window.devicePixelRatio || 1;
    d.width = (x.width || 800) * P, d.height = (x.height || 600) * P;
    const e = d.getContext("webgl2", { alpha: !0, premultipliedAlpha: !0, preserveDrawingBuffer: !0 });
    if (!e) {
      o("FAIL: No WebGL2");
      return;
    }
    o("WebGL2: " + e.getParameter(e.RENDERER));
    const X = Ae(e);
    o("Shader compiled OK"), e.useProgram(X);
    const q = e.createBuffer();
    e.bindBuffer(e.ARRAY_BUFFER, q), e.bufferData(e.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), e.STATIC_DRAW);
    const I = e.getAttribLocation(X, "a_pos");
    e.enableVertexAttribArray(I), e.vertexAttribPointer(I, 2, e.FLOAT, !1, 0, 0);
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
      (n) => y[n] = e.getUniformLocation(X, n)
    );
    const Q = e.createTexture();
    e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, Q), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 256, 1, 0, e.RGBA, e.UNSIGNED_BYTE, be()), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), o("Colormap texture OK");
    const Et = e.createTexture();
    e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Et), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 1, 1, 0, e.RGBA, e.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE);
    let tt = 1, et = 1, nt = null, j = [0, 0], Dt = [1, 1], bt = [0, 0], w = 0, T = 0, _ = Math.PI, K = null, U = 0, Wt = 0, qt = 1, jt = 1, Kt = 0, Zt = 1, Z = !1, ot = !1, L = !1, N = null, rt = -999, ct = -999, st = -999, Rt = -999;
    const ue = { linear: 0, log: 1, sqrt: 2, asinh: 3 };
    let St = "pan", At = 0, Ct = 0, Mt = Math.PI, Y = 0, G = 0, lt = !1;
    Pt("pan"), z.addEventListener("click", () => Pt("pan")), H.addEventListener("click", () => Pt("boxzoom")), V.addEventListener("click", () => {
      L = !0, w = At, T = Ct, _ = Mt, t.set("view_ra", w / h), t.set("view_dec", T / h), t.set("view_fov", _ / h), t.save_changes(), dt(), S(), N && clearTimeout(N), N = setTimeout(() => {
        L = !1;
      }, 500);
    });
    let Nt = !1;
    if (t.on("change:image_data", () => {
      B(), ht(), J();
    }), t.on("change:image_shape", () => {
      ht();
    }), t.on("change:crval", () => {
      J();
    }), t.on("change:cdelt", () => {
      J();
    }), t.on("change:crpix", () => {
      J();
    }), t.on("change:vmin", () => {
      B(), Ft();
    }), t.on("change:vmax", () => {
      B(), Ft();
    }), t.on("change:image_revision", () => {
      B(), ht(), J(), t.get("overlay_view_lock") || It(), t.get("overlay_view_lock") || (K = null, r && O()), gt();
    }), t.on("change:crosshair_ra", () => {
      Lt(), gt();
    }), t.on("change:crosshair_dec", () => {
      Lt(), gt();
    }), t.on("change:view_ra", Ut), t.on("change:view_dec", Ut), t.on("change:view_fov", Ut), t.on("change:opacity", () => {
      B(), S();
    }), t.on("change:stretch", () => {
      B(), S();
    }), t.on("change:show_grid", () => {
      B(), S();
    }), t.on("change:background_survey", () => {
      const n = t.get("background_survey");
      s.style.background = n ? "transparent" : "#000", S();
    }), a && f) {
      const n = zt[f] || f, u = (w / h % 360 + 360) % 360, l = T / h, p = _ / h;
      r = a.aladin(g, {
        fov: p || 180,
        target: u + " " + l,
        survey: n,
        ...ae
      }), o("Aladin viewer created: " + f), i(), O();
    }
    t.on("change:background_survey", async () => {
      const n = t.get("background_survey");
      if (n && r) {
        const u = zt[n] || n;
        r.setBaseImageLayer(u), s.style.background = "transparent", i();
      } else if (n && !r && !a)
        try {
          a = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await a.init, ce(g, s), s.appendChild(g), s.style.background = "transparent";
          const l = zt[n] || n;
          r = a.aladin(g, {
            fov: _ / h || 180,
            target: (w / h % 360 + 360) % 360 + " " + T / h,
            survey: l,
            ...ae
          }), o("Aladin loaded on demand: " + n), i(), O();
        } catch (u) {
          o("Aladin load failed: " + u.message);
        }
      else n || (s.style.background = "#000", g.style.display = "none");
      S();
    }), t.on("change:background_cut_min", () => {
      i();
    }), t.on("change:background_cut_max", () => {
      i();
    }), $t();
    let _t = 0;
    const Jt = 30;
    setTimeout(Qt, 50);
    let mt = 0, vt = 0, xt = 0, yt = 0, Bt = !1;
    d.style.cursor = "grab", d.addEventListener("mousedown", (n) => {
      if (L = !0, N && (clearTimeout(N), N = null), xt = n.clientX, yt = n.clientY, Bt = !1, St === "boxzoom") {
        lt = !0;
        const u = s.getBoundingClientRect();
        Y = n.clientX - u.left, G = n.clientY - u.top, R.style.left = Y + "px", R.style.top = G + "px", R.style.width = "0", R.style.height = "0", R.style.display = "block";
      } else
        ot = !0, mt = n.clientX, vt = n.clientY, d.style.cursor = "grabbing";
    }), window.addEventListener("mousemove", (n) => {
      if (ot && !Z) {
        if (Math.sqrt((n.clientX - xt) ** 2 + (n.clientY - yt) ** 2) < 3) return;
        ot = !1, Z = !0;
      }
      if (lt) {
        const m = s.getBoundingClientRect(), b = n.clientX - m.left, A = n.clientY - m.top, M = Math.min(Y, b), F = Math.min(G, A), k = Math.abs(b - Y), it = Math.abs(A - G);
        R.style.left = M + "px", R.style.top = F + "px", R.style.width = k + "px", R.style.height = it + "px", Bt = !0;
        return;
      }
      if (!Z) {
        const m = d.getBoundingClientRect(), b = (n.clientX - m.left) / m.width * 2 - 1, A = -((n.clientY - m.top) / m.height * 2 - 1), M = $(), F = Tt(
          b,
          A,
          w,
          T,
          _,
          M,
          ut(),
          U
        );
        if (F) {
          const k = (F.ra / h % 360 + 360) % 360;
          W.textContent = Fe(k) + "  " + Xe(F.dec / h);
        } else
          W.textContent = "";
        return;
      }
      const u = $(), l = ut();
      if (!de(mt, vt, n.clientX, n.clientY)) {
        const m = Vt(mt, vt), b = Vt(n.clientX, n.clientY), A = Ee(
          m.x,
          m.y,
          b.x,
          b.y,
          w,
          T,
          _,
          u,
          {
            invertHorizontalPan: t.get("invert_horizontal_pan") !== !1,
            scales: l,
            rotationRad: U
          }
        );
        A && (w = A.viewRA, T = A.viewDec);
      }
      r && O(), mt = n.clientX, vt = n.clientY, Bt = !0, requestAnimationFrame(S);
    }), window.addEventListener("mouseup", (n) => {
      if (lt) {
        if (lt = !1, R.style.display = "none", N = setTimeout(() => {
          L = !1;
        }, 500), Math.sqrt((n.clientX - xt) ** 2 + (n.clientY - yt) ** 2) < 5) return;
        const l = s.getBoundingClientRect(), p = n.clientX - l.left, m = n.clientY - l.top, b = (Y + p) / 2 / l.width * 2 - 1, A = -((G + m) / 2 / l.height * 2 - 1), M = Yt(
          l.left + (Y + p) / 2,
          l.top + (G + m) / 2
        );
        if (!M) return;
        w = M.ra, T = M.dec;
        const F = Math.max(
          Math.abs(p - Y) / l.width,
          Math.abs(m - G) / l.height
        ), k = _ * 0.5;
        _ = 2 * Math.asin(Math.min(1, F * Math.sin(k))), _ = Xt(_), t.set("view_ra", w / h), t.set("view_dec", T / h), t.set("view_fov", _ / h), t.save_changes(), kt();
        return;
      }
      if (Z || ot) {
        const u = Z;
        if (Z = !1, ot = !1, d.style.cursor = St === "pan" ? "grab" : "crosshair", N = setTimeout(() => {
          L = !1;
        }, 500), Math.sqrt((n.clientX - xt) ** 2 + (n.clientY - yt) ** 2) < 3) {
          const p = pe(n.clientX, n.clientY);
          if (!p) return;
          const m = (p.ra / h % 360 + 360) % 360, b = p.dec / h;
          t.set("clicked_coord", [m, b]);
          try {
            let Gt = NaN, ee = NaN;
            if (r != null && r.pix2world) {
              const re = pt(n.clientX, n.clientY), at = r.pix2world(re.x, re.y);
              Array.isArray(at) && isFinite(at[0]) && isFinite(at[1]) && (Gt = (at[0] % 360 + 360) % 360, ee = at[1]);
            }
            let ne = NaN, oe = NaN;
            const Ot = Yt(n.clientX, n.clientY);
            Ot && (ne = (Ot.ra / h % 360 + 360) % 360, oe = Ot.dec / h), t.set("clicked_coord_debug", [Gt, ee, ne, oe]);
          } catch {
            t.set("clicked_coord_debug", [NaN, NaN, NaN, NaN]);
          }
          const A = p.ra - j[0], M = Math.sin(p.dec), F = Math.cos(p.dec), k = Math.sin(j[1]), it = Math.cos(j[1]), wt = F * Math.sin(A), _e = M * it - F * k * Math.cos(A);
          t.set("clicked_lm", [wt, _e]);
          const te = t.get("click_tick");
          t.set("click_tick", (te ?? 0) + 1), t.save_changes(), st = -999, Rt = -999, rt = p.ra, ct = p.dec, requestAnimationFrame(S);
        } else
          t.set("view_ra", w / h), t.set("view_dec", T / h), t.save_changes(), kt();
      }
    }), d.addEventListener("wheel", (n) => {
      n.preventDefault(), L = !0, N && clearTimeout(N), _ *= n.deltaY > 0 ? 1.1 : 1 / 1.1, _ = Xt(_), t.set("view_fov", _ / h), t.save_changes(), r ? (r.setFoV(_ / h), requestAnimationFrame(kt)) : requestAnimationFrame(S), N = setTimeout(() => {
        L = !1;
      }, 500);
    }, { passive: !1 }), new ResizeObserver(() => {
      const n = s.getBoundingClientRect(), u = window.devicePixelRatio || 1;
      d.width = n.width * u, d.height = n.height * u, O(), S();
    }).observe(s);
  } catch (x) {
    o("ERROR: " + x.message), o(x.stack);
  }
}
function Fe(t) {
  const c = t / 15, o = Math.floor(c), i = Math.floor((c - o) * 60), a = ((c - o) * 60 - i) * 60;
  return o + "h" + String(i).padStart(2, "0") + "m" + a.toFixed(1).padStart(4, "0") + "s";
}
function Xe(t) {
  const c = t >= 0 ? "+" : "-", o = Math.abs(t), i = Math.floor(o), a = Math.floor((o - i) * 60), r = ((o - i) * 60 - a) * 60;
  return c + i + "°" + String(a).padStart(2, "0") + "'" + r.toFixed(1).padStart(4, "0") + '"';
}
export {
  Ne as render
};
//# sourceMappingURL=widget.js.map
