const g = Math.PI / 180;
function ft(e, l) {
  let r, i;
  return l >= 1 ? (r = e, i = e / l) : (i = e, r = e * l), {
    fovWidth: r,
    fovHeight: i,
    scaleX: Math.sin(r * 0.5),
    scaleY: Math.sin(i * 0.5)
  };
}
function yt(e) {
  return Math.PI;
}
function wt(e, l, r, i, c, o = 0) {
  if (!(e != null && e.pix2world) || l < 2 || r < 2) return null;
  if (i == null || c == null) {
    const [t, F] = e.getRaDec();
    i = t * g, c = F * g;
  }
  const f = l * 0.5, s = r * 0.5, d = Math.max(4, l * 0.02), h = Math.max(4, r * 0.02), v = Math.cos(o), w = Math.sin(o);
  function D(t, F) {
    const [H, N] = e.pix2world(t, F), { l: y, m: Q } = ht(H * g, N * g, i, c);
    return o === 0 ? { l0: y, m0: Q } : { l0: y * v - Q * w, m0: y * w + Q * v };
  }
  const C = D(f + d, s), B = D(f - d, s), O = D(f, s - h), z = D(f, s + h), b = 4 * d / l, W = 4 * h / r, x = Math.abs(C.l0 - B.l0) / b, P = Math.abs(O.m0 - z.m0) / W;
  return !Number.isFinite(x) || !Number.isFinite(P) || x < 1e-15 || P < 1e-15 ? null : { scaleX: x, scaleY: P };
}
function dt(e, l, r) {
  return (r == null ? void 0 : r.scaleX) > 0 && (r == null ? void 0 : r.scaleY) > 0 ? r : ft(e, l);
}
function Tt(e, l, r, i, c = 0) {
  const o = -e * r, f = l * i;
  if (c === 0) return { l: o, m: f };
  const s = Math.cos(c), d = Math.sin(c);
  return {
    l: o * s + f * d,
    m: -o * d + f * s
  };
}
function Et(e, l, r, i, c = 0) {
  let o = e, f = l;
  if (c !== 0) {
    const s = Math.cos(c), d = Math.sin(c);
    o = e * s - l * d, f = e * d + l * s;
  }
  return { x: -o / r, y: f / i };
}
function ht(e, l, r, i) {
  const c = e - r, o = Math.sin(l), f = Math.cos(l), s = Math.sin(i), d = Math.cos(i), h = Math.cos(c), v = o * s + f * d * h, w = f * Math.sin(c), D = o * d - f * s * h;
  return { l: w, m: D, visible: v > 0 };
}
function Dt(e, l, r, i) {
  const c = Math.sqrt(e * e + l * l);
  if (c > 1) return null;
  const o = Math.sin(i), f = Math.cos(i);
  let s, d;
  if (c === 0)
    s = i, d = r;
  else {
    const h = Math.sqrt(1 - c * c);
    s = Math.asin(h * o + l * f / c * c);
    const v = c;
    s = Math.asin(h * o + l * f * v / c), d = r + Math.atan2(e * v, c * f * h - l * o * v);
  }
  return { ra: d, dec: s };
}
function Te(e, l, r, i, c, o, f = null, s = 0) {
  const { scaleX: d, scaleY: h } = dt(c, o, f), { l: v, m: w } = Tt(e, l, d, h, s);
  return Math.hypot(v, w) > 1 ? null : Dt(v, w, r, i);
}
function At(e, l, r, i, c, o, f = null, s = 0) {
  const { l: d, m: h, visible: v } = ht(e, l, r, i);
  if (!v) return null;
  const { scaleX: w, scaleY: D } = dt(c, o, f);
  if (w < 1e-15 || D < 1e-15) return { x: 0, y: 0 };
  const { x: C, y: B } = Et(d, h, w, D, s);
  return Math.hypot(d, h) > 1 + 1e-12 ? null : { x: C, y: B };
}
function bt(e, l, r, i, c, o, f, s, d = {}) {
  const h = d.scales ?? null, v = d.rotationRad ?? 0, w = Te(e, l, c, o, f, s, h, v), D = Te(r, i, c, o, f, s, h, v);
  if (!w || !D) return null;
  let C = w.ra - D.ra;
  C > Math.PI && (C -= 2 * Math.PI), C < -Math.PI && (C += 2 * Math.PI);
  const B = d.invertHorizontalPan === !1 ? 1 : -1, O = -Math.PI / 2 + 1e-3, z = Math.PI / 2 - 1e-3;
  return {
    viewRA: c + B * C,
    viewDec: Math.max(O, Math.min(z, o + w.dec - D.dec))
  };
}
function St(e, l, r, i, c) {
  if (r != null && r.pix2world) {
    const { x: o, y: f } = i(e, l), s = r.pix2world(o, f);
    if (!s || s.length < 2) return null;
    const d = s[0], h = s[1];
    return !Number.isFinite(d) || !Number.isFinite(h) ? null : { ra: d * g, dec: h * g };
  }
  return c(e, l);
}
function Rt() {
  const e = [
    [0, 0, 0, 4],
    [32, 31, 2, 67],
    [64, 84, 3, 104],
    [96, 136, 17, 90],
    [128, 186, 54, 58],
    [160, 227, 100, 26],
    [192, 250, 150, 6],
    [224, 253, 205, 41],
    [255, 252, 255, 164]
  ], l = new Uint8Array(256 * 4);
  for (let r = 0; r < 256; r++) {
    let i = 0;
    for (let s = 0; s < e.length - 1; s++) r >= e[s][0] && (i = s);
    const c = Math.min(i + 1, e.length - 1), o = e[c][0] - e[i][0] || 1, f = (r - e[i][0]) / o;
    l[r * 4] = e[i][1] + f * (e[c][1] - e[i][1]) | 0, l[r * 4 + 1] = e[i][2] + f * (e[c][2] - e[i][2]) | 0, l[r * 4 + 2] = e[i][3] + f * (e[c][3] - e[i][3]) | 0, l[r * 4 + 3] = 255;
  }
  return l;
}
const Ct = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0, 1); }
`, Mt = `#version 300 es
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
    // Texel k covers 0-based pixels [k - 0.5, k + 0.5); its center is uv (k + 0.5) / size.
    vec2 uv = vec2((py + 0.5)/u_imageSize.x, (px + 0.5)/u_imageSize.y);

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
function st(e, l, r) {
  const i = e.createShader(l);
  if (e.shaderSource(i, r), e.compileShader(i), !e.getShaderParameter(i, e.COMPILE_STATUS)) {
    const c = e.getShaderInfoLog(i);
    throw e.deleteShader(i), new Error("Shader: " + c);
  }
  return i;
}
function Pt(e) {
  const l = st(e, e.VERTEX_SHADER, Ct), r = st(e, e.FRAGMENT_SHADER, Mt), i = e.createProgram();
  if (e.attachShader(i, l), e.attachShader(i, r), e.linkProgram(i), !e.getProgramParameter(i, e.LINK_STATUS))
    throw new Error("Link: " + e.getProgramInfoLog(i));
  return i;
}
function Ft(e, l, r) {
  const i = e.length, c = new Uint8Array(i * 4), o = r - l || 1e-30;
  for (let f = 0; f < i; f++) {
    const s = e[f];
    if (s !== s || !isFinite(s)) {
      c[f * 4 + 3] = 0;
      continue;
    }
    let d = (s - l) / o;
    d = d < 0 ? 0 : d > 1 ? 1 : d, c[f * 4] = d * 255 + 0.5 | 0, c[f * 4 + 3] = 255;
  }
  return c;
}
const je = {
  DSS: "CDS/P/DSS2/color",
  "2MASS": "CDS/P/2MASS/color",
  WISE: "CDS/P/allWISE/color",
  Planck: "CDS/P/PLANCK/R2/HFI/color",
  SDSS: "CDS/P/SDSS9/color",
  Mellinger: "CDS/P/Mellinger/color",
  Fermi: "CDS/P/Fermi/color",
  Haslam408: "CDS/P/HI4PI/NHI"
}, lt = {
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
}, Nt = [
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
function Xt(e) {
  const l = "astrowidget-aladin-control-layer";
  if (e.querySelector(`#${l}`)) return;
  const r = document.createElement("style");
  r.id = l, r.textContent = `
    .astrowidget-aladin-bg ${Nt} {
      z-index: 0 !important;
      pointer-events: none !important;
    }
  `, e.appendChild(r);
}
function ut(e, l) {
  e.classList.add("astrowidget-aladin-bg"), Xt(l);
}
async function Ut({ model: e, el: l }) {
  function r(x) {
    console.log("[astrowidget]", x);
  }
  function i() {
    const x = e.get("background_cut_min"), P = e.get("background_cut_max");
    if (!o || !Number.isFinite(x) || !Number.isFinite(P)) return;
    let t = 0;
    function F() {
      var H;
      t += 1;
      try {
        const N = (H = o.getBaseImageLayer) == null ? void 0 : H.call(o);
        if (N != null && N.setCuts) {
          N.setCuts(x, P), r("Background cuts: " + x + " .. " + P);
          return;
        }
      } catch (N) {
        r("Background setCuts pending: " + N.message);
      }
      t < 25 && setTimeout(F, Math.min(100 * t, 1e3));
    }
    F();
  }
  let c = null, o = null;
  const f = e.get("background_survey");
  if (f)
    try {
      c = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await c.init, r("Aladin Lite loaded");
    } catch (x) {
      r("Aladin Lite load failed: " + x.message);
    }
  const s = document.createElement("div");
  s.style.cssText = "position:relative;width:100%;height:600px;background:" + (f && c ? "transparent" : "#000"), l.appendChild(s);
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:0", f && c && (ut(d, s), s.appendChild(d));
  const h = document.createElement("canvas");
  h.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:1", s.appendChild(h);
  const v = document.createElement("div");
  v.style.cssText = "position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:4px", s.appendChild(v);
  const w = "padding:4px 10px;font:12px sans-serif;border:1px solid #888;border-radius:3px;cursor:pointer;color:#fff;background:rgba(0,0,0,0.6)", D = w + ";background:rgba(70,130,255,0.8);border-color:#7af";
  function C(x, P) {
    const t = document.createElement("button");
    return t.textContent = x, t.title = P, t.style.cssText = w, v.appendChild(t), t;
  }
  const B = C("↺", "Reset view to initial position"), O = C("✥", "Pan mode (drag to rotate)"), z = C("⬚", "Box zoom (drag to select region)"), b = document.createElement("div");
  b.style.cssText = "position:absolute;border:2px dashed #7af;background:rgba(70,130,255,0.15);pointer-events:none;z-index:2;display:none", s.appendChild(b);
  const W = document.createElement("div");
  W.style.cssText = "position:absolute;bottom:8px;left:8px;color:#fff;font:13px monospace;text-shadow:0 0 4px #000;pointer-events:none;z-index:2", s.appendChild(W);
  try {
    let pt = function() {
      Se && clearTimeout(Se), be = !0, Se = setTimeout(() => {
        be = !1;
      }, 500);
    }, ue = function() {
      pt(), e.set("view_ra", T / g), e.set("view_dec", E / g), e.set("view_fov", _ / g), e.save_changes();
    }, fe = function() {
      return !be && !j && !re;
    }, Ne = function(n) {
      Ce = n, O.style.cssText = n === "pan" ? D : w, z.style.cssText = n === "boxzoom" ? D : w, h.style.cursor = n === "pan" ? "grab" : "crosshair";
    }, Xe = function() {
      if (!ne) return;
      const n = Ft(ne, Ke, Ze);
      t.activeTexture(t.TEXTURE0), t.bindTexture(t.TEXTURE_2D, Ee), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, ee, te, 0, t.RGBA, t.UNSIGNED_BYTE, n);
    }, K = function() {
      const n = o == null ? void 0 : o.view, u = (n == null ? void 0 : n.width) ?? h.clientWidth, a = (n == null ? void 0 : n.height) ?? h.clientHeight;
      return u / Math.max(a, 1);
    }, de = function() {
      return I || ft(_, K());
    }, Ie = function(n) {
      const u = 1e-3 * g, a = yt(K());
      return Math.max(u, Math.min(a, n));
    }, ke = function() {
      if (!(o != null && o.getRaDec)) return;
      const [n, u] = o.getRaDec();
      if (T = n * g, E = u * g, typeof o.getFov == "function") {
        const a = o.getFov(), p = Array.isArray(a) ? a[0] : a, m = Array.isArray(a) ? a[1] : p;
        _ = Math.max(p, m) * g;
      }
      Le();
    }, Le = function() {
      if (!(o != null && o.getRotation)) {
        L = 0;
        return;
      }
      L = -o.getRotation() * g;
    }, G = function() {
      if (!o) {
        I = null;
        return;
      }
      const n = o.view, u = (n == null ? void 0 : n.width) ?? d.clientWidth, a = (n == null ? void 0 : n.height) ?? d.clientHeight;
      I = wt(
        o,
        u,
        a,
        T,
        E,
        L
      ) ?? null;
    }, Ue = function() {
      o && (ke(), I = null, G());
    }, S = function() {
      o && (Le(), G()), t.viewport(0, 0, h.width, h.height), t.clearColor(0, 0, 0, 0), t.clear(t.COLOR_BUFFER_BIT), t.enable(t.BLEND), t.blendFunc(t.ONE, t.ONE_MINUS_SRC_ALPHA), t.useProgram(F), t.uniform1i(y.u_image, 0), t.uniform1i(y.u_cmap, 1), t.uniform2f(y.u_crval, q[0], q[1]), t.uniform2f(y.u_cdelt, De[0], De[1]), t.uniform2f(y.u_crpix, Ae[0], Ae[1]), t.uniform2f(y.u_imageSize, ee, te), t.uniform2f(y.u_viewCenter, T, E);
      const n = de();
      t.uniform2f(y.u_viewScale, n.scaleX, n.scaleY), t.uniform1f(y.u_viewRotation, L), t.uniform1f(y.u_fov, _), t.uniform1f(y.u_opacity, $e), t.uniform1i(y.u_stretch, Je), t.uniform1i(y.u_showGrid, Qe);
      let u = -999, a = -999;
      if (le > -900)
        u = le, a = Re;
      else if (ie > -900) {
        const p = At(
          ie,
          se,
          T,
          E,
          _,
          K(),
          n,
          L
        );
        p && (u = p.x, a = p.y);
      }
      t.uniform2f(y.u_crosshairScreen, u, a), t.uniform2f(y.u_resolution, h.width, h.height), t.drawArrays(t.TRIANGLES, 0, 6);
    }, mt = function() {
      ne = null, ee = 1, te = 1, t.activeTexture(t.TEXTURE0), t.bindTexture(t.TEXTURE_2D, Ee), t.texImage2D(
        t.TEXTURE_2D,
        0,
        t.RGBA,
        1,
        1,
        0,
        t.RGBA,
        t.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0])
      );
    }, he = function() {
      const n = e.get("image_data"), u = e.get("image_shape"), a = n ? n.byteLength || n.length : 0;
      if (!n || !u || u[0] === 0 || a === 0) {
        mt();
        return;
      }
      te = u[0], ee = u[1], ne = new Float32Array(n.buffer.slice(n.byteOffset, n.byteOffset + a)), r("Image: " + ee + "x" + te + ", " + ne.length + " floats"), Xe();
    }, Z = function() {
      const n = e.get("crval"), u = e.get("cdelt"), a = e.get("crpix");
      n && (q = [n[0] * g, n[1] * g]), u && (De = [u[0] * g, u[1] * g]), a && (Ae = [a[0], a[1]]);
    }, ge = function() {
      T = (e.get("view_ra") || 0) * g, E = (e.get("view_dec") || 0) * g, _ = (e.get("view_fov") || 180) * g;
    }, _t = function() {
      fe() && ge();
    }, U = function() {
      Ke = e.get("vmin") || 0, Ze = e.get("vmax") || 1, $e = e.get("opacity") ?? 1, Je = gt[e.get("stretch")] || 0, Qe = e.get("show_grid") === !1 ? 0 : 1;
    }, $ = function() {
      Be || (Be = !0, requestAnimationFrame(() => {
        Be = !1, S();
      }));
    }, Ve = function() {
      const n = e.get("crosshair_ra"), u = e.get("crosshair_dec");
      typeof n != "number" || typeof u != "number" || n < -900 || u < -900 ? (ie = -999, se = -999) : (ie = n * g, se = u * g, le = -999, Re = -999);
    }, et = function() {
      U(), he(), Z(), _t(), Ve(), o && fe() && J(), S();
    }, Ye = function({ pushToAladin: n = !1 } = {}) {
      if (o && (n ? J() : (ke(), I = null, G())), S(), e.get("overlay_view_lock")) {
        const u = e.get("view_gesture_revision") || 0;
        e.set("view_gesture_revision", u + 1), e.save_changes();
      }
    }, Ge = function() {
      fe() && (ge(), I = null, J(), $());
    }, J = function(n = !0) {
      if (!o) return;
      _ = Ie(_);
      const u = _ / g;
      if (n) {
        const a = (T / g % 360 + 360) % 360, p = E / g;
        o.gotoRaDec(a, p);
      }
      o.setFoV(u), ke(), I = null, G();
    }, pe = function(n, u) {
      const a = d.getBoundingClientRect(), p = o.view, m = (p == null ? void 0 : p.width) ?? a.width, A = (p == null ? void 0 : p.height) ?? a.height;
      return {
        x: (n - a.left) * (m / a.width),
        y: (u - a.top) * (A / a.height)
      };
    }, vt = function(n, u, a, p) {
      var we;
      const m = (we = o == null ? void 0 : o.view) == null ? void 0 : we.wasm;
      if (!(m != null && m.goFromTo)) return !1;
      let { x: A, y: M } = pe(n, u), { x: R, y: X } = pe(a, p);
      e.get("invert_horizontal_pan") === !1 && ([A, R] = [R, A]), m.goFromTo(A, M, R, X), o.view.updateCenter();
      const [k, ae] = o.getRaDec();
      return T = k * g, E = ae * g, Le(), !0;
    }, nt = function() {
      me++, et();
      const n = e.get("image_data");
      if (n && (n.byteLength || n.length) > 0) {
        r("Data arrived after " + me + " poll(s)"), requestAnimationFrame(S), Me = T, Pe = E, Fe = _;
        return;
      }
      me < tt ? setTimeout(nt, Math.min(100 * Math.pow(1.5, me - 1), 1e3)) : (r("No image data after " + tt + " polls — waiting for change event"), J(), Me = T, Pe = E, Fe = _);
    }, ze = function(n, u) {
      const a = h.getBoundingClientRect();
      return {
        x: (n - a.left) / a.width * 2 - 1,
        y: -((u - a.top) / a.height * 2 - 1)
      };
    }, We = function(n, u) {
      const { x: a, y: p } = ze(n, u);
      return Te(
        a,
        p,
        T,
        E,
        _,
        K(),
        de(),
        L
      );
    }, xt = function(n, u) {
      return St(
        n,
        u,
        o,
        pe,
        We
      );
    };
    const x = s.getBoundingClientRect(), P = window.devicePixelRatio || 1;
    h.width = (x.width || 800) * P, h.height = (x.height || 600) * P;
    const t = h.getContext("webgl2", { alpha: !0, premultipliedAlpha: !0, preserveDrawingBuffer: !0 });
    if (!t) {
      r("FAIL: No WebGL2");
      return;
    }
    r("WebGL2: " + t.getParameter(t.RENDERER));
    const F = Pt(t);
    r("Shader compiled OK"), t.useProgram(F);
    const H = t.createBuffer();
    t.bindBuffer(t.ARRAY_BUFFER, H), t.bufferData(t.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), t.STATIC_DRAW);
    const N = t.getAttribLocation(F, "a_pos");
    t.enableVertexAttribArray(N), t.vertexAttribPointer(N, 2, t.FLOAT, !1, 0, 0);
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
      (n) => y[n] = t.getUniformLocation(F, n)
    );
    const Q = t.createTexture();
    t.activeTexture(t.TEXTURE1), t.bindTexture(t.TEXTURE_2D, Q), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, 256, 1, 0, t.RGBA, t.UNSIGNED_BYTE, Rt()), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE), r("Colormap texture OK");
    const Ee = t.createTexture();
    t.activeTexture(t.TEXTURE0), t.bindTexture(t.TEXTURE_2D, Ee), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, 1, 1, 0, t.RGBA, t.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.NEAREST), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.NEAREST), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE);
    let ee = 1, te = 1, ne = null, q = [0, 0], De = [1, 1], Ae = [0, 0], T = 0, E = 0, _ = Math.PI, I = null, L = 0, Ke = 0, Ze = 1, $e = 1, Je = 0, Qe = 1, j = !1, oe = !1, re = !1, be = !1, Se = null, ie = -999, se = -999, le = -999, Re = -999;
    const gt = { linear: 0, log: 1, sqrt: 2, asinh: 3 };
    let Ce = "pan", Me = 0, Pe = 0, Fe = Math.PI, V = 0, Y = 0;
    Ne("pan"), O.addEventListener("click", () => Ne("pan")), z.addEventListener("click", () => Ne("boxzoom")), B.addEventListener("click", () => {
      T = Me, E = Pe, _ = Fe, ue(), J(), S();
    });
    let Be = !1;
    if (e.on("change:image_data", () => {
      U(), he(), Z();
    }), e.on("change:image_shape", () => {
      he();
    }), e.on("change:crval", () => {
      Z();
    }), e.on("change:cdelt", () => {
      Z();
    }), e.on("change:crpix", () => {
      Z();
    }), e.on("change:vmin", () => {
      U(), Xe(), $();
    }), e.on("change:vmax", () => {
      U(), Xe(), $();
    }), e.on("change:image_revision", () => {
      U(), he(), Z(), e.get("overlay_view_lock") || (fe() ? (ge(), o && J()) : (I = null, o && G())), $();
    }), e.on("change:crosshair_ra", () => {
      Ve(), $();
    }), e.on("change:crosshair_dec", () => {
      Ve(), $();
    }), e.on("change:view_ra", Ge), e.on("change:view_dec", Ge), e.on("change:view_fov", Ge), e.on("change:opacity", () => {
      U(), S();
    }), e.on("change:stretch", () => {
      U(), S();
    }), e.on("change:show_grid", () => {
      U(), S();
    }), e.on("change:background_survey", () => {
      const n = e.get("background_survey");
      s.style.background = n ? "transparent" : "#000", S();
    }), c && f) {
      ge();
      const n = je[f] || f, u = (T / g % 360 + 360) % 360, a = E / g, p = _ / g;
      o = c.aladin(d, {
        fov: p || 180,
        target: u + " " + a,
        survey: n,
        ...lt
      }), r("Aladin viewer created: " + f), i(), Ue();
    }
    e.on("change:background_survey", async () => {
      const n = e.get("background_survey");
      if (n && o) {
        const u = je[n] || n;
        o.setBaseImageLayer(u), s.style.background = "transparent", i();
      } else if (n && !o && !c)
        try {
          c = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await c.init, ut(d, s), s.appendChild(d), s.style.background = "transparent";
          const a = je[n] || n;
          o = c.aladin(d, {
            fov: _ / g || 180,
            target: (T / g % 360 + 360) % 360 + " " + E / g,
            survey: a,
            ...lt
          }), r("Aladin loaded on demand: " + n), i(), Ue();
        } catch (u) {
          r("Aladin load failed: " + u.message);
        }
      else n || (s.style.background = "#000", d.style.display = "none");
      S();
    }), e.on("change:background_cut_min", () => {
      i();
    }), e.on("change:background_cut_max", () => {
      i();
    }), et();
    let me = 0;
    const tt = 30;
    setTimeout(nt, 50);
    let _e = 0, ve = 0, xe = 0, ye = 0, Oe = !1;
    h.style.cursor = "grab", h.addEventListener("mousedown", (n) => {
      if (xe = n.clientX, ye = n.clientY, Oe = !1, Ce === "boxzoom") {
        re = !0;
        const u = s.getBoundingClientRect();
        V = n.clientX - u.left, Y = n.clientY - u.top, b.style.left = V + "px", b.style.top = Y + "px", b.style.width = "0", b.style.height = "0", b.style.display = "block";
      } else
        oe = !0, _e = n.clientX, ve = n.clientY, h.style.cursor = "grabbing";
    }), window.addEventListener("mousemove", (n) => {
      if (oe && !j) {
        if (Math.sqrt((n.clientX - xe) ** 2 + (n.clientY - ye) ** 2) < 3) return;
        oe = !1, j = !0;
      }
      if (re) {
        const m = s.getBoundingClientRect(), A = n.clientX - m.left, M = n.clientY - m.top, R = Math.min(V, A), X = Math.min(Y, M), k = Math.abs(A - V), ae = Math.abs(M - Y);
        b.style.left = R + "px", b.style.top = X + "px", b.style.width = k + "px", b.style.height = ae + "px", Oe = !0;
        return;
      }
      if (!j) {
        const m = h.getBoundingClientRect(), A = (n.clientX - m.left) / m.width * 2 - 1, M = -((n.clientY - m.top) / m.height * 2 - 1), R = K(), X = Te(
          A,
          M,
          T,
          E,
          _,
          R,
          de(),
          L
        );
        if (X) {
          const k = (X.ra / g % 360 + 360) % 360;
          W.textContent = It(k) + "  " + kt(X.dec / g);
        } else
          W.textContent = "";
        return;
      }
      const u = K(), a = de();
      if (!vt(_e, ve, n.clientX, n.clientY)) {
        const m = ze(_e, ve), A = ze(n.clientX, n.clientY), M = bt(
          m.x,
          m.y,
          A.x,
          A.y,
          T,
          E,
          _,
          u,
          {
            invertHorizontalPan: e.get("invert_horizontal_pan") !== !1,
            scales: a,
            rotationRad: L
          }
        );
        M && (T = M.viewRA, E = M.viewDec);
      }
      o && G(), _e = n.clientX, ve = n.clientY, Oe = !0, requestAnimationFrame(S);
    }), window.addEventListener("mouseup", (n) => {
      if (re) {
        if (re = !1, b.style.display = "none", Math.sqrt((n.clientX - xe) ** 2 + (n.clientY - ye) ** 2) < 5) return;
        const a = s.getBoundingClientRect(), p = n.clientX - a.left, m = n.clientY - a.top, A = (V + p) / 2 / a.width * 2 - 1, M = -((Y + m) / 2 / a.height * 2 - 1), R = We(
          a.left + (V + p) / 2,
          a.top + (Y + m) / 2
        );
        if (!R) return;
        T = R.ra, E = R.dec;
        const X = Math.max(
          Math.abs(p - V) / a.width,
          Math.abs(m - Y) / a.height
        ), k = _ * 0.5;
        _ = 2 * Math.asin(Math.min(1, X * Math.sin(k))), _ = Ie(_), ue(), Ye({ pushToAladin: !0 });
        return;
      }
      if (j || oe)
        if (j = !1, oe = !1, h.style.cursor = Ce === "pan" ? "grab" : "crosshair", Math.sqrt((n.clientX - xe) ** 2 + (n.clientY - ye) ** 2) < 3) {
          const a = xt(n.clientX, n.clientY);
          if (!a) return;
          const p = (a.ra / g % 360 + 360) % 360, m = a.dec / g;
          e.set("clicked_coord", [p, m]);
          try {
            let He = NaN, rt = NaN;
            if (o != null && o.pix2world) {
              const ct = pe(n.clientX, n.clientY), ce = o.pix2world(ct.x, ct.y);
              Array.isArray(ce) && isFinite(ce[0]) && isFinite(ce[1]) && (He = (ce[0] % 360 + 360) % 360, rt = ce[1]);
            }
            let it = NaN, at = NaN;
            const qe = We(n.clientX, n.clientY);
            qe && (it = (qe.ra / g % 360 + 360) % 360, at = qe.dec / g), e.set("clicked_coord_debug", [He, rt, it, at]);
          } catch {
            e.set("clicked_coord_debug", [NaN, NaN, NaN, NaN]);
          }
          const A = a.ra - q[0], M = Math.sin(a.dec), R = Math.cos(a.dec), X = Math.sin(q[1]), k = Math.cos(q[1]), ae = R * Math.sin(A), we = M * k - R * X * Math.cos(A);
          e.set("clicked_lm", [ae, we]);
          const ot = e.get("click_tick");
          e.set("click_tick", (ot ?? 0) + 1), e.save_changes(), le = -999, Re = -999, ie = a.ra, se = a.dec, o && Ue(), requestAnimationFrame(S);
        } else
          ue(), Ye({ pushToAladin: !1 });
    }), h.addEventListener("wheel", (n) => {
      n.preventDefault(), _ *= n.deltaY > 0 ? 1.1 : 1 / 1.1, _ = Ie(_), ue(), o ? (o.setFoV(_ / g), requestAnimationFrame(() => Ye({ pushToAladin: !1 }))) : requestAnimationFrame(S);
    }, { passive: !1 }), new ResizeObserver(() => {
      const n = s.getBoundingClientRect(), u = window.devicePixelRatio || 1;
      h.width = n.width * u, h.height = n.height * u, G(), S();
    }).observe(s);
  } catch (x) {
    r("ERROR: " + x.message), r(x.stack);
  }
}
function It(e) {
  const l = e / 15, r = Math.floor(l), i = Math.floor((l - r) * 60), c = ((l - r) * 60 - i) * 60;
  return r + "h" + String(i).padStart(2, "0") + "m" + c.toFixed(1).padStart(4, "0") + "s";
}
function kt(e) {
  const l = e >= 0 ? "+" : "-", r = Math.abs(e), i = Math.floor(r), c = Math.floor((r - i) * 60), o = ((r - i) * 60 - c) * 60;
  return l + i + "°" + String(c).padStart(2, "0") + "'" + o.toFixed(1).padStart(4, "0") + '"';
}
export {
  Ut as render
};
//# sourceMappingURL=widget.js.map
