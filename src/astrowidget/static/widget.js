<<<<<<< HEAD
const g = Math.PI / 180;
function fe(t, l) {
  let r, i;
  return l >= 1 ? (r = t, i = t / l) : (i = t, r = t * l), {
    fovWidth: r,
    fovHeight: i,
    scaleX: Math.sin(r * 0.5),
    scaleY: Math.sin(i * 0.5)
  };
}
function xe(t) {
  return Math.PI;
}
function we(t, l, r, i, c, o = 0) {
  if (!(t != null && t.pix2world) || l < 2 || r < 2) return null;
  if (i == null || c == null) {
    const [e, F] = t.getRaDec();
    i = e * g, c = F * g;
  }
  const f = l * 0.5, s = r * 0.5, d = Math.max(4, l * 0.02), h = Math.max(4, r * 0.02), v = Math.cos(o), w = Math.sin(o);
  function D(e, F) {
    const [H, N] = t.pix2world(e, F), { l: x, m: $ } = he(H * g, N * g, i, c);
    return o === 0 ? { l0: x, m0: $ } : { l0: x * v - $ * w, m0: x * w + $ * v };
  }
  const C = D(f + d, s), B = D(f - d, s), O = D(f, s - h), z = D(f, s + h), S = 4 * d / l, W = 4 * h / r, y = Math.abs(C.l0 - B.l0) / S, P = Math.abs(O.m0 - z.m0) / W;
  return !Number.isFinite(y) || !Number.isFinite(P) || y < 1e-15 || P < 1e-15 ? null : { scaleX: y, scaleY: P };
}
function de(t, l, r) {
  return (r == null ? void 0 : r.scaleX) > 0 && (r == null ? void 0 : r.scaleY) > 0 ? r : fe(t, l);
}
function Te(t, l, r, i, c = 0) {
  const o = -t * r, f = l * i;
  if (c === 0) return { l: o, m: f };
  const s = Math.cos(c), d = Math.sin(c);
  return {
    l: o * s + f * d,
    m: -o * d + f * s
  };
}
function Ee(t, l, r, i, c = 0) {
  let o = t, f = l;
  if (c !== 0) {
    const s = Math.cos(c), d = Math.sin(c);
    o = t * s - l * d, f = t * d + l * s;
  }
  return { x: -o / r, y: f / i };
}
function he(t, l, r, i) {
  const c = t - r, o = Math.sin(l), f = Math.cos(l), s = Math.sin(i), d = Math.cos(i), h = Math.cos(c), v = o * s + f * d * h, w = f * Math.sin(c), D = o * d - f * s * h;
  return { l: w, m: D, visible: v > 0 };
}
function De(t, l, r, i) {
  const c = Math.sqrt(t * t + l * l);
  if (c > 1) return null;
  const o = Math.sin(i), f = Math.cos(i);
  let s, d;
  if (c === 0)
    s = i, d = r;
  else {
    const h = Math.sqrt(1 - c * c);
    s = Math.asin(h * o + l * f / c * c);
    const v = c;
    s = Math.asin(h * o + l * f * v / c), d = r + Math.atan2(t * v, c * f * h - l * o * v);
  }
  return { ra: d, dec: s };
}
function wt(t, l, r, i, c, o, f = null, s = 0) {
  const { scaleX: d, scaleY: h } = de(c, o, f), { l: v, m: w } = Te(t, l, d, h, s);
  return Math.hypot(v, w) > 1 ? null : De(v, w, r, i);
}
function Ae(t, l, r, i, c, o, f = null, s = 0) {
  const { l: d, m: h, visible: v } = he(t, l, r, i);
  if (!v) return null;
  const { scaleX: w, scaleY: D } = de(c, o, f);
  if (w < 1e-15 || D < 1e-15) return { x: 0, y: 0 };
  const { x: C, y: B } = Ee(d, h, w, D, s);
  return Math.hypot(d, h) > 1 + 1e-12 ? null : { x: C, y: B };
}
function Se(t, l, r, i, c, o, f, s, d = {}) {
  const h = d.scales ?? null, v = d.rotationRad ?? 0, w = wt(t, l, c, o, f, s, h, v), D = wt(r, i, c, o, f, s, h, v);
  if (!w || !D) return null;
  let C = w.ra - D.ra;
  C > Math.PI && (C -= 2 * Math.PI), C < -Math.PI && (C += 2 * Math.PI);
  const B = d.invertHorizontalPan === !1 ? 1 : -1, O = -Math.PI / 2 + 1e-3, z = Math.PI / 2 - 1e-3;
  return {
    viewRA: c + B * C,
    viewDec: Math.max(O, Math.min(z, o + w.dec - D.dec))
  };
}
function be(t, l, r, i, c) {
  if (r != null && r.pix2world) {
    const { x: o, y: f } = i(t, l), s = r.pix2world(o, f);
    if (!s || s.length < 2) return null;
    const d = s[0], h = s[1];
    return !Number.isFinite(d) || !Number.isFinite(h) ? null : { ra: d * g, dec: h * g };
  }
  return c(t, l);
}
function Re() {
=======
const h = Math.PI / 180;
function Yt(t, c) {
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
    const a = (c + o) * 0.5, { scaleX: r, scaleY: f } = Yt(a, t);
    Math.hypot(r, f) <= 1 + 1e-9 ? c = a : o = a;
  }
  return c;
}
function _e(t, c, o, i, a, r = 0) {
  if (!(t != null && t.pix2world) || c < 2 || o < 2) return null;
  if (i == null || a == null) {
    const [e, X] = t.getRaDec();
    i = e * h, a = X * h;
  }
  const f = c * 0.5, s = o * 0.5, d = Math.max(4, c * 0.02), g = Math.max(4, o * 0.02), v = Math.cos(r), E = Math.sin(r);
  function D(e, X) {
    const [q, I] = t.pix2world(e, X), { l: y, m: Q } = se(q * h, I * h, i, a);
    return r === 0 ? { l0: y, m0: Q } : { l0: y * v - Q * E, m0: y * E + Q * v };
  }
  const C = D(f + d, s), V = D(f - d, s), z = D(f, s - g), H = D(f, s + g), b = 4 * d / c, W = 4 * g / o, x = Math.abs(C.l0 - V.l0) / b, P = Math.abs(z.m0 - H.m0) / W;
  return !Number.isFinite(x) || !Number.isFinite(P) || x < 1e-15 || P < 1e-15 ? null : { scaleX: x, scaleY: P };
}
function ce(t, c, o) {
  return (o == null ? void 0 : o.scaleX) > 0 && (o == null ? void 0 : o.scaleY) > 0 ? o : Yt(t, c);
}
function ve(t, c, o, i, a = 0) {
  const r = -t * o, f = c * i;
  if (a === 0) return { l: r, m: f };
  const s = Math.cos(a), d = Math.sin(a);
  return {
    l: r * s + f * d,
    m: -r * d + f * s
  };
}
function xe(t, c, o, i, a = 0) {
  let r = t, f = c;
  if (a !== 0) {
    const s = Math.cos(a), d = Math.sin(a);
    r = t * s - c * d, f = t * d + c * s;
  }
  return { x: -r / o, y: f / i };
}
function se(t, c, o, i) {
  const a = t - o, r = Math.sin(c), f = Math.cos(c), s = Math.sin(i), d = Math.cos(i), g = Math.cos(a), v = r * s + f * d * g, E = f * Math.sin(a), D = r * d - f * s * g;
  return { l: E, m: D, visible: v > 0 };
}
function ye(t, c, o, i) {
  const a = Math.sqrt(t * t + c * c);
  if (a > 1) return null;
  const r = Math.sin(i), f = Math.cos(i);
  let s, d;
  if (a === 0)
    s = i, d = o;
  else {
    const g = Math.sqrt(1 - a * a);
    s = Math.asin(g * r + c * f / a * a);
    const v = a;
    s = Math.asin(g * r + c * f * v / a), d = o + Math.atan2(t * v, a * f * g - c * r * v);
  }
  return { ra: d, dec: s };
}
function vt(t, c, o, i, a, r, f = null, s = 0) {
  const { scaleX: d, scaleY: g } = ce(a, r, f), { l: v, m: E } = ve(t, c, d, g, s);
  return Math.hypot(v, E) > 1 ? null : ye(v, E, o, i);
}
function we(t, c, o, i, a, r, f = null, s = 0) {
  const { l: d, m: g, visible: v } = se(t, c, o, i);
  if (!v) return null;
  const { scaleX: E, scaleY: D } = ce(a, r, f);
  if (E < 1e-15 || D < 1e-15) return { x: 0, y: 0 };
  const { x: C, y: V } = xe(d, g, E, D, s);
  return Math.hypot(d, g) > 1 + 1e-12 ? null : { x: C, y: V };
}
function Te(t, c, o, i, a, r, f, s, d = {}) {
  const g = d.scales ?? null, v = d.rotationRad ?? 0, E = vt(t, c, a, r, f, s, g, v), D = vt(o, i, a, r, f, s, g, v);
  if (!E || !D) return null;
  let C = E.ra - D.ra;
  C > Math.PI && (C -= 2 * Math.PI), C < -Math.PI && (C += 2 * Math.PI);
  const V = d.invertHorizontalPan === !1 ? 1 : -1, z = -Math.PI / 2 + 1e-3, H = Math.PI / 2 - 1e-3;
  return {
    viewRA: a + V * C,
    viewDec: Math.max(z, Math.min(H, r + E.dec - D.dec))
  };
}
function Ee(t, c, o, i, a) {
  if (o != null && o.pix2world) {
    const { x: r, y: f } = i(t, c), s = o.pix2world(r, f);
    if (!s || s.length < 2) return null;
    const d = s[0], g = s[1];
    return !Number.isFinite(d) || !Number.isFinite(g) ? null : { ra: d * h, dec: g * h };
  }
  return a(t, c);
}
function De() {
>>>>>>> origin/main
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
<<<<<<< HEAD
  ], l = new Uint8Array(256 * 4);
  for (let r = 0; r < 256; r++) {
    let i = 0;
    for (let s = 0; s < t.length - 1; s++) r >= t[s][0] && (i = s);
    const c = Math.min(i + 1, t.length - 1), o = t[c][0] - t[i][0] || 1, f = (r - t[i][0]) / o;
    l[r * 4] = t[i][1] + f * (t[c][1] - t[i][1]) | 0, l[r * 4 + 1] = t[i][2] + f * (t[c][2] - t[i][2]) | 0, l[r * 4 + 2] = t[i][3] + f * (t[c][3] - t[i][3]) | 0, l[r * 4 + 3] = 255;
  }
  return l;
}
const Ce = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0, 1); }
`, Me = `#version 300 es
=======
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
`, be = `#version 300 es
>>>>>>> origin/main
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
<<<<<<< HEAD
function se(t, l, r) {
  const i = t.createShader(l);
  if (t.shaderSource(i, r), t.compileShader(i), !t.getShaderParameter(i, t.COMPILE_STATUS)) {
    const c = t.getShaderInfoLog(i);
    throw t.deleteShader(i), new Error("Shader: " + c);
  }
  return i;
}
function Pe(t) {
  const l = se(t, t.VERTEX_SHADER, Ce), r = se(t, t.FRAGMENT_SHADER, Me), i = t.createProgram();
  if (t.attachShader(i, l), t.attachShader(i, r), t.linkProgram(i), !t.getProgramParameter(i, t.LINK_STATUS))
    throw new Error("Link: " + t.getProgramInfoLog(i));
  return i;
}
function Fe(t, l, r) {
  const i = t.length, c = new Uint8Array(i * 4), o = r - l || 1e-30;
  for (let f = 0; f < i; f++) {
    const s = t[f];
    if (s !== s || !isFinite(s)) {
      c[f * 4 + 3] = 0;
      continue;
    }
    let d = (s - l) / o;
    d = d < 0 ? 0 : d > 1 ? 1 : d, c[f * 4] = d * 255 + 0.5 | 0, c[f * 4 + 3] = 255;
  }
  return c;
}
const jt = {
=======
function re(t, c, o) {
  const i = t.createShader(c);
  if (t.shaderSource(i, o), t.compileShader(i), !t.getShaderParameter(i, t.COMPILE_STATUS)) {
    const a = t.getShaderInfoLog(i);
    throw t.deleteShader(i), new Error("Shader: " + a);
  }
  return i;
}
function Se(t) {
  const c = re(t, t.VERTEX_SHADER, Re), o = re(t, t.FRAGMENT_SHADER, be), i = t.createProgram();
  if (t.attachShader(i, c), t.attachShader(i, o), t.linkProgram(i), !t.getProgramParameter(i, t.LINK_STATUS))
    throw new Error("Link: " + t.getProgramInfoLog(i));
  return i;
}
function Ae(t, c, o) {
  const i = t.length, a = new Uint8Array(i * 4), r = o - c || 1e-30;
  for (let f = 0; f < i; f++) {
    const s = t[f];
    if (s !== s || !isFinite(s)) {
      a[f * 4 + 3] = 0;
      continue;
    }
    let d = (s - c) / r;
    d = d < 0 ? 0 : d > 1 ? 1 : d, a[f * 4] = d * 255 + 0.5 | 0, a[f * 4 + 3] = 255;
  }
  return a;
}
const Vt = {
>>>>>>> origin/main
  DSS: "CDS/P/DSS2/color",
  "2MASS": "CDS/P/2MASS/color",
  WISE: "CDS/P/allWISE/color",
  Planck: "CDS/P/PLANCK/R2/HFI/color",
  SDSS: "CDS/P/SDSS9/color",
  Mellinger: "CDS/P/Mellinger/color",
  Fermi: "CDS/P/Fermi/color",
  Haslam408: "CDS/P/HI4PI/NHI"
<<<<<<< HEAD
}, le = {
=======
}, ie = {
>>>>>>> origin/main
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
<<<<<<< HEAD
}, Ne = [
=======
}, Ce = [
>>>>>>> origin/main
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
<<<<<<< HEAD
function Xe(t) {
  const l = "astrowidget-aladin-control-layer";
  if (t.querySelector(`#${l}`)) return;
  const r = document.createElement("style");
  r.id = l, r.textContent = `
    .astrowidget-aladin-bg ${Ne} {
      z-index: 0 !important;
      pointer-events: none !important;
    }
  `, t.appendChild(r);
}
function ue(t, l) {
  t.classList.add("astrowidget-aladin-bg"), Xe(l);
}
async function Ue({ model: t, el: l }) {
  function r(y) {
    console.log("[astrowidget]", y);
  }
  function i() {
    const y = t.get("background_cut_min"), P = t.get("background_cut_max");
    if (!o || !Number.isFinite(y) || !Number.isFinite(P)) return;
    let e = 0;
    function F() {
      var H;
      e += 1;
      try {
        const N = (H = o.getBaseImageLayer) == null ? void 0 : H.call(o);
        if (N != null && N.setCuts) {
          N.setCuts(y, P), r("Background cuts: " + y + " .. " + P);
          return;
        }
      } catch (N) {
        r("Background setCuts pending: " + N.message);
      }
      e < 25 && setTimeout(F, Math.min(100 * e, 1e3));
=======
function Me(t) {
  const c = "astrowidget-aladin-control-layer";
  if (t.querySelector(`#${c}`)) return;
  const o = document.createElement("style");
  o.id = c, o.textContent = `
    .astrowidget-aladin-bg ${Ce} {
      z-index: 0 !important;
      pointer-events: none !important;
    }
  `, t.appendChild(o);
}
function ae(t, c) {
  t.classList.add("astrowidget-aladin-bg"), Me(c);
}
async function Ie({ model: t, el: c }) {
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
>>>>>>> origin/main
    }
    F();
  }
<<<<<<< HEAD
  let c = null, o = null;
  const f = t.get("background_survey");
  if (f)
    try {
      c = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await c.init, r("Aladin Lite loaded");
    } catch (y) {
      r("Aladin Lite load failed: " + y.message);
    }
  const s = document.createElement("div");
  s.style.cssText = "position:relative;width:100%;height:600px;background:" + (f && c ? "transparent" : "#000"), l.appendChild(s);
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:0", f && c && (ue(d, s), s.appendChild(d));
  const h = document.createElement("canvas");
  h.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:1", s.appendChild(h);
  const v = document.createElement("div");
  v.style.cssText = "position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:4px", s.appendChild(v);
  const w = "padding:4px 10px;font:12px sans-serif;border:1px solid #888;border-radius:3px;cursor:pointer;color:#fff;background:rgba(0,0,0,0.6)", D = w + ";background:rgba(70,130,255,0.8);border-color:#7af";
  function C(y, P) {
    const e = document.createElement("button");
    return e.textContent = y, e.title = P, e.style.cssText = w, v.appendChild(e), e;
  }
  const B = C("↺", "Reset view to initial position"), O = C("✥", "Pan mode (drag to rotate)"), z = C("⬚", "Box zoom (drag to select region)"), S = document.createElement("div");
  S.style.cssText = "position:absolute;border:2px dashed #7af;background:rgba(70,130,255,0.15);pointer-events:none;z-index:2;display:none", s.appendChild(S);
  const W = document.createElement("div");
  W.style.cssText = "position:absolute;bottom:8px;left:8px;color:#fff;font:13px monospace;text-shadow:0 0 4px #000;pointer-events:none;z-index:2", s.appendChild(W);
  try {
    let pe = function() {
      St && clearTimeout(St), At = !0, St = setTimeout(() => {
        At = !1;
      }, 500);
    }, lt = function() {
      pe(), t.set("view_ra", T / g), t.set("view_dec", E / g), t.set("view_fov", _ / g), t.save_changes();
    }, Ft = function() {
      return !At && !j && !nt;
    }, Nt = function(n) {
      Rt = n, O.style.cssText = n === "pan" ? D : w, z.style.cssText = n === "boxzoom" ? D : w, h.style.cursor = n === "pan" ? "grab" : "crosshair";
    }, Xt = function() {
      if (!tt) return;
      const n = Fe(tt, Kt, Zt);
      e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Tt), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, J, Q, 0, e.RGBA, e.UNSIGNED_BYTE, n);
    }, K = function() {
      const n = o == null ? void 0 : o.view, u = (n == null ? void 0 : n.width) ?? h.clientWidth, a = (n == null ? void 0 : n.height) ?? h.clientHeight;
      return u / Math.max(a, 1);
    }, ut = function() {
      return I || fe(_, K());
    }, It = function(n) {
      const u = 1e-3 * g, a = xe(K());
      return Math.max(u, Math.min(a, n));
    }, Lt = function() {
      if (!(o != null && o.getRaDec)) return;
      const [n, u] = o.getRaDec();
      if (T = n * g, E = u * g, typeof o.getFov == "function") {
        const a = o.getFov(), p = Array.isArray(a) ? a[0] : a, m = Array.isArray(a) ? a[1] : p;
        _ = Math.max(p, m) * g;
      }
      ft();
    }, ft = function() {
      if (!(o != null && o.getRotation)) {
        k = 0;
        return;
      }
      k = -o.getRotation() * g;
    }, G = function() {
      if (!o) {
        I = null;
        return;
      }
      const n = o.view, u = (n == null ? void 0 : n.width) ?? d.clientWidth, a = (n == null ? void 0 : n.height) ?? d.clientHeight;
      I = we(
        o,
        u,
        a,
        T,
        E,
        k
      ) ?? null;
    }, kt = function() {
      o && (Lt(), I = null, G());
    }, b = function() {
      o && (ft(), G()), e.viewport(0, 0, h.width, h.height), e.clearColor(0, 0, 0, 0), e.clear(e.COLOR_BUFFER_BIT), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE_MINUS_SRC_ALPHA), e.useProgram(F), e.uniform1i(x.u_image, 0), e.uniform1i(x.u_cmap, 1), e.uniform2f(x.u_crval, q[0], q[1]), e.uniform2f(x.u_cdelt, Et[0], Et[1]), e.uniform2f(x.u_crpix, Dt[0], Dt[1]), e.uniform2f(x.u_imageSize, J, Q), e.uniform2f(x.u_viewCenter, T, E);
      const n = ut();
      e.uniform2f(x.u_viewScale, n.scaleX, n.scaleY), ft(), e.uniform1f(x.u_viewRotation, k), e.uniform1f(x.u_fov, _), e.uniform1f(x.u_opacity, $t), e.uniform1i(x.u_stretch, Jt), e.uniform1i(x.u_showGrid, Qt);
      let u = -999, a = -999;
      if (st > -900)
        u = st, a = bt;
      else if (ot > -900) {
        const p = Ae(
          ot,
          ct,
          T,
          E,
          _,
          K(),
          n,
          k
        );
        p && (u = p.x, a = p.y);
      }
      e.uniform2f(x.u_crosshairScreen, u, a), e.uniform2f(x.u_resolution, h.width, h.height), e.drawArrays(e.TRIANGLES, 0, 6);
    }, me = function() {
      tt = null, J = 1, Q = 1, e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Tt), e.texImage2D(
=======
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
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:0", f && a && (ae(d, s), s.appendChild(d));
  const g = document.createElement("canvas");
  g.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:1", s.appendChild(g);
  const v = document.createElement("div");
  v.style.cssText = "position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:4px", s.appendChild(v);
  const E = "padding:4px 10px;font:12px sans-serif;border:1px solid #888;border-radius:3px;cursor:pointer;color:#fff;background:rgba(0,0,0,0.6)", D = E + ";background:rgba(70,130,255,0.8);border-color:#7af";
  function C(x, P) {
    const e = document.createElement("button");
    return e.textContent = x, e.title = P, e.style.cssText = E, v.appendChild(e), e;
  }
  const V = C("↺", "Reset view to initial position"), z = C("✥", "Pan mode (drag to rotate)"), H = C("⬚", "Box zoom (drag to select region)"), b = document.createElement("div");
  b.style.cssText = "position:absolute;border:2px dashed #7af;background:rgba(70,130,255,0.15);pointer-events:none;z-index:2;display:none", s.appendChild(b);
  const W = document.createElement("div");
  W.style.cssText = "position:absolute;bottom:8px;left:8px;color:#fff;font:13px monospace;text-shadow:0 0 4px #000;pointer-events:none;z-index:2", s.appendChild(W);
  try {
    let At = function(n) {
      Dt = n, z.style.cssText = n === "pan" ? D : E, H.style.cssText = n === "boxzoom" ? D : E, g.style.cursor = n === "pan" ? "grab" : "crosshair";
    }, Ct = function() {
      if (!nt) return;
      const n = Ae(nt, Gt, Ot);
      e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, xt), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, tt, et, 0, e.RGBA, e.UNSIGNED_BYTE, n);
    }, $ = function() {
      const n = r == null ? void 0 : r.view, u = (n == null ? void 0 : n.width) ?? g.clientWidth, l = (n == null ? void 0 : n.height) ?? g.clientHeight;
      return u / Math.max(l, 1);
    }, ct = function() {
      return K || Yt(m, $());
    }, Mt = function(n) {
      const u = 1e-3 * h, l = r ? me($()) : Math.PI;
      return Math.max(u, Math.min(l, n));
    }, ue = function() {
      if (!(r != null && r.getRaDec)) return;
      const [n, u] = r.getRaDec();
      if (w = n * h, T = u * h, typeof r.getFov == "function") {
        const l = r.getFov(), p = Array.isArray(l) ? l[0] : l, _ = Array.isArray(l) ? l[1] : p;
        m = Math.max(p, _) * h;
      }
      st();
    }, st = function() {
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
      const n = r.view, u = (n == null ? void 0 : n.width) ?? d.clientWidth, l = (n == null ? void 0 : n.height) ?? d.clientHeight;
      K = _e(
        r,
        u,
        l,
        w,
        T,
        U
      ) ?? null;
    }, S = function() {
      r && (st(), O()), e.viewport(0, 0, g.width, g.height), e.clearColor(0, 0, 0, 0), e.clear(e.COLOR_BUFFER_BIT), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE_MINUS_SRC_ALPHA), e.useProgram(X), e.uniform1i(y.u_image, 0), e.uniform1i(y.u_cmap, 1), e.uniform2f(y.u_crval, j[0], j[1]), e.uniform2f(y.u_cdelt, yt[0], yt[1]), e.uniform2f(y.u_crpix, wt[0], wt[1]), e.uniform2f(y.u_imageSize, tt, et), e.uniform2f(y.u_viewCenter, w, T);
      const n = ct();
      e.uniform2f(y.u_viewScale, n.scaleX, n.scaleY), st(), e.uniform1f(y.u_viewRotation, U), e.uniform1f(y.u_fov, m), e.uniform1f(y.u_opacity, zt), e.uniform1i(y.u_stretch, Ht), e.uniform1i(y.u_showGrid, Wt);
      let u = -999, l = -999;
      if (Et > -900)
        u = Et, l = jt;
      else if (Tt > -900) {
        const p = we(
          Tt,
          qt,
          w,
          T,
          m,
          $(),
          n,
          U
        );
        p && (u = p.x, l = p.y);
      }
      e.uniform2f(y.u_crosshairScreen, u, l), e.uniform2f(y.u_resolution, g.width, g.height), e.drawArrays(e.TRIANGLES, 0, 6);
    }, fe = function() {
      nt = null, tt = 1, et = 1, e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, xt), e.texImage2D(
>>>>>>> origin/main
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
<<<<<<< HEAD
    }, dt = function() {
      const n = t.get("image_data"), u = t.get("image_shape"), a = n ? n.byteLength || n.length : 0;
      if (!n || !u || u[0] === 0 || a === 0) {
        me();
        return;
      }
      Q = u[0], J = u[1], tt = new Float32Array(n.buffer.slice(n.byteOffset, n.byteOffset + a)), r("Image: " + J + "x" + Q + ", " + tt.length + " floats"), Xt();
    }, Z = function() {
      const n = t.get("crval"), u = t.get("cdelt"), a = t.get("crpix");
      n && (q = [n[0] * g, n[1] * g]), u && (Et = [u[0] * g, u[1] * g]), a && (Dt = [a[0], a[1]]);
    }, Ut = function() {
      T = (t.get("view_ra") || 0) * g, E = (t.get("view_dec") || 0) * g, _ = (t.get("view_fov") || 180) * g;
    }, _e = function() {
      Ft() && Ut();
    }, U = function() {
      Kt = t.get("vmin") || 0, Zt = t.get("vmax") || 1, $t = t.get("opacity") ?? 1, Jt = ge[t.get("stretch")] || 0, Qt = t.get("show_grid") === !1 ? 0 : 1;
    }, ht = function() {
      Bt || (Bt = !0, requestAnimationFrame(() => {
        Bt = !1, b();
      }));
    }, Vt = function() {
      const n = t.get("crosshair_ra"), u = t.get("crosshair_dec");
      typeof n != "number" || typeof u != "number" || n < -900 || u < -900 ? (ot = -999, ct = -999) : (ot = n * g, ct = u * g, st = -999, bt = -999);
    }, te = function() {
      U(), dt(), Z(), _e(), Vt(), b();
    }, Yt = function({ pushToAladin: n = !1 } = {}) {
      if (o && (n ? rt() : (Lt(), I = null, G())), b(), t.get("overlay_view_lock")) {
        const u = t.get("view_gesture_revision") || 0;
        t.set("view_gesture_revision", u + 1), t.save_changes();
      }
    }, Gt = function() {
      Ft() && (Ut(), I = null, rt(), ht());
    }, rt = function(n = !0) {
      if (!o) return;
      _ = It(_);
      const u = _ / g;
      if (n) {
        const a = (T / g % 360 + 360) % 360, p = E / g;
        o.gotoRaDec(a, p);
      }
      o.setFoV(u), Lt(), I = null, G();
    }, gt = function(n, u) {
      const a = d.getBoundingClientRect(), p = o.view, m = (p == null ? void 0 : p.width) ?? a.width, A = (p == null ? void 0 : p.height) ?? a.height;
      return {
        x: (n - a.left) * (m / a.width),
        y: (u - a.top) * (A / a.height)
      };
    }, ve = function(n, u, a, p) {
      var xt;
      const m = (xt = o == null ? void 0 : o.view) == null ? void 0 : xt.wasm;
      if (!(m != null && m.goFromTo)) return !1;
      let { x: A, y: M } = gt(n, u), { x: R, y: X } = gt(a, p);
      t.get("invert_horizontal_pan") === !1 && ([A, R] = [R, A]), m.goFromTo(A, M, R, X), o.view.updateCenter();
      const [L, it] = o.getRaDec();
      return T = L * g, E = it * g, ft(), !0;
    }, ne = function() {
      pt++, te();
      const n = t.get("image_data");
      if (n && (n.byteLength || n.length) > 0) {
        r("Data arrived after " + pt + " poll(s)"), requestAnimationFrame(b), Ct = T, Mt = E, Pt = _;
        return;
      }
      pt < ee ? setTimeout(ne, Math.min(100 * Math.pow(1.5, pt - 1), 1e3)) : (r("No image data after " + ee + " polls — waiting for change event"), rt(), Ct = T, Mt = E, Pt = _);
    }, zt = function(n, u) {
      const a = h.getBoundingClientRect();
      return {
        x: (n - a.left) / a.width * 2 - 1,
        y: -((u - a.top) / a.height * 2 - 1)
      };
    }, Wt = function(n, u) {
      const { x: a, y: p } = zt(n, u);
      return wt(
        a,
        p,
        T,
        E,
        _,
        K(),
        ut(),
        k
      );
    }, ye = function(n, u) {
      return be(
        n,
        u,
        o,
        gt,
        Wt
      );
    };
    const y = s.getBoundingClientRect(), P = window.devicePixelRatio || 1;
    h.width = (y.width || 800) * P, h.height = (y.height || 600) * P;
    const e = h.getContext("webgl2", { alpha: !0, premultipliedAlpha: !0, preserveDrawingBuffer: !0 });
    if (!e) {
      r("FAIL: No WebGL2");
      return;
    }
    r("WebGL2: " + e.getParameter(e.RENDERER));
    const F = Pe(e);
    r("Shader compiled OK"), e.useProgram(F);
    const H = e.createBuffer();
    e.bindBuffer(e.ARRAY_BUFFER, H), e.bufferData(e.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), e.STATIC_DRAW);
    const N = e.getAttribLocation(F, "a_pos");
    e.enableVertexAttribArray(N), e.vertexAttribPointer(N, 2, e.FLOAT, !1, 0, 0);
    const x = {};
