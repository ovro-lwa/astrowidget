"""Tests for SkyViewer Panel wrapper and click events."""

from __future__ import annotations

import numpy as np
import xarray as xr
from astropy.wcs import WCS


def _make_wcs_header_str():
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---SIN", "DEC--SIN"]
    w.wcs.crval = [180.0, 45.0]
    w.wcs.cdelt = [-0.1, 0.1]
    w.wcs.crpix = [8.5, 8.5]
    w.wcs.cunit = ["deg", "deg"]
    return w.to_header().tostring(sep="\n")


def _radec_at_lm(ds: xr.Dataset, l_val: float, m_val: float) -> tuple[float, float]:
    """Celestial coordinates at the nearest full-res (l, m) grid point."""
    from astropy.io.fits import Header

    hdr = ds.attrs["fits_wcs_header"]
    w = WCS(Header.fromstring(hdr, sep="\n"))
    l_idx = int(np.argmin(np.abs(ds.coords["l"].values - l_val)))
    m_idx = int(np.argmin(np.abs(ds.coords["m"].values - m_val)))
    ra, dec = w.all_pix2world(l_idx, m_idx, 0)
    return float(ra), float(dec)


def _make_dataset(n_t=3, n_f=4):
    data = np.random.randn(n_t, n_f, 1, 16, 16).astype(np.float32)
    return xr.Dataset(
        data_vars={"SKY": (["time", "frequency", "polarization", "l", "m"], data)},
        coords={
            "time": np.linspace(60000, 60001, n_t),
            "frequency": np.linspace(40e6, 80e6, n_f),
            "polarization": [0],
            "l": np.linspace(-0.5, 0.5, 16),
            "m": np.linspace(-0.5, 0.5, 16),
        },
        attrs={"fits_wcs_header": _make_wcs_header_str()},
    )


class TestClickEvents:
    def test_clicked_coord_traitlet(self):
        from astrowidget import SkyWidget
        w = SkyWidget()
        assert w.clicked_coord == (0.0, 0.0)

    def test_clicked_lm_traitlet(self):
        from astrowidget import SkyWidget
        w = SkyWidget()
        assert w.clicked_lm == (0.0, 0.0)

    def test_clicked_coord_settable(self):
        from astrowidget import SkyWidget
        w = SkyWidget()
        w.clicked_coord = (180.0, 45.0)
        assert w.clicked_coord == (180.0, 45.0)


