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

__all__ = ["get_wcs", "adjust_wcs_for_array_stride"]


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
        else:
            n_time = ds.sizes.get("time")
            if n_time is not None and wcs_var.sizes[wcs_var.dims[0]] != n_time:
                raise ValueError(
                    "wcs_header_str is 1-D but its length does not match "
                    f"ds.sizes['time'] ({n_time})"
                )
            val = np.asarray(wcs_var.values)[time_idx]
    else:
        raise ValueError(
            "wcs_header_str must be 0-D or 1-D with a time dimension, "
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

    Searches for the WCS header string in three locations (in order):
    1. Variable attrs: ``ds[var].attrs["fits_wcs_header"]``
    2. Dataset attrs: ``ds.attrs["fits_wcs_header"]``
    3. Variable: ``ds["wcs_header_str"]`` — 0-D scalar or 1-D per-time
       (e.g. ``wcs_header_str (time) |S2880`` from incremental ovro-lwa-portal zarr)

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

    # 1. Check variable attrs
    if var in ds.data_vars:
        hdr_str = ds[var].attrs.get("fits_wcs_header")

    # 2. Check dataset attrs
    if not hdr_str:
        hdr_str = ds.attrs.get("fits_wcs_header")

    # 3. Check wcs_header_str variable (0-D or per-time 1-D)
    if not hdr_str:
        hdr_str = _wcs_header_str_from_variable(ds, time_idx)

    if not hdr_str:
        raise ValueError(
            "No WCS header found in dataset. Expected 'fits_wcs_header' "
            "attribute on variable/dataset or 'wcs_header_str' variable."
        )

    return WCS(Header.fromstring(hdr_str, sep="\n"))
