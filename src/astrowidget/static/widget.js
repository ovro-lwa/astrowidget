const i = Math.PI / 180;
function Ht() {
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
  ], u = new Uint8Array(256 * 4);
  for (let a = 0; a < 256; a++) {
    let n = 0;
    for (let s = 0; s < e.length - 1; s++) a >= e[s][0] && (n = s);
    const l = Math.min(n + 1, e.length - 1), g = e[l][0] - e[n][0] || 1, p = (a - e[n][0]) / g;
    u[a * 4] = e[n][1] + p * (e[l][1] - e[n][1]) | 0, u[a * 4 + 1] = e[n][2] + p * (e[l][2] - e[n][2]) | 0, u[a * 4 + 2] = e[n][3] + p * (e[l][3] - e[n][3]) | 0, u[a * 4 + 3] = 255;
  }
  return u;
}
const jt = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0, 1); }
`, Kt = `#version 300 es
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
function Ft(e, u, a) {
  const n = e.createShader(u);
  if (e.shaderSource(n, a), e.compileShader(n), !e.getShaderParameter(n, e.COMPILE_STATUS)) {
    const l = e.getShaderInfoLog(n);
    throw e.deleteShader(n), new Error("Shader: " + l);
  }
  return n;
}
function Zt(e) {
  const u = Ft(e, e.VERTEX_SHADER, jt), a = Ft(e, e.FRAGMENT_SHADER, Kt), n = e.createProgram();
  if (e.attachShader(n, u), e.attachShader(n, a), e.linkProgram(n), !e.getProgramParameter(n, e.LINK_STATUS))
    throw new Error("Link: " + e.getProgramInfoLog(n));
  return n;
}
function $t(e, u, a) {
  const n = e.length, l = new Uint8Array(n * 4), g = a - u || 1e-30;
  for (let p = 0; p < n; p++) {
    const s = e[p];
    if (s !== s || !isFinite(s)) {
      l[p * 4 + 3] = 0;
      continue;
    }
    let x = (s - u) / g;
    x = x < 0 ? 0 : x > 1 ? 1 : x, l[p * 4] = x * 255 + 0.5 | 0, l[p * 4 + 3] = 255;
  }
  return l;
}
const xt = {
  DSS: "CDS/P/DSS2/color",
  "2MASS": "CDS/P/2MASS/color",
  WISE: "CDS/P/allWISE/color",
  Planck: "CDS/P/PLANCK/R2/HFI/color",
  SDSS: "CDS/P/SDSS9/color",
  Mellinger: "CDS/P/Mellinger/color",
  Fermi: "CDS/P/Fermi/color",
  Haslam408: "CDS/P/HI4PI/NHI"
}, Bt = {
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
}, Jt = [
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
function Qt(e) {
  const u = "astrowidget-aladin-control-layer";
  if (e.querySelector(`#${u}`)) return;
  const a = document.createElement("style");
  a.id = u, a.textContent = `
    .astrowidget-aladin-bg ${Jt} {
      z-index: 0 !important;
      pointer-events: none !important;
    }
  `, e.appendChild(a);
}
function Nt(e, u) {
  e.classList.add("astrowidget-aladin-bg"), Qt(u);
}
async function oe({ model: e, el: u }) {
  function a(v) {
    console.log("[astrowidget]", v);
  }
  function n() {
    const v = e.get("background_cut_min"), L = e.get("background_cut_max");
    if (!g || !Number.isFinite(v) || !Number.isFinite(L)) return;
    let t = 0;
    function X() {
      var K;
      t += 1;
      try {
        const P = (K = g.getBaseImageLayer) == null ? void 0 : K.call(g);
        if (P != null && P.setCuts) {
          P.setCuts(v, L), a("Background cuts: " + v + " .. " + L);
          return;
        }
      } catch (P) {
        a("Background setCuts pending: " + P.message);
      }
      t < 25 && setTimeout(X, Math.min(100 * t, 1e3));
    }
    X();
  }
  let l = null, g = null;
  const p = e.get("background_survey");
  if (p)
    try {
      l = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await l.init, a("Aladin Lite loaded");
    } catch (v) {
      a("Aladin Lite load failed: " + v.message);
    }
  const s = document.createElement("div");
  s.style.cssText = "position:relative;width:100%;height:600px;background:" + (p && l ? "transparent" : "#000"), u.appendChild(s);
  const x = document.createElement("div");
  x.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:0", p && l && (Nt(x, s), s.appendChild(x));
  const d = document.createElement("canvas");
  d.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:1", s.appendChild(d);
  const at = document.createElement("div");
  at.style.cssText = "position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:4px", s.appendChild(at);
  const H = "padding:4px 10px;font:12px sans-serif;border:1px solid #888;border-radius:3px;cursor:pointer;color:#fff;background:rgba(0,0,0,0.6)", yt = H + ";background:rgba(70,130,255,0.8);border-color:#7af";
  function nt(v, L) {
    const t = document.createElement("button");
    return t.textContent = v, t.title = L, t.style.cssText = H, at.appendChild(t), t;
  }
  const Ot = nt("↺", "Reset view to initial position"), Et = nt("✥", "Pan mode (drag to rotate)"), wt = nt("⬚", "Box zoom (drag to select region)"), b = document.createElement("div");
  b.style.cssText = "position:absolute;border:2px dashed #7af;background:rgba(70,130,255,0.15);pointer-events:none;z-index:2;display:none", s.appendChild(b);
  const j = document.createElement("div");
  j.style.cssText = "position:absolute;bottom:8px;left:8px;color:#fff;font:13px monospace;text-shadow:0 0 4px #000;pointer-events:none;z-index:2", s.appendChild(j);
  try {
    let ut = function(o) {
      st = o, Et.style.cssText = o === "pan" ? yt : H, wt.style.cssText = o === "boxzoom" ? yt : H, d.style.cursor = o === "pan" ? "grab" : "crosshair";
    }, ft = function() {
      if (!J) return;
      const o = $t(J, bt, At);
      t.activeTexture(t.TEXTURE0), t.bindTexture(t.TEXTURE_2D, Tt), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, Z, $, 0, t.RGBA, t.UNSIGNED_BYTE, o);
    }, m = function() {
      t.viewport(0, 0, d.width, d.height), t.clearColor(0, 0, 0, 0), t.clear(t.COLOR_BUFFER_BIT), t.enable(t.BLEND), t.blendFunc(t.ONE, t.ONE_MINUS_SRC_ALPHA), t.useProgram(X), t.uniform1i(y.u_image, 0), t.uniform1i(y.u_cmap, 1), t.uniform2f(y.u_crval, V[0], V[1]), t.uniform2f(y.u_cdelt, rt[0], rt[1]), t.uniform2f(y.u_crpix, it[0], it[1]), t.uniform2f(y.u_imageSize, Z, $), t.uniform2f(y.u_viewCenter, _, h), t.uniform1f(y.u_fov, f), t.uniform1f(y.u_opacity, Rt), t.uniform1i(y.u_stretch, Dt), t.uniform1i(y.u_showGrid, Ct), t.uniform2f(y.u_crosshair, St, Pt), t.uniform2f(y.u_resolution, d.width, d.height), t.drawArrays(t.TRIANGLES, 0, 6);
    }, et = function() {
      const o = e.get("image_data"), c = e.get("image_shape");
      if (!o || !c || c[0] === 0) return;
      const r = o.byteLength || o.length;
      r !== 0 && ($ = c[0], Z = c[1], J = new Float32Array(o.buffer.slice(o.byteOffset, o.byteOffset + r)), a("Image: " + Z + "x" + $ + ", " + J.length + " floats"), ft());
    }, Y = function() {
      const o = e.get("crval"), c = e.get("cdelt"), r = e.get("crpix");
      o && (V = [o[0] * i, o[1] * i]), c && (rt = [c[0] * i, c[1] * i]), r && (it = [r[0], r[1]]);
    }, W = function() {
      k || (_ = (e.get("view_ra") || 0) * i, h = (e.get("view_dec") || 0) * i, f = (e.get("view_fov") || 180) * i);
    }, U = function() {
      bt = e.get("vmin") || 0, At = e.get("vmax") || 1, Rt = e.get("opacity") ?? 1, Dt = Yt[e.get("stretch")] || 0, Ct = e.get("show_grid") === !1 ? 0 : 1;
    }, Mt = function() {
      U(), et(), Y(), W(), m();
    }, N = function() {
      if (!g) return;
      const o = (_ / i % 360 + 360) % 360, c = h / i, r = f / i;
      g.gotoRaDec(o, c), g.setFoV(r);
    }, Lt = function() {
      ot++, Mt();
      const o = e.get("image_data");
      if (o && (o.byteLength || o.length) > 0) {
        a("Data arrived after " + ot + " poll(s)"), requestAnimationFrame(m), N(), ct = _, lt = h, dt = f;
        return;
      }
      ot < It ? setTimeout(Lt, Math.min(100 * Math.pow(1.5, ot - 1), 1e3)) : (a("No image data after " + It + " polls — waiting for change event"), N(), ct = _, lt = h, dt = f);
    }, kt = function(o, c) {
      const r = d.getBoundingClientRect(), D = (o - r.left) / r.width * 2 - 1, M = -((c - r.top) / r.height * 2 - 1), z = d.width / d.height, w = Math.tan(f * 0.5), E = -D * w * z, T = M * w, S = Math.sqrt(E * E + T * T);
      if (S < 1e-10) return { ra: _, dec: h };
      const I = Math.atan(S), C = Math.sin(I), A = Math.cos(I), G = Math.sin(h), O = Math.cos(h), q = Math.asin(A * G + T * C * O / S);
      return { ra: _ + Math.atan2(E * C, S * O * A - T * G * C), dec: q };
    };
    const v = s.getBoundingClientRect(), L = window.devicePixelRatio || 1;
    d.width = (v.width || 800) * L, d.height = (v.height || 600) * L;
    const t = d.getContext("webgl2", { alpha: !0, premultipliedAlpha: !0, preserveDrawingBuffer: !0 });
    if (!t) {
      a("FAIL: No WebGL2");
      return;
    }
    a("WebGL2: " + t.getParameter(t.RENDERER));
    const X = Zt(t);
    a("Shader compiled OK"), t.useProgram(X);
    const K = t.createBuffer();
    t.bindBuffer(t.ARRAY_BUFFER, K), t.bufferData(t.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), t.STATIC_DRAW);
    const P = t.getAttribLocation(X, "a_pos");
    t.enableVertexAttribArray(P), t.vertexAttribPointer(P, 2, t.FLOAT, !1, 0, 0);
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
      (o) => y[o] = t.getUniformLocation(X, o)
    );
    const Vt = t.createTexture();
    t.activeTexture(t.TEXTURE1), t.bindTexture(t.TEXTURE_2D, Vt), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, 256, 1, 0, t.RGBA, t.UNSIGNED_BYTE, Ht()), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE), a("Colormap texture OK");
    const Tt = t.createTexture();
    t.activeTexture(t.TEXTURE0), t.bindTexture(t.TEXTURE_2D, Tt), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, 1, 1, 0, t.RGBA, t.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.NEAREST), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.NEAREST), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE);
    let Z = 1, $ = 1, J = null, V = [0, 0], rt = [1, 1], it = [0, 0], _ = 0, h = 0, f = Math.PI, bt = 0, At = 1, Rt = 1, Dt = 0, Ct = 1, Q = !1, k = !1, R = null, St = -999, Pt = -999;
    const Yt = { linear: 0, log: 1, sqrt: 2, asinh: 3 };
    let st = "pan", ct = 0, lt = 0, dt = Math.PI, F = 0, B = 0, tt = !1;
    if (ut("pan"), Et.addEventListener("click", () => ut("pan")), wt.addEventListener("click", () => ut("boxzoom")), Ot.addEventListener("click", () => {
      k = !0, _ = ct, h = lt, f = dt, e.set("view_ra", _ / i), e.set("view_dec", h / i), e.set("view_fov", f / i), e.save_changes(), N(), m(), R && clearTimeout(R), R = setTimeout(() => {
        k = !1;
      }, 500);
    }), e.on("change:image_data", () => {
      U(), et(), Y();
    }), e.on("change:image_shape", () => {
      et();
    }), e.on("change:crval", () => {
      Y();
    }), e.on("change:cdelt", () => {
      Y();
    }), e.on("change:crpix", () => {
      Y();
    }), e.on("change:vmin", () => {
      U(), ft();
    }), e.on("change:vmax", () => {
      U(), ft();
    }), e.on("change:image_revision", () => {
      U(), et(), Y(), W(), m();
    }), e.on("change:view_ra", () => {
      W(), m();
    }), e.on("change:view_dec", () => {
      W(), m();
    }), e.on("change:view_fov", () => {
      W(), m();
    }), e.on("change:opacity", () => {
      U(), m();
    }), e.on("change:stretch", () => {
      U(), m();
    }), e.on("change:show_grid", () => {
      U(), m();
    }), e.on("change:background_survey", () => {
      const o = e.get("background_survey");
      s.style.background = o ? "transparent" : "#000", m();
    }), l && p) {
      const o = xt[p] || p, c = (_ / i % 360 + 360) % 360, r = h / i, D = f / i;
      g = l.aladin(x, {
        fov: D || 180,
        target: c + " " + r,
        survey: o,
        ...Bt
      }), a("Aladin viewer created: " + p), n();
    }
    e.on("change:background_survey", async () => {
      const o = e.get("background_survey");
      if (o && g) {
        const c = xt[o] || o;
        g.setBaseImageLayer(c), s.style.background = "transparent", n();
      } else if (o && !g && !l)
        try {
          l = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await l.init, Nt(x, s), s.appendChild(x), s.style.background = "transparent";
          const r = xt[o] || o;
          g = l.aladin(x, {
            fov: f / i || 180,
            target: (_ / i % 360 + 360) % 360 + " " + h / i,
            survey: r,
            ...Bt
          }), a("Aladin loaded on demand: " + o), n();
        } catch (c) {
          a("Aladin load failed: " + c.message);
        }
      else o || (s.style.background = "#000", x.style.display = "none");
      m();
    }), e.on("change:background_cut_min", () => {
      n();
    }), e.on("change:background_cut_max", () => {
      n();
    }), Mt();
    let ot = 0;
    const It = 30;
    setTimeout(Lt, 50);
    let ht = 0, gt = 0, pt = 0, _t = 0, mt = !1;
    d.style.cursor = "grab", d.addEventListener("mousedown", (o) => {
      if (k = !0, R && (clearTimeout(R), R = null), pt = o.clientX, _t = o.clientY, mt = !1, st === "boxzoom") {
        tt = !0;
        const c = s.getBoundingClientRect();
        F = o.clientX - c.left, B = o.clientY - c.top, b.style.left = F + "px", b.style.top = B + "px", b.style.width = "0", b.style.height = "0", b.style.display = "block";
      } else
        Q = !0, ht = o.clientX, gt = o.clientY, d.style.cursor = "grabbing";
    }), window.addEventListener("mousemove", (o) => {
      if (tt) {
        const w = s.getBoundingClientRect(), E = o.clientX - w.left, T = o.clientY - w.top, S = Math.min(F, E), I = Math.min(B, T), C = Math.abs(E - F), A = Math.abs(T - B);
        b.style.left = S + "px", b.style.top = I + "px", b.style.width = C + "px", b.style.height = A + "px", mt = !0;
        return;
      }
      if (!Q) {
        const w = d.getBoundingClientRect(), E = (o.clientX - w.left) / w.width * 2 - 1, T = -((o.clientY - w.top) / w.height * 2 - 1), S = d.width / d.height, I = Math.tan(f * 0.5), C = -E * I * S, A = T * I, G = Math.sqrt(C * C + A * A);
        if (G < 1e-10) {
          const O = (_ / i % 360 + 360) % 360;
          j.textContent = zt(O) + "  " + Gt(h / i);
        } else {
          const O = Math.atan(G), q = Math.sin(O), vt = Math.cos(O), Ut = Math.sin(h), Xt = Math.cos(h), Wt = Math.asin(vt * Ut + A * q * Xt / G), qt = ((_ + Math.atan2(C * q, G * Xt * vt - A * Ut * q)) / i % 360 + 360) % 360;
          j.textContent = zt(qt) + "  " + Gt(Wt / i);
        }
        return;
      }
      const c = (o.clientX - ht) / d.clientWidth * f, r = (o.clientY - gt) / d.clientHeight * f, D = d.width / d.height, M = Math.max(Math.cos(h), 0.01), z = e.get("invert_horizontal_pan") === !1 ? 1 : -1;
      _ -= z * c * D / M, h = Math.max(-Math.PI / 2 + 1e-3, Math.min(Math.PI / 2 - 1e-3, h + r)), ht = o.clientX, gt = o.clientY, mt = !0, N(), requestAnimationFrame(m);
    }), window.addEventListener("mouseup", (o) => {
      if (tt) {
        if (tt = !1, b.style.display = "none", R = setTimeout(() => {
          k = !1;
        }, 500), Math.sqrt((o.clientX - pt) ** 2 + (o.clientY - _t) ** 2) < 5) return;
        const r = s.getBoundingClientRect(), D = o.clientX - r.left, M = o.clientY - r.top, z = (F + D) / 2 / r.width * 2 - 1, w = -((B + M) / 2 / r.height * 2 - 1), E = kt(
          r.left + (F + D) / 2,
          r.top + (B + M) / 2
        );
        _ = E.ra, h = E.dec;
        const T = Math.max(
          Math.abs(D - F) / r.width,
          Math.abs(M - B) / r.height
        );
        f = f * T, f = Math.max(1e-3 * i, Math.min(Math.PI, f)), e.set("view_ra", _ / i), e.set("view_dec", h / i), e.set("view_fov", f / i), e.save_changes(), N(), m();
        return;
      }
      if (Q)
        if (Q = !1, d.style.cursor = st === "pan" ? "grab" : "crosshair", R = setTimeout(() => {
          k = !1;
        }, 500), Math.sqrt((o.clientX - pt) ** 2 + (o.clientY - _t) ** 2) < 3) {
          const r = kt(o.clientX, o.clientY), D = (r.ra / i % 360 + 360) % 360, M = r.dec / i;
          e.set("clicked_coord", [D, M]);
          const z = r.ra - V[0], w = Math.sin(r.dec), E = Math.cos(r.dec), T = Math.sin(V[1]), S = Math.cos(V[1]), I = E * Math.sin(z), C = w * S - E * T * Math.cos(z);
          e.set("clicked_lm", [I, C]);
          const A = e.get("click_tick");
          e.set("click_tick", (A ?? 0) + 1), e.save_changes(), St = r.ra, Pt = r.dec, requestAnimationFrame(m);
        } else
          e.set("view_ra", _ / i), e.set("view_dec", h / i), e.save_changes(), N();
    }), d.addEventListener("wheel", (o) => {
      o.preventDefault(), k = !0, R && clearTimeout(R), f *= o.deltaY > 0 ? 1.1 : 1 / 1.1, f = Math.max(1e-3 * i, Math.min(Math.PI, f)), e.set("view_fov", f / i), e.save_changes(), N(), requestAnimationFrame(m), R = setTimeout(() => {
        k = !1;
      }, 500);
    }, { passive: !1 }), new ResizeObserver(() => {
      const o = s.getBoundingClientRect(), c = window.devicePixelRatio || 1;
      d.width = o.width * c, d.height = o.height * c, m();
    }).observe(s);
  } catch (v) {
    a("ERROR: " + v.message), a(v.stack);
  }
}
function zt(e) {
  const u = e / 15, a = Math.floor(u), n = Math.floor((u - a) * 60), l = ((u - a) * 60 - n) * 60;
  return a + "h" + String(n).padStart(2, "0") + "m" + l.toFixed(1).padStart(4, "0") + "s";
}
function Gt(e) {
  const u = e >= 0 ? "+" : "-", a = Math.abs(e), n = Math.floor(a), l = Math.floor((a - n) * 60), g = ((a - n) * 60 - l) * 60;
  return u + n + "°" + String(l).padStart(2, "0") + "'" + g.toFixed(1).padStart(4, "0") + '"';
}
export {
  oe as render
};
//# sourceMappingURL=widget.js.map
