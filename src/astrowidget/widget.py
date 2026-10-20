"""SkyWidget — anywidget-based celestial sphere renderer.

Displays radio astronomy images on a rotatable celestial sphere using
WebGL2 fragment shader SIN projection. Image data is transferred as
raw float32 bytes — no FITS serialization.
"""

from __future__ import annotations

import os
import threading
import time
from collections import OrderedDict
from pathlib import Path
from typing import TYPE_CHECKING

import anywidget
import numpy as np
import traitlets

if TYPE_CHECKING:
    import astropy.units as u
    from astropy.coordinates import SkyCoord
    from astropy.wcs import WCS

    from astrowidget.cube import CubeWindow
    from astrowidget.wcs import ViewReprojectGeometry

_STATIC = Path(__file__).parent / "static"
_JS_PATH = _STATIC / "widget.js"
_VIEW_GESTURE_DEBOUNCE_S = 0.3
_REPROJECT_MAP_CACHE_SIZE = 4
_PROFILE_PUSH = os.environ.get("ASTROWIDGET_PROFILE_PUSH") == "1"
# Viewport loading pads the visible pixel box by this fraction of its size on
# every side, so short pans stay inside the loaded window.
_VIEWPORT_MARGIN = 0.5


def _center_key(center: SkyCoord | None) -> tuple[float, float] | None:
    """Rounded ICRS ``(ra, dec)`` used to compare reprojection centers."""
    if center is None:
        return None
    icrs = center.icrs
    return (round(float(icrs.ra.deg), 5), round(float(icrs.dec.deg), 5))


