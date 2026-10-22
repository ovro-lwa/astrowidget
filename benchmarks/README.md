# Benchmarks

[pyperf](https://pyperf.readthedocs.io/) benchmarks for `PreloadedCube`
(issue #24). They write a synthetic cube to a local zarr store once and time
the hot paths for three backends: `numpy` (cube loaded into memory), `zarr`
(xarray's lazy zarr backend, no dask) and `dask` (lazy zarr through dask).

```bash
pixi run bench -- --fast                 # quick look (~3 min)
pixi run bench -- -o branch.json         # full run, saved
python -m pyperf compare_to main.json branch.json --table
```

To time another checkout with the same script and store, point `PYTHONPATH`
at its `src/`:

```bash
git worktree add /tmp/aw-main origin/main
PYTHONPATH=/tmp/aw-main/src pixi run bench -- --fast -o main.json
```

| Variable | Default | Meaning |
|---|---|---|
| `BENCH_NL` | `2048` | Spatial size (l = m) |
| `BENCH_NT` | `8` | Time steps |
| `BENCH_NF` | `8` | Frequency channels |
| `BENCH_CHUNK` | `512` | Spatial zarr chunk |
| `BENCH_DIR` | `$TMPDIR/astrowidget-bench` | Where the store is written (~1 GB at defaults) |

These variables (and `PYTHONPATH`) are forwarded to pyperf's worker
processes automatically.

Benchmarks: `image` (uncached slice), `image_cached`, `window_image`
(512² full-res viewport window), `spectrum`, `light_curve`,
`dynamic_spectrum` — each as `[numpy]`, `[zarr]` and `[dask]`.

Local zarr hides network latency. Against remote stores, the per-chunk cost
is much higher, so the chunk-count reductions matter more than these
timings suggest.
