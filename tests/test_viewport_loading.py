"""Viewport (field-of-view) chunk loading for SkyWidget (#34)."""

from __future__ import annotations

import numpy as np
import pytest
import xarray as xr
from astropy.coordinates import SkyCoord
from astropy.io.fits import Header
from astropy.wcs import WCS

import astropy.units as u
from astrowidget import CubeWindow, SkyWidget, adjust_wcs_for_window, open_dataset
from astrowidget.wcs import adjust_wcs_for_array_stride, view_pixel_bbox

N = 256
CDELT = 0.5  # deg/pixel → the image spans ~128° across
RA0, DEC0 = 120.0, 30.0


def _header(ra=RA0, dec=DEC0, lonpole=None) -> str:
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---SIN", "DEC--SIN"]
    w.wcs.crval = [ra, dec]
    w.wcs.cdelt = [-CDELT, CDELT]
    w.wcs.crpix = [N / 2 + 0.5, N / 2 + 0.5]
    w.wcs.cunit = ["deg", "deg"]
    if lonpole is not None:
        w.wcs.lonpole = lonpole
    return w.to_header().tostring(sep="\n")


def _wcs(**kwargs) -> WCS:
    return WCS(Header.fromstring(_header(**kwargs), sep="\n"))


def _dataset(n_t=2, n_f=2, header=None) -> xr.Dataset:
    rng = np.random.default_rng(3)
    data = rng.standard_normal((n_t, n_f, 1, N, N)).astype(np.float32)
    ds = xr.Dataset(
        data_vars={"SKY": (["time", "frequency", "polarization", "l", "m"], data)},
        coords={
            "time": np.arange(n_t, dtype=float) + 60000.0,
            "frequency": np.linspace(40e6, 60e6, n_f),
            "polarization": [0],
            "l": np.linspace(-1, 1, N),
            "m": np.linspace(-1, 1, N),
        },
    )
    ds.attrs["fits_wcs_header"] = header or _header()
    return ds


def _chunked(ds, chunk=32):
    store = {}
    ds.to_zarr(
        store, encoding={"SKY": {"chunks": (1, 1, 1, chunk, chunk)}}, consolidated=False
    )
    return open_dataset(store, chunks={}, consolidated=False)


def _widget(ds, *, max_size=64, viewport=True, lock=False) -> SkyWidget:
    w = SkyWidget()
    w.set_dataset(ds, max_size=max_size)
    w.overlay_view_lock = lock
    w.viewport_loading = viewport
    return w


def _view(w: SkyWidget, ra: float, dec: float, fov: float) -> None:
    """Simulate the frontend finishing a gesture, then the debounce firing."""
    w._suppress_gesture_observer = True
    try:
        with w.hold_trait_notifications():
            w.view_ra, w.view_dec, w.view_fov = ra, dec, fov
    finally:
        w._suppress_gesture_observer = False
    w._cancel_gesture_reproject_timer()
    w._run_debounced_reproject_at_view()


def _sky_at_pixels(wcs, xs, ys):
    ra, dec = wcs.all_pix2world(xs, ys, 0)
    return SkyCoord(ra * u.deg, dec * u.deg)


