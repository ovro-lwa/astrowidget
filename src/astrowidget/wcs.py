"""WCS extraction from zarr dataset metadata.

Searches for FITS WCS header strings stored redundantly during
FITS→zarr conversion. Adapted from ovro_lwa_portal.accessor._get_wcs.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from astropy.wcs import WCS as AstropyWCS
    import xarray as xr

__all__ = [
    "get_wcs",
    "adjust_wcs_for_array_stride",
    "wcs_projection_matches_naive_shader",
    "reproject_for_shader_display",
]


def _decode_fits_wcs_header(val) -> str:
    """Decode a FITS header string from scalar bytes, str, or numpy scalar."""
    if isinstance(val, np.ndarray):
        if val.ndim == 0:
            val = val.item()
        else:
            raise ValueError(
                f"Expected scalar WCS header value, got array with shape {val.shape}"
            )
    if isinstance(val, (bytes, bytearray)) or type(val).__name__ == "bytes_":
        return val.decode("utf-8", errors="replace").rstrip("\x00")
    return str(val).rstrip("\x00")


def _wcs_header_str_from_variable(ds: xr.Dataset, time_idx: int) -> str | None:
    """Read ``wcs_header_str`` (0-D or per-time 1-D) from the dataset."""
    if "wcs_header_str" not in ds:
        return None

    wcs_var = ds["wcs_header_str"]
    if wcs_var.ndim == 0:
        val = wcs_var.values
    elif wcs_var.ndim == 1:
        if "time" in wcs_var.dims:
            val = wcs_var.isel(time=time_idx).values
        elif "frequency" in wcs_var.dims:
            val = wcs_var.isel(frequency=0).values
        else:
            n_time = ds.sizes.get("time")
            if n_time is not None and wcs_var.sizes[wcs_var.dims[0]] != n_time:
                raise ValueError(
                    "wcs_header_str is 1-D but its length does not match "
                    f"ds.sizes['time'] ({n_time})"
                )
            val = np.asarray(wcs_var.values)[time_idx]
    elif wcs_var.ndim == 2 and "time" in wcs_var.dims:
        sel = wcs_var.isel(time=time_idx)
        if "frequency" in sel.dims:
            sel = sel.isel(frequency=0)
        val = sel.values
    else:
        raise ValueError(
            "wcs_header_str must be 0-D, 1-D with time, or 2-D (time, frequency); "
            f"got shape {tuple(wcs_var.shape)}"
        )

    return _decode_fits_wcs_header(val)


def adjust_wcs_for_array_stride(
    wcs: AstropyWCS,
    stride_l: int,
    stride_m: int,
) -> AstropyWCS:
    """Return a WCS describing ``data[::stride_l, ::stride_m]`` on the same sky grid.

    ``PreloadedCube`` downsamples with leading-edge NumPy striding: coarse
    0-based pixel ``(k_l, k_m)`` samples full-resolution 0-based
    ``(k_l * stride_l, k_m * stride_m)``, i.e. FITS 1-based pixels
    ``P = k * stride + 1`` along each axis.

    For a separable linear axis mapping
    ``world = CRVAL + (P - CRPIX) * CDELT`` (FITS 1-based ``P``), the coarse
    grid with ``CDELT' = CDELT * stride`` must use
    ``CRPIX' = (CRPIX + stride - 1) / stride`` so every coarse pixel matches
    the world coordinate of the sampled full pixel.

    Parameters
    ----------
    wcs : astropy.wcs.WCS
        Full-resolution 2D celestial WCS (axis 1 ↔ first index ``l``,
        axis 2 ↔ second index ``m`` in the unstored array).
    stride_l, stride_m : int
        Stride along each axis; values ``< 1`` are treated as ``1``.

    Returns
    -------
    astropy.wcs.WCS
        Deep copy with ``cdelt`` and ``crpix`` updated; other header fields
        unchanged (``PC``/``CD`` matrices are not recomputed—diagonal ``cdelt``
        scaling only matches pure CDELT-type headers).
    """
    sl = max(1, int(stride_l))
    sm = max(1, int(stride_m))
    out = wcs.deepcopy()
    out.wcs.cdelt = [
        wcs.wcs.cdelt[0] * sl,
        wcs.wcs.cdelt[1] * sm,
    ]
    out.wcs.crpix = [
        (wcs.wcs.crpix[0] + sl - 1.0) / sl,
        (wcs.wcs.crpix[1] + sm - 1.0) / sm,
    ]
    return out


def get_wcs(ds: xr.Dataset, var: str = "SKY", time_idx: int = 0):
    """Extract WCS from zarr dataset metadata.

    Searches for the WCS header string in this order:

    1. ``wcs_header_str`` with a ``time`` dimension (per-slice headers from
       incremental ovro-lwa-portal Zarr)
    2. Variable attrs: ``ds[var].attrs["fits_wcs_header"]``
    3. Dataset attrs: ``ds.attrs["fits_wcs_header"]``
    4. Scalar ``wcs_header_str`` (0-D)

    Parameters
    ----------
    ds : xr.Dataset
        Dataset with stored WCS metadata.
    var : str, default "SKY"
        Data variable to check attrs on first.
    time_idx : int, default 0
        Time index when ``wcs_header_str`` is stored per time step.

    Returns
    -------
    astropy.wcs.WCS
        The celestial WCS object.

    Raises
    ------
    ValueError
        If no WCS header is found in the dataset.
    """
    from astropy.io.fits import Header
    from astropy.wcs import WCS

    hdr_str = None
    has_per_time = False

    # 1. Per-time wcs_header_str (incremental Zarr) — no static-attr fallback
    if "wcs_header_str" in ds:
        wcs_var = ds["wcs_header_str"]
        if "time" in wcs_var.dims and int(wcs_var.sizes.get("time", 0)) > 0:
            has_per_time = True
            hdr_str = _wcs_header_str_from_variable(ds, time_idx)
            if hdr_str is not None and not str(hdr_str).strip():
                hdr_str = None

    if has_per_time:
        if not hdr_str:
            n_time = int(ds.sizes.get("time", 0))
            msg = (
                f"Missing WCS metadata for time index {time_idx} "
                f"(dataset has {n_time} time steps with per-time wcs_header_str)."
            )
            raise ValueError(msg)
    else:
        # 2. Static attrs fallback (single-phase-center stores only)
        if var in ds.data_vars:
            hdr_str = ds[var].attrs.get("fits_wcs_header")
        if not hdr_str:
            hdr_str = ds.attrs.get("fits_wcs_header")

        # 3. Scalar wcs_header_str
        if not hdr_str:
            hdr_str = _wcs_header_str_from_variable(ds, time_idx)

    if not hdr_str:
        raise ValueError(
            "No WCS header found in dataset. Expected 'fits_wcs_header' "
            "attribute on variable/dataset or 'wcs_header_str' variable."
        )

    wcs = WCS(Header.fromstring(hdr_str, sep="\n"))
    if not wcs.has_celestial:
        raise ValueError("WCS header has no celestial axes (RA/Dec)")
    return wcs.celestial


def _naive_sin_cdelt_rad(wcs: AstropyWCS) -> tuple[float, float]:
    """``CDELT`` in radians, matching the WebGL uniform conversion."""
    return (
        float(np.deg2rad(wcs.wcs.cdelt[0])),
        float(np.deg2rad(wcs.wcs.cdelt[1])),
    )


def _naive_sin_lm_from_pixel(
    wcs: AstropyWCS,
    l_pix: np.ndarray | float,
    m_pix: np.ndarray | float,
) -> tuple[np.ndarray, np.ndarray]:
    """Direction cosines (l, m) from 0-based pixel indices (shader convention)."""
    cdelt0, cdelt1 = _naive_sin_cdelt_rad(wcs)
    l_val = (np.asarray(l_pix, dtype=np.float64) - (wcs.wcs.crpix[0] - 1.0)) * cdelt0
    m_val = (np.asarray(m_pix, dtype=np.float64) - (wcs.wcs.crpix[1] - 1.0)) * cdelt1
    return l_val, m_val


def _naive_sin_lm_to_world(
    wcs: AstropyWCS,
    l_val: np.ndarray,
    m_val: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Inverse SIN: (l, m) → (RA, Dec) in degrees (matches ``js/projection.js``)."""
    ra0 = np.deg2rad(wcs.wcs.crval[0])
    dec0 = np.deg2rad(wcs.wcs.crval[1])
    r = np.hypot(l_val, m_val)
    sin_dec0 = np.sin(dec0)
    cos_dec0 = np.cos(dec0)
    cosc = np.sqrt(np.maximum(0.0, 1.0 - r * r))
    sinc = r
    with np.errstate(invalid="ignore", divide="ignore"):
        dec_rad = np.arcsin(cosc * sin_dec0 + (m_val * cos_dec0 * sinc) / np.where(r > 0, r, 1.0))
        ra_rad = ra0 + np.arctan2(
            l_val * sinc,
            r * cos_dec0 * cosc - m_val * sin_dec0 * sinc,
        )
    at_center = r <= 0
    dec_rad = np.where(at_center, dec0, dec_rad)
    ra_rad = np.where(at_center, ra0, ra_rad)
    return np.rad2deg(ra_rad), np.rad2deg(dec_rad)