=======
    }, lt = function() {
      const n = t.get("image_data"), u = t.get("image_shape"), l = n ? n.byteLength || n.length : 0;
      if (!n || !u || u[0] === 0 || l === 0) {
        fe();
        return;
      }
      et = u[0], tt = u[1], nt = new Float32Array(n.buffer.slice(n.byteOffset, n.byteOffset + l)), o("Image: " + tt + "x" + et + ", " + nt.length + " floats"), Ct();
    }, J = function() {
      const n = t.get("crval"), u = t.get("cdelt"), l = t.get("crpix");
      n && (j = [n[0] * h, n[1] * h]), u && (yt = [u[0] * h, u[1] * h]), l && (wt = [l[0], l[1]]);
    }, Pt = function() {
      w = (t.get("view_ra") || 0) * h, T = (t.get("view_dec") || 0) * h, m = (t.get("view_fov") || 180) * h;
    }, de = function() {
      L || Pt();
    }, B = function() {
      Gt = t.get("vmin") || 0, Ot = t.get("vmax") || 1, zt = t.get("opacity") ?? 1, Ht = le[t.get("stretch")] || 0, Wt = t.get("show_grid") === !1 ? 0 : 1;
    }, Kt = function() {
      Ft || (Ft = !0, requestAnimationFrame(() => {
        Ft = !1, S();
      }));
    }, Zt = function() {
      B(), lt(), J(), de(), S();
    }, Xt = function() {
      if (r && ue(), ut(), S(), t.get("overlay_view_lock")) {
        const n = t.get("view_gesture_revision") || 0;
        t.set("view_gesture_revision", n + 1), t.save_changes();
      }
    }, It = function() {
      L || (Pt(), K = null, ut(), Kt());
    }, ut = function(n = !0) {
      if (!r) return;
      m = Mt(m);
      const u = m / h;
      if (n) {
        const l = (w / h % 360 + 360) % 360, p = T / h;
        r.gotoRaDec(l, p);
      }
      r.setFoV(u), O();
    }, ft = function(n, u) {
      const l = d.getBoundingClientRect(), p = r.view, _ = (p == null ? void 0 : p.width) ?? l.width, R = (p == null ? void 0 : p.height) ?? l.height;
      return {
        x: (n - l.left) * (_ / l.width),
        y: (u - l.top) * (R / l.height)
      };
    }, he = function(n, u, l, p) {
      var _t;
      const _ = (_t = r == null ? void 0 : r.view) == null ? void 0 : _t.wasm;
      if (!(_ != null && _.goFromTo)) return !1;
      let { x: R, y: A } = ft(n, u), { x: M, y: F } = ft(l, p);
      t.get("invert_horizontal_pan") === !1 && ([R, M] = [M, R]), _.goFromTo(R, A, M, F), r.view.updateCenter();
      const [k, rt] = r.getRaDec();
      return w = k * h, T = rt * h, st(), !0;
    }, Jt = function() {
      dt++, Zt();
      const n = t.get("image_data");
      if (n && (n.byteLength || n.length) > 0) {
        o("Data arrived after " + dt + " poll(s)"), requestAnimationFrame(S), Rt = w, bt = T, St = m;
        return;
      }
      dt < $t ? setTimeout(Jt, Math.min(100 * Math.pow(1.5, dt - 1), 1e3)) : (o("No image data after " + $t + " polls — waiting for change event"), ut(), Rt = w, bt = T, St = m);
    }, Lt = function(n, u) {
      const l = g.getBoundingClientRect();
      return {
        x: (n - l.left) / l.width * 2 - 1,
        y: -((u - l.top) / l.height * 2 - 1)
      };
    }, kt = function(n, u) {
      const { x: l, y: p } = Lt(n, u);
      return vt(
        l,
        p,
        w,
        T,
        m,
        $(),
        ct(),
        U
      );
    }, ge = function(n, u) {
      return Ee(
        n,
        u,
        r,
        ft,
        kt
      );
    };
    const x = s.getBoundingClientRect(), P = window.devicePixelRatio || 1;
    g.width = (x.width || 800) * P, g.height = (x.height || 600) * P;
    const e = g.getContext("webgl2", { alpha: !0, premultipliedAlpha: !0, preserveDrawingBuffer: !0 });
    if (!e) {
      o("FAIL: No WebGL2");
      return;
    }
    o("WebGL2: " + e.getParameter(e.RENDERER));
    const X = Se(e);
    o("Shader compiled OK"), e.useProgram(X);
    const q = e.createBuffer();
    e.bindBuffer(e.ARRAY_BUFFER, q), e.bufferData(e.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), e.STATIC_DRAW);
    const I = e.getAttribLocation(X, "a_pos");
    e.enableVertexAttribArray(I), e.vertexAttribPointer(I, 2, e.FLOAT, !1, 0, 0);
    const y = {};
