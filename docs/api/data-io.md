# Data I/O API

Functions for loading zarr datasets and extracting WCS metadata.

## open_dataset

```python
from astrowidget import open_dataset

ds = open_dataset(source, chunks="auto", storage_options=None, **kwargs)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `source` | `str`, `Path`, `MutableMapping` | required | Zarr store path, URL, or in-memory store |
| `chunks` | `dict`, `str`, `None` | `"auto"` | Chunking strategy |
| `storage_options` | `dict` or `None` | `None` | S3/cloud credentials |

Returns `xr.Dataset`.

### Examples

```python
# Local
ds = open_dataset("/path/to/data.zarr")

# S3
ds = open_dataset("s3://bucket/data.zarr",
                  storage_options={"key": "...", "secret": "..."})

# In-memory
import zarr
store = zarr.MemoryStore()
ds = open_dataset(store)

# HTTPS
ds = open_dataset("https://server.org/data.zarr")
```

### Exceptions

| Exception | When |
|---|---|
| `FileNotFoundError` | Local path doesn't exist |
| `DataSourceError` | Remote access fails |
| `ImportError` | Missing remote deps (`pip install 'astrowidget[remote]'`) |

## get_wcs

```python
from astrowidget import get_wcs

wcs = get_wcs(ds, var="SKY", time_idx=0)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `ds` | `xr.Dataset` | required | Dataset with WCS metadata |
| `var` | `str` | `"SKY"` | Variable to check attrs on first |
| `time_idx` | `int` | `0` | Time index used for per-time `wcs_header_str` |

Returns `astropy.wcs.WCS`.

Searches four locations for the WCS header string:
1. `ds["wcs_header_str"]` with a `time` dimension (per-time header at `time_idx`)
2. `ds[var].attrs["fits_wcs_header"]`
3. `ds.attrs["fits_wcs_header"]`
4. scalar `ds["wcs_header_str"]` (0-D variable, bytes → string)

Raises `ValueError` if no WCS header is found.

## PreloadedCube

```python
from astrowidget import PreloadedCube

cube = PreloadedCube(ds, var="SKY", pol=0, max_size=512)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `ds` | `xr.Dataset` | required | Dataset with (time, frequency, polarization, l, m) |
| `var` | `str` | `"SKY"` | Data variable name |
| `pol` | `int` | `0` | Polarization index |
| `max_size` | `int` | `512` | Max display pixels per axis |

### Properties

| Property | Type | Description |
|---|---|---|
| `n_times` | `int` | Number of time steps |
| `n_freqs` | `int` | Number of frequency channels |
| `freq_mhz` | `ndarray` | Frequency values in MHz |
| `time_vals` | `ndarray` | Time values (MJD) |
| `l_vals` | `ndarray` | Strided l coordinates |
| `m_vals` | `ndarray` | Strided m coordinates |
| `stride_l` | `int` | Downsampling stride (l axis) |
| `stride_m` | `int` | Downsampling stride (m axis) |
| `chunk_l`, `chunk_m` | `int` or `None` | Spatial chunk length (dask chunks, else zarr encoding) |
| `full_window` | `CubeWindow` | Whole image at the cube's stride |
| `bounds` | `tuple` | (l_min, m_min, l_max, m_max) |

### Methods

| Method | Returns | Description |
|---|---|---|
| `image(time_idx, freq_idx)` | `ndarray (N,M)` | 2D display image in `(l, m)` order |
| `lazy_image(time_idx, freq_idx, *, window=None, pol=None)` | `xr.DataArray` | The same selection, not yet read (dask stays lazy) |
| `window_image(time_idx, freq_idx, window)` | `ndarray` | Sub-region at up to full resolution; reads only overlapping chunks |
| `window_for_pixel_bbox(l_min, l_max, m_min, m_max)` | `CubeWindow` or `None` | Chunk-aligned window for a full-res pixel box; `None` if no sharper than `image()` |
| `spectrum(l_idx, m_idx, time_idx)` | `ndarray (F,)` | Frequency spectrum at pixel |
| `light_curve(l_idx, m_idx, freq_idx)` | `ndarray (T,)` | Time series at pixel |
| `dynamic_spectrum(l_idx, m_idx)` | `ndarray (T,F)` | 2D time-freq waterfall |

All selections are applied to the lazy array and computed once per call. The
pixel traces read one spatial point (one chunk column), not whole images, and
do not touch the slice cache. Pixel indices are display indices (`l_vals` /
`m_vals`); out-of-range indices raise `IndexError`. Results are `float32`.

## CubeWindow

```python
from astrowidget import CubeWindow

win = CubeWindow(l_start, l_stop, m_start, m_stop, stride_l=1, stride_m=1)
```

Frozen, hashable description of `data[l_start:l_stop:stride_l, m_start:m_stop:stride_m]`
in full-resolution pixel indices. `win.shape` is the strided shape; pair it with
`adjust_wcs_for_window(wcs, win.l_start, win.m_start, win.stride_l, win.stride_m)`
for the matching WCS.
| `nearest_lm_idx(l, m)` | `(int, int)` | Nearest display pixel for (l,m) |

## DataSourceError

```python
from astrowidget import DataSourceError
```

Exception raised when a data source cannot be accessed or loaded.