def _naive_sin_world2pix(
    wcs: AstropyWCS,
    ra_deg: float,
    dec_deg: float,
) -> tuple[float, float]:
    """Pixel position from the WebGL shader's simplified SIN (no ``LONPOLE``)."""
    crval = np.deg2rad(wcs.wcs.crval)
    ra_rad = np.deg2rad(ra_deg)
    dec_rad = np.deg2rad(dec_deg)
    dra = ra_rad - crval[0]
    sin_dec = np.sin(dec_rad)
    cos_dec = np.cos(dec_rad)
    sin_dec0 = np.sin(crval[1])
    cos_dec0 = np.cos(crval[1])
    cos_dra = np.cos(dra)
    l_val = cos_dec * np.sin(dra)  # noqa: E741
    m_val = sin_dec * cos_dec0 - cos_dec * sin_dec0 * cos_dra
    cdelt0, cdelt1 = _naive_sin_cdelt_rad(wcs)
    px = l_val / cdelt0 + wcs.wcs.crpix[0] - 1.0
    py = m_val / cdelt1 + wcs.wcs.crpix[1] - 1.0
    return float(px), float(py)


def wcs_projection_matches_naive_shader(
    wcs: AstropyWCS,
    *,
    atol_pix: float = 0.5,
) -> bool:
    """Return whether the JS SIN shader matches :func:`astropy` for *wcs*.

    OVRO-LWA headers often set ``LONPOLE=180``; the shader ignores that rotation
    and mis-registers the texture by hundreds of pixels.
    """
    if not wcs.has_celestial:
        return True
    ra0, dec0 = float(wcs.wcs.crval[0]), float(wcs.wcs.crval[1])
    ra_t, dec_t = ra0 + 3.0, dec0 + 2.0
    if dec_t > 89.0:
        dec_t = dec0 - 2.0
    xp_a, yp_a = wcs.all_world2pix(ra_t, dec_t, 0)
    xp_n, yp_n = _naive_sin_world2pix(wcs, ra_t, dec_t)
    return abs(float(xp_a) - xp_n) <= atol_pix and abs(float(yp_a) - yp_n) <= atol_pix


