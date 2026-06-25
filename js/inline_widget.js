/**
 * SkyWidget renderer using raw WebGL2 (no regl, no bundling).
 * SIN view projection fragment shader renders radio images on a celestial sphere.
 */

import {
  screenToCelestial,
  celestialToScreen,
  panViewByScreenDrag,
  measureViewPlaneScales,
  viewFovAxes,
  maxSinViewFov,
  skyCoordFromClient,
  DEG2RAD,
} from "./projection.js";

// Inferno colormap (256 RGB triplets, uint8)
function makeInfernoUint8() {
  const stops = [
    [0, 0,0,4], [32, 31,2,67], [64, 84,3,104], [96, 136,17,90],
    [128, 186,54,58], [160, 227,100,26], [192, 250,150,6],
    [224, 253,205,41], [255, 252,255,164],
  ];
  const out = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    let lo = 0;
    for (let s = 0; s < stops.length - 1; s++) if (i >= stops[s][0]) lo = s;
    const hi = Math.min(lo + 1, stops.length - 1);
    const range = stops[hi][0] - stops[lo][0] || 1;
    const t = (i - stops[lo][0]) / range;
    out[i*4]   = (stops[lo][1] + t * (stops[hi][1] - stops[lo][1])) | 0;
    out[i*4+1] = (stops[lo][2] + t * (stops[hi][2] - stops[lo][2])) | 0;
    out[i*4+2] = (stops[lo][3] + t * (stops[hi][3] - stops[lo][3])) | 0;
    out[i*4+3] = 255;
  }
  return out;
}

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0, 1); }
`;

const FRAG = `#version 300 es
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

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error("Shader: " + err);
  }
  return s;
}

function createProgram(gl) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Link: " + gl.getProgramInfoLog(prog));
  }
  return prog;
}

function normalizeToUint8(floatData, vmin, vmax) {
  const n = floatData.length;
  const out = new Uint8Array(n * 4);
  const range = vmax - vmin || 1e-30;
  for (let i = 0; i < n; i++) {
    const v = floatData[i];
    if (v !== v || !isFinite(v)) { out[i*4+3] = 0; continue; }
    let norm = (v - vmin) / range;
    norm = norm < 0 ? 0 : norm > 1 ? 1 : norm;
    out[i*4] = (norm * 255 + 0.5) | 0;
    out[i*4+3] = 255;
  }
  return out;
}

// Survey presets
const SURVEY_PRESETS = {
  "DSS": "CDS/P/DSS2/color",
  "2MASS": "CDS/P/2MASS/color",
  "WISE": "CDS/P/allWISE/color",
  "Planck": "CDS/P/PLANCK/R2/HFI/color",
  "SDSS": "CDS/P/SDSS9/color",
  "Mellinger": "CDS/P/Mellinger/color",
  "Fermi": "CDS/P/Fermi/color",
  "Haslam408": "CDS/P/HI4PI/NHI",
};

// HiPS-only Aladin options — astrowidget owns pan/zoom/readout UI above the canvas.
const ALADIN_BG_OPTIONS = {
  projection: "SIN",
  showCooGrid: false,
  showFrame: false,
  showCooGridControl: false,
  showSimbadPointerControl: false,
  showFullscreenControl: false,
  showLayersControl: false,
  showGotoControl: false,
  showShareControl: false,
  showSettingsControl: false,
  showZoomControl: false,
  showCooLocation: false,
  showProjectionControl: false,
  showFov: false,
  showStatusBar: false,
  showReticle: false,
  showContextMenu: false,
};

// Pin any remaining Aladin chrome to z-index 0 (below WebGL canvas at z=1).
const ALADIN_CONTROL_SELECTORS = [
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
  ".aladin-table",
].join(", ");

