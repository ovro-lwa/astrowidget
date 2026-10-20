"""pyperf benchmarks for PreloadedCube (issue #24).

Builds a synthetic OVRO-LWA-shaped cube as a local zarr store once, then
times the hot paths for three backends: ``numpy`` (cube loaded into memory),
``zarr`` (xarray's lazy zarr backend, no dask) and ``dask`` (lazy zarr via
dask, on-disk chunks):

* ``image``            — first (uncached) display slice
* ``image_cached``     — repeat of the same slice (LRU hit)
* ``window_image``     — 512² full-resolution viewport window (#34)
* ``spectrum``         — frequency trace at one pixel
* ``light_curve``      — time trace at one pixel
* ``dynamic_spectrum`` — (time, frequency) trace at one pixel

Run::

    pixi run bench                         # quick run, prints a table
    pixi run bench -- -o results.json      # save for pyperf compare_to
    python -m pyperf compare_to main.json results.json --table

Environment overrides (all integers): ``BENCH_NL`` (spatial size, default
2048), ``BENCH_NT`` (times, 8), ``BENCH_NF`` (frequencies, 8),
``BENCH_CHUNK`` (spatial zarr chunk, 512). The store is written to
``$BENCH_DIR`` (default: a temp dir) and reused if it already matches.
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import pyperf
import xarray as xr

from astrowidget import PreloadedCube, open_dataset

try:  # absent before #34; lets the same script time older checkouts
    from astrowidget import CubeWindow
except ImportError:
    CubeWindow = None

NL = int(os.environ.get("BENCH_NL", 2048))
NT = int(os.environ.get("BENCH_NT", 8))
NF = int(os.environ.get("BENCH_NF", 8))
CHUNK = int(os.environ.get("BENCH_CHUNK", 512))
BENCH_DIR = Path(os.environ.get("BENCH_DIR", Path(tempfile.gettempdir()) / "astrowidget-bench"))
_ENV_NAMES = ("BENCH_NL", "BENCH_NT", "BENCH_NF", "BENCH_CHUNK", "BENCH_DIR", "PYTHONPATH")


def _store_path() -> Path:
    return BENCH_DIR / f"cube_t{NT}_f{NF}_l{NL}_c{CHUNK}.zarr"


def build_store() -> Path:
    """Write the synthetic cube once (time-chunked writes keep memory flat)."""
    path = _store_path()
    if (path / ".zattrs").exists() or (path / "zarr.json").exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    coords = {
        "time": 60000.0 + np.arange(NT) / 1440.0,
        "frequency": np.linspace(27e6, 88e6, NF),
        "polarization": [0],
        "l": np.linspace(-1, 1, NL),
        "m": np.linspace(-1, 1, NL),
    }
    rng = np.random.default_rng(0)
    for t in range(NT):
        block = rng.standard_normal((1, NF, 1, NL, NL), dtype=np.float32)
        ds = xr.Dataset(
            {"SKY": (["time", "frequency", "polarization", "l", "m"], block)},
            coords={**coords, "time": coords["time"][t : t + 1]},
        )
        if t == 0:
            enc = {"SKY": {"chunks": (1, 1, 1, CHUNK, CHUNK)}}
            ds.to_zarr(path, mode="w", encoding=enc, consolidated=True)
        else:
            ds.to_zarr(path, append_dim="time", consolidated=True)
    return path


class _Backend:
    """Opens the dataset on first use, so pyperf workers only load what they time.

    ``numpy`` is the whole cube loaded into memory; ``zarr`` is xarray's lazy
    zarr backend without dask (``chunks=None``); ``dask`` is lazy zarr through
    dask (``chunks={}``, the on-disk chunks).
    """

    def __init__(self, path: Path, name: str) -> None:
        self.path, self.name, self._ds = path, name, None

    @property
    def ds(self) -> xr.Dataset:
        if self._ds is None:
            if self.name == "numpy":
                self._ds = open_dataset(self.path, chunks=None).load()
            elif self.name == "zarr":
                self._ds = open_dataset(self.path, chunks=None)
            else:
                self._ds = open_dataset(self.path, chunks={})
        return self._ds


def _fresh_cube(backend: _Backend) -> PreloadedCube:
    return PreloadedCube(backend.ds, max_size=512)


def bench_image(loops: int, ds: _Backend) -> float:
    total = 0.0
    for i in range(loops):
        cube = _fresh_cube(ds)
        t0 = pyperf.perf_counter()
        cube.image(i % NT, i % NF)
        total += pyperf.perf_counter() - t0
    return total


def bench_image_cached(loops: int, ds: _Backend) -> float:
    cube = _fresh_cube(ds)
    cube.image(0, 0)
    t0 = pyperf.perf_counter()
    for _ in range(loops):
        cube.image(0, 0)
    return pyperf.perf_counter() - t0


def bench_window(loops: int, ds: _Backend) -> float:
    lo = (NL // 2 // CHUNK) * CHUNK
    win = CubeWindow(lo, min(NL, lo + 512), lo, min(NL, lo + 512), 1, 1)
    total = 0.0
    for i in range(loops):
        cube = _fresh_cube(ds)
        t0 = pyperf.perf_counter()
        cube.window_image(i % NT, i % NF, win)
        total += pyperf.perf_counter() - t0
    return total


def _bench_trace(method: str):
    def run(loops: int, ds: _Backend) -> float:
        cube = _fresh_cube(ds)
        n = len(cube.l_vals)
        fn = getattr(cube, method)
        t0 = pyperf.perf_counter()
        for i in range(loops):
            px = (i * 37) % n, (i * 53) % n
            if method == "spectrum":
                fn(*px, i % NT)
            elif method == "light_curve":
                fn(*px, i % NF)
            else:
                fn(*px)
        return pyperf.perf_counter() - t0

    return run


BENCHES = {
    "image": bench_image,
    "image_cached": bench_image_cached,
    "window_image": bench_window,
    "spectrum": _bench_trace("spectrum"),
    "light_curve": _bench_trace("light_curve"),
    "dynamic_spectrum": _bench_trace("dynamic_spectrum"),
}


def main() -> None:
    # pyperf workers get a scrubbed environment; forward the knobs above so
    # every worker times the same store (and PYTHONPATH, for timing another
    # checkout).
    if not any(a.startswith("--inherit-environ") for a in sys.argv):
        names = [n for n in _ENV_NAMES if n in os.environ]
        if names:
            sys.argv.append("--inherit-environ=" + ",".join(names))
    runner = pyperf.Runner()
    runner.metadata["cube_shape"] = f"t{NT} f{NF} p1 l{NL} m{NL}"
    runner.metadata["zarr_chunk"] = f"1x1x1x{CHUNK}x{CHUNK}"
    path = build_store()
    for backend in ("numpy", "zarr", "dask"):
        handle = _Backend(path, backend)
        for name, fn in BENCHES.items():
            if name == "window_image" and CubeWindow is None:
                continue
            runner.bench_time_func(f"{name}[{backend}]", fn, handle)


if __name__ == "__main__":
    main()
