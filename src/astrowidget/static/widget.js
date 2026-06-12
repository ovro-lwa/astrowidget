const g = Math.PI / 180;
function Bt(t, c) {
  let o, i;
  return c >= 1 ? (o = t, i = t / c) : (i = t, o = t * c), {
    fovWidth: o,
    fovHeight: i,
    scaleX: Math.sin(o * 0.5),
    scaleY: Math.sin(i * 0.5)
  };
}
function de(t) {
  let c = 1e-3 * g, o = Math.PI;
  for (let i = 0; i < 40; i++) {
    const a = (c + o) * 0.5, { scaleX: r, scaleY: u } = Bt(a, t);
    Math.hypot(r, u) <= 1 + 1e-9 ? c = a : o = a;
  }
  return c;
}
function ge(t, c, o, i, a, r = 0) {
  if (!(t != null && t.pix2world) || c < 2 || o < 2) return null;
  if (i == null || a == null) {
    const [e, F] = t.getRaDec();
    i = e * g, a = F * g;
  }
  const u = c * 0.5, l = o * 0.5, d = Math.max(4, c * 0.02), h = Math.max(4, o * 0.02), v = Math.cos(r), E = Math.sin(r);
  function D(e, F) {
    const [H, N] = t.pix2world(e, F), { l: y, m: Q } = ie(H * g, N * g, i, a);
    return r === 0 ? { l0: y, m0: Q } : { l0: y * v - Q * E, m0: y * E + Q * v };
  }
  const C = D(u + d, l), V = D(u - d, l), O = D(u, l - h), z = D(u, l + h), R = 4 * d / c, W = 4 * h / o, x = Math.abs(C.l0 - V.l0) / R, P = Math.abs(O.m0 - z.m0) / W;
  return !Number.isFinite(x) || !Number.isFinite(P) || x < 1e-15 || P < 1e-15 ? null : { scaleX: x, scaleY: P };
}
function re(t, c, o) {
  return (o == null ? void 0 : o.scaleX) > 0 && (o == null ? void 0 : o.scaleY) > 0 ? o : Bt(t, c);
}
function he(t, c, o, i, a = 0) {
  const r = -t * o, u = c * i;
  if (a === 0) return { l: r, m: u };
  const l = Math.cos(a), d = Math.sin(a);
  return {
    l: r * l + u * d,
    m: -r * d + u * l
  };
}
function pe(t, c, o, i, a = 0) {
  let r = t, u = c;
  if (a !== 0) {
    const l = Math.cos(a), d = Math.sin(a);
    r = t * l - c * d, u = t * d + c * l;
  }
  return { x: -r / o, y: u / i };
}
function ie(t, c, o, i) {
  const a = t - o, r = Math.sin(c), u = Math.cos(c), l = Math.sin(i), d = Math.cos(i), h = Math.cos(a), v = r * l + u * d * h, E = u * Math.sin(a), D = r * d - u * l * h;
  return { l: E, m: D, visible: v > 0 };
}
function me(t, c, o, i) {
  const a = Math.sqrt(t * t + c * c);
  if (a > 1) return null;
  const r = Math.sin(i), u = Math.cos(i);
  let l, d;
  if (a === 0)
    l = i, d = o;
  else {
    const h = Math.sqrt(1 - a * a);
    l = Math.asin(h * r + c * u / a * a);
    const v = a;
    l = Math.asin(h * r + c * u * v / a), d = o + Math.atan2(t * v, a * u * h - c * r * v);
  }
  return { ra: d, dec: l };
}
function pt(t, c, o, i, a, r, u = null, l = 0) {
  const { scaleX: d, scaleY: h } = re(a, r, u), { l: v, m: E } = he(t, c, d, h, l);
  return Math.hypot(v, E) > 1 ? null : me(v, E, o, i);
}
function _e(t, c, o, i, a, r, u = null, l = 0) {
  const { l: d, m: h, visible: v } = ie(t, c, o, i);
  if (!v) return null;
  const { scaleX: E, scaleY: D } = re(a, r, u);
  if (E < 1e-15 || D < 1e-15) return { x: 0, y: 0 };
  const { x: C, y: V } = pe(d, h, E, D, l);
  return Math.hypot(d, h) > 1 + 1e-12 ? null : { x: C, y: V };
}
function ve(t, c, o, i, a, r, u, l, d = {}) {
  const h = d.scales ?? null, v = d.rotationRad ?? 0, E = pt(t, c, a, r, u, l, h, v), D = pt(o, i, a, r, u, l, h, v);
  if (!E || !D) return null;
  let C = E.ra - D.ra;
  C > Math.PI && (C -= 2 * Math.PI), C < -Math.PI && (C += 2 * Math.PI);
  const V = d.invertHorizontalPan === !1 ? 1 : -1, O = -Math.PI / 2 + 1e-3, z = Math.PI / 2 - 1e-3;
  return {
    viewRA: a + V * C,
    viewDec: Math.max(O, Math.min(z, r + E.dec - D.dec))
  };
}
function xe(t, c, o, i, a) {
  if (o != null && o.pix2world) {
    const { x: r, y: u } = i(t, c), l = o.pix2world(r, u);
    if (!l || l.length < 2) return null;
    const d = l[0], h = l[1];
    return !Number.isFinite(d) || !Number.isFinite(h) ? null : { ra: d * g, dec: h * g };
  }
  return a(t, c);
}
function ye() {
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
    for (let l = 0; l < t.length - 1; l++) o >= t[l][0] && (i = l);
    const a = Math.min(i + 1, t.length - 1), r = t[a][0] - t[i][0] || 1, u = (o - t[i][0]) / r;
    c[o * 4] = t[i][1] + u * (t[a][1] - t[i][1]) | 0, c[o * 4 + 1] = t[i][2] + u * (t[a][2] - t[i][2]) | 0, c[o * 4 + 2] = t[i][3] + u * (t[a][3] - t[i][3]) | 0, c[o * 4 + 3] = 255;
  }
  return c;
}
const we = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0, 1); }
`, Te = `#version 300 es
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
function ee(t, c, o) {
  const i = t.createShader(c);
  if (t.shaderSource(i, o), t.compileShader(i), !t.getShaderParameter(i, t.COMPILE_STATUS)) {
    const a = t.getShaderInfoLog(i);
    throw t.deleteShader(i), new Error("Shader: " + a);
  }
  return i;
}
function Ee(t) {
  const c = ee(t, t.VERTEX_SHADER, we), o = ee(t, t.FRAGMENT_SHADER, Te), i = t.createProgram();
  if (t.attachShader(i, c), t.attachShader(i, o), t.linkProgram(i), !t.getProgramParameter(i, t.LINK_STATUS))
    throw new Error("Link: " + t.getProgramInfoLog(i));
  return i;
}
function De(t, c, o) {
  const i = t.length, a = new Uint8Array(i * 4), r = o - c || 1e-30;
  for (let u = 0; u < i; u++) {
    const l = t[u];
    if (l !== l || !isFinite(l)) {
      a[u * 4 + 3] = 0;
      continue;
    }
    let d = (l - c) / r;
    d = d < 0 ? 0 : d > 1 ? 1 : d, a[u * 4] = d * 255 + 0.5 | 0, a[u * 4 + 3] = 255;
  }
  return a;
}
const Ut = {
  DSS: "CDS/P/DSS2/color",
  "2MASS": "CDS/P/2MASS/color",
  WISE: "CDS/P/allWISE/color",
  Planck: "CDS/P/PLANCK/R2/HFI/color",
  SDSS: "CDS/P/SDSS9/color",
  Mellinger: "CDS/P/Mellinger/color",
  Fermi: "CDS/P/Fermi/color",
  Haslam408: "CDS/P/HI4PI/NHI"
}, ne = {
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
}, be = [
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
function Re(t) {
  const c = "astrowidget-aladin-control-layer";
  if (t.querySelector(`#${c}`)) return;
  const o = document.createElement("style");
  o.id = c, o.textContent = `
    .astrowidget-aladin-bg ${be} {
      z-index: 0 !important;
      pointer-events: none !important;
    }
  `, t.appendChild(o);
}
function oe(t, c) {
  t.classList.add("astrowidget-aladin-bg"), Re(c);
}
async function Me({ model: t, el: c }) {
  function o(x) {
    console.log("[astrowidget]", x);
  }
  function i() {
    const x = t.get("background_cut_min"), P = t.get("background_cut_max");
    if (!r || !Number.isFinite(x) || !Number.isFinite(P)) return;
    let e = 0;
    function F() {
      var H;
      e += 1;
      try {
        const N = (H = r.getBaseImageLayer) == null ? void 0 : H.call(r);
        if (N != null && N.setCuts) {
          N.setCuts(x, P), o("Background cuts: " + x + " .. " + P);
          return;
        }
      } catch (N) {
        o("Background setCuts pending: " + N.message);
      }
      e < 25 && setTimeout(F, Math.min(100 * e, 1e3));
    }
    F();
  }
  let a = null, r = null;
  const u = t.get("background_survey");
  if (u)
    try {
      a = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await a.init, o("Aladin Lite loaded");
    } catch (x) {
      o("Aladin Lite load failed: " + x.message);
    }
  const l = document.createElement("div");
  l.style.cssText = "position:relative;width:100%;height:600px;background:" + (u && a ? "transparent" : "#000"), c.appendChild(l);
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:0", u && a && (oe(d, l), l.appendChild(d));
  const h = document.createElement("canvas");
  h.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:1", l.appendChild(h);
  const v = document.createElement("div");
  v.style.cssText = "position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:4px", l.appendChild(v);
  const E = "padding:4px 10px;font:12px sans-serif;border:1px solid #888;border-radius:3px;cursor:pointer;color:#fff;background:rgba(0,0,0,0.6)", D = E + ";background:rgba(70,130,255,0.8);border-color:#7af";
  function C(x, P) {
    const e = document.createElement("button");
    return e.textContent = x, e.title = P, e.style.cssText = E, v.appendChild(e), e;
  }
  const V = C("↺", "Reset view to initial position"), O = C("✥", "Pan mode (drag to rotate)"), z = C("⬚", "Box zoom (drag to select region)"), R = document.createElement("div");
  R.style.cssText = "position:absolute;border:2px dashed #7af;background:rgba(70,130,255,0.15);pointer-events:none;z-index:2;display:none", l.appendChild(R);
  const W = document.createElement("div");
  W.style.cssText = "position:absolute;bottom:8px;left:8px;color:#fff;font:13px monospace;text-shadow:0 0 4px #000;pointer-events:none;z-index:2", l.appendChild(W);
  try {
    let Dt = function(n) {
      yt = n, O.style.cssText = n === "pan" ? D : E, z.style.cssText = n === "boxzoom" ? D : E, h.style.cursor = n === "pan" ? "grab" : "crosshair";
    }, bt = function() {
      if (!nt) return;
      const n = De(nt, Vt, Yt);
      e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, mt), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, tt, et, 0, e.RGBA, e.UNSIGNED_BYTE, n);
    }, K = function() {
      const n = r == null ? void 0 : r.view, f = (n == null ? void 0 : n.width) ?? h.clientWidth, s = (n == null ? void 0 : n.height) ?? h.clientHeight;
      return f / Math.max(s, 1);
    }, ct = function() {
      return j || Bt(m, K());
    }, Rt = function(n) {
      const f = 1e-3 * g, s = r ? de(K()) : Math.PI;
      return Math.max(f, Math.min(s, n));
    }, ce = function() {
      if (!(r != null && r.getRaDec)) return;
      const [n, f] = r.getRaDec();
      if (w = n * g, T = f * g, typeof r.getFov == "function") {
        const s = r.getFov(), p = Array.isArray(s) ? s[0] : s, _ = Array.isArray(s) ? s[1] : p;
        m = Math.max(p, _) * g;
      }
      st();
    }, st = function() {
      if (!(r != null && r.getRotation)) {
        U = 0;
        return;
      }
      U = -r.getRotation() * g;
    }, Z = function() {
      if (!r) {
        j = null;
        return;
      }
      const n = r.view, f = (n == null ? void 0 : n.width) ?? d.clientWidth, s = (n == null ? void 0 : n.height) ?? d.clientHeight;
      j = ge(
        r,
        f,
        s,
        w,
        T,
        U
      ) ?? null;
    }, A = function() {
      r && (st(), Z()), e.viewport(0, 0, h.width, h.height), e.clearColor(0, 0, 0, 0), e.clear(e.COLOR_BUFFER_BIT), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE_MINUS_SRC_ALPHA), e.useProgram(F), e.uniform1i(y.u_image, 0), e.uniform1i(y.u_cmap, 1), e.uniform2f(y.u_crval, q[0], q[1]), e.uniform2f(y.u_cdelt, _t[0], _t[1]), e.uniform2f(y.u_crpix, vt[0], vt[1]), e.uniform2f(y.u_imageSize, tt, et), e.uniform2f(y.u_viewCenter, w, T);
      const n = ct();
      e.uniform2f(y.u_viewScale, n.scaleX, n.scaleY), st(), e.uniform1f(y.u_viewRotation, U), e.uniform1f(y.u_fov, m), e.uniform1f(y.u_opacity, Gt), e.uniform1i(y.u_stretch, Ot), e.uniform1i(y.u_showGrid, zt);
      let f = -999, s = -999;
      if (xt > -900) {
        const p = _e(
          xt,
          Wt,
          w,
          T,
          m,
          K(),
          n,
          U
        );
        p && (f = p.x, s = p.y);
      }
      e.uniform2f(y.u_crosshairScreen, f, s), e.uniform2f(y.u_resolution, h.width, h.height), e.drawArrays(e.TRIANGLES, 0, 6);
    }, se = function() {
      nt = null, tt = 1, et = 1, e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, mt), e.texImage2D(
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
    }, lt = function() {
      const n = t.get("image_data"), f = t.get("image_shape"), s = n ? n.byteLength || n.length : 0;
      if (!n || !f || f[0] === 0 || s === 0) {
        se();
        return;
      }
      et = f[0], tt = f[1], nt = new Float32Array(n.buffer.slice(n.byteOffset, n.byteOffset + s)), o("Image: " + tt + "x" + et + ", " + nt.length + " floats"), bt();
    }, $ = function() {
      const n = t.get("crval"), f = t.get("cdelt"), s = t.get("crpix");
      n && (q = [n[0] * g, n[1] * g]), f && (_t = [f[0] * g, f[1] * g]), s && (vt = [s[0], s[1]]);
    }, At = function() {
      w = (t.get("view_ra") || 0) * g, T = (t.get("view_dec") || 0) * g, m = (t.get("view_fov") || 180) * g;
    }, le = function() {
      L || At();
    }, B = function() {
      Vt = t.get("vmin") || 0, Yt = t.get("vmax") || 1, Gt = t.get("opacity") ?? 1, Ot = ae[t.get("stretch")] || 0, zt = t.get("show_grid") === !1 ? 0 : 1;
    }, Ht = function() {
      St || (St = !0, requestAnimationFrame(() => {
        St = !1, A();
      }));
    }, qt = function() {
      B(), lt(), $(), le(), A();
    }, Ct = function() {
      if (r && ce(), J(), A(), t.get("overlay_view_lock")) {
        const n = t.get("view_gesture_revision") || 0;
        t.set("view_gesture_revision", n + 1), t.save_changes();
      }
    }, Mt = function() {
      L || (At(), j = null, J(), Ht());
    }, J = function(n = !0) {
      if (!r) return;
      m = Rt(m);
      const f = m / g;
      if (n) {
        const s = (w / g % 360 + 360) % 360, p = T / g;
        r.gotoRaDec(s, p);
      }
      r.setFoV(f), Z();
    }, ut = function(n, f) {
      const s = d.getBoundingClientRect(), p = r.view, _ = (p == null ? void 0 : p.width) ?? s.width, b = (p == null ? void 0 : p.height) ?? s.height;
      return {
        x: (n - s.left) * (_ / s.width),
        y: (f - s.top) * (b / s.height)
      };
    }, ue = function(n, f, s, p) {
      var ht;
      const _ = (ht = r == null ? void 0 : r.view) == null ? void 0 : ht.wasm;
      if (!(_ != null && _.goFromTo)) return !1;
      let { x: b, y: M } = ut(n, f), { x: S, y: X } = ut(s, p);
      t.get("invert_horizontal_pan") === !1 && ([b, S] = [S, b]), _.goFromTo(b, M, S, X), r.view.updateCenter();
      const [k, ot] = r.getRaDec();
      return w = k * g, T = ot * g, st(), !0;
    }, Kt = function() {
      ft++, qt();
      const n = t.get("image_data");
      if (n && (n.byteLength || n.length) > 0) {
        o("Data arrived after " + ft + " poll(s)"), requestAnimationFrame(A), J(), wt = w, Tt = T, Et = m;
        return;
      }
      ft < jt ? setTimeout(Kt, Math.min(100 * Math.pow(1.5, ft - 1), 1e3)) : (o("No image data after " + jt + " polls — waiting for change event"), J(), wt = w, Tt = T, Et = m);
    }, It = function(n, f) {
      const s = h.getBoundingClientRect();
      return {
        x: (n - s.left) / s.width * 2 - 1,
        y: -((f - s.top) / s.height * 2 - 1)
      };
    }, Xt = function(n, f) {
      const { x: s, y: p } = It(n, f);
      return pt(
        s,
        p,
        w,
        T,
        m,
        K(),
        ct(),
        U
      );
    }, fe = function(n, f) {
      return xe(
        n,
        f,
        r,
        ut,
        Xt
      );
    };
    const x = l.getBoundingClientRect(), P = window.devicePixelRatio || 1;
    h.width = (x.width || 800) * P, h.height = (x.height || 600) * P;
    const e = h.getContext("webgl2", { alpha: !0, premultipliedAlpha: !0, preserveDrawingBuffer: !0 });
    if (!e) {
      o("FAIL: No WebGL2");
      return;
    }
    o("WebGL2: " + e.getParameter(e.RENDERER));
    const F = Ee(e);
    o("Shader compiled OK"), e.useProgram(F);
    const H = e.createBuffer();
    e.bindBuffer(e.ARRAY_BUFFER, H), e.bufferData(e.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), e.STATIC_DRAW);
    const N = e.getAttribLocation(F, "a_pos");
    e.enableVertexAttribArray(N), e.vertexAttribPointer(N, 2, e.FLOAT, !1, 0, 0);
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
      (n) => y[n] = e.getUniformLocation(F, n)
    );
    const Q = e.createTexture();
    e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, Q), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 256, 1, 0, e.RGBA, e.UNSIGNED_BYTE, ye()), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), o("Colormap texture OK");
    const mt = e.createTexture();
    e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, mt), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 1, 1, 0, e.RGBA, e.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE);
    let tt = 1, et = 1, nt = null, q = [0, 0], _t = [1, 1], vt = [0, 0], w = 0, T = 0, m = Math.PI, j = null, U = 0, Vt = 0, Yt = 1, Gt = 1, Ot = 0, zt = 1, it = !1, L = !1, I = null, xt = -999, Wt = -999;
    const ae = { linear: 0, log: 1, sqrt: 2, asinh: 3 };
    let yt = "pan", wt = 0, Tt = 0, Et = Math.PI, Y = 0, G = 0, at = !1;
    Dt("pan"), O.addEventListener("click", () => Dt("pan")), z.addEventListener("click", () => Dt("boxzoom")), V.addEventListener("click", () => {
      L = !0, w = wt, T = Tt, m = Et, t.set("view_ra", w / g), t.set("view_dec", T / g), t.set("view_fov", m / g), t.save_changes(), J(), A(), I && clearTimeout(I), I = setTimeout(() => {
        L = !1;
      }, 500);
    });
    let St = !1;
    if (t.on("change:image_data", () => {
      B(), lt(), $();
    }), t.on("change:image_shape", () => {
      lt();
    }), t.on("change:crval", () => {
      $();
    }), t.on("change:cdelt", () => {
      $();
    }), t.on("change:crpix", () => {
      $();
    }), t.on("change:vmin", () => {
      B(), bt();
    }), t.on("change:vmax", () => {
      B(), bt();
    }), t.on("change:image_revision", () => {
      B(), lt(), $(), At(), j = null, r && J(), Ht();
    }), t.on("change:view_ra", Mt), t.on("change:view_dec", Mt), t.on("change:view_fov", Mt), t.on("change:opacity", () => {
      B(), A();
    }), t.on("change:stretch", () => {
      B(), A();
    }), t.on("change:show_grid", () => {
      B(), A();
    }), t.on("change:background_survey", () => {
      const n = t.get("background_survey");
      l.style.background = n ? "transparent" : "#000", A();
    }), a && u) {
      const n = Ut[u] || u, f = (w / g % 360 + 360) % 360, s = T / g, p = m / g;
      r = a.aladin(d, {
        fov: p || 180,
        target: f + " " + s,
        survey: n,
        ...ne
      }), o("Aladin viewer created: " + u), i(), Z();
    }
    t.on("change:background_survey", async () => {
      const n = t.get("background_survey");
      if (n && r) {
        const f = Ut[n] || n;
        r.setBaseImageLayer(f), l.style.background = "transparent", i();
      } else if (n && !r && !a)
        try {
          a = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await a.init, oe(d, l), l.appendChild(d), l.style.background = "transparent";
          const s = Ut[n] || n;
          r = a.aladin(d, {
            fov: m / g || 180,
            target: (w / g % 360 + 360) % 360 + " " + T / g,
            survey: s,
            ...ne
          }), o("Aladin loaded on demand: " + n), i(), Z();
        } catch (f) {
          o("Aladin load failed: " + f.message);
        }
      else n || (l.style.background = "#000", d.style.display = "none");
      A();
    }), t.on("change:background_cut_min", () => {
      i();
    }), t.on("change:background_cut_max", () => {
      i();
    }), qt();
    let ft = 0;
    const jt = 30;
    setTimeout(Kt, 50);
    let dt = 0, gt = 0, Pt = 0, Ft = 0, Nt = !1;
    h.style.cursor = "grab", h.addEventListener("mousedown", (n) => {
      if (L = !0, I && (clearTimeout(I), I = null), Pt = n.clientX, Ft = n.clientY, Nt = !1, yt === "boxzoom") {
        at = !0;
        const f = l.getBoundingClientRect();
        Y = n.clientX - f.left, G = n.clientY - f.top, R.style.left = Y + "px", R.style.top = G + "px", R.style.width = "0", R.style.height = "0", R.style.display = "block";
      } else
        it = !0, dt = n.clientX, gt = n.clientY, h.style.cursor = "grabbing";
    }), window.addEventListener("mousemove", (n) => {
      if (at) {
        const _ = l.getBoundingClientRect(), b = n.clientX - _.left, M = n.clientY - _.top, S = Math.min(Y, b), X = Math.min(G, M), k = Math.abs(b - Y), ot = Math.abs(M - G);
        R.style.left = S + "px", R.style.top = X + "px", R.style.width = k + "px", R.style.height = ot + "px", Nt = !0;
        return;
      }
      if (!it) {
        const _ = h.getBoundingClientRect(), b = (n.clientX - _.left) / _.width * 2 - 1, M = -((n.clientY - _.top) / _.height * 2 - 1), S = K(), X = pt(
          b,
          M,
          w,
          T,
          m,
          S,
          ct(),
          U
        );
        if (X) {
          const k = (X.ra / g % 360 + 360) % 360;
          W.textContent = Ae(k) + "  " + Se(X.dec / g);
        } else
          W.textContent = "";
        return;
      }
      const f = K(), s = ct();
      if (!ue(dt, gt, n.clientX, n.clientY)) {
        const _ = It(dt, gt), b = It(n.clientX, n.clientY), M = ve(
          _.x,
          _.y,
          b.x,
          b.y,
          w,
          T,
          m,
          f,
          {
            invertHorizontalPan: t.get("invert_horizontal_pan") !== !1,
            scales: s,
            rotationRad: U
          }
        );
        M && (w = M.viewRA, T = M.viewDec);
      }
      r && Z(), dt = n.clientX, gt = n.clientY, Nt = !0, requestAnimationFrame(A);
    }), window.addEventListener("mouseup", (n) => {
      if (at) {
        if (at = !1, R.style.display = "none", I = setTimeout(() => {
          L = !1;
        }, 500), Math.sqrt((n.clientX - Pt) ** 2 + (n.clientY - Ft) ** 2) < 5) return;
        const s = l.getBoundingClientRect(), p = n.clientX - s.left, _ = n.clientY - s.top, b = (Y + p) / 2 / s.width * 2 - 1, M = -((G + _) / 2 / s.height * 2 - 1), S = Xt(
          s.left + (Y + p) / 2,
          s.top + (G + _) / 2
        );
        if (!S) return;
        w = S.ra, T = S.dec;
        const X = Math.max(
          Math.abs(p - Y) / s.width,
          Math.abs(_ - G) / s.height
        ), k = m * 0.5;
        m = 2 * Math.asin(Math.min(1, X * Math.sin(k))), m = Rt(m), t.set("view_ra", w / g), t.set("view_dec", T / g), t.set("view_fov", m / g), t.save_changes(), Ct();
        return;
      }
      if (it)
        if (it = !1, h.style.cursor = yt === "pan" ? "grab" : "crosshair", I = setTimeout(() => {
          L = !1;
        }, 500), Math.sqrt((n.clientX - Pt) ** 2 + (n.clientY - Ft) ** 2) < 3) {
          const s = fe(n.clientX, n.clientY);
          if (!s) return;
          const p = (s.ra / g % 360 + 360) % 360, _ = s.dec / g;
          t.set("clicked_coord", [p, _]);
          try {
            let Lt = NaN, $t = NaN;
            if (r != null && r.pix2world) {
              const te = ut(n.clientX, n.clientY), rt = r.pix2world(te.x, te.y);
              Array.isArray(rt) && isFinite(rt[0]) && isFinite(rt[1]) && (Lt = (rt[0] % 360 + 360) % 360, $t = rt[1]);
            }
            let Jt = NaN, Qt = NaN;
            const kt = Xt(n.clientX, n.clientY);
            kt && (Jt = (kt.ra / g % 360 + 360) % 360, Qt = kt.dec / g), t.set("clicked_coord_debug", [Lt, $t, Jt, Qt]);
          } catch {
            t.set("clicked_coord_debug", [NaN, NaN, NaN, NaN]);
          }
          const b = s.ra - q[0], M = Math.sin(s.dec), S = Math.cos(s.dec), X = Math.sin(q[1]), k = Math.cos(q[1]), ot = S * Math.sin(b), ht = M * k - S * X * Math.cos(b);
          t.set("clicked_lm", [ot, ht]);
          const Zt = t.get("click_tick");
          t.set("click_tick", (Zt ?? 0) + 1), t.save_changes(), xt = s.ra, Wt = s.dec, requestAnimationFrame(A);
        } else
          t.set("view_ra", w / g), t.set("view_dec", T / g), t.save_changes(), Ct();
    }), h.addEventListener("wheel", (n) => {
      n.preventDefault(), L = !0, I && clearTimeout(I), m *= n.deltaY > 0 ? 1.1 : 1 / 1.1, m = Rt(m), t.set("view_fov", m / g), t.save_changes(), r ? (r.setFoV(m / g), requestAnimationFrame(Ct)) : requestAnimationFrame(A), I = setTimeout(() => {
        L = !1;
      }, 500);
    }, { passive: !1 }), new ResizeObserver(() => {
      const n = l.getBoundingClientRect(), f = window.devicePixelRatio || 1;
      h.width = n.width * f, h.height = n.height * f, Z(), A();
    }).observe(l);
  } catch (x) {
    o("ERROR: " + x.message), o(x.stack);
  }
}
function Ae(t) {
  const c = t / 15, o = Math.floor(c), i = Math.floor((c - o) * 60), a = ((c - o) * 60 - i) * 60;
  return o + "h" + String(i).padStart(2, "0") + "m" + a.toFixed(1).padStart(4, "0") + "s";
}
function Se(t) {
  const c = t >= 0 ? "+" : "-", o = Math.abs(t), i = Math.floor(o), a = Math.floor((o - i) * 60), r = ((o - i) * 60 - a) * 60;
  return c + i + "°" + String(a).padStart(2, "0") + "'" + r.toFixed(1).padStart(4, "0") + '"';
}
export {
  Me as render
};
//# sourceMappingURL=widget.js.map