def _make_naive_sin_wcs(
    template: AstropyWCS,
    *,
    crval_ra: float,
    crval_dec: float,
) -> AstropyWCS:
    """Build a standard SIN WCS that matches the WebGL shader assumptions."""
    from astropy.wcs import WCS

    out = WCS(naxis=2)
    out.wcs.ctype = ["RA---SIN", "DEC--SIN"]
    out.wcs.crval = [float(crval_ra), float(crval_dec)]
    out.wcs.cdelt = [float(template.wcs.cdelt[0]), float(template.wcs.cdelt[1])]
    out.wcs.crpix = [float(template.wcs.crpix[0]), float(template.wcs.crpix[1])]
    out.wcs.cunit = ["deg", "deg"]
    return out


def reproject_for_shader_display(
    data: np.ndarray,
    wcs_src: AstropyWCS,
    *,
    crval_ra: float,
    crval_dec: float,
) -> tuple[np.ndarray, AstropyWCS]:
    """Resample *data* onto a shader-compatible tangent plane centered on ``crval``.

    Parameters
    ----------
    data : np.ndarray
        2D image in ``(l, m)`` order (first axis = WCS axis 1).
    wcs_src : astropy.wcs.WCS
        Astropy WCS for *data* (may include oblique ``LONPOLE``).
    crval_ra, crval_dec : float
        Phase center for the output grid (typically the view center).

    Returns
    -------
    data_out : np.ndarray
        Reprojected float32 array, same shape as *data*.
    wcs_out : astropy.wcs.WCS
        Naive SIN WCS passed to the WebGL renderer.
    """
    from scipy.ndimage import map_coordinates

    if data.ndim != 2:
        msg = f"data must be 2D, got {data.ndim}D"
        raise ValueError(msg)
    if not wcs_src.has_celestial:
        msg = "wcs_src must have celestial axes"
        raise ValueError(msg)

    n_l, n_m = data.shape
    ll, mm = np.meshgrid(
        np.arange(n_l, dtype=np.float64),
        np.arange(n_m, dtype=np.float64),
        indexing="ij",
    )
    wcs_out = _make_naive_sin_wcs(
        wcs_src,
        crval_ra=crval_ra,
        crval_dec=crval_dec,
    )
    l_plane, m_plane = _naive_sin_lm_from_pixel(wcs_out, ll, mm)
    world_ra, world_dec = _naive_sin_lm_to_world(wcs_out, l_plane, m_plane)
    src_l, src_m = wcs_src.all_world2pix(world_ra, world_dec, 0)
    out = map_coordinates(
        data.astype(np.float64, copy=False),
        [src_l, src_m],
        order=1,
        mode="constant",
        cval=np.nan,
    )

    # SIN (orthographic) is two-to-one over the sphere: a world point on the far
    # hemisphere of the source tangent projects to the same intermediate (l, m)
    # as its near-side mirror, so all_world2pix returns an in-bounds pixel and we
    # would sample real data reflected across the pole (ghost overlay near, e.g.,
    # the south celestial pole for a northern OVRO zenith snapshot). Reject any
    # output sample whose world point is >= 90 deg from the source tangent.
    src_crval = wcs_src.celestial.wcs.crval
    ra0 = np.deg2rad(float(src_crval[0]))
    dec0 = np.deg2rad(float(src_crval[1]))
    ra_rad = np.deg2rad(world_ra)
    dec_rad = np.deg2rad(world_dec)
    cos_sep = np.sin(dec_rad) * np.sin(dec0) + np.cos(dec_rad) * np.cos(dec0) * np.cos(
        ra_rad - ra0
    )
    out[~(cos_sep > 0.0)] = np.nan

    return out.astype(np.float32, copy=False), wcs_out
