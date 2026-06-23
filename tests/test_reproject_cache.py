"""Tests for shader reproject skip logic and map caching."""

from __future__ import annotations

from unittest.mock import patch

import numpy as np
import pytest
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.wcs import WCS

from astrowidget import SkyWidget
from astrowidget.wcs import (
    apply_reproject_maps,
    build_reproject_maps,
    reproject_for_shader_display,
    should_skip_shader_reproject,
    wcs_projection_matches_naive_shader,
)

from .test_wcs_shader_reproject import _ovro_like_oblique_wcs
from .test_wcs_time import _make_per_time_wcs_dataset


def _simple_wcs(ra: float = 89.0, dec: float = 37.0) -> WCS:
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---SIN", "DEC--SIN"]
    w.wcs.crval = [ra, dec]
    w.wcs.cdelt = [-0.111, 0.111]
    w.wcs.crpix = [256.5, 256.5]
    w.wcs.cunit = ["deg", "deg"]
    return w


def test_should_skip_shader_reproject_near_crval() -> None:
    w = _simple_wcs()
    assert wcs_projection_matches_naive_shader(w)
    assert should_skip_shader_reproject(w, 89.0, 37.0) is True
    assert should_skip_shader_reproject(w, 89.005, 37.005) is True


def test_should_not_skip_shader_reproject_catalog_offset() -> None:
    w = _ovro_like_oblique_wcs()
    assert should_skip_shader_reproject(w, 97.67, 25.39) is False


def test_oblique_header_skips_at_crval_when_naive_matches() -> None:
    w = _ovro_like_oblique_wcs()
    assert wcs_projection_matches_naive_shader(w) is True
    assert should_skip_shader_reproject(w, 89.0, 37.0) is True


def test_skip_path_preserves_native_data_at_phase_center() -> None:
    w = _simple_wcs()
    n = 64
    data = np.random.default_rng(0).standard_normal((n, n), dtype=np.float32)
    widget = SkyWidget()
    widget._push_image_frame(data.copy(), w.deepcopy())
    assert np.allclose(widget._current_data, data, equal_nan=True)


def test_build_and_apply_reproject_maps_match_wrapper() -> None:
    w = _ovro_like_oblique_wcs()
    data = np.random.default_rng(1).standard_normal((128, 128), dtype=np.float32)
    maps = build_reproject_maps(w, data.shape, crval_ra=95.0, crval_dec=40.0)
    wrapped, w_out = reproject_for_shader_display(
        data, w, crval_ra=95.0, crval_dec=40.0
    )
    applied = apply_reproject_maps(data, maps)
    assert np.allclose(applied, wrapped, equal_nan=True)
    assert wcs_projection_matches_naive_shader(w_out)


def test_reproject_map_cache_reused_on_same_slice() -> None:
    ds = _make_per_time_wcs_dataset(3)
    catalog = SkyCoord(97.67 * u.deg, 25.39 * u.deg, frame="icrs")
    widget = SkyWidget()
    widget.set_dataset(ds, max_size=64, defer_display=True)

    with patch(
        "astrowidget.wcs.build_reproject_maps",
        wraps=build_reproject_maps,
    ) as build_mock:
        widget.update_slice(0, 0, center=catalog, fov=8 * u.deg)
        widget.update_slice(0, 0, center=catalog, fov=8 * u.deg)
        assert build_mock.call_count == 1


def test_reproject_map_cache_rebuilds_when_time_wcs_changes() -> None:
    ds = _make_per_time_wcs_dataset(3)
    catalog = SkyCoord(97.67 * u.deg, 25.39 * u.deg, frame="icrs")
    widget = SkyWidget()
    widget.set_dataset(ds, max_size=64, defer_display=True)

    with patch(
        "astrowidget.wcs.build_reproject_maps",
        wraps=build_reproject_maps,
    ) as build_mock:
        widget.update_slice(0, 0, center=catalog, fov=8 * u.deg)
        widget.update_slice(2, 0, center=catalog, fov=8 * u.deg)
        assert build_mock.call_count == 2

    assert widget.view_ra == pytest.approx(97.67, abs=0.01)
    assert widget.crval[0] == pytest.approx(97.67, abs=0.01)


def test_reproject_map_cache_evicts_oldest_entry() -> None:
    widget = SkyWidget()
    w = _simple_wcs()
    data = np.zeros((32, 32), dtype=np.float32)

    for offset in range(5):
        ra = 89.0 + float(offset)
        widget._reproject_with_cached_maps(data, w.deepcopy(), ra, 37.0)

    assert len(widget._reproject_map_cache) == 4
