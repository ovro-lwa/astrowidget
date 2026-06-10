/**
 * SIN (slant orthographic) projection math.
 *
 * Implements FITS WCS Paper II (Calabretta & Greisen 2002) image SIN projection
 * and zenithal SIN view mapping (matching Aladin Lite). These functions are
 * the single source of truth for coordinate transforms in JS — the GLSL
 * shader mirrors this math.
 *
 * All angles in radians unless noted.
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Aladin-compatible view FOV axes from angular size on the largest dimension.
 *
 * Matches Aladin Lite ``getViewParams()`` / ``setFoV()``: ``fov`` is the sky
 * extent along the longer canvas edge; the shorter edge is scaled by aspect.
 *
 * @param {number} viewFov - Field of view on the largest dimension, radians
 * @param {number} aspect - Canvas width / height
 * @returns {{ fovWidth: number, fovHeight: number, scaleX: number, scaleY: number }}
 */
export function viewFovAxes(viewFov, aspect) {
  let fovWidth, fovHeight;
  if (aspect >= 1) {
    fovWidth = viewFov;
    fovHeight = viewFov / aspect;
  } else {
    fovHeight = viewFov;
    fovWidth = viewFov * aspect;
  }
  return {
    fovWidth,
    fovHeight,
    scaleX: Math.sin(fovWidth * 0.5),
    scaleY: Math.sin(fovHeight * 0.5),
  };
}

/**
 * Measure view-plane (l, m) scales from an Aladin Lite instance.
 *
 * Uses ``pix2world`` at the view center so the WebGL grid matches the HiPS
 * background even when analytic FOV scaling differs slightly from Aladin WASM.
 *
 * @param {object} aladin - Aladin Lite instance with ``pix2world`` and ``getRaDec``
 * @param {number} width - View width in CSS pixels (``aladin.view.width``)
 * @param {number} height - View height in CSS pixels
 * @param {number} viewRA - View center RA in radians (optional; uses ``getRaDec`` when omitted)
 * @param {number} viewDec - View center Dec in radians
 * @returns {{ scaleX: number, scaleY: number } | null}
 */
export function measureViewPlaneScales(aladin, width, height, viewRA, viewDec) {
  if (!aladin?.pix2world || width < 2 || height < 2) return null;

  if (viewRA == null || viewDec == null) {
    const [raDeg, decDeg] = aladin.getRaDec();
    viewRA = raDeg * DEG2RAD;
    viewDec = decDeg * DEG2RAD;
  }

  const cx = width * 0.5;
  const cy = height * 0.5;
  const px = Math.max(4, width * 0.02);
  const py = Math.max(4, height * 0.02);

  function lmAt(x, y) {
    const [raDeg, decDeg] = aladin.pix2world(x, y);
    return celestialToLM(raDeg * DEG2RAD, decDeg * DEG2RAD, viewRA, viewDec);
  }

  const lRight = lmAt(cx + px, cy).l;
  const lLeft = lmAt(cx - px, cy).l;
  const mUp = lmAt(cx, cy - py).m;
  const mDown = lmAt(cx, cy + py).m;

  const ndcDx = (4 * px) / width;
  const ndcDy = (4 * py) / height;
  const scaleX = Math.abs(lRight - lLeft) / ndcDx;
  const scaleY = Math.abs(mUp - mDown) / ndcDy;

  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX < 1e-15 || scaleY < 1e-15) {
    return null;
  }
  return { scaleX, scaleY };
}

function resolveViewScales(viewFov, aspect, scales) {
  if (scales?.scaleX > 0 && scales?.scaleY > 0) return scales;
  return viewFovAxes(viewFov, aspect);
}

/**
 * Map normalized screen coords to view-plane (l, m) before ``lmToCelestial``.
 *
 * Applies Aladin's view position angle (3rd Euler angle): positive
 * ``getRotation()`` is counter-clockwise on screen, so pass
 * ``rotationRad = -getRotation() * DEG2RAD``.
 *
 * @param {number} x - Normalized screen x, right positive
 * @param {number} y - Normalized screen y, north up
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {number} [rotationRad=0]
 * @returns {{ l: number, m: number }}
 */
export function screenToViewLM(x, y, scaleX, scaleY, rotationRad = 0) {
  const l0 = -x * scaleX;
  const m0 = y * scaleY;
  if (rotationRad === 0) return { l: l0, m: m0 };
  const c = Math.cos(rotationRad);
  const s = Math.sin(rotationRad);
  return {
    l: l0 * c + m0 * s,
    m: -l0 * s + m0 * c,
  };
}