class SkyWidget(anywidget.AnyWidget):
    """Interactive celestial sphere widget with SIN projection.

    Renders a 2D radio image on a rotatable sphere. Pan by dragging,
    zoom with scroll wheel. Image data is sent as raw float32 bytes
    via anywidget's binary comm channel.

    Parameters
    ----------
    All parameters are traitlets that sync bidirectionally with the
    JavaScript frontend.

    Examples
    --------
    >>> from astrowidget import SkyWidget
    >>> from astropy.wcs import WCS
    >>> import numpy as np
    >>> widget = SkyWidget()
    >>> widget.set_image(np.random.randn(256, 256).astype(np.float32), wcs)
    >>> widget  # displays in notebook
    """

    _esm = _JS_PATH.read_text()
    _css = ""

    # --- Binary image data (raw float32 bytes, no JSON) ---
    image_data = traitlets.Bytes(b"").tag(sync=True)
    image_shape = traitlets.Tuple((0, 0)).tag(sync=True)

    # --- WCS parameters (float64 precision, transferred losslessly) ---
    crval = traitlets.Tuple((0.0, 0.0)).tag(sync=True)  # (RA, Dec) of phase center in degrees
    cdelt = traitlets.Tuple((0.0, 0.0)).tag(sync=True)  # pixel scale in degrees
    crpix = traitlets.Tuple((0.0, 0.0)).tag(sync=True)  # reference pixel (1-based FITS convention)

    # --- View state ---
    view_ra = traitlets.Float(0.0).tag(sync=True)   # current view center RA in degrees
    view_dec = traitlets.Float(0.0).tag(sync=True)  # current view center Dec in degrees
    view_fov = traitlets.Float(180.0).tag(sync=True) # field of view in degrees

    # --- View-locked overlay (reproject texture to match view center after pan) ---
    overlay_view_lock = traitlets.Bool(False).tag(sync=True)
    view_gesture_revision = traitlets.Int(0).tag(sync=True)

    # --- Viewport loading (Python only) ---
    # When on, a zoomed-in view loads only the zarr chunks it covers, at up to
    # full resolution, instead of the whole strided image (issue #34).
    viewport_loading = traitlets.Bool(False)

    invert_horizontal_pan = traitlets.Bool(True).tag(sync=True)  # map-style horizontal pan (default)

    # --- Display options ---
    colormap = traitlets.Unicode("inferno").tag(sync=True)
    stretch = traitlets.Unicode("linear").tag(sync=True)
    vmin = traitlets.Float(0.0).tag(sync=True)
    vmax = traitlets.Float(1.0).tag(sync=True)
    opacity = traitlets.Float(1.0).tag(sync=True)

    # --- Grid overlay ---
    show_grid = traitlets.Bool(True).tag(sync=True)

    # --- HiPS background ---
    background_survey = traitlets.Unicode("").tag(sync=True)  # empty = no background
    background_opacity = traitlets.Float(1.0).tag(sync=True)
    # NaN = leave Aladin Lite defaults; finite values call setCuts on the base layer.
    background_cut_min = traitlets.Float(float("nan")).tag(sync=True)
    background_cut_max = traitlets.Float(float("nan")).tag(sync=True)

    # --- Click events (JS → Python) ---
    clicked_coord = traitlets.Tuple((0.0, 0.0)).tag(sync=True)  # (RA, Dec) in degrees
    clicked_lm = traitlets.Tuple((0.0, 0.0)).tag(sync=True)     # (l, m) direction cosines
    # Diagnostic: both projection readouts for the same click pixel,
    # [hips_ra, hips_dec, webgl_ra, webgl_dec] in degrees (NaN when unavailable).
    # Lets callers detect overlay/HiPS projection disagreement.
    clicked_coord_debug = traitlets.List(trait=traitlets.Float()).tag(sync=True)
    # Monotonic counter so every canvas click notifies Python even if (l, m) is unchanged.
    click_tick = traitlets.Int(0).tag(sync=True)

    # --- Crosshair (Python → JS); values < -900 hide the marker ---
    crosshair_ra = traitlets.Float(-999.0).tag(sync=True)
    crosshair_dec = traitlets.Float(-999.0).tag(sync=True)

    # --- Slice indices (wired to PreloadedCube) ---
    time_idx = traitlets.Int(0).tag(sync=True)
    freq_idx = traitlets.Int(0).tag(sync=True)

    # Monotonic counter: JS redraws the image layer only when this changes so
    # image_data and WCS traits stay aligned (binary comm can arrive out of order).
    image_revision = traitlets.Int(0).tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._wcs = None
        self._current_data = None
        self._cube = None
        self._ds = None
        self._var = "SKY"
        self._display_wcs = None
        self._display_wcs_time: int | None = None
        self._full_wcs = None
        self._frame_window: CubeWindow | None = None
        self._frame_center: tuple[float, float] | None = None
        self._external_frame = False
        self._gesture_pending = False
        self._aladin = None
        self._suppress_slice_observer = False
        self._suppress_gesture_observer = False
        self._gesture_reproject_timer: threading.Timer | None = None
        # Guards frame state between the caller's thread and the debounce
        # timer thread. ``_frame_generation`` is a request counter: it
        # increases when a cube load is requested (slice change, pan/zoom,
        # refresh) and on every pushed frame or dataset/overlay reset. A cube
        # load publishes only if its request is still the newest, so the
        # newest request wins however the loads finish. ``_requested_window``
        # / ``_requested_center`` are what the newest request will show; the
        # "already showing this view" checks compare against them rather
        # than against the shown frame, so a request that matches an older
        # in-flight load still supersedes it.
        self._requested_window: CubeWindow | None = None
        self._requested_center: tuple[float, float] | None = None
        self._frame_lock = threading.RLock()
        self._frame_generation = 0
        self._last_load_ms = 0.0
        self._reproject_map_cache: OrderedDict[tuple, object] = OrderedDict()
        self._view_geometry_cache: ViewReprojectGeometry | None = None
        self._view_geometry_key: tuple | None = None
        self._last_reproject_view: tuple[float, float] | None = None
        self._last_reproject_shape: tuple[int, int] | None = None
        self.observe(self._on_slice_change, names=["time_idx", "freq_idx"])
        self.observe(self._on_view_gesture_revision, names=["view_gesture_revision"])
        self.observe(self._on_view_change, names=["view_ra", "view_dec", "view_fov"])
        self.observe(self._on_viewport_loading_change, names=["viewport_loading"])

    def _clear_reproject_map_cache(self) -> None:
        self._reproject_map_cache.clear()

    def _clear_view_geometry_cache(self) -> None:
        self._view_geometry_cache = None
        self._view_geometry_key = None
        self._last_reproject_view = None
        self._last_reproject_shape = None

    def _clear_reproject_caches(self) -> None:
        self._clear_reproject_map_cache()
        self._clear_view_geometry_cache()

    def _reproject_cache_key(
        self,
        wcs: WCS,
        shape: tuple[int, int],
        view_ra: float,
        view_dec: float,
    ) -> tuple:
        from astrowidget.wcs import reproject_wcs_fingerprint

        return (
            int(shape[0]),
            int(shape[1]),
            round(float(view_ra), 5),
            round(float(view_dec), 5),
            reproject_wcs_fingerprint(wcs),
        )

    def _get_or_build_view_geometry(
        self,
        wcs: WCS,
        shape: tuple[int, int],
        view_ra: float,
        view_dec: float,
    ) -> ViewReprojectGeometry:
        from astrowidget.wcs import build_view_reproject_geometry, view_reproject_geometry_key

        geom_key = view_reproject_geometry_key(shape, view_ra, view_dec, wcs)
        if self._view_geometry_key == geom_key and self._view_geometry_cache is not None:
            return self._view_geometry_cache

        geometry = build_view_reproject_geometry(
            wcs,
            shape,
            crval_ra=view_ra,
            crval_dec=view_dec,
        )
        self._view_geometry_cache = geometry
        self._view_geometry_key = geom_key
        self._last_reproject_view = (round(float(view_ra), 5), round(float(view_dec), 5))
        self._last_reproject_shape = (int(shape[0]), int(shape[1]))
        return geometry

    def _reproject_with_cached_maps(
        self,
        data: np.ndarray,
        wcs: WCS,
        view_ra: float,
        view_dec: float,
        *,
        output_template: WCS | None = None,
    ) -> tuple[np.ndarray, WCS]:
        """Warp *data* onto a naive SIN grid centered on the view.

        The output grid takes ``CDELT``/``CRPIX`` from *output_template*
        (default *wcs*). Windowed frames pass a template whose ``CRPIX`` is the
        array center, so the output covers the window rather than the
        window's offset from the phase center.
        """
        from astrowidget.wcs import (
            apply_reproject_maps,
            build_reproject_maps_from_view_geometry,
            reproject_output_scale_fingerprint,
        )

        template = wcs if output_template is None else output_template
        cache_key = self._reproject_cache_key(wcs, data.shape, view_ra, view_dec) + (
            reproject_output_scale_fingerprint(template),
        )
        maps = self._reproject_map_cache.get(cache_key)
        if maps is None:
            view_geometry = self._get_or_build_view_geometry(
                template, data.shape, view_ra, view_dec
            )
            maps = build_reproject_maps_from_view_geometry(wcs, view_geometry)
            self._reproject_map_cache[cache_key] = maps
            while len(self._reproject_map_cache) > _REPROJECT_MAP_CACHE_SIZE:
                self._reproject_map_cache.popitem(last=False)
        else:
            self._reproject_map_cache.move_to_end(cache_key)
        return apply_reproject_maps(data, maps), maps.wcs_out

    def _update_display_wcs(self, *, generation: int | None = None) -> None:
        """Rebuild display WCS for the current time slice (strided to cube resolution).

        With ``generation`` set, the result is stored only if that request
        is still the newest, so a superseded call cannot overwrite the WCS
        a newer call prepared. In every case it is stored only if
        ``time_idx`` has not moved since the build started.
        """
        from astrowidget.wcs import adjust_wcs_for_array_stride, get_wcs

        ds, cube, var = self._ds, self._cube, self._var
        if ds is None or cube is None:
            return
        wcs_time = int(self.time_idx)
        wcs = get_wcs(ds, var=var, time_idx=wcs_time)
        display = adjust_wcs_for_array_stride(wcs, cube.stride_l, cube.stride_m)
        with self._frame_lock:
            if generation is not None and generation != self._frame_generation:
                return
            if int(self.time_idx) != wcs_time:
                return
            self._full_wcs = wcs
            self._display_wcs = display
            self._display_wcs_time = wcs_time

    def _wcs_stale(self) -> bool:
        """True when the display WCS was built for another time than ``time_idx``.

        A superseded :meth:`update_slice` can leave ``time_idx`` ahead of the
        WCS it never finished building. Call with the frame lock held.
        """
        return self._ds is not None and self._display_wcs_time != int(self.time_idx)

    def _viewport_window(
        self,
        view_ra: float | None = None,
        view_dec: float | None = None,
        view_fov: float | None = None,
    ) -> CubeWindow | None:
        """Cube window for a view, or ``None`` to use the full strided image."""
        from astrowidget.wcs import view_pixel_bbox

        if not self.viewport_loading or self._cube is None or self._full_wcs is None:
            return None
        bbox = view_pixel_bbox(
            self._full_wcs,
            self.view_ra if view_ra is None else float(view_ra),
            self.view_dec if view_dec is None else float(view_dec),
            self.view_fov if view_fov is None else float(view_fov),
        )
        if bbox is None:
            return None
        l_min, l_max, m_min, m_max = bbox
        pad_l = (l_max - l_min) * _VIEWPORT_MARGIN
        pad_m = (m_max - m_min) * _VIEWPORT_MARGIN
        return self._cube.window_for_pixel_bbox(
            l_min - pad_l, l_max + pad_l, m_min - pad_m, m_max + pad_m
        )

    def _cube_frame(
        self,
        window: CubeWindow | None,
        center: SkyCoord | None,
    ) -> tuple[np.ndarray, WCS, SkyCoord | None, WCS | None]:
        """Load the current slice for *window*.

        Returns ``(data, wcs, reproject_center, output_template)`` for
        :meth:`_push_image_frame`. The full strided image keeps the existing
        reprojection behavior. A window carries its own offset WCS; when it
        must be warped (view lock, explicit center, or a header the shader
        cannot draw natively) it is warped onto a grid centered on the window
        instead of on the phase center.
        """
        from astrowidget.wcs import (
            adjust_wcs_for_window,
            wcs_projection_matches_naive_shader,
        )

        if window is None:
            data = self._cube.image(self.time_idx, self.freq_idx)
            return data, self._display_wcs, None, None

        data = self._cube.window_image(self.time_idx, self.freq_idx, window)
        wcs = adjust_wcs_for_window(
            self._full_wcs,
            window.l_start,
            window.m_start,
            window.stride_l,
            window.stride_m,
        )
        if center is None and wcs_projection_matches_naive_shader(wcs):
            return data, wcs, None, None
        template = wcs.deepcopy()
        template.wcs.crpix = [(data.shape[0] + 1) / 2.0, (data.shape[1] + 1) / 2.0]
        reproject_center = None
        if center is None:
            import astropy.units as u
            from astropy.coordinates import SkyCoord

            ra, dec = wcs.all_pix2world(
                (data.shape[0] - 1) / 2.0, (data.shape[1] - 1) / 2.0, 0
            )
            reproject_center = SkyCoord(
                ra=float(ra) * u.deg, dec=float(dec) * u.deg, frame="icrs"
            )
        return data, wcs, reproject_center, template

    def _push_cube_frame(
        self,
        *,
        center: SkyCoord | None = None,
        fov: u.Quantity | None = None,
        update_view: bool = True,
        percentile_low: float = 1.0,
        percentile_high: float = 99.0,
        rescale: bool = True,
        window_view: tuple[float, float, float] | None = None,
        generation: int | None = None,
    ) -> CubeWindow | None:
        """Load the current slice (windowed when viewport loading applies) and push it.

        ``window_view`` is the ``(ra, dec, fov)`` the window is chosen for;
        it defaults to the current view traits. Without ``generation`` this
        starts a new request (superseding any load in flight). Callers that
        claimed their request earlier (:meth:`_claim_request` /
        :meth:`_begin_cube_request`) pass that ``generation``; if a newer
        request has been claimed since, nothing is loaded. The frame is
        published only if no newer request, pushed frame or reset happened
        by the end of the load; otherwise the load is discarded. In both
        cases the shown window is returned unchanged.
        """
        with self._frame_lock:
            if generation is None:
                generation = self._claim_request()
            elif generation != self._frame_generation:
                return self._frame_window
            wcs_stale = self._wcs_stale()
        if wcs_stale:
            # Never pair one time's pixels with another time's WCS, and pick
            # the window with the WCS the frame will be shown on.
            self._update_display_wcs(generation=generation)
        with self._frame_lock:
            if generation != self._frame_generation:
                return self._frame_window
            window = self._viewport_window(*(window_view or ()))
            self._requested_window = window
            self._requested_center = _center_key(center)
        try:
            t_load = time.perf_counter()
            data, wcs, reproject_center, template = self._cube_frame(window, center)
            self._last_load_ms = (time.perf_counter() - t_load) * 1000.0
        except Exception:
            with self._frame_lock:
                if generation != self._frame_generation:
                    # Superseded (e.g. the dataset was swapped mid-read); its
                    # result would have been discarded anyway.
                    return self._frame_window
                self._requested_window = self._frame_window
                self._requested_center = self._frame_center
            raise
        with self._frame_lock:
            if generation != self._frame_generation:
                return self._frame_window
            self._push_image_frame(
                data,
                wcs,
                advance_generation=False,
                percentile_low=percentile_low,
                percentile_high=percentile_high,
                center=center,
                fov=fov,
                update_view=update_view,
                reproject_center=reproject_center,
                output_template=template,
                rescale=rescale,
            )
            self._frame_window = window
            self._frame_center = _center_key(center)
            self._external_frame = False
        return window

    def _refresh_slice(self, *, update_wcs: bool = False) -> None:
        """Load the current slice once and push a single image update to JS."""
        if self._cube is None:
            return
        with self._frame_lock:
            generation = self._claim_request()
            # A superseded update_slice can leave time_idx set before it built
            # that time's WCS, so check the WCS's own time, not just the trait.
            needs_wcs = update_wcs or self._display_wcs_time != int(self.time_idx)
        if needs_wcs:
            self._update_display_wcs(generation=generation)
        if self._display_wcs is None:
            return
        self._push_cube_frame(generation=generation)

    def _claim_request(self) -> int:
        """Claim a new request token; call with the frame lock held.

        Supersedes every request claimed earlier. A caller claims once, at
        entry, and carries the token through WCS preparation, loading and
        publication, so an older call can never re-enter as a newer request.
        """
        self._frame_generation += 1
        return self._frame_generation

    def _begin_cube_request(
        self, window: CubeWindow | None, center: SkyCoord | None
    ) -> int:
        """Claim a cube load request and record what it will show.

        Call with the frame lock held. Returns the generation to pass to
        :meth:`_push_cube_frame`.
        """
        self._claim_request()
        self._requested_window = window
        self._requested_center = _center_key(center)
        return self._frame_generation

    def _percentile_limits(
        self,
        data: np.ndarray,
        percentile_low: float,
        percentile_high: float,
    ) -> tuple[float, float] | None:
        finite = data[np.isfinite(data)]
        if finite.size == 0:
            return None
        lo, hi = np.percentile(finite, [percentile_low, percentile_high])
        return float(lo), float(hi)

    def _push_image_frame(
        self, data: np.ndarray, wcs: WCS, *, advance_generation: bool = True, **kwargs
    ) -> None:
        """Publish a frame under the frame lock.

        By default this advances the generation, so any cube load in flight
        is discarded (pushed frames and resets). Cube loads pass
        ``advance_generation=False``: their request already advanced it.
        See :meth:`_publish_image_frame` for the keyword arguments.
        """
        with self._frame_lock:
            if advance_generation:
                self._frame_generation += 1
            self._publish_image_frame(data, wcs, **kwargs)

    def _publish_image_frame(
        self,
        data: np.ndarray,
        wcs: WCS,
        *,
        percentile_low: float = 1.0,
        percentile_high: float = 99.0,
        center: SkyCoord | None = None,
        fov: u.Quantity | None = None,
        update_view: bool = True,
        reproject: bool = True,
        reproject_center: SkyCoord | None = None,
        output_template: WCS | None = None,
        rescale: bool = True,
    ) -> None:
        """Send image bytes, WCS, scaling, and optional view in one frontend draw.

        ``reproject=False`` uploads ``data`` and ``wcs`` unchanged. Callers that
        already warped onto the naive SIN shader grid use this so a second
        view-centered warp does not run.

        ``reproject_center`` overrides ``center`` as the warp center only
        (the view is still set from ``center``); ``output_template`` sets the
        output grid scale (see :meth:`_reproject_with_cached_maps`).
        ``rescale=False`` keeps the current ``vmin``/``vmax``.
        """
        from astropy.wcs import WCS as AstropyWCS

        import astropy.units as u

        if not isinstance(wcs, AstropyWCS):
            raise TypeError("wcs must be an astropy.wcs.WCS object")
        if not wcs.has_celestial:
            raise ValueError("wcs must have celestial axes (RA/Dec)")
        if data.ndim != 2:
            raise ValueError(f"data must be 2D, got {data.ndim}D")

        if data.dtype != np.float32:
            data = data.astype(np.float32)

        t_push = time.perf_counter()
        t_reproject = time.perf_counter()
        if reproject:
            from astrowidget.wcs import should_skip_shader_reproject

            warp_center = reproject_center if reproject_center is not None else center
            if warp_center is not None:
                view_ra = float(warp_center.icrs.ra.deg)
                view_dec = float(warp_center.icrs.dec.deg)
            else:
                view_ra = float(wcs.wcs.crval[0])
                view_dec = float(wcs.wcs.crval[1])
            skipped_reproject = should_skip_shader_reproject(wcs, view_ra, view_dec)
            if not skipped_reproject:
                data, wcs = self._reproject_with_cached_maps(
                    data, wcs, view_ra, view_dec, output_template=output_template
                )
        else:
            skipped_reproject = True
        reproject_ms = (time.perf_counter() - t_reproject) * 1000.0

        self._wcs = wcs
        self._current_data = data

        limits = (
            self._percentile_limits(data, percentile_low, percentile_high)
            if rescale
            else None
        )
        cel = wcs.celestial
        t_trait = time.perf_counter()
        with self.hold_trait_notifications():
            self.crval = (float(cel.wcs.crval[0]), float(cel.wcs.crval[1]))
            self.cdelt = (float(cel.wcs.cdelt[0]), float(cel.wcs.cdelt[1]))
            self.crpix = (float(cel.wcs.crpix[0]), float(cel.wcs.crpix[1]))
            self.image_shape = tuple(int(x) for x in data.shape)
            image_bytes = data.tobytes()
            self.image_data = image_bytes
            if limits is not None:
                self.vmin, self.vmax = limits
            if update_view:
                if center is not None:
                    self.view_ra = float(center.icrs.ra.deg)
                    self.view_dec = float(center.icrs.dec.deg)
                if fov is not None:
                    self.view_fov = float(fov.to(u.deg).value)
            self.image_revision += 1
        trait_ms = (time.perf_counter() - t_trait) * 1000.0
        if _PROFILE_PUSH:
            self._profile_last_push = {
                "bytes": len(image_bytes),
                "reproject_ms": reproject_ms,
                "trait_ms": trait_ms,
                "total_ms": (time.perf_counter() - t_push) * 1000.0,
                "skipped_reproject": skipped_reproject,
            }

    def _on_slice_change(self, change) -> None:
        """Observer: update displayed image when time_idx or freq_idx changes."""
        if self._suppress_slice_observer or self._cube is None:
            return
        self._refresh_slice(update_wcs=change.get("name") == "time_idx")

    def set_image(self, data: np.ndarray, wcs: WCS) -> None:
        """Send a 2D numpy array to the widget for display on the sphere.

        Parameters
        ----------
        data : np.ndarray
            2D float array (image pixels). Will be converted to float32.
        wcs : astropy.wcs.WCS
            Celestial WCS for SIN projection parameters.

        Raises
        ------
        TypeError
            If wcs is not an astropy WCS object.
        ValueError
            If wcs lacks celestial axes or data is not 2D.
        """
        from astropy.wcs import WCS as AstropyWCS

        if not isinstance(wcs, AstropyWCS):
            raise TypeError("wcs must be an astropy.wcs.WCS object")
        if not wcs.has_celestial:
            raise ValueError("wcs must have celestial axes (RA/Dec)")
        if data.ndim != 2:
            raise ValueError(f"data must be 2D, got {data.ndim}D")

        with self._frame_lock:
            self._push_image_frame(data, wcs)
            self._mark_external_frame()

    def _mark_external_frame(self) -> None:
        """Record that the shown frame did not come from the cube.

        Viewport loading then leaves it alone instead of replacing it with a
        cube window on the next pan or zoom.
        """
        self._frame_window = None
        self._frame_center = None
        self._requested_window = None
        self._requested_center = None
        self._external_frame = True

    def push_shader_frame(
        self,
        data: np.ndarray,
        wcs: WCS,
        *,
        time_idx: int | None = None,
        freq_idx: int | None = None,
        percentile_low: float = 1.0,
        percentile_high: float = 99.0,
    ) -> None:
        """Upload a frame that is already on the naive SIN shader grid.

        Does not reproject and does not change ``view_ra``, ``view_dec``, or
        ``view_fov``. ``time_idx`` / ``freq_idx`` update without firing the
        full-plane slice observer.
        """
        suppress_slice = self._suppress_slice_observer
        self._frame_lock.acquire()
        self._suppress_slice_observer = True
        self._suppress_gesture_observer = True
        try:
            if time_idx is not None:
                self.time_idx = int(time_idx)
                if self._display_wcs is None or self._display_wcs_time != int(time_idx):
                    self._update_display_wcs()
            if freq_idx is not None:
                self.freq_idx = int(freq_idx)
            self._push_image_frame(
                data,
                wcs,
                percentile_low=percentile_low,
                percentile_high=percentile_high,
                center=None,
                fov=None,
                update_view=False,
                reproject=False,
            )
            self._mark_external_frame()
        finally:
            self._suppress_slice_observer = suppress_slice
            self._suppress_gesture_observer = False
            self._frame_lock.release()

    def view_center_skycoord(self) -> SkyCoord:
        """Return the current view center as an ICRS sky coordinate."""
        import astropy.units as u
        from astropy.coordinates import SkyCoord

        return SkyCoord(ra=self.view_ra * u.deg, dec=self.view_dec * u.deg, frame="icrs")

    def _cancel_gesture_reproject_timer(self) -> None:
        """Cancel a pending debounce. A callback already running is not
        stopped; the frame generation check discards its result instead."""
        with self._frame_lock:
            if self._gesture_reproject_timer is not None:
                self._gesture_reproject_timer.cancel()
                self._gesture_reproject_timer = None

    def _schedule_reproject_at_view(self) -> None:
        with self._frame_lock:
            self._cancel_gesture_reproject_timer()
            timer = threading.Timer(
                _VIEW_GESTURE_DEBOUNCE_S, self._run_debounced_reproject_at_view
            )
            timer.daemon = True
            self._gesture_reproject_timer = timer
            timer.start()

    def _run_debounced_reproject_at_view(self) -> None:
        """One debounced refresh after pan/zoom (view lock and/or viewport loading).

        Both triggers share this timer so a gesture never loads twice. Under
        view lock, a frontend gesture always re-warps (as before viewport
        loading existed); a view change alone re-warps only when the shown
        frame no longer matches the view, so a Python ``update_slice(center=…)``
        is not warped twice. Navigation keeps ``vmin``/``vmax`` and never
        replaces a frame pushed with ``set_image`` / ``push_shader_frame``.

        Runs on the timer thread. The decision and the request are made
        together under the frame lock, then the slice is loaded outside it
        and published only if this is still the newest request and no frame
        was pushed and no dataset or overlay reset happened since. A view
        that matches the window an older in-flight load is fetching does not
        load again; any other view supersedes that load.
        """
        with self._frame_lock:
            if self._gesture_reproject_timer is threading.current_thread():
                self._gesture_reproject_timer = None
            gesture, self._gesture_pending = self._gesture_pending, False
            if self._external_frame or self._cube is None or self._display_wcs is None:
                return
            if self.image_shape == (0, 0):
                return
            view = (float(self.view_ra), float(self.view_dec), float(self.view_fov))
            window = self._viewport_window(*view)
            # With a stale WCS the window above is not the one that will be
            # loaded, so it cannot prove the view is already covered.
            wcs_stale = self._wcs_stale()
            if self.overlay_view_lock:
                if not (gesture or wcs_stale or self._lock_frame_stale()):
                    return
                center = self.view_center_skycoord()
            elif not self._viewport_refresh_applies() or (
                window == self._requested_window and not wcs_stale
            ):
                return
            else:
                center = None
            generation = self._begin_cube_request(window, center)
        self._push_cube_frame(
            center=center,
            update_view=False,
            rescale=False,
            window_view=view,
            generation=generation,
        )

    def _lock_frame_stale(self) -> bool:
        """True when the newest view-locked request no longer matches the view."""
        if not self._viewport_refresh_applies():
            return False
        center = (round(float(self.view_ra), 5), round(float(self.view_dec), 5))
        return (
            self._requested_center != center
            or self._viewport_window() != self._requested_window
        )

    def _on_view_gesture_revision(self, _change) -> None:
        """Debounced handler: reproject overlay to current view after pan/zoom."""
        if self._suppress_gesture_observer or not self.overlay_view_lock:
            return
        self._clear_view_geometry_cache()
        if self._cube is None or self.image_shape == (0, 0):
            return
        self._gesture_pending = True
        self._schedule_reproject_at_view()

    def _viewport_refresh_applies(self) -> bool:
        return (
            self.viewport_loading
            and self._cube is not None
            and self._display_wcs is not None
            and not self._external_frame
            and self.image_shape != (0, 0)
        )

    def _on_view_change(self, _change) -> None:
        """Debounced handler: reload the viewport window after the view moves."""
        if self._suppress_gesture_observer or not self._viewport_refresh_applies():
            return
        self._schedule_reproject_at_view()

    def _on_viewport_loading_change(self, _change) -> None:
        """Switch between windowed and full-image loading immediately."""
        if self._suppress_gesture_observer or self._cube is None:
            return
        if self._external_frame or self._display_wcs is None or self.image_shape == (0, 0):
            return
        with self._frame_lock:
            view = (float(self.view_ra), float(self.view_dec), float(self.view_fov))
            window = self._viewport_window(*view)
            if self.overlay_view_lock:
                center = self.view_center_skycoord()
            elif window == self._requested_window:
                return
            else:
                center = None
            generation = self._begin_cube_request(window, center)
        self._push_cube_frame(
            center=center,
            update_view=False,
            rescale=False,
            window_view=view,
            generation=generation,
        )

    def refresh_viewport(self) -> CubeWindow | None:
        """Reload the current slice for the current view when viewport loading is on.

        Loads only when the view needs a different window than the one shown
        (zoomed in further, panned past the loaded margin, or zoomed back out
        to the full image). Keeps ``vmin``/``vmax`` so the color scale does
        not jump while navigating. Returns the window now shown (``None`` =
        full strided image). Safe to call from another thread: the newest
        request wins, so if a later navigation, slice change or pushed frame
        overtakes this load, the load is discarded.
        """
        with self._frame_lock:
            if not self._viewport_refresh_applies():
                return self._frame_window
            view = (float(self.view_ra), float(self.view_dec), float(self.view_fov))
            window = self._viewport_window(*view)
            if window == self._requested_window and not self._wcs_stale():
                return self._frame_window
            generation = self._begin_cube_request(window, None)
        return self._push_cube_frame(
            update_view=False, rescale=False, window_view=view, generation=generation
        )

    def reproject_at_view(
        self,
        *,
        percentile_low: float = 1.0,
        percentile_high: float = 99.0,
    ) -> None:
        """Re-upload the current slice reprojected to ``view_ra``/``view_dec``.

        No-op when ``overlay_view_lock`` is false, no cube is loaded, or the
        overlay was cleared. Does not change view traits (``update_view=False``).
        With ``viewport_loading`` on, the slice is windowed to the view.
        An explicit call rescales ``vmin``/``vmax`` and draws the cube slice
        even over a pushed frame; the debounced pan/zoom path does neither.
        Like :meth:`refresh_viewport`, a load overtaken by a newer request,
        slice change or pushed frame is discarded.
        """
        with self._frame_lock:
            if not self.overlay_view_lock:
                return
            if self._cube is None or self._display_wcs is None:
                return
            if self.image_shape == (0, 0):
                return
            # Capture the view and claim the request under one lock, so an
            # older call cannot claim later with a stale center.
            center = self.view_center_skycoord()
            view = (float(self.view_ra), float(self.view_dec), float(self.view_fov))
            generation = self._begin_cube_request(self._viewport_window(*view), center)
        self._push_cube_frame(
            center=center,
            update_view=False,
            percentile_low=percentile_low,
            percentile_high=percentile_high,
            window_view=view,
            generation=generation,
        )

    def clear_image(self) -> None:
        """Remove the radio overlay until the next :meth:`update_slice` / :meth:`set_image`."""
        with self._frame_lock, self.hold_trait_notifications():
            self._frame_generation += 1
            self._clear_reproject_caches()
            self.image_data = b""
            self.image_shape = (0, 0)
            self.image_revision += 1

    def set_crosshair(self, coord: SkyCoord | None) -> None:
        """Show a celestial crosshair at ``coord``, or hide it when ``coord`` is None."""
        with self.hold_trait_notifications():
            if coord is None:
                self.crosshair_ra = -999.0
                self.crosshair_dec = -999.0
                return
            icrs = coord.icrs
            self.crosshair_ra = float(icrs.ra.deg)
            self.crosshair_dec = float(icrs.dec.deg)

    def goto(self, target: SkyCoord, fov: u.Quantity | None = None) -> None:
        """Navigate the view to a celestial target.

        Parameters
        ----------
        target : astropy.coordinates.SkyCoord
            Target position on the sky.
        fov : astropy.units.Quantity, optional
            Field of view (e.g., ``10 * u.deg``). If None, keeps current FOV.
        """
        import astropy.units as u

        self._clear_view_geometry_cache()
        self.view_ra = float(target.icrs.ra.deg)
        self.view_dec = float(target.icrs.dec.deg)
        if fov is not None:
            self.view_fov = float(fov.to(u.deg).value)

    def set_dataset(
        self,
        ds,
        var: str = "SKY",
        pol: int = 0,
        max_size: int = 512,
        *,
        defer_display: bool = False,
    ) -> None:
        """Load a zarr-backed dataset for interactive exploration.

        Creates a PreloadedCube for cached slice access and displays
        the initial slice unless ``defer_display`` is True.

        Parameters
        ----------
        ds : xr.Dataset
            Dataset with dimensions (time, frequency, polarization, l, m).
        var : str, default "SKY"
            Data variable name.
        pol : int, default 0
            Polarization index.
        max_size : int, default 512
            Maximum spatial dimension for display.
        defer_display : bool, default False
            When True, prepare the cube only; call :meth:`update_slice` to
            push the first image (avoids a throwaway slice load and comm transfer).
        """
        from astrowidget.cube import PreloadedCube
        from astrowidget.wcs import get_wcs

        with self._frame_lock:
            self._frame_generation += 1
            self._clear_reproject_caches()
            self._cancel_gesture_reproject_timer()
            self._ds = ds
            self._var = var
            self._cube = PreloadedCube(ds, var=var, pol=pol, max_size=max_size)
            self._frame_window = None
            self._frame_center = None
            self._requested_window = None
            self._requested_center = None
            self._display_wcs_time = None
            self._external_frame = False

        if defer_display:
            # Caller uses update_slice(); avoid trait updates that fire the slice observer.
            self._display_wcs = None
            self._full_wcs = None
            return

        self._suppress_slice_observer = True
        try:
            with self.hold_trait_notifications():
                self.time_idx = 0
                self.freq_idx = 0
            self._update_display_wcs()
        finally:
            self._suppress_slice_observer = False

        # Display initial slice (full strided image; the fitted FOV below
        # shows the whole image, so a viewport window would not apply).
        self._push_image_frame(self._cube.image(0, 0), self._display_wcs)

        # Navigate to phase center with FOV fitted to image extent (full-res WCS)
        import astropy.units as u
        from astropy.coordinates import SkyCoord

        wcs = get_wcs(ds, var=var, time_idx=0)
        phase_center = SkyCoord(
            ra=wcs.wcs.crval[0], dec=wcs.wcs.crval[1],
            unit="deg", frame="fk5",
        )
        # Image angular extent ≈ max(npix * |cdelt|) across both axes
        n_l = ds.sizes.get("l", ds.sizes.get("x", 256))
        n_m = ds.sizes.get("m", ds.sizes.get("y", 256))
        extent_deg = max(
            n_l * abs(wcs.wcs.cdelt[0]),
            n_m * abs(wcs.wcs.cdelt[1]),
        )
        # Use 90% of the extent as FOV so the image fills the view with margin
        fov = min(extent_deg * 0.9, 180.0)
        self.goto(phase_center, fov=fov * u.deg)

    def update_slice(
        self,
        time_idx: int,
        freq_idx: int,
        *,
        center: SkyCoord | None = None,
        fov: u.Quantity | None = None,
        percentile_low: float | None = None,
        percentile_high: float | None = None,
        view_lock: bool | None = None,
    ) -> None:
        """Update the displayed image to a different time/frequency slice.

        Requires ``set_dataset()`` to have been called first.

        Optional ``center`` and ``fov`` update the view in the same atomic
        frontend redraw as the new slice (avoids a transient WCS/image mismatch).
        When ``view_lock`` is true (or ``overlay_view_lock`` is enabled) and
        ``center`` is omitted, the slice is reprojected to the current
        ``view_ra``/``view_dec``. An explicit ``center`` always overrides view lock.
        ``percentile_low`` / ``percentile_high`` override the default display
        scaling for this slice.

        Parameters
        ----------
        time_idx : int
            Time index.
        freq_idx : int
            Frequency index.
        center : SkyCoord, optional
            Recenter the view on this target after loading the slice.
        fov : Quantity, optional
            Field of view for ``center`` (e.g. ``8 * u.deg``).
        percentile_low, percentile_high : float, optional
            Percentile limits for ``vmin``/``vmax`` on this slice.
        view_lock : bool, optional
            When true, reproject to current view center if ``center`` is omitted.
            Defaults to ``overlay_view_lock``.
        """
        if not hasattr(self, "_cube") or self._cube is None:
            raise RuntimeError("Call set_dataset() before update_slice()")
        use_view_lock = self.overlay_view_lock if view_lock is None else view_lock
        explicit_center = center is not None
        scale_low = 1.0 if percentile_low is None else float(percentile_low)
        scale_high = 99.0 if percentile_high is None else float(percentile_high)
        self._suppress_slice_observer = True
        self._suppress_gesture_observer = True
        try:
            with self._frame_lock:
                # Claim this request once, together with the slice traits and
                # the view-lock center, so they agree with the request order.
                # The token is carried through WCS preparation, loading and
                # publication; if a newer request is claimed meanwhile, this
                # call stops and leaves the newer one's state alone.
                generation = self._claim_request()
                if use_view_lock and center is None:
                    center = self.view_center_skycoord()
                with self.hold_trait_notifications():
                    self.time_idx = int(time_idx)
                    self.freq_idx = int(freq_idx)
                needs_wcs = (
                    self._display_wcs is None or self._display_wcs_time != int(time_idx)
                )
            if needs_wcs:
                self._update_display_wcs(generation=generation)
            with self._frame_lock:
                if generation != self._frame_generation:
                    return
            if self._display_wcs is None:
                msg = (
                    f"Could not build display WCS for time_idx={int(time_idx)}, "
                    f"freq_idx={int(freq_idx)}"
                )
                raise RuntimeError(msg)
            t_update = time.perf_counter()
            import astropy.units as u

            window_view = None
            if center is not None:
                window_view = (
                    float(center.icrs.ra.deg),
                    float(center.icrs.dec.deg),
                    float(fov.to(u.deg).value) if fov is not None else float(self.view_fov),
                )
            elif fov is not None:
                window_view = (self.view_ra, self.view_dec, float(fov.to(u.deg).value))
            self._push_cube_frame(
                percentile_low=scale_low,
                percentile_high=scale_high,
                center=center,
                fov=fov,
                update_view=fov is not None or not use_view_lock or explicit_center,
                window_view=window_view,
                generation=generation,
            )
            if _PROFILE_PUSH:
                profile = dict(getattr(self, "_profile_last_push", {}))
                profile["zarr_ms"] = self._last_load_ms
                profile["total_ms"] = (time.perf_counter() - t_update) * 1000.0
                self._profile_last_push = profile
        finally:
            self._suppress_slice_observer = False
            self._suppress_gesture_observer = False

    def overlay(self, survey: str = "DSS", height: int = 600):
        """Display this widget overlaid on HiPS survey tiles.

        Returns an ipywidgets container with Aladin Lite behind and
        the SkyWidget on top. The radio image pixels are transparent
        where there's no data, so the survey tiles show through.

        Parameters
        ----------
        survey : str, default "DSS"
            Survey preset name or HiPS URL.
        height : int, default 600
            Container height in pixels.

        Returns
        -------
        ipywidgets.GridBox
            Container with both widgets stacked.
        """
        import ipywidgets as widgets

        aladin = self.create_background(survey)

        # Signal JS to use transparent canvas background
        self.background_survey = survey

        # Stack using CSS Grid — both widgets in the same grid cell
        self.layout = widgets.Layout(grid_area="1 / 1")
        aladin.layout = widgets.Layout(grid_area="1 / 1")

        container = widgets.GridBox(
            children=[aladin, self],
            layout=widgets.Layout(
                width="100%",
                grid_template_columns="1fr",
                grid_template_rows=f"{height}px",
            ),
        )
        self._aladin = aladin
        return container

    def create_background(self, survey: str = "CDS/P/DSS2/color", fov: float | None = None):
        """Create an ipyaladin widget synced to this widget's view.

        Returns an Aladin widget that can be displayed alongside the
        SkyWidget. The Aladin widget shows HiPS survey tiles as a
        reference background.

        Parameters
        ----------
        survey : str, default "CDS/P/DSS2/color"
            HiPS survey URL or preset name.
        fov : float, optional
            Field of view in degrees. Defaults to this widget's current FOV.

        Returns
        -------
        ipyaladin.Aladin
            The Aladin widget instance.
        """
        from astropy.coordinates import SkyCoord
        from ipyaladin import Aladin

        PRESETS = {
            "DSS": "CDS/P/DSS2/color",
            "2MASS": "CDS/P/2MASS/color",
            "WISE": "CDS/P/allWISE/color",
            "Planck": "CDS/P/PLANCK/R2/HFI/color",
            "SDSS": "CDS/P/SDSS9/color",
            "Mellinger": "CDS/P/Mellinger/color",
            "Fermi": "CDS/P/Fermi/color",
            "Haslam408": "CDS/P/HI4PI/NHI",
        }
        hips_url = PRESETS.get(survey, survey)
        view_fov = fov if fov is not None else self.view_fov

        target = SkyCoord(ra=self.view_ra, dec=self.view_dec, unit="deg", frame="fk5")
        aladin = Aladin(
            target=target,
            fov=view_fov,
            survey=hips_url,
            projection="SIN",
            show_coo_grid=True,
            height=600,
        )
        return aladin

    def auto_scale(
        self,
        percentile_low: float = 1,
        percentile_high: float = 99,
        *,
        bump_revision: bool = True,
    ) -> None:
        """Set vmin/vmax from data percentiles.

        Parameters
        ----------
        percentile_low : float
            Lower percentile for vmin (default 1).
        percentile_high : float
            Upper percentile for vmax (default 99).
        bump_revision : bool, default True
            When True, trigger one frontend redraw after updating scaling.
        """
        if self._current_data is None:
            return
        limits = self._percentile_limits(
            self._current_data,
            percentile_low,
            percentile_high,
        )
        if limits is None:
            return
        with self.hold_trait_notifications():
            self.vmin, self.vmax = limits
            if bump_revision:
                self.image_revision += 1