class TestWindowWcs:
    @pytest.mark.parametrize("start,stride", [((0, 0), (1, 1)), ((40, 96), (1, 1)),
                                              ((40, 96), (3, 2)), ((7, 0), (4, 4))])
    def test_window_wcs_maps_samples_to_same_sky(self, start, stride):
        full = _wcs(lonpole=170.0)
        win = adjust_wcs_for_window(full, *start, *stride)
        # Sample near the phase center (pixel 128), where SIN is defined.
        k0 = -(-(110 - min(start)) // max(stride))
        k = k0 + np.arange(10)
        got = _sky_at_pixels(win, k, k)
        want = _sky_at_pixels(full, start[0] + k * stride[0], start[1] + k * stride[1])
        assert got.separation(want).max().to(u.arcsec).value < 1e-6

    def test_matches_stride_helper_at_origin(self):
        full = _wcs()
        a = adjust_wcs_for_window(full, 0, 0, 4, 4)
        b = adjust_wcs_for_array_stride(full, 4, 4)
        np.testing.assert_allclose(a.wcs.crpix, b.wcs.crpix)
        np.testing.assert_allclose(a.wcs.cdelt, b.wcs.cdelt)


class TestViewPixelBbox:
    def test_centered_view_box_contains_view_and_scales_with_fov(self):
        full = _wcs()
        small = view_pixel_bbox(full, RA0, DEC0, 10.0)
        big = view_pixel_bbox(full, RA0, DEC0, 30.0)
        c = N / 2 - 0.5
        for box in (small, big):
            assert box[0] < c < box[1] and box[2] < c < box[3]
        assert (big[1] - big[0]) > 2.5 * (small[1] - small[0])
        # 10° square diagonal ≈ 14.1° ≈ 28 px at 0.5°/px (SIN compresses slightly)
        assert 24 < small[1] - small[0] < 34

    def test_box_covers_every_visible_corner(self):
        """Any rotation of the visible rectangle stays inside the bbox."""
        full = _wcs()
        ra, dec, fov = RA0 + 15.0, DEC0 - 10.0, 12.0
        box = view_pixel_bbox(full, ra, dec, fov)
        center = SkyCoord(ra * u.deg, dec * u.deg)
        half = fov / 2.0
        for pa in range(0, 360, 15):
            corner = center.directional_offset_by(pa * u.deg, np.hypot(half, half) * u.deg)
            x, y = full.all_world2pix(corner.ra.deg, corner.dec.deg, 0)
            assert box[0] <= x <= box[1] and box[2] <= y <= box[3]

    @pytest.mark.parametrize("fov", [0.0, -1.0, 180.0, float("nan")])
    def test_degenerate_fov_returns_none(self, fov):
        assert view_pixel_bbox(_wcs(), RA0, DEC0, fov) is None

    def test_view_on_far_side_returns_none(self):
        assert view_pixel_bbox(_wcs(), RA0 + 180.0, -DEC0, 10.0) is None


class TestViewportLoading:
    def test_off_by_default_and_full_image_unchanged(self):
        ds = _dataset()
        w = _widget(ds, viewport=False)
        before = w._current_data.copy()
        _view(w, RA0, DEC0, 5.0)
        assert w._frame_window is None
        np.testing.assert_array_equal(w._current_data, before)
        assert tuple(w.image_shape) == (64, 64)

    def test_zoom_in_loads_full_res_window(self):
        ds = _chunked(_dataset())
        w = _widget(ds)
        _view(w, RA0, DEC0, 8.0)
        win = w._frame_window
        assert isinstance(win, CubeWindow)
        assert (win.stride_l, win.stride_m) == (1, 1)
        assert win.l_start % 32 == 0 and win.m_start % 32 == 0
        full = ds["SKY"].isel(time=0, frequency=0, polarization=0).values
        np.testing.assert_array_equal(
            w._current_data, full[win.l_start:win.l_stop, win.m_start:win.m_stop]
        )
        assert w.crval == pytest.approx([RA0, DEC0])
        assert w.cdelt == pytest.approx([-CDELT, CDELT])
        assert w.crpix == pytest.approx([N / 2 + 0.5 - win.l_start, N / 2 + 0.5 - win.m_start])

    def test_window_registers_on_sky(self):
        """A source pixel lands at the same RA/Dec in the window and the full frame."""
        ds = _chunked(_dataset())
        w = _widget(ds)
        full_wcs = _wcs()
        _view(w, RA0 + 5.0, DEC0 + 3.0, 8.0)
        win = w._frame_window
        shown = w._wcs
        li, mi = win.l_start + 5, win.m_start + 9
        a = _sky_at_pixels(shown, [5], [9])
        b = _sky_at_pixels(full_wcs, [li], [mi])
        assert a.separation(b).max().to(u.arcsec).value < 1e-6
        assert w._current_data[5, 9] == ds["SKY"].values[0, 0, 0, li, mi]

    def test_vmin_vmax_kept_while_navigating(self):
        w = _widget(_chunked(_dataset()))
        limits = (w.vmin, w.vmax)
        _view(w, RA0, DEC0, 8.0)
        assert (w.vmin, w.vmax) == limits

    @pytest.mark.parametrize("lock", [False, True])
    def test_toggle_keeps_vmin_vmax(self, lock):
        w = _widget(_chunked(_dataset()), viewport=False, lock=lock)
        _view(w, RA0, DEC0, 8.0)
        limits = (w.vmin, w.vmax)
        w.viewport_loading = True
        assert w._frame_window is not None
        assert (w.vmin, w.vmax) == limits
        w.viewport_loading = False
        assert (w.vmin, w.vmax) == limits

    def test_small_pan_inside_margin_does_not_reload(self):
        w = _widget(_chunked(_dataset()))
        _view(w, RA0, DEC0, 8.0)
        win = w._frame_window
        calls = []
        orig = w._push_cube_frame
        w._push_cube_frame = lambda **kw: calls.append(kw) or orig(**kw)
        _view(w, RA0 + 0.2, DEC0 + 0.2, 8.0)
        assert w._frame_window == win
        assert calls == []

    def test_pan_past_margin_moves_window(self):
        w = _widget(_chunked(_dataset()))
        _view(w, RA0, DEC0, 8.0)
        first = w._frame_window
        _view(w, RA0 + 30.0, DEC0, 8.0)
        assert w._frame_window != first
        assert w._frame_window.l_start < first.l_start  # RA increases to -x

    def test_zoom_out_returns_to_full_image(self):
        ds = _chunked(_dataset())
        w = _widget(ds)
        _view(w, RA0, DEC0, 8.0)
        _view(w, RA0, DEC0, 150.0)
        assert w._frame_window is None
        assert tuple(w.image_shape) == (64, 64)
        assert w.crpix == pytest.approx(list(w._display_wcs.wcs.crpix))

    def test_toggle_off_restores_full_image_immediately(self):
        w = _widget(_chunked(_dataset()))
        _view(w, RA0, DEC0, 8.0)
        assert w._frame_window is not None
        w.viewport_loading = False
        assert w._frame_window is None
        assert tuple(w.image_shape) == (64, 64)

    def test_toggle_on_while_zoomed_loads_window(self):
        w = _widget(_chunked(_dataset()), viewport=False)
        _view(w, RA0, DEC0, 8.0)
        assert w._frame_window is None
        w.viewport_loading = True
        assert w._frame_window is not None

    def test_time_scrub_keeps_window_and_updates_data(self):
        ds = _chunked(_dataset())
        w = _widget(ds)
        _view(w, RA0, DEC0, 8.0)
        win = w._frame_window
        w.time_idx = 1
        assert w._frame_window == win
        np.testing.assert_array_equal(
            w._current_data,
            ds["SKY"].values[1, 0, 0, win.l_start:win.l_stop, win.m_start:win.m_stop],
        )

    def test_update_slice_with_center_and_fov_picks_window_for_target(self):
        w = _widget(_chunked(_dataset()))
        target = SkyCoord((RA0 - 20.0) * u.deg, (DEC0 + 10.0) * u.deg)
        w.update_slice(0, 1, center=target, fov=8.0 * u.deg)
        win = w._frame_window
        assert win is not None
        x, y = _wcs().all_world2pix(target.ra.deg, target.dec.deg, 0)
        assert win.l_start <= x < win.l_stop and win.m_start <= y < win.m_stop
        assert w.view_fov == pytest.approx(8.0)

    def test_external_frame_not_replaced(self):
        w = _widget(_chunked(_dataset()))
        data = np.full((16, 16), 7.0, np.float32)
        wcs = _wcs()
        w.set_image(data, wcs)
        _view(w, RA0, DEC0, 8.0)
        np.testing.assert_array_equal(w._current_data, data)
        w.update_slice(1, 0)  # back to cube frames
        assert w._external_frame is False
        _view(w, RA0, DEC0, 7.0)
        assert w._frame_window is not None

    def test_push_shader_frame_not_replaced_on_pan(self):
        w = _widget(_chunked(_dataset()))
        data = np.full((16, 16), 3.0, np.float32)
        w.push_shader_frame(data, _wcs())
        _view(w, RA0, DEC0, 8.0)
        np.testing.assert_array_equal(w._current_data, data)

    def test_view_lock_with_viewport_warps_window_around_view(self):
        ds = _chunked(_dataset(header=_header(lonpole=170.0)))
        w = _widget(ds, lock=True)
        ra, dec = RA0 + 4.0, DEC0 - 2.0
        _view(w, ra, dec, 8.0)
        assert w._frame_window is not None
        assert w.crval == pytest.approx([ra, dec])
        h, wd = w.image_shape
        assert w.crpix == pytest.approx([(h + 1) / 2.0, (wd + 1) / 2.0])
        # The visible region (8° ≈ 16 px at the window stride) is fully covered.
        c = np.array([h, wd]) // 2
        assert np.isfinite(w._current_data[c[0] - 16:c[0] + 16, c[1] - 16:c[1] + 16]).all()

    def test_view_lock_update_slice_center_not_rewarped(self, monkeypatch):
        """update_slice(center=…) under lock shows the target; the trailing
        debounce from its own view change must not warp it a second time."""
        w = _widget(_chunked(_dataset()), lock=True)
        target = SkyCoord((RA0 + 3.0) * u.deg, (DEC0 + 2.0) * u.deg)
        w.update_slice(1, 0, center=target, fov=8 * u.deg)
        w._cancel_gesture_reproject_timer()
        pushes = []
        monkeypatch.setattr(w, "_push_image_frame", lambda *a, **k: pushes.append(k))
        w._run_debounced_reproject_at_view()
        assert pushes == []

    def test_view_lock_gesture_always_rewarps(self, monkeypatch):
        """A frontend pan/zoom under lock re-warps even inside the margin."""
        w = _widget(_chunked(_dataset()), lock=True)
        _view(w, RA0, DEC0, 8.0)
        pushes = []
        monkeypatch.setattr(w, "_push_image_frame", lambda *a, **k: pushes.append(k))
        w.view_gesture_revision += 1
        w._cancel_gesture_reproject_timer()
        w._run_debounced_reproject_at_view()
        assert len(pushes) == 1

    def test_oblique_header_window_warped_to_window_center(self):
        """LONPOLE≠180 cannot be drawn natively; window must warp around itself."""
        ds = _chunked(_dataset(header=_header(lonpole=170.0)))
        w = _widget(ds)
        _view(w, RA0 + 10.0, DEC0, 8.0)
        win = w._frame_window
        assert win is not None
        h, wd = w.image_shape
        assert w.crpix == pytest.approx([(h + 1) / 2.0, (wd + 1) / 2.0])
        assert np.isfinite(w._current_data).mean() > 0.9

    def test_unchunked_numpy_dataset_still_windows(self):
        w = _widget(_dataset())
        _view(w, RA0, DEC0, 8.0)
        win = w._frame_window
        assert win is not None and win.l_start % 64 == 0

    def test_clear_overlay_disables_refresh(self):
        w = _widget(_chunked(_dataset()))
        w.clear_image()
        _view(w, RA0, DEC0, 8.0)
        assert tuple(w.image_shape) == (0, 0)

    def test_set_dataset_resets_window_state(self):
        w = _widget(_chunked(_dataset()))
        _view(w, RA0, DEC0, 8.0)
        w.set_dataset(_dataset(), max_size=64)
        assert w._frame_window is None and w._external_frame is False


def _gesture(w: SkyWidget) -> None:
    """Simulate a frontend pan/zoom gesture under view lock, then the debounce."""
    w.view_gesture_revision += 1
    w._cancel_gesture_reproject_timer()
    w._run_debounced_reproject_at_view()


class TestViewLockNavigation:
    @pytest.mark.parametrize("viewport", [False, True])
    def test_gesture_keeps_manual_limits(self, viewport):
        w = _widget(_chunked(_dataset()), viewport=viewport, lock=True)
        _view(w, RA0 + 2.0, DEC0, 8.0)
        w.vmin, w.vmax = -123.0, 456.0
        revision = w.image_revision
        _gesture(w)
        assert w.image_revision > revision  # it did re-warp
        assert (w.vmin, w.vmax) == (-123.0, 456.0)

    def test_explicit_reproject_at_view_still_rescales(self):
        w = _widget(_chunked(_dataset()), lock=True)
        w.vmin, w.vmax = -123.0, 456.0
        w.reproject_at_view()
        assert (w.vmin, w.vmax) != (-123.0, 456.0)

    @pytest.mark.parametrize("viewport", [False, True])
    @pytest.mark.parametrize("push", ["set_image", "push_shader_frame"])
    def test_gesture_does_not_replace_pushed_frame(self, viewport, push):
        w = _widget(_chunked(_dataset()), viewport=viewport, lock=True)
        data = np.full((16, 16), 77.0, np.float32)
        getattr(w, push)(data, _wcs())
        _gesture(w)
        _view(w, RA0 + 30.0, DEC0, 8.0)
        assert tuple(w.image_shape) == (16, 16)
        np.testing.assert_array_equal(w._current_data, data)
        assert w._external_frame is True


class _PausedRead:
    """Block the first cube read made on a non-main thread until released."""

    def __init__(self, cube, name):
        import threading

        self.started = threading.Event()
        self.release = threading.Event()
        self._main = threading.main_thread()
        self._orig = getattr(cube, name)
        self._armed = True
        setattr(cube, name, self)

    def __call__(self, *args, **kwargs):
        import threading

        result = self._orig(*args, **kwargs)
        if self._armed and threading.current_thread() is not self._main:
            self._armed = False
            self.started.set()
            assert self.release.wait(10), "paused read was never released"
        return result


def _start_debounce(w: SkyWidget, *, lock: bool):
    import threading

    if lock:
        w.view_gesture_revision += 1
    else:
        w._suppress_gesture_observer = True
        try:
            w.view_ra = RA0 + 30.0  # past the loaded margin → needs a reload
        finally:
            w._suppress_gesture_observer = False
    w._cancel_gesture_reproject_timer()
    errors = []

    def run():
        try:
            w._run_debounced_reproject_at_view()
        except Exception as exc:  # pragma: no cover - reported below
            errors.append(exc)

    t = threading.Thread(target=run)
    t.start()
    return t, errors


class TestInFlightDebounce:
    """A debounced load already running must not publish over newer state."""

    def _setup(self, *, lock: bool, viewport: bool = True):
        ds = _chunked(_dataset())
        w = _widget(ds, viewport=viewport, lock=lock)
        _view(w, RA0, DEC0, 8.0 if viewport else 150.0)
        name = "window_image" if viewport else "image"
        return ds, w, _PausedRead(w._cube, name)

    @pytest.mark.parametrize("lock,viewport", [(False, True), (True, True), (True, False)])
    def test_update_slice_wins(self, lock, viewport):
        ds, w, paused = self._setup(lock=lock, viewport=viewport)
        t, errors = _start_debounce(w, lock=lock)
        assert paused.started.wait(10)
        w.update_slice(1, 0)
        newer = w._current_data.copy()
        revision = w.image_revision
        paused.release.set()
        t.join(10)
        assert errors == []
        assert w.time_idx == 1
        assert w.image_revision == revision
        np.testing.assert_array_equal(w._current_data, newer)

    def test_time_trait_change_wins(self):
        _, w, paused = self._setup(lock=False)
        t, errors = _start_debounce(w, lock=False)
        assert paused.started.wait(10)
        w.time_idx = 1
        newer = w._current_data.copy()
        paused.release.set()
        t.join(10)
        assert errors == []
        np.testing.assert_array_equal(w._current_data, newer)

    def test_clear_image_wins(self):
        _, w, paused = self._setup(lock=False)
        t, errors = _start_debounce(w, lock=False)
        assert paused.started.wait(10)
        w.clear_image()
        paused.release.set()
        t.join(10)
        assert errors == []
        assert tuple(w.image_shape) == (0, 0)

    @pytest.mark.parametrize("push", ["set_image", "push_shader_frame"])
    def test_pushed_frame_wins(self, push):
        _, w, paused = self._setup(lock=True)
        t, errors = _start_debounce(w, lock=True)
        assert paused.started.wait(10)
        data = np.full((16, 16), 5.0, np.float32)
        getattr(w, push)(data, _wcs())
        paused.release.set()
        t.join(10)
        assert errors == []
        np.testing.assert_array_equal(w._current_data, data)
        assert w._external_frame is True

    def test_set_dataset_wins(self):
        _, w, paused = self._setup(lock=False)
        t, errors = _start_debounce(w, lock=False)
        assert paused.started.wait(10)
        other = _dataset(n_t=1, n_f=1)
        other["SKY"].values[:] = 42.0
        w.set_dataset(other, max_size=64)
        newer = w._current_data.copy()
        paused.release.set()
        t.join(10)
        assert errors == []
        np.testing.assert_array_equal(w._current_data, newer)
        assert w._frame_window is None

    def test_unchanged_state_still_publishes(self):
        _, w, paused = self._setup(lock=False)
        before = w._frame_window
        t, errors = _start_debounce(w, lock=False)
        assert paused.started.wait(10)
        paused.release.set()
        t.join(10)
        assert errors == []
        assert w._frame_window != before

    @pytest.mark.parametrize("method,lock", [("refresh_viewport", False),
                                             ("reproject_at_view", True)])
    def test_public_refresh_from_thread_loses_to_update_slice(self, method, lock):
        import threading

        _, w, paused = self._setup(lock=lock)
        if not lock:
            w._suppress_gesture_observer = True
            try:
                w.view_ra = RA0 + 30.0
            finally:
                w._suppress_gesture_observer = False
        t = threading.Thread(target=getattr(w, method))
        t.start()
        assert paused.started.wait(10)
        w.update_slice(1, 0)
        newer = w._current_data.copy()
        paused.release.set()
        t.join(10)
        assert w.time_idx == 1
        np.testing.assert_array_equal(w._current_data, newer)