>>>>>>> origin/main
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
<<<<<<< HEAD
      (n) => x[n] = e.getUniformLocation(F, n)
    );
    const $ = e.createTexture();
    e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, $), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 256, 1, 0, e.RGBA, e.UNSIGNED_BYTE, Re()), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), r("Colormap texture OK");
    const Tt = e.createTexture();
    e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Tt), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 1, 1, 0, e.RGBA, e.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE);
    let J = 1, Q = 1, tt = null, q = [0, 0], Et = [1, 1], Dt = [0, 0], T = 0, E = 0, _ = Math.PI, I = null, k = 0, Kt = 0, Zt = 1, $t = 1, Jt = 0, Qt = 1, j = !1, et = !1, nt = !1, At = !1, St = null, ot = -999, ct = -999, st = -999, bt = -999;
    const ge = { linear: 0, log: 1, sqrt: 2, asinh: 3 };
    let Rt = "pan", Ct = 0, Mt = 0, Pt = Math.PI, V = 0, Y = 0;
    Nt("pan"), O.addEventListener("click", () => Nt("pan")), z.addEventListener("click", () => Nt("boxzoom")), B.addEventListener("click", () => {
      T = Ct, E = Mt, _ = Pt, lt(), rt(), b();
    });
    let Bt = !1;
    if (t.on("change:image_data", () => {
      U(), dt(), Z();
    }), t.on("change:image_shape", () => {
      dt();
    }), t.on("change:crval", () => {
      Z();
    }), t.on("change:cdelt", () => {
      Z();
    }), t.on("change:crpix", () => {
      Z();
    }), t.on("change:vmin", () => {
      U(), Xt();
    }), t.on("change:vmax", () => {
      U(), Xt();
    }), t.on("change:image_revision", () => {
      U(), dt(), Z(), t.get("overlay_view_lock") || (Ft() ? (Ut(), o && rt()) : (I = null, o && G())), ht();
    }), t.on("change:crosshair_ra", () => {
      Vt(), ht();
    }), t.on("change:crosshair_dec", () => {
      Vt(), ht();
    }), t.on("change:view_ra", Gt), t.on("change:view_dec", Gt), t.on("change:view_fov", Gt), t.on("change:opacity", () => {
      U(), b();
    }), t.on("change:stretch", () => {
      U(), b();
    }), t.on("change:show_grid", () => {
      U(), b();
    }), t.on("change:background_survey", () => {
      const n = t.get("background_survey");
      s.style.background = n ? "transparent" : "#000", b();
    }), c && f) {
      const n = jt[f] || f, u = (T / g % 360 + 360) % 360, a = E / g, p = _ / g;
      o = c.aladin(d, {
        fov: p || 180,
        target: u + " " + a,
        survey: n,
        ...le
      }), r("Aladin viewer created: " + f), i(), kt();
    }
    t.on("change:background_survey", async () => {
      const n = t.get("background_survey");
      if (n && o) {
        const u = jt[n] || n;
        o.setBaseImageLayer(u), s.style.background = "transparent", i();
      } else if (n && !o && !c)
        try {
          c = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await c.init, ue(d, s), s.appendChild(d), s.style.background = "transparent";
          const a = jt[n] || n;
          o = c.aladin(d, {
            fov: _ / g || 180,
            target: (T / g % 360 + 360) % 360 + " " + E / g,
            survey: a,
            ...le
          }), r("Aladin loaded on demand: " + n), i(), kt();
        } catch (u) {
          r("Aladin load failed: " + u.message);
        }
      else n || (s.style.background = "#000", d.style.display = "none");
      b();
=======
      (n) => y[n] = e.getUniformLocation(X, n)
    );
    const Q = e.createTexture();
    e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, Q), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 256, 1, 0, e.RGBA, e.UNSIGNED_BYTE, De()), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), o("Colormap texture OK");
    const xt = e.createTexture();
    e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, xt), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 1, 1, 0, e.RGBA, e.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE);
    let tt = 1, et = 1, nt = null, j = [0, 0], yt = [1, 1], wt = [0, 0], w = 0, T = 0, m = Math.PI, K = null, U = 0, Gt = 0, Ot = 1, zt = 1, Ht = 0, Wt = 1, Z = !1, ot = !1, L = !1, N = null, Tt = -999, qt = -999, Et = -999, jt = -999;
    const le = { linear: 0, log: 1, sqrt: 2, asinh: 3 };
    let Dt = "pan", Rt = 0, bt = 0, St = Math.PI, Y = 0, G = 0, at = !1;
    At("pan"), z.addEventListener("click", () => At("pan")), H.addEventListener("click", () => At("boxzoom")), V.addEventListener("click", () => {
      L = !0, w = Rt, T = bt, m = St, t.set("view_ra", w / h), t.set("view_dec", T / h), t.set("view_fov", m / h), t.save_changes(), ut(), S(), N && clearTimeout(N), N = setTimeout(() => {
        L = !1;
      }, 500);
    });
    let Ft = !1;
    if (t.on("change:image_data", () => {
      B(), lt(), J();
    }), t.on("change:image_shape", () => {
      lt();
    }), t.on("change:crval", () => {
      J();
    }), t.on("change:cdelt", () => {
      J();
    }), t.on("change:crpix", () => {
      J();
    }), t.on("change:vmin", () => {
      B(), Ct();
    }), t.on("change:vmax", () => {
      B(), Ct();
    }), t.on("change:image_revision", () => {
      B(), lt(), J(), t.get("overlay_view_lock") || Pt(), K = null, r && O(), Kt();
    }), t.on("change:view_ra", It), t.on("change:view_dec", It), t.on("change:view_fov", It), t.on("change:opacity", () => {
      B(), S();
    }), t.on("change:stretch", () => {
      B(), S();
    }), t.on("change:show_grid", () => {
      B(), S();
    }), t.on("change:background_survey", () => {
      const n = t.get("background_survey");
      s.style.background = n ? "transparent" : "#000", S();
    }), a && f) {
      const n = Vt[f] || f, u = (w / h % 360 + 360) % 360, l = T / h, p = m / h;
      r = a.aladin(d, {
        fov: p || 180,
        target: u + " " + l,
        survey: n,
        ...ie
      }), o("Aladin viewer created: " + f), i(), O();
    }
    t.on("change:background_survey", async () => {
      const n = t.get("background_survey");
      if (n && r) {
        const u = Vt[n] || n;
        r.setBaseImageLayer(u), s.style.background = "transparent", i();
      } else if (n && !r && !a)
        try {
          a = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await a.init, ae(d, s), s.appendChild(d), s.style.background = "transparent";
          const l = Vt[n] || n;
          r = a.aladin(d, {
            fov: m / h || 180,
            target: (w / h % 360 + 360) % 360 + " " + T / h,
            survey: l,
            ...ie
          }), o("Aladin loaded on demand: " + n), i(), O();
        } catch (u) {
          o("Aladin load failed: " + u.message);
        }
      else n || (s.style.background = "#000", d.style.display = "none");
      S();
>>>>>>> origin/main
    }), t.on("change:background_cut_min", () => {
      i();
    }), t.on("change:background_cut_max", () => {
      i();
<<<<<<< HEAD
    }), te();
    let pt = 0;
    const ee = 30;
    setTimeout(ne, 50);
    let mt = 0, _t = 0, vt = 0, yt = 0, Ot = !1;
    h.style.cursor = "grab", h.addEventListener("mousedown", (n) => {
      if (vt = n.clientX, yt = n.clientY, Ot = !1, Rt === "boxzoom") {
        nt = !0;
        const u = s.getBoundingClientRect();
        V = n.clientX - u.left, Y = n.clientY - u.top, S.style.left = V + "px", S.style.top = Y + "px", S.style.width = "0", S.style.height = "0", S.style.display = "block";
      } else
        et = !0, mt = n.clientX, _t = n.clientY, h.style.cursor = "grabbing";
    }), window.addEventListener("mousemove", (n) => {
      if (et && !j) {
        if (Math.sqrt((n.clientX - vt) ** 2 + (n.clientY - yt) ** 2) < 3) return;
        et = !1, j = !0;
      }
      if (nt) {
        const m = s.getBoundingClientRect(), A = n.clientX - m.left, M = n.clientY - m.top, R = Math.min(V, A), X = Math.min(Y, M), L = Math.abs(A - V), it = Math.abs(M - Y);
        S.style.left = R + "px", S.style.top = X + "px", S.style.width = L + "px", S.style.height = it + "px", Ot = !0;
        return;
      }
      if (!j) {
        const m = h.getBoundingClientRect(), A = (n.clientX - m.left) / m.width * 2 - 1, M = -((n.clientY - m.top) / m.height * 2 - 1), R = K(), X = wt(
          A,
          M,
          T,
          E,
          _,
          R,
          ut(),
          k
        );
        if (X) {
          const L = (X.ra / g % 360 + 360) % 360;
          W.textContent = Ie(L) + "  " + Le(X.dec / g);
=======
    }), Zt();
    let dt = 0;
    const $t = 30;
    setTimeout(Jt, 50);
    let ht = 0, gt = 0, pt = 0, mt = 0, Nt = !1;
    g.style.cursor = "grab", g.addEventListener("mousedown", (n) => {
      if (L = !0, N && (clearTimeout(N), N = null), pt = n.clientX, mt = n.clientY, Nt = !1, Dt === "boxzoom") {
        at = !0;
        const u = s.getBoundingClientRect();
        Y = n.clientX - u.left, G = n.clientY - u.top, b.style.left = Y + "px", b.style.top = G + "px", b.style.width = "0", b.style.height = "0", b.style.display = "block";
      } else
        ot = !0, ht = n.clientX, gt = n.clientY, g.style.cursor = "grabbing";
    }), window.addEventListener("mousemove", (n) => {
      if (ot && !Z) {
        if (Math.sqrt((n.clientX - pt) ** 2 + (n.clientY - mt) ** 2) < 3) return;
        ot = !1, Z = !0;
      }
      if (at) {
        const _ = s.getBoundingClientRect(), R = n.clientX - _.left, A = n.clientY - _.top, M = Math.min(Y, R), F = Math.min(G, A), k = Math.abs(R - Y), rt = Math.abs(A - G);
        b.style.left = M + "px", b.style.top = F + "px", b.style.width = k + "px", b.style.height = rt + "px", Nt = !0;
        return;
      }
      if (!Z) {
        const _ = g.getBoundingClientRect(), R = (n.clientX - _.left) / _.width * 2 - 1, A = -((n.clientY - _.top) / _.height * 2 - 1), M = $(), F = vt(
          R,
          A,
          w,
          T,
          m,
          M,
          ct(),
          U
        );
        if (F) {
          const k = (F.ra / h % 360 + 360) % 360;
          W.textContent = Pe(k) + "  " + Fe(F.dec / h);
>>>>>>> origin/main
        } else
          W.textContent = "";
        return;
      }
<<<<<<< HEAD
      const u = K(), a = ut();
      if (!ve(mt, _t, n.clientX, n.clientY)) {
        const m = zt(mt, _t), A = zt(n.clientX, n.clientY), M = Se(
          m.x,
          m.y,
          A.x,
          A.y,
          T,
          E,
          _,
          u,
          {
            invertHorizontalPan: t.get("invert_horizontal_pan") !== !1,
            scales: a,
            rotationRad: k
          }
        );
        M && (T = M.viewRA, E = M.viewDec);
      }
      o && G(), mt = n.clientX, _t = n.clientY, Ot = !0, requestAnimationFrame(b);
    }), window.addEventListener("mouseup", (n) => {
      if (nt) {
        if (nt = !1, S.style.display = "none", Math.sqrt((n.clientX - vt) ** 2 + (n.clientY - yt) ** 2) < 5) return;
        const a = s.getBoundingClientRect(), p = n.clientX - a.left, m = n.clientY - a.top, A = (V + p) / 2 / a.width * 2 - 1, M = -((Y + m) / 2 / a.height * 2 - 1), R = Wt(
          a.left + (V + p) / 2,
          a.top + (Y + m) / 2
        );
        if (!R) return;
        T = R.ra, E = R.dec;
        const X = Math.max(
          Math.abs(p - V) / a.width,
          Math.abs(m - Y) / a.height
        ), L = _ * 0.5;
        _ = 2 * Math.asin(Math.min(1, X * Math.sin(L))), _ = It(_), lt(), Yt({ pushToAladin: !0 });
        return;
      }
      if (j || et)
        if (j = !1, et = !1, h.style.cursor = Rt === "pan" ? "grab" : "crosshair", Math.sqrt((n.clientX - vt) ** 2 + (n.clientY - yt) ** 2) < 3) {
          const a = ye(n.clientX, n.clientY);
          if (!a) return;
          const p = (a.ra / g % 360 + 360) % 360, m = a.dec / g;
          t.set("clicked_coord", [p, m]);
          try {
            let Ht = NaN, re = NaN;
            if (o != null && o.pix2world) {
              const ce = gt(n.clientX, n.clientY), at = o.pix2world(ce.x, ce.y);
              Array.isArray(at) && isFinite(at[0]) && isFinite(at[1]) && (Ht = (at[0] % 360 + 360) % 360, re = at[1]);
            }
            let ie = NaN, ae = NaN;
            const qt = Wt(n.clientX, n.clientY);
            qt && (ie = (qt.ra / g % 360 + 360) % 360, ae = qt.dec / g), t.set("clicked_coord_debug", [Ht, re, ie, ae]);
          } catch {
            t.set("clicked_coord_debug", [NaN, NaN, NaN, NaN]);
          }
          const A = a.ra - q[0], M = Math.sin(a.dec), R = Math.cos(a.dec), X = Math.sin(q[1]), L = Math.cos(q[1]), it = R * Math.sin(A), xt = M * L - R * X * Math.cos(A);
          t.set("clicked_lm", [it, xt]);
          const oe = t.get("click_tick");
          t.set("click_tick", (oe ?? 0) + 1), t.save_changes(), st = -999, bt = -999, ot = a.ra, ct = a.dec, o && kt(), requestAnimationFrame(b);
        } else
          lt(), Yt({ pushToAladin: !1 });
    }), h.addEventListener("wheel", (n) => {
      n.preventDefault(), _ *= n.deltaY > 0 ? 1.1 : 1 / 1.1, _ = It(_), lt(), o ? (o.setFoV(_ / g), requestAnimationFrame(() => Yt({ pushToAladin: !1 }))) : requestAnimationFrame(b);
    }, { passive: !1 }), new ResizeObserver(() => {
      const n = s.getBoundingClientRect(), u = window.devicePixelRatio || 1;
      h.width = n.width * u, h.height = n.height * u, G(), b();
    }).observe(s);
  } catch (y) {
    r("ERROR: " + y.message), r(y.stack);
  }
}
function Ie(t) {
  const l = t / 15, r = Math.floor(l), i = Math.floor((l - r) * 60), c = ((l - r) * 60 - i) * 60;
  return r + "h" + String(i).padStart(2, "0") + "m" + c.toFixed(1).padStart(4, "0") + "s";
}
function Le(t) {
  const l = t >= 0 ? "+" : "-", r = Math.abs(t), i = Math.floor(r), c = Math.floor((r - i) * 60), o = ((r - i) * 60 - c) * 60;
  return l + i + "°" + String(c).padStart(2, "0") + "'" + o.toFixed(1).padStart(4, "0") + '"';
}
export {
  Ue as render
=======
      const u = $(), l = ct();
      if (!he(ht, gt, n.clientX, n.clientY)) {
        const _ = Lt(ht, gt), R = Lt(n.clientX, n.clientY), A = Te(
          _.x,
          _.y,
          R.x,
          R.y,
          w,
          T,
          m,
          u,
          {
            invertHorizontalPan: t.get("invert_horizontal_pan") !== !1,
            scales: l,
            rotationRad: U
          }
        );
        A && (w = A.viewRA, T = A.viewDec);
      }
      r && O(), ht = n.clientX, gt = n.clientY, Nt = !0, requestAnimationFrame(S);
    }), window.addEventListener("mouseup", (n) => {
      if (at) {
        if (at = !1, b.style.display = "none", N = setTimeout(() => {
          L = !1;
        }, 500), Math.sqrt((n.clientX - pt) ** 2 + (n.clientY - mt) ** 2) < 5) return;
        const l = s.getBoundingClientRect(), p = n.clientX - l.left, _ = n.clientY - l.top, R = (Y + p) / 2 / l.width * 2 - 1, A = -((G + _) / 2 / l.height * 2 - 1), M = kt(
          l.left + (Y + p) / 2,
          l.top + (G + _) / 2
        );
        if (!M) return;
        w = M.ra, T = M.dec;
        const F = Math.max(
          Math.abs(p - Y) / l.width,
          Math.abs(_ - G) / l.height
        ), k = m * 0.5;
        m = 2 * Math.asin(Math.min(1, F * Math.sin(k))), m = Mt(m), t.set("view_ra", w / h), t.set("view_dec", T / h), t.set("view_fov", m / h), t.save_changes(), Xt();
        return;
      }
      if (Z || ot) {
        const u = Z;
        if (Z = !1, ot = !1, g.style.cursor = Dt === "pan" ? "grab" : "crosshair", N = setTimeout(() => {
          L = !1;
        }, 500), Math.sqrt((n.clientX - pt) ** 2 + (n.clientY - mt) ** 2) < 3) {
          const p = ge(n.clientX, n.clientY);
          if (!p) return;
          const _ = (p.ra / h % 360 + 360) % 360, R = p.dec / h;
          t.set("clicked_coord", [_, R]);
          try {
            let Ut = NaN, te = NaN;
            if (r != null && r.pix2world) {
              const oe = ft(n.clientX, n.clientY), it = r.pix2world(oe.x, oe.y);
              Array.isArray(it) && isFinite(it[0]) && isFinite(it[1]) && (Ut = (it[0] % 360 + 360) % 360, te = it[1]);
            }
            let ee = NaN, ne = NaN;
            const Bt = kt(n.clientX, n.clientY);
            Bt && (ee = (Bt.ra / h % 360 + 360) % 360, ne = Bt.dec / h), t.set("clicked_coord_debug", [Ut, te, ee, ne]);
          } catch {
            t.set("clicked_coord_debug", [NaN, NaN, NaN, NaN]);
          }
          const A = p.ra - j[0], M = Math.sin(p.dec), F = Math.cos(p.dec), k = Math.sin(j[1]), rt = Math.cos(j[1]), _t = F * Math.sin(A), pe = M * rt - F * k * Math.cos(A);
          t.set("clicked_lm", [_t, pe]);
          const Qt = t.get("click_tick");
          t.set("click_tick", (Qt ?? 0) + 1), t.save_changes(), Et = -999, jt = -999, Tt = p.ra, qt = p.dec, requestAnimationFrame(S);
        } else
          t.set("view_ra", w / h), t.set("view_dec", T / h), t.save_changes(), Xt();
      }
    }), g.addEventListener("wheel", (n) => {
      n.preventDefault(), L = !0, N && clearTimeout(N), m *= n.deltaY > 0 ? 1.1 : 1 / 1.1, m = Mt(m), t.set("view_fov", m / h), t.save_changes(), r ? (r.setFoV(m / h), requestAnimationFrame(Xt)) : requestAnimationFrame(S), N = setTimeout(() => {
        L = !1;
      }, 500);
    }, { passive: !1 }), new ResizeObserver(() => {
      const n = s.getBoundingClientRect(), u = window.devicePixelRatio || 1;
      g.width = n.width * u, g.height = n.height * u, O(), S();
    }).observe(s);
  } catch (x) {
    o("ERROR: " + x.message), o(x.stack);
  }
}
function Pe(t) {
  const c = t / 15, o = Math.floor(c), i = Math.floor((c - o) * 60), a = ((c - o) * 60 - i) * 60;
  return o + "h" + String(i).padStart(2, "0") + "m" + a.toFixed(1).padStart(4, "0") + "s";
}
function Fe(t) {
  const c = t >= 0 ? "+" : "-", o = Math.abs(t), i = Math.floor(o), a = Math.floor((o - i) * 60), r = ((o - i) * 60 - a) * 60;
  return c + i + "°" + String(a).padStart(2, "0") + "'" + r.toFixed(1).padStart(4, "0") + '"';
}
export {
  Ie as render
>>>>>>> origin/main
};
//# sourceMappingURL=widget.js.map
