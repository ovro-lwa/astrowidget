const h = Math.PI / 180;
function fe(t, c) {
  let r, i;
  return c >= 1 ? (r = t, i = t / c) : (i = t, r = t * c), {
    fovWidth: r,
    fovHeight: i,
    scaleX: Math.sin(r * 0.5),
    scaleY: Math.sin(i * 0.5)
  };
}
function we(t) {
  return Math.PI;
}
function Te(t, c, r, i, s, f = 0) {
  if (!(t != null && t.pix2world) || c < 2 || r < 2) return null;
  if (i == null || s == null) {
    const [b, e] = t.getRaDec();
    i = b * h, s = e * h;
  }
  const o = c * 0.5, d = r * 0.5, u = Math.max(4, c * 0.02), p = Math.max(4, r * 0.02), g = Math.cos(f), T = Math.sin(f);
  function w(b, e) {
    const [P, H] = t.pix2world(b, e), { l: M, m: x } = he(P * h, H * h, i, s);
    return f === 0 ? { l0: M, m0: x } : { l0: M * g - x * T, m0: M * T + x * g };
  }
  const N = w(o + u, d), I = w(o - u, d), Z = w(o, d - p), z = w(o, d + p), at = 4 * u / c, A = 4 * p / r, U = Math.abs(N.l0 - I.l0) / at, _ = Math.abs(Z.m0 - z.m0) / A;
  return !Number.isFinite(U) || !Number.isFinite(_) || U < 1e-15 || _ < 1e-15 ? null : { scaleX: U, scaleY: _ };
}
function de(t, c, r) {
  return (r == null ? void 0 : r.scaleX) > 0 && (r == null ? void 0 : r.scaleY) > 0 ? r : fe(t, c);
}
function Ee(t, c, r, i, s = 0) {
  const f = -t * r, o = c * i;
  if (s === 0) return { l: f, m: o };
  const d = Math.cos(s), u = Math.sin(s);
  return {
    l: f * d + o * u,
    m: -f * u + o * d
  };
}
function Se(t, c, r, i, s = 0) {
  let f = t, o = c;
  if (s !== 0) {
    const d = Math.cos(s), u = Math.sin(s);
    f = t * d - c * u, o = t * u + c * d;
  }
  return { x: -f / r, y: o / i };
}
function he(t, c, r, i) {
  const s = t - r, f = Math.sin(c), o = Math.cos(c), d = Math.sin(i), u = Math.cos(i), p = Math.cos(s), g = f * d + o * u * p, T = o * Math.sin(s), w = f * u - o * d * p;
  return { l: T, m: w, visible: g > 0 };
}
function be(t, c, r, i) {
  const s = Math.sqrt(t * t + c * c);
  if (s > 1) return null;
  const f = Math.sin(i), o = Math.cos(i);
  let d, u;
  if (s === 0)
    d = i, u = r;
  else {
    const p = Math.sqrt(1 - s * s);
    d = Math.asin(p * f + c * o / s * s);
    const g = s;
    d = Math.asin(p * f + c * o * g / s), u = r + Math.atan2(t * g, s * o * p - c * f * g);
  }
  return { ra: u, dec: d };
}
function Tt(t, c, r, i, s, f, o = null, d = 0) {
  const { scaleX: u, scaleY: p } = de(s, f, o), { l: g, m: T } = Ee(t, c, u, p, d);
  return Math.hypot(g, T) > 1 ? null : be(g, T, r, i);
}
function De(t, c, r, i, s, f, o = null, d = 0) {
  const { l: u, m: p, visible: g } = he(t, c, r, i);
  if (!g) return null;
  const { scaleX: T, scaleY: w } = de(s, f, o);
  if (T < 1e-15 || w < 1e-15) return { x: 0, y: 0 };
  const { x: N, y: I } = Se(u, p, T, w, d);
  return Math.hypot(u, p) > 1 + 1e-12 ? null : { x: N, y: I };
}
function Ae(t, c, r, i, s, f, o, d, u = {}) {
  const p = u.scales ?? null, g = u.rotationRad ?? 0, T = Tt(t, c, s, f, o, d, p, g), w = Tt(r, i, s, f, o, d, p, g);
  if (!T || !w) return null;
  let N = T.ra - w.ra;
  N > Math.PI && (N -= 2 * Math.PI), N < -Math.PI && (N += 2 * Math.PI);
  const I = u.invertHorizontalPan === !1 ? 1 : -1, Z = -Math.PI / 2 + 1e-3, z = Math.PI / 2 - 1e-3;
  return {
    viewRA: s + I * N,
    viewDec: Math.max(Z, Math.min(z, f + T.dec - w.dec))
  };
}
function Re(t, c, r, i, s) {
  if (r != null && r.pix2world) {
    const { x: f, y: o } = i(t, c), d = r.pix2world(f, o);
    if (!d || d.length < 2) return null;
    const u = d[0], p = d[1];
    return !Number.isFinite(u) || !Number.isFinite(p) ? null : { ra: u * h, dec: p * h };
  }
  return s(t, c);
}
function Ce() {
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
  for (let r = 0; r < 256; r++) {
    let i = 0;
    for (let d = 0; d < t.length - 1; d++) r >= t[d][0] && (i = d);
    const s = Math.min(i + 1, t.length - 1), f = t[s][0] - t[i][0] || 1, o = (r - t[i][0]) / f;
    c[r * 4] = t[i][1] + o * (t[s][1] - t[i][1]) | 0, c[r * 4 + 1] = t[i][2] + o * (t[s][2] - t[i][2]) | 0, c[r * 4 + 2] = t[i][3] + o * (t[s][3] - t[i][3]) | 0, c[r * 4 + 3] = 255;
  }
  return c;
}
const Pe = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0, 1); }
`, Me = `#version 300 es
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
function se(t, c, r) {
  const i = t.createShader(c);
  if (t.shaderSource(i, r), t.compileShader(i), !t.getShaderParameter(i, t.COMPILE_STATUS)) {
    const s = t.getShaderInfoLog(i);
    throw t.deleteShader(i), new Error("Shader: " + s);
  }
  return i;
}
function Fe(t) {
  const c = se(t, t.VERTEX_SHADER, Pe), r = se(t, t.FRAGMENT_SHADER, Me), i = t.createProgram();
  if (t.attachShader(i, c), t.attachShader(i, r), t.linkProgram(i), !t.getProgramParameter(i, t.LINK_STATUS))
    throw new Error("Link: " + t.getProgramInfoLog(i));
  return i;
}
function Ne(t, c, r) {
  const i = t.length, s = new Uint8Array(i * 4), f = r - c || 1e-30;
  for (let o = 0; o < i; o++) {
    const d = t[o];
    if (d !== d || !isFinite(d)) {
      s[o * 4 + 3] = 0;
      continue;
    }
    let u = (d - c) / f;
    u = u < 0 ? 0 : u > 1 ? 1 : u, s[o * 4] = u * 255 + 0.5 | 0, s[o * 4 + 3] = 255;
  }
  return s;
}
const jt = {
  DSS: "CDS/P/DSS2/color",
  "2MASS": "CDS/P/2MASS/color",
  WISE: "CDS/P/allWISE/color",
  Planck: "CDS/P/PLANCK/R2/HFI/color",
  SDSS: "CDS/P/SDSS9/color",
  Mellinger: "CDS/P/Mellinger/color",
  Fermi: "CDS/P/Fermi/color",
  Haslam408: "CDS/P/HI4PI/NHI"
}, le = {
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
}, Xe = [
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
function Ie(t) {
  const c = "astrowidget-aladin-control-layer";
  if (t.querySelector(`#${c}`)) return;
  const r = document.createElement("style");
  r.id = c, r.textContent = `
    .astrowidget-aladin-bg ${Xe} {
      z-index: 0 !important;
      pointer-events: none !important;
    }
  `, t.appendChild(r);
}
function ue(t, c) {
  t.classList.add("astrowidget-aladin-bg"), Ie(c);
}
async function Be({ model: t, el: c }) {
  function r(_) {
    console.log("[astrowidget]", _);
  }
  function i(_) {
    if (!(f != null && f.imageHiPS) || typeof _ != "string" || !/\.hips\/?$/.test(_))
      return _;
    const b = t.get("background_cut_min"), e = t.get("background_cut_max"), P = { name: "Local HiPS", imgFormat: "fits", stretch: "linear" };
    return Number.isFinite(b) && Number.isFinite(e) && e > b && (P.minCut = b, P.maxCut = e), f.imageHiPS(_, P);
  }
  function s() {
    const _ = t.get("background_cut_min"), b = t.get("background_cut_max");
    if (!o || !Number.isFinite(_) || !Number.isFinite(b) || !(b > _)) return;
    let e = 0;
    function P() {
      var H;
      e += 1;
      try {
        const M = (H = o.getBaseImageLayer) == null ? void 0 : H.call(o);
        if (M != null && M.setCuts) {
          M.setCuts(_, b), r("Background cuts: " + _ + " .. " + b);
          return;
        }
      } catch (M) {
        r("Background setCuts pending: " + M.message);
      }
      e < 25 && setTimeout(P, Math.min(100 * e, 1e3));
    }
    P();
  }
  let f = null, o = null;
  const d = t.get("background_survey");
  if (d)
    try {
      f = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await f.init, r("Aladin Lite loaded");
    } catch (_) {
      r("Aladin Lite load failed: " + _.message);
    }
  const u = document.createElement("div");
  u.style.cssText = "position:relative;width:100%;height:600px;background:" + (d && f ? "transparent" : "#000"), c.appendChild(u);
  const p = document.createElement("div");
  p.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:0", d && f && (ue(p, u), u.appendChild(p));
  const g = document.createElement("canvas");
  g.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:1", u.appendChild(g);
  const T = document.createElement("div");
  T.style.cssText = "position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:4px", u.appendChild(T);
  const w = "padding:4px 10px;font:12px sans-serif;border:1px solid #888;border-radius:3px;cursor:pointer;color:#fff;background:rgba(0,0,0,0.6)", N = w + ";background:rgba(70,130,255,0.8);border-color:#7af";
  function I(_, b) {
    const e = document.createElement("button");
    return e.textContent = _, e.title = b, e.style.cssText = w, T.appendChild(e), e;
  }
  const Z = I("↺", "Reset view to initial position"), z = I("✥", "Pan mode (drag to rotate)"), at = I("⬚", "Box zoom (drag to select region)"), A = document.createElement("div");
  A.style.cssText = "position:absolute;border:2px dashed #7af;background:rgba(70,130,255,0.15);pointer-events:none;z-index:2;display:none", u.appendChild(A);
  const U = document.createElement("div");
  U.style.cssText = "position:absolute;bottom:8px;left:8px;color:#fff;font:13px monospace;text-shadow:0 0 4px #000;pointer-events:none;z-index:2", u.appendChild(U);
  try {
    let me = function() {
      At && clearTimeout(At), Dt = !0, At = setTimeout(() => {
        Dt = !1;
      }, 500);
    }, lt = function() {
      me(), t.set("view_ra", E / h), t.set("view_dec", S / h), t.set("view_fov", y / h), t.save_changes();
    }, ut = function() {
      return !Dt && !q && !nt;
    }, Nt = function(n) {
      Ct = n, z.style.cssText = n === "pan" ? N : w, at.style.cssText = n === "boxzoom" ? N : w, g.style.cursor = n === "pan" ? "grab" : "crosshair";
    }, Xt = function() {
      if (!tt) return;
      const n = Ne(tt, Kt, $t);
      e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Et), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, J, Q, 0, e.RGBA, e.UNSIGNED_BYTE, n);
    }, j = function() {
      const n = o == null ? void 0 : o.view, l = (n == null ? void 0 : n.width) ?? g.clientWidth, a = (n == null ? void 0 : n.height) ?? g.clientHeight;
      return l / Math.max(a, 1);
    }, ft = function() {
      return k || fe(y, j());
    }, It = function(n) {
      const l = 1e-3 * h, a = we(j());
      return Math.max(l, Math.min(a, n));
    }, kt = function() {
      if (!(o != null && o.getRaDec)) return;
      const [n, l] = o.getRaDec();
      if (E = n * h, S = l * h, typeof o.getFov == "function") {
        const a = o.getFov(), m = Array.isArray(a) ? a[0] : a, v = Array.isArray(a) ? a[1] : m;
        y = Math.max(m, v) * h;
      }
      Lt();
    }, Lt = function() {
      if (!(o != null && o.getRotation)) {
        B = 0;
        return;
      }
      B = -o.getRotation() * h;
    }, O = function() {
      if (!o) {
        k = null;
        return;
      }
      const n = o.view, l = (n == null ? void 0 : n.width) ?? p.clientWidth, a = (n == null ? void 0 : n.height) ?? p.clientHeight;
      k = Te(
        o,
        l,
        a,
        E,
        S,
        B
      ) ?? null;
    }, Ut = function() {
      o && (kt(), k = null, O());
    }, R = function() {
      o && (Lt(), O()), e.viewport(0, 0, g.width, g.height), e.clearColor(0, 0, 0, 0), e.clear(e.COLOR_BUFFER_BIT), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE_MINUS_SRC_ALPHA), e.useProgram(P), e.uniform1i(x.u_image, 0), e.uniform1i(x.u_cmap, 1), e.uniform2f(x.u_crval, W[0], W[1]), e.uniform2f(x.u_cdelt, St[0], St[1]), e.uniform2f(x.u_crpix, bt[0], bt[1]), e.uniform2f(x.u_imageSize, J, Q), e.uniform2f(x.u_viewCenter, E, S);
      const n = ft();
      e.uniform2f(x.u_viewScale, n.scaleX, n.scaleY), e.uniform1f(x.u_viewRotation, B), e.uniform1f(x.u_fov, y), e.uniform1f(x.u_opacity, Zt), e.uniform1i(x.u_stretch, Jt), e.uniform1i(x.u_showGrid, Qt);
      let l = -999, a = -999;
      if (st > -900)
        l = st, a = Rt;
      else if (ot > -900) {
        const m = De(
          ot,
          ct,
          E,
          S,
          y,
          j(),
          n,
          B
        );
        m && (l = m.x, a = m.y);
      }
      e.uniform2f(x.u_crosshairScreen, l, a), e.uniform2f(x.u_resolution, g.width, g.height), e.drawArrays(e.TRIANGLES, 0, 6);
    }, _e = function() {
      tt = null, J = 1, Q = 1, e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Et), e.texImage2D(
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
    }, dt = function() {
      const n = t.get("image_data"), l = t.get("image_shape"), a = n ? n.byteLength || n.length : 0;
      if (!n || !l || l[0] === 0 || a === 0) {
        _e();
        return;
      }
      Q = l[0], J = l[1], tt = new Float32Array(n.buffer.slice(n.byteOffset, n.byteOffset + a)), r("Image: " + J + "x" + Q + ", " + tt.length + " floats"), Xt();
    }, K = function() {
      const n = t.get("crval"), l = t.get("cdelt"), a = t.get("crpix");
      n && (W = [n[0] * h, n[1] * h]), l && (St = [l[0] * h, l[1] * h]), a && (bt = [a[0], a[1]]);
    }, ht = function() {
      E = (t.get("view_ra") || 0) * h, S = (t.get("view_dec") || 0) * h, y = (t.get("view_fov") || 180) * h;
    }, ve = function() {
      ut() && ht();
    }, V = function() {
      Kt = t.get("vmin") || 0, $t = t.get("vmax") || 1, Zt = t.get("opacity") ?? 1, Jt = pe[t.get("stretch")] || 0, Qt = t.get("show_grid") === !1 ? 0 : 1;
    }, gt = function() {
      Bt || (Bt = !0, requestAnimationFrame(() => {
        Bt = !1, R();
      }));
    }, Vt = function() {
      const n = t.get("crosshair_ra"), l = t.get("crosshair_dec");
      typeof n != "number" || typeof l != "number" || n < -900 || l < -900 ? (ot = -999, ct = -999) : (ot = n * h, ct = l * h, st = -999, Rt = -999);
    }, te = function() {
      V(), dt(), K(), ve(), Vt(), o && ut() && $(), R();
    }, Yt = function({ pushToAladin: n = !1 } = {}) {
      if (o && (n ? $() : (kt(), k = null, O())), R(), t.get("overlay_view_lock")) {
        const l = t.get("view_gesture_revision") || 0;
        t.set("view_gesture_revision", l + 1), t.save_changes();
      }
    }, Gt = function() {
      ut() && (ht(), k = null, $(), gt());
    }, $ = function(n = !0) {
      if (!o) return;
      y = It(y);
      const l = y / h;
      if (n) {
        const a = (E / h % 360 + 360) % 360, m = S / h;
        o.gotoRaDec(a, m);
      }
      o.setFoV(l), kt(), k = null, O();
    }, pt = function(n, l) {
      const a = p.getBoundingClientRect(), m = o.view, v = (m == null ? void 0 : m.width) ?? a.width, D = (m == null ? void 0 : m.height) ?? a.height;
      return {
        x: (n - a.left) * (v / a.width),
        y: (l - a.top) * (D / a.height)
      };
    }, ye = function(n, l, a, m) {
      var wt;
      const v = (wt = o == null ? void 0 : o.view) == null ? void 0 : wt.wasm;
      if (!(v != null && v.goFromTo)) return !1;
      let { x: D, y: F } = pt(n, l), { x: C, y: X } = pt(a, m);
      t.get("invert_horizontal_pan") === !1 && ([D, C] = [C, D]), v.goFromTo(D, F, C, X), o.view.updateCenter();
      const [L, rt] = o.getRaDec();
      return E = L * h, S = rt * h, Lt(), !0;
    }, ne = function() {
      mt++, te();
      const n = t.get("image_data");
      if (n && (n.byteLength || n.length) > 0) {
        r("Data arrived after " + mt + " poll(s)"), requestAnimationFrame(R), Pt = E, Mt = S, Ft = y;
        return;
      }
      mt < ee ? setTimeout(ne, Math.min(100 * Math.pow(1.5, mt - 1), 1e3)) : (r("No image data after " + ee + " polls — waiting for change event"), $(), Pt = E, Mt = S, Ft = y);
    }, zt = function(n, l) {
      const a = g.getBoundingClientRect();
      return {
        x: (n - a.left) / a.width * 2 - 1,
        y: -((l - a.top) / a.height * 2 - 1)
      };
    }, Ht = function(n, l) {
      const { x: a, y: m } = zt(n, l);
      return Tt(
        a,
        m,
        E,
        S,
        y,
        j(),
        ft(),
        B
      );
    }, xe = function(n, l) {
      return Re(
        n,
        l,
        o,
        pt,
        Ht
      );
    };
    const _ = u.getBoundingClientRect(), b = window.devicePixelRatio || 1;
    g.width = (_.width || 800) * b, g.height = (_.height || 600) * b;
    const e = g.getContext("webgl2", { alpha: !0, premultipliedAlpha: !0, preserveDrawingBuffer: !0 });
    if (!e) {
      r("FAIL: No WebGL2");
      return;
    }
    r("WebGL2: " + e.getParameter(e.RENDERER));
    const P = Fe(e);
    r("Shader compiled OK"), e.useProgram(P);
    const H = e.createBuffer();
    e.bindBuffer(e.ARRAY_BUFFER, H), e.bufferData(e.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), e.STATIC_DRAW);
    const M = e.getAttribLocation(P, "a_pos");
    e.enableVertexAttribArray(M), e.vertexAttribPointer(M, 2, e.FLOAT, !1, 0, 0);
    const x = {};
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
      (n) => x[n] = e.getUniformLocation(P, n)
    );
    const ge = e.createTexture();
    e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, ge), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 256, 1, 0, e.RGBA, e.UNSIGNED_BYTE, Ce()), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), r("Colormap texture OK");
    const Et = e.createTexture();
    e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Et), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 1, 1, 0, e.RGBA, e.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE);
    let J = 1, Q = 1, tt = null, W = [0, 0], St = [1, 1], bt = [0, 0], E = 0, S = 0, y = Math.PI, k = null, B = 0, Kt = 0, $t = 1, Zt = 1, Jt = 0, Qt = 1, q = !1, et = !1, nt = !1, Dt = !1, At = null, ot = -999, ct = -999, st = -999, Rt = -999;
    const pe = { linear: 0, log: 1, sqrt: 2, asinh: 3 };
    let Ct = "pan", Pt = 0, Mt = 0, Ft = Math.PI, Y = 0, G = 0;
    Nt("pan"), z.addEventListener("click", () => Nt("pan")), at.addEventListener("click", () => Nt("boxzoom")), Z.addEventListener("click", () => {
      E = Pt, S = Mt, y = Ft, lt(), $(), R();
    });
    let Bt = !1;
    if (t.on("change:image_data", () => {
      V(), dt(), K();
    }), t.on("change:image_shape", () => {
      dt();
    }), t.on("change:crval", () => {
      K();
    }), t.on("change:cdelt", () => {
      K();
    }), t.on("change:crpix", () => {
      K();
    }), t.on("change:vmin", () => {
      V(), Xt();
    }), t.on("change:vmax", () => {
      V(), Xt();
    }), t.on("change:image_revision", () => {
      V(), dt(), K(), t.get("overlay_view_lock") || (ut() ? (ht(), o && $()) : (k = null, o && O())), gt();
    }), t.on("change:crosshair_ra", () => {
      Vt(), gt();
    }), t.on("change:crosshair_dec", () => {
      Vt(), gt();
    }), t.on("change:view_ra", Gt), t.on("change:view_dec", Gt), t.on("change:view_fov", Gt), t.on("change:opacity", () => {
      V(), R();
    }), t.on("change:stretch", () => {
      V(), R();
    }), t.on("change:show_grid", () => {
      V(), R();
    }), t.on("change:background_survey", () => {
      const n = t.get("background_survey");
      u.style.background = n ? "transparent" : "#000", R();
    }), f && d) {
      ht();
      const n = jt[d] || d, l = (E / h % 360 + 360) % 360, a = S / h, m = y / h;
      o = f.aladin(p, {
        fov: m || 180,
        target: l + " " + a,
        survey: i(n),
        ...le
      }), r("Aladin viewer created: " + d), s(), Ut();
    }
    t.on("change:background_survey", async () => {
      const n = t.get("background_survey");
      if (n && o) {
        const l = jt[n] || n;
        o.setBaseImageLayer(i(l)), u.style.background = "transparent", s();
      } else if (n && !o && !f)
        try {
          f = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await f.init, ue(p, u), u.appendChild(p), u.style.background = "transparent";
          const a = jt[n] || n;
          o = f.aladin(p, {
            fov: y / h || 180,
            target: (E / h % 360 + 360) % 360 + " " + S / h,
            survey: i(a),
            ...le
          }), r("Aladin loaded on demand: " + n), s(), Ut();
        } catch (l) {
          r("Aladin load failed: " + l.message);
        }
      else n || (u.style.background = "#000", p.style.display = "none");
      R();
    }), t.on("change:background_cut_min", () => {
      s();
    }), t.on("change:background_cut_max", () => {
      s();
    }), te();
    let mt = 0;
    const ee = 30;
    setTimeout(ne, 50);
    let _t = 0, vt = 0, yt = 0, xt = 0, Ot = !1;
    g.style.cursor = "grab", g.addEventListener("mousedown", (n) => {
      if (yt = n.clientX, xt = n.clientY, Ot = !1, Ct === "boxzoom") {
        nt = !0;
        const l = u.getBoundingClientRect();
        Y = n.clientX - l.left, G = n.clientY - l.top, A.style.left = Y + "px", A.style.top = G + "px", A.style.width = "0", A.style.height = "0", A.style.display = "block";
      } else
        et = !0, _t = n.clientX, vt = n.clientY, g.style.cursor = "grabbing";
    }), window.addEventListener("mousemove", (n) => {
      if (et && !q) {
        if (Math.sqrt((n.clientX - yt) ** 2 + (n.clientY - xt) ** 2) < 3) return;
        et = !1, q = !0;
      }
      if (nt) {
        const v = u.getBoundingClientRect(), D = n.clientX - v.left, F = n.clientY - v.top, C = Math.min(Y, D), X = Math.min(G, F), L = Math.abs(D - Y), rt = Math.abs(F - G);
        A.style.left = C + "px", A.style.top = X + "px", A.style.width = L + "px", A.style.height = rt + "px", Ot = !0;
        return;
      }
      if (!q) {
        const v = g.getBoundingClientRect(), D = (n.clientX - v.left) / v.width * 2 - 1, F = -((n.clientY - v.top) / v.height * 2 - 1), C = j(), X = Tt(
          D,
          F,
          E,
          S,
          y,
          C,
          ft(),
          B
        );
        if (X) {
          const L = (X.ra / h % 360 + 360) % 360;
          U.textContent = ke(L) + "  " + Le(X.dec / h);
        } else
          U.textContent = "";
        return;
      }
      const l = j(), a = ft();
      if (!ye(_t, vt, n.clientX, n.clientY)) {
        const v = zt(_t, vt), D = zt(n.clientX, n.clientY), F = Ae(
          v.x,
          v.y,
          D.x,
          D.y,
          E,
          S,
          y,
          l,
          {
            invertHorizontalPan: t.get("invert_horizontal_pan") !== !1,
            scales: a,
            rotationRad: B
          }
        );
        F && (E = F.viewRA, S = F.viewDec);
      }
      o && O(), _t = n.clientX, vt = n.clientY, Ot = !0, requestAnimationFrame(R);
    }), window.addEventListener("mouseup", (n) => {
      if (nt) {
        if (nt = !1, A.style.display = "none", Math.sqrt((n.clientX - yt) ** 2 + (n.clientY - xt) ** 2) < 5) return;
        const a = u.getBoundingClientRect(), m = n.clientX - a.left, v = n.clientY - a.top, D = (Y + m) / 2 / a.width * 2 - 1, F = -((G + v) / 2 / a.height * 2 - 1), C = Ht(
          a.left + (Y + m) / 2,
          a.top + (G + v) / 2
        );
        if (!C) return;
        E = C.ra, S = C.dec;
        const X = Math.max(
          Math.abs(m - Y) / a.width,
          Math.abs(v - G) / a.height
        ), L = y * 0.5;
        y = 2 * Math.asin(Math.min(1, X * Math.sin(L))), y = It(y), lt(), Yt({ pushToAladin: !0 });
        return;
      }
      if (q || et)
        if (q = !1, et = !1, g.style.cursor = Ct === "pan" ? "grab" : "crosshair", Math.sqrt((n.clientX - yt) ** 2 + (n.clientY - xt) ** 2) < 3) {
          const a = xe(n.clientX, n.clientY);
          if (!a) return;
          const m = (a.ra / h % 360 + 360) % 360, v = a.dec / h;
          t.set("clicked_coord", [m, v]);
          try {
            let Wt = NaN, re = NaN;
            if (o != null && o.pix2world) {
              const ce = pt(n.clientX, n.clientY), it = o.pix2world(ce.x, ce.y);
              Array.isArray(it) && isFinite(it[0]) && isFinite(it[1]) && (Wt = (it[0] % 360 + 360) % 360, re = it[1]);
            }
            let ie = NaN, ae = NaN;
            const qt = Ht(n.clientX, n.clientY);
            qt && (ie = (qt.ra / h % 360 + 360) % 360, ae = qt.dec / h), t.set("clicked_coord_debug", [Wt, re, ie, ae]);
          } catch {
            t.set("clicked_coord_debug", [NaN, NaN, NaN, NaN]);
          }
          const D = a.ra - W[0], F = Math.sin(a.dec), C = Math.cos(a.dec), X = Math.sin(W[1]), L = Math.cos(W[1]), rt = C * Math.sin(D), wt = F * L - C * X * Math.cos(D);
          t.set("clicked_lm", [rt, wt]);
          const oe = t.get("click_tick");
          t.set("click_tick", (oe ?? 0) + 1), t.save_changes(), st = -999, Rt = -999, ot = a.ra, ct = a.dec, o && Ut(), requestAnimationFrame(R);
        } else
          lt(), Yt({ pushToAladin: !1 });
    }), g.addEventListener("wheel", (n) => {
      n.preventDefault(), y *= n.deltaY > 0 ? 1.1 : 1 / 1.1, y = It(y), lt(), o ? (o.setFoV(y / h), requestAnimationFrame(() => Yt({ pushToAladin: !1 }))) : requestAnimationFrame(R);
    }, { passive: !1 }), new ResizeObserver(() => {
      const n = u.getBoundingClientRect(), l = window.devicePixelRatio || 1;
      g.width = n.width * l, g.height = n.height * l, O(), R();
    }).observe(u);
  } catch (_) {
    r("ERROR: " + _.message), r(_.stack);
  }
}
function ke(t) {
  const c = t / 15, r = Math.floor(c), i = Math.floor((c - r) * 60), s = ((c - r) * 60 - i) * 60;
  return r + "h" + String(i).padStart(2, "0") + "m" + s.toFixed(1).padStart(4, "0") + "s";
}
function Le(t) {
  const c = t >= 0 ? "+" : "-", r = Math.abs(t), i = Math.floor(r), s = Math.floor((r - i) * 60), f = ((r - i) * 60 - s) * 60;
  return c + i + "°" + String(s).padStart(2, "0") + "'" + f.toFixed(1).padStart(4, "0") + '"';
}
export {
  Be as render
};
//# sourceMappingURL=widget.js.map