/**
 * Inverse of ``screenToViewLM`` for a point already in view (l, m).
 *
 * @param {number} l
 * @param {number} m
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {number} [rotationRad=0]
 * @returns {{ x: number, y: number }}
 */
export function viewLMToScreen(l, m, scaleX, scaleY, rotationRad = 0) {
  let l0 = l;
  let m0 = m;
  if (rotationRad !== 0) {
    const c = Math.cos(rotationRad);
    const s = Math.sin(rotationRad);
    l0 = l * c - m * s;
    m0 = l * s + m * c;
  }
  return { x: -l0 / scaleX, y: m0 / scaleY };
}

/**
 * Forward SIN projection: celestial (RA, Dec) → direction cosines (l, m).
 *
 * @param {number} ra  - Right ascension in radians
 * @param {number} dec - Declination in radians
 * @param {number} ra0 - Phase center RA in radians (CRVAL1)
 * @param {number} dec0 - Phase center Dec in radians (CRVAL2)
 * @returns {{ l: number, m: number, visible: boolean }}
 */
export function celestialToLM(ra, dec, ra0, dec0) {
  const dra = ra - ra0;
  const sinDec = Math.sin(dec);
  const cosDec = Math.cos(dec);
  const sinDec0 = Math.sin(dec0);
  const cosDec0 = Math.cos(dec0);
  const cosDra = Math.cos(dra);

  // Visibility check: cos(angular distance) > 0 means on the near side
  const cosc = sinDec * sinDec0 + cosDec * cosDec0 * cosDra;

  const l = cosDec * Math.sin(dra);
  const m = sinDec * cosDec0 - cosDec * sinDec0 * cosDra;

  return { l, m, visible: cosc > 0 };
}

/**
 * Inverse SIN projection: direction cosines (l, m) → celestial (RA, Dec).
 *
 * @param {number} l - Direction cosine l
 * @param {number} m - Direction cosine m
 * @param {number} ra0 - Phase center RA in radians
 * @param {number} dec0 - Phase center Dec in radians
 * @returns {{ ra: number, dec: number } | null} null if outside unit circle
 */
export function lmToCelestial(l, m, ra0, dec0) {
  const r = Math.sqrt(l * l + m * m);
  if (r > 1.0) return null;

  const sinDec0 = Math.sin(dec0);
  const cosDec0 = Math.cos(dec0);

  let dec, ra;
  if (r === 0) {
    dec = dec0;
    ra = ra0;
  } else {
    const cosc = Math.sqrt(1 - r * r); // cos(angular distance) for SIN
    dec = Math.asin(cosc * sinDec0 + m * cosDec0 / r * r);

    // More numerically stable formulation
    const sinc = r; // sin(angular distance) for SIN where theta = acos(r)
    dec = Math.asin(cosc * sinDec0 + (m * cosDec0 * sinc) / r);
    ra = ra0 + Math.atan2(l * sinc, r * cosDec0 * cosc - m * sinDec0 * sinc);
  }

  return { ra, dec };
}

/**
 * Inverse SIN view projection: normalized screen → celestial (RA, Dec).
 *
 * Maps the view plane using direction cosines (l, m) relative to the view
 * center, with edge scales sin(fovWidth/2) and sin(fovHeight/2) matching Aladin Lite.
 *
 * @param {number} x - Normalized screen x [-1, 1]
 * @param {number} y - Normalized screen y [-1, 1]
 * @param {number} viewRA - View center RA in radians
 * @param {number} viewDec - View center Dec in radians
 * @param {number} viewFov - Field of view on the largest canvas dimension, radians (Aladin ``setFoV``)
 * @param {number} aspect - Canvas aspect ratio (width/height)
 * @param {{ scaleX: number, scaleY: number } | null} [scales]
 * @param {number} [rotationRad=0] - View rotation from ``-aladin.getRotation()``
 * @returns {{ ra: number, dec: number } | null} null outside the SIN disk (r > 1)
 */
export function screenToCelestial(x, y, viewRA, viewDec, viewFov, aspect, scales = null, rotationRad = 0) {
  const { scaleX, scaleY } = resolveViewScales(viewFov, aspect, scales);
  const { l: lView, m: mView } = screenToViewLM(x, y, scaleX, scaleY, rotationRad);

  const r = Math.hypot(lView, mView);
  if (r > 1.0) return null;

  return lmToCelestial(lView, mView, viewRA, viewDec);
}

