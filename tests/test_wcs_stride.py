"""Regression tests for WCS bookkeeping under ``[::stride_l, ::stride_m]``."""

from __future__ import annotations

import numpy as np
import pytest
from astropy.wcs import WCS


def _linear_celestial_wcs(
    *,
    crval: tuple[float, float] = (180.0, 45.0),
    cdelt: tuple[float, float] = (-0.01, 0.01),
    crpix: tuple[float, float] = (8.5, 8.5),
) -> WCS:
    """Minimal 2D celestial WCS (linear; sufficient for stride algebra)."""
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = list(crval)
    w.wcs.cdelt = list(cdelt)
    w.wcs.crpix = list(crpix)
    w.wcs.cunit = ["deg", "deg"]
    return w


class TestAdjustWcsForArrayStride:
    def test_stride_one_is_identity(self):
        from astrowidget.wcs import adjust_wcs_for_array_stride

        w = _linear_celestial_wcs()
        out = adjust_wcs_for_array_stride(w, 1, 1)
        assert out.wcs.cdelt[0] == pytest.approx(w.wcs.cdelt[0])
        assert out.wcs.cdelt[1] == pytest.approx(w.wcs.cdelt[1])
        assert out.wcs.crpix[0] == pytest.approx(w.wcs.crpix[0])
        assert out.wcs.crpix[1] == pytest.approx(w.wcs.crpix[1])

    def test_coarse_pixels_match_sampled_full_pixels(self):
        """World at coarse (k_l, k_m) equals world at full (k_l*sl, k_m*sm), 0-based."""
        from astrowidget.wcs import adjust_wcs_for_array_stride

        w = _linear_celestial_wcs(
            crval=(100.0, 20.0),
            cdelt=(-0.1, 0.1),
            crpix=(8.5, 12.25),
        )
        sl, sm = 4, 3
        w_coarse = adjust_wcs_for_array_stride(w, sl, sm)

        n_l, n_m = 32, 24
        n_lp = (n_l + sl - 1) // sl  # not used directly; sample a few corners
        n_mp = (n_m + sm - 1) // sm
        for k_l in [0, 1, n_lp - 1]:
            for k_m in [0, n_mp - 1]:
                i_full = k_l * sl
                j_full = k_m * sm
                if i_full >= n_l or j_full >= n_m:
                    continue
                ra_f, dec_f = w.pixel_to_world_values(i_full, j_full)
                ra_c, dec_c = w_coarse.pixel_to_world_values(k_l, k_m)
                assert ra_c == pytest.approx(ra_f, abs=1e-9)
                assert dec_c == pytest.approx(dec_f, abs=1e-9)

    def test_old_formula_would_mismatch(self):
        """Document: (crpix - 0.5)/s + 0.5 is not equivalent for stride > 1."""
        w = _linear_celestial_wcs(
            crval=(100.0, 20.0),
            cdelt=(-0.1, 0.1),
            crpix=(8.5, 12.25),
        )
        sl = 4
        wrong_crpix1 = (w.wcs.crpix[0] - 0.5) / sl + 0.5
        right_crpix1 = (w.wcs.crpix[0] + sl - 1.0) / sl
        assert wrong_crpix1 != pytest.approx(right_crpix1)
        assert right_crpix1 == pytest.approx((8.5 + 3.0) / 4.0)

    def test_clamps_nonpositive_stride(self):
        from astrowidget.wcs import adjust_wcs_for_array_stride

        w = _linear_celestial_wcs()
        out = adjust_wcs_for_array_stride(w, 0, -5)
        assert out.wcs.cdelt[0] == pytest.approx(w.wcs.cdelt[0])
        assert out.wcs.cdelt[1] == pytest.approx(w.wcs.cdelt[1])

    def test_grid_vectorized_match(self):
        from astrowidget.wcs import adjust_wcs_for_array_stride

        w = _linear_celestial_wcs(crval=(50.0, -30.0), cdelt=(0.02, -0.03), crpix=(20.0, 15.0))
        sl, sm = 2, 2
        wc = adjust_wcs_for_array_stride(w, sl, sm)
        n_l, n_m = 16, 12
        kl = np.arange(0, (n_l + sl - 1) // sl)
        km = np.arange(0, (n_m + sm - 1) // sm)
        i_full = kl[:, None] * sl
        j_full = km[None, :] * sm
        mask = (i_full < n_l) & (j_full < n_m)
        ra_f, dec_f = w.pixel_to_world_values(i_full, j_full)
        ra_c, dec_c = wc.pixel_to_world_values(
            np.broadcast_to(kl[:, None], i_full.shape),
            np.broadcast_to(km[None, :], j_full.shape),
        )
        np.testing.assert_allclose(ra_c[mask], ra_f[mask], rtol=0, atol=1e-9)
        np.testing.assert_allclose(dec_c[mask], dec_f[mask], rtol=0, atol=1e-9)