function installAladinControlLayerStyles(container) {
  const id = "astrowidget-aladin-control-layer";
  if (container.querySelector(`#${id}`)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .astrowidget-aladin-bg ${ALADIN_CONTROL_SELECTORS} {
      z-index: 0 !important;
      pointer-events: none !important;
    }
  `;
  container.appendChild(style);
}

function prepareAladinBackgroundDiv(aladinDiv, container) {
  aladinDiv.classList.add("astrowidget-aladin-bg");
  installAladinControlLayerStyles(container);
}

export async function render({ model, el }) {
  function log(s) { console.log("[astrowidget]", s); }

  function applyBackgroundCuts() {
    const lo = model.get("background_cut_min");
    const hi = model.get("background_cut_max");
    if (!aladin || !Number.isFinite(lo) || !Number.isFinite(hi)) return;
    let attempts = 0;
    function tryApply() {
      attempts += 1;
      try {
        const layer = aladin.getBaseImageLayer?.();
        if (layer?.setCuts) {
          layer.setCuts(lo, hi);
          log("Background cuts: " + lo + " .. " + hi);
          return;
        }
      } catch (e) {
        log("Background setCuts pending: " + e.message);
      }
      if (attempts < 25) {
        setTimeout(tryApply, Math.min(100 * attempts, 1000));
      }
    }
    tryApply();
  }

  // --- Aladin Lite: load if background survey is requested ---
  let AladinLib = null;
  let aladin = null;
  const initBg = model.get("background_survey");

  if (initBg) {
    try {
      const mod = await import("https://esm.sh/aladin-lite@3.8.2");
      AladinLib = mod.default;
      await AladinLib.init;
      log("Aladin Lite loaded");
    } catch (e) {
      log("Aladin Lite load failed: " + e.message);
    }
  }

  // Container
  const container = document.createElement("div");
  container.style.cssText = "position:relative;width:100%;height:600px;background:" + (initBg && AladinLib ? "transparent" : "#000");
  el.appendChild(container);

  // Aladin div (background layer — behind canvas, z-index 0)
  const aladinDiv = document.createElement("div");
  aladinDiv.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:0";
  if (initBg && AladinLib) {
    prepareAladinBackgroundDiv(aladinDiv, container);
    container.appendChild(aladinDiv);
  }

  // WebGL canvas (foreground — z-index 1, transparent where no data)
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;z-index:1";
  container.appendChild(canvas);

  // Toolbar (top-right, z-index 3)
  const toolbar = document.createElement("div");
  toolbar.style.cssText = "position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:4px";
  container.appendChild(toolbar);

  const btnStyle = "padding:4px 10px;font:12px sans-serif;border:1px solid #888;border-radius:3px;cursor:pointer;color:#fff;background:rgba(0,0,0,0.6)";
  const btnActiveStyle = btnStyle + ";background:rgba(70,130,255,0.8);border-color:#7af";

  function makeBtn(label, title) {
    const b = document.createElement("button");
    b.textContent = label;
    b.title = title;
    b.style.cssText = btnStyle;
    toolbar.appendChild(b);
    return b;
  }

  const btnReset = makeBtn("\u21BA", "Reset view to initial position");
  const btnPan = makeBtn("\u2725", "Pan mode (drag to rotate)");
  const btnZoom = makeBtn("\u2B1A", "Box zoom (drag to select region)");

  // Box zoom selection overlay
  const boxOverlay = document.createElement("div");
  boxOverlay.style.cssText = "position:absolute;border:2px dashed #7af;background:rgba(70,130,255,0.15);pointer-events:none;z-index:2;display:none";
  container.appendChild(boxOverlay);

  // Readout (on top of everything)
  const readout = document.createElement("div");
  readout.style.cssText = "position:absolute;bottom:8px;left:8px;color:#fff;font:13px monospace;text-shadow:0 0 4px #000;pointer-events:none;z-index:2";
  container.appendChild(readout);

  try {
    // Size canvas
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = (rect.width || 800) * dpr;
    canvas.height = (rect.height || 600) * dpr;

    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) { log("FAIL: No WebGL2"); return; }
    log("WebGL2: " + gl.getParameter(gl.RENDERER));

    const prog = createProgram(gl);
    log("Shader compiled OK");

    gl.useProgram(prog);

    // Fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const loc = {};
    ["u_image","u_cmap","u_crval","u_cdelt","u_crpix","u_imageSize",
     "u_viewCenter","u_viewScale","u_viewRotation","u_fov","u_opacity","u_stretch","u_showGrid","u_crosshairScreen","u_resolution"].forEach(
      n => loc[n] = gl.getUniformLocation(prog, n)
    );

    // Colormap texture (unit 1)
    const cmapTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cmapTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, makeInfernoUint8());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    log("Colormap texture OK");

    // Image texture (unit 0)
    const imgTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // State
    let imgW = 1, imgH = 1, rawData = null;
    let crval = [0,0], cdelt = [1,1], crpix = [0,0];
    let viewRA = 0, viewDec = 0, viewFov = Math.PI;
    let measuredViewScales = null; // { scaleX, scaleY } from Aladin pix2world
    let viewRotation = 0; // radians; -aladin.getRotation() when HiPS background active
    let vmin = 0, vmax = 1, opacity = 1, stretch = 0, showGrid = 1;
    let dragging = false;
    let pendingPan = false;
    let boxing = false;
    // Block Python view echo briefly after JS pushes view_ra/dec/fov (not on click-only).
    let suppressPythonViewSync = false;
    let interactionTimer = null;
    let crosshairRA = -999, crosshairDec = -999;
    let crosshairScreenX = -999, crosshairScreenY = -999;
    const stretchMap = { linear:0, log:1, sqrt:2, asinh:3 };

    // Interaction mode: "pan" or "boxzoom"
    let mode = "pan";
    // Store initial view for reset
    let initialRA = 0, initialDec = 0, initialFov = Math.PI;
    let boxStartX = 0, boxStartY = 0;

    function armPythonViewSyncSuppress() {
      if (interactionTimer) clearTimeout(interactionTimer);
      suppressPythonViewSync = true;
      interactionTimer = setTimeout(() => { suppressPythonViewSync = false; }, 500);
    }

    /** Push local view to Python; arm suppress first so partial trait echoes are ignored. */
    function pushViewToModel() {
      armPythonViewSyncSuppress();
      model.set("view_ra", viewRA / DEG2RAD);
      model.set("view_dec", viewDec / DEG2RAD);
      model.set("view_fov", viewFov / DEG2RAD);
      model.save_changes();
    }

    function shouldApplyPythonView() {
      return !suppressPythonViewSync && !dragging && !boxing;
    }

    function setMode(m) {
      mode = m;
      btnPan.style.cssText = m === "pan" ? btnActiveStyle : btnStyle;
      btnZoom.style.cssText = m === "boxzoom" ? btnActiveStyle : btnStyle;
      canvas.style.cursor = m === "pan" ? "grab" : "crosshair";
    }
    setMode("pan");

    btnPan.addEventListener("click", () => setMode("pan"));
    btnZoom.addEventListener("click", () => setMode("boxzoom"));
    btnReset.addEventListener("click", () => {
      viewRA = initialRA; viewDec = initialDec; viewFov = initialFov;
      pushViewToModel();
      syncAladin();
      draw();
    });

    function uploadImage() {
      if (!rawData) return;
      const uint8 = normalizeToUint8(rawData, vmin, vmax);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, imgW, imgH, 0, gl.RGBA, gl.UNSIGNED_BYTE, uint8);
    }

    function getViewAspect() {
      const view = aladin?.view;
      const w = view?.width ?? canvas.clientWidth;
      const h = view?.height ?? canvas.clientHeight;
      return w / Math.max(h, 1);
    }

    function getViewPlaneScales() {
      if (measuredViewScales) return measuredViewScales;
      return viewFovAxes(viewFov, getViewAspect());
    }

    function clampViewFov(fov) {
      const minFov = 0.001 * DEG2RAD;
      const maxFov = maxSinViewFov(getViewAspect());
      return Math.max(minFov, Math.min(maxFov, fov));
    }

    function syncViewFromAladin() {
      if (!aladin?.getRaDec) return;
      const [raDeg, decDeg] = aladin.getRaDec();
      viewRA = raDeg * DEG2RAD;
      viewDec = decDeg * DEG2RAD;
      if (typeof aladin.getFov === "function") {
        const fovPair = aladin.getFov();
        const fw = Array.isArray(fovPair) ? fovPair[0] : fovPair;
        const fh = Array.isArray(fovPair) ? fovPair[1] : fw;
        viewFov = Math.max(fw, fh) * DEG2RAD;
      }
      syncViewRotationFromAladin();
    }

    function syncViewRotationFromAladin() {
      if (!aladin?.getRotation) {
        viewRotation = 0;
        return;
      }
      viewRotation = -aladin.getRotation() * DEG2RAD;
    }

    function updateViewPlaneScales() {
      if (!aladin) {
        measuredViewScales = null;
        return;
      }
      const view = aladin.view;
      const w = view?.width ?? aladinDiv.clientWidth;
      const h = view?.height ?? aladinDiv.clientHeight;
      const measured = measureViewPlaneScales(
        aladin,
        w,
        h,
        viewRA,
        viewDec,
        viewRotation
      );
      measuredViewScales = measured ?? null;
    }

    /** Pull Aladin WASM view state and remeasure overlay scales (HiPS is authoritative). */
    function alignOverlayWithAladin() {
      if (!aladin) return;
      syncViewFromAladin();
      measuredViewScales = null;
      updateViewPlaneScales();
    }

    function draw() {
      if (aladin) {
        syncViewRotationFromAladin();
        updateViewPlaneScales();
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);  // always transparent — container background provides the black
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(prog);
      gl.uniform1i(loc.u_image, 0);
      gl.uniform1i(loc.u_cmap, 1);
      gl.uniform2f(loc.u_crval, crval[0], crval[1]);
      gl.uniform2f(loc.u_cdelt, cdelt[0], cdelt[1]);
      gl.uniform2f(loc.u_crpix, crpix[0], crpix[1]);
      gl.uniform2f(loc.u_imageSize, imgW, imgH);
      gl.uniform2f(loc.u_viewCenter, viewRA, viewDec);
      const scales = getViewPlaneScales();
      gl.uniform2f(loc.u_viewScale, scales.scaleX, scales.scaleY);
      gl.uniform1f(loc.u_viewRotation, viewRotation);
      gl.uniform1f(loc.u_fov, viewFov);
      gl.uniform1f(loc.u_opacity, opacity);
      gl.uniform1i(loc.u_stretch, stretch);
      gl.uniform1i(loc.u_showGrid, showGrid);
      let crosshairSX = -999;
      let crosshairSY = -999;
      if (crosshairScreenX > -900) {
        crosshairSX = crosshairScreenX;
        crosshairSY = crosshairScreenY;
      } else if (crosshairRA > -900) {
        const chPos = celestialToScreen(
          crosshairRA,
          crosshairDec,
          viewRA,
          viewDec,
          viewFov,
          getViewAspect(),
          scales,
          viewRotation
        );
        if (chPos) {
          crosshairSX = chPos.x;
          crosshairSY = chPos.y;
        }
      }
      gl.uniform2f(loc.u_crosshairScreen, crosshairSX, crosshairSY);
      gl.uniform2f(loc.u_resolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // --- Sync from model ---
    function clearImageTexture() {
      // Overlay was cleared (image_data emptied). Drop the cached pixels and
      // upload a 1x1 fully transparent texel so a subsequent draw() renders
      // nothing instead of the stale overlay at its old CRVAL.
      rawData = null;
      imgW = 1; imgH = 1;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0])
      );
    }

    function syncImage() {
      const bytes = model.get("image_data");
      const shape = model.get("image_shape");
      const len = bytes ? (bytes.byteLength || bytes.length) : 0;
      if (!bytes || !shape || shape[0] === 0 || len === 0) {
        clearImageTexture();
        return;
      }
      imgH = shape[0]; imgW = shape[1];
      rawData = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + len));
      log("Image: " + imgW + "x" + imgH + ", " + rawData.length + " floats");
      uploadImage();
    }

    function syncWCS() {
      const cv = model.get("crval"), cd = model.get("cdelt"), cp = model.get("crpix");
      if (cv) crval = [cv[0]*DEG2RAD, cv[1]*DEG2RAD];
      if (cd) cdelt = [cd[0]*DEG2RAD, cd[1]*DEG2RAD];
      if (cp) crpix = [cp[0], cp[1]];
    }

    function applyViewFromModel() {
      viewRA = (model.get("view_ra") || 0) * DEG2RAD;
      viewDec = (model.get("view_dec") || 0) * DEG2RAD;
      viewFov = (model.get("view_fov") || 180) * DEG2RAD;
    }

    function syncView() {
      if (!shouldApplyPythonView()) return;
      applyViewFromModel();
    }

    function syncDisplay() {
      vmin = model.get("vmin") || 0;
      vmax = model.get("vmax") || 1;
      opacity = model.get("opacity") ?? 1;
      stretch = stretchMap[model.get("stretch")] || 0;
      showGrid = model.get("show_grid") === false ? 0 : 1;
    }

    let drawScheduled = false;
    function scheduleDraw() {
      if (drawScheduled) return;
      drawScheduled = true;
      requestAnimationFrame(() => {
        drawScheduled = false;
        draw();
      });
    }

    function syncCrosshairFromModel() {
      const raDeg = model.get("crosshair_ra");
      const decDeg = model.get("crosshair_dec");
      if (
        typeof raDeg !== "number" ||
        typeof decDeg !== "number" ||
        raDeg < -900 ||
        decDeg < -900
      ) {
        crosshairRA = -999;
        crosshairDec = -999;
      } else {
        crosshairRA = raDeg * DEG2RAD;
        crosshairDec = decDeg * DEG2RAD;
        crosshairScreenX = -999;
        crosshairScreenY = -999;
      }
    }

    function syncAll() {
      syncDisplay();
      syncImage();
      syncWCS();
      syncView();
      syncCrosshairFromModel();
      draw();
    }

    // Register change handlers first. Image/WCS/scaling traits update local
    // state only; the frontend redraws once per Python-side image_revision bump
    // so binary image_data cannot be drawn with stale WCS.
    model.on("change:image_data", () => { syncDisplay(); syncImage(); syncWCS(); });
    model.on("change:image_shape", () => { syncImage(); });
    model.on("change:crval", () => { syncWCS(); });
    model.on("change:cdelt", () => { syncWCS(); });
    model.on("change:crpix", () => { syncWCS(); });
    model.on("change:vmin", () => { syncDisplay(); uploadImage(); });
    model.on("change:vmax", () => { syncDisplay(); uploadImage(); });
    model.on("change:image_revision", () => {
      syncDisplay();
      syncImage();
      syncWCS();
      // Authoritative slice load: WCS + image arrive in one Python batch.
      // Do not syncAladin here — view_lock overlay swaps must not nudge HiPS FOV.
      // View changes still flow through change:view_* → onPythonViewChange.
      if (!model.get("overlay_view_lock")) {
        if (shouldApplyPythonView()) {
          applyViewFromModel();
          if (aladin) syncAladin();
        } else {
          measuredViewScales = null;
          if (aladin) updateViewPlaneScales();
        }
      }
      scheduleDraw();
    });
    model.on("change:crosshair_ra", () => { syncCrosshairFromModel(); scheduleDraw(); });
    model.on("change:crosshair_dec", () => { syncCrosshairFromModel(); scheduleDraw(); });
    function finishViewGesture({ pushToAladin = false } = {}) {
      // After pan/wheel Aladin WASM already holds the view — only pull + remeasure.
      // After box zoom or Python goto, push JS view into Aladin first.
      if (aladin) {
        if (pushToAladin) {
          syncAladin();
        } else {
          syncViewFromAladin();
          measuredViewScales = null;
          updateViewPlaneScales();
        }
      }
      draw();
      if (model.get("overlay_view_lock")) {
        const rev = model.get("view_gesture_revision") || 0;
        model.set("view_gesture_revision", rev + 1);
        model.save_changes();
      }
    }

    function onPythonViewChange() {
      // Python goto() / update_slice(center=) — not echo from an in-progress drag.
      if (!shouldApplyPythonView()) return;
      applyViewFromModel();
      measuredViewScales = null;
      syncAladin();
      // Defer draw so a batched update_slice cannot paint view before image/WCS sync.
      scheduleDraw();
    }
    model.on("change:view_ra", onPythonViewChange);
    model.on("change:view_dec", onPythonViewChange);
    model.on("change:view_fov", onPythonViewChange);
    model.on("change:opacity", () => { syncDisplay(); draw(); });
    model.on("change:stretch", () => { syncDisplay(); draw(); });
    model.on("change:show_grid", () => { syncDisplay(); draw(); });
    model.on("change:background_survey", () => {
      const hasBg = model.get("background_survey");
      container.style.background = hasBg ? "transparent" : "#000";
      draw();
    });

    // --- Aladin Lite: JS-side sync (no Python round-trip) ---
    function syncAladin(updateCenter = true) {
      if (!aladin) return;
      viewFov = clampViewFov(viewFov);
      const fovDeg = viewFov / DEG2RAD;
      if (updateCenter) {
        const raDeg = ((viewRA / DEG2RAD) % 360 + 360) % 360;
        const decDeg = viewDec / DEG2RAD;
        aladin.gotoRaDec(raDeg, decDeg);
      }
      aladin.setFoV(fovDeg);
      syncViewFromAladin();
      measuredViewScales = null;
      updateViewPlaneScales();
    }

    // Map browser client coords to Aladin view pixel space (CSS px).
    function clientToAladinPixels(clientX, clientY) {
      const rect = aladinDiv.getBoundingClientRect();
      const view = aladin.view;
      const w = view?.width ?? rect.width;
      const h = view?.height ?? rect.height;
      return {
        x: (clientX - rect.left) * (w / rect.width),
        y: (clientY - rect.top) * (h / rect.height),
      };
    }

    // Pan using Aladin's WASM projection (matches HiPS background exactly).
    function applyAladinPan(fromX, fromY, toX, toY) {
      const wasm = aladin?.view?.wasm;
      if (!wasm?.goFromTo) return false;
      let { x: x1, y: y1 } = clientToAladinPixels(fromX, fromY);
      let { x: x2, y: y2 } = clientToAladinPixels(toX, toY);
      if (model.get("invert_horizontal_pan") === false) {
        [x1, x2] = [x2, x1];
      }
      wasm.goFromTo(x1, y1, x2, y2);
      aladin.view.updateCenter();
      const [raDeg, decDeg] = aladin.getRaDec();
      viewRA = raDeg * DEG2RAD;
      viewDec = decDeg * DEG2RAD;
      syncViewRotationFromAladin();
      return true;
    }

    // Initialize Aladin if background survey is set
    if (AladinLib && initBg) {
      const hipsUrl = SURVEY_PRESETS[initBg] || initBg;
      const raDeg = ((viewRA / DEG2RAD) % 360 + 360) % 360;
      const decDeg = viewDec / DEG2RAD;
      const fovDeg = viewFov / DEG2RAD;
      aladin = AladinLib.aladin(aladinDiv, {
        fov: fovDeg || 180,
        target: raDeg + " " + decDeg,
        survey: hipsUrl,
        ...ALADIN_BG_OPTIONS,
      });
      log("Aladin viewer created: " + initBg);
      applyBackgroundCuts();
<<<<<<< HEAD
      alignOverlayWithAladin();
=======
      updateViewPlaneScales();
>>>>>>> origin/main
    }

    // Handle background_survey changes
    model.on("change:background_survey", async () => {
      const survey = model.get("background_survey");
      if (survey && aladin) {
        // Switch survey on existing instance
        const hipsUrl = SURVEY_PRESETS[survey] || survey;
        aladin.setBaseImageLayer(hipsUrl);
        container.style.background = "transparent";
        applyBackgroundCuts();
      } else if (survey && !aladin && !AladinLib) {
        // Need to load Aladin Lite for the first time
        try {
          const mod = await import("https://esm.sh/aladin-lite@3.8.2");
          AladinLib = mod.default;
          await AladinLib.init;
          prepareAladinBackgroundDiv(aladinDiv, container);
          container.appendChild(aladinDiv);
          container.style.background = "transparent";
          const hipsUrl = SURVEY_PRESETS[survey] || survey;
          aladin = AladinLib.aladin(aladinDiv, {
            fov: (viewFov / DEG2RAD) || 180,
            target: (((viewRA / DEG2RAD) % 360 + 360) % 360) + " " + (viewDec / DEG2RAD),
            survey: hipsUrl,
            ...ALADIN_BG_OPTIONS,
          });
          log("Aladin loaded on demand: " + survey);
          applyBackgroundCuts();
<<<<<<< HEAD
          alignOverlayWithAladin();
=======
          updateViewPlaneScales();
>>>>>>> origin/main
        } catch (e) { log("Aladin load failed: " + e.message); }
      } else if (!survey) {
        container.style.background = "#000";
        aladinDiv.style.display = "none";
      }
      draw();
    });
    model.on("change:background_cut_min", () => { applyBackgroundCuts(); });
    model.on("change:background_cut_max", () => { applyBackgroundCuts(); });

    // Initial sync — poll until image data arrives from the binary comm channel.
    // Binary traitlet data often lags behind JSON state, so we poll with
    // exponential backoff rather than relying on fixed timeouts.
    syncAll();
    let _pollCount = 0;
    const _maxPolls = 30;  // exponential backoff capped at 1s → ~20s total
    function _pollForData() {
      _pollCount++;
      syncAll();
      const bytes = model.get("image_data");
      const hasData = bytes && (bytes.byteLength || bytes.length) > 0;
      if (hasData) {
        log("Data arrived after " + _pollCount + " poll(s)");
        requestAnimationFrame(draw);
        // Do not syncAladin() — preserve user pan/zoom; image_revision already drew.
        initialRA = viewRA; initialDec = viewDec; initialFov = viewFov;
        return;
      }
      if (_pollCount < _maxPolls) {
        setTimeout(_pollForData, Math.min(100 * Math.pow(1.5, _pollCount - 1), 1000));
      } else {
        log("No image data after " + _maxPolls + " polls — waiting for change event");
        // Still capture initial view so reset button works if data arrives later
        syncAladin();
        initialRA = viewRA; initialDec = viewDec; initialFov = viewFov;
      }
    }
    setTimeout(_pollForData, 50);

    // --- Interaction ---
    // (dragging declared earlier for syncView guard)
    let lastX = 0, lastY = 0;
    let mouseDownX = 0, mouseDownY = 0, didDrag = false;
    canvas.style.cursor = "grab";

    // Helper: screen coords → normalized [-1,1] with y north-up
    function clientToScreen(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((clientY - rect.top) / rect.height) * 2 - 1),
      };
    }

    // Helper: screen coords → (RA, Dec) in radians; null outside SIN disk
    function screenToRaDec(clientX, clientY) {
      const { x, y } = clientToScreen(clientX, clientY);
      return screenToCelestial(
        x, y, viewRA, viewDec, viewFov, getViewAspect(), getViewPlaneScales(), viewRotation
      );
    }

    // HiPS-aligned sky coords when Aladin is active; else WebGL SIN.
    function clientSkyCoord(clientX, clientY) {
      return skyCoordFromClient(
        clientX,
        clientY,
        aladin,
        clientToAladinPixels,
        screenToRaDec
      );
    }

    canvas.addEventListener("mousedown", e => {
      mouseDownX = e.clientX; mouseDownY = e.clientY; didDrag = false;

      if (mode === "boxzoom") {
        boxing = true;
        const rect = container.getBoundingClientRect();
        boxStartX = e.clientX - rect.left;
        boxStartY = e.clientY - rect.top;
        boxOverlay.style.left = boxStartX + "px";
        boxOverlay.style.top = boxStartY + "px";
        boxOverlay.style.width = "0";
        boxOverlay.style.height = "0";
        boxOverlay.style.display = "block";
      } else {
        pendingPan = true;
        lastX = e.clientX; lastY = e.clientY;
        canvas.style.cursor = "grabbing";
      }
    });
    window.addEventListener("mousemove", e => {
      if (pendingPan && !dragging) {
        const dist = Math.sqrt((e.clientX - mouseDownX) ** 2 + (e.clientY - mouseDownY) ** 2);
        if (dist < 3) return;
        pendingPan = false;
        dragging = true;
      }
      if (boxing) {
        // Box zoom: draw selection rectangle
        const rect = container.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        const x = Math.min(boxStartX, curX), y = Math.min(boxStartY, curY);
        const w = Math.abs(curX - boxStartX), h = Math.abs(curY - boxStartY);
        boxOverlay.style.left = x + "px";
        boxOverlay.style.top = y + "px";
        boxOverlay.style.width = w + "px";
        boxOverlay.style.height = h + "px";
        didDrag = true;
        return;
      }
      if (!dragging) {
        // Hover readout
        const rect = canvas.getBoundingClientRect();
        const sx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const sy = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        const aspect = getViewAspect();
        const coord = screenToCelestial(
          sx, sy, viewRA, viewDec, viewFov, aspect, getViewPlaneScales(), viewRotation
        );
        if (coord) {
          const rd = ((coord.ra / DEG2RAD) % 360 + 360) % 360;
          readout.textContent = fmtRA(rd) + "  " + fmtDec(coord.dec / DEG2RAD);
        } else {
          readout.textContent = "";
        }
        return;
      }
      const aspect = getViewAspect();
      const scales = getViewPlaneScales();
      const usedAladinPan = applyAladinPan(lastX, lastY, e.clientX, e.clientY);
      if (!usedAladinPan) {
        const s1 = clientToScreen(lastX, lastY);
        const s2 = clientToScreen(e.clientX, e.clientY);
        const panned = panViewByScreenDrag(
          s1.x, s1.y, s2.x, s2.y,
          viewRA, viewDec, viewFov, aspect,
          {
            invertHorizontalPan: model.get("invert_horizontal_pan") !== false,
            scales,
            rotationRad: viewRotation,
          }
        );
        if (panned) {
          viewRA = panned.viewRA;
          viewDec = panned.viewDec;
        }
      }
      if (aladin) updateViewPlaneScales();
      lastX = e.clientX;
      lastY = e.clientY;
      didDrag = true;
      requestAnimationFrame(draw);
    });
    window.addEventListener("mouseup", e => {
      if (boxing) {
        // Box zoom complete — compute FOV from selection
        boxing = false;
        boxOverlay.style.display = "none";

        const dist = Math.sqrt((e.clientX-mouseDownX)**2 + (e.clientY-mouseDownY)**2);
        if (dist < 5) return; // too small, ignore

        const rect = container.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;

        // Center of selection in normalized coords [-1, 1]
        const cx = ((boxStartX + curX) / 2 / rect.width) * 2 - 1;
        const cy = -(((boxStartY + curY) / 2 / rect.height) * 2 - 1);

        // Navigate to center of selection
        const center = screenToRaDec(
          rect.left + (boxStartX + curX) / 2,
          rect.top + (boxStartY + curY) / 2
        );
        if (!center) return;
        viewRA = center.ra;
        viewDec = center.dec;

        // New FOV: SIN-correct scaling from selection fraction
        const selFrac = Math.max(Math.abs(curX - boxStartX) / rect.width,
                                  Math.abs(curY - boxStartY) / rect.height);
        const half = viewFov * 0.5;
        viewFov = 2 * Math.asin(Math.min(1, selFrac * Math.sin(half)));
        viewFov = clampViewFov(viewFov);

        pushViewToModel();
        finishViewGesture({ pushToAladin: true });
        return;
      }
      if (dragging || pendingPan) {
        dragging = false;
        pendingPan = false;
        canvas.style.cursor = mode === "pan" ? "grab" : "crosshair";
        // Distinguish click (< 3px movement) from drag
        const dist = Math.sqrt((e.clientX-mouseDownX)**2 + (e.clientY-mouseDownY)**2);
        if (dist < 3) {
          // Click — compute celestial coords and send to Python
          const coord = clientSkyCoord(e.clientX, e.clientY);
          if (!coord) return;
          const raDeg = ((coord.ra / DEG2RAD) % 360 + 360) % 360;
          const decDeg = coord.dec / DEG2RAD;
          model.set("clicked_coord", [raDeg, decDeg]);

          // Diagnostic: read the SAME click pixel through both projections so
          // Python can detect overlay (WebGL SIN) vs HiPS (Aladin) disagreement.
          try {
            let hipsRa = NaN, hipsDec = NaN;
            if (aladin?.pix2world) {
              const px = clientToAladinPixels(e.clientX, e.clientY);
              const w = aladin.pix2world(px.x, px.y);
              if (Array.isArray(w) && isFinite(w[0]) && isFinite(w[1])) {
                hipsRa = ((w[0] % 360) + 360) % 360;
                hipsDec = w[1];
              }
            }
            let webglRa = NaN, webglDec = NaN;
            const wc = screenToRaDec(e.clientX, e.clientY);
            if (wc) {
              webglRa = ((wc.ra / DEG2RAD) % 360 + 360) % 360;
              webglDec = wc.dec / DEG2RAD;
            }
            model.set("clicked_coord_debug", [hipsRa, hipsDec, webglRa, webglDec]);
          } catch (err) {
            model.set("clicked_coord_debug", [NaN, NaN, NaN, NaN]);
          }

          // Compute (l, m) direction cosines from phase center
          const dra = coord.ra - crval[0];
          const sdP = Math.sin(coord.dec), cdP = Math.cos(coord.dec);
          const sd0P = Math.sin(crval[1]), cd0P = Math.cos(crval[1]);
          const lVal = cdP * Math.sin(dra);
          const mVal = sdP * cd0P - cdP * sd0P * Math.cos(dra);
          model.set("clicked_lm", [lVal, mVal]);
          const prevTick = model.get("click_tick");
          model.set("click_tick", (prevTick == null ? 0 : prevTick) + 1);
          model.save_changes();

          // Celestial-anchored crosshair: store the clicked sky coordinate and
          // reproject to screen on every draw(). A fixed screen-space marker
          // drifts on zoom/pan and is misleading.
          crosshairScreenX = -999;
          crosshairScreenY = -999;
          crosshairRA = coord.ra;
          crosshairDec = coord.dec;
          if (aladin) alignOverlayWithAladin();
          requestAnimationFrame(draw);
        } else {
          pushViewToModel();
          finishViewGesture({ pushToAladin: false });
        }
      }
    });
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      viewFov *= e.deltaY > 0 ? 1.1 : 1/1.1;
      viewFov = clampViewFov(viewFov);
      pushViewToModel();
      if (aladin) {
        aladin.setFoV(viewFov / DEG2RAD);
        requestAnimationFrame(() => finishViewGesture({ pushToAladin: false }));
      } else {
        requestAnimationFrame(draw);
      }
    }, { passive: false });

    // Resize
    const ro = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      const d = window.devicePixelRatio||1;
      canvas.width = r.width*d; canvas.height = r.height*d;
      updateViewPlaneScales();
      draw();
    });
    ro.observe(container);

  } catch(e) {
    log("ERROR: " + e.message);
    log(e.stack);
  }
}

function fmtRA(deg) {
  const h = deg/15, hi = Math.floor(h), mi = Math.floor((h-hi)*60), s = ((h-hi)*60-mi)*60;
  return hi+"h"+String(mi).padStart(2,"0")+"m"+s.toFixed(1).padStart(4,"0")+"s";
}
function fmtDec(deg) {
  const sign = deg>=0?"+":"-", a = Math.abs(deg), d=Math.floor(a), m=Math.floor((a-d)*60), s=((a-d)*60-m)*60;
  return sign+d+"°"+String(m).padStart(2,"0")+"'"+s.toFixed(1).padStart(4,"0")+'"';
}
