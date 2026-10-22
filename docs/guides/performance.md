# Performance

astrowidget reads cubes lazily: every selection is applied to the lazy
xarray/dask array and data is read once, at the end. This page covers what
that means for I/O, the opt-in viewport loading, dask.distributed, and how to
benchmark.

## What gets read

`PreloadedCube` touches only the zarr chunks a request needs. For the
OVRO-LWA ingest layout (`(1, 1, 1, 1024, 1024)` chunks on a 4096² image),
counted against a zarr store:

| Request | Chunks read (of 256 in a 4 × 4 × 4096² cube) |
|---|---|
| `image(t, f)` (full view, strided to 512²) | 16 — every spatial chunk of one plane |
| `window_image(t, f, 512² window)` | 1 |
| `spectrum(l, m, t)` | 4 — one per frequency |
| `light_curve(l, m, f)` | 4 — one per time |
| `dynamic_spectrum(l, m)` | 16 — one per (time, frequency) |

Before these changes, plots read a full image per (time, frequency) pair to
extract one pixel, so a dynamic spectrum read the whole cube.

This holds for `open_dataset`'s default `chunks="auto"` too: dask merges
stored chunks into larger blocks, but slices of a zarr-backed array are fused
down to the storage read, so only the stored chunks inside the selection are
fetched. Viewport windows align to the **stored** chunk size for the same
reason.

A strided full-sky image still reads every spatial chunk of its plane —
striding skips pixels, not chunks. That is what viewport loading is for.

## Viewport loading

```python
widget.viewport_loading = True      # SkyWidget
viewer = SkyViewer(ds, viewport_loading=True)   # or the "Full-res when zoomed" checkbox
```

When on, zooming in replaces the strided full image with a window covering
the view (plus a 50 % margin on each side, so short pans do not reload),
aligned to the stored chunks and drawn at up to full resolution. Panning past
the margin loads a new window; zooming back out returns to the full image.
Reloads are debounced (0.3 s) and keep `vmin`/`vmax`, so the colour scale does
not jump while navigating. Changing time or frequency still rescales, as
without viewport loading, but from the pixels that were loaded: while zoomed
in, that is the window around the view rather than the whole image.

Off by default: the full-image path is unchanged unless you turn it on.
Frames you push yourself (`set_image`, `push_shader_frame`) are never replaced
by a window.

The same two rules hold for navigation with `overlay_view_lock`, whether or
not viewport loading is on: the debounced re-warp after a pan or zoom keeps
`vmin`/`vmax`, and it skips frames you pushed yourself. If you push your own
frames under view lock, observe `view_gesture_revision` and re-push. An
explicit `reproject_at_view()` call still rescales and always draws the cube
slice.

A debounced reload runs on a timer thread. The newest request wins: a load is
discarded, rather than drawn over newer state, when a later pan or zoom is
handled, or when `update_slice`, a time or frequency change, `set_dataset`,
`clear_image` or a pushed frame happens while it is loading. The same applies
to `refresh_viewport()` and `reproject_at_view()` called from another thread,
and to overlapping `update_slice` calls. `set_dataset`, `set_image` and
`push_shader_frame` are not ordered against each other across threads; make
those calls from one thread.

## dask.distributed

No configuration is needed. Every read is a single `compute()` on the
selection, so it runs on whichever scheduler is active — including a
`dask.distributed.Client` once one is created:

```python
from dask.distributed import Client

client = Client()        # local cluster, or Client("tcp://scheduler:8786")
ds = open_dataset("s3://…/obs.zarr")
cube = PreloadedCube(ds)
cube.dynamic_spectrum(256, 256)   # runs on the cluster
```

For interactive viewing, a cluster mostly adds latency; it pays off for batch
work over many slices or pixels. Install with `pip install
"astrowidget[distributed]"`.

## Benchmarks

`benchmarks/bench_cube.py` ([README](https://github.com/ovro-lwa/astrowidget/tree/main/benchmarks))
times the hot paths with [pyperf](https://pyperf.readthedocs.io/) on a
synthetic 8 × 8 × 2048² cube with 512² chunks, for an in-memory (`numpy`), a
lazy zarr without dask (`zarr`), and a dask-backed (`dask`) dataset:

```bash
pixi run bench -- --fast -o branch.json
python -m pyperf compare_to main.json branch.json --table
```

Results on an Apple M4 Max Mac Studio, local SSD, `--fast` (main = the
commit before these changes, `20446c8`):

| Benchmark | main | this branch | |
|---|---|---|---|
| `image[numpy]` | 43.8 µs | 15.5 µs | 2.8× faster |
| `image[zarr]` | 8.58 ms | 7.41 ms | 1.2× faster |
| `image[dask]` | 6.11 ms | 4.91 ms | 1.2× faster |
| `image_cached[*]` | 64–66 ns | 61–62 ns | same |
| `spectrum[zarr]` | 68.3 ms | 3.64 ms | 19× faster |
| `spectrum[dask]` | 48.7 ms | 2.80 ms | 17× faster |
| `light_curve[dask]` | 48.3 ms | 2.82 ms | 17× faster |
| `dynamic_spectrum[zarr]` | 531 ms | 29.8 ms | 18× faster |
| `dynamic_spectrum[dask]` | 395 ms | 18.2 ms | 22× faster |
| `dynamic_spectrum[numpy]` | 2.36 ms | 13.8 µs | 171× faster |
| `window_image[dask]` (512², full res) | — | 1.41 ms | new |

Local disk hides latency. Against object storage each chunk costs a round
trip, so the chunk counts above are the better guide to remote speedups.
