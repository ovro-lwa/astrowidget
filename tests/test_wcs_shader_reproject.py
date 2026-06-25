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


def test_shader_texture_axes_match_numpy_lm_order() -> None:
    """WCS axis 1 (l) indexes array rows; axis 2 (m) indexes columns.

    The WebGL shader must sample ``out[axis1, axis2]``, not the transpose.
    On square OVRO images a transpose looks like a flip + 90° rotation vs HiPS.
    """
    w_src = WCS(naxis=2)
    w_src.wcs.ctype = ["RA---SIN", "DEC--SIN"]
    w_src.wcs.crval = [89.0, 37.0]
    w_src.wcs.cdelt = [-0.111, 0.111]
    w_src.wcs.crpix = [256.5, 256.5]
    w_src.wcs.cunit = ["deg", "deg"]
    w_src.wcs.lonpole = 180.0
    w_src.wcs.latpole = 37.0

    n_l, n_m = 512, 512
    data = np.zeros((n_l, n_m), dtype=np.float32)
    ra_t, dec_t = 92.0, 40.0
    xp, yp = w_src.all_world2pix(ra_t, dec_t, 0)
    li, mi = int(round(float(xp))), int(round(float(yp)))
    assert li != mi
    data[li, mi] = 99.0

    out, w_out = reproject_for_shader_display(
        data, w_src, crval_ra=89.0, crval_dec=37.0
    )
    px, py = _naive_sin_world2pix(w_out, ra_t, dec_t)
    assert out[int(round(px)), int(round(py))] == pytest.approx(99.0, rel=0.05)
    assert out[int(round(py)), int(round(px))] == pytest.approx(0.0, abs=1e-6)


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


def test_reproject_rejects_far_hemisphere_mirror_ghost() -> None:
    """SIN is two-to-one over the sphere: a world point on the far hemisphere of
    the source tangent projects to the same intermediate (l, m) as its near-side
    mirror, so ``all_world2pix`` returns an in-bounds pixel. Reprojecting onto a
    grid centered there must NOT sample real source data (the bug shows ghost
    overlay data near the south celestial pole for OVRO zenith snapshots)."""
    w_src = WCS(naxis=2)
    w_src.wcs.ctype = ["RA---SIN", "DEC--SIN"]
    w_src.wcs.crval = [0.0, 0.0]
    w_src.wcs.cdelt = [-0.111, 0.111]
    w_src.wcs.crpix = [257.0, 257.0]
    w_src.wcs.cunit = ["deg", "deg"]
    # Real, finite data everywhere in the source image.
    data = np.full((512, 512), 42.0, dtype=np.float32)

    # Output grid centered on the antipode — entirely the far hemisphere of the
    # source tangent, where nothing real is visible. The antipode itself maps to
    # the source center pixel via the SIN mirror, so without rejection the output
    # center would be painted with real (42.0) data.
    out, _ = reproject_for_shader_display(
        data, w_src, crval_ra=180.0, crval_dec=0.0
    )
    assert np.all(np.isnan(out)), "far-hemisphere mirror leaked real source data"


def test_reproject_masks_southern_ghost_for_northern_snapshot() -> None:
    """Reprojecting an OVRO-like northern zenith snapshot onto a south-pole view
    must not paint a ghost at the (empty) view center.

    The south celestial pole is >90 deg from a Dec +37 zenith tangent, so it lies
    on the far hemisphere. Even with a source that has data all the way to its SIN
    horizon, the region around the southern view center must stay empty (NaN); only
    the far north edge of the view (still on the source's near hemisphere) may
    legitimately carry data.
    """
    w_src = _ovro_like_oblique_wcs()  # crval Dec +37, like OVRO zenith
    n_l, n_m = 1024, 1024
    data = np.full((n_l, n_m), 7.0, dtype=np.float32)

    out, w_out = reproject_for_shader_display(
        data, w_src, crval_ra=0.8495, crval_dec=-67.6553
    )
    # The clicked/empty target sits at the output reference pixel; a window around
    # it (the south-pole ghost location) must be entirely NaN.
    ci = int(round(float(w_out.wcs.crpix[0]))) - 1
    cj = int(round(float(w_out.wcs.crpix[1]))) - 1
    window = out[ci - 64 : ci + 64, cj - 64 : cj + 64]
    assert np.all(np.isnan(window)), "ghost overlay leaked at the south-pole view center"
