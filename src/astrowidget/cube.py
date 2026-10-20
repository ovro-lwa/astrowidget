"""PreloadedCube — LRU-cached slice loader for interactive visualization.

Loads individual 2D slices on demand with strided downsampling and caches
them for fast repeated access. Adapted from ovro_lwa_portal.viz._data.

Every selection (time, frequency, polarization, spatial stride, viewport
window, single pixel) is applied to the lazy xarray/dask array first; data is
materialized exactly once, at the public method boundary. With a dask-backed
dataset that means only the zarr chunks touched by the selection are read,
and the work runs on whatever dask scheduler is active — including a
``dask.distributed`` ``Client`` when one has been created.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from functools import lru_cache
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    import xarray as xr

__all__ = ["CubeWindow", "PreloadedCube"]

_MAX_DISPLAY_SIZE = 512
_CACHE_SIZE = 32
# Window edges snap to this grid when the data has no spatial chunking, so
# small pans reuse the same cached window.
_UNCHUNKED_WINDOW_ALIGN = 64


@dataclass(frozen=True)
class CubeWindow:
    """Half-open full-resolution pixel window ``[start, stop)`` with a stride.

    ``data[l_start:l_stop:stride_l, m_start:m_stop:stride_m]`` is the array a
    window describes. Instances are hashable so they can key the slice cache.
    """

    l_start: int
    l_stop: int
    m_start: int
    m_stop: int
    stride_l: int = 1
    stride_m: int = 1

    @property
    def shape(self) -> tuple[int, int]:
        """Shape of the strided window array."""
        return (
            len(range(self.l_start, self.l_stop, self.stride_l)),
            len(range(self.m_start, self.m_stop, self.stride_m)),
        )

    def isel(self) -> dict[str, slice]:
        """``isel`` indexers for the spatial ``l`` / ``m`` dimensions."""
        return {
            "l": slice(self.l_start, self.l_stop, self.stride_l),
            "m": slice(self.m_start, self.m_stop, self.stride_m),
        }


def _spatial_chunk(ds: xr.Dataset, var: str, dim: str) -> int | None:
    """Spatial chunk length along *dim* that reads are actually issued at.

    The zarr encoding comes first: dask fuses slices of zarr-backed arrays
    down to storage reads, so even when ``chunks="auto"`` merges several
    stored chunks into one dask block, a window only reads the stored chunks
    it overlaps. Aligning to the stored chunk keeps windows tight. Dask
    chunks are the fallback for datasets with no zarr encoding.
    """
    da = ds[var]
    axis = da.dims.index(dim)
    enc = da.encoding.get("preferred_chunks") or da.encoding.get("chunks")
    if isinstance(enc, dict):
        val = enc.get(dim)
        if val:
            return int(val)
    elif enc is not None and len(enc) == da.ndim:
        return int(enc[axis])
    if da.chunks is not None:
        sizes = da.chunks[axis]
        return int(max(sizes)) if sizes else None
    return None


def _to_numpy(var: xr.Variable) -> np.ndarray:
    """Materialize *var* once (dask → active scheduler) as float32."""
    return np.asarray(var.compute().data, dtype=np.float32)


class PreloadedCube:
    """Cached, spatially downsampled accessor for radio astronomy datasets.

    Loads individual 2D (l, m) slices on demand, applies strided
    downsampling to cap display resolution, and caches recently
    accessed slices via a per-instance LRU cache.

    Parameters
    ----------
    ds : xr.Dataset
        Dataset with dimensions (time, frequency, polarization, l, m).
    var : str, default "SKY"
        Data variable name.
    pol : int, default 0
        Polarization index.
    max_size : int, default 512
        Maximum spatial dimension after downsampling.
    """

    def __init__(
        self,
        ds: xr.Dataset,
        var: str = "SKY",
        pol: int = 0,
        max_size: int = _MAX_DISPLAY_SIZE,
    ) -> None:
        self._ds = ds
        self.var = var
        self.pol = pol
        self.max_size = int(max_size)

        self.n_l = int(ds.sizes["l"])
        self.n_m = int(ds.sizes["m"])
        self.stride_l = max(1, self.n_l // self.max_size)
        self.stride_m = max(1, self.n_m // self.max_size)
        self.chunk_l = _spatial_chunk(ds, var, "l")
        self.chunk_m = _spatial_chunk(ds, var, "m")

        # Dimension coordinates are in-memory pandas indexes in xarray (never
        # dask-backed), so reading them here does not touch the data variable.
        self.l_vals = ds.coords["l"].values[:: self.stride_l]
        self.m_vals = ds.coords["m"].values[:: self.stride_m]
        self.time_vals = ds.coords["time"].values
        self.freq_vals = ds.coords["frequency"].values
        self.freq_mhz = self.freq_vals / 1e6
        self.n_times = len(self.time_vals)
        self.n_freqs = len(self.freq_vals)

        # Per-instance cache: a class-level lru_cache would pin every cube
        # (and its dataset) for the life of the process and share 32 slots
        # across all instances.
        self._load_slice = lru_cache(maxsize=_CACHE_SIZE)(self._load_slice_impl)

    # ------------------------------------------------------------------
    # Lazy selection (no data is read here)
    # ------------------------------------------------------------------

    @property
    def full_window(self) -> CubeWindow:
        """The default display window: whole image at the cube's stride."""
        return CubeWindow(0, self.n_l, 0, self.n_m, self.stride_l, self.stride_m)

    def lazy_image(
        self,
        time_idx: int = 0,
        freq_idx: int = 0,
        *,
        window: CubeWindow | None = None,
        pol: int | None = None,
    ) -> xr.DataArray:
        """Return the selected 2D ``(l, m)`` slice without reading any data.

        The result keeps the dataset's array type: dask-backed datasets stay
        lazy until the caller computes. ``window`` defaults to
        :attr:`full_window` (the same strided grid :meth:`image` returns).
        """
        return self._ds[self.var].isel(self._image_indexers(time_idx, freq_idx, window, pol))

    def _image_indexers(
        self,
        time_idx: int,
        freq_idx: int,
        window: CubeWindow | None,
        pol: int | None,
    ) -> dict[str, int | slice]:
        win = self.full_window if window is None else window
        return {
            "time": int(time_idx),
            "frequency": int(freq_idx),
            "polarization": int(self.pol if pol is None else pol),
            **win.isel(),
        }

    def _variable(self) -> xr.Variable:
        """The data variable without coordinates.

        Materializing paths select on the ``Variable``: the same lazy
        selection as on the ``DataArray``, without re-indexing every
        coordinate (≈50 µs per call, the whole cost of an in-memory read).
        """
        return self._ds[self.var].variable

    def _full_index(self, idx: int, n_display: int, stride: int, axis: str) -> int:
        """Map a display pixel index to the full-resolution index it samples."""
        i = int(idx)
        if i < 0:
            i += n_display
        if not 0 <= i < n_display:
            msg = f"{axis} display index {idx} out of range for size {n_display}"
            raise IndexError(msg)
        return i * stride

    def _lazy_pixel(self, l_idx: int, m_idx: int, **indexers: int) -> xr.Variable:
        """Lazy trace at one display pixel (``(time, frequency)`` unless narrowed).

        Extra ``indexers`` go into the same ``isel`` so dask fuses the whole
        selection into one storage read per chunk.
        """
        return self._variable().isel(
            polarization=int(self.pol),
            l=self._full_index(l_idx, len(self.l_vals), self.stride_l, "l"),
            m=self._full_index(m_idx, len(self.m_vals), self.stride_m, "m"),
            **{k: int(v) for k, v in indexers.items()},
        )

    # ------------------------------------------------------------------
    # Materialized access (compute boundary)
    # ------------------------------------------------------------------

    def _load_slice_impl(
        self,
        time_idx: int,
        freq_idx: int,
        pol: int,
        window: CubeWindow | None = None,
    ) -> np.ndarray:
        """Load one (optionally windowed) 2D slice. Cached via LRU."""
        indexers = self._image_indexers(time_idx, freq_idx, window, pol)
        return _to_numpy(self._variable().isel(indexers))

    def image(self, time_idx: int = 0, freq_idx: int = 0) -> np.ndarray:
        """Get a 2D image slice in ``(l, m)`` order matching the display WCS.

        The WebGL texture is uploaded as width ``n_m`` × height ``n_l`` (numpy
        columns = axis 2, rows = axis 1). Do not transpose here; transposing
        ``(l, m)`` to ``(m, l)`` mis-registers the sky overlay when ``CRVAL``
        changes per time step.
        """
        return self._load_slice(time_idx, freq_idx, int(self.pol))

    def window_image(
        self,
        time_idx: int,
        freq_idx: int,
        window: CubeWindow,
    ) -> np.ndarray:
        """Load a full-resolution sub-region (see :meth:`window_for_pixel_bbox`).

        Only the zarr chunks overlapping ``window`` are read.
        """
        if window == self.full_window:
            return self.image(time_idx, freq_idx)
        return self._load_slice(int(time_idx), int(freq_idx), int(self.pol), window)

    def spectrum(self, l_idx: int, m_idx: int, time_idx: int) -> np.ndarray:
        """Get a 1D frequency spectrum at a display pixel and time."""
        return _to_numpy(self._lazy_pixel(l_idx, m_idx, time=time_idx))

    def light_curve(self, l_idx: int, m_idx: int, freq_idx: int) -> np.ndarray:
        """Get a 1D time series at a display pixel and frequency."""
        return _to_numpy(self._lazy_pixel(l_idx, m_idx, frequency=freq_idx))

    def dynamic_spectrum(self, l_idx: int, m_idx: int) -> np.ndarray:
        """Get a 2D (time, freq) dynamic spectrum at a display pixel."""
        return _to_numpy(
            self._lazy_pixel(l_idx, m_idx).transpose("time", "frequency")
        )

    # ------------------------------------------------------------------
    # Viewport windows
    # ------------------------------------------------------------------

    def window_for_pixel_bbox(
        self,
        l_min: float,
        l_max: float,
        m_min: float,
        m_max: float,
    ) -> CubeWindow | None:
        """Smallest chunk-aligned window covering a full-res pixel bounding box.

        The stride is the smallest that keeps the window within ``max_size``
        per axis. Returns ``None`` when the box misses the image or when the
        window would be no sharper than the full strided image — callers then
        fall back to :meth:`image`.
        """
        lo_l = max(0, math.floor(l_min))
        hi_l = min(self.n_l, math.ceil(l_max) + 1)
        lo_m = max(0, math.floor(m_min))
        hi_m = min(self.n_m, math.ceil(m_max) + 1)
        if lo_l >= hi_l or lo_m >= hi_m:
            return None

        lo_l, hi_l = _snap(lo_l, hi_l, self.chunk_l, self.n_l)
        lo_m, hi_m = _snap(lo_m, hi_m, self.chunk_m, self.n_m)
        stride_l = max(1, -(-(hi_l - lo_l) // self.max_size))
        stride_m = max(1, -(-(hi_m - lo_m) // self.max_size))
        if stride_l >= self.stride_l and stride_m >= self.stride_m:
            return None
        # Never go coarser than the full image on either axis.
        stride_l = min(stride_l, self.stride_l)
        stride_m = min(stride_m, self.stride_m)
        return CubeWindow(lo_l, hi_l, lo_m, hi_m, stride_l, stride_m)

    # ------------------------------------------------------------------
    # Coordinates
    # ------------------------------------------------------------------

    def nearest_lm_idx(self, l: float, m: float) -> tuple[int, int]:  # noqa: E741
        """Find nearest display pixel indices for given l, m values."""
        l_idx = int(np.argmin(np.abs(self.l_vals - l)))
        m_idx = int(np.argmin(np.abs(self.m_vals - m)))
        return l_idx, m_idx

    def display_indices_from_radec(
        self,
        ra_deg: float,
        dec_deg: float,
        wcs: object,
    ) -> tuple[int, int]:
        """Map celestial coordinates to downsampled ``(l_idx, m_idx)`` display pixels.

        Uses the display WCS (strided to match :meth:`image`). Falls back to the
        nearest ``l``/``m`` coordinate arrays when the position is off the image.
        """
        xp, yp = wcs.all_world2pix(float(ra_deg), float(dec_deg), 0)  # type: ignore[union-attr]
        if not (np.isfinite(xp) and np.isfinite(yp)):
            msg = "RA/Dec is outside the image footprint"
            raise ValueError(msg)
        l_idx = int(np.clip(np.round(xp), 0, len(self.l_vals) - 1))
        m_idx = int(np.clip(np.round(yp), 0, len(self.m_vals) - 1))
        return l_idx, m_idx

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        """Image bounds as (l_left, m_bottom, l_right, m_top)."""
        return (
            float(self.l_vals[0]),
            float(self.m_vals[0]),
            float(self.l_vals[-1]),
            float(self.m_vals[-1]),
        )


def _snap(lo: int, hi: int, chunk: int | None, n: int) -> tuple[int, int]:
    """Grow ``[lo, hi)`` outward to chunk boundaries, clipped to ``[0, n)``."""
    step = int(chunk) if chunk and chunk < n else _UNCHUNKED_WINDOW_ALIGN
    return (lo // step) * step, min(n, -(-hi // step) * step)
