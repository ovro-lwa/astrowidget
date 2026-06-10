/**
 * Pan/zoom interaction handlers for the celestial sphere.
 *
 * Mouse drag rotates the view center on the sphere.
 * Scroll wheel changes the field of view (zoom).
 * Hover computes (RA, Dec) at cursor position.
 */

import { screenToCelestial, panViewByScreenDrag, formatRA, formatDec, DEG2RAD, RAD2DEG } from "./projection.js";

/**
 * Set up interaction handlers on a canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} renderer - Renderer from createRenderer()
 * @param {object} model - anywidget model
 * @param {HTMLElement} readoutEl - Element for coordinate readout text
 * @returns {{ destroy: () => void }}
 */
export function setupInteraction(canvas, renderer, model, readoutEl) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  // View state in radians (internal working units)
  let viewRA = (model.get("view_ra") || 0) * DEG2RAD;
  let viewDec = (model.get("view_dec") || 0) * DEG2RAD;
  let viewFov = (model.get("view_fov") || 180) * DEG2RAD;

  function syncToModel() {
    model.set("view_ra", viewRA * RAD2DEG);
    model.set("view_dec", viewDec * RAD2DEG);
    model.set("view_fov", viewFov * RAD2DEG);
    model.save_changes();
  }

  function updateRenderer() {
    renderer.setView(viewRA * RAD2DEG, viewDec * RAD2DEG, viewFov * RAD2DEG);
  }

  // --- Mouse drag (pan / sphere rotation) ---
  function onMouseDown(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = "grabbing";
  }

  function clientToScreen(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((clientY - rect.top) / rect.height) * 2 - 1),
    };
  }

  function onMouseMove(e) {
    if (dragging) {
      const aspect = canvas.clientWidth / canvas.clientHeight;
      const s1 = clientToScreen(lastX, lastY);
      const s2 = clientToScreen(e.clientX, e.clientY);
      const panned = panViewByScreenDrag(
        s1.x, s1.y, s2.x, s2.y,
        viewRA, viewDec, viewFov, aspect,
        { invertHorizontalPan: model.get("invert_horizontal_pan") !== false }
      );
      if (panned) {
        viewRA = panned.viewRA;
        viewDec = panned.viewDec;
      }

      lastX = e.clientX;
      lastY = e.clientY;

      updateRenderer();
      requestAnimationFrame(() => renderer.render());
    } else {
      // Hover: compute RA/Dec at cursor
      updateReadout(e);
    }
  }

  function onMouseUp() {
    if (dragging) {
      dragging = false;
      canvas.style.cursor = "grab";
      syncToModel();
    }
  }

  // --- Scroll zoom ---
  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
    viewFov *= factor;
    viewFov = Math.max(0.001 * DEG2RAD, Math.min(Math.PI, viewFov));

    updateRenderer();
    syncToModel();
    requestAnimationFrame(() => renderer.render());
  }

  // --- Hover readout ---
  function updateReadout(e) {
    if (!readoutEl) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    const aspect = canvas.clientWidth / canvas.clientHeight;

    const coord = screenToCelestial(x, y, viewRA, viewDec, viewFov, aspect);
    if (coord) {
      const raDeg = ((coord.ra * RAD2DEG) % 360 + 360) % 360;
      const decDeg = coord.dec * RAD2DEG;
      readoutEl.textContent = `${formatRA(raDeg)}  ${formatDec(decDeg)}`;
    } else {
      readoutEl.textContent = "";
    }
  }

  // --- Model → JS sync (Python sets view_ra etc.) ---
  function onModelViewChange() {
    viewRA = (model.get("view_ra") || 0) * DEG2RAD;
    viewDec = (model.get("view_dec") || 0) * DEG2RAD;
    viewFov = (model.get("view_fov") || 180) * DEG2RAD;
    updateRenderer();
    requestAnimationFrame(() => renderer.render());
  }

  // Listen for Python-side view changes
  model.on("change:view_ra", onModelViewChange);
  model.on("change:view_dec", onModelViewChange);
  model.on("change:view_fov", onModelViewChange);

  // Attach DOM events
  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // Set initial cursor
  canvas.style.cursor = "grab";

  return {
    destroy() {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
      model.off("change:view_ra", onModelViewChange);
      model.off("change:view_dec", onModelViewChange);
      model.off("change:view_fov", onModelViewChange);
    },
  };
}
