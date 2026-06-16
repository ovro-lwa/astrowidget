"""Shader/WCS alignment tests for SkyWidget."""

from __future__ import annotations

import numpy as np
import pytest
from astropy.wcs import WCS

from astrowidget.wcs import (
    _naive_sin_world2pix,
    reproject_for_shader_display,
    wcs_projection_matches_naive_shader,
)


def _ovro_like_oblique_wcs() -> WCS:
    """SIN WCS with LONPOLE=180 similar to OVRO-LWA incremental Zarr headers."""
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---SIN", "DEC--SIN"]
    w.wcs.crval = [89.0, 37.0]
    w.wcs.cdelt = [-0.111, 0.111]
    w.wcs.crpix = [521.0, 521.0]
    w.wcs.cunit = ["deg", "deg"]
    w.wcs.lonpole = 180.0
    w.wcs.latpole = 37.0
    return w


def test_naive_shader_matches_astropy_oblique_header() -> None:
    """WebGL SIN math must use CDELT in radians (OVRO-style headers)."""
    w = _ovro_like_oblique_wcs()
    assert wcs_projection_matches_naive_shader(w)
    ra, dec = 165.0, 55.0
    xp, yp = w.all_world2pix(ra, dec, 0)
    xn, yn = _naive_sin_world2pix(w, ra, dec)
    assert xn == pytest.approx(float(xp), abs=1e-3)
    assert yn == pytest.approx(float(yp), abs=1e-3)


def test_catalog_view_always_reprojects_when_naive_matches() -> None:
    """Fixed catalog center must not leave zenith CRVAL on the shader grid."""
    from astropy import units as u
    from astropy.coordinates import SkyCoord

    from astrowidget import SkyWidget

    from .test_wcs_time import _make_per_time_wcs_dataset

    assert wcs_projection_matches_naive_shader(_ovro_like_oblique_wcs())

    ds = _make_per_time_wcs_dataset(3)
    catalog = SkyCoord(97.67 * u.deg, 25.39 * u.deg, frame="icrs")
    widget = SkyWidget()
    widget.set_dataset(ds, max_size=64)
    widget.update_slice(0, 0, center=catalog, fov=8 * u.deg)
    crval_t0 = widget.crval[0]
    widget.update_slice(2, 0, center=catalog, fov=8 * u.deg)
    assert widget.crval[0] == pytest.approx(crval_t0, abs=0.01)
    assert widget.view_ra == pytest.approx(97.67, abs=0.01)


def test_reproject_places_extended_source_near_view_center() -> None:
    """Fallback reprojection samples oblique headers onto the shader grid."""
    w_src = _ovro_like_oblique_wcs()
    n_l, n_m = 1024, 1024
    data = np.zeros((n_l, n_m), dtype=np.float32)
    ra, dec = 95.0, 40.0
    xp, yp = w_src.all_world2pix(ra, dec, 0)
    li, mi = int(round(float(xp))), int(round(float(yp)))
    data[li - 1 : li + 2, mi - 1 : mi + 2] = 42.0

    out, w_out = reproject_for_shader_display(
        data,
        w_src,
        crval_ra=ra,
        crval_dec=dec,
    )
    assert wcs_projection_matches_naive_shader(w_out)
    xc, yc = _naive_sin_world2pix(w_out, ra, dec)
    ci, cj = int(round(xc)), int(round(yc))
    assert out[ci, cj] == pytest.approx(42.0, rel=0.05, abs=2.0)
