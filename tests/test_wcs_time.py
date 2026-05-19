"""Tests for per-time wcs_header_str (incremental ovro-lwa-portal zarr)."""

from __future__ import annotations

import numpy as np
import pytest
import xarray as xr
import zarr
from astropy.wcs import WCS


def _header_str_for_crval(ra: float, dec: float) -> str:
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---SIN", "DEC--SIN"]
    w.wcs.crval = [ra, dec]
    w.wcs.cdelt = [-0.1, 0.1]
    w.wcs.crpix = [8.5, 8.5]
    w.wcs.cunit = ["deg", "deg"]
    return w.to_header().tostring(sep="\n")


def _make_per_time_wcs_dataset(n_time: int = 3) -> xr.Dataset:
    """Dataset with wcs_header_str (time) |S2880 and no scalar fits_wcs_header."""
    crvals = [(180.0 + i, 45.0 + i) for i in range(n_time)]
    header_bytes = np.array(
        [_header_str_for_crval(ra, dec).encode("utf-8") for ra, dec in crvals],
        dtype="S2880",
    )
    data = np.random.randn(n_time, 2, 1, 8, 8).astype(np.float32)
    return xr.Dataset(
        data_vars={
            "SKY": (["time", "frequency", "polarization", "l", "m"], data),
            "wcs_header_str": (["time"], header_bytes),
        },
        coords={
            "time": np.linspace(60000.0, 60000.0 + n_time - 1, n_time),
            "frequency": [40e6, 50e6],
            "polarization": [0],
            "l": np.linspace(-0.5, 0.5, 8),
            "m": np.linspace(-0.5, 0.5, 8),
        },
    )


class TestPerTimeWcsHeaderStr:
    def test_get_wcs_selects_time_index(self):
        from astrowidget import get_wcs

        ds = _make_per_time_wcs_dataset(3)
        w0 = get_wcs(ds, time_idx=0)
        w2 = get_wcs(ds, time_idx=2)
        assert w0.wcs.crval[0] == pytest.approx(180.0)
        assert w2.wcs.crval[0] == pytest.approx(182.0)
        assert w2.wcs.crval[1] == pytest.approx(47.0)

    def test_get_wcs_0d_wcs_header_str_unchanged(self):
        from astrowidget import get_wcs

        hdr = _header_str_for_crval(200.0, 10.0)
        ds = _make_per_time_wcs_dataset(2).drop_vars("wcs_header_str")
        ds = ds.assign(wcs_header_str=np.array(hdr.encode("utf-8"), dtype="S2880"))

        wcs = get_wcs(ds)
        assert wcs.wcs.crval[0] == pytest.approx(200.0)

    def test_roundtrip_zarr_per_time_wcs(self, tmp_path):
        from astrowidget import get_wcs, open_dataset

        zarr_path = tmp_path / "incremental.zarr"
        _make_per_time_wcs_dataset(4).to_zarr(str(zarr_path), mode="w")

        ds = open_dataset(zarr_path)
        assert "wcs_header_str" in ds
        assert ds["wcs_header_str"].dims == ("time",)
        assert ds["wcs_header_str"].dtype == np.dtype("S2880")

        wcs = get_wcs(ds, time_idx=3)
        assert wcs.wcs.crval[0] == pytest.approx(183.0)

    def test_widget_updates_wcs_on_time_change(self):
        from astrowidget import SkyWidget

        ds = _make_per_time_wcs_dataset(3)
        w = SkyWidget()
        w.set_dataset(ds)

        assert w.crval[0] == pytest.approx(180.0)
        w.time_idx = 2
        assert w.crval[0] == pytest.approx(182.0)

    def test_memory_store_per_time_wcs(self):
        from astrowidget import get_wcs, open_dataset

        store = zarr.MemoryStore()
        _make_per_time_wcs_dataset(2).to_zarr(store, mode="w")
        ds = open_dataset(store)
        assert get_wcs(ds, time_idx=1).wcs.crval[0] == pytest.approx(181.0)
