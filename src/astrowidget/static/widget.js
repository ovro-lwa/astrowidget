const s = Math.PI / 180;
function Yt() {
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
  ], g = new Uint8Array(256 * 4);
  for (let r = 0; r < 256; r++) {
    let a = 0;
    for (let _ = 0; _ < e.length - 1; _++) r >= e[_][0] && (a = _);
    const d = Math.min(a + 1, e.length - 1), x = e[d][0] - e[a][0] || 1, l = (r - e[a][0]) / x;
    g[r * 4] = e[a][1] + l * (e[d][1] - e[a][1]) | 0, g[r * 4 + 1] = e[a][2] + l * (e[d][2] - e[a][2]) | 0, g[r * 4 + 2] = e[a][3] + l * (e[d][3] - e[a][3]) | 0, g[r * 4 + 3] = 255;
  }
  return g;
}
const Wt = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0, 1); }
`, qt = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform sampler2D u_cmap;
uniform vec2 u_crval, u_cdelt, u_crpix, u_imageSize, u_viewCenter, u_resolution;
uniform float u_fov, u_opacity;
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
    float aspect = u_resolution.x / u_resolution.y;
    float scale = tan(u_fov * 0.5);
    float lV = -screen.x * scale * aspect;
    float mV = screen.y * scale;
    float r = sqrt(lV*lV + mV*mV);
    float c = atan(r);
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
function Xt(e, g, r) {
  const a = e.createShader(g);
  if (e.shaderSource(a, r), e.compileShader(a), !e.getShaderParameter(a, e.COMPILE_STATUS)) {
    const d = e.getShaderInfoLog(a);
    throw e.deleteShader(a), new Error("Shader: " + d);
  }
  return a;
}
function Ht(e) {
  const g = Xt(e, e.VERTEX_SHADER, Wt), r = Xt(e, e.FRAGMENT_SHADER, qt), a = e.createProgram();
  if (e.attachShader(a, g), e.attachShader(a, r), e.linkProgram(a), !e.getProgramParameter(a, e.LINK_STATUS))
    throw new Error("Link: " + e.getProgramInfoLog(a));
  return a;
}
function jt(e, g, r) {
  const a = e.length, d = new Uint8Array(a * 4), x = r - g || 1e-30;
  for (let l = 0; l < a; l++) {
    const _ = e[l];
    if (_ !== _ || !isFinite(_)) {
      d[l * 4 + 3] = 0;
      continue;
    }
    let i = (_ - g) / x;
    i = i < 0 ? 0 : i > 1 ? 1 : i, d[l * 4] = i * 255 + 0.5 | 0, d[l * 4 + 3] = 255;
  }
  return d;
}
const _t = {
  DSS: "CDS/P/DSS2/color",
  "2MASS": "CDS/P/2MASS/color",
  WISE: "CDS/P/allWISE/color",
  Planck: "CDS/P/PLANCK/R2/HFI/color",
  SDSS: "CDS/P/SDSS9/color",
  Mellinger: "CDS/P/Mellinger/color",
  Fermi: "CDS/P/Fermi/color",
  Haslam408: "CDS/P/HI4PI/NHI"
};
async function Jt({ model: e, el: g }) {
  function r(T) {
    console.log("[astrowidget]", T);
  }
  let a = null, d = null;
  const x = e.get("background_survey");
  if (x)
    try {
      a = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await a.init, r("Aladin Lite loaded");
    } catch (T) {
      r("Aladin Lite load failed: " + T.message);
    }
  const l = document.createElement("div");
  l.style.cssText = "position:relative;width:100%;height:600px;background:" + (x && a ? "transparent" : "#000"), g.appendChild(l);
  const _ = document.createElement("div");
  _.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:0", x && a && l.appendChild(_);
  const i = document.createElement("canvas");
  i.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:1", l.appendChild(i);
  const $ = document.createElement("div");
  $.style.cssText = "position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:4px", l.appendChild($);
  const O = "padding:4px 10px;font:12px sans-serif;border:1px solid #888;border-radius:3px;cursor:pointer;color:#fff;background:rgba(0,0,0,0.6)", vt = O + ";background:rgba(70,130,255,0.8);border-color:#7af";
  function tt(T, W) {
    const t = document.createElement("button");
    return t.textContent = T, t.title = W, t.style.cssText = O, $.appendChild(t), t;
  }
  const Gt = tt("↺", "Reset view to initial position"), mt = tt("✥", "Pan mode (drag to rotate)"), xt = tt("⬚", "Box zoom (drag to select region)"), y = document.createElement("div");
  y.style.cssText = "position:absolute;border:2px dashed #7af;background:rgba(70,130,255,0.15);pointer-events:none;z-index:2;display:none", l.appendChild(y);
  const Y = document.createElement("div");
  Y.style.cssText = "position:absolute;bottom:8px;left:8px;color:#fff;font:13px monospace;text-shadow:0 0 4px #000;pointer-events:none;z-index:2", l.appendChild(Y);
  try {
    let st = function(o) {
      at = o, mt.style.cssText = o === "pan" ? vt : O, xt.style.cssText = o === "boxzoom" ? vt : O, i.style.cursor = o === "pan" ? "grab" : "crosshair";
    }, ct = function() {
      if (!K) return;
      const o = jt(K, yt, Tt);
      t.activeTexture(t.TEXTURE0), t.bindTexture(t.TEXTURE_2D, Et), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, H, j, 0, t.RGBA, t.UNSIGNED_BYTE, o);
    }, h = function() {
      t.viewport(0, 0, i.width, i.height), t.clearColor(0, 0, 0, 0), t.clear(t.COLOR_BUFFER_BIT), t.enable(t.BLEND), t.blendFunc(t.ONE, t.ONE_MINUS_SRC_ALPHA), t.useProgram(q), t.uniform1i(v.u_image, 0), t.uniform1i(v.u_cmap, 1), t.uniform2f(v.u_crval, B[0], B[1]), t.uniform2f(v.u_cdelt, et[0], et[1]), t.uniform2f(v.u_crpix, ot[0], ot[1]), t.uniform2f(v.u_imageSize, H, j), t.uniform2f(v.u_viewCenter, p, f), t.uniform1f(v.u_fov, u), t.uniform1f(v.u_opacity, Rt), t.uniform1i(v.u_stretch, bt), t.uniform1i(v.u_showGrid, At), t.uniform2f(v.u_crosshair, Dt, Ct), t.uniform2f(v.u_resolution, i.width, i.height), t.drawArrays(t.TRIANGLES, 0, 6);
    }, lt = function() {
      const o = e.get("image_data"), c = e.get("image_shape");
      if (!o || !c || c[0] === 0) return;
      const n = o.byteLength || o.length;
      n !== 0 && (j = c[0], H = c[1], K = new Float32Array(o.buffer.slice(o.byteOffset, o.byteOffset + n)), r("Image: " + H + "x" + j + ", " + K.length + " floats"), ct());
    }, z = function() {
      const o = e.get("crval"), c = e.get("cdelt"), n = e.get("crpix");
      o && (B = [o[0] * s, o[1] * s]), c && (et = [c[0] * s, c[1] * s]), n && (ot = [n[0], n[1]]);
    }, N = function() {
      M || (p = (e.get("view_ra") || 0) * s, f = (e.get("view_dec") || 0) * s, u = (e.get("view_fov") || 180) * s);
    }, I = function() {
      yt = e.get("vmin") || 0, Tt = e.get("vmax") || 1, Rt = e.get("opacity") ?? 1, bt = Nt[e.get("stretch")] || 0, At = e.get("show_grid") === !1 ? 0 : 1;
    }, St = function() {
      I(), lt(), z(), N(), h();
    }, X = function() {
      if (!d) return;
      const o = (p / s % 360 + 360) % 360, c = f / s, n = u / s;
      d.gotoRaDec(o, c), d.setFoV(n);
    }, Mt = function() {
      Q++, St();
      const o = e.get("image_data");
      if (o && (o.byteLength || o.length) > 0) {
        r("Data arrived after " + Q + " poll(s)"), requestAnimationFrame(h), X(), rt = p, nt = f, it = u;
        return;
      }
      Q < Pt ? setTimeout(Mt, Math.min(100 * Math.pow(1.5, Q - 1), 1e3)) : (r("No image data after " + Pt + " polls — waiting for change event"), X(), rt = p, nt = f, it = u);
    }, It = function(o, c) {
      const n = i.getBoundingClientRect(), A = (o - n.left) / n.width * 2 - 1, S = -((c - n.top) / n.height * 2 - 1), F = i.width / i.height, w = Math.tan(u * 0.5), m = -A * w * F, E = S * w, C = Math.sqrt(m * m + E * E);
      if (C < 1e-10) return { ra: p, dec: f };
      const P = Math.atan(C), D = Math.sin(P), R = Math.cos(P), k = Math.sin(f), G = Math.cos(f), V = Math.asin(R * k + E * D * G / C);
      return { ra: p + Math.atan2(m * D, C * G * R - E * k * D), dec: V };
    };
    const T = l.getBoundingClientRect(), W = window.devicePixelRatio || 1;
    i.width = (T.width || 800) * W, i.height = (T.height || 600) * W;
    const t = i.getContext("webgl2", { alpha: !0, premultipliedAlpha: !0, preserveDrawingBuffer: !0 });
    if (!t) {
      r("FAIL: No WebGL2");
      return;
    }
    r("WebGL2: " + t.getParameter(t.RENDERER));
    const q = Ht(t);
    r("Shader compiled OK"), t.useProgram(q);
    const Bt = t.createBuffer();
    t.bindBuffer(t.ARRAY_BUFFER, Bt), t.bufferData(t.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), t.STATIC_DRAW);
    const wt = t.getAttribLocation(q, "a_pos");
    t.enableVertexAttribArray(wt), t.vertexAttribPointer(wt, 2, t.FLOAT, !1, 0, 0);
    const v = {};
    [
      "u_image",
      "u_cmap",
      "u_crval",
      "u_cdelt",
      "u_crpix",
      "u_imageSize",
      "u_viewCenter",
      "u_fov",
      "u_opacity",
      "u_stretch",
      "u_showGrid",
      "u_crosshair",
      "u_resolution"
    ].forEach(
      (o) => v[o] = t.getUniformLocation(q, o)
    );
    const zt = t.createTexture();
    t.activeTexture(t.TEXTURE1), t.bindTexture(t.TEXTURE_2D, zt), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, 256, 1, 0, t.RGBA, t.UNSIGNED_BYTE, Yt()), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE), r("Colormap texture OK");
    const Et = t.createTexture();
    t.activeTexture(t.TEXTURE0), t.bindTexture(t.TEXTURE_2D, Et), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, 1, 1, 0, t.RGBA, t.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.NEAREST), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.NEAREST), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE);
    let H = 1, j = 1, K = null, B = [0, 0], et = [1, 1], ot = [0, 0], p = 0, f = 0, u = Math.PI, yt = 0, Tt = 1, Rt = 1, bt = 0, At = 1, Z = !1, M = !1, b = null, Dt = -999, Ct = -999;
    const Nt = { linear: 0, log: 1, sqrt: 2, asinh: 3 };
    let at = "pan", rt = 0, nt = 0, it = Math.PI, U = 0, L = 0, J = !1;
    if (st("pan"), mt.addEventListener("click", () => st("pan")), xt.addEventListener("click", () => st("boxzoom")), Gt.addEventListener("click", () => {
      M = !0, p = rt, f = nt, u = it, e.set("view_ra", p / s), e.set("view_dec", f / s), e.set("view_fov", u / s), e.save_changes(), X(), h(), b && clearTimeout(b), b = setTimeout(() => {
        M = !1;
      }, 500);
    }), e.on("change:image_data", () => {
      I(), lt(), z(), N(), h();
    }), e.on("change:image_shape", () => {
      I(), lt(), z(), N(), h();
    }), e.on("change:crval", () => {
      z(), h();
    }), e.on("change:cdelt", () => {
      z(), h();
    }), e.on("change:crpix", () => {
      z(), h();
    }), e.on("change:view_ra", () => {
      N(), h();
    }), e.on("change:view_dec", () => {
      N(), h();
    }), e.on("change:view_fov", () => {
      N(), h();
    }), e.on("change:vmin", () => {
      I(), ct(), h();
    }), e.on("change:vmax", () => {
      I(), ct(), h();
    }), e.on("change:opacity", () => {
      I(), h();
    }), e.on("change:stretch", () => {
      I(), h();
    }), e.on("change:show_grid", () => {
      I(), h();
    }), e.on("change:background_survey", () => {
      const o = e.get("background_survey");
      l.style.background = o ? "transparent" : "#000", h();
    }), a && x) {
      const o = _t[x] || x, c = (p / s % 360 + 360) % 360, n = f / s, A = u / s;
      d = a.aladin(_, {
        fov: A || 180,
        target: c + " " + n,
        survey: o,
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
        showZoomControl: !1
      }), r("Aladin viewer created: " + x);
    }
    e.on("change:background_survey", async () => {
      const o = e.get("background_survey");
      if (o && d) {
        const c = _t[o] || o;
        d.setBaseImageLayer(c), l.style.background = "transparent";
      } else if (o && !d && !a)
        try {
          a = (await import("https://esm.sh/aladin-lite@3.8.2")).default, await a.init, l.appendChild(_), l.style.background = "transparent";
          const n = _t[o] || o;
          d = a.aladin(_, {
            fov: u / s || 180,
            target: (p / s % 360 + 360) % 360 + " " + f / s,
            survey: n,
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
            showZoomControl: !1
          }), r("Aladin loaded on demand: " + o);
        } catch (c) {
          r("Aladin load failed: " + c.message);
        }
      else o || (l.style.background = "#000", _.style.display = "none");
      h();
    }), St();
    let Q = 0;
    const Pt = 30;
    setTimeout(Mt, 50);
    let dt = 0, ht = 0, ut = 0, ft = 0, gt = !1;
    i.style.cursor = "grab", i.addEventListener("mousedown", (o) => {
      if (M = !0, b && (clearTimeout(b), b = null), ut = o.clientX, ft = o.clientY, gt = !1, at === "boxzoom") {
        J = !0;
        const c = l.getBoundingClientRect();
        U = o.clientX - c.left, L = o.clientY - c.top, y.style.left = U + "px", y.style.top = L + "px", y.style.width = "0", y.style.height = "0", y.style.display = "block";
      } else
        Z = !0, dt = o.clientX, ht = o.clientY, i.style.cursor = "grabbing";
    }), window.addEventListener("mousemove", (o) => {
      if (J) {
        const w = l.getBoundingClientRect(), m = o.clientX - w.left, E = o.clientY - w.top, C = Math.min(U, m), P = Math.min(L, E), D = Math.abs(m - U), R = Math.abs(E - L);
        y.style.left = C + "px", y.style.top = P + "px", y.style.width = D + "px", y.style.height = R + "px", gt = !0;
        return;
      }
      if (!Z) {
        const w = i.getBoundingClientRect(), m = (o.clientX - w.left) / w.width * 2 - 1, E = -((o.clientY - w.top) / w.height * 2 - 1), C = i.width / i.height, P = Math.tan(u * 0.5), D = -m * P * C, R = E * P, k = Math.sqrt(D * D + R * R);
        if (k < 1e-10) {
          const G = (p / s % 360 + 360) % 360;
          Y.textContent = Ft(G) + "  " + kt(f / s);
        } else {
          const G = Math.atan(k), V = Math.sin(G), pt = Math.cos(G), Ut = Math.sin(f), Lt = Math.cos(f), Vt = Math.asin(pt * Ut + R * V * Lt / k), Ot = ((p + Math.atan2(D * V, k * Lt * pt - R * Ut * V)) / s % 360 + 360) % 360;
          Y.textContent = Ft(Ot) + "  " + kt(Vt / s);
        }
        return;
      }
      const c = (o.clientX - dt) / i.clientWidth * u, n = (o.clientY - ht) / i.clientHeight * u, A = i.width / i.height, S = Math.max(Math.cos(f), 0.01), F = e.get("invert_horizontal_pan") === !1 ? 1 : -1;
      p -= F * c * A / S, f = Math.max(-Math.PI / 2 + 1e-3, Math.min(Math.PI / 2 - 1e-3, f + n)), dt = o.clientX, ht = o.clientY, gt = !0, X(), requestAnimationFrame(h);
    }), window.addEventListener("mouseup", (o) => {
      if (J) {
        if (J = !1, y.style.display = "none", b = setTimeout(() => {
          M = !1;
        }, 500), Math.sqrt((o.clientX - ut) ** 2 + (o.clientY - ft) ** 2) < 5) return;
        const n = l.getBoundingClientRect(), A = o.clientX - n.left, S = o.clientY - n.top, F = (U + A) / 2 / n.width * 2 - 1, w = -((L + S) / 2 / n.height * 2 - 1), m = It(
          n.left + (U + A) / 2,
          n.top + (L + S) / 2
        );
        p = m.ra, f = m.dec;
        const E = Math.max(
          Math.abs(A - U) / n.width,
          Math.abs(S - L) / n.height
        );
        u = u * E, u = Math.max(1e-3 * s, Math.min(Math.PI, u)), e.set("view_ra", p / s), e.set("view_dec", f / s), e.set("view_fov", u / s), e.save_changes(), X(), h();
        return;
      }
      if (Z)
        if (Z = !1, i.style.cursor = at === "pan" ? "grab" : "crosshair", b = setTimeout(() => {
          M = !1;
        }, 500), Math.sqrt((o.clientX - ut) ** 2 + (o.clientY - ft) ** 2) < 3) {
          const n = It(o.clientX, o.clientY), A = (n.ra / s % 360 + 360) % 360, S = n.dec / s;
          e.set("clicked_coord", [A, S]);
          const F = n.ra - B[0], w = Math.sin(n.dec), m = Math.cos(n.dec), E = Math.sin(B[1]), C = Math.cos(B[1]), P = m * Math.sin(F), D = w * C - m * E * Math.cos(F);
          e.set("clicked_lm", [P, D]);
          const R = e.get("click_tick");
          e.set("click_tick", (R ?? 0) + 1), e.save_changes(), Dt = n.ra, Ct = n.dec, requestAnimationFrame(h);
        } else
          e.set("view_ra", p / s), e.set("view_dec", f / s), e.save_changes(), X();
    }), i.addEventListener("wheel", (o) => {
      o.preventDefault(), M = !0, b && clearTimeout(b), u *= o.deltaY > 0 ? 1.1 : 1 / 1.1, u = Math.max(1e-3 * s, Math.min(Math.PI, u)), e.set("view_fov", u / s), e.save_changes(), X(), requestAnimationFrame(h), b = setTimeout(() => {
        M = !1;
      }, 500);
    }, { passive: !1 }), new ResizeObserver(() => {
      const o = l.getBoundingClientRect(), c = window.devicePixelRatio || 1;
      i.width = o.width * c, i.height = o.height * c, h();
    }).observe(l);
  } catch (T) {
    r("ERROR: " + T.message), r(T.stack);
  }
}
function Ft(e) {
  const g = e / 15, r = Math.floor(g), a = Math.floor((g - r) * 60), d = ((g - r) * 60 - a) * 60;
  return r + "h" + String(a).padStart(2, "0") + "m" + d.toFixed(1).padStart(4, "0") + "s";
}
function kt(e) {
  const g = e >= 0 ? "+" : "-", r = Math.abs(e), a = Math.floor(r), d = Math.floor((r - a) * 60), x = ((r - a) * 60 - d) * 60;
  return g + a + "°" + String(d).padStart(2, "0") + "'" + x.toFixed(1).padStart(4, "0") + '"';
}
export {
  Jt as render
};
//# sourceMappingURL=widget.js.map