/**
 * Forward SIN view projection: celestial (RA, Dec) → normalized screen.
 *
 * @param {number} ra - Right ascension in radians
 * @param {number} dec - Declination in radians
 * @param {number} viewRA - View center RA in radians
 * @param {number} viewDec - View center Dec in radians
 * @param {number} viewFov - Field of view on the largest canvas dimension, radians (Aladin ``setFoV``)
 * @param {number} aspect - Canvas aspect ratio (width/height)
 * @param {{ scaleX: number, scaleY: number } | null} [scales]
 * @param {number} [rotationRad=0]
 * @returns {{ x: number, y: number } | null}
 */
export function celestialToScreen(ra, dec, viewRA, viewDec, viewFov, aspect, scales = null, rotationRad = 0) {
  const { l, m, visible } = celestialToLM(ra, dec, viewRA, viewDec);
  if (!visible) return null;

  const { scaleX, scaleY } = resolveViewScales(viewFov, aspect, scales);
  if (scaleX < 1e-15 || scaleY < 1e-15) return { x: 0, y: 0 };

  const { x, y } = viewLMToScreen(l, m, scaleX, scaleY, rotationRad);
  if (Math.hypot(l, m) > 1.0 + 1e-12) return null;

  return { x, y };
}

/**
 * Apply projection-aware pan: keep the sky point under the previous cursor
 * fixed on screen after the cursor moves.
 *
 * @param {number} x1 - Previous normalized screen x
 * @param {number} y1 - Previous normalized screen y
 * @param {number} x2 - Current normalized screen x
 * @param {number} y2 - Current normalized screen y
 * @param {number} viewRA - View center RA in radians
 * @param {number} viewDec - View center Dec in radians
 * @param {number} viewFov - Field of view in radians (largest dimension)
 * @param {number} aspect - Canvas width / height
 * @param {{ invertHorizontalPan?: boolean }} [options]
 * @returns {{ viewRA: number, viewDec: number } | null}
 */
export function panViewByScreenDrag(
  x1, y1, x2, y2, viewRA, viewDec, viewFov, aspect, options = {}
) {
  const scales = options.scales ?? null;
  const rotationRad = options.rotationRad ?? 0;
  const c1 = screenToCelestial(x1, y1, viewRA, viewDec, viewFov, aspect, scales, rotationRad);
  const c2 = screenToCelestial(x2, y2, viewRA, viewDec, viewFov, aspect, scales, rotationRad);
  if (!c1 || !c2) return null;

  let dRA = c1.ra - c2.ra;
  if (dRA > Math.PI) dRA -= 2 * Math.PI;
  if (dRA < -Math.PI) dRA += 2 * Math.PI;

  const panH = options.invertHorizontalPan === false ? 1 : -1;
  const decMin = -Math.PI / 2 + 0.001;
  const decMax = Math.PI / 2 - 0.001;

  return {
    viewRA: viewRA + panH * dRA,
    viewDec: Math.max(decMin, Math.min(decMax, viewDec + c1.dec - c2.dec)),
  };
}

/**
 * Direction cosines (l, m) → pixel coordinates.
 *
 * @param {number} l - Direction cosine
 * @param {number} m - Direction cosine
 * @param {number} cdelt1 - Pixel scale in radians (axis 1)
 * @param {number} cdelt2 - Pixel scale in radians (axis 2)
 * @param {number} crpix1 - Reference pixel (axis 1, 1-based)
 * @param {number} crpix2 - Reference pixel (axis 2, 1-based)
 * @returns {{ px: number, py: number }}
 */
export function lmToPixel(l, m, cdelt1, cdelt2, crpix1, crpix2) {
  // l,m are dimensionless direction cosines; cdelt is in radians
  const px = l / cdelt1 + crpix1;
  const py = m / cdelt2 + crpix2;
  return { px, py };
}

/**
 * Format RA in degrees to sexagesimal hours string.
 * @param {number} raDeg - RA in degrees
 * @returns {string}
 */
export function formatRA(raDeg) {
  // Normalize to [0, 360)
  let ra = ((raDeg % 360) + 360) % 360;
  const hours = ra / 15;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = ((hours - h) * 60 - m) * 60;
  return `${h}h${String(m).padStart(2, "0")}m${s.toFixed(1).padStart(4, "0")}s`;
}

/**
 * Format Dec in degrees to sexagesimal string.
 * @param {number} decDeg - Dec in degrees
 * @returns {string}
 */
export function formatDec(decDeg) {
  const sign = decDeg >= 0 ? "+" : "-";
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d) * 60 - m) * 60;
  return `${sign}${d}°${String(m).padStart(2, "0")}'${s.toFixed(1).padStart(4, "0")}"`;
}

export { DEG2RAD, RAD2DEG };
