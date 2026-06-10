const h = Math.PI / 180;
function Dt(t, s) {
  let o, r;
  return s >= 1 ? (o = t, r = t / s) : (r = t, o = t * s), {
    fovWidth: o,
    fovHeight: r,
    scaleX: Math.sin(o * 0.5),
    scaleY: Math.sin(r * 0.5)
  };
}
function jt(t, s, o, r, c) {
  if (!(t != null && t.pix2world) || s < 2 || o < 2) return null;
  if (r == null || c == null) {
    const [F, v] = t.getRaDec();
    r = F * h, c = v * h;
  }
  const a = s * 0.5, f = o * 0.5, l = Math.max(4, s * 0.02), g = Math.max(4, o * 0.02);
  function d(F, v) {
    const [X, e] = t.pix2world(F, v);
    return $t(X * h, e * h, r, c);
  }
  const y = d(a + l, f).l, A = d(a - l, f).l, C = d(a, f - g).m, M = d(a, f + g).m, K = 4 * l / s, W = 4 * g / o, U = Math.abs(y - A) / K, b = Math.abs(C - M) / W;
  return !Number.isFinite(U) || !Number.isFinite(b) || U < 1e-15 || b < 1e-15 ? null : { scaleX: U, scaleY: b };
}
function Kt(t, s, o) {
  return (o == null ? void 0 : o.scaleX) > 0 && (o == null ? void 0 : o.scaleY) > 0 ? o : Dt(t, s);
}
function Zt(t, s, o, r, c = 0) {
  const a = -t * o, f = s * r;
  if (c === 0) return { l: a, m: f };
  const l = Math.cos(c), g = Math.sin(c);
  return {
    l: a * l + f * g,
    m: -a * g + f * l
  };
}
function $t(t, s, o, r) {
  const c = t - o, a = Math.sin(s), f = Math.cos(s), l = Math.sin(r), g = Math.cos(r), d = Math.cos(c), y = a * l + f * g * d, A = f * Math.sin(c), C = a * g - f * l * d;
  return { l: A, m: C, visible: y > 0 };
}
function Jt(t, s, o, r) {
  const c = Math.sqrt(t * t + s * s);
  if (c > 1) return null;
  const a = Math.sin(r), f = Math.cos(r);
  let l, g;
  if (c === 0)
    l = r, g = o;
  else {
    const d = Math.sqrt(1 - c * c);
    l = Math.asin(d * a + s * f / c * c);
    const y = c;
    l = Math.asin(d * a + s * f * y / c), g = o + Math.atan2(t * y, c * f * d - s * a * y);
  }
  return { ra: g, dec: l };
}
function dt(t, s, o, r, c, a, f = null, l = 0) {
  const { scaleX: g, scaleY: d } = Kt(c, a, f), { l: y, m: A } = Zt(t, s, g, d, l);
  return Math.hypot(y, A) > 1 ? null : Jt(y, A, o, r);
}
function Qt(t, s, o, r, c, a, f, l, g = {}) {
  const d = g.scales ?? null, y = g.rotationRad ?? 0, A = dt(t, s, c, a, f, l, d, y), C = dt(o, r, c, a, f, l, d, y);
  if (!A || !C) return null;
  let M = A.ra - C.ra;
  M > Math.PI && (M -= 2 * Math.PI), M < -Math.PI && (M += 2 * Math.PI);
  const K = g.invertHorizontalPan === !1 ? 1 : -1, W = -Math.PI / 2 + 1e-3, U = Math.PI / 2 - 1e-3;
  return {
    viewRA: c + K * M,
    viewDec: Math.max(W, Math.min(U, a + A.dec - C.dec))
  };
}
function te() {
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
    let r = 0;
    for (let l = 0; l < t.length - 1; l++) o >= t[l][0] && (r = l);
    const c = Math.min(r + 1, t.length - 1), a = t[c][0] - t[r][0] || 1, f = (o - t[r][0]) / a;
    s[o * 4] = t[r][1] + f * (t[c][1] - t[r][1]) | 0, s[o * 4 + 1] = t[r][2] + f * (t[c][2] - t[r][2]) | 0, s[o * 4 + 2] = t[r][3] + f * (t[c][3] - t[r][3]) | 0, s[o * 4 + 3] = 255;
  }
  return s;
}
const ee = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0, 1); }
`, ne = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform sampler2D u_cmap;
uniform vec2 u_crval, u_cdelt, u_crpix, u_imageSize, u_viewCenter, u_resolution;
uniform vec2 u_viewScale;
uniform float u_viewRotation, u_fov, u_opacity;
uniform int u_stretch, u_showGrid;
uniform vec2 u_crosshair;  // clicked position (RA, Dec) in radians; (-999,-999) = none
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
    // Crosshair at clicked position
    if (u_crosshair.x > -900.0) {
        float angDist = acos(clamp(
            sin(dec)*sin(u_crosshair.y) + cos(dec)*cos(u_crosshair.y)*cos(ra - u_crosshair.x),
            -1.0, 1.0));
        float crossSize = fovDeg * 0.015 * 0.0174533;  // size in radians
        float crossWidth = fovDeg * 0.002 * 0.0174533;
        // Draw a "+" shape
        float dra2 = abs(ra - u_crosshair.x);
        if (dra2 > 3.14159) dra2 = 6.28318 - dra2;
        float ddec2 = abs(dec - u_crosshair.y);
        bool onH = ddec2 < crossWidth && dra2*cos(u_crosshair.y) < crossSize;
        bool onV = dra2*cos(u_crosshair.y) < crossWidth && ddec2 < crossSize;
        if (onH || onV) {
            fragColor.rgb = vec3(0.0, 1.0, 1.0);  // cyan crosshair
            fragColor.a = 1.0;
        }
    }
    // Premultiply alpha for correct compositing with background
    fragColor.rgb *= fragColor.a;
}
`;
function Vt(t, s, o) {
  const r = t.createShader(s);
  if (t.shaderSource(r, o), t.compileShader(r), !t.getShaderParameter(r, t.COMPILE_STATUS)) {
    const c = t.getShaderInfoLog(r);
    throw t.deleteShader(r), new Error("Shader: " + c);
  }
  return r;
}
function oe(t) {
  const s = Vt(t, t.VERTEX_SHADER, ee), o = Vt(t, t.FRAGMENT_SHADER, ne), r = t.createProgram();
  if (t.attachShader(r, s), t.attachShader(r, o), t.linkProgram(r), !t.getProgramParameter(r, t.LINK_STATUS))
    throw new Error("Link: " + t.getProgramInfoLog(r));
  return r;
}
function re(t, s, o) {
  const r = t.length, c = new Uint8Array(r * 4), a = o - s || 1e-30;
  for (let f = 0; f < r; f++) {
    const l = t[f];
    if (l !== l || !isFinite(l)) {
      c[f * 4 + 3] = 0;
      continue;
    }
    let g = (l - s) / a;
    g = g < 0 ? 0 : g > 1 ? 1 : g, c[f * 4] = g * 255 + 0.5 | 0, c[f * 4 + 3] = 255;
  }
  return c;
}
const bt = {
  DSS: "CDS/P/DSS2/color",
  "2MASS": "CDS/P/2MASS/color",
  WISE: "CDS/P/allWISE/color",
  Planck: "CDS/P/PLANCK/R2/HFI/color",
  SDSS: "CDS/P/SDSS9/color",
  Mellinger: "CDS/P/Mellinger/color",
  Fermi: "CDS/P/Fermi/color",
  Haslam408: "CDS/P/HI4PI/NHI"
}, Gt = {
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
}, ae = [
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
function ie(t) {
  const s = "astrowidget-aladin-control-layer";
  if (t.querySelector(`#${s}`)) return;
  const o = document.createElement("style");
  o.id = s, o.textContent = `
    .astrowidget-aladin-bg ${ae} {
      z-index: 0 !important;
      pointer-events: none !important;
    }
  `, t.appendChild(o);
}
function Ot(t, s) {
  t.classList.add("astrowidget-aladin-bg"), ie(s);
}
async function ue({ model: t, el: s }) {
  function o(v) {
    console.log("[astrowidget]", v);
  }
  function r() {
    const v = t.get("background_cut_min"), X = t.get("background_cut_max");
    if (!a || !Number.isFinite(v) || !Number.isFinite(X)) return;
    let e = 0;
    function Y() {
      var Q;
      e += 1;
      try {
        const k = (Q = a.getBaseImageLayer) == null ? void 0 : Q.call(a);
        if (k != null && k.setCuts) {
          k.setCuts(v, X), o("Background cuts: " + v + " .. " + X);
          return;
        }
      } catch (k) {
        o("Background setCuts pending: " + k.message);
      }
      e < 25 && setTimeout(Y, Math.min(100 * e, 1e3));
    }
    Y();
  }
  let c = null, a = null;
  const f = t.get("background_survey");
  if (f)
    try {
      c = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await c.init, o("Aladin Lite loaded");
    } catch (v) {
      o("Aladin Lite load failed: " + v.message);
    }
  const l = document.createElement("div");
  l.style.cssText = "position:relative;width:100%;height:600px;background:" + (f && c ? "transparent" : "#000"), s.appendChild(l);
  const g = document.createElement("div");
  g.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:0", f && c && (Ot(g, l), l.appendChild(g));
  const d = document.createElement("canvas");
  d.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:1", l.appendChild(d);
  const y = document.createElement("div");
  y.style.cssText = "position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:4px", l.appendChild(y);
  const A = "padding:4px 10px;font:12px sans-serif;border:1px solid #888;border-radius:3px;cursor:pointer;color:#fff;background:rgba(0,0,0,0.6)", C = A + ";background:rgba(70,130,255,0.8);border-color:#7af";
  function M(v, X) {
    const e = document.createElement("button");
    return e.textContent = v, e.title = X, e.style.cssText = A, y.appendChild(e), e;
  }
  const K = M("↺", "Reset view to initial position"), W = M("✥", "Pan mode (drag to rotate)"), U = M("⬚", "Box zoom (drag to select region)"), b = document.createElement("div");
  b.style.cssText = "position:absolute;border:2px dashed #7af;background:rgba(70,130,255,0.15);pointer-events:none;z-index:2;display:none", l.appendChild(b);
  const F = document.createElement("div");
  F.style.cssText = "position:absolute;bottom:8px;left:8px;color:#fff;font:13px monospace;text-shadow:0 0 4px #000;pointer-events:none;z-index:2", l.appendChild(F);
  try {
    let xt = function(n) {
      pt = n, W.style.cssText = n === "pan" ? C : A, U.style.cssText = n === "boxzoom" ? C : A, d.style.cursor = n === "pan" ? "grab" : "crosshair";
    }, yt = function() {
      if (!nt) return;
      const n = re(nt, St, Ct);
      e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, At), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, tt, et, 0, e.RGBA, e.UNSIGNED_BYTE, n);
    }, Z = function() {
      const n = a == null ? void 0 : a.view, u = (n == null ? void 0 : n.width) ?? d.clientWidth, i = (n == null ? void 0 : n.height) ?? d.clientHeight;
      return u / Math.max(i, 1);
    }, at = function() {
      const n = Dt(m, Z());
      return B ? {
        ...n,
        scaleX: n.scaleX * B.kx,
        scaleY: n.scaleY * B.ky
      } : n;
    }, Lt = function() {
      if (!(a != null && a.getRotation)) {
        q = 0;
        return;
      }
      q = -a.getRotation() * h;
    }, it = function() {
      if (!a) {
        B = null;
        return;
      }
      const n = Z(), u = Dt(m, n), i = a.view, _ = (i == null ? void 0 : i.width) ?? g.clientWidth, p = (i == null ? void 0 : i.height) ?? g.clientHeight, [, x] = a.getRaDec();
      if (Math.abs(x) > 75) {
        B || (B = { kx: 1, ky: 1 });
        return;
      }
      const R = jt(a, _, p);
      if (!R) {
        B = { kx: 1, ky: 1 };
        return;
      }
      B = {
        kx: R.scaleX / u.scaleX,
        ky: R.scaleY / u.scaleY
      };
    }, E = function() {
      e.viewport(0, 0, d.width, d.height), e.clearColor(0, 0, 0, 0), e.clear(e.COLOR_BUFFER_BIT), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE_MINUS_SRC_ALPHA), e.useProgram(Y), e.uniform1i(D.u_image, 0), e.uniform1i(D.u_cmap, 1), e.uniform2f(D.u_crval, H[0], H[1]), e.uniform2f(D.u_cdelt, ht[0], ht[1]), e.uniform2f(D.u_crpix, gt[0], gt[1]), e.uniform2f(D.u_imageSize, tt, et), e.uniform2f(D.u_viewCenter, w, T);
      const n = at();
      e.uniform2f(D.u_viewScale, n.scaleX, n.scaleY), Lt(), e.uniform1f(D.u_viewRotation, q), e.uniform1f(D.u_fov, m), e.uniform1f(D.u_opacity, Mt), e.uniform1i(D.u_stretch, Pt), e.uniform1i(D.u_showGrid, It), e.uniform2f(D.u_crosshair, Xt, kt), e.uniform2f(D.u_resolution, d.width, d.height), e.drawArrays(e.TRIANGLES, 0, 6);
    }, ct = function() {
      const n = t.get("image_data"), u = t.get("image_shape");
      if (!n || !u || u[0] === 0) return;
      const i = n.byteLength || n.length;
      i !== 0 && (et = u[0], tt = u[1], nt = new Float32Array(n.buffer.slice(n.byteOffset, n.byteOffset + i)), o("Image: " + tt + "x" + et + ", " + nt.length + " floats"), yt());
    }, j = function() {
      const n = t.get("crval"), u = t.get("cdelt"), i = t.get("crpix");
      n && (H = [n[0] * h, n[1] * h]), u && (ht = [u[0] * h, u[1] * h]), i && (gt = [i[0], i[1]]);
    }, $ = function() {
      N || (w = (t.get("view_ra") || 0) * h, T = (t.get("view_dec") || 0) * h, m = (t.get("view_fov") || 180) * h);
    }, z = function() {
      St = t.get("vmin") || 0, Ct = t.get("vmax") || 1, Mt = t.get("opacity") ?? 1, Pt = Ht[t.get("stretch")] || 0, It = t.get("show_grid") === !1 ? 0 : 1;
    }, Ut = function() {
      z(), ct(), j(), $(), E();
    }, O = function(n = !0) {
      if (!a) return;
      const u = m / h;
      if (n) {
        const i = (w / h % 360 + 360) % 360, _ = T / h;
        a.gotoRaDec(i, _);
      }
      a.setFoV(u), it();
    }, Ft = function(n, u) {
      const i = g.getBoundingClientRect(), _ = a.view, p = (_ == null ? void 0 : _.width) ?? i.width, x = (_ == null ? void 0 : _.height) ?? i.height;
      return {
        x: (n - i.left) * (p / i.width),
        y: (u - i.top) * (x / i.height)
      };
    }, qt = function(n, u, i, _) {
      var ft;
      const p = (ft = a == null ? void 0 : a.view) == null ? void 0 : ft.wasm;
      if (!(p != null && p.goFromTo)) return !1;
      let { x, y: R } = Ft(n, u), { x: S, y: I } = Ft(i, _);
      t.get("invert_horizontal_pan") === !1 && ([x, S] = [S, x]), p.goFromTo(x, R, S, I), a.view.updateCenter();
      const [L, J] = a.getRaDec();
      return w = L * h, T = J * h, Lt(), !0;
    }, Nt = function() {
      st++, Ut();
      const n = t.get("image_data");
      if (n && (n.byteLength || n.length) > 0) {
        o("Data arrived after " + st + " poll(s)"), requestAnimationFrame(E), O(), mt = w, _t = T, vt = m;
        return;
      }
      st < Bt ? setTimeout(Nt, Math.min(100 * Math.pow(1.5, st - 1), 1e3)) : (o("No image data after " + Bt + " polls — waiting for change event"), O(), mt = w, _t = T, vt = m);
    }, Rt = function(n, u) {
      const i = d.getBoundingClientRect();
      return {
        x: (n - i.left) / i.width * 2 - 1,
        y: -((u - i.top) / i.height * 2 - 1)
      };
    }, zt = function(n, u) {
      const { x: i, y: _ } = Rt(n, u);
      return dt(
        i,
        _,
        w,
        T,
        m,
        Z(),
        at(),
        q
      );
    };
    const v = l.getBoundingClientRect(), X = window.devicePixelRatio || 1;
    d.width = (v.width || 800) * X, d.height = (v.height || 600) * X;
    const e = d.getContext("webgl2", { alpha: !0, premultipliedAlpha: !0, preserveDrawingBuffer: !0 });
    if (!e) {
      o("FAIL: No WebGL2");
      return;
    }
    o("WebGL2: " + e.getParameter(e.RENDERER));
    const Y = oe(e);
    o("Shader compiled OK"), e.useProgram(Y);
    const Q = e.createBuffer();
    e.bindBuffer(e.ARRAY_BUFFER, Q), e.bufferData(e.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), e.STATIC_DRAW);
    const k = e.getAttribLocation(Y, "a_pos");
    e.enableVertexAttribArray(k), e.vertexAttribPointer(k, 2, e.FLOAT, !1, 0, 0);
    const D = {};
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
      "u_crosshair",
      "u_resolution"
    ].forEach(
      (n) => D[n] = e.getUniformLocation(Y, n)
    );
    const Wt = e.createTexture();
    e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, Wt), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 256, 1, 0, e.RGBA, e.UNSIGNED_BYTE, te()), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), o("Colormap texture OK");
    const At = e.createTexture();
    e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, At), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, 1, 1, 0, e.RGBA, e.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE);
    let tt = 1, et = 1, nt = null, H = [0, 0], ht = [1, 1], gt = [0, 0], w = 0, T = 0, m = Math.PI, B = null, q = 0, St = 0, Ct = 1, Mt = 1, Pt = 0, It = 1, ot = !1, N = !1, P = null, Xt = -999, kt = -999;
    const Ht = { linear: 0, log: 1, sqrt: 2, asinh: 3 };
    let pt = "pan", mt = 0, _t = 0, vt = Math.PI, V = 0, G = 0, rt = !1;
    if (xt("pan"), W.addEventListener("click", () => xt("pan")), U.addEventListener("click", () => xt("boxzoom")), K.addEventListener("click", () => {
      N = !0, w = mt, T = _t, m = vt, t.set("view_ra", w / h), t.set("view_dec", T / h), t.set("view_fov", m / h), t.save_changes(), O(), E(), P && clearTimeout(P), P = setTimeout(() => {
        N = !1;
      }, 500);
    }), t.on("change:image_data", () => {
      z(), ct(), j();
    }), t.on("change:image_shape", () => {
      ct();
    }), t.on("change:crval", () => {
      j();
    }), t.on("change:cdelt", () => {
      j();
    }), t.on("change:crpix", () => {
      j();
    }), t.on("change:vmin", () => {
      z(), yt();
    }), t.on("change:vmax", () => {
      z(), yt();
    }), t.on("change:image_revision", () => {
      z(), ct(), j(), $(), E();
    }), t.on("change:view_ra", () => {
      $(), E();
    }), t.on("change:view_dec", () => {
      $(), E();
    }), t.on("change:view_fov", () => {
      $(), E();
    }), t.on("change:opacity", () => {
      z(), E();
    }), t.on("change:stretch", () => {
      z(), E();
    }), t.on("change:show_grid", () => {
      z(), E();
    }), t.on("change:background_survey", () => {
      const n = t.get("background_survey");
      l.style.background = n ? "transparent" : "#000", E();
    }), c && f) {
      const n = bt[f] || f, u = (w / h % 360 + 360) % 360, i = T / h, _ = m / h;
      a = c.aladin(g, {
        fov: _ || 180,
        target: u + " " + i,
        survey: n,
        ...Gt
      }), o("Aladin viewer created: " + f), r(), it();
    }
    t.on("change:background_survey", async () => {
      const n = t.get("background_survey");
      if (n && a) {
        const u = bt[n] || n;
        a.setBaseImageLayer(u), l.style.background = "transparent", r();
      } else if (n && !a && !c)
        try {
          c = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await c.init, Ot(g, l), l.appendChild(g), l.style.background = "transparent";
          const i = bt[n] || n;
          a = c.aladin(g, {
            fov: m / h || 180,
            target: (w / h % 360 + 360) % 360 + " " + T / h,
            survey: i,
            ...Gt
          }), o("Aladin loaded on demand: " + n), r(), it();
        } catch (u) {
          o("Aladin load failed: " + u.message);
        }
      else n || (l.style.background = "#000", g.style.display = "none");
      E();
    }), t.on("change:background_cut_min", () => {
      r();
    }), t.on("change:background_cut_max", () => {
      r();
    }), Ut();
    let st = 0;
    const Bt = 30;
    setTimeout(Nt, 50);
    let lt = 0, ut = 0, wt = 0, Tt = 0, Et = !1;
    d.style.cursor = "grab", d.addEventListener("mousedown", (n) => {
      if (N = !0, P && (clearTimeout(P), P = null), wt = n.clientX, Tt = n.clientY, Et = !1, pt === "boxzoom") {
        rt = !0;
        const u = l.getBoundingClientRect();
        V = n.clientX - u.left, G = n.clientY - u.top, b.style.left = V + "px", b.style.top = G + "px", b.style.width = "0", b.style.height = "0", b.style.display = "block";
      } else
        ot = !0, lt = n.clientX, ut = n.clientY, d.style.cursor = "grabbing";
    }), window.addEventListener("mousemove", (n) => {
      if (rt) {
        const p = l.getBoundingClientRect(), x = n.clientX - p.left, R = n.clientY - p.top, S = Math.min(V, x), I = Math.min(G, R), L = Math.abs(x - V), J = Math.abs(R - G);
        b.style.left = S + "px", b.style.top = I + "px", b.style.width = L + "px", b.style.height = J + "px", Et = !0;
        return;
      }
      if (!ot) {
        const p = d.getBoundingClientRect(), x = (n.clientX - p.left) / p.width * 2 - 1, R = -((n.clientY - p.top) / p.height * 2 - 1), S = Z(), I = dt(
          x,
          R,
          w,
          T,
          m,
          S,
          at(),
          q
        );
        if (I) {
          const L = (I.ra / h % 360 + 360) % 360;
          F.textContent = ce(L) + "  " + se(I.dec / h);
        } else
          F.textContent = "";
        return;
      }
      const u = Z(), i = at();
      if (!qt(lt, ut, n.clientX, n.clientY)) {
        const p = Rt(lt, ut), x = Rt(n.clientX, n.clientY), R = Qt(
          p.x,
          p.y,
          x.x,
          x.y,
          w,
          T,
          m,
          u,
          {
            invertHorizontalPan: t.get("invert_horizontal_pan") !== !1,
            scales: i,
            rotationRad: q
          }
        );
        R && (w = R.viewRA, T = R.viewDec), O();
      }
      lt = n.clientX, ut = n.clientY, Et = !0, requestAnimationFrame(E);
    }), window.addEventListener("mouseup", (n) => {
      if (rt) {
        if (rt = !1, b.style.display = "none", P = setTimeout(() => {
          N = !1;
        }, 500), Math.sqrt((n.clientX - wt) ** 2 + (n.clientY - Tt) ** 2) < 5) return;
        const i = l.getBoundingClientRect(), _ = n.clientX - i.left, p = n.clientY - i.top, x = (V + _) / 2 / i.width * 2 - 1, R = -((G + p) / 2 / i.height * 2 - 1), S = zt(
          i.left + (V + _) / 2,
          i.top + (G + p) / 2
        );
        if (!S) return;
        w = S.ra, T = S.dec;
        const I = Math.max(
          Math.abs(_ - V) / i.width,
          Math.abs(p - G) / i.height
        ), L = m * 0.5;
        m = 2 * Math.asin(Math.min(1, I * Math.sin(L))), m = Math.max(1e-3 * h, Math.min(Math.PI, m)), t.set("view_ra", w / h), t.set("view_dec", T / h), t.set("view_fov", m / h), t.save_changes(), O(), E();
        return;
      }
      if (ot)
        if (ot = !1, d.style.cursor = pt === "pan" ? "grab" : "crosshair", P = setTimeout(() => {
          N = !1;
        }, 500), Math.sqrt((n.clientX - wt) ** 2 + (n.clientY - Tt) ** 2) < 3) {
          const i = zt(n.clientX, n.clientY);
          if (!i) return;
          const _ = (i.ra / h % 360 + 360) % 360, p = i.dec / h;
          t.set("clicked_coord", [_, p]);
          const x = i.ra - H[0], R = Math.sin(i.dec), S = Math.cos(i.dec), I = Math.sin(H[1]), L = Math.cos(H[1]), J = S * Math.sin(x), ft = R * L - S * I * Math.cos(x);
          t.set("clicked_lm", [J, ft]);
          const Yt = t.get("click_tick");
          t.set("click_tick", (Yt ?? 0) + 1), t.save_changes(), Xt = i.ra, kt = i.dec, requestAnimationFrame(E);
        } else
          t.set("view_ra", w / h), t.set("view_dec", T / h), t.save_changes(), O();
    }), d.addEventListener("wheel", (n) => {
      n.preventDefault(), N = !0, P && clearTimeout(P), m *= n.deltaY > 0 ? 1.1 : 1 / 1.1, m = Math.max(1e-3 * h, Math.min(Math.PI, m)), t.set("view_fov", m / h), t.save_changes(), O(), requestAnimationFrame(E), P = setTimeout(() => {
        N = !1;
      }, 500);
    }, { passive: !1 }), new ResizeObserver(() => {
      const n = l.getBoundingClientRect(), u = window.devicePixelRatio || 1;
      d.width = n.width * u, d.height = n.height * u, it(), E();
    }).observe(l);
  } catch (v) {
    o("ERROR: " + v.message), o(v.stack);
  }
}
function ce(t) {
  const s = t / 15, o = Math.floor(s), r = Math.floor((s - o) * 60), c = ((s - o) * 60 - r) * 60;
  return o + "h" + String(r).padStart(2, "0") + "m" + c.toFixed(1).padStart(4, "0") + "s";
}
function se(t) {
  const s = t >= 0 ? "+" : "-", o = Math.abs(t), r = Math.floor(o), c = Math.floor((o - r) * 60), a = ((o - r) * 60 - c) * 60;
  return s + r + "°" + String(c).padStart(2, "0") + "'" + a.toFixed(1).padStart(4, "0") + '"';
}
export {
  ue as render
};
//# sourceMappingURL=widget.js.map
