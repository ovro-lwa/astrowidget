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
    const [H, N] = t.pix2world(e, F), { l: x, m: J } = he(H * g, N * g, i, c);
    return o === 0 ? { l0: x, m0: J } : { l0: x * v - J * w, m0: x * w + J * v };
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
function Et(t, l, r, i, c, o, f = null, s = 0) {
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
  const h = d.scales ?? null, v = d.rotationRad ?? 0, w = Et(t, l, c, o, f, s, h, v), D = Et(r, i, c, o, f, s, h, v);
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
}, Ne = [
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
    }
    F();
  }
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
      Rt && clearTimeout(Rt), bt = !0, Rt = setTimeout(() => {
        bt = !1;
      }, 500);
    }, lt = function() {
      pe(), t.set("view_ra", T / g), t.set("view_dec", E / g), t.set("view_fov", _ / g), t.save_changes();
    }, ut = function() {
      return !bt && !j && !ot;
    }, Xt = function(n) {
      Mt = n, O.style.cssText = n === "pan" ? D : w, z.style.cssText = n === "boxzoom" ? D : w, h.style.cursor = n === "pan" ? "grab" : "crosshair";
    }, It = function() {
      if (!et) return;
      const n = Fe(et, Kt, Zt);
      e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Dt), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, Q, tt, 0, e.RGBA, e.UNSIGNED_BYTE, n);
    }, K = function() {
      const n = o == null ? void 0 : o.view, u = (n == null ? void 0 : n.width) ?? h.clientWidth, a = (n == null ? void 0 : n.height) ?? h.clientHeight;
      return u / Math.max(a, 1);
    }, ft = function() {
      return I || fe(_, K());
    }, Lt = function(n) {
      const u = 1e-3 * g, a = xe(K());
      return Math.max(u, Math.min(a, n));
    }, kt = function() {
      if (!(o != null && o.getRaDec)) return;
      const [n, u] = o.getRaDec();
      if (T = n * g, E = u * g, typeof o.getFov == "function") {
        const a = o.getFov(), p = Array.isArray(a) ? a[0] : a, m = Array.isArray(a) ? a[1] : p;
        _ = Math.max(p, m) * g;
      }
      dt();
    }, dt = function() {
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
    }, Ut = function() {
      o && (kt(), I = null, G());
    }, b = function() {
      o && (dt(), G()), e.viewport(0, 0, h.width, h.height), e.clearColor(0, 0, 0, 0), e.clear(e.COLOR_BUFFER_BIT), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE_MINUS_SRC_ALPHA), e.useProgram(F), e.uniform1i(x.u_image, 0), e.uniform1i(x.u_cmap, 1), e.uniform2f(x.u_crval, q[0], q[1]), e.uniform2f(x.u_cdelt, At[0], At[1]), e.uniform2f(x.u_crpix, St[0], St[1]), e.uniform2f(x.u_imageSize, Q, tt), e.uniform2f(x.u_viewCenter, T, E);
      const n = ft();
      e.uniform2f(x.u_viewScale, n.scaleX, n.scaleY), dt(), e.uniform1f(x.u_viewRotation, k), e.uniform1f(x.u_fov, _), e.uniform1f(x.u_opacity, $t), e.uniform1i(x.u_stretch, Jt), e.uniform1i(x.u_showGrid, Qt);
      let u = -999, a = -999;
      if (st > -900)
        u = st, a = Ct;
      else if (rt > -900) {
        const p = Ae(
          rt,
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
      et = null, Q = 1, tt = 1, e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Dt), e.texImage2D(
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
      const n = t.get("image_data"), u = t.get("image_shape"), a = n ? n.byteLength || n.length : 0;
      if (!n || !u || u[0] === 0 || a === 0) {
        me();
        return;
      }
      tt = u[0], Q = u[1], et = new Float32Array(n.buffer.slice(n.byteOffset, n.byteOffset + a)), r("Image: " + Q + "x" + tt + ", " + et.length + " floats"), It();
    }, Z = function() {
      const n = t.get("crval"), u = t.get("cdelt"), a = t.get("crpix");
      n && (q = [n[0] * g, n[1] * g]), u && (At = [u[0] * g, u[1] * g]), a && (St = [a[0], a[1]]);
    }, gt = function() {
      T = (t.get("view_ra") || 0) * g, E = (t.get("view_dec") || 0) * g, _ = (t.get("view_fov") || 180) * g;
    }, _e = function() {
      ut() && gt();
    }, U = function() {
      Kt = t.get("vmin") || 0, Zt = t.get("vmax") || 1, $t = t.get("opacity") ?? 1, Jt = ge[t.get("stretch")] || 0, Qt = t.get("show_grid") === !1 ? 0 : 1;
    }, pt = function() {
      Bt || (Bt = !0, requestAnimationFrame(() => {
        Bt = !1, b();
      }));
    }, Vt = function() {
      const n = t.get("crosshair_ra"), u = t.get("crosshair_dec");
      typeof n != "number" || typeof u != "number" || n < -900 || u < -900 ? (rt = -999, ct = -999) : (rt = n * g, ct = u * g, st = -999, Ct = -999);
    }, te = function() {
      U(), ht(), Z(), _e(), Vt(), o && ut() && $(), b();
    }, Yt = function({ pushToAladin: n = !1 } = {}) {
      if (o && (n ? $() : (kt(), I = null, G())), b(), t.get("overlay_view_lock")) {
        const u = t.get("view_gesture_revision") || 0;
        t.set("view_gesture_revision", u + 1), t.save_changes();
      }
    }, Gt = function() {
      ut() && (gt(), I = null, $(), pt());
    }, $ = function(n = !0) {
      if (!o) return;
      _ = Lt(_);
      const u = _ / g;
      if (n) {
        const a = (T / g % 360 + 360) % 360, p = E / g;
        o.gotoRaDec(a, p);
      }
      o.setFoV(u), kt(), I = null, G();
    }, mt = function(n, u) {
      const a = d.getBoundingClientRect(), p = o.view, m = (p == null ? void 0 : p.width) ?? a.width, A = (p == null ? void 0 : p.height) ?? a.height;
      return {
        x: (n - a.left) * (m / a.width),
        y: (u - a.top) * (A / a.height)
      };
    }, ve = function(n, u, a, p) {
      var Tt;
      const m = (Tt = o == null ? void 0 : o.view) == null ? void 0 : Tt.wasm;
      if (!(m != null && m.goFromTo)) return !1;
      let { x: A, y: M } = mt(n, u), { x: R, y: X } = mt(a, p);
      t.get("invert_horizontal_pan") === !1 && ([A, R] = [R, A]), m.goFromTo(A, M, R, X), o.view.updateCenter();
      const [L, it] = o.getRaDec();
      return T = L * g, E = it * g, dt(), !0;
    }, ne = function() {
      _t++, te();
      const n = t.get("image_data");
      if (n && (n.byteLength || n.length) > 0) {
        r("Data arrived after " + _t + " poll(s)"), requestAnimationFrame(b), Pt = T, Ft = E, Nt = _;
        return;
      }
      _t < ee ? setTimeout(ne, Math.min(100 * Math.pow(1.5, _t - 1), 1e3)) : (r("No image data after " + ee + " polls — waiting for change event"), $(), Pt = T, Ft = E, Nt = _);
    }, zt = function(n, u) {
      const a = h.getBoundingClientRect();
      return {
        x: (n - a.left) / a.width * 2 - 1,
        y: -((u - a.top) / a.height * 2 - 1)
      };
    }, Wt = function(n, u) {
      const { x: a, y: p } = zt(n, u);
      return Et(
        a,
        p,
        T,
        E,
        _,
        K(),
        ft(),
        k
      );
    }, ye = function(n, u) {
      return be(
        n,
        u,
        o,
        mt,
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
      (n) => x[n] = e.getUniformLocation(F, n)
    );
    const J = e.createTexture();
    e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, J), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 256, 1, 0, e.RGBA, e.UNSIGNED_BYTE, Re()), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), r("Colormap texture OK");
    const Dt = e.createTexture();
    e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, Dt), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 1, 1, 0, e.RGBA, e.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE);
    let Q = 1, tt = 1, et = null, q = [0, 0], At = [1, 1], St = [0, 0], T = 0, E = 0, _ = Math.PI, I = null, k = 0, Kt = 0, Zt = 1, $t = 1, Jt = 0, Qt = 1, j = !1, nt = !1, ot = !1, bt = !1, Rt = null, rt = -999, ct = -999, st = -999, Ct = -999;
    const ge = { linear: 0, log: 1, sqrt: 2, asinh: 3 };
    let Mt = "pan", Pt = 0, Ft = 0, Nt = Math.PI, V = 0, Y = 0;
    Xt("pan"), O.addEventListener("click", () => Xt("pan")), z.addEventListener("click", () => Xt("boxzoom")), B.addEventListener("click", () => {
      T = Pt, E = Ft, _ = Nt, lt(), $(), b();
    });
    let Bt = !1;
    if (t.on("change:image_data", () => {
      U(), ht(), Z();
    }), t.on("change:image_shape", () => {
      ht();
    }), t.on("change:crval", () => {
      Z();
    }), t.on("change:cdelt", () => {
      Z();
    }), t.on("change:crpix", () => {
      Z();
    }), t.on("change:vmin", () => {
      U(), It();
    }), t.on("change:vmax", () => {
      U(), It();
    }), t.on("change:image_revision", () => {
      U(), ht(), Z(), t.get("overlay_view_lock") || (ut() ? (gt(), o && $()) : (I = null, o && G())), pt();
    }), t.on("change:crosshair_ra", () => {
      Vt(), pt();
    }), t.on("change:crosshair_dec", () => {
      Vt(), pt();
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
      gt();
      const n = jt[f] || f, u = (T / g % 360 + 360) % 360, a = E / g, p = _ / g;
      o = c.aladin(d, {
        fov: p || 180,
        target: u + " " + a,
        survey: n,
        ...le
      }), r("Aladin viewer created: " + f), i(), Ut();
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
          }), r("Aladin loaded on demand: " + n), i(), Ut();
        } catch (u) {
          r("Aladin load failed: " + u.message);
        }
      else n || (s.style.background = "#000", d.style.display = "none");
      b();
    }), t.on("change:background_cut_min", () => {
      i();
    }), t.on("change:background_cut_max", () => {
      i();
    }), te();
    let _t = 0;
    const ee = 30;
    setTimeout(ne, 50);
    let vt = 0, yt = 0, xt = 0, wt = 0, Ot = !1;
    h.style.cursor = "grab", h.addEventListener("mousedown", (n) => {
      if (xt = n.clientX, wt = n.clientY, Ot = !1, Mt === "boxzoom") {
        ot = !0;
        const u = s.getBoundingClientRect();
        V = n.clientX - u.left, Y = n.clientY - u.top, S.style.left = V + "px", S.style.top = Y + "px", S.style.width = "0", S.style.height = "0", S.style.display = "block";
      } else
        nt = !0, vt = n.clientX, yt = n.clientY, h.style.cursor = "grabbing";
    }), window.addEventListener("mousemove", (n) => {
      if (nt && !j) {
        if (Math.sqrt((n.clientX - xt) ** 2 + (n.clientY - wt) ** 2) < 3) return;
        nt = !1, j = !0;
      }
      if (ot) {
        const m = s.getBoundingClientRect(), A = n.clientX - m.left, M = n.clientY - m.top, R = Math.min(V, A), X = Math.min(Y, M), L = Math.abs(A - V), it = Math.abs(M - Y);
        S.style.left = R + "px", S.style.top = X + "px", S.style.width = L + "px", S.style.height = it + "px", Ot = !0;
        return;
      }
      if (!j) {
        const m = h.getBoundingClientRect(), A = (n.clientX - m.left) / m.width * 2 - 1, M = -((n.clientY - m.top) / m.height * 2 - 1), R = K(), X = Et(
          A,
          M,
          T,
          E,
          _,
          R,
          ft(),
          k
        );
        if (X) {
          const L = (X.ra / g % 360 + 360) % 360;
          W.textContent = Ie(L) + "  " + Le(X.dec / g);
        } else
          W.textContent = "";
        return;
      }
      const u = K(), a = ft();
      if (!ve(vt, yt, n.clientX, n.clientY)) {
        const m = zt(vt, yt), A = zt(n.clientX, n.clientY), M = Se(
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
      o && G(), vt = n.clientX, yt = n.clientY, Ot = !0, requestAnimationFrame(b);
    }), window.addEventListener("mouseup", (n) => {
      if (ot) {
        if (ot = !1, S.style.display = "none", Math.sqrt((n.clientX - xt) ** 2 + (n.clientY - wt) ** 2) < 5) return;
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
        _ = 2 * Math.asin(Math.min(1, X * Math.sin(L))), _ = Lt(_), lt(), Yt({ pushToAladin: !0 });
        return;
      }
      if (j || nt)
        if (j = !1, nt = !1, h.style.cursor = Mt === "pan" ? "grab" : "crosshair", Math.sqrt((n.clientX - xt) ** 2 + (n.clientY - wt) ** 2) < 3) {
          const a = ye(n.clientX, n.clientY);
          if (!a) return;
          const p = (a.ra / g % 360 + 360) % 360, m = a.dec / g;
          t.set("clicked_coord", [p, m]);
          try {
            let Ht = NaN, re = NaN;
            if (o != null && o.pix2world) {
              const ce = mt(n.clientX, n.clientY), at = o.pix2world(ce.x, ce.y);
              Array.isArray(at) && isFinite(at[0]) && isFinite(at[1]) && (Ht = (at[0] % 360 + 360) % 360, re = at[1]);
            }
            let ie = NaN, ae = NaN;
            const qt = Wt(n.clientX, n.clientY);
            qt && (ie = (qt.ra / g % 360 + 360) % 360, ae = qt.dec / g), t.set("clicked_coord_debug", [Ht, re, ie, ae]);
          } catch {
            t.set("clicked_coord_debug", [NaN, NaN, NaN, NaN]);
          }
          const A = a.ra - q[0], M = Math.sin(a.dec), R = Math.cos(a.dec), X = Math.sin(q[1]), L = Math.cos(q[1]), it = R * Math.sin(A), Tt = M * L - R * X * Math.cos(A);
          t.set("clicked_lm", [it, Tt]);
          const oe = t.get("click_tick");
          t.set("click_tick", (oe ?? 0) + 1), t.save_changes(), st = -999, Ct = -999, rt = a.ra, ct = a.dec, o && Ut(), requestAnimationFrame(b);
        } else
          lt(), Yt({ pushToAladin: !1 });
    }), h.addEventListener("wheel", (n) => {
      n.preventDefault(), _ *= n.deltaY > 0 ? 1.1 : 1 / 1.1, _ = Lt(_), lt(), o ? (o.setFoV(_ / g), requestAnimationFrame(() => Yt({ pushToAladin: !1 }))) : requestAnimationFrame(b);
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
};
//# sourceMappingURL=widget.js.map