class TestSkyViewer:
    def test_instantiation(self):
        from astrowidget.viewer import SkyViewer
        ds = _make_dataset()
        viewer = SkyViewer(ds)
        assert viewer.time_idx == 0
        assert viewer.freq_idx == 0
        assert viewer.cmap == "inferno"
        assert viewer.invert_horizontal_pan is True
        assert viewer._widget.invert_horizontal_pan is True

    def test_time_freq_bounds(self):
        from astrowidget.viewer import SkyViewer
        ds = _make_dataset(n_t=5, n_f=8)
        viewer = SkyViewer(ds)
        assert viewer.param.time_idx.bounds == (0, 4)
        assert viewer.param.freq_idx.bounds == (0, 7)

    def test_param_change_updates_widget(self):
        from astrowidget.viewer import SkyViewer
        ds = _make_dataset()
        viewer = SkyViewer(ds)

        viewer.time_idx = 1
        assert viewer._widget.time_idx == 1

    def test_slice_change_calls_update_slice_once(self, monkeypatch):
        from astrowidget.viewer import SkyViewer

        ds = _make_dataset()
        viewer = SkyViewer(ds)
        calls = []
        monkeypatch.setattr(
            viewer._widget,
            "update_slice",
            lambda t, f: calls.append((t, f)),
        )
        viewer.time_idx = 2
        assert calls == [(2, viewer.freq_idx)]

        viewer.cmap = "viridis"
        assert viewer._widget.colormap == "viridis"

        viewer.stretch = "log"
        assert viewer._widget.stretch == "log"

        viewer.show_grid = False
        assert viewer._widget.show_grid is False

        viewer.invert_horizontal_pan = False
        assert viewer._widget.invert_horizontal_pan is False

    def test_clicked_coord_updates_linked_panes(self):
        from astrowidget.viewer import SkyViewer

        ds = _make_dataset()
        viewer = SkyViewer(ds)
        layout = viewer.panel()
        assert layout is viewer._panel_root

        assert len(viewer._spectrum_cds.data["x"]) == 0

        l0 = float(ds.coords["l"].values[3])
        m0 = float(ds.coords["m"].values[4])
        viewer._widget.clicked_coord = _radec_at_lm(ds, l0, m0)
        viewer._widget.click_tick = viewer._widget.click_tick + 1

        assert len(viewer._spectrum_cds.data["x"]) == ds.sizes["frequency"]
        assert len(viewer._lightcurve_cds.data["x"]) == ds.sizes["time"]
        assert "RA=" in viewer._spectrum_fig.title.text
        assert "Dec=" in viewer._spectrum_fig.title.text

    def test_lightcurve_datetime64_time_plotted_as_mjd(self):
        import pandas as pd

        from astrowidget.viewer import SkyViewer

        n_t, n_f = 3, 4
        data = np.random.randn(n_t, n_f, 1, 8, 8).astype(np.float32)
        times = pd.date_range("2024-06-01", periods=n_t, freq="h").to_numpy(dtype="datetime64[ns]")
        ds = xr.Dataset(
            data_vars={"SKY": (["time", "frequency", "polarization", "l", "m"], data)},
            coords={
                "time": times,
                "frequency": np.linspace(40e6, 80e6, n_f),
                "polarization": [0],
                "l": np.linspace(-0.2, 0.2, 8),
                "m": np.linspace(-0.2, 0.2, 8),
            },
            attrs={"fits_wcs_header": _make_wcs_header_str()},
        )
        viewer = SkyViewer(ds)
        viewer.panel()
        l0 = float(ds.coords["l"].values[2])
        m0 = float(ds.coords["m"].values[3])
        viewer._widget.clicked_coord = _radec_at_lm(ds, l0, m0)
        viewer._widget.click_tick = viewer._widget.click_tick + 1

        x = np.asarray(viewer._lightcurve_cds.data["x"], dtype=float)
        assert x.size == n_t
        assert np.nanmax(np.abs(x)) < 1e7  # not datetime64-as-float ns (~1e18)
        assert float(np.min(x)) > 60300.0  # ~MJD for 2024-06

    def test_lightcurve_float_unix_seconds_converted_to_mjd(self):
        from astrowidget.viewer import SkyViewer

        n_t, n_f = 3, 4
        data = np.random.randn(n_t, n_f, 1, 8, 8).astype(np.float32)
        # Seconds since Unix epoch (order 1e9) — same invisibility bug as datetime64→float
        t_unix = np.linspace(1_700_000_000.0, 1_700_000_000.0 + 7200.0, n_t, dtype=np.float64)
        ds = xr.Dataset(
            data_vars={"SKY": (["time", "frequency", "polarization", "l", "m"], data)},
            coords={
                "time": t_unix,
                "frequency": np.linspace(40e6, 80e6, n_f),
                "polarization": [0],
                "l": np.linspace(-0.2, 0.2, 8),
                "m": np.linspace(-0.2, 0.2, 8),
            },
            attrs={"fits_wcs_header": _make_wcs_header_str()},
        )
        viewer = SkyViewer(ds)
        viewer.panel()
        l0 = float(ds.coords["l"].values[2])
        m0 = float(ds.coords["m"].values[3])
        viewer._widget.clicked_coord = _radec_at_lm(ds, l0, m0)
        viewer._widget.click_tick = viewer._widget.click_tick + 1

        x = np.asarray(viewer._lightcurve_cds.data["x"], dtype=float)
        assert x.size == n_t
        assert np.nanmax(np.abs(x)) < 1e7
        assert float(np.min(x)) > 59000.0  # MJD for ~2023–2024 from unix 1.7e9

    def test_from_zarr(self, tmp_path):
        from astrowidget.viewer import SkyViewer
        zarr_path = tmp_path / "test.zarr"
        _make_dataset().to_zarr(str(zarr_path), mode="w")

        viewer = SkyViewer.from_zarr(zarr_path)
        assert viewer._cube.n_times == 3
        assert viewer._cube.n_freqs == 4

    def test_from_zarr_memory_store(self):
        import zarr
        from astrowidget.viewer import SkyViewer

        store = zarr.MemoryStore()
        _make_dataset().to_zarr(store, mode="w")

        viewer = SkyViewer.from_zarr(store)
        assert viewer._cube.n_times == 3
